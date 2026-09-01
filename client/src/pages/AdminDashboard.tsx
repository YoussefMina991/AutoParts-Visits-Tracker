import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format, startOfWeek, addDays } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

// ─── Design tokens (CSS vars scoped to .admin-root, see index.css) ───────────
// bg: --adm-bg   surface: --adm-surface   border: --adm-border
// text: --adm-text-1/2/3   accent: --adm-accent (+ --adm-accent-fg)
// green: --adm-green   red: --adm-red   blue: --adm-blue   amber: --adm-amber

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
        background: "var(--adm-bg)",
        border: "1px solid var(--adm-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "var(--adm-text-2)",
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
        background: "linear-gradient(90deg, var(--adm-bg) 25%, var(--adm-border) 50%, var(--adm-bg) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, iconColor, valueColor, loading,
}: {
  label: string; value: string | number; icon: string;
  iconColor: string; valueColor?: string; loading?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--adm-surface)",
        border: "1px solid var(--adm-border)",
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--adm-text-3)", textTransform: "uppercase", marginBottom: 8 }}>
          {label}
        </p>
        {loading ? (
          <Skeleton w={60} h={32} r={6} />
        ) : (
          <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: valueColor ?? "var(--adm-text-1)", fontVariantNumeric: "tabular-nums" }}>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-1)" }}>{title}</p>
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
        background: "var(--adm-surface)",
        border: "1px solid var(--adm-border)",
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Manager Card (clickable → Reports pre-filtered) ──────────────────────────
function ManagerCard({ m, visitsToday }: { m: any; visitsToday: number }) {
  const { t, isRTL } = useLang();
  const online = m.location !== null;

  const checkinTime = m.location?.timestamp
    ? (() => {
        const diff = Math.round((Date.now() - new Date(m.location.timestamp).getTime()) / 60000);
        if (diff < 1) return t("time.now");
        if (diff < 60) return t("time.minAgo", { n: diff });
        if (diff < 1440) return t("time.hourAgo", { n: Math.floor(diff / 60) });
        return t("time.dayAgo", { n: Math.floor(diff / 1440) });
      })()
    : null;

  return (
    <Link href={`/reports?managerId=${m.id}`}>
      <a className="adm-manager-link" style={{ display: "block", height: "100%" }}>
        <div
          className="adm-card-hover"
          style={{
            background: "var(--adm-surface)",
            border: "1px solid var(--adm-border)",
            borderRadius: 16,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Top: avatar + identity + chevron */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Avatar name={m.userName} photoUrl={m.photoUrl} size={40} />
              {online && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    insetInlineEnd: 0,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: "var(--adm-online)",
                    border: "2px solid var(--adm-surface)",
                  }}
                />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.userName}
              </p>
              <p style={{ fontSize: 11, color: "var(--adm-text-3)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.branchName || t("dashboard.unassigned")}
              </p>
            </div>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, color: "var(--adm-text-3)", flexShrink: 0 }}
            >
              {isRTL ? "arrow_back" : "arrow_forward"}
            </span>
          </div>

          {/* Bottom: last check-in · visits today · status chip */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTop: "1px solid var(--adm-bg)" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 10, color: "var(--adm-text-3)", fontWeight: 600 }}>{t("dashboard.lastCheckin")}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-1)", marginTop: 2 }}>{checkinTime || "—"}</p>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 10, color: "var(--adm-text-3)", fontWeight: 600 }}>{t("dashboard.visitsToday")}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{visitsToday}</p>
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
                flexShrink: 0,
                background: online ? "var(--adm-green-soft)" : "var(--adm-chip)",
                color: online ? "var(--adm-green)" : "var(--adm-text-2)",
                border: `1px solid ${online ? "var(--adm-green-soft-border)" : "var(--adm-border)"}`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: online ? "var(--adm-online)" : "var(--adm-text-3)",
                  display: "inline-block",
                }}
              />
              {online ? t("dashboard.active") : t("dashboard.idle")}
            </span>
          </div>
        </div>
      </a>
    </Link>
  );
}

