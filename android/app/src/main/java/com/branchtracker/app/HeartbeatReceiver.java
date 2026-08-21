package com.branchtracker.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class HeartbeatReceiver extends BroadcastReceiver {
    private static final String TAG = "BranchTracker:Heartbeat";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"com.branchtracker.app.HEARTBEAT".equals(intent.getAction())) {
            return;
        }

        Log.d(TAG, "Heartbeat pulse received ❤️");

        // تحقق مما إذا كانت خدمة التتبع تعمل
        if (!ServiceStateHolder.isGeolocationServiceRunning) {
            Log.w(TAG, "Service is dead! Reviving GeolocationServiceWrapper...");
            Intent serviceIntent = new Intent(context, GeolocationServiceWrapper.class);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to revive service from heartbeat", e);
            }
        } else {
            Log.d(TAG, "Service is alive. Pulse OK.");
        }
    }
}
