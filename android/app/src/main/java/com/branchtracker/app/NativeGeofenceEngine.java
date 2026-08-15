package com.branchtracker.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.webkit.CookieManager;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class NativeGeofenceEngine {

    private static final String TAG = "BranchTracker:NativeEngine";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String STATE_PREFS = "BranchTrackerNativeState";
    private static final String KEY_ACTIVE_BRANCH = "active_branch_id";
    private static final String KEY_LAST_CHECKIN_TIME = "last_checkin_time_";
    private static final float DEFAULT_RADIUS_METERS = 200.0f;
    private static final float GEOFENCE_BUFFER_METERS = 50.0f;
    private static final long CHECKIN_COOLDOWN_MS = 3 * 60 * 1000;

    private static final String CHANNEL_ID = "visit_tracking_events";
    private static final String CHANNEL_NAME = "Visit Tracking Events";
    private static final int NOTIFICATION_ID_CHECKIN = 1001;
    private static final int NOTIFICATION_ID_CHECKOUT = 1002;

    // ══════════════════════════════════════════════════════════════════════════
    // نظام نقاط الشك — كل طبقة بتضيف نقاط لو اكتشفت حاجة مريبة
    // 0–24  → نظيف
    // 25–49 → مريب
    // 50–74 → مشبوه جداً
    // 75+   → وهمي على الأرجح
    // ══════════════════════════════════════════════════════════════════════════
    private static final int SCORE_ANDROID_IS_MOCK       = 100; // Android API بيقول وهمي صراحة
    private static final int SCORE_DEV_OPTIONS_ON        = 40;  // Developer Options مفعّلة
    private static final int SCORE_MOCK_APP_INSTALLED    = 35;  // فيه تطبيق Mock مثبت ومصرح له
    private static final int SCORE_ACCURACY_PERFECT_INT  = 30;  // accuracy رقم صحيح نضيف زي 1 أو 5
    private static final int SCORE_ACCURACY_ZERO         = 40;  // accuracy = 0 مستحيل في GPS حقيقي
    private static final int SCORE_MOCK_PROVIDER_NAME    = 50;  // اسم الـ provider فيه "mock" أو "fake"
    private static final int SCORE_MOCK_EXTRAS           = 60;  // extras مشبوهة في الـ location object
    private static final int SCORE_SENSOR_STATIONARY     = 35;  // GPS بيقول بيتحرك بس الجسم ساكن

    // ══════════════════════════════════════════════════════════════════════════
    // Accelerometer state — بنحدثه من GeolocationServiceWrapper
    // ══════════════════════════════════════════════════════════════════════════
    private static float lastAcceleration = -1f; // -1 = لسه مش اتقرأش

    /**
     * بيتحدث من GeolocationServiceWrapper كل ما جه location update.
     * بيقرأ الـ Accelerometer لحظياً عشان نقارنه بالحركة اللي الـ GPS بيدعيها.
     */
    public static void updateAccelerometerReading(Context context) {
        try {
            SensorManager sm = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
            if (sm == null) return;
            Sensor accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (accel == null) return;

            sm.registerListener(new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    float x = event.values[0];
                    float y = event.values[1];
                    float z = event.values[2];
                    // نطرح الجاذبية الأرضية (9.8) من z ونحسب مجموع المتجهات
                    float totalWithoutGravity = (float) Math.sqrt(x*x + y*y + (z - 9.8f)*(z - 9.8f));
                    lastAcceleration = totalWithoutGravity;
                    sm.unregisterListener(this);
                }
                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            }, accel, SensorManager.SENSOR_DELAY_NORMAL);
        } catch (Exception e) {
            Log.w(TAG, "Accelerometer read failed: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // الدالة الرئيسية — بتستقبل كل location update
    // ══════════════════════════════════════════════════════════════════════════
    public static void processLocation(Context context, Location location) {
        if (location == null) return;

        // اقرأ الـ Accelerometer قبل أي حاجة تانية
        updateAccelerometerReading(context);

        SharedPreferences capacitorPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences statePrefs = context.getSharedPreferences(STATE_PREFS, Context.MODE_PRIVATE);

        String branchesJson = capacitorPrefs.getString("branches_data", null);
        String apiUrl = capacitorPrefs.getString("api_url", null);

        if (branchesJson == null || apiUrl == null) {
            Log.d(TAG, "No branches or API URL in preferences. Skipping native geofence.");
            return;
        }

        // ── حساب نقاط الشك ─────────────────────────────────────────────────
        int suspicionScore = 0;
        List<String> mockReasons = new ArrayList<>();

        // ── الطبقة الأولى: Android Native isMock API ─────────────────────────
        boolean isMockedByApi = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            isMockedByApi = location.isMock();
        } else {
            isMockedByApi = location.isFromMockProvider();
        }
        if (isMockedByApi) {
            suspicionScore += SCORE_ANDROID_IS_MOCK;
            mockReasons.add("ANDROID_IS_MOCK_API");
            Log.w(TAG, "[Layer1] Android API: location.isMock() = true");
        }

        // ── الطبقة التانية: Developer Options Detection ──────────────────────
        try {
            // هل Developer Options شغالة؟
            int devOptions = Settings.Global.getInt(
                context.getContentResolver(),
                Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0
            );
            if (devOptions != 0) {
                suspicionScore += SCORE_DEV_OPTIONS_ON;
                mockReasons.add("DEVELOPER_OPTIONS_ENABLED");
                Log.w(TAG, "[Layer2] Developer Options are ENABLED");
            }

            // هل فيه تطبيق عنده صلاحية Mock Location؟
            List<?> mockApps = context.getPackageManager()
                .getPackagesHoldingPermissions(
                    new String[]{"android.permission.ACCESS_MOCK_LOCATION"}, 0
                );
            // نشيل حزمة التطبيق نفسه من القائمة (هو عنده الصلاحية دي بشكل طبيعي)
            boolean hasExternalMockApp = false;
            for (Object pkg : mockApps) {
                String pkgName = ((android.content.pm.PackageInfo) pkg).packageName;
                if (!pkgName.equals(context.getPackageName())) {
                    hasExternalMockApp = true;
                    Log.w(TAG, "[Layer2] Mock app installed: " + pkgName);
                    break;
                }
            }
            if (hasExternalMockApp) {
                suspicionScore += SCORE_MOCK_APP_INSTALLED;
                mockReasons.add("MOCK_APP_INSTALLED");
            }
        } catch (Exception e) {
            Log.w(TAG, "[Layer2] Dev options check failed: " + e.getMessage());
        }

        // ── الطبقة التالتة: Location Quality Forensics ───────────────────────
        float accuracy = location.getAccuracy();

        // accuracy = 0 مستحيل في GPS حقيقي
        if (accuracy == 0.0f) {
            suspicionScore += SCORE_ACCURACY_ZERO;
            mockReasons.add("ACCURACY_ZERO");
            Log.w(TAG, "[Layer3] accuracy = 0 (impossible in real GPS)");
        }
        // accuracy رقم صحيح نضيف (1, 2, 3, 5, 10) مريب جداً
        else if (accuracy > 0 && accuracy == Math.floor(accuracy) && accuracy <= 15) {
            suspicionScore += SCORE_ACCURACY_PERFECT_INT;
            mockReasons.add("ACCURACY_PERFECT_INTEGER_" + (int)accuracy);
            Log.w(TAG, "[Layer3] accuracy is suspiciously perfect integer: " + accuracy);
        }

        // اسم الـ provider مشبوه
        String provider = location.getProvider();
        if (provider != null) {
            String providerLower = provider.toLowerCase();
            if (providerLower.contains("mock") || providerLower.contains("fake")
                    || providerLower.contains("test") || providerLower.contains("spoof")) {
                suspicionScore += SCORE_MOCK_PROVIDER_NAME;
                mockReasons.add("SUSPICIOUS_PROVIDER_" + provider.toUpperCase());
                Log.w(TAG, "[Layer3] Suspicious provider name: " + provider);
            }
        }

        // extras مشبوهة
        if (location.getExtras() != null) {
            if (location.getExtras().getBoolean("mockLocation", false)
                    || location.getExtras().containsKey("mockLocation")
                    || location.getExtras().containsKey("isMock")) {
                suspicionScore += SCORE_MOCK_EXTRAS;
                mockReasons.add("SUSPICIOUS_LOCATION_EXTRAS");
                Log.w(TAG, "[Layer3] Suspicious extras in location bundle");
            }
        }

        // ── الطبقة الرابعة: Sensor Fusion (Accelerometer) ────────────────────
        // لو الـ GPS بيقول في حركة (speed > 0.5 m/s) بس الجسم ساكن تماماً
        if (lastAcceleration >= 0) {
            float gpsSpeed = location.getSpeed(); // m/s
            // GPS بيقول بيتحرك بسرعة فوق المشي
            if (gpsSpeed > 0.5f && lastAcceleration < 0.3f) {
                suspicionScore += SCORE_SENSOR_STATIONARY;
                mockReasons.add("SENSOR_STATIONARY_WHILE_GPS_MOVING");
                Log.w(TAG, "[Layer4] GPS speed=" + gpsSpeed + " m/s but accelerometer=" + lastAcceleration + " (stationary)");
            }
        }

        // ── تحديد الـ isMocked النهائي ────────────────────────────────────────
        // أي score >= 50 → وهمي (تقاطع طبقتين على الأقل أو طبقة واحدة قوية جداً)
        boolean isMocked = suspicionScore >= 50;

        if (isMocked) {
            Log.w(TAG, "🚨 MOCK DETECTED! Score=" + suspicionScore + " Reasons=" + mockReasons);
        } else if (suspicionScore > 0) {
            Log.i(TAG, "⚠️ Suspicious location. Score=" + suspicionScore + " Reasons=" + mockReasons);
        }

        // ── باقي منطق الـ Geofence (زي الأصل) ─────────────────────────────
        try {
            JSONArray branches = new JSONArray(branchesJson);
            String currentActiveBranchId = statePrefs.getString(KEY_ACTIVE_BRANCH, null);
            boolean isInsideAny = false;
            String insideBranchId = null;
            String insideBranchName = null;

            double currentLat = location.getLatitude();
            double currentLng = location.getLongitude();

            JSONObject activeBranchObj = null;
            for (int i = 0; i < branches.length(); i++) {
                JSONObject branch = branches.getJSONObject(i);
                if (!branch.has("latitude") || !branch.has("longitude")
                        || branch.isNull("latitude") || branch.isNull("longitude")) continue;

                String bId = String.valueOf(branch.getInt("id"));
                if (bId.equals(currentActiveBranchId)) {
                    activeBranchObj = branch;
                }

                double bLat = branch.getDouble("latitude");
                double bLng = branch.getDouble("longitude");
                float radius = branch.has("geofenceRadiusMeters") && !branch.isNull("geofenceRadiusMeters")
                        ? (float) branch.getDouble("geofenceRadiusMeters")
                        : DEFAULT_RADIUS_METERS;

                float[] results = new float[1];
                Location.distanceBetween(currentLat, currentLng, bLat, bLng, results);

                if (results[0] <= radius) {
                    isInsideAny = true;
                    insideBranchId = bId;
                    insideBranchName = branch.getString("name");
                }
            }

            // Auto check-out
            if (currentActiveBranchId != null) {
                boolean shouldCheckOut = false;
                if (activeBranchObj != null) {
                    float radius = activeBranchObj.has("geofenceRadiusMeters") && !activeBranchObj.isNull("geofenceRadiusMeters")
                            ? (float) activeBranchObj.getDouble("geofenceRadiusMeters")
                            : DEFAULT_RADIUS_METERS;
                    float[] results = new float[1];
                    Location.distanceBetween(currentLat, currentLng,
                            activeBranchObj.getDouble("latitude"),
                            activeBranchObj.getDouble("longitude"), results);
                    if (results[0] > radius + GEOFENCE_BUFFER_METERS) shouldCheckOut = true;
                } else {
                    shouldCheckOut = true;
                }

                if (shouldCheckOut) {
                    Log.i(TAG, "Exited branch " + currentActiveBranchId + " — executing Native Check-Out...");
                    String branchName = activeBranchObj != null ? activeBranchObj.getString("name") : "الفرع";
                    boolean success = sendNativeCheckOut(apiUrl, currentActiveBranchId);
                    if (success) {
                        statePrefs.edit().remove(KEY_ACTIVE_BRANCH).apply();
                        showNotification(context, NOTIFICATION_ID_CHECKOUT, "🔴 خروج تلقائي", "تم تسجيل خروجك من: " + branchName);
                        currentActiveBranchId = null;
                    }
                }
            }

            // Auto check-in — بنبعت suspicionScore و mockReasons مع الـ check-in
            if (isInsideAny && insideBranchId != null && !insideBranchId.equals(currentActiveBranchId)) {
                long now = System.currentTimeMillis();
                long lastCheckIn = statePrefs.getLong(KEY_LAST_CHECKIN_TIME + insideBranchId, 0);

                if (now - lastCheckIn >= CHECKIN_COOLDOWN_MS) {
                    Log.i(TAG, "Entered branch " + insideBranchName + " (" + insideBranchId + "), Score=" + suspicionScore);
                    boolean success = sendNativeCheckIn(
                        apiUrl, insideBranchId, currentLat, currentLng,
                        isMocked, suspicionScore, mockReasons
                    );
                    if (success) {
                        statePrefs.edit()
                            .putString(KEY_ACTIVE_BRANCH, insideBranchId)
                            .putLong(KEY_LAST_CHECKIN_TIME + insideBranchId, now)
                            .apply();

                        String notifTitle = isMocked ? "⚠️ دخول مشبوه" : "✅ دخول تلقائي";
                        String notifText = "تم تسجيل دخولك في: " + insideBranchName
                            + (isMocked ? " (موقع مشبوه — نقاط: " + suspicionScore + ")" : "");
                        showNotification(context, NOTIFICATION_ID_CHECKIN, notifTitle, notifText);
                    }
                } else {
                    Log.d(TAG, "Check-in suppressed by cooldown for branch: " + insideBranchName);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Error processing native geofence", e);
        }
    }

    // ── tRPC HTTP helpers ──────────────────────────────────────────────────────

    private static boolean sendNativeCheckIn(
            String baseUrl, String branchId,
            double lat, double lng,
            boolean isMocked, int suspicionScore, List<String> mockReasons) {
        try {
            JSONArray reasonsArray = new JSONArray();
            for (String r : mockReasons) reasonsArray.put(r);

            JSONObject input = new JSONObject();
            input.put("branchId", Integer.parseInt(branchId));
            input.put("latitude", String.valueOf(lat));
            input.put("longitude", String.valueOf(lng));
            input.put("isMocked", isMocked);
            input.put("suspicionScore", suspicionScore);
            input.put("mockReasons", reasonsArray);

            JSONObject body = new JSONObject();
            body.put("json", input);

            URL url = new URL(baseUrl + "/api/trpc/visit.checkIn");
            return sendPostRequest(url, baseUrl, body.toString());
        } catch (Exception e) {
            Log.e(TAG, "CheckIn request error", e);
            return false;
        }
    }

    private static boolean sendNativeCheckOut(String baseUrl, String branchId) {
        try {
            JSONObject input = new JSONObject();
            input.put("branchId", Integer.parseInt(branchId));

            JSONObject body = new JSONObject();
            body.put("json", input);

            URL url = new URL(baseUrl + "/api/trpc/visit.nativeCheckOut");
            return sendPostRequest(url, baseUrl, body.toString());
        } catch (Exception e) {
            Log.e(TAG, "CheckOut request error", e);
            return false;
        }
    }

    private static boolean sendPostRequest(URL url, String baseUrl, String jsonBody) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(15_000);

            String cookies = CookieManager.getInstance().getCookie(baseUrl);
            if (cookies != null) conn.setRequestProperty("Cookie", cookies);

            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            Log.i(TAG, "Native HTTP " + url.getPath() + " → " + responseCode);
            return (responseCode >= 200 && responseCode < 300);
        } catch (Exception e) {
            Log.e(TAG, "Native HTTP error for " + url, e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void showNotification(Context context, int id, String title, String text) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
            );
            nm.createNotificationChannel(channel);
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, intent, PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        nm.notify(id, builder.build());
    }
}
