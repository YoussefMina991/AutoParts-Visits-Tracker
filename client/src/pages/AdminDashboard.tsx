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
        background: "linear-gradient(135deg, rgba(92,184,196,0.18), rgba(186,237,240,0.30))",
        border: "1.5px solid rgba(92,184,196,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "#5cb8c4",
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
        background: "linear-gradient(90deg, rgba(92,184,196,0.08) 25%, rgba(92,184,196,0.18) 50%, rgba(92,184,196,0.08) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// ─── Glass Panel ─────────────────────────────────────────────────────────────
function GlassPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="adm-glass-panel" style={style}>
      {children}
    </div>
  );
}



// ─── Manager Card — Glassmorphism (clickable → Reports pre-filtered) ───────────
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

  // Initials for the avatar fallback
  const initials = m.userName
    ? m.userName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Link href={`/reports?managerId=${m.id}`}>
      <a
        className="adm-manager-link adm-glass-card"
        style={{ display: "block", height: "100%" }}
      >
        {/* ── Floating Avatar ───────────────────────────────────────── */}
        <div className="adm-glass-avatar-wrap">
          <div className="adm-glass-avatar">
            {m.photoUrl ? (
              <img
                src={m.photoUrl}
                alt={m.userName}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 44, color: "#5cb8c4", fontVariationSettings: "'FILL' 1" }}
              >
                person
              </span>
            )}
          </div>
          {/* Online pulse ring */}
          {online && <span className="adm-glass-pulse" />}
        </div>

        {/* ── Card Body ─────────────────────────────────────────────── */}
        <div className="adm-glass-body">
          {/* Name + Branch */}
          <p className="adm-glass-name">{m.userName}</p>
          <p className="adm-glass-role">{m.branchName || t("dashboard.unassigned")}</p>

          {/* Status chip */}
          <div className="adm-glass-chip-row">
            <span className={`adm-glass-chip ${online ? "adm-glass-chip--online" : "adm-glass-chip--offline"}`}>
              <span className="adm-glass-chip-dot" />
              {online ? t("dashboard.active") : t("dashboard.idle")}
            </span>
          </div>

          {/* Stats row */}
          <div className="adm-glass-stats">
            <div className="adm-glass-stat">
              <span className="adm-glass-stat-val" style={{ fontVariantNumeric: "tabular-nums" }}>
                {visitsToday}
              </span>
              <span className="adm-glass-stat-lbl">{t("dashboard.visitsToday")}</span>
            </div>
            <div className="adm-glass-stat-divider" />
            <div className="adm-glass-stat">
              <span className="adm-glass-stat-val">{checkinTime || "—"}</span>
              <span className="adm-glass-stat-lbl">{t("dashboard.lastCheckin")}</span>
            </div>
          </div>

          {/* CTA row */}
          <div className="adm-glass-cta-row">
            <span className="adm-glass-cta-btn">
              {t("dashboard.viewAll")}
            </span>
            <span className="adm-glass-cta-icon">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: "#5cb8c4", fontVariationSettings: "'FILL' 1" }}
              >
                {isRTL ? "arrow_back" : "arrow_forward"}
              </span>
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

  return (
    <div
      className="adm-feed-row"
      style={{ borderBottom: isLast ? "none" : "1px solid rgba(92,184,196,0.10)" }}
    >
      <Avatar name={v.managerName} photoUrl={v.managerPhotoUrl} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {v.managerName}
          </p>
          <span className="adm-feed-time">{timeAgo}</span>
        </div>
        <p style={{ fontSize: 11, color: "var(--adm-text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {v.branchName}{dur !== null ? ` · ${dur}${t("time.minShort")}` : ""}
        </p>
        <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
          {open && <span className="adm-feed-chip adm-feed-chip--blue">{t("dashboard.inProgress")}</span>}
          {!open && !flagged && <span className="adm-feed-chip adm-feed-chip--green">{t("dashboard.checkout")}</span>}
          {flagged && <span className="adm-feed-chip adm-feed-chip--red">{t("dashboard.spoofed")}</span>}
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
      {days.map((day) => {
        const count = countByDay[day.dateStr] || 0;
        const heightPct = day.isFuture ? 0 : Math.max(count / maxCount, count > 0 ? 0.08 : 0);
        return (
          <div
            key={day.dateStr}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, color: day.isFuture ? "rgba(92,184,196,0.20)" : "rgba(92,184,196,0.70)" }}>
              {count > 0 ? count : ""}
            </p>
            <div style={{ width: "100%", height: 58, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: `${heightPct * 100}%`,
                  minHeight: count > 0 ? 4 : 0,
                  borderRadius: "8px 8px 4px 4px",
                  background: day.isToday
                    ? "linear-gradient(180deg, #5cb8c4 0%, #3a9aa8 100%)"
                    : day.isFuture
                    ? "rgba(92,184,196,0.08)"
                    : "rgba(92,184,196,0.22)",
                  boxShadow: day.isToday ? "0 4px 12px rgba(92,184,196,0.35)" : "none",
                  transition: "height 0.5s cubic-bezier(.4,0,.2,1)",
                }}
              />
            </div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: day.isToday ? "#5cb8c4" : "var(--adm-text-3)",
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 0" }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(92,184,196,0.12), rgba(186,237,240,0.20))",
        border: "1px solid rgba(92,184,196,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 26, color: "#5cb8c4", fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      </div>
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
    { startDate: todayStr, endDate: todayStr, limit: 1000, offset: 0 },
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
      limit: 1000,
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

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes glass-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }

        /* ══ GLASS PANEL ══════════════════════════════════════════════ */
        .adm-glass-panel {
          background: linear-gradient(145deg, rgba(255,255,255,0.70) 0%, rgba(186,237,240,0.35) 100%);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.55);
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(92,184,196,0.08), inset 0 1px 0 rgba(255,255,255,0.75);
          animation: fade-up 0.45s ease both;
        }
        .admin-root.dark .adm-glass-panel {
          background: linear-gradient(145deg, rgba(24,24,27,0.80) 0%, rgba(10,45,50,0.55) 100%);
          border-color: rgba(92,184,196,0.15);
          box-shadow: 0 4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(92,184,196,0.08);
        }
        .adm-panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(92,184,196,0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        /* ══ PAGE HEADER ══════════════════════════════════════════════ */
        .adm-page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid rgba(92,184,196,0.12);
          flex-shrink: 0; flex-wrap: wrap; gap: 12px;
          background: linear-gradient(90deg, rgba(255,255,255,0.82) 0%, rgba(220,245,247,0.65) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 2px 16px rgba(92,184,196,0.08), inset 0 -1px 0 rgba(92,184,196,0.10);
        }
        .admin-root.dark .adm-page-header {
          background: linear-gradient(90deg, rgba(24,24,27,0.90) 0%, rgba(10,40,45,0.75) 100%);
          box-shadow: 0 2px 16px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(92,184,196,0.10);
        }

        /* ══ HEADER BUTTONS ═══════════════════════════════════════════ */
        .adm-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 999px;
          font-size: 12px; font-weight: 700; cursor: pointer;
          border: 1px solid; font-family: inherit; transition: all 0.18s ease;
        }
        .adm-btn--ghost {
          background: rgba(255,255,255,0.65); border-color: rgba(92,184,196,0.25); color: var(--adm-text-2); backdrop-filter: blur(8px);
        }
        .admin-root.dark .adm-btn--ghost { background: rgba(39,39,42,0.60); border-color: rgba(92,184,196,0.20); }
        .adm-btn--ghost:hover { background: rgba(255,255,255,0.92); border-color: rgba(92,184,196,0.45); color: var(--adm-text-1); }
        .admin-root.dark .adm-btn--ghost:hover { background: rgba(39,39,42,0.85); }
        .adm-btn--primary {
          background: linear-gradient(135deg, #5cb8c4 0%, #3a9aa8 100%);
          border-color: transparent; color: #fff;
          box-shadow: 0 4px 14px rgba(92,184,196,0.35);
        }
        .adm-btn--primary:hover { box-shadow: 0 6px 20px rgba(92,184,196,0.50); transform: translateY(-1px); }

        /* ══ ONLINE BADGE ═════════════════════════════════════════════ */
        .adm-online-badge {
          font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
          background: rgba(34,197,94,0.12); color: #16a34a; border: 1px solid rgba(34,197,94,0.25);
        }
        .admin-root.dark .adm-online-badge { background: rgba(74,222,128,0.12); color: #4ade80; border-color: rgba(74,222,128,0.25); }

        /* ══ SECTION HEADER ═══════════════════════════════════════════ */
        .adm-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 8px; }
        .adm-section-title { font-size: 14px; font-weight: 800; color: var(--adm-text-1); display: flex; align-items: center; gap: 8px; }
        .adm-section-title::before { content: ''; display: inline-block; width: 4px; height: 16px; border-radius: 3px; background: linear-gradient(180deg,#5cb8c4,#3a9aa8); flex-shrink: 0; }

        /* ══ ACTIVITY FEED ROW ════════════════════════════════════════ */
        .adm-feed-row { display: flex; gap: 12px; padding: 11px 0; }
        .adm-feed-time { font-size: 10px; color: var(--adm-text-3); font-weight: 500; flex-shrink: 0; }
        .adm-feed-chip { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1px solid; }
        .adm-feed-chip--blue  { background: rgba(59,130,246,0.10);  color: #2563eb; border-color: rgba(59,130,246,0.25); }
        .adm-feed-chip--green { background: rgba(34,197,94,0.10);   color: #16a34a; border-color: rgba(34,197,94,0.25); }
        .adm-feed-chip--red   { background: rgba(239,68,68,0.10);   color: #dc2626; border-color: rgba(239,68,68,0.25); }
        .admin-root.dark .adm-feed-chip--blue  { color: #60a5fa; border-color: rgba(96,165,250,0.30);  background: rgba(96,165,250,0.12); }
        .admin-root.dark .adm-feed-chip--green { color: #4ade80; border-color: rgba(74,222,128,0.30);  background: rgba(74,222,128,0.12); }
        .admin-root.dark .adm-feed-chip--red   { color: #f87171; border-color: rgba(248,113,113,0.30); background: rgba(248,113,113,0.12); }

        /* ══ WEEK SELECT ══════════════════════════════════════════════ */
        .adm-week-select {
          height: 32px; padding: 0 12px; border-radius: 999px;
          border: 1px solid rgba(92,184,196,0.25);
          background: rgba(255,255,255,0.65); color: var(--adm-text-1);
          font-size: 12px; font-weight: 600; font-family: inherit;
          cursor: pointer; outline: none; max-width: 180px;
          backdrop-filter: blur(8px); transition: border-color 0.15s;
        }
        .admin-root.dark .adm-week-select { background: rgba(39,39,42,0.65); border-color: rgba(92,184,196,0.20); }
        .adm-week-select:focus { border-color: #5cb8c4; }

        /* Link reset */
        .admin-root a.adm-manager-link { text-decoration: none; color: inherit; display: block; cursor: pointer; border-radius: 24px; }
        .admin-root a.adm-manager-link:focus-visible { outline: 2px solid #5cb8c4; outline-offset: 3px; }

        /* ── Glassmorphism Manager Card ──────────────────────────── */
        .adm-glass-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          border-radius: 24px;
          padding: 0 0 18px 0;
          height: 100%;
          overflow: visible;
          /* glass background */
          background: linear-gradient(
            145deg,
            rgba(255,255,255,0.75) 0%,
            rgba(186,237,240,0.55) 60%,
            rgba(180,230,235,0.45) 100%
          );
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.60);
          box-shadow:
            0 8px 32px rgba(92,184,196,0.12),
            0 2px 8px  rgba(92,184,196,0.08),
            inset 0 1px 0 rgba(255,255,255,0.8);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
          text-decoration: none !important;
          color: inherit;
          cursor: pointer;
        }
        .admin-root.dark .adm-glass-card {
          background: linear-gradient(
            145deg,
            rgba(39,39,42,0.80) 0%,
            rgba(14,60,66,0.60) 60%,
            rgba(8,50,55,0.55) 100%
          );
          border-color: rgba(92,184,196,0.20);
          box-shadow:
            0 8px 32px rgba(0,0,0,0.45),
            0 2px 8px  rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(92,184,196,0.10);
        }
        .adm-glass-card:hover {
          box-shadow:
            0 16px 48px rgba(92,184,196,0.22),
            0 4px 16px  rgba(92,184,196,0.14),
            inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .admin-root.dark .adm-glass-card:hover {
          box-shadow:
            0 16px 48px rgba(0,0,0,0.55),
            0 4px 16px  rgba(92,184,196,0.18),
            inset 0 1px 0 rgba(92,184,196,0.15);
        }

        /* ── Floating Avatar ─────────────────────────────────────── */
        .adm-glass-avatar-wrap {
          position: relative;
          margin-top: -36px;
          margin-bottom: 14px;
          width: 88px;
          height: 88px;
          flex-shrink: 0;
        }
        .adm-glass-avatar {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(186,237,240,0.70));
          border: 3px solid rgba(255,255,255,0.90);
          box-shadow:
            0 8px 24px rgba(92,184,196,0.25),
            0 2px 8px  rgba(92,184,196,0.15);
          overflow: hidden;
        }
        .admin-root.dark .adm-glass-avatar {
          background: linear-gradient(135deg, rgba(39,39,42,0.95), rgba(14,60,66,0.80));
          border-color: rgba(92,184,196,0.30);
        }
        .adm-glass-pulse {
          position: absolute;
          bottom: 6px;
          right: 6px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #22c55e;
          border: 2.5px solid rgba(255,255,255,0.90);
          box-shadow: 0 0 0 0 rgba(34,197,94,0.6);
        }

        /* ── Card Body ───────────────────────────────────────────── */
        .adm-glass-body {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 18px;
          gap: 0;
        }
        .adm-glass-name {
          font-size: 18px;
          font-weight: 700;
          color: var(--adm-text-1);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          margin: 0 0 4px 0;
        }
        .adm-glass-role {
          font-size: 12px;
          font-weight: 500;
          color: var(--adm-text-3);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          margin: 0 0 12px 0;
        }

        /* ── Status chip ─────────────────────────────────────────── */
        .adm-glass-chip-row {
          display: flex;
          gap: 6px;
          margin-bottom: 16px;
        }
        .adm-glass-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 12px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          border: 1px solid;
          letter-spacing: 0.04em;
        }
        .adm-glass-chip--online {
          background: rgba(34,197,94,0.12);
          color: #16a34a;
          border-color: rgba(34,197,94,0.30);
        }
        .admin-root.dark .adm-glass-chip--online {
          background: rgba(74,222,128,0.12);
          color: #4ade80;
          border-color: rgba(74,222,128,0.30);
        }
        .adm-glass-chip--offline {
          background: rgba(161,161,170,0.12);
          color: var(--adm-text-2);
          border-color: rgba(161,161,170,0.25);
        }
        .adm-glass-chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
        }

        /* ── Stats row ───────────────────────────────────────────── */
        .adm-glass-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          width: 100%;
          padding: 12px 0;
          margin-bottom: 16px;
          border-top:    1px solid rgba(255,255,255,0.50);
          border-bottom: 1px solid rgba(255,255,255,0.50);
        }
        .admin-root.dark .adm-glass-stats {
          border-top-color:    rgba(92,184,196,0.12);
          border-bottom-color: rgba(92,184,196,0.12);
        }
        .adm-glass-stat {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
        }
        .adm-glass-stat-divider {
          width: 1px;
          height: 32px;
          background: rgba(255,255,255,0.55);
          flex-shrink: 0;
        }
        .admin-root.dark .adm-glass-stat-divider {
          background: rgba(92,184,196,0.15);
        }
        .adm-glass-stat-val {
          font-size: 15px;
          font-weight: 800;
          color: var(--adm-text-1);
          line-height: 1;
        }
        .adm-glass-stat-lbl {
          font-size: 9px;
          font-weight: 600;
          color: var(--adm-text-3);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-align: center;
        }

        /* ── CTA row ─────────────────────────────────────────────── */
        .adm-glass-cta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .adm-glass-cta-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(255,255,255,0.80);
          color: var(--adm-text-1);
          backdrop-filter: blur(8px);
          transition: background 0.18s ease;
        }
        .admin-root.dark .adm-glass-cta-btn {
          background: rgba(39,39,42,0.60);
          border-color: rgba(92,184,196,0.20);
          color: var(--adm-text-1);
        }
        .adm-glass-card:hover .adm-glass-cta-btn {
          background: rgba(255,255,255,0.90);
        }
        .admin-root.dark .adm-glass-card:hover .adm-glass-cta-btn {
          background: rgba(39,39,42,0.80);
        }
        .adm-glass-cta-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.90);
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(92,184,196,0.15);
          transition: background 0.18s ease, box-shadow 0.18s ease;
        }
        .admin-root.dark .adm-glass-cta-icon {
          background: rgba(39,39,42,0.70);
          border-color: rgba(92,184,196,0.25);
        }
        .adm-glass-card:hover .adm-glass-cta-icon {
          box-shadow: 0 4px 16px rgba(92,184,196,0.28);
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "Inter, -apple-system, sans-serif" }}>

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="adm-page-header">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--adm-text-1)", margin: 0, letterSpacing: "-0.02em" }}>
              {t("dashboard.title")}
            </h1>
            <p style={{ fontSize: 12, color: "var(--adm-text-3)", fontWeight: 500, margin: "4px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#5cb8c4" }}>calendar_today</span>
              {format(now, "EEEE, MMMM d yyyy", { locale: dateLocale })}
              &nbsp;·&nbsp;
              <span style={{ color: "#5cb8c4", fontWeight: 700 }}>
                {ll ? "—" : t("dashboard.managersActive", { n: activeManagers.length })}
              </span>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setLocation("/reports")} className="adm-btn adm-btn--ghost">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
              {t("dashboard.export")}
            </button>
            <button onClick={() => setLocation("/live-map")} className="adm-btn adm-btn--primary">
              <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>sensors</span>
              {t("dashboard.liveTracking")}
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", scrollbarWidth: "none" as const }}>

          {/* ── Active Managers Now ───────────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <div className="adm-section-header">
              <span className="adm-section-title">
                {t("dashboard.activeManagersNow")}
                {!ll && (
                  <span className="adm-online-badge">
                    {t("dashboard.onlineCount", { n: activeManagers.length })}
                  </span>
                )}
              </span>
              <button
                onClick={() => setLocation("/managers")}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#5cb8c4", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
              >
                {t("dashboard.viewAll")}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {isRTL ? "arrow_back" : "arrow_forward"}
                </span>
              </button>
            </div>
            {ll ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, paddingTop: 52 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ borderRadius: 24, padding: "60px 16px 16px", background: "rgba(186,237,240,0.20)", border: "1px solid rgba(255,255,255,0.45)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Skeleton w={80} h={14} r={5} />
                      <Skeleton w="55%" h={11} r={4} />
                      <Skeleton w={70} h={24} r={12} />
                    </div>
                  </div>
                ))}
              </div>
            ) : liveLocations.length === 0 ? (
              <GlassPanel>
                <Empty icon="person_off" text={t("dashboard.noManagersActive")} />
              </GlassPanel>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, paddingTop: 52 }}>
                {(liveLocations as any[]).map((m: any) => (
                  <ManagerCard key={m.id} m={m} visitsToday={getVisitsToday(m)} />
                ))}
              </div>
            )}
          </div>

          {/* ── Activity Feed ──────────────────────────────────────────────── */}
          <GlassPanel style={{ marginBottom: 20 }}>
            <div className="adm-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(92,184,196,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#5cb8c4", fontVariationSettings: "'FILL' 1" }}>bolt</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "var(--adm-text-1)" }}>{t("dashboard.activityFeed")}</p>
              </div>
              {!lv && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(92,184,196,0.12)", color: "#5cb8c4", border: "1px solid rgba(92,184,196,0.22)" }}>
                  {t("dashboard.xToday", { n: visits.length })}
                </span>
              )}
            </div>
            <div style={{ padding: "4px 20px 8px", maxHeight: 360, overflowY: "auto", scrollbarWidth: "none" as const }}>
              {lv ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(92,184,196,0.08)" }}>
                    <Skeleton w={34} h={34} r={17} />
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
          </GlassPanel>

          {/* ── Weekly Summary ─────────────────────────────────────────────── */}
          <GlassPanel>
            <div className="adm-panel-header">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(92,184,196,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#5cb8c4", fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "var(--adm-text-1)" }}>{t("dashboard.weeklyTitle")}</p>
                </div>
                <p style={{ fontSize: 11, color: "var(--adm-text-3)", fontWeight: 500, paddingInlineStart: 40 }}>
                  {selectedWeekManager && (
                    <>
                      <span style={{ fontWeight: 700, color: "#5cb8c4" }}>{selectedWeekManager.userName}</span>
                      {" · "}
                    </>
                  )}
                  {format(weekStart, "MMM d", { locale: dateLocale })} — {format(addDays(weekStart, 6), "MMM d, yyyy", { locale: dateLocale })}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <select
                  value={weekManagerId}
                  onChange={(e) => setWeekManagerId(e.target.value)}
                  className="adm-week-select"
                >
                  <option value="">{t("dashboard.allManagers")}</option>
                  {(managers as any[]).map((m: any) => (
                    <option key={m.id} value={String(m.id)}>{m.userName}</option>
                  ))}
                </select>
                {!lw && (
                  <p style={{ fontSize: 24, fontWeight: 900, color: "var(--adm-text-1)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                    {weekVisits.length}
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#5cb8c4", marginInlineStart: 6 }}>{t("dashboard.visits")}</span>
                  </p>
                )}
              </div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              {lw ? (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90 }}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <Skeleton h={Math.random() * 50 + 10} r={6} />
                      <Skeleton h={10} r={3} />
                    </div>
                  ))}
                </div>
              ) : (
                <WeeklyBarChart visits={weekVisits} />
              )}
            </div>
          </GlassPanel>

        </div>
      </div>

    </>
  );
}
