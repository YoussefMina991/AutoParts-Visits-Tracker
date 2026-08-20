import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getDistanceMeters } from "../../../shared/utils";
import { AmbientStatusBar } from "@/components/AmbientStatusBar";
import { useGeofenceContext } from "@/App";

export default function BranchCheckIn() {
  const [view, setView] = useState<"list" | "map">("list");

  // ✅ Reuse the single GPS watcher from GeofenceContext — no duplicate watchPosition
  const { latestLocation } = useGeofenceContext();
  const gpsLocation = latestLocation ? { lat: latestLocation.lat, lon: latestLocation.lon } : null;
  const globalMockedStatus  = latestLocation?.isMocked      ?? false;

  const { data: assignedBranches = [] } = trpc.manager.getMyBranches.useQuery();
  const { data: visitsData, refetch: refetchVisits } = trpc.visit.myHistory.useQuery({ limit: 5, offset: 0 });
  const activeVisit = visitsData?.items?.find((v: any) => v.status === "checked_in") ?? null;
  const checkInMutation = trpc.visit.checkIn.useMutation();
  const checkOutMutation = trpc.visit.checkOut.useMutation();

  const branchesWithDistance = (assignedBranches as any[]).map((b) => {
    const dist = gpsLocation
      ? getDistanceMeters(gpsLocation.lat, gpsLocation.lon, parseFloat(b.latitude), parseFloat(b.longitude))
      : Infinity;
    return { ...b, distanceM: dist, status: activeVisit?.branchId === b.id ? "visited" : "pending" };
  });

  const sortedBranches = [...branchesWithDistance].sort((a, b) => a.distanceM - b.distanceM);
  const closestBranch = sortedBranches[0];

  const handleManualCheckIn = async (branchId: number) => {
    if (!gpsLocation) return toast.error("جاري تحديد الموقع...");
    try {
      await checkInMutation.mutateAsync({
        branchId,
        latitude: gpsLocation.lat.toString(),
        longitude: gpsLocation.lon.toString(),
        isMocked: globalMockedStatus,
      });
      toast.success(`✅ تسجيل دخول ناجح في ${sortedBranches.find(b=>b.id===branchId)?.name ?? "الفرع"}`);
      refetchVisits();
    } catch (err: any) {
      toast.error(`❌ فشل الدخول: ${err.message || String(err)}`);
    }
  };

  const handleManualCheckOut = async () => {
    if (!activeVisit) return;
    try {
      await checkOutMutation.mutateAsync({ visitId: activeVisit.id });
      toast.success("🔴 تسجيل خروج يدوي ناجح!");
      refetchVisits();
    } catch (err: any) {
      toast.error(`❌ فشل الخروج: ${err.message || String(err)}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0b1326] text-[oklch(0.96_0.008_250)]">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
        style={{
          backgroundImage: [
            "radial-gradient(60rem 40rem at 15% -10%, oklch(0.82 0.15 200 / 0.1), transparent 60%)",
            "radial-gradient(50rem 40rem at 100% 0%, oklch(0.7 0.16 300 / 0.09), transparent 55%)",
          ].join(", "),
          backgroundAttachment: "fixed",
        }}
      />
      <AmbientStatusBar />

      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Assigned Branches
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {assignedBranches.length} locations · live distances
            </p>
          </div>
        </div>

        {/* toggle */}
        <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-[oklch(0.82_0.15_200)] text-[oklch(0.17_0.03_256)] shadow-lg shadow-[oklch(0.82_0.15_200/0.2)]"
                : "text-[var(--color-muted-foreground)]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">list</span> List View
          </button>
          <button
            type="button"
            onClick={() => setView("map")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              view === "map"
                ? "bg-[oklch(0.82_0.15_200)] text-[oklch(0.17_0.03_256)] shadow-lg shadow-[oklch(0.82_0.15_200/0.2)]"
                : "text-[var(--color-muted-foreground)]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">map</span> Map View
          </button>
        </div>

        {/* GPS status indicator - neutral, no mock hint */}
        {gpsLocation && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[oklch(0.82_0.15_200/0.08)] border border-[oklch(0.82_0.15_200/0.15)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-neon)] opacity-60 animate-live-blink" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-neon)]" />
            </span>
            <p className="text-[oklch(0.82_0.15_200)] text-xs font-medium">GPS نشط — دقة التحديد جيدة</p>
          </div>
        )}

        {/* Manual Check-In/Out Controls (Fallback/Debug) */}
        <div className="glass rounded-2xl p-4 flex flex-col gap-3 mt-2 mb-4">
          <p className="text-sm text-[var(--color-muted-foreground)]">تسجيل الدخول اليدوي</p>
          {activeVisit ? (
            <button
              onClick={handleManualCheckOut}
              disabled={checkOutMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-3 text-red-400 font-medium active:scale-95"
            >
              <span className="material-symbols-outlined">logout</span>
              {checkOutMutation.isPending ? "جاري الخروج..." : "تسجيل الخروج الآن"}
            </button>
          ) : (
            <button
              onClick={() => closestBranch && handleManualCheckIn(closestBranch.id)}
              disabled={!closestBranch || checkInMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[oklch(0.82_0.15_200/0.2)] px-4 py-3 text-[oklch(0.82_0.15_200)] font-medium active:scale-95"
            >
              <span className="material-symbols-outlined">login</span>
              {checkInMutation.isPending ? "جاري الدخول..." : (closestBranch ? `تسجيل الدخول: ${closestBranch.name}` : "لا يوجد فروع")}
            </button>
          )}
        </div>

        {view === "list" ? (
          <ul className="flex flex-col gap-2.5">
            {sortedBranches.map((b) => (
              <li key={b.id} className="glass flex items-center gap-3.5 rounded-2xl p-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    b.status === "visited"
                      ? "bg-[oklch(0.82_0.15_200/0.15)] text-[oklch(0.82_0.15_200)]"
                      : "bg-[oklch(0.27_0.035_256/0.6)] text-[var(--color-muted-foreground)]"
                  }`}
                >
                  <span className="material-symbols-outlined">location_on</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="truncate text-xs text-[var(--color-muted-foreground)]">{b.address}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="flex items-center gap-1 font-mono text-sm">
                    <span className="material-symbols-outlined text-[14px] text-[oklch(0.82_0.15_200)]">navigation</span>
                    {b.distanceM === Infinity
                      ? "-- m"
                      : b.distanceM < 1000
                      ? `${Math.round(b.distanceM)} m`
                      : `${(b.distanceM / 1000).toFixed(1)} km`}
                  </span>
                  {b.status === "visited" ? (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--color-neon)]">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span> Visited
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)]">
                      <span className="material-symbols-outlined text-[12px]">radio_button_unchecked</span> Pending
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="glass relative aspect-square w-full overflow-hidden rounded-3xl p-4">
            {/* grid rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              {[0.95, 0.72, 0.48, 0.24].map((r) => (
                <span
                  key={r}
                  className="absolute rounded-full border border-[oklch(0.82_0.15_200/0.15)]"
                  style={{ width: `${r * 100}%`, height: `${r * 100}%` }}
                />
              ))}
              {/* crosshairs */}
              <span className="absolute h-px w-full bg-[oklch(0.82_0.15_200/0.1)]" />
              <span className="absolute h-full w-px bg-[oklch(0.82_0.15_200/0.1)]" />
              {/* sweep */}
              <span
                className="absolute h-[95%] w-[95%] rounded-full animate-radar-sweep"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, transparent 310deg, oklch(0.82 0.15 200) 360deg)",
                  maskImage: "radial-gradient(circle, transparent 8%, black 9%)",
                  WebkitMaskImage: "radial-gradient(circle, transparent 8%, black 9%)",
                  opacity: 0.3,
                }}
              />
            </div>

            {/* center = you */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping-ring rounded-full bg-[var(--color-neon)] opacity-60" />
                <span className="relative h-3 w-3 rounded-full bg-[var(--color-neon)] shadow-[0_0_12px_3px_var(--color-neon)]" />
              </span>
            </div>

            {/* branch blips */}
            {sortedBranches.slice(0, 5).map((b, i) => {
              const angle = (i / 5) * 360 + 45; // pseudo angle
              const radius = Math.min((b.distanceM / 5000) * 0.9, 0.9); // max out at 90%
              const rad = (angle * Math.PI) / 180;
              const x = 50 + Math.cos(rad) * radius * 46;
              const y = 50 + Math.sin(rad) * radius * 46;
              return (
                <div
                  key={b.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      b.status === "visited"
                        ? "border-[var(--color-neon)]/40 bg-[var(--color-neon)]/20 text-[var(--color-neon)]"
                        : "border-[oklch(0.82_0.15_200)]/40 bg-[oklch(0.82_0.15_200)]/20 text-[oklch(0.82_0.15_200)]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                  </span>
                  <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[oklch(0.17_0.028_256/0.7)] px-1.5 py-0.5 text-[9px] text-[oklch(0.96_0.008_250)]">
                    {b.name.split(" ")[0]}
                  </span>
                </div>
              );
            })}

            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[oklch(0.17_0.028_256/0.6)] px-2.5 py-1 text-[10px] text-[var(--color-muted-foreground)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-neon)] animate-live-blink" /> You · live GPS
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
