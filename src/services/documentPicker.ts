import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { DocumentImageInput } from '../types/vozGuia';
import { extractBase64FromPickerAsset } from './geminiService';

export type DocumentPickMode = 'camera' | 'library';

export interface DocumentPickResult {
  status: 'picked' | 'cancelled' | 'denied' | 'error';
  image?: DocumentImageInput;
  message?: string;
}

export async function pickDocumentImage(mode: DocumentPickMode): Promise<DocumentPickResult> {
  try {
    if (mode === 'camera') {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          return {
            status: 'denied',
            message: 'Activa el permiso de cámara para tomar foto a tus documentos.',
          };
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.65,
      });
      if (result.canceled || !result.assets?.[0]) {
        return { status: 'cancelled' };
      }
      const asset = result.assets[0];
      const extracted = extractBase64FromPickerAsset(asset);
      if (!extracted) {
        return {
          status: 'error',
          message: 'No se pudo leer la fotografía. Intenta seleccionarla desde la galería.',
        };
      }
      return {
        status: 'picked',
        image: {
          base64: extracted.base64,
          mimeType: extracted.mimeType,
          uri: asset.uri,
        },
      };
    }

    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return {
          status: 'denied',
          message: 'Activa el permiso de galería para elegir una foto de tu documento.',
        };
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.65,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { status: 'cancelled' };
    }

    const asset = result.assets[0];
    const extracted = extractBase64FromPickerAsset(asset);
    if (!extracted) {
      return {
        status: 'error',
        message: 'No se pudo procesar la imagen seleccionada.',
      };
    }

    return {
      status: 'picked',
      image: {
        base64: extracted.base64,
        mimeType: extracted.mimeType,
        uri: asset.uri,
      },
    };
  } catch {
    return {
      status: 'error',
      message: 'No se pudo abrir la cámara o galería en este dispositivo.',
    };
  }
}
