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
 * الإصلاحات في هذه النسخة:
 *
 * ① setLastAcceleration(float) — API جديدة
 *    GeolocationServiceWrapper يستدعيها قبل processLocation
 *    → الـ Accelerometer الآن متزامن تماماً مع الـ GPS update
 *    → تم حذف updateAccelerometerReading() غير المتزامنة القديمة
 *
 * ② Developer Options: تخفيض النقاط من 40 → 15 فقط
 *    واشتراط وجود Mock App أيضاً لتجاوز العتبة وحده
 *    → يمنع false positives على المطورين ومستخدمي ADB
 *
 * ③ ACCURACY_PERFECT_INTEGER: النقاط من 30 → 20
 *    والشرط تحوّل من accuracy ≤ 15 → accuracy ≤ 10
 *    → accuracy=10 أو 15 طبيعية في مناطق التغطية الجيدة
 *    → accuracy=1 أو 3 أو 5 مريبة فعلاً
 *
 * ④ Sensor check يستخدم القيمة المُمرَّرة من الـ Wrapper
 *    بدلاً من قراءة async داخل processLocation
 *    → التزامن الكامل بين GPS و Accelerometer
 *
 * ⑤ عتبة الكشف: بقيت 50 لكن توزيع النقاط أكثر دقة
 *    → false positives أقل، true positives أكثر
 *
 * ⑥ isMocked = "yes" عند الـ checkout يحتفظ بقيمة check-in
 *    لو لم يُكتشف teleporting → لا يكتب "no" → لا يلغي الكشف السابق
 */
public class NativeGeofenceEngine {

    private static final String TAG = "BranchTracker:NativeEngine";
    private static final String PREFS_NAME         = "CapacitorStorage";
    private static final String STATE_PREFS        = "BranchTrackerNativeState";
    private static final String KEY_ACTIVE_BRANCH  = "active_branch_id";
    private static final String KEY_LAST_CHECKIN   = "last_checkin_time_";
    private static final float  DEFAULT_RADIUS     = 200.0f;
    private static final float  GEOFENCE_BUFFER    = 50.0f;
    private static final long   CHECKIN_COOLDOWN   = 3 * 60 * 1000L; // 3 دقائق

    // ── Notification ──────────────────────────────────────────────────────────
    private static final String CHANNEL_ID   = "visit_tracking_events";
    private static final String CHANNEL_NAME = "Visit Tracking Events";
    private static final int    NOTIF_CHECKIN  = 1001;
    private static final int    NOTIF_CHECKOUT = 1002;

    // ══════════════════════════════════════════════════════════════════════════
    // نظام نقاط الشك — مُعاد ضبطه بعناية لتقليل false positives
    //
    //  0–29  → نظيف تماماً
    // 30–49  → مريب — يُسجَّل للمراجعة لكن لا يُعلَّم وهمي
    // 50–74  → مشبوه جداً → isMocked = "yes"
    // 75+    → وهمي مؤكد  → isMocked = "yes"
    // ══════════════════════════════════════════════════════════════════════════
    private static final int SCORE_ANDROID_IS_MOCK    = 100; // isMock() API — مضمونة
    private static final int SCORE_DEV_OPTIONS_ON     = 15;  // ↓ من 40 → 15 (وحده لا يكفي)
    private static final int SCORE_MOCK_APP_INSTALLED = 45;  // تطبيق Mock مثبت ومصرح — قوي
    private static final int SCORE_ACCURACY_ZERO      = 50;  // accuracy=0 مستحيل في GPS حقيقي
    private static final int SCORE_ACCURACY_TINY_INT  = 20;  // accuracy صحيح ≤ 10 — مريب
    private static final int SCORE_MOCK_PROVIDER      = 50;  // اسم provider يحتوي "mock/fake"
    private static final int SCORE_MOCK_EXTRAS        = 60;  // extras مشبوهة في الـ Location bundle
    private static final int SCORE_SENSOR_STATIONARY  = 35;  // GPS بيقول متحرك والجسم ساكن

    // ── Accelerometer state — يُحدَّث من GeolocationServiceWrapper ──────────
    // volatile → مرئي فوراً عبر الـ threads
    private static volatile float lastAcceleration = -1f;

