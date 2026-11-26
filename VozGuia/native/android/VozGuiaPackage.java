package com.deepcode.vozguia;

import androidx.annotation.NonNull;

import com.deepcode.vozguia.mesh.VozGuiaMeshModule;
import com.deepcode.vozguia.speech.VozGuiaSpeechModule;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class VozGuiaPackage implements ReactPackage {
    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        return Arrays.asList(
                new VozGuiaMeshModule(reactContext),
                new VozGuiaSpeechModule(reactContext)
        );
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
