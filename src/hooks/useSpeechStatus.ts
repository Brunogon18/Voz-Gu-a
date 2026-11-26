import { useSyncExternalStore } from 'react';
import { getSpeechState, SpeechState, subscribeSpeechState } from '../services/voiceService';

export function useSpeechStatus(): SpeechState {
  return useSyncExternalStore(subscribeSpeechState, getSpeechState, getSpeechState);
}
