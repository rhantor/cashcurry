package com.cashcurry.staff;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PushSetupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