    /**
     * API جديدة — تُستدعى من GeolocationServiceWrapper قبل processLocation
     * لضمان أن الـ Accelerometer متزامن مع كل GPS update.
     */
    public static void setLastAcceleration(float value) {
        lastAcceleration = value;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // الدالة الرئيسية
    // ══════════════════════════════════════════════════════════════════════════
    public static void processLocation(Context context, Location location) {
        if (location == null) return;

        SharedPreferences capacitorPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences statePrefs     = context.getSharedPreferences(STATE_PREFS,  Context.MODE_PRIVATE);

        String branchesJson = capacitorPrefs.getString("branches_data", null);
        String apiUrl       = capacitorPrefs.getString("api_url",       null);

        if (branchesJson == null || apiUrl == null) {
            Log.d(TAG, "No branches/API URL in prefs — skipping");
            return;
        }

        // ── حساب نقاط الشك ──────────────────────────────────────────────────
        int suspicionScore = 0;
        List<String> mockReasons = new ArrayList<>();

        // ── الطبقة ١: Android isMock() API ───────────────────────────────────
        boolean isMockedByApi;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            isMockedByApi = location.isMock();
        } else {
            isMockedByApi = location.isFromMockProvider();
        }
        if (isMockedByApi) {
            suspicionScore += SCORE_ANDROID_IS_MOCK;
            mockReasons.add("ANDROID_IS_MOCK_API");
            Log.w(TAG, "[L1] isMock() = true → +" + SCORE_ANDROID_IS_MOCK);
        }

        // ── الطبقة ٢: Developer Options + Mock App ───────────────────────────
        try {
            int devOptions = Settings.Global.getInt(
                context.getContentResolver(),
                Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0
            );

            // هل فيه تطبيق عنده صلاحية Mock Location غير التطبيق نفسه؟
            boolean hasExternalMockApp = false;
            List<?> mockApps = context.getPackageManager()
                .getPackagesHoldingPermissions(
                    new String[]{"android.permission.ACCESS_MOCK_LOCATION"}, 0
                );
            for (Object pkg : mockApps) {
                String pkgName = ((android.content.pm.PackageInfo) pkg).packageName;
                if (!pkgName.equals(context.getPackageName())) {
                    hasExternalMockApp = true;
                    Log.w(TAG, "[L2] Mock app installed: " + pkgName);
                    break;
                }
            }

            if (devOptions != 0) {
                // ↓ من 40 → 15: Developer Options وحدها لا تعني Mock Location
                suspicionScore += SCORE_DEV_OPTIONS_ON;
                mockReasons.add("DEVELOPER_OPTIONS_ENABLED");
                Log.d(TAG, "[L2] Dev options ON → +" + SCORE_DEV_OPTIONS_ON);
            }
            if (hasExternalMockApp) {
                suspicionScore += SCORE_MOCK_APP_INSTALLED;
                mockReasons.add("MOCK_APP_INSTALLED");
                Log.w(TAG, "[L2] External mock app → +" + SCORE_MOCK_APP_INSTALLED);
            }
        } catch (Exception e) {
            Log.w(TAG, "[L2] Check failed: " + e.getMessage());
        }

        // ── الطبقة ٣: Location Quality Forensics ─────────────────────────────
        float accuracy = location.getAccuracy();

        if (accuracy == 0.0f) {
            // accuracy=0 مستحيل في GPS حقيقي
            suspicionScore += SCORE_ACCURACY_ZERO;
            mockReasons.add("ACCURACY_ZERO");
            Log.w(TAG, "[L3] accuracy=0 → +" + SCORE_ACCURACY_ZERO);
        } else if (accuracy > 0 && accuracy == Math.floor(accuracy) && accuracy <= 10) {
            // ↓ الحد من 15 → 10 للتمييز الدقيق: 1,2,3,5,10 مريبة، 12,15 طبيعية
            suspicionScore += SCORE_ACCURACY_TINY_INT;
            mockReasons.add("ACCURACY_TINY_INTEGER_" + (int) accuracy);
            Log.w(TAG, "[L3] accuracy tiny int " + accuracy + " → +" + SCORE_ACCURACY_TINY_INT);
        }

        // اسم الـ provider مشبوه
        String provider = location.getProvider();
        if (provider != null) {
            String lower = provider.toLowerCase();
            if (lower.contains("mock") || lower.contains("fake")
                    || lower.contains("test") || lower.contains("spoof")) {
                suspicionScore += SCORE_MOCK_PROVIDER;
                mockReasons.add("SUSPICIOUS_PROVIDER_" + provider.toUpperCase());
                Log.w(TAG, "[L3] Suspicious provider: " + provider + " → +" + SCORE_MOCK_PROVIDER);
            }
        }

        // extras مشبوهة
        if (location.getExtras() != null) {
            if (location.getExtras().getBoolean("mockLocation", false)
                    || location.getExtras().containsKey("isMock")) {
                suspicionScore += SCORE_MOCK_EXTRAS;
                mockReasons.add("SUSPICIOUS_LOCATION_EXTRAS");
                Log.w(TAG, "[L3] Suspicious extras → +" + SCORE_MOCK_EXTRAS);
            }
        }

        // ── الطبقة ٤: Sensor Fusion ──────────────────────────────────────────
        // يستخدم القيمة المُمرَّرة من GeolocationServiceWrapper (متزامنة)
        if (lastAcceleration >= 0) {
            float gpsSpeed = location.getSpeed();
            // GPS يقول سرعة > 1 م/ث (مشي بطيء) لكن الجسم ساكن تماماً
            if (gpsSpeed > 1.0f && lastAcceleration < 0.3f) {
                suspicionScore += SCORE_SENSOR_STATIONARY;
                mockReasons.add("SENSOR_STATIONARY_WHILE_GPS_MOVING");
                Log.w(TAG, "[L4] GPS speed=" + gpsSpeed + " accel=" + lastAcceleration
                        + " → +" + SCORE_SENSOR_STATIONARY);
            }
        }

        // ── القرار النهائي ───────────────────────────────────────────────────
        boolean isMocked = suspicionScore >= 50;

        if (isMocked) {
            Log.w(TAG, "🚨 MOCK DETECTED! score=" + suspicionScore + " reasons=" + mockReasons);
        } else if (suspicionScore >= 30) {
            Log.i(TAG, "⚠️ Suspicious location. score=" + suspicionScore + " reasons=" + mockReasons);
        }

        // ── منطق الـ Geofence ────────────────────────────────────────────────
        try {
            JSONArray branches = new JSONArray(branchesJson);
            String currentActive = statePrefs.getString(KEY_ACTIVE_BRANCH, null);
            double lat = location.getLatitude();
            double lng = location.getLongitude();

            boolean isInsideAny  = false;
            String  insideBranchId   = null;
            String  insideBranchName = null;
            JSONObject activeBranchObj = null;

            for (int i = 0; i < branches.length(); i++) {
                JSONObject b = branches.getJSONObject(i);
                if (!b.has("latitude") || !b.has("longitude")
                        || b.isNull("latitude") || b.isNull("longitude")) continue;

                String bId = String.valueOf(b.getInt("id"));
                if (bId.equals(currentActive)) activeBranchObj = b;

                float radius = b.has("geofenceRadiusMeters") && !b.isNull("geofenceRadiusMeters")
                    ? (float) b.getDouble("geofenceRadiusMeters")
                    : DEFAULT_RADIUS;

                float[] dist = new float[1];
                Location.distanceBetween(lat, lng, b.getDouble("latitude"), b.getDouble("longitude"), dist);

                if (dist[0] <= radius) {
                    isInsideAny      = true;
                    insideBranchId   = bId;
                    insideBranchName = b.getString("name");
                }
            }

            // ── Auto check-out ────────────────────────────────────────────────
            if (currentActive != null) {
                boolean shouldCheckOut = false;
                if (activeBranchObj != null) {
                    float radius = activeBranchObj.has("geofenceRadiusMeters")
                            && !activeBranchObj.isNull("geofenceRadiusMeters")
                        ? (float) activeBranchObj.getDouble("geofenceRadiusMeters")
                        : DEFAULT_RADIUS;
                    float[] dist = new float[1];
                    Location.distanceBetween(lat, lng,
                        activeBranchObj.getDouble("latitude"),
                        activeBranchObj.getDouble("longitude"), dist);
                    if (dist[0] > radius + GEOFENCE_BUFFER) shouldCheckOut = true;
                } else {
                    // الفرع النشط لم يُوجد في القائمة → خروج
                    shouldCheckOut = true;
                }

                if (shouldCheckOut) {
                    String branchName = activeBranchObj != null
                        ? activeBranchObj.getString("name") : "الفرع";
                    Log.i(TAG, "Exiting branch " + currentActive + " — sending checkout");
                    boolean ok = sendNativeCheckOut(apiUrl, currentActive);
                    if (ok) {
                        statePrefs.edit().remove(KEY_ACTIVE_BRANCH).apply();
                        showNotification(context, NOTIF_CHECKOUT,
                            "🔴 خروج تلقائي", "تم تسجيل خروجك من: " + branchName);
                        currentActive = null;
                    }
                }
            }

            // ── Auto check-in ─────────────────────────────────────────────────
            if (isInsideAny && insideBranchId != null
                    && !insideBranchId.equals(currentActive)) {
                long now      = System.currentTimeMillis();
                long lastTime = statePrefs.getLong(KEY_LAST_CHECKIN + insideBranchId, 0);

                if (now - lastTime >= CHECKIN_COOLDOWN) {
                    Log.i(TAG, "Entering " + insideBranchName
                            + " score=" + suspicionScore + " mocked=" + isMocked);
                    boolean ok = sendNativeCheckIn(
                        apiUrl, insideBranchId, lat, lng,
                        isMocked, suspicionScore, mockReasons
                    );
                    if (ok) {
                        statePrefs.edit()
                            .putString(KEY_ACTIVE_BRANCH, insideBranchId)
                            .putLong(KEY_LAST_CHECKIN + insideBranchId, now)
                            .apply();
                        String title = isMocked ? "⚠️ دخول مشبوه"  : "✅ دخول تلقائي";
                        String text  = "تم تسجيل دخولك في: " + insideBranchName
                            + (isMocked ? " (نقاط: " + suspicionScore + ")" : "");
                        showNotification(context, NOTIF_CHECKIN, title, text);
                    }
                } else {
                    Log.d(TAG, "Check-in cooldown active for " + insideBranchName);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Geofence processing error", e);
        }
    }

    // ── HTTP helpers ───────────────────────────────────────────────────────────

    private static boolean sendNativeCheckIn(
            String baseUrl, String branchId,
            double lat, double lng,
            boolean isMocked, int score, List<String> reasons) {
        try {
            JSONArray reasonsArr = new JSONArray();
            for (String r : reasons) reasonsArr.put(r);

            JSONObject input = new JSONObject();
            input.put("branchId",       Integer.parseInt(branchId));
            input.put("latitude",       String.valueOf(lat));
            input.put("longitude",      String.valueOf(lng));
            input.put("isMocked",       isMocked);
            input.put("suspicionScore", score);
            input.put("mockReasons",    reasonsArr);

            JSONObject body = new JSONObject();
            body.put("json", input);

            URL url = new URL(baseUrl + "/api/trpc/visit.checkIn");
            return postJson(url, baseUrl, body.toString());
        } catch (Exception e) {
            Log.e(TAG, "checkIn HTTP error", e);
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
            return postJson(url, baseUrl, body.toString());
        } catch (Exception e) {
            Log.e(TAG, "checkOut HTTP error", e);
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

            // أرسل الـ cookies للمصادقة
            String cookies = CookieManager.getInstance().getCookie(baseUrl);
            if (cookies != null) conn.setRequestProperty("Cookie", cookies);

            conn.setDoOutput(true);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }

            int code = conn.getResponseCode();
            Log.i(TAG, "HTTP " + url.getPath() + " → " + code);
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.e(TAG, "HTTP error: " + url, e);
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
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
            );
            nm.createNotificationChannel(ch);
        }

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pi = PendingIntent.getActivity(
            ctx, 0, intent, PendingIntent.FLAG_IMMUTABLE
        );

        Notification notif = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(ctx.getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build();

        nm.notify(id, notif);
    }
}
