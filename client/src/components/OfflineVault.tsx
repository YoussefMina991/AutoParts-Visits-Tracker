import { useEffect, useState } from "react";
import localforage from "localforage";

// ─── Offline stores (same as useGeofence.ts) ─────────────────────────────────
const locationStore = localforage.createInstance({
  name: "branch-tracker",
  storeName: "offline_locations",
});

const visitStore = localforage.createInstance({
  name: "branch-tracker",
  storeName: "offline_visits",
});

interface PendingVisit {
  type: "check_in" | "check_out";
  branchName: string;
  checkInAt?: string;
  checkOutAt?: string;
  localId?: string;
  localCheckInId?: string;
}

interface PendingLocation {
  latitude: string;
  longitude: string;
  timestamp: string;
}

interface VaultItem {
  id: string;
  type: "check-in" | "check-out" | "gps";
  branchName: string;
  recordedAt: string;
  payloadCount?: number;
}

function VaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 12v3" strokeLinecap="round" />
    </svg>
  );
}

export function OfflineVault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [gpsPoints, setGpsPoints] = useState(0);

  useEffect(() => {
    async function load() {
      const visits = (await visitStore.getItem<PendingVisit[]>("queue")) || [];
      const locs = (await locationStore.getItem<PendingLocation[]>("queue")) || [];

      const vaultItems: VaultItem[] = visits.map((v, i) => ({
        id: `v${i}`,
        type: v.type === "check_in" ? "check-in" : "check-out",
        branchName: v.branchName,
        recordedAt: v.type === "check_in" ? v.checkInAt ?? "" : v.checkOutAt ?? "",
      }));

      if (locs.length > 0) {
        vaultItems.push({
          id: "gps",
          type: "gps",
          branchName: "GPS trail",
          recordedAt: locs.length > 0 ? locs[0].timestamp.slice(11, 16) : "",
          payloadCount: locs.length,
        });
      }

      setItems(vaultItems);
      setGpsPoints(locs.length);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) {
    return (
      <section className="w-full px-4 mt-4 pb-4" aria-label="Offline vault">
        <div className="rounded-3xl border border-[var(--color-glass-border)] bg-[oklch(0.27_0.035_256/0.3)] p-6 text-center">
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--color-neon)]">
            All synced ✓
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            No pending offline data
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full px-4 mt-4 pb-4" aria-label="Offline data vault">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--color-glass-border)] bg-[radial-gradient(120%_120%_at_50%_0%,oklch(0.7_0.16_300/0.14),transparent_60%)] p-6">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[oklch(0.7_0.16_300/0.2)] blur-3xl" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="animate-float-soft flex h-12 w-12 items-center justify-center rounded-2xl bg-[oklch(0.7_0.16_300/0.15)] text-[oklch(0.7_0.16_300)] shadow-[0_0_24px_-6px_oklch(0.7_0.16_300/0.9)]">
              <VaultIcon />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[oklch(0.7_0.16_300/0.8)]">
                Secure vault
              </p>
              <h2 className="text-lg font-semibold leading-tight text-[oklch(0.96_0.008_250)]" style={{ fontFamily: "var(--font-display)" }}>
                Safely stored offline
              </h2>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[oklch(0.27_0.035_256/0.7)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted-foreground)]/60" />
            Queued
          </span>
        </div>

        <p className="relative mt-4 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {items.filter((i) => i.type !== "gps").length} events
          {gpsPoints > 0 && ` and ${gpsPoints.toLocaleString()} GPS points`}{" "}
          are stored on your device. They'll sync automatically when you're back online.
        </p>

        {/* Items */}
        <ul className="relative mt-5 flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={item.id}
              className="animate-float-soft flex items-center gap-3 rounded-2xl bg-[oklch(0.22_0.03_256/0.6)] px-3.5 py-2.5"
              style={{ animationDelay: `${i * 0.6}s`, animationDuration: "5s" }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[oklch(0.7_0.16_300/0.1)] font-mono text-[10px] font-semibold uppercase text-[oklch(0.7_0.16_300)]">
                {item.type === "gps" ? "GPS" : item.type === "check-in" ? "IN" : "OUT"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[oklch(0.96_0.008_250)]">
                  {item.type === "check-in" ? "Check-in" : item.type === "check-out" ? "Check-out" : "GPS trail"}
                </p>
                <p className="truncate text-xs text-[var(--color-muted-foreground)]">{item.branchName}</p>
              </div>
              <div className="text-right">
                {item.payloadCount && (
                  <p className="font-mono text-[10px] text-[oklch(0.7_0.16_300/0.8)]">{item.payloadCount} pts</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Auto-sync bar */}
        <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-[oklch(0.27_0.035_256/0.5)] px-4 py-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[oklch(0_0_0/0.3)]">
            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-[oklch(0.7_0.16_300)] to-[oklch(0.82_0.15_200)] [animation:shimmer_2.4s_ease-in-out_infinite]" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Auto-sync armed
          </span>
        </div>
      </div>
    </section>
  );
}
