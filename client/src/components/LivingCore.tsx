import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function useElapsed(seed: number, active: boolean) {
  const [seconds, setSeconds] = useState(seed);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const SCAN_PHRASES = [
  "Scanning perimeter…",
  "Locking GPS fix…",
  "Watching geofences…",
  "Logging dwell time…",
  "All sensors nominal",
];

function useCyclingPhrase() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SCAN_PHRASES.length), 3200);
    return () => clearInterval(id);
  }, []);
  return SCAN_PHRASES[idx];
}

// ─── Concentric HUD rings ────────────────────────────────────────────────────
function Rings() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {[0.95, 0.72, 0.5, 0.28].map((s, i) => (
        <div
          key={s}
          className="absolute left-1/2 top-1/2 rounded-full border border-[oklch(0.82_0.15_200/0.15)]"
          style={{
            width: `${s * 100}%`,
            height: `${s * 100}%`,
            transform: "translate(-50%, -50%)",
            borderStyle: i === 1 ? "dashed" : "solid",
          }}
        />
      ))}
      {/* Crosshairs */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[oklch(0.82_0.15_200/0.15)] to-transparent" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[oklch(0.82_0.15_200/0.15)] to-transparent" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function LivingCore() {
  const phrase = useCyclingPhrase();

  // ── Real data from API ──
  const { data: historyData } = trpc.visit.myHistory.useQuery({ limit: 1, offset: 0 });
  const { data: branches = [] } = trpc.manager.getMyBranches.useQuery();

  const activeVisit = historyData?.items[0]?.status === "checked_in"
    ? historyData.items[0]
    : null;

  // ── Timer: elapsed seconds since check-in ──
  const elapsedSeed = useMemo(() => {
    if (!activeVisit?.checkInAt) return 0;
    return Math.floor((Date.now() - new Date(activeVisit.checkInAt).getTime()) / 1000);
  }, [activeVisit?.checkInAt]);

  const elapsed = useElapsed(elapsedSeed, !!activeVisit);

  // ── Branch blips on radar ──
  const blips = useMemo(() =>
    branches.slice(0, 5).map((b, i) => {
      const angle = (i / branches.length) * 360 + 20;
      const radius = 0.3 + (i * 0.12);
      const rad = (angle * Math.PI) / 180;
      const r = Math.min(radius, 0.9);
      return {
        id: b.id,
        name: b.name,
        x: 50 + Math.cos(rad) * r * 42,
        y: 50 + Math.sin(rad) * r * 42,
        visited: activeVisit?.branchId === b.id,
      };
    }),
    [branches, activeVisit]
  );

  return (
    <section className="w-full px-4 pt-6" aria-label="Live autonomous scanner">
      <div className="relative mx-auto aspect-square w-full max-w-[320px]">
        {/* Aurora glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 animate-aurora rounded-full bg-[radial-gradient(circle_at_center,oklch(0.82_0.15_200/0.28),transparent_62%)] blur-2xl" />

        {/* Outer tick ring */}
        <div
          className="absolute inset-0 animate-spin-reverse rounded-full border border-[oklch(0.82_0.15_200/0.2)]"
          aria-hidden="true"
          style={{
            maskImage: "repeating-conic-gradient(from 0deg, #000 0deg 2deg, transparent 2deg 12deg)",
            WebkitMaskImage: "repeating-conic-gradient(from 0deg, #000 0deg 2deg, transparent 2deg 12deg)",
          }}
        />

        <Rings />

        {/* Radar sweep cone */}
        <div className="absolute inset-0 animate-radar-sweep rounded-full" aria-hidden="true">
          <div
            className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left"
            style={{
              background:
                "conic-gradient(from 0deg, oklch(0.82 0.15 200 / 0.35), oklch(0.82 0.15 200 / 0.02) 55deg, transparent 90deg)",
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
            }}
          />
        </div>

        {/* Branch blips */}
        {blips.map((b, i) => (
          <div
            key={b.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
          >
            <span
              className="block h-2 w-2 rounded-full animate-live-blink"
              style={{
                background: b.visited
                  ? "oklch(0.87 0.22 150)"
                  : "oklch(0.7 0.16 300)",
                boxShadow: `0 0 10px ${b.visited ? "oklch(0.87 0.22 150)" : "oklch(0.7 0.16 300)"}`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
          </div>
        ))}

        {/* Center breathing core */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {activeVisit && (
            <>
              <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[oklch(0.87_0.22_150/0.4)] [animation:ping-ring_2.6s_ease-out_infinite]" />
              <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[oklch(0.87_0.22_150/0.4)] [animation:ping-ring_2.6s_ease-out_infinite_1.3s]" />
            </>
          )}
          <div className="animate-breathe flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,oklch(0.9_0.14_195),oklch(0.6_0.16_240))] shadow-[0_0_50px_-4px_oklch(0.82_0.15_200/0.9),inset_0_2px_10px_oklch(1_0_0/0.4)]">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[oklch(0.17_0.03_256/0.8)]">
              {activeVisit ? "On site" : "Idle"}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-[oklch(0.17_0.03_256)]">
              {activeVisit ? formatElapsed(elapsed) : "00:00:00"}
            </span>
          </div>
        </div>
      </div>

      {/* Status text below radar */}
      <div className="mt-6 text-center">
        {activeVisit ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-neon)] animate-live-blink" />
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-neon)]">
                Geofence locked
              </span>
            </div>
            <h1 className="mt-2 text-[var(--color-on-surface)] text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {activeVisit.branchName}
            </h1>
            {activeVisit.branchAddress && (
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{activeVisit.branchAddress}</p>
            )}
          </>
        ) : (
          <h1 className="text-[var(--color-on-surface)] text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Scanning…
          </h1>
        )}
        <p className="mt-3 font-mono text-xs tracking-wide text-[oklch(0.82_0.15_200/0.7)] transition-opacity">
          {phrase}
        </p>
      </div>
    </section>
  );
}
