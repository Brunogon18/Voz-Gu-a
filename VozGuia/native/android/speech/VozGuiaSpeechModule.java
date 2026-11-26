package com.deepcode.vozguia.speech;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.ArrayList;

/**
 * Native Java Speech-to-Text module using Android's SpeechRecognizer.
 */
public class VozGuiaSpeechModule extends ReactContextBaseJavaModule {
    public static final String MODULE_NAME = "VozGuiaSpeech";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer speechRecognizer;
    private Promise activePromise;

    public VozGuiaSpeechModule(ReactApplicationContext reactContext) {
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
    public void isRecognitionAvailable(Promise promise) {
        mainHandler.post(() ->
                promise.resolve(SpeechRecognizer.isRecognitionAvailable(getReactApplicationContext())));
    }

    @ReactMethod
    public void startListening(String locale, Promise promise) {
        mainHandler.post(() -> {
            try {
                if (activePromise != null) {
                    activePromise.reject("CANCELLED", "Reconocimiento reiniciado");
                    activePromise = null;
                }
                if (speechRecognizer != null) {
                    speechRecognizer.destroy();
                }

                activePromise = promise;
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getReactApplicationContext());
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {}
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onPartialResults(Bundle partialResults) {}
                    @Override public void onEvent(int eventType, Bundle params) {}

                    @Override
                    public void onError(int error) {
                        if (activePromise != null) {
                            activePromise.resolve("");
                            activePromise = null;
                        }
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches =
                                results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        if (activePromise != null) {
                            activePromise.resolve(text);
                            activePromise = null;
                        }
                    }
                });

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(
                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                );
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale != null ? locale : "es-MX");
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                speechRecognizer.startListening(intent);
            } catch (Exception e) {
                if (activePromise != null) {
                    activePromise.reject("SPEECH_ERROR", e.getMessage(), e);
                    activePromise = null;
                }
            }
        });
    }

    @ReactMethod
    public void stopListening(Promise promise) {
        mainHandler.post(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.stopListening();
            }
            promise.resolve(true);
        });
    }
}
