import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { useLocation } from "wouter";

// ─── Design tokens ────────────────────────────────────────────────────────────
// bg:        #F4F4F5   surface:   #FFFFFF   border:    #E4E4E7
// text-1:    #18181B   text-2:    #71717A   text-3:    #A1A1AA
// accent:    #18181B   green:     #16A34A   red:       #DC2626
// amber:     #D97706   radius-sm: 12px      radius-md: 16px
// font:      Inter, -apple-system, sans-serif

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, size = 36 }: { name?: string; photoUrl?: string | null; size?: number }) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size / 2,
    flexShrink: 0,
    objectFit: "cover" as const,
  };
  if (photoUrl) return <img src={photoUrl} alt={name} style={style} />;
  return (
    <div
      style={{
        ...style,
        background: "#F4F4F5",
        border: "1px solid #E4E4E7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "#71717A",
      }}
    >
      {name?.charAt(0) || "?"}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "linear-gradient(90deg, #F4F4F5 25%, #EBEBEB 50%, #F4F4F5 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, iconColor, valueColor = "#18181B", loading,
}: {
  label: string; value: string | number; icon: string;
  iconColor: string; valueColor?: string; loading?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E4E7",
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#A1A1AA", textTransform: "uppercase", marginBottom: 8 }}>
          {label}
        </p>
        {loading ? (
          <Skeleton w={60} h={32} r={6} />
        ) : (
          <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: valueColor, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </p>
        )}
      </div>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: iconColor + "18",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 20, color: iconColor, fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, badge, action }: {
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#18181B" }}>{title}</p>
        {badge}
      </div>
      {action}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E4E7",
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Active Manager Card (horizontal scroll) ──────────────────────────────────
function ActiveManagerCard({ m }: { m: any }) {
  const checkinTime = m.location?.timestamp
    ? (() => {
        const diff = Math.round((Date.now() - new Date(m.location.timestamp).getTime()) / 60000);
        if (diff < 1) return "Just now";
        if (diff < 60) return `${diff}m ago`;
        return `${Math.floor(diff / 60)}h ago`;
      })()
    : null;

  return (
    <div
      style={{
        minWidth: 200,
        background: "#fff",
        border: "1px solid #E4E4E7",
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Avatar name={m.userName} photoUrl={m.photoUrl} size={36} />
          <span
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#22C55E",
              border: "2px solid #fff",
            }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#18181B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.userName}
          </p>
          <p style={{ fontSize: 11, color: "#A1A1AA", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.branchName || "Unassigned"}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #F4F4F5" }}>
        <div>
          <p style={{ fontSize: 10, color: "#A1A1AA", fontWeight: 600 }}>Last check-in</p>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#18181B", marginTop: 2 }}>{checkinTime || "—"}</p>
        </div>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 700,
            background: "#F0FDF4",
            color: "#16A34A",
            border: "1px solid #BBF7D0",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
          Active
        </span>
      </div>
    </div>
  );
}

// ─── Activity Feed Row ────────────────────────────────────────────────────────
function FeedRow({ v, isLast }: { v: any; isLast?: boolean }) {
  const checkin = new Date(v.checkInAt);
  const checkout = v.checkOutAt ? new Date(v.checkOutAt) : null;
  const dur = checkout ? Math.round((checkout.getTime() - checkin.getTime()) / 60000) : null;
  const open = !v.checkOutAt;
  const flagged = v.isMocked === "yes";

  const timeAgo = (() => {
    const diff = Math.round((Date.now() - checkin.getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return format(checkin, "MMM d");
  })();

  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: isLast ? "none" : "1px solid #F4F4F5" }}>
      <Avatar name={v.managerName} photoUrl={v.managerPhotoUrl} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#18181B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {v.managerName}
          </p>
          <span style={{ fontSize: 10, color: "#A1A1AA", fontWeight: 500, flexShrink: 0 }}>{timeAgo}</span>
        </div>
        <p style={{ fontSize: 11, color: "#71717A", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {v.branchName}{dur ? ` · ${dur}m` : ""}
        </p>
        <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
          {open && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
              In Progress
            </span>
          )}
          {!open && !flagged && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
              Check-out
            </span>
          )}
          {flagged && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
              Spoofed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Branch Progress Row ──────────────────────────────────────────────────────
function BranchProgressRow({ name, count, total }: { name: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#18181B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
          {name}
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#71717A", flexShrink: 0 }}>{count} visits</p>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: "#F4F4F5", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 99,
            background: "#18181B",
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────
function WeeklyBarChart({ visits }: { visits: any[] }) {
  const now = new Date();
  // Saturday as start of Egyptian work week
  const weekStart = startOfWeek(now, { weekStartsOn: 6 });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      label: format(date, "EEE"),
      dateStr: format(date, "yyyy-MM-dd"),
      isToday: format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd"),
      isFuture: date > now,
    };
  });

  const countByDay: Record<string, number> = {};
  visits.forEach((v) => {
    const d = format(new Date(v.checkInAt), "yyyy-MM-dd");
    countByDay[d] = (countByDay[d] || 0) + 1;
  });

  const maxCount = Math.max(...days.map((d) => countByDay[d.dateStr] || 0), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
      {days.map((day) => {
        const count = countByDay[day.dateStr] || 0;
        const heightPct = day.isFuture ? 0 : Math.max(count / maxCount, count > 0 ? 0.08 : 0);
        return (
          <div
            key={day.dateStr}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, color: day.isFuture ? "#E4E4E7" : "#71717A" }}>
              {count > 0 ? count : ""}
            </p>
            <div style={{ width: "100%", height: 52, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: `${heightPct * 100}%`,
                  minHeight: count > 0 ? 4 : 0,
                  borderRadius: "6px 6px 4px 4px",
                  background: day.isToday ? "#18181B" : day.isFuture ? "#F4F4F5" : "#D4D4D8",
                  transition: "height 0.4s ease",
                }}
              />
            </div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: day.isToday ? "#18181B" : "#A1A1AA",
                textAlign: "center",
              }}
            >
              {day.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "28px 0" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#D4D4D8", fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
      <p style={{ fontSize: 12, color: "#A1A1AA", fontWeight: 500 }}>{text}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  // ── week range for weekly chart (Saturday → Friday)
  const weekStart = startOfWeek(now, { weekStartsOn: 6 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: branches = [], isLoading: lb } = trpc.branch.list.useQuery();
  const { data: managers = [], isLoading: lm } = trpc.manager.list.useQuery();
  const { data: visitsData, isLoading: lv } = trpc.visit.adminList.useQuery(
    { startDate: todayStr, endDate: todayStr, limit: 50, offset: 0 },
    { refetchInterval: 30000 }
  );
  const { data: liveLocations = [], isLoading: ll } = trpc.manager.getLiveLocations.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  const { data: weekVisitsData, isLoading: lw } = trpc.visit.adminList.useQuery(
    { startDate: weekStartStr, endDate: weekEndStr, limit: 500, offset: 0 },
    { refetchInterval: 60000 }
  );

  const visits = (visitsData?.items ?? []) as any[];
  const weekVisits = (weekVisitsData?.items ?? []) as any[];
  const mockedCount = visits.filter((v: any) => v.isMocked === "yes").length;
  const activeManagers = liveLocations.filter((m: any) => m.location !== null);

  // branch visit distribution
  const branchVisitMap: Record<string, { name: string; count: number }> = {};
  visits.forEach((v: any) => {
    if (!branchVisitMap[v.branchId]) branchVisitMap[v.branchId] = { name: v.branchName, count: 0 };
    branchVisitMap[v.branchId].count++;
  });
  const branchVisitList = Object.values(branchVisitMap).sort((a, b) => b.count - a.count);
  const visitedBranchIds = new Set(visits.map((v: any) => v.branchId));
  const unvisitedBranches = branches.filter((b: any) => !visitedBranchIds.has(b.id));

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    fontFamily: "inherit",
    transition: "opacity .15s",
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "Inter, -apple-system, sans-serif" }}>

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #F4F4F5",
            flexShrink: 0,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#18181B", margin: 0 }}>Branch Visit Overview</h1>
            <p style={{ fontSize: 12, color: "#A1A1AA", fontWeight: 500, margin: "4px 0 0" }}>
              {format(now, "EEEE, MMMM d yyyy")}&nbsp;·&nbsp;
              {ll ? "—" : `${activeManagers.length} manager${activeManagers.length !== 1 ? "s" : ""} active`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setLocation("/reports")}
              style={{ ...btnBase, background: "#F4F4F5", color: "#71717A", border: "1px solid #E4E4E7" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
              Export
            </button>
            <button
              onClick={() => setLocation("/live-map")}
              style={{ ...btnBase, background: "#18181B", color: "#fff" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>sensors</span>
              Live Tracking
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", scrollbarWidth: "none" as const }}>

          {/* ── Zone 1: KPI Strip ─────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
              marginBottom: 20,
            }}
            className="kpi-grid"
          >
            <KpiCard
              label="Total Branches"
              value={lb ? "—" : branches.length}
              icon="account_tree"
              iconColor="#3B82F6"
              loading={lb}
            />
            <KpiCard
              label="Total Managers"
              value={lm ? "—" : managers.length}
              icon="badge"
              iconColor="#16A34A"
              loading={lm}
            />
            <KpiCard
              label="Today's Visits"
              value={lv ? "—" : visits.length}
              icon="map"
              iconColor="#71717A"
              loading={lv}
            />
            <KpiCard
              label="Spoofed Today"
              value={lv ? "—" : mockedCount}
              icon="warning"
              iconColor="#DC2626"
              valueColor={mockedCount > 0 ? "#DC2626" : "#18181B"}
              loading={lv}
            />
          </div>

          {/* ── Zone 2: Two-column middle ─────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "3fr 2fr",
              gap: 16,
              marginBottom: 20,
              alignItems: "start",
            }}
            className="main-grid"
          >

            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

              {/* Active Managers now */}
              <div>
                <SectionHeader
                  title="Active Managers Now"
                  badge={
                    !ll && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
                        {activeManagers.length} online
                      </span>
                    )
                  }
                  action={
                    <button
                      onClick={() => setLocation("/managers")}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#A1A1AA", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                    >
                      View all
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
                    </button>
                  }
                />
                {ll ? (
                  <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" as const }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ minWidth: 200, background: "#fff", border: "1px solid #E4E4E7", borderRadius: 14, padding: 16, flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                          <Skeleton w={36} h={36} r={18} />
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                            <Skeleton h={13} r={4} />
                            <Skeleton w="60%" h={11} r={4} />
                          </div>
                        </div>
                        <Skeleton h={5} r={99} />
                      </div>
                    ))}
                  </div>
                ) : activeManagers.length === 0 ? (
                  <Panel>
                    <Empty icon="person_off" text="No managers are active right now" />
                  </Panel>
                ) : (
                  <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" as const }}>
                    {activeManagers.map((m: any) => <ActiveManagerCard key={m.id} m={m} />)}
                  </div>
                )}
              </div>

              {/* Activity Feed */}
              <Panel>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F4F4F5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#18181B" }}>Activity Feed</p>
                  {!lv && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F4F4F5", color: "#71717A" }}>
                      {visits.length} today
                    </span>
                  )}
                </div>
                <div style={{ padding: "0 16px", maxHeight: 360, overflowY: "auto", scrollbarWidth: "none" as const }}>
                  {lv ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #F4F4F5" }}>
                        <Skeleton w={32} h={32} r={16} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                          <Skeleton h={12} r={4} />
                          <Skeleton w="55%" h={11} r={4} />
                          <Skeleton w="30%" h={18} r={9} />
                        </div>
                      </div>
                    ))
                  ) : visits.length === 0 ? (
                    <Empty icon="event_busy" text="No visits recorded today" />
                  ) : (
                    visits.slice(0, 10).map((v: any, idx: number) => (
                      <FeedRow key={v.id} v={v} isLast={idx === Math.min(visits.length, 10) - 1} />
                    ))
                  )}
                </div>
              </Panel>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

              {/* Branch Visit Distribution */}
              <Panel>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F4F4F5" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#18181B" }}>Visits by Branch</p>
                </div>
                <div style={{ padding: "14px 16px", maxHeight: 300, overflowY: "auto", scrollbarWidth: "none" as const }}>
                  {lv ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <Skeleton w="60%" h={12} r={4} />
                          <Skeleton w={40} h={12} r={4} />
                        </div>
                        <Skeleton h={5} r={99} />
                      </div>
                    ))
                  ) : branchVisitList.length === 0 ? (
                    <Empty icon="bar_chart" text="No visits to display" />
                  ) : (
                    branchVisitList.map((b) => (
                      <BranchProgressRow key={b.name} name={b.name} count={b.count} total={visits.length} />
                    ))
                  )}
                </div>

                {/* Unvisited branches */}
                {!lv && unvisitedBranches.length > 0 && (
                  <>
                    <div style={{ borderTop: "1px solid #F4F4F5", padding: "12px 16px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#A1A1AA", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                        Not Visited Today
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {unvisitedBranches.slice(0, 6).map((b: any) => (
                          <div
                            key={b.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "7px 10px",
                              borderRadius: 10,
                              background: "#FAFAFA",
                              border: "1px solid #F4F4F5",
                            }}
                          >
                            <p style={{ fontSize: 12, fontWeight: 600, color: "#71717A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                              {b.name}
                            </p>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F4F4F5", color: "#A1A1AA", flexShrink: 0 }}>
                              Not visited
                            </span>
                          </div>
                        ))}
                        {unvisitedBranches.length > 6 && (
                          <p style={{ fontSize: 11, color: "#A1A1AA", textAlign: "center", paddingTop: 4 }}>
                            +{unvisitedBranches.length - 6} more
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </Panel>
            </div>
          </div>

          {/* ── Zone 3: Weekly Summary full-width ────────────────────────── */}
          <Panel>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F4F4F5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#18181B" }}>This Week's Visits</p>
                <p style={{ fontSize: 11, color: "#A1A1AA", fontWeight: 500, marginTop: 2 }}>
                  {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
                </p>
              </div>
              {!lw && (
                <p style={{ fontSize: 22, fontWeight: 800, color: "#18181B" }}>
                  {weekVisits.length}
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginLeft: 6 }}>visits</span>
                </p>
              )}
            </div>
            <div style={{ padding: "20px 24px" }}>
              {lw ? (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80 }}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <Skeleton h={Math.random() * 40 + 10} r={4} />
                      <Skeleton h={10} r={3} />
                    </div>
                  ))}
                </div>
              ) : (
                <WeeklyBarChart visits={weekVisits} />
              )}
            </div>
          </Panel>

        </div>
      </div>

      {/* ── Responsive breakpoints ────────────────────────────────────────── */}
      <style>{`
        @media (min-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (max-width: 700px) {
          .main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
