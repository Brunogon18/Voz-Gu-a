package com.deepcode.vozguia.mesh;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.ParcelUuid;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Native Java module for Voz Guía BLE GATT Mesh & Controlled Flooding.
 * Supports real BLE advertising, scanning, GATT server reception, and chunked GATT client
 * transmission strictly in foreground in compliance with Android BLE power policies.
 */
public class VozGuiaMeshModule extends ReactContextBaseJavaModule {
    public static final String MODULE_NAME = "VozGuiaMesh";

    private static final ParcelUuid DISCOVERY_SERVICE_UUID =
            ParcelUuid.fromString("0000FEAA-0000-1000-8000-00805F9B34FB");
    private static final UUID MESH_GATT_SERVICE_UUID =
            UUID.fromString("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
    private static final UUID MESH_GATT_RX_CHAR_UUID =
            UUID.fromString("6E400002-B5A3-F393-E0A9-E50E24DCCA9E");

    private static final int SEEN_CACHE_LIMIT = 256;
    private static final int FRAME_HEADER_BYTES = 4;
    private static final int CHUNK_PAYLOAD_BYTES = 16; // Fits inside default 20-byte BLE ATT payload
    private static final int MAX_CHUNKS = 250;

    private final Map<String, Boolean> seenPacketIds = Collections.synchronizedMap(
            new LinkedHashMap<String, Boolean>(SEEN_CACHE_LIMIT, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
                    return size() > SEEN_CACHE_LIMIT;
                }
            }
    );

    private final Map<String, BluetoothDevice> discoveredDevices = new ConcurrentHashMap<>();
    private final Map<String, byte[][]> reassemblyBuffers = new ConcurrentHashMap<>();
    private final AtomicInteger outgoingMessageSeq = new AtomicInteger(1);
    private final ExecutorService gattTxExecutor = Executors.newSingleThreadExecutor();

    private BluetoothLeScanner bleScanner;
    private BluetoothLeAdvertiser bleAdvertiser;
    private BluetoothGattServer gattServer;
    private ScanCallback activeScanCallback;
    private AdvertiseCallback activeAdvertiseCallback;
    private boolean isRunning = false;
    private String localNodeId = "VG-ANDROID";
    private int defaultMaxHops = 4;

