package com.brewguide.online;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(BrewGuideGalleryPlugin.class);
        registerPlugin(BrewGuideDocumentPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
