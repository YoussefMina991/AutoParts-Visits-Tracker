package com.branchtracker.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BootReceiver
 * ════════════════════════════════════════════════════════════
 * بيستقبل BOOT_COMPLETED بعد restart الجهاز ويشغل الـ tracking.
 *
 * الفرق عن النسخة القديمة — إصلاح مشكلة Android 10+:
 * ══════════════════════════════════════════════════════
 * المشكلة القديمة:
 *   context.startForegroundService() من الـ boot receiver كان بيفشل
 *   على Android 10+ لأن Android بيديك نافذة صغيرة جداً (~10 ثانية)
 *   بعد الـ boot قبل ما يرفض تشغيل Foreground Services من الـ background.
 *   لو الجهاز بطيء أو عنده load كتير، الـ service مكنش بيشتغل.
 *
 * الحل — WorkManager مع expedited task:
 * ═══════════════════════════════════════
 * WorkManager مش Foreground Service — ده scheduled work.
 * Android بيضمن تشغيله حتى لو الـ app في الـ background تماماً.
 * setExpedited() بيقوله "شغله في أقرب وقت ممكن" بدون قيود الـ boot.
 * لو الجهاز اتشغل والـ app مش في الـ foreground، WorkManager
 * بيشغل الـ task في خلال ثواني بدون أي مشكلة.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BranchTracker:Boot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        boolean isBoot =
            action.equals(Intent.ACTION_BOOT_COMPLETED) ||
            action.equals("android.intent.action.QUICKBOOT_POWERON") ||
            action.equals("com.htc.intent.action.QUICKBOOT_POWERON");

        if (!isBoot) return;

        Log.i(TAG, "Boot detected — scheduling tracking restart via WorkManager");

        // FIX: بدل startForegroundService المباشر اللي بيفشل على Android 10+،
        // بنستخدم WorkManager اللي Android بيضمن تشغيله بعد الـ boot
        BootStartWorker.enqueue(context);
    }
}
