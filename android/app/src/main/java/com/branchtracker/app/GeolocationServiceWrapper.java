package com.branchtracker.app;

import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.Location;
import android.os.IBinder;
import android.util.Log;

import androidx.localbroadcastmanager.content.LocalBroadcastManager;

/**
 * GeolocationServiceWrapper
 * ════════════════════════════════════════════════════════════
 * Service خفيف بيشتغل جنب BackgroundGeolocationService
 * مهمته:
 * 1. تحديث ServiceStateHolder.isGeolocationServiceRunning للـ Watchdog.
 * 2. اعتراض بث الـ GPS وتمريره لمحرك الـ Native Geofence Engine.
 */
public class GeolocationServiceWrapper extends Service {

    private static final String TAG = "BranchTracker:Wrapper";
    private static final String ACTION_BROADCAST = "com.equimaps.capacitor_background_geolocation.broadcast";

    private final BroadcastReceiver locationReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null && intent.hasExtra("location")) {
                Location location = intent.getParcelableExtra("location");
                if (location != null) {
                    Log.d(TAG, "Native Wrapper received location: " + location.getLatitude() + ", " + location.getLongitude());
                    // 🚀 Pass to Native Geofence Engine
                    new Thread(() -> NativeGeofenceEngine.processLocation(context, location)).start();
                }
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        // الـ geolocation service اشتغل → ارفع الـ flag
        ServiceStateHolder.isGeolocationServiceRunning = true;
        Log.i(TAG, "Geolocation service started → flag = true");

        // Register receiver for native background geofencing
        LocalBroadcastManager.getInstance(this).registerReceiver(
                locationReceiver,
                new IntentFilter(ACTION_BROADCAST)
        );
        Log.i(TAG, "Registered LocalBroadcastManager receiver for native geofencing");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ServiceStateHolder.isGeolocationServiceRunning = true;
        Log.d(TAG, "onStartCommand → flag = true");
        // START_STICKY: لو الـ OS قفل الـ wrapper، يشغله تاني
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        // الـ geolocation service وقف → حط الـ flag false
        ServiceStateHolder.isGeolocationServiceRunning = false;
        Log.w(TAG, "Geolocation service stopped → flag = false");

        LocalBroadcastManager.getInstance(this).unregisterReceiver(locationReceiver);
        Log.i(TAG, "Unregistered LocalBroadcastManager receiver");

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // لا نحتاج binding
    }
}
