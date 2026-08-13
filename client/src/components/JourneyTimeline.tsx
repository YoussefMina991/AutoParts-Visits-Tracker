import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

// ─── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({ value, target }: { value: number; target: number }) {
  const pct = Math.min(value / Math.max(target, 1), 1);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ filter: "drop-shadow(0 0 6px oklch(0.87 0.22 150 / 0.8))" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.15 200)" />
            <stop offset="100%" stopColor="oklch(0.87 0.22 150)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold leading-none tabular-nums text-[oklch(0.96_0.008_250)]" style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </span>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          of {target} stops
        </span>
      </div>
    </div>
  );
}

// ─── Timeline Node ────────────────────────────────────────────────────────────
function Node({ status, synced, last }: { status: "done" | "live" | "upcoming"; synced: boolean; last: boolean }) {
  return (
    <div className="relative flex flex-col items-center" aria-hidden="true">
      {status === "live" ? (
        <span className="relative flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-neon)] opacity-60 [animation:ping-ring_2s_ease-out_infinite]" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-[var(--color-neon)] shadow-[0_0_12px_oklch(0.87_0.22_150)]" />
        </span>
      ) : status === "done" ? (
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full"
          style={{
            background: synced ? "oklch(0.82 0.15 200)" : "oklch(0.7 0.16 300)",
            boxShadow: `0 0 10px ${synced ? "oklch(0.82 0.15 200 / 0.7)" : "oklch(0.7 0.16 300 / 0.7)"}`,
          }}
        >
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="oklch(0.17 0.03 256)" strokeWidth="4">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <span className="h-4 w-4 rounded-full border-2 border-dashed border-[oklch(0.68_0.03_256/0.4)]" />
      )}
      {!last && (
        <span
          className="mt-1 w-[2px] flex-1"
          style={{
            minHeight: 44,
            background:
              status === "upcoming"
                ? "repeating-linear-gradient(to bottom, oklch(0.68 0.03 256 / 0.35) 0 4px, transparent 4px 9px)"
                : "linear-gradient(to bottom, oklch(0.82 0.15 200 / 0.7), oklch(0.87 0.22 150 / 0.4))",
          }}
        />
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function JourneyTimeline() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: visitsData, isLoading } = trpc.visit.myHistory.useQuery({ limit: 20, offset: 0 });
  const visits = visitsData?.items ?? [];

  const todayVisits = visits.filter((v) => new Date(v.checkInAt) >= today);
  const activeVisit = visits[0]?.status === "checked_in" ? visits[0] : null;
  const completedToday = todayVisits.filter((v) => v.status === "checked_out").length;
  const target = 9; // default target

  const totalDistanceKm = todayVisits.reduce((acc, v) => {
    return acc + (Number(v.distanceToPrevBranchKm) || 0);
  }, 0);

  if (isLoading) {
    return (
      <section className="w-full px-4 mt-4">
        <div className="glass rounded-3xl p-5 flex items-center justify-center h-36">
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] animate-pulse">
            Loading journey…
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full mt-4 px-4 pb-4" aria-label="Today's journey">
      {/* Header with progress ring */}
      <div className="glass flex items-center gap-5 rounded-3xl p-5">
        <ProgressRing value={completedToday} target={target} />
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[oklch(0.82_0.15_200/0.7)]">
              Today's route
            </p>
            <h2 className="text-xl font-semibold leading-tight text-[oklch(0.96_0.008_250)]" style={{ fontFamily: "var(--font-display)" }}>
              {completedToday > 0 ? "You're on a roll" : "Ready to go!"}
            </h2>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-2xl bg-[oklch(0.27_0.035_256/0.6)] px-3 py-2">
              <p className="font-mono text-lg font-bold tabular-nums text-[var(--color-neon)]">
                {totalDistanceKm.toFixed(1)}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">km today</p>
            </div>
            <div className="flex-1 rounded-2xl bg-[oklch(0.27_0.035_256/0.6)] px-3 py-2">
              <p className="font-mono text-lg font-bold tabular-nums text-[oklch(0.7_0.16_300)]">
                {Math.max(0, target - completedToday)}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">to go</p>
            </div>
          </div>
        </div>
      </div>

      {/* Luminous thread */}
      {todayVisits.length === 0 && !activeVisit ? (
        <div className="mt-4 text-center py-8">
          <p className="font-mono text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">
            No visits recorded today
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            The app is scanning for nearby branches…
          </p>
        </div>
      ) : (
        <ol className="mt-5 flex flex-col">
          {todayVisits.map((visit, i) => {
            const isLive = visit.status === "checked_in";
            const status = isLive ? "live" : "done";
            return (
              <li key={visit.id} className="flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  <Node status={status} synced={true} last={i === todayVisits.length - 1} />
                </div>
                <div className={`flex-1 pb-5`}>
                  <div
                    className={`rounded-2xl border px-4 py-3 ${
                      isLive
                        ? "glass border-[oklch(0.87_0.22_150/0.3)] shadow-[0_0_24px_-8px_oklch(0.87_0.22_150/0.8)]"
                        : "border-transparent bg-[oklch(0.22_0.03_256/0.5)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium leading-tight text-[oklch(0.96_0.008_250)]">{visit.branchName}</h3>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-muted-foreground)]">
                        {format(new Date(visit.checkInAt), "HH:mm")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                      {visit.checkOutAt && (
                        <span>
                          {Math.round((new Date(visit.checkOutAt).getTime() - new Date(visit.checkInAt).getTime()) / 60000)} min dwell
                        </span>
                      )}
                      {isLive && (
                        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-neon)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-neon)] animate-live-blink" />
                          here now
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
