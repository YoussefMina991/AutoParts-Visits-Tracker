import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.branchtracker.app',
  appName: 'Branch Tracker',
  webDir: 'dist/public',
  // Use localhost for WebView — important for cookie handling
  server: {
    androidScheme: 'https',
    // Allow cleartext traffic to the API server during development
    cleartext: true,
  },
  android: {
    // Allow navigation to the API server
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
    BackgroundGeolocation: {
      // إشعار دائم في الـ notification bar أثناء التتبع
      // ده إلزامي على Android 8+ عشان الـ Foreground Service يشتغل
      notificationTitle: 'تتبع الموقع نشط',
      notificationText: 'Branch Tracker يراقب موقعك أثناء العمل',
      notificationIconColor: '#1a6b3a',

      // أقل تكرار ممكن للـ updates عشان نوفر البطارية
      // 10 ثواني كافية لـ geofencing
      interval: 10000,
      fastestInterval: 5000,

      // دقة عالية — لازم للـ geofencing
      priority: 'HIGH_ACCURACY',

      // لو الجهاز وقف تماماً، مش محتاج updates
      activitiesInterval: 10000,

      // ده بيخلي الـ service يرجع تلقائياً لو الـ OS قفله
      stopOnTerminate: false,
      startOnBoot: true,

      // مهم على Xiaomi/OPPO/Samsung
      // بيمنع الـ OS من تعليق الـ service
      disableElasticity: true,

      // تجاهل تحديثات الـ GPS لو الدقة أقل من 100m
      // بيقلل الضوضاء في وسط المدن
      desiredAccuracy: 10,
    },
  },
};

export default config;
