package com.branchtracker.app;

/**
 * ServiceStateHolder
 * ════════════════════════════════════════════════════════════
 * حل بسيط وموثوق 100% لمشكلة getRunningServices المكسورة.
 *
 * المشكلة اللي بيحلها:
 * ════════════════════
 * getRunningServices() deprecated من Android 8 وبترجع نتايج غلط —
 * على Android 8+ بترجع بس services الـ app نفسه ومش الـ third-party.
 * الـ BackgroundGeolocationService من capacitor-community مش app services،
 * فكانت الـ watchdog دايماً تفكر إنه مش شغال وتحاول تشغله من جديد.
 *
 * الحل:
 * ══════
 * static volatile boolean — الـ service نفسه بيحدثه:
 * - onCreate() / onStartCommand() → true
 * - onDestroy()                   → false
 *
 * الـ watchdog بيقرأ الـ flag مباشرة من الـ memory —
 * مش بيسأل Android عن أي حاجة.
 *
 * ليه volatile؟
 * ════════════════
 * القراءة من thread الـ watchdog (Handler/main thread)
 * والكتابة من thread الـ service (قد يكون thread تاني).
 * volatile بتضمن visibility فورية بين الـ threads بدون locking.
 */
public class ServiceStateHolder {

    /**
     * true = BackgroundGeolocationService شغال حالياً
     * false = وقف أو لسه ما اتشغلش
     *
     * يتحدث فقط من BackgroundGeolocationService
     * يتقرأ من TrackingAccessibilityService (watchdog)
     */
    public static volatile boolean isGeolocationServiceRunning = false;

    // Utility class — no instances
    private ServiceStateHolder() {}
}
