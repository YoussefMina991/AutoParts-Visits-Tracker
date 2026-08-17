import { trpc } from "@/lib/trpc";
import { MapView, MapMarker, MapPolyline } from "@/components/Map";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import type { MapCenter } from "@/components/Map";

export default function AdminLiveTracking() {
  const [mode, setMode]             = useState<"live" | "history">("live");
  const [historyDate, setHistoryDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [selectedManager, setSelectedManager] = useState<number | null>(null);
  const [flyTo, setFlyTo]           = useState<MapCenter | null>(null);

  const { data: managers = [], isLoading } = trpc.manager.getLiveLocations.useQuery(
    undefined,
    { refetchInterval: mode === "live" ? 10000 : false }
  );

  const { data: routeHistory = [], isLoading: historyLoading } =
    trpc.manager.getRouteHistory.useQuery(
      { managerId: selectedManager!, date: historyDate },
      { enabled: mode === "history" && selectedManager !== null }
    );

  useEffect(() => {
    if (mode === "history" && routeHistory.length > 0)
      setFlyTo({ lat: parseFloat(routeHistory[0].latitude), lng: parseFloat(routeHistory[0].longitude) });
  }, [routeHistory, mode]);

  const withLoc    = managers.filter((m) => m.location !== null);
  const withoutLoc = managers.filter((m) => m.location === null);

  // ── shared styles ──
  const chip = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all .15s",
    background: active ? "#18181B" : "transparent",
    color: active ? "#fff" : "#71717A",
    border: "none",
  });

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-[#E4E4E7] border-t-[#18181B] rounded-full" />
      </div>
    );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid #F4F4F5" }}
      >
        <div>
          <h1 className="text-[20px] font-bold text-[#18181B]">Live Tracking</h1>
          <p className="text-[12px] text-[#A1A1AA] mt-0.5 font-medium">
            {withLoc.length} active · {withoutLoc.length} offline
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div
            className="flex items-center p-1"
            style={{ background: "#F4F4F5", borderRadius: 12 }}
          >
            <button style={chip(mode === "live")} onClick={() => setMode("live")}>Live</button>
            <button style={chip(mode === "history")} onClick={() => setMode("history")}>History</button>
          </div>

          {mode === "history" && (
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="h-8 px-3 text-[12px] font-medium text-[#18181B] outline-none transition-colors"
              style={{
                background: "#fff",
                border: "1px solid #E4E4E7",
                borderRadius: 10,
              }}
            />
          )}

          {mode === "live" && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 10,
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
              </span>
              <span className="text-[11px] font-bold text-[#16A34A]">LIVE · 10s</span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">

          {/* Map */}
          <div
            className="lg:col-span-3 overflow-hidden relative"
            style={{ borderRadius: 16, border: "1px solid #E4E4E7", minHeight: 480 }}
          >
            <MapView
              initialZoom={6}
              initialCenter={{ lat: 30.0444, lng: 31.2357 }}
              flyTo={flyTo}
              flyToZoom={16}
              className="h-full w-full"
            >
              {mode === "live"
                ? withLoc.map((m) => (
                    <MapMarker
                      key={m.id}
                      lat={parseFloat(m.location!.latitude)}
                      lng={parseFloat(m.location!.longitude)}
                      label={m.userName || "Manager"}
                      color={selectedManager === m.id ? "#18181B" : "#22C55E"}
                      popupContent={`${m.userName} — ${formatDistanceToNow(
                        new Date(m.location!.timestamp),
                        { addSuffix: true, locale: ar }
                      )}`}
                      onClick={() => {
                        setSelectedManager(m.id);
                        setFlyTo({
                          lat: parseFloat(m.location!.latitude),
                          lng: parseFloat(m.location!.longitude),
                        });
                      }}
                    />
                  ))
                : selectedManager && routeHistory.length > 0 && (
                    <MapPolyline
                      positions={routeHistory.map(
                        (p) => [parseFloat(p.latitude), parseFloat(p.longitude)] as [number, number]
                      )}
                      color="#18181B"
                      weight={4}
                    />
                  )}
            </MapView>

            {/* Empty overlays */}
            {mode === "live" && withLoc.length === 0 && (
              <Overlay icon="location_off" title="No active locations" sub="Waiting for managers to open the app" />
            )}
            {mode === "history" && !selectedManager && (
              <Overlay icon="touch_app" title="Select a manager" sub="Choose from the list to view their route" />
            )}
            {mode === "history" && selectedManager && historyLoading && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center bg-white/80 backdrop-blur-sm">
                <div className="animate-spin w-7 h-7 border-2 border-[#E4E4E7] border-t-[#18181B] rounded-full" />
              </div>
            )}
            {mode === "history" && selectedManager && !historyLoading && routeHistory.length === 0 && (
              <Overlay icon="wrong_location" title="No route recorded" sub="This manager had no activity on this day" />
            )}
          </div>

          {/* Sidebar */}
          <div
            className="flex flex-col overflow-hidden"
            style={{
              background: "#fff",
              border: "1px solid #E4E4E7",
              borderRadius: 16,
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid #F4F4F5" }}
            >
              <p className="text-[13px] font-bold text-[#18181B]">Managers</p>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#F4F4F5", color: "#71717A" }}
              >
                {managers.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: "none" }}>
              {managers.length === 0 ? (
                <p className="text-[11px] text-[#A1A1AA] text-center py-10">No managers found</p>
              ) : (
                managers.map((m) => {
                  const hasLoc   = m.location !== null;
                  const selected = selectedManager === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        if (!hasLoc) return;
                        setSelectedManager(m.id);
                        setFlyTo({
                          lat: parseFloat(m.location!.latitude),
                          lng: parseFloat(m.location!.longitude),
                        });
                      }}
                      className="p-3 mb-0.5 rounded-xl transition-all"
                      style={{
                        cursor: hasLoc ? "pointer" : "default",
                        opacity: hasLoc ? 1 : 0.5,
                        background: selected ? "#F4F4F5" : "transparent",
                        border: `1px solid ${selected ? "#E4E4E7" : "transparent"}`,
                        borderRadius: 12,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: hasLoc ? "#22C55E" : "#A1A1AA",
                            boxShadow: hasLoc ? "0 0 5px #22C55E99" : "none",
                          }}
                        />
                        <span className="text-[12px] font-bold text-[#18181B] truncate">
                          {m.userName || "Manager"}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A1A1AA] pl-3.5">
                        {hasLoc
                          ? formatDistanceToNow(new Date(m.location!.timestamp), {
                              addSuffix: true,
                              locale: ar,
                            })
                          : "No location data"}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div
              className="px-4 py-3 shrink-0"
              style={{ borderTop: "1px solid #F4F4F5" }}
            >
              <p className="text-[10px] text-[#A1A1AA] leading-4">
                Location shown is the last known position, not necessarily real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Overlay helper ───────────────────────────────────────────────────────────
function Overlay({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <span
        className="material-symbols-outlined text-[#D4D4D8] mb-3"
        style={{ fontSize: 44, fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <p className="text-[13px] font-bold text-[#71717A]">{title}</p>
      <p className="text-[11px] text-[#A1A1AA] mt-1">{sub}</p>
    </div>
  );
}
