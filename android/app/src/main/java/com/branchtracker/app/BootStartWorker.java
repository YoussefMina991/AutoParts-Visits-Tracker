package com.branchtracker.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * BootStartWorker
 * ════════════════════════════════════════════════════════════
 * WorkManager Worker بيشغل الـ tracking services بعد الـ boot.
 *
 * ليه WorkManager أفضل من startForegroundService مباشرة؟
 * ═══════════════════════════════════════════════════════════
 * على Android 10+، لو حاولت تشغل Foreground Service من BroadcastReceiver
 * (زي BootReceiver)، Android ممكن يرفضه لو الـ app مش في الـ foreground
 * أو لو الجهاز لسه شايل load من الـ boot.
 *
 * WorkManager بيحل ده بـ:
 * 1. setExpedited() → بيطلب تشغيل فوري بدون قيود background
 * 2. لو الجهاز مش مستعد، WorkManager بينتظر ويشغل لما يكون ready
 * 3. مش بيتقيد بنافذة الـ 10 ثانية بتاعة الـ boot receivers
 *
 * الـ Worker بيشغل:
 * 1. BackgroundGeolocationService (الـ GPS tracking)
 * 2. GeolocationServiceWrapper (اللي بيحدث الـ ServiceStateHolder flag)
 */
public class BootStartWorker extends Worker {

    private static final String TAG = "BranchTracker:Worker";
    private static final String WORK_NAME = "boot_tracking_start";

    public BootStartWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    /**
     * الـ entry point — ده اللي بيتكلله WorkManager
     */
    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        Log.i(TAG, "BootStartWorker running — starting tracking services");

        try {
            // 1. شغل الـ GPS tracking service
            Intent geoIntent = new Intent();
            geoIntent.setClassName(
                ctx.getPackageName(),
                "com.equimaps.capacitor_background_geolocation.BackgroundGeolocationService"
            );

            // 2. شغل الـ wrapper اللي بيحدث الـ ServiceStateHolder flag
            Intent wrapperIntent = new Intent(ctx, GeolocationServiceWrapper.class);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(geoIntent);
                ctx.startForegroundService(wrapperIntent);
            } else {
                ctx.startService(geoIntent);
                ctx.startService(wrapperIntent);
            }

            Log.i(TAG, "Both services started successfully ✓");
            return Result.success();

        } catch (Exception e) {
            Log.e(TAG, "Failed to start services: " + e.getMessage());
            // retry() → WorkManager هيحاول تاني بعد شوية
            return Result.retry();
        }
    }

    /**
     * helper method — يُستخدم من BootReceiver والـ watchdog
     * setExpedited = "شغله في أقرب وقت ممكن"
     * KEEP = لو في task زيه شغال، متعملش واحد جديد
     */
    public static void enqueue(Context context) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(BootStartWorker.class)
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build();

        WorkManager.getInstance(context).enqueueUniqueWork(
            WORK_NAME,
            ExistingWorkPolicy.KEEP,
            request
        );

        Log.i(TAG, "BootStartWorker enqueued");
    }
}
