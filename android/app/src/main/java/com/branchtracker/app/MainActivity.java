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
 *   مع حماية START_STICKY في الـ Wrapper نفسه لو الـ OS أوقفه.
 *
 *   onResume → نفس الشيء كـ safety net لو الـ OS أوقف الـ service
 *   أثناء الاستخدام (بعض الأجهزة الصينية بتوقف الـ services وقت الضغط).
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "BranchTracker:Main";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startGeolocationWrapper("onCreate");
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Safety net: لو الـ OS أوقف الـ wrapper أثناء الخلفية → نشغله تاني لما يرجع المستخدم
        if (!ServiceStateHolder.isGeolocationServiceRunning) {
            startGeolocationWrapper("onResume");
        }
    }

    /**
     * يشغّل GeolocationServiceWrapper بالطريقة الصحيحة حسب إصدار Android.
     * مؤمن ضد الاستثناءات — لو فشل، يعيد المحاولة عبر WorkManager.
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
            // Fallback: WorkManager موثوق أكثر لو حصل استثناء (بعض الأجهزة المقيدة)
            Log.w(TAG, "Direct start failed from " + trigger + " — falling back to WorkManager: " + e.getMessage());
            BootStartWorker.enqueue(getApplicationContext());
        }
    }
}
