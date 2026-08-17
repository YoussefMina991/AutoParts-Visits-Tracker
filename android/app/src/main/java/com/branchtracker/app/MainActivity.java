package com.branchtracker.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity
 * ════════════════════════════════════════════════════════════
 * الإصلاح الجذري: شغّل GeolocationServiceWrapper فور فتح التطبيق.
 *
 * المشكلة القديمة:
 *   الـ Wrapper (اللي بيشغّل NativeGeofenceEngine) لم يكن يُشغَّل
 *   إلا بعد restart الجهاز أو لما الـ Accessibility Watchdog يكتشفه.
 *   النتيجة: نظام كشف Mock Location معطل كلياً في المعظم.
 *
 * الحل:
 *   onCreate → startForegroundService(GeolocationServiceWrapper)
 *   onResume  → safety net لو الـ OS أوقف الـ service
 *
 * ملاحظة: onResume يجب أن يكون public لأن BridgeActivity تعرّفه public
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "BranchTracker:Main";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startGeolocationWrapper("onCreate");
    }

    @Override
    public void onResume() {
        super.onResume();
        // Safety net: لو الـ OS أوقف الـ wrapper → نشغله لما يرجع المستخدم
        if (!ServiceStateHolder.isGeolocationServiceRunning) {
            startGeolocationWrapper("onResume");
        }
    }

    /**
     * يشغّل GeolocationServiceWrapper بالطريقة الصحيحة حسب إصدار Android.
     * Fallback إلى WorkManager لو حصل استثناء على بعض الأجهزة المقيدة.
     */
    private void startGeolocationWrapper(String trigger) {
        try {
            Intent wrapperIntent = new Intent(this, GeolocationServiceWrapper.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(wrapperIntent);
            } else {
                startService(wrapperIntent);
            }
            Log.i(TAG, "GeolocationServiceWrapper started from " + trigger);
        } catch (Exception e) {
            Log.w(TAG, "Direct start failed (" + trigger + ") → WorkManager fallback: " + e.getMessage());
            BootStartWorker.enqueue(getApplicationContext());
        }
    }
}