    public VozGuiaMeshModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    public void getCapabilities(Promise promise) {
        try {
            BluetoothManager manager = (BluetoothManager)
                    getReactApplicationContext().getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
            boolean hasBle = getReactApplicationContext().getPackageManager()
                    .hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) && adapter != null;

            WritableMap map = Arguments.createMap();
            map.putBoolean("hasBleHardware", hasBle);
            map.putBoolean("hasNearbyConnections", false);
            map.putInt("androidSdkInt", Build.VERSION.SDK_INT);
            map.putString(
                    "foregroundOnlyNote",
                    "Escaneo, anuncio y transporte BLE GATT operan mientras Voz Guía está en primer plano."
            );
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("CAPABILITIES_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void startMeshService(String nodeId, int maxHops, Promise promise) {
        this.localNodeId = nodeId != null ? nodeId : "VG-ANDROID";
        this.defaultMaxHops = Math.max(1, maxHops);

        try {
            BluetoothManager manager = (BluetoothManager)
                    getReactApplicationContext().getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;

            if (adapter == null || !adapter.isEnabled() || !hasScanPermission()) {
                this.isRunning = false;
                promise.resolve(false);
                return;
            }

            startGattServer(manager);
            startBleScan(adapter);
            startBleAdvertise(adapter, this.localNodeId);
            this.isRunning = true;
            promise.resolve(true);
        } catch (SecurityException se) {
            this.isRunning = false;
            promise.resolve(false);
        } catch (Exception e) {
            promise.reject("START_MESH_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void stopMeshService(Promise promise) {
        try {
            stopBleOperations();
            this.isRunning = false;
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_MESH_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void broadcastPacket(String packetJson, Promise promise) {
        try {
            if (!this.isRunning || packetJson == null || packetJson.isEmpty()) {
                promise.resolve(false);
                return;
            }
            JSONObject json = new JSONObject(packetJson);
            String packetId = json.optString("packetId", UUID.randomUUID().toString());
            int ttl = json.optInt("ttl", this.defaultMaxHops);

            if (ttl <= 0 || Boolean.TRUE.equals(seenPacketIds.get(packetId))) {
                promise.resolve(false);
                return;
            }

            seenPacketIds.put(packetId, Boolean.TRUE);
            List<BluetoothDevice> targets = new ArrayList<>(discoveredDevices.values());
            if (targets.isEmpty() || !hasConnectPermission()) {
                promise.resolve(false);
                return;
            }

            final byte[] payloadBytes = packetJson.getBytes(StandardCharsets.UTF_8);
            final List<byte[]> frames = encodeFrames(payloadBytes);
            if (frames.isEmpty()) {
                promise.resolve(false);
                return;
            }

            gattTxExecutor.execute(() -> {
                for (BluetoothDevice device : targets) {
                    sendFramesToDevice(device, frames);
                }
            });

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("BROADCAST_ERROR", e.getMessage(), e);
        }
    }

    private List<byte[]> encodeFrames(byte[] payload) {
        int totalChunks = (int) Math.ceil((double) payload.length / CHUNK_PAYLOAD_BYTES);
        if (totalChunks <= 0 || totalChunks > MAX_CHUNKS) {
            return Collections.emptyList();
        }
        int msgId = outgoingMessageSeq.getAndIncrement() & 0xFFFF;
        List<byte[]> frames = new ArrayList<>(totalChunks);
        for (int seq = 0; seq < totalChunks; seq++) {
            int start = seq * CHUNK_PAYLOAD_BYTES;
            int len = Math.min(CHUNK_PAYLOAD_BYTES, payload.length - start);
            byte[] frame = new byte[FRAME_HEADER_BYTES + len];
            frame[0] = (byte) ((msgId >> 8) & 0xFF);
            frame[1] = (byte) (msgId & 0xFF);
            frame[2] = (byte) (seq & 0xFF);
            frame[3] = (byte) (totalChunks & 0xFF);
            System.arraycopy(payload, start, frame, FRAME_HEADER_BYTES, len);
            frames.add(frame);
        }
        return frames;
    }

    private void handleIncomingFrame(String deviceAddress, byte[] value) {
        if (value == null || value.length <= FRAME_HEADER_BYTES) return;
        int msgId = ((value[0] & 0xFF) << 8) | (value[1] & 0xFF);
        int seq = value[2] & 0xFF;
        int total = value[3] & 0xFF;
        if (total <= 0 || total > MAX_CHUNKS || seq >= total) return;

        String key = deviceAddress + ":" + msgId;
        byte[][] slots = reassemblyBuffers.computeIfAbsent(key, k -> new byte[total][]);
        if (slots.length != total) {
            reassemblyBuffers.remove(key);
            return;
        }
        slots[seq] = Arrays.copyOfRange(value, FRAME_HEADER_BYTES, value.length);

        for (byte[] chunk : slots) {
            if (chunk == null) return;
        }
        reassemblyBuffers.remove(key);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] chunk : slots) {
            out.write(chunk, 0, chunk.length);
        }
        String rawJson = new String(out.toByteArray(), StandardCharsets.UTF_8);

        try {
            JSONObject parsed = new JSONObject(rawJson);
            String packetId = parsed.optString("packetId", "");
            if (!packetId.isEmpty() && Boolean.TRUE.equals(seenPacketIds.get(packetId))) {
                return;
            }
            if (!packetId.isEmpty()) {
                seenPacketIds.put(packetId, Boolean.TRUE);
            }
            emitEvent("onMeshPacketReceived", rawJson);
        } catch (Exception ignored) {
            // Ignore malformed JSON frames
        }
    }

    private void startGattServer(BluetoothManager manager) throws SecurityException {
        if (!hasConnectPermission()) return;
        if (gattServer != null) {
            try {
                gattServer.close();
            } catch (Exception ignored) {
            }
            gattServer = null;
        }

        BluetoothGattServerCallback serverCallback = new BluetoothGattServerCallback() {
            @Override
            public void onCharacteristicWriteRequest(
                    BluetoothDevice device,
                    int requestId,
                    BluetoothGattCharacteristic characteristic,
                    boolean preparedWrite,
                    boolean responseNeeded,
                    int offset,
                    byte[] value
            ) {
                if (MESH_GATT_RX_CHAR_UUID.equals(characteristic.getUuid()) && value != null) {
                    String addr = device != null && device.getAddress() != null
                            ? device.getAddress()
                            : "BLE-PEER";
                    handleIncomingFrame(addr, value);
                }
                if (responseNeeded && gattServer != null && hasConnectPermission()) {
                    try {
                        gattServer.sendResponse(
                                device,
                                requestId,
                                BluetoothGatt.GATT_SUCCESS,
                                offset,
                                value
                        );
                    } catch (SecurityException ignored) {
                    }
                }
            }
        };

        gattServer = manager.openGattServer(getReactApplicationContext(), serverCallback);
        if (gattServer == null) return;

        BluetoothGattService service = new BluetoothGattService(
                MESH_GATT_SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
        );
        BluetoothGattCharacteristic rxChar = new BluetoothGattCharacteristic(
                MESH_GATT_RX_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE
                        | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
        );
        service.addCharacteristic(rxChar);
        gattServer.addService(service);
    }

    private void sendFramesToDevice(BluetoothDevice device, List<byte[]> frames) {
        if (!hasConnectPermission()) return;
        CountDownLatch doneLatch = new CountDownLatch(1);
        final int[] nextFrameIndex = {0};

        BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
            private BluetoothGattCharacteristic rxChar;

            @Override
            public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    closeQuietly(gatt);
                    doneLatch.countDown();
                    return;
                }
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    try {
                        gatt.discoverServices();
                    } catch (SecurityException e) {
                        closeQuietly(gatt);
                        doneLatch.countDown();
                    }
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    closeQuietly(gatt);
                    doneLatch.countDown();
                }
            }

            @Override
            public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    closeQuietly(gatt);
                    doneLatch.countDown();
                    return;
                }
                BluetoothGattService svc = gatt.getService(MESH_GATT_SERVICE_UUID);
                rxChar = svc != null ? svc.getCharacteristic(MESH_GATT_RX_CHAR_UUID) : null;
                if (rxChar == null) {
                    closeQuietly(gatt);
                    doneLatch.countDown();
                    return;
                }
                writeNextChunk(gatt);
            }

            @Override
            public void onCharacteristicWrite(
                    BluetoothGatt gatt,
                    BluetoothGattCharacteristic characteristic,
                    int status
            ) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    closeQuietly(gatt);
                    doneLatch.countDown();
                    return;
                }
                writeNextChunk(gatt);
            }

            @SuppressWarnings("deprecation")
            private void writeNextChunk(BluetoothGatt gatt) {
                if (nextFrameIndex[0] >= frames.size()) {
                    closeQuietly(gatt);
                    doneLatch.countDown();
                    return;
                }
                byte[] chunk = frames.get(nextFrameIndex[0]++);
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        int res = gatt.writeCharacteristic(
                                rxChar,
                                chunk,
                                BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                        );
                        if (res != android.bluetooth.BluetoothStatusCodes.SUCCESS) {
                            closeQuietly(gatt);
                            doneLatch.countDown();
                        }
                    } else {
                        rxChar.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                        rxChar.setValue(chunk);
                        if (!gatt.writeCharacteristic(rxChar)) {
                            closeQuietly(gatt);
                            doneLatch.countDown();
                        }
                    }
                } catch (SecurityException e) {
                    closeQuietly(gatt);
                    doneLatch.countDown();
                }
            }
        };

        BluetoothGatt gatt = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                gatt = device.connectGatt(
                        getReactApplicationContext(),
                        false,
                        gattCallback,
                        BluetoothDevice.TRANSPORT_LE
                );
            } else {
                gatt = device.connectGatt(getReactApplicationContext(), false, gattCallback);
            }
            doneLatch.await(8, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        } finally {
            closeQuietly(gatt);
        }
    }

    private void closeQuietly(BluetoothGatt gatt) {
        if (gatt == null) return;
        try {
            if (hasConnectPermission()) {
                gatt.disconnect();
                gatt.close();
            }
        } catch (Exception ignored) {
        }
    }

    private boolean hasScanPermission() {
        Context ctx = getReactApplicationContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN)
                    == PackageManager.PERMISSION_GRANTED
                    && ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasConnectPermission() {
        Context ctx = getReactApplicationContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void startBleScan(BluetoothAdapter adapter) throws SecurityException {
        bleScanner = adapter.getBluetoothLeScanner();
        if (bleScanner == null) return;

        if (activeScanCallback != null) {
            bleScanner.stopScan(activeScanCallback);
        }

        activeScanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                if (result == null || result.getDevice() == null) return;
                BluetoothDevice device = result.getDevice();
                String address = device.getAddress() != null ? device.getAddress() : "BLE-PEER";
                discoveredDevices.put(address, device);

                String advertisedNodeId = null;
                if (result.getScanRecord() != null) {
                    byte[] svcData = result.getScanRecord().getServiceData(DISCOVERY_SERVICE_UUID);
                    if (svcData != null && svcData.length > 0) {
                        advertisedNodeId = new String(svcData, StandardCharsets.UTF_8).trim();
                    }
                }

                WritableMap peer = Arguments.createMap();
                peer.putString(
                        "peerId",
                        advertisedNodeId != null && !advertisedNodeId.isEmpty()
                                ? advertisedNodeId
                                : address
                );
                peer.putString(
                        "displayName",
                        advertisedNodeId != null && !advertisedNodeId.isEmpty()
                                ? "Nodo BLE " + advertisedNodeId
                                : "Dispositivo Voz Guía BLE"
                );
                peer.putInt("rssi", result.getRssi());
                peer.putBoolean("hasInternet", false);
                peer.putDouble("lastSeenAt", System.currentTimeMillis());
                peer.putInt("hopDistance", 1);
                peer.putString("transport", "ble-gatt");
                emitEvent("onMeshPeerDiscovered", peer);
            }
        };

        ScanFilter filter = new ScanFilter.Builder().setServiceUuid(DISCOVERY_SERVICE_UUID).build();
        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();
        bleScanner.startScan(Collections.singletonList(filter), settings, activeScanCallback);
    }

    private void startBleAdvertise(BluetoothAdapter adapter, String nodeId) throws SecurityException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && ContextCompat.checkSelfPermission(
                        getReactApplicationContext(), Manifest.permission.BLUETOOTH_ADVERTISE)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        bleAdvertiser = adapter.getBluetoothLeAdvertiser();
        if (bleAdvertiser == null) return;

        if (activeAdvertiseCallback != null) {
            bleAdvertiser.stopAdvertising(activeAdvertiseCallback);
        }

        activeAdvertiseCallback = new AdvertiseCallback() {};
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setConnectable(true)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .build();

        byte[] beacon = nodeId.getBytes(StandardCharsets.UTF_8);
        AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addServiceUuid(DISCOVERY_SERVICE_UUID)
                .addServiceData(DISCOVERY_SERVICE_UUID, beacon)
                .build();

        bleAdvertiser.startAdvertising(settings, data, activeAdvertiseCallback);
    }

    private void stopBleOperations() {
        try {
            if (bleScanner != null && activeScanCallback != null && hasScanPermission()) {
                bleScanner.stopScan(activeScanCallback);
            }
            if (bleAdvertiser != null && activeAdvertiseCallback != null) {
                bleAdvertiser.stopAdvertising(activeAdvertiseCallback);
            }
            if (gattServer != null && hasConnectPermission()) {
                gattServer.close();
                gattServer = null;
            }
            discoveredDevices.clear();
            reassemblyBuffers.clear();
        } catch (SecurityException ignored) {
            // Ignore when permission revoked
        }
    }

    private void emitEvent(String eventName, Object data) {
        if (getReactApplicationContext().hasActiveReactInstance()) {
            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, data);
        }
    }
}