// ─── Activity Feed Row ────────────────────────────────────────────────────────
function FeedRow({ v, isLast }: { v: any; isLast?: boolean }) {
  const { t } = useLang();
  const checkin = new Date(v.checkInAt);
  const checkout = v.checkOutAt ? new Date(v.checkOutAt) : null;
  const dur = checkout ? Math.round((checkout.getTime() - checkin.getTime()) / 60000) : null;
  const open = !v.checkOutAt;
  const flagged = v.isMocked === "yes";

  const timeAgo = (() => {
    const diff = Math.round((Date.now() - checkin.getTime()) / 60000);
    if (diff < 1) return t("time.now");
    if (diff < 60) return t("time.minAgo", { n: diff });
    if (diff < 1440) return t("time.hourAgo", { n: Math.floor(diff / 60) });
    return format(checkin, "MMM d");
  })();

  const chipStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 20,
  };

  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: isLast ? "none" : "1px solid var(--adm-bg)" }}>
      <Avatar name={v.managerName} photoUrl={v.managerPhotoUrl} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {v.managerName}
          </p>
          <span style={{ fontSize: 10, color: "var(--adm-text-3)", fontWeight: 500, flexShrink: 0 }}>{timeAgo}</span>
        </div>
        <p style={{ fontSize: 11, color: "var(--adm-text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {v.branchName}{dur !== null ? ` · ${dur}${t("time.minShort")}` : ""}
        </p>
        <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
          {open && (
            <span style={{ ...chipStyle, background: "var(--adm-blue-soft)", color: "var(--adm-blue)", border: "1px solid var(--adm-blue-soft-border)" }}>
              {t("dashboard.inProgress")}
            </span>
          )}
          {!open && !flagged && (
            <span style={{ ...chipStyle, background: "var(--adm-green-soft)", color: "var(--adm-green)", border: "1px solid var(--adm-green-soft-border)" }}>
              {t("dashboard.checkout")}
            </span>
          )}
          {flagged && (
            <span style={{ ...chipStyle, background: "var(--adm-red-soft)", color: "var(--adm-red)", border: "1px solid var(--adm-red-soft-border)" }}>
              {t("dashboard.spoofed")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────
function WeeklyBarChart({ visits }: { visits: any[] }) {
  const { lang } = useLang();
  const locale = lang === "ar" ? arLocale : undefined;
  const now = new Date();
  // Saturday as start of Egyptian work week
  const weekStart = startOfWeek(now, { weekStartsOn: 6 });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      label: format(date, "EEE", { locale }),
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
            <p style={{ fontSize: 10, fontWeight: 700, color: day.isFuture ? "var(--adm-border)" : "var(--adm-text-2)" }}>
              {count > 0 ? count : ""}
            </p>
            <div style={{ width: "100%", height: 52, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: `${heightPct * 100}%`,
                  minHeight: count > 0 ? 4 : 0,
                  borderRadius: "6px 6px 4px 4px",
                  background: day.isToday ? "var(--adm-accent)" : day.isFuture ? "var(--adm-bg)" : "var(--adm-border)",
                  transition: "height 0.4s ease",
                }}
              />
            </div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: day.isToday ? "var(--adm-text-1)" : "var(--adm-text-3)",
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
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--adm-border)", fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
      <p style={{ fontSize: 12, color: "var(--adm-text-3)", fontWeight: 500 }}>{text}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, lang, isRTL } = useLang();
  const [, setLocation] = useLocation();
  const [weekManagerId, setWeekManagerId] = useState("");
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const dateLocale = lang === "ar" ? arLocale : undefined;

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
    {
      startDate: weekStartStr,
      endDate: weekEndStr,
      limit: 500,
      offset: 0,
      managerId: weekManagerId === "" ? undefined : Number(weekManagerId),
    },
    { refetchInterval: 60000 }
  );

  const visits = (visitsData?.items ?? []) as any[];
  const weekVisits = (weekVisitsData?.items ?? []) as any[];
  const mockedCount = visits.filter((v: any) => v.isMocked === "yes").length;
  const activeManagers = liveLocations.filter((m: any) => m.location !== null);

  // Per-manager "visits today" counts — match by managerEmail (unique),
  // fallback to managerName when email missing.
  const visitsByEmail = new Map<string, number>();
  const visitsByName = new Map<string, number>();
  visits.forEach((v: any) => {
    if (v.managerEmail) visitsByEmail.set(v.managerEmail, (visitsByEmail.get(v.managerEmail) ?? 0) + 1);
    if (v.managerName) visitsByName.set(v.managerName, (visitsByName.get(v.managerName) ?? 0) + 1);
  });
  const getVisitsToday = (m: any): number => {
    const byEmail = m.userEmail ? visitsByEmail.get(m.userEmail) : undefined;
    if (byEmail !== undefined) return byEmail;
    return (m.userName ? visitsByName.get(m.userName) : undefined) ?? 0;
  };

  const selectedWeekManager = (managers as any[]).find((m) => String(m.id) === weekManagerId);

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
            borderBottom: "1px solid var(--adm-bg)",
            flexShrink: 0,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--adm-text-1)", margin: 0 }}>{t("dashboard.title")}</h1>
            <p style={{ fontSize: 12, color: "var(--adm-text-3)", fontWeight: 500, margin: "4px 0 0" }}>
              {format(now, "EEEE, MMMM d yyyy", { locale: dateLocale })}&nbsp;·&nbsp;
              {ll ? "—" : t("dashboard.managersActive", { n: activeManagers.length })}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setLocation("/reports")}
              style={{ ...btnBase, background: "var(--adm-bg)", color: "var(--adm-text-2)", border: "1px solid var(--adm-border)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
              {t("dashboard.export")}
            </button>
            <button
              onClick={() => setLocation("/live-map")}
              style={{ ...btnBase, background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>sensors</span>
              {t("dashboard.liveTracking")}
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", scrollbarWidth: "none" as const }}>

          {/* ── KPI Strip ──────────────────────────────────────────────────── */}
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
              label={t("dashboard.totalBranches")}
              value={lb ? "—" : (branches as any[]).length}
              icon="account_tree"
              iconColor="#3B82F6"
              loading={lb}
            />
            <KpiCard
              label={t("dashboard.totalManagers")}
              value={lm ? "—" : (managers as any[]).length}
              icon="badge"
              iconColor="var(--adm-green)"
              loading={lm}
            />
            <KpiCard
              label={t("dashboard.todaysVisits")}
              value={lv ? "—" : visits.length}
              icon="map"
              iconColor="var(--adm-text-2)"
              loading={lv}
            />
            <KpiCard
              label={t("dashboard.spoofedToday")}
              value={lv ? "—" : mockedCount}
              icon="warning"
              iconColor="var(--adm-red)"
              valueColor={mockedCount > 0 ? "var(--adm-red)" : "var(--adm-text-1)"}
              loading={lv}
            />
          </div>

          {/* ── Active Managers Now (full-width grid) ──────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <SectionHeader
              title={t("dashboard.activeManagersNow")}
              badge={
                !ll && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "var(--adm-green-soft)", color: "var(--adm-green)", border: "1px solid var(--adm-green-soft-border)" }}>
                    {t("dashboard.onlineCount", { n: activeManagers.length })}
                  </span>
                )
              }
              action={
                <button
                  onClick={() => setLocation("/managers")}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--adm-text-3)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >
                  {t("dashboard.viewAll")}
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                    {isRTL ? "arrow_back" : "arrow_forward"}
                  </span>
                </button>
              }
            />
            {ll ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                  gap: 14,
                }}
              >
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)", borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                      <Skeleton w={40} h={40} r={20} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <Skeleton h={13} r={4} />
                        <Skeleton w="60%" h={11} r={4} />
                      </div>
                    </div>
                    <Skeleton h={5} r={99} />
                  </div>
                ))}
              </div>
            ) : liveLocations.length === 0 ? (
              <Panel>
                <Empty icon="person_off" text={t("dashboard.noManagersActive")} />
              </Panel>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                  gap: 14,
                }}
              >
                {(liveLocations as any[]).map((m: any) => (
                  <ManagerCard key={m.id} m={m} visitsToday={getVisitsToday(m)} />
                ))}
              </div>
            )}
          </div>

          {/* ── Activity Feed ──────────────────────────────────────────────── */}
          <Panel style={{ marginBottom: 20 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--adm-bg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-1)" }}>{t("dashboard.activityFeed")}</p>
              {!lv && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "var(--adm-bg)", color: "var(--adm-text-2)" }}>
                  {t("dashboard.xToday", { n: visits.length })}
                </span>
              )}
            </div>
            <div style={{ padding: "0 16px", maxHeight: 360, overflowY: "auto", scrollbarWidth: "none" as const }}>
              {lv ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--adm-bg)" }}>
                    <Skeleton w={32} h={32} r={16} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <Skeleton h={12} r={4} />
                      <Skeleton w="55%" h={11} r={4} />
                      <Skeleton w="30%" h={18} r={9} />
                    </div>
                  </div>
                ))
              ) : visits.length === 0 ? (
                <Empty icon="event_busy" text={t("dashboard.noVisitsToday")} />
              ) : (
                visits.slice(0, 10).map((v: any, idx: number) => (
                  <FeedRow key={v.id} v={v} isLast={idx === Math.min(visits.length, 10) - 1} />
                ))
              )}
            </div>
          </Panel>

          {/* ── Weekly Summary full-width ──────────────────────────────────── */}
          <Panel>
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--adm-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-1)" }}>{t("dashboard.weeklyTitle")}</p>
                <p style={{ fontSize: 11, color: "var(--adm-text-3)", fontWeight: 500, marginTop: 2 }}>
                  {selectedWeekManager && (
                    <>
                      <span style={{ fontWeight: 700, color: "var(--adm-text-2)" }}>{selectedWeekManager.userName}</span>
                      {" · "}
                    </>
                  )}
                  {format(weekStart, "MMM d", { locale: dateLocale })} — {format(addDays(weekStart, 6), "MMM d, yyyy", { locale: dateLocale })}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <select
                  value={weekManagerId}
                  onChange={(e) => setWeekManagerId(e.target.value)}
                  style={{
                    height: 30,
                    padding: "0 8px",
                    borderRadius: 10,
                    border: "1px solid var(--adm-border)",
                    background: "var(--adm-surface)",
                    color: "var(--adm-text-1)",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    outline: "none",
                    maxWidth: 180,
                  }}
                >
                  <option value="">{t("dashboard.allManagers")}</option>
                  {(managers as any[]).map((m: any) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.userName}
                    </option>
                  ))}
                </select>
                {!lw && (
                  <p style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-1)", fontVariantNumeric: "tabular-nums" }}>
                    {weekVisits.length}
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--adm-text-3)", marginInlineStart: 6 }}>{t("dashboard.visits")}</span>
                  </p>
                )}
              </div>
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
      `}</style>
    </>
  );
}
