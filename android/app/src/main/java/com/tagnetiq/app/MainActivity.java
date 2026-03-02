package com.tagnetiq.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.util.Log;
import com.tagnetiq.plugins.metaglasses.MetaGlassesPlugin;
import com.meta.wearable.dat.core.Wearables;
import com.meta.wearable.dat.core.types.Permission;
import androidx.activity.result.ActivityResultLauncher;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "TagnetIQ";
    private ActivityResultLauncher<Permission> permissionLauncher;
    private PermissionResultCallback permissionCallback;

    public interface PermissionResultCallback {
        void onResult(Object rawDatResult);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        permissionLauncher = registerForActivityResult(
            new Wearables.RequestPermissionContract(),
            rawResult -> {
                Log.d(TAG, "Permission contract returned: " + rawResult);
                if (permissionCallback != null) {
                    permissionCallback.onResult(rawResult);
                    permissionCallback = null;
                }
            }
        );

        registerPlugin(MetaGlassesPlugin.class);
        super.onCreate(savedInstanceState);
    }

    public void requestWearablesCameraPermission(PermissionResultCallback callback) {
        this.permissionCallback = callback;
        Log.d(TAG, "Launching Meta AI permission request for CAMERA");
        permissionLauncher.launch(Permission.CAMERA);
    }
}