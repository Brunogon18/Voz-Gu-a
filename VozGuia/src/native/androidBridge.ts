import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';

export interface NativeMeshModuleSpec {
  getCapabilities(): Promise<{
    hasBleHardware: boolean;
    hasNearbyConnections: boolean;
    androidSdkInt: number;
    foregroundOnlyNote: string;
  }>;
  startMeshService(nodeId: string, maxHops: number): Promise<boolean>;
  stopMeshService(): Promise<boolean>;
  broadcastPacket(packetJson: string): Promise<boolean>;
}

export interface NativeSpeechModuleSpec {
  isRecognitionAvailable(): Promise<boolean>;
  startListening(locale: string): Promise<string>;
  stopListening(): Promise<boolean>;
}

const nativeMesh = NativeModules.VozGuiaMesh as NativeMeshModuleSpec | undefined;
const nativeSpeech = NativeModules.VozGuiaSpeech as NativeSpeechModuleSpec | undefined;

export const meshEmitter = nativeMesh ? new NativeEventEmitter(NativeModules.VozGuiaMesh) : null;
export const speechEmitter = nativeSpeech
  ? new NativeEventEmitter(NativeModules.VozGuiaSpeech)
  : null;

export function hasNativeMeshModule(): boolean {
  return Platform.OS === 'android' && Boolean(nativeMesh);
}

export function hasNativeSpeechModule(): boolean {
  return Platform.OS === 'android' && Boolean(nativeSpeech);
}

export async function requestAndroidRuntimePermissions(): Promise<{
  audioGranted: boolean;
  nearbyGranted: boolean;
}> {
  if (Platform.OS !== 'android') {
    return { audioGranted: true, nearbyGranted: true };
  }

  const permissionsToRequest: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS][] =
    [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];

  if (Number(Platform.Version) >= 31) {
    permissionsToRequest.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
  } else {
    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }

  if (Number(Platform.Version) >= 33 && PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES) {
    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
  }

  const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
  const audioGranted =
    results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;

  const nearbyGranted =
    Number(Platform.Version) >= 31
      ? results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED
      : results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

  return { audioGranted, nearbyGranted };
}

export async function getNativeMeshCapabilities() {
  if (!nativeMesh) {
    return {
      hasBleHardware: false,
      hasNearbyConnections: false,
      androidSdkInt: typeof Platform.Version === 'number' ? Platform.Version : 0,
      foregroundOnlyNote: 'Modo simulador/Expo Go activo (módulo Java no vinculado)',
    };
  }
  return nativeMesh.getCapabilities();
}

export async function startNativeMesh(nodeId: string, maxHops: number): Promise<boolean> {
  if (!nativeMesh) return false;
  return nativeMesh.startMeshService(nodeId, maxHops);
}

export async function stopNativeMesh(): Promise<boolean> {
  if (!nativeMesh) return false;
  return nativeMesh.stopMeshService();
}

export async function broadcastNativePacket(packetJson: string): Promise<boolean> {
  if (!nativeMesh) return false;
  return nativeMesh.broadcastPacket(packetJson);
}

export async function recognizeSpeechOnce(locale = 'es-MX'): Promise<string | null> {
  if (!nativeSpeech) return null;
  const available = await nativeSpeech.isRecognitionAvailable();
  if (!available) return null;
  return nativeSpeech.startListening(locale);
}

export async function stopNativeSpeech(): Promise<void> {
  if (!nativeSpeech) return;
  await nativeSpeech.stopListening();
}
