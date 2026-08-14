import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function SignalBars() {
  return (
    <div className="flex items-end gap-0.5" aria-hidden="true">
      {[3, 5, 7, 9].map((h, i) => (
        <span
          key={h}
          className="w-1 rounded-full bg-[oklch(0.82_0.15_200)]"
          style={{
            height: h,
            opacity: i === 3 ? 0.4 : 1,
            boxShadow: "0 0 6px oklch(0.82 0.15 200 / 0.8)",
          }}
        />
      ))}
    </div>
  );
}

export function AmbientStatusBar() {
  const now = useClock();
  const { user } = useAuth();
  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";

  return (
    <header className="sticky top-0 z-30 w-full px-4 pt-4">
      <div className="glass flex items-center justify-between rounded-full px-4 py-2.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
        {/* Left: live dot + label */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-neon)] opacity-60 animate-live-blink" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-neon)] shadow-[0_0_10px_oklch(0.87_0.22_150)]" />
          </span>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-neon)]">
            Autonomous
          </span>
        </div>

        {/* Center: clock */}
        <span className="font-mono text-sm font-semibold tabular-nums text-[oklch(0.96_0.008_250)]">
          {time}
        </span>

        {/* Right: signal + user initial */}
        <div className="flex items-center gap-2">
          <SignalBars />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            {user?.name?.split(" ")[0] ?? "GPS"}
          </span>
        </div>
      </div>
    </header>
  );
}
