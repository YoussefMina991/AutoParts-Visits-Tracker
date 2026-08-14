/**
 * IOSCheckInPrompt
 * ══════════════════════════════════════════════════════════
 * Bottom Sheet بيظهر تلقائياً على iOS لما المدير يكون
 * قريب من فرع ومحتاج يسجل دخول.
 *
 * الفكرة:
 *  - بدل ما المدير يفضل يدور على زرار Check-in،
 *    التطبيق بيجيله هو تلقائياً بـ bottom sheet
 *  - بيوريله اسم الفرع والمسافة
 *  - زرار واحد كبير "سجل دخولك" — ضغطة واحدة وخلاص
 *  - لو مش هو الفرع الصح → زرار "مش هنا" يعدي
 */

import { useEffect, useRef } from "react";
import type { IOSNearbyBranch } from "@/hooks/useGeofence";

interface Props {
  branch: IOSNearbyBranch | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function IOSCheckInPrompt({ branch, onConfirm, onDismiss }: Props) {
  const prevBranchId = useRef<number | null>(null);

  // لو الـ branch اتغير → vibrate عشان يلفت انتباه المدير
  useEffect(() => {
    if (branch && branch.id !== prevBranchId.current) {
      prevBranchId.current = branch.id;
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
    if (!branch) {
      prevBranchId.current = null;
    }
  }, [branch]);

  if (!branch) return null;

  const distanceText =
    branch.distanceMeters < 1000
      ? `${branch.distanceMeters} متر`
      : `${(branch.distanceMeters / 1000).toFixed(1)} كم`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
        onClick={onDismiss}
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] rounded-t-3xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(7,12,25,0.99) 100%)",
          border: "1px solid rgba(76,215,246,0.2)",
          borderBottom: "none",
          boxShadow: "0 -24px 80px rgba(76,215,246,0.2)",
          animation: "slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes pulseRing {
            0%   { transform: scale(1);    opacity: 0.8; }
            100% { transform: scale(1.6);  opacity: 0;   }
          }
        `}</style>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>

        <div className="px-6 pt-4 pb-10">

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            {/* Animated location icon */}
            <div className="relative flex-shrink-0">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(76,215,246,0.12)",
                  border: "1px solid rgba(76,215,246,0.35)",
                  boxShadow: "0 0 30px rgba(76,215,246,0.25)",
                }}
              >
                <span
                  className="material-symbols-outlined text-[36px]"
                  style={{ color: "#4cd7f6", fontVariationSettings: "'FILL' 1" }}
                >
                  store
                </span>
              </div>
              {/* Pulse ring */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  border: "1px solid rgba(76,215,246,0.5)",
                  animation: "pulseRing 1.5s ease-out infinite",
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: "#4cd7f6", fontFamily: "'Cairo', sans-serif" }}
              >
                أنت قريب من فرع
              </p>
              <h2
                className="text-[20px] font-bold leading-tight truncate"
                style={{ color: "#fff", fontFamily: "'Cairo', sans-serif" }}
              >
                {branch.name}
              </h2>
              {branch.address && (
                <p
                  className="text-[13px] mt-0.5 truncate"
                  style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Cairo', sans-serif" }}
                >
                  {branch.address}
                </p>
              )}
            </div>
          </div>

          {/* Distance badge */}
          <div
            className="flex items-center gap-3 rounded-2xl p-4 mb-6"
            style={{
              background: "rgba(76,215,246,0.06)",
              border: "1px solid rgba(76,215,246,0.12)",
            }}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ color: "#4cd7f6", fontVariationSettings: "'FILL' 1" }}
            >
              near_me
            </span>
            <div>
              <p
                className="text-[13px] font-semibold"
                style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Cairo', sans-serif" }}
              >
                المسافة الحالية
              </p>
              <p
                className="text-[22px] font-bold"
                style={{ color: "#4cd7f6", fontFamily: "'Fira Mono', monospace" }}
              >
                {distanceText}
              </p>
            </div>

            {/* GPS accuracy indicator */}
            {branch.accuracy !== undefined && (
              <div className="ml-auto text-right">
                <p
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Cairo', sans-serif" }}
                >
                  دقة GPS
                </p>
                <p
                  className="text-[14px] font-semibold"
                  style={{
                    color: branch.accuracy < 30 ? "#4ade80" : branch.accuracy < 80 ? "#fbbf24" : "#f87171",
                    fontFamily: "'Fira Mono', monospace",
                  }}
                >
                  ± {Math.round(branch.accuracy)}م
                </p>
              </div>
            )}
          </div>

          {/* Confirm button */}
          <button
            onClick={onConfirm}
            className="w-full h-16 rounded-2xl font-bold text-[17px] mb-3 flex items-center justify-center gap-3 transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #06b6d4, #0891b2)",
              color: "#fff",
              fontFamily: "'Cairo', sans-serif",
              boxShadow: "0 8px 30px rgba(6,182,212,0.45)",
            }}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              login
            </span>
            سجّل دخولك الآن
          </button>

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="w-full h-12 rounded-2xl text-[14px] transition-all active:scale-95"
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            مش هنا — تخطي
          </button>
        </div>
      </div>
    </>
  );
}
