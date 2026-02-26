package com.tagnetiq.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import com.tagnetiq.plugins.metaglasses.MetaGlassesPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MetaGlassesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
