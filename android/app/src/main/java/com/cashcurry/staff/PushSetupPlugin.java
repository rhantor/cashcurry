package com.cashcurry.staff;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Tells the web pages whether this build has Firebase: google-services.json
// becomes the google_app_id resource. Without it PushNotifications.register()
// crashes the app, so lib/native asks first.
@CapacitorPlugin(name = "PushSetup")
public class PushSetupPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        Context c = getContext();
        JSObject ret = new JSObject();
        ret.put("ready", c.getResources().getIdentifier("google_app_id", "string", c.getPackageName()) != 0);
        call.resolve(ret);
    }
}
