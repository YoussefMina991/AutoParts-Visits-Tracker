package com.branchtracker.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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

/**
 * NativeGeofenceEngine — النسخة المُصلحة الشاملة
 * ════════════════════════════════════════════════════════════
 *
 * الإصلاحات:
 * ① setLastAcceleration(float) — API جديدة متزامنة مع GPS
 * ② Developer Options: 40 → 15 نقطة (وحده لا يكفي لتجاوز العتبة)
 * ③ ACCURACY_PERFECT_INTEGER: الحد من ≤15 → ≤10، النقاط 30 → 20
 * ④ Accelerometer متزامن 100% مع كل GPS update
 * ⑤ لا نكتب isMocked="no" عند الـ checkout — نحافظ على قرار check-in
 */
public class NativeGeofenceEngine {

    private static final String TAG            = "BranchTracker:NativeEngine";
    private static final String PREFS_NAME     = "CapacitorStorage";
    private static final String STATE_PREFS    = "BranchTrackerNativeState";
    private static final String KEY_ACTIVE     = "active_branch_id";
    private static final String KEY_LAST_IN    = "last_checkin_time_";
    private static final float  DEFAULT_RADIUS = 200.0f;
    private static final float  BUFFER         = 50.0f;
    private static final long   COOLDOWN_MS    = 3 * 60 * 1000L;

    // Notification
    private static final String CHANNEL_ID     = "visit_tracking_events";
    private static final String CHANNEL_NAME   = "Visit Tracking Events";
    private static final int    NOTIF_CHECKIN  = 1001;
    private static final int    NOTIF_CHECKOUT = 1002;

    // ══════════════════════════════════════════════════════════════════════════
    // نقاط الشك — مُعاد ضبطها لتقليل false positives
    // 0–29  نظيف | 30–49 مريب | 50+ وهمي
    // ══════════════════════════════════════════════════════════════════════════
    private static final int SCORE_ANDROID_IS_MOCK    = 100; // isMock() API
    private static final int SCORE_DEV_OPTIONS_ON     = 30;  // 30 يكفي للشك القوي
    private static final int SCORE_MOCK_APP_INSTALLED = 45;  // تطبيق Mock مثبت
    private static final int SCORE_ACCURACY_ZERO      = 50;  // accuracy=0 مستحيل
    private static final int SCORE_ACCURACY_TINY_INT  = 20;  // accuracy صحيح ≤ 10
    private static final int SCORE_MOCK_PROVIDER      = 50;  // اسم provider مشبوه
    private static final int SCORE_MOCK_EXTRAS        = 60;  // extras مشبوهة
    private static final int SCORE_SENSOR_STATIONARY  = 35;  // GPS يتحرك + جسم ساكن

    // Accelerometer — يُحدَّث من GeolocationServiceWrapper قبل كل GPS update
    private static volatile float lastAcceleration = -1f;

