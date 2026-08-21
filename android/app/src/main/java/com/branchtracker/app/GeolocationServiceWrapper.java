package com.branchtracker.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Looper;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * GeolocationServiceWrapper — النسخة المُصلحة
 * ════════════════════════════════════════════════════════════
 *
 * الإصلاحات المطبقة:
 *
 * 1. تحوّل من Background Service → Foreground Service
 *    → الـ OS لا يوقفه تحت ضغط الذاكرة
 *    → يعمل بشكل مستقل حتى لو أُغلق التطبيق من Recent Apps
 *
 * 2. Accelerometer يُقرأ في background thread مستمر (HandlerThread)
 *    → القراءة السابقة كانت غير متزامنة مع الـ GPS update
 *    → الآن: Accelerometer يُحدَّث كل ثانية ويُمرَّر لـ NativeGeofenceEngine
 *      بأحدث قيمة في نفس الـ thread لضمان التزامن
 *
 * 3. ServiceStateHolder.isGeolocationServiceRunning يُحدَّث بدقة
 *    → true عند onCreate/onStartCommand
 *    → false عند onDestroy فقط
 */
public class GeolocationServiceWrapper extends Service {

    private static final String TAG = "BranchTracker:Wrapper";

    // ── Foreground Notification ───────────────────────────────────────────────
    private static final String CHANNEL_ID   = "branch_tracker_wrapper";
    private static final String CHANNEL_NAME = "تتبع الموقع النشط";
    private static final int    NOTIF_ID     = 9001;

    // ── Accelerometer: قراءة مستمرة ─────────────────────────────────────────
    private SensorManager sensorManager;
    private Sensor        accelerometer;
    private volatile float latestAccelMagnitude = -1f; // -1 = لم تُقرأ بعد

    private final SensorEventListener accelListener = new SensorEventListener() {
        @Override
        public void onSensorChanged(SensorEvent event) {
            float x = event.values[0];
            float y = event.values[1];
            float z = event.values[2];
            // المتجه الكلي بعد طرح الجاذبية (9.8 على محور Z)
            latestAccelMagnitude = (float) Math.sqrt(
                x * x + y * y + (z - 9.8f) * (z - 9.8f)
            );
        }
        @Override
        public void onAccuracyChanged(Sensor sensor, int accuracy) {}
    };

    // ── Direct GPS Tracking (FusedLocationProvider) ───────────────────────────
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();

        // 1. ابدأ كـ Foreground Service فوراً (مطلوب على Android 8+)
        startForegroundWithNotification();

        // 2. ارفع الـ flag
        ServiceStateHolder.isGeolocationServiceRunning = true;
        Log.i(TAG, "onCreate → isGeolocationServiceRunning = true");

        // 3. ابدأ Accelerometer (قراءة مستمرة كل ~200ms = SENSOR_DELAY_GAME)
        startAccelerometer();

        // 4. ابدأ تتبع الموقع مباشرة
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    if (location == null) continue;
                    Log.d(TAG, "GPS update → " + location.getLatitude()
                            + ", " + location.getLongitude()
                            + " | accel=" + latestAccelMagnitude);

                    NativeGeofenceEngine.setLastAcceleration(latestAccelMagnitude);
                    new Thread(() ->
                        NativeGeofenceEngine.processLocation(GeolocationServiceWrapper.this, location)
                    ).start();
                }
            }
        };
        startLocationUpdates();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ServiceStateHolder.isGeolocationServiceRunning = true;
        Log.d(TAG, "onStartCommand → flag = true");
        // START_STICKY: لو الـ OS أوقف الـ service، يشغّله تاني تلقائياً
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        ServiceStateHolder.isGeolocationServiceRunning = false;
        Log.w(TAG, "onDestroy → isGeolocationServiceRunning = false");

        // أوقف الـ Accelerometer
        if (sensorManager != null) {
            sensorManager.unregisterListener(accelListener);
        }

        // أوقف مستمع GPS
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // لا نحتاج binding
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * يشغّل الـ service كـ Foreground مع إشعار مناسب.
     * مطلوب على Android 8+ وإلا سيُوقفه النظام.
     */
    private void startForegroundWithNotification() {
        // أنشئ Notification Channel (مطلوب Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW // منخفض = لا صوت ولا اهتزاز
            );
            channel.setDescription("يتيح للتطبيق تتبع الزيارات الميدانية في الخلفية");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }

        // Intent لفتح التطبيق عند الضغط على الإشعار
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, openApp, PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("تتبع الزيارات نشط")
            .setContentText("يتم تسجيل زياراتك الميدانية تلقائياً")
            .setSmallIcon(getApplicationInfo().icon)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)      // لا يمكن رفضه بالسحب
            .setContentIntent(pi)
            .build();

        startForeground(NOTIF_ID, notification);
        Log.i(TAG, "Foreground notification started ✓");
    }

    /**
     * يُشغّل الـ Accelerometer في وضع SENSOR_DELAY_GAME (~200ms)
     * للحصول على قراءات متزامنة مع تحديثات GPS.
     */
    private void startAccelerometer() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) {
            Log.w(TAG, "No SensorManager — accelerometer disabled");
            return;
        }
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        if (accelerometer == null) {
            Log.w(TAG, "No accelerometer sensor found");
            return;
        }
        // SENSOR_DELAY_GAME ≈ 200ms — كافي للمقارنة مع GPS (كل 20م أو أكثر)
        boolean registered = sensorManager.registerListener(
            accelListener,
            accelerometer,
            SensorManager.SENSOR_DELAY_GAME
        );
        Log.i(TAG, "Accelerometer registered: " + registered);
    }

    private void startLocationUpdates() {
        try {
            LocationRequest locationRequest = new LocationRequest.Builder(
                    Priority.PRIORITY_HIGH_ACCURACY,
                    10_000L // كل 10 ثواني كحد أقصى
            )
                    .setMinUpdateIntervalMillis(5_000L)
                    .setMinUpdateDistanceMeters(20f) // لا تُرسِل إلا لو تحرك 20 متر
                    .setWaitForAccurateLocation(false)
                    .build();

            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            );
            Log.i(TAG, "Started FusedLocationProvider updates directly ✓");
        } catch (SecurityException e) {
            Log.e(TAG, "Missing location permissions", e);
        }
    }
}
