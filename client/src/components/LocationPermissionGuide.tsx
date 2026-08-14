import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

interface Props {
  onDismiss: () => void;
  onPermissionGranted: () => void;
}

export function LocationPermissionGuide({ onDismiss, onPermissionGranted }: Props) {
  const [step, setStep] = useState<"intro" | "steps" | "waiting">("intro");
  const [checking, setChecking] = useState(false);

  const openSettings = async () => {
    setStep("waiting");
    try {
      if (Capacitor.isNativePlatform()) {
        // Use the background geolocation plugin to open native app settings
        const bgGeoModule = "@capacitor-community/background-geolocation";
        const { BackgroundGeolocation } = await import(/* @vite-ignore */ bgGeoModule);
        await BackgroundGeolocation.openSettings();
      }
    } catch {
      // Fallback: just show waiting state
    }
  };

  const recheckPermission = async () => {
    setChecking(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const perms = await Geolocation.checkPermissions();
        if (perms.location === "granted") {
          onPermissionGranted();
          return;
        }
      }
    } catch {}
    setChecking(false);
    // Show as done anyway if user says so
    onPermissionGranted();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-end"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(20,25,40,0.98) 0%, rgba(10,15,30,0.99) 100%)",
          border: "1px solid rgba(76,215,246,0.15)",
          borderBottom: "none",
          boxShadow: "0 -20px 60px rgba(76,215,246,0.15)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-4 pb-2">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          />
        </div>

        <div className="px-6 pb-10 pt-2">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center relative"
              style={{
                background: "rgba(76,215,246,0.1)",
                border: "1px solid rgba(76,215,246,0.3)",
                boxShadow: "0 0 30px rgba(76,215,246,0.2)",
              }}
            >
              <span
                className="material-symbols-outlined text-[42px]"
                style={{ color: "#4cd7f6", fontVariationSettings: "'FILL' 1" }}
              >
                my_location
              </span>
              {/* Pulse ring */}
              <div
                className="absolute inset-0 rounded-2xl animate-ping"
                style={{ border: "1px solid rgba(76,215,246,0.4)", animationDuration: "2s" }}
              />
            </div>
          </div>

          {step === "intro" && (
            <>
              <h2
                className="text-center text-[22px] font-bold mb-3"
                style={{ color: "#fff", fontFamily: "'Cairo', sans-serif" }}
              >
                تفعيل المراقبة المستمرة
              </h2>
              <p
                className="text-center text-[14px] leading-7 mb-6"
                style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Cairo', sans-serif" }}
              >
                عشان التطبيق يسجل دخولك وخروجك تلقائياً حتى لو الشاشة مقفولة،
                محتاج تصريح الموقع يكون على{" "}
                <span style={{ color: "#4cd7f6", fontWeight: "bold" }}>
                  "في جميع الأوقات"
                </span>{" "}
                مش "أثناء الاستخدام فقط".
              </p>

              {/* Why section */}
              <div
                className="rounded-2xl p-4 mb-6 space-y-3"
                style={{ background: "rgba(76,215,246,0.05)", border: "1px solid rgba(76,215,246,0.1)" }}
              >
                {[
                  { icon: "shield_check", text: "يتحقق من وجودك في الفرع تلقائياً", color: "#4cd7f6" },
                  { icon: "battery_saver", text: "تصميم موفر للبطارية (يتتبع فقط عند التحرك)", color: "#4ade80" },
                  { icon: "lock", text: "البيانات مشفرة ومؤمنة على السيرفر", color: "#f472b6" },
                ].map(({ icon, text, color }) => (
                  <div key={icon} className="flex items-center gap-3">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ color, fontVariationSettings: "'FILL' 1" }}
                    >
                      {icon}
                    </span>
                    <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "'Cairo', sans-serif" }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep("steps")}
                className="w-full h-14 rounded-2xl font-bold text-[15px] mb-3 transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #4cd7f6, #06b6d4)",
                  color: "#000",
                  fontFamily: "'Cairo', sans-serif",
                  boxShadow: "0 8px 25px rgba(76,215,246,0.4)",
                }}
              >
                تفعيل الآن
              </button>
              <button
                onClick={onDismiss}
                className="w-full h-11 rounded-2xl text-[14px] transition-all active:scale-95"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Cairo', sans-serif" }}
              >
                لاحقاً
              </button>
            </>
          )}

          {step === "steps" && (
            <>
              <h2
                className="text-center text-[20px] font-bold mb-2"
                style={{ color: "#fff", fontFamily: "'Cairo', sans-serif" }}
              >
                خطوات التفعيل
              </h2>
              <p
                className="text-center text-[13px] mb-6"
                style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Cairo', sans-serif" }}
              >
                اتبع الخطوات دي في إعدادات الموبايل
              </p>

              {/* Steps */}
              <div className="space-y-3 mb-6">
                {[
                  { n: "1", title: 'اضغط "فتح الإعدادات" أدناه', sub: 'هيفتح إعدادات التطبيق مباشرة' },
                  { n: "2", title: 'اختار "الموقع" أو "Location"', sub: 'ستجدها في قائمة أذونات التطبيق' },
                  { n: "3", title: '"اسمح في جميع الأوقات"', sub: '"Allow all the time" - اختار هذا الخيار' },
                  { n: "4", title: 'ارجع للتطبيق واضغط "تم"', sub: 'التتبع التلقائي سيبدأ فوراً' },
                ].map(({ n, title, sub }) => (
                  <div
                    key={n}
                    className="flex gap-4 items-start p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                      style={{ background: "rgba(76,215,246,0.15)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.3)" }}
                    >
                      {n}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold" style={{ color: "#fff", fontFamily: "'Cairo', sans-serif" }}>
                        {title}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Cairo', sans-serif" }}>
                        {sub}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={openSettings}
                className="w-full h-14 rounded-2xl font-bold text-[15px] mb-3 flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #4cd7f6, #06b6d4)",
                  color: "#000",
                  fontFamily: "'Cairo', sans-serif",
                  boxShadow: "0 8px 25px rgba(76,215,246,0.4)",
                }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  settings
                </span>
                فتح الإعدادات
              </button>
              <button
                onClick={onDismiss}
                className="w-full h-11 rounded-2xl text-[14px] transition-all active:scale-95"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Cairo', sans-serif" }}
              >
                تخطي
              </button>
            </>
          )}

          {step === "waiting" && (
            <>
              <h2
                className="text-center text-[20px] font-bold mb-3"
                style={{ color: "#fff", fontFamily: "'Cairo', sans-serif" }}
              >
                في انتظارك...
              </h2>
              <p
                className="text-center text-[14px] leading-7 mb-6"
                style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Cairo', sans-serif" }}
              >
                بعد ما تغير الإعداد لـ{" "}
                <span style={{ color: "#4cd7f6", fontWeight: "bold" }}>"في جميع الأوقات"</span>
                {" "}في الإعدادات، ارجع هنا واضغط "تم ✓"
              </p>

              {/* Visual reminder */}
              <div
                className="rounded-2xl p-4 mb-6"
                style={{
                  background: "rgba(76,215,246,0.06)",
                  border: "1px dashed rgba(76,215,246,0.3)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-[28px]"
                    style={{ color: "#4cd7f6", fontVariationSettings: "'FILL' 1" }}
                  >
                    tips_and_updates
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "#4cd7f6", fontFamily: "'Cairo', sans-serif" }}>
                      الموقع ← اسمح في جميع الأوقات
                    </p>
                    <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Cairo', sans-serif" }}>
                      Location → Allow all the time
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={recheckPermission}
                disabled={checking}
                className="w-full h-14 rounded-2xl font-bold text-[15px] mb-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  color: "#000",
                  fontFamily: "'Cairo', sans-serif",
                  boxShadow: "0 8px 25px rgba(74,222,128,0.35)",
                }}
              >
                {checking ? (
                  <>
                    <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    تم، ارجع للتطبيق
                  </>
                )}
              </button>
              <button
                onClick={() => setStep("steps")}
                className="w-full h-11 rounded-2xl text-[14px]"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Cairo', sans-serif" }}
              >
                ← ارجع للخطوات
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