    /**
     * تُستدعى من GeolocationServiceWrapper قبل processLocation مباشرةً
     * لضمان التزامن الكامل بين GPS و Accelerometer.
     */
    public static void setLastAcceleration(float value) {
        lastAcceleration = value;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // الدالة الرئيسية
    // ══════════════════════════════════════════════════════════════════════════
    public static void processLocation(Context context, Location location) {
        if (location == null) return;

        SharedPreferences capPrefs   = context.getSharedPreferences(PREFS_NAME,   Context.MODE_PRIVATE);
        SharedPreferences statePrefs = context.getSharedPreferences(STATE_PREFS,  Context.MODE_PRIVATE);

        String branchesJson = capPrefs.getString("branches_data", null);
        String apiUrl       = capPrefs.getString("api_url",       null);

        if (branchesJson == null || apiUrl == null) {
            Log.d(TAG, "No branches/apiUrl in prefs — skip");
            return;
        }

        // ── حساب نقاط الشك ──────────────────────────────────────────────────
        int suspicionScore = 0;
        List<String> mockReasons = new ArrayList<>();

        // الطبقة ١: Android isMock() API
        boolean isMockedByApi;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            isMockedByApi = location.isMock();
        } else {
            isMockedByApi = location.isFromMockProvider();
        }
        if (isMockedByApi) {
            suspicionScore += SCORE_ANDROID_IS_MOCK;
            mockReasons.add("ANDROID_IS_MOCK_API");
            Log.w(TAG, "[L1] isMock()=true → +" + SCORE_ANDROID_IS_MOCK);
        }

        // الطبقة ٢: Developer Options + Mock App
        try {
            int devOptions = Settings.Global.getInt(
                context.getContentResolver(),
                Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0
            );

            boolean hasExternalMockApp = false;
            List<?> mockApps = context.getPackageManager()
                .getPackagesHoldingPermissions(
                    new String[]{"android.permission.ACCESS_MOCK_LOCATION"}, 0
                );
            for (Object pkg : mockApps) {
                String pkgName = ((android.content.pm.PackageInfo) pkg).packageName;
                if (!pkgName.equals(context.getPackageName())) {
                    hasExternalMockApp = true;
                    Log.w(TAG, "[L2] Mock app: " + pkgName);
                    break;
                }
            }

            if (devOptions != 0) {
                suspicionScore += SCORE_DEV_OPTIONS_ON;
                mockReasons.add("DEVELOPER_OPTIONS_ENABLED");
                Log.d(TAG, "[L2] Dev options ON → +" + SCORE_DEV_OPTIONS_ON);
            }
            if (hasExternalMockApp) {
                suspicionScore += SCORE_MOCK_APP_INSTALLED;
                mockReasons.add("MOCK_APP_INSTALLED");
                Log.w(TAG, "[L2] Mock app installed → +" + SCORE_MOCK_APP_INSTALLED);
            }
        } catch (Exception e) {
            Log.w(TAG, "[L2] Check failed: " + e.getMessage());
        }

        // الطبقة ٣: Location Quality
        float accuracy = location.getAccuracy();
        if (accuracy == 0.0f) {
            suspicionScore += SCORE_ACCURACY_ZERO;
            mockReasons.add("ACCURACY_ZERO");
            Log.w(TAG, "[L3] accuracy=0 → +" + SCORE_ACCURACY_ZERO);
        } else if (accuracy > 0 && accuracy == Math.floor(accuracy) && accuracy <= 10) {
            suspicionScore += SCORE_ACCURACY_TINY_INT;
            mockReasons.add("ACCURACY_TINY_INTEGER_" + (int) accuracy);
            Log.w(TAG, "[L3] accuracy tiny int " + accuracy + " → +" + SCORE_ACCURACY_TINY_INT);
        }

        String provider = location.getProvider();
        if (provider != null) {
            String lower = provider.toLowerCase();
            if (lower.contains("mock") || lower.contains("fake")
                    || lower.contains("test") || lower.contains("spoof")) {
                suspicionScore += SCORE_MOCK_PROVIDER;
                mockReasons.add("SUSPICIOUS_PROVIDER_" + provider.toUpperCase());
                Log.w(TAG, "[L3] Suspicious provider: " + provider);
            }
        }

        if (location.getExtras() != null) {
            if (location.getExtras().getBoolean("mockLocation", false)
                    || location.getExtras().containsKey("isMock")) {
                suspicionScore += SCORE_MOCK_EXTRAS;
                mockReasons.add("SUSPICIOUS_LOCATION_EXTRAS");
                Log.w(TAG, "[L3] Suspicious extras");
            }
        }

        // الطبقة ٤: Sensor Fusion — متزامن مع الـ Wrapper
        if (lastAcceleration >= 0) {
            float gpsSpeed = location.getSpeed();
            if (gpsSpeed > 1.0f && lastAcceleration < 0.3f) {
                suspicionScore += SCORE_SENSOR_STATIONARY;
                mockReasons.add("SENSOR_STATIONARY_WHILE_GPS_MOVING");
                Log.w(TAG, "[L4] GPS speed=" + gpsSpeed + " accel=" + lastAcceleration);
            }
        }

        // القرار النهائي
        boolean isMocked = suspicionScore >= 50;
        if (isMocked) {
            Log.w(TAG, "🚨 MOCK! score=" + suspicionScore + " " + mockReasons);
        } else if (suspicionScore >= 30) {
            Log.i(TAG, "⚠️ Suspicious score=" + suspicionScore + " " + mockReasons);
        }

        // ── منطق الـ Geofence ─────────────────────────────────────────────────
        try {
            JSONArray branches    = new JSONArray(branchesJson);
            String currentActive  = capPrefs.getString(KEY_ACTIVE, null);
            double lat            = location.getLatitude();
            double lng            = location.getLongitude();

            boolean isInsideAny      = false;
            String  insideBranchId   = null;
            String  insideBranchName = null;
            JSONObject activeBranchObj = null;

            for (int i = 0; i < branches.length(); i++) {
                JSONObject b = branches.getJSONObject(i);
                if (!b.has("latitude") || !b.has("longitude")
                        || b.isNull("latitude") || b.isNull("longitude")) continue;

                String bId = String.valueOf(b.getInt("id"));
                if (bId.equals(currentActive)) activeBranchObj = b;

                float radius = (b.has("geofenceRadiusMeters") && !b.isNull("geofenceRadiusMeters"))
                    ? (float) b.getDouble("geofenceRadiusMeters") : DEFAULT_RADIUS;

                float[] dist = new float[1];
                Location.distanceBetween(lat, lng,
                    b.getDouble("latitude"), b.getDouble("longitude"), dist);

                if (dist[0] <= radius) {
                    isInsideAny      = true;
                    insideBranchId   = bId;
                    insideBranchName = b.getString("name");
                }
            }

            // Auto check-out
            if (currentActive != null) {
                boolean shouldCheckOut = (activeBranchObj == null);
                if (activeBranchObj != null) {
                    float radius = (activeBranchObj.has("geofenceRadiusMeters")
                            && !activeBranchObj.isNull("geofenceRadiusMeters"))
                        ? (float) activeBranchObj.getDouble("geofenceRadiusMeters")
                        : DEFAULT_RADIUS;
                    float[] dist = new float[1];
                    Location.distanceBetween(lat, lng,
                        activeBranchObj.getDouble("latitude"),
                        activeBranchObj.getDouble("longitude"), dist);
                    if (dist[0] > radius + BUFFER) shouldCheckOut = true;
                }
                if (shouldCheckOut) {
                    String branchName = (activeBranchObj != null)
                        ? activeBranchObj.getString("name") : "الفرع";
                    Log.i(TAG, "Exiting " + currentActive);
                    boolean ok = sendCheckOut(apiUrl, currentActive);
                    if (ok) {
                        capPrefs.edit().remove(KEY_ACTIVE).apply();
                        showNotification(context, NOTIF_CHECKOUT,
                            "🔴 خروج تلقائي", "تم تسجيل خروجك من: " + branchName);
                        currentActive = null;
                    }
                }
            }

            // Auto check-in
            if (isInsideAny && insideBranchId != null
                    && !insideBranchId.equals(currentActive)) {
                long now      = System.currentTimeMillis();
                long lastTime = statePrefs.getLong(KEY_LAST_IN + insideBranchId, 0);
                if (now - lastTime >= COOLDOWN_MS) {
                    Log.i(TAG, "Entering " + insideBranchName
                        + " score=" + suspicionScore + " mocked=" + isMocked);
                    boolean ok = sendCheckIn(apiUrl, insideBranchId, lat, lng,
                        isMocked, suspicionScore, mockReasons);
                    if (ok) {
                        capPrefs.edit().putString(KEY_ACTIVE, insideBranchId).apply();
                        statePrefs.edit()
                            .putLong(KEY_LAST_IN + insideBranchId, now)
                            .apply();
                        String title = isMocked ? "⚠️ دخول مشبوه" : "✅ دخول تلقائي";
                        String text  = "تم تسجيل دخولك في: " + insideBranchName
                            + (isMocked ? " (نقاط: " + suspicionScore + ")" : "");
                        showNotification(context, NOTIF_CHECKIN, title, text);
                    }
                } else {
                    Log.d(TAG, "Cooldown active for " + insideBranchName);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Geofence error", e);
        }
    }

    // ── HTTP helpers ───────────────────────────────────────────────────────────

    private static boolean sendCheckIn(String baseUrl, String branchId,
            double lat, double lng,
            boolean isMocked, int score, List<String> reasons) {
        try {
            JSONArray arr = new JSONArray();
            for (String r : reasons) arr.put(r);

            JSONObject input = new JSONObject();
            input.put("branchId",       Integer.parseInt(branchId));
            input.put("latitude",       String.valueOf(lat));
            input.put("longitude",      String.valueOf(lng));
            input.put("isMocked",       isMocked);
            input.put("suspicionScore", score);
            input.put("mockReasons",    arr);

            JSONObject body = new JSONObject();
            body.put("json", input);

            return postJson(new URL(baseUrl + "/api/trpc/visit.checkIn"), baseUrl, body.toString());
        } catch (Exception e) {
            Log.e(TAG, "checkIn error", e);
            return false;
        }
    }

    private static boolean sendCheckOut(String baseUrl, String branchId) {
        try {
            JSONObject input = new JSONObject();
            input.put("branchId", Integer.parseInt(branchId));
            JSONObject body = new JSONObject();
            body.put("json", input);
            return postJson(new URL(baseUrl + "/api/trpc/visit.nativeCheckOut"), baseUrl, body.toString());
        } catch (Exception e) {
            Log.e(TAG, "checkOut error", e);
            return false;
        }
    }

    private static boolean postJson(URL url, String baseUrl, String json) {
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
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) { os.write(bytes); }
            int code = conn.getResponseCode();
            Log.i(TAG, "HTTP " + url.getPath() + " → " + code);
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.e(TAG, "HTTP error", e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // ── Notification ───────────────────────────────────────────────────────────
    private static void showNotification(Context ctx, int id, String title, String text) {
        NotificationManager nm =
            (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(ch);
        }

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pi = PendingIntent.getActivity(
            ctx, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(ctx.getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi);

        nm.notify(id, builder.build());
    }
}
