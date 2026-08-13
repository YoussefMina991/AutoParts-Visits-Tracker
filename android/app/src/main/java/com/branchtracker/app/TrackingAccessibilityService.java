package com.branchtracker.app;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * TrackingAccessibilityService
 * ════════════════════════════════════════════════════════════
 * Watchdog يضمن إن BackgroundGeolocationService فاضل شغال دايماً.
 *
 * الفرق عن النسخة القديمة — إصلاح مشكلة getRunningServices:
 * ══════════════════════════════════════════════════════════
 * getRunningServices() deprecated من Android 8 وبترجع نتايج غلط.
 * على Android 8+ بترجع بس services الـ app نفسه — مش الـ third-party services.
 * يعني كانت دايماً بترجع false حتى لو الـ service شغال فعلاً!
 *
 * الحل: static volatile flag في الـ ServiceStateHolder
 * ══════════════════════════════════════════════════════
 * BackgroundGeolocationService بيرفع الـ flag لما يشتغل،
 * وبيحطه false لما يوقف. الـ watchdog بيقرأ الـ flag مباشرة —
 * مش بيسأل Android عن أي حاجة.
 *
 * ليه volatile؟
 * ════════════════
 * الـ flag بيتقرأ من thread الـ watchdog ويتكتب من thread الـ service.
 * volatile بتضمن إن القراءة دايماً بتاخد أحدث قيمة من الـ memory.
 */
public class TrackingAccessibilityService extends AccessibilityService {

    private static final String TAG = "BranchTracker:Access";
    private static final long WATCHDOG_INTERVAL_MS = 30_000;

    private final Handler handler = new Handler(Looper.getMainLooper());

    // ─── Watchdog ─────────────────────────────────────────────────────────────
    private final Runnable watchdog = new Runnable() {
        @Override
        public void run() {
            ensureTrackingServiceRunning();
            handler.postDelayed(this, WATCHDOG_INTERVAL_MS);
        }
    };

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        Log.i(TAG, "Accessibility service connected — starting watchdog");
        handler.post(watchdog);
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "Service interrupted — resuming in 5s");
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, 5_000);
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "Service destroyed — stopping watchdog");
        handler.removeCallbacks(watchdog);
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // intentionally empty
    }

    // ─── Core Logic ───────────────────────────────────────────────────────────

    private void ensureTrackingServiceRunning() {
        try {
            // FIX: بدل getRunningServices المكسورة،
            // بنقرأ الـ static flag اللي الـ service بيحدثه بنفسه
            if (!ServiceStateHolder.isGeolocationServiceRunning) {
                Log.i(TAG, "Geolocation service not running — restarting via WorkManager");
                // نشغله عبر WorkManager عشان يكون موثوق على كل الأجهزة
                BootStartWorker.enqueue(getApplicationContext());
            } else {
                Log.d(TAG, "Geolocation service is running ✓");
            }
        } catch (Exception e) {
            Log.e(TAG, "Watchdog error: " + e.getMessage());
        }
    }
}
