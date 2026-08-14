package com.branchtracker.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import android.util.Log;
import android.webkit.CookieManager;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class NativeGeofenceEngine {

    private static final String TAG = "BranchTracker:NativeEngine";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String STATE_PREFS = "BranchTrackerNativeState";
    private static final String KEY_ACTIVE_BRANCH = "active_branch_id";
    private static final String KEY_LAST_CHECKIN_TIME = "last_checkin_time_";
    private static final float DEFAULT_RADIUS_METERS = 200.0f;
    private static final float GEOFENCE_BUFFER_METERS = 50.0f; // Buffer zone to prevent flickering
    private static final long CHECKIN_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes cooldown

    private static final String CHANNEL_ID = "visit_tracking_events";
    private static final String CHANNEL_NAME = "Visit Tracking Events";
    private static final int NOTIFICATION_ID_CHECKIN = 1001;
    private static final int NOTIFICATION_ID_CHECKOUT = 1002;

    public static void processLocation(Context context, Location location) {
        if (location == null) return;

        SharedPreferences capacitorPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences statePrefs = context.getSharedPreferences(STATE_PREFS, Context.MODE_PRIVATE);

        String branchesJson = capacitorPrefs.getString("branches_data", null);
        String apiUrl = capacitorPrefs.getString("api_url", null);

        if (branchesJson == null || apiUrl == null) {
            Log.d(TAG, "No branches or API URL in preferences. Skipping native geofence.");
            return;
        }

        try {
            JSONArray branches = new JSONArray(branchesJson);
            String currentActiveBranchId = statePrefs.getString(KEY_ACTIVE_BRANCH, null);
            boolean isInsideAny = false;
            String insideBranchId = null;
            String insideBranchName = null;

            double currentLat = location.getLatitude();
            double currentLng = location.getLongitude();

            boolean isMocked = false;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                isMocked = location.isMock();
            } else {
                isMocked = location.isFromMockProvider();
            }

            // ── Enhanced Mock Detection (Strict Mode) ──────────────────────────
            // Some stealthy mock apps bypass isMock() but leave traces
            if (!isMocked) {
                // 1. Check for exactly zero accuracy/speed/bearing (very rare in real GPS)
                if (location.getAccuracy() == 0.0f) isMocked = true;
                
                // 2. Check for "mock" or "fake" in provider name
                String provider = location.getProvider();
                if (provider != null && (provider.toLowerCase().contains("mock") || provider.toLowerCase().contains("fake"))) {
                    isMocked = true;
                }

                // 3. Check for suspicious location extras
                if (location.getExtras() != null) {
                    if (location.getExtras().getBoolean("mockLocation", false)) isMocked = true;
                    if (location.getExtras().containsKey("mockLocation")) isMocked = true;
                }
            }

            // 1. Check which branch (if any) we're inside
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
                    // We found we are inside a branch, but keep searching to find activeBranchObj if needed
                }
            }

            // 2. Auto check-out if we left the active branch (with Buffer Zone)
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
                    
                    // Exit only if distance > radius + buffer
                    if (results[0] > radius + GEOFENCE_BUFFER_METERS) {
                        shouldCheckOut = true;
                    }
                } else {
                    // Active branch not in list anymore? Check out.
                    shouldCheckOut = true;
                }

                if (shouldCheckOut) {
                    Log.i(TAG, "Exited branch " + currentActiveBranchId + " (Buffer zone cleared) — executing Native Check-Out...");
                    String branchName = activeBranchObj != null ? activeBranchObj.getString("name") : "الفرع";
                    boolean success = sendNativeCheckOut(apiUrl, currentActiveBranchId);
                    if (success) {
                        statePrefs.edit().remove(KEY_ACTIVE_BRANCH).apply();
                        showNotification(context, NOTIFICATION_ID_CHECKOUT, "🔴 خروج تلقائي", "تم تسجيل خروجك من: " + branchName);
                        currentActiveBranchId = null;
                    }
                }
            }

            // 3. Auto check-in if we entered a new branch (with Cooldown)
            if (isInsideAny && insideBranchId != null && !insideBranchId.equals(currentActiveBranchId)) {
                long now = System.currentTimeMillis();
                long lastCheckIn = statePrefs.getLong(KEY_LAST_CHECKIN_TIME + insideBranchId, 0);
                
                if (now - lastCheckIn >= CHECKIN_COOLDOWN_MS) {
                    Log.i(TAG, "Entered branch " + insideBranchName + " (" + insideBranchId + "), Mocked: " + isMocked);
                    boolean success = sendNativeCheckIn(apiUrl, insideBranchId, currentLat, currentLng, isMocked);
                    if (success) {
                        statePrefs.edit()
                            .putString(KEY_ACTIVE_BRANCH, insideBranchId)
                            .putLong(KEY_LAST_CHECKIN_TIME + insideBranchId, now)
                            .apply();
                        showNotification(context, NOTIFICATION_ID_CHECKIN, "✅ دخول تلقائي", "تم تسجيل دخولك في: " + insideBranchName + (isMocked ? " (موقع وهمي ⚠️)" : ""));
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
    // tRPC v11 expects POST to /api/trpc/<procedure>
    // with body: { "0": { "json": { ...input } } }   (batch format)
    // and query param: ?batch=1&input={"0":{"json":{...}}}
    // The simplest approach that works with tRPC server/adapters/express
    // is to POST with Content-Type: application/json and body = the input directly,
    // BUT tRPC's express adapter reads `input` from the request body as:
    // { "json": <input> } when Content-Type is application/json.
    // We use the straightforward single-call format below.

    private static boolean sendNativeCheckIn(String baseUrl, String branchId, double lat, double lng, boolean isMocked) {
        try {
            // tRPC single procedure call — body must be { "json": <input> }
            JSONObject input = new JSONObject();
            input.put("branchId", Integer.parseInt(branchId));
            input.put("latitude", String.valueOf(lat));
            input.put("longitude", String.valueOf(lng));
            input.put("isMocked", isMocked);

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
            // Uses the nativeCheckOut endpoint which accepts branchId directly
            // (the server looks up the active visitId itself)
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

            // Forward the session cookie from the WebView so the server
            // authenticates the request as the logged-in manager
            String cookies = CookieManager.getInstance().getCookie(baseUrl);
            if (cookies != null) {
                conn.setRequestProperty("Cookie", cookies);
            }

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
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            notificationManager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        notificationManager.notify(id, builder.build());
    }
}
