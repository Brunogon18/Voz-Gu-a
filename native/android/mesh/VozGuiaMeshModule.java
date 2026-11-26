package com.deepcode.vozguia.mesh;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
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

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Native Java module for Voz Guía BLE Mesh & Controlled Flooding.
 * Operates strictly in foreground in compliance with Android BLE power policies.
 */
public class VozGuiaMeshModule extends ReactContextBaseJavaModule {
    public static final String MODULE_NAME = "VozGuiaMesh";
    private static final ParcelUuid SERVICE_UUID =
            ParcelUuid.fromString("0000FEAA-0000-1000-8000-00805F9B34FB");
    private static final int SEEN_CACHE_LIMIT = 256;

    private final Map<String, Boolean> seenPacketIds = Collections.synchronizedMap(
            new LinkedHashMap<String, Boolean>(SEEN_CACHE_LIMIT, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
                    return size() > SEEN_CACHE_LIMIT;
                }
            }
    );

    private BluetoothLeScanner bleScanner;
    private BluetoothLeAdvertiser bleAdvertiser;
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
                    "El escaneo y salto BLE operan únicamente mientras Voz Guía permanece en primer plano."
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
            if (packetJson == null || packetJson.isEmpty()) {
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
            promise.resolve(this.isRunning);
        } catch (Exception e) {
            promise.reject("BROADCAST_ERROR", e.getMessage(), e);
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
                WritableMap peer = Arguments.createMap();
                String address = result.getDevice().getAddress();
                peer.putString("peerId", address != null ? address : "BLE-PEER");
                peer.putString("displayName", "Dispositivo Voz Guía cercano");
                peer.putInt("rssi", result.getRssi());
                peer.putBoolean("hasInternet", false);
                peer.putDouble("lastSeenAt", System.currentTimeMillis());
                peer.putInt("hopDistance", 1);
                emitEvent("onMeshPeerDiscovered", peer);
            }
        };

        ScanFilter filter = new ScanFilter.Builder().setServiceUuid(SERVICE_UUID).build();
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
                .addServiceUuid(SERVICE_UUID)
                .addServiceData(SERVICE_UUID, beacon)
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
