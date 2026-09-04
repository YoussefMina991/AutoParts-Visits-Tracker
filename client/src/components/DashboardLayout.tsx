import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { AutoPartsLogo } from "./AutoPartsLogo";
import { AdminLangProvider, useLang } from "@/lib/i18n";
import { AdminThemeProvider, useAdminTheme } from "@/lib/adminTheme";

// ─── Menu definitions (labelKey resolved via i18n) ────────────────────────────
const adminMenuGroups = [
  {
    labelKey: "nav.overview",
    items: [
      { icon: "dashboard",    labelKey: "nav.dashboard",  path: "/" },
      { icon: "sensors",      labelKey: "nav.liveMap",    path: "/live-map" },
      { icon: "assessment",   labelKey: "nav.reports",    path: "/reports" },
    ],
  },
  {
    labelKey: "nav.manage",
    items: [
      { icon: "account_tree", labelKey: "nav.branches",   path: "/branches" },
      { icon: "badge",        labelKey: "nav.managers",   path: "/managers" },
      { icon: "group",        labelKey: "nav.users",      path: "/users" },
    ],
  },
];

const managerMenuGroups = [
  {
    labelKey: "nav.menu",
    items: [
      { icon: "dashboard",   labelKey: "nav.home",     path: "/" },
      { icon: "location_on", labelKey: "nav.checkIn",  path: "/check-in" },
      { icon: "history",     labelKey: "nav.history",  path: "/history" },
      { icon: "cloud_sync",  labelKey: "nav.sync",     path: "/sync" },
    ],
  },
];

// ─── Language + Theme toggles (admin only) ────────────────────────────────────
function AdminToggles() {
  const { lang, setLang, t } = useLang();
  const { theme, toggle } = useAdminTheme();

  const btnBase: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--adm-text-2)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background .15s",
  };
  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) =>
    (e.currentTarget.style.background = "var(--adm-bg)");
  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) =>
    (e.currentTarget.style.background = "transparent");

  return (
    <>
      <button
        title={t("common.langSwitchTitle")}
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
        style={{ ...btnBase, fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}
        className="adm-icon-btn"
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        {lang === "en" ? "عربي" : "EN"}
      </button>
      <button
        title={theme === "light" ? t("common.darkMode") : t("common.lightMode")}
        onClick={toggle}
        style={btnBase}
        className="adm-icon-btn"
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 19 }}>
          {theme === "light" ? "dark_mode" : "light_mode"}
        </span>
      </button>
    </>
  );
}

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  const [seenIds, setSeenIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("notif_seen_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const ref = useRef<HTMLDivElement>(null);

  const { data: mockedData, isLoading } = trpc.visit.adminList.useQuery(
    { limit: 20, offset: 0 },
    {
      refetchInterval: 30000,
      select: (d) => (d.items ?? []).filter((v: any) => v.isMocked === "yes"),
    }
  );

  const mockedVisits = (mockedData ?? []) as any[];
  const unseenCount = mockedVisits.filter((v: any) => !seenIds.has(v.id)).length;

  // أغلق الـ dropdown لو ضغط برا
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllSeen = () => {
    const newSeen = new Set([...Array.from(seenIds), ...mockedVisits.map((v: any) => v.id)]);
    setSeenIds(newSeen);
    localStorage.setItem("notif_seen_ids", JSON.stringify(Array.from(newSeen)));
  };

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) markAllSeen();
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--adm-text-2)",
          background: open ? "var(--adm-bg)" : "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--adm-bg)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = open ? "var(--adm-bg)" : "transparent")}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 19, fontVariationSettings: open ? "'FILL' 1" : "'FILL' 0" }}
        >
          notifications
        </span>
        {/* Badge */}
        {unseenCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              insetInlineEnd: 4,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              background: "var(--adm-red)",
              color: "var(--adm-accent-fg)",
              fontSize: 8,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              border: "1.5px solid var(--adm-surface)",
            }}
          >
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            insetInlineEnd: 0,
            width: 320,
            background: "var(--adm-surface)",
            border: "1px solid var(--adm-border)",
            borderRadius: 16,
            boxShadow: "var(--adm-shadow-lift)",
            zIndex: 999,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--adm-bg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, color: "var(--adm-red)", fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-1)" }}>
                {t("notif.title")}
              </p>
            </div>
            {mockedVisits.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "var(--adm-red-soft)",
                  color: "var(--adm-red)",
                  border: "1px solid var(--adm-red-soft-border)",
                }}
              >
                {t("notif.count", { n: mockedVisits.length })}
              </span>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: "auto", scrollbarWidth: "none" }}>
            {isLoading ? (
              <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: "var(--adm-bg)", flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ height: 12, borderRadius: 4, background: "var(--adm-bg)" }} />
                      <div style={{ height: 10, width: "60%", borderRadius: 4, background: "var(--adm-bg)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : mockedVisits.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "32px 16px",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 32, color: "var(--adm-text-3)", fontVariationSettings: "'FILL' 1" }}
                >
                  verified_user
                </span>
                <p style={{ fontSize: 12, color: "var(--adm-text-2)", fontWeight: 500, textAlign: "center" }}>
                  {t("notif.empty")}
                </p>
              </div>
            ) : (
              mockedVisits.map((v: any, idx: number) => {
                const isNew = !seenIds.has(v.id);
                const checkin = new Date(v.checkInAt);
                const timeAgo = (() => {
                  const diff = Math.round((Date.now() - checkin.getTime()) / 60000);
                  if (diff < 1) return t("time.now");
                  if (diff < 60) return t("time.minAgo", { n: diff });
                  if (diff < 1440) return t("time.hourAgo", { n: Math.floor(diff / 60) });
                  return format(checkin, "d MMM");
                })();

                return (
                  <div
                    key={v.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 16px",
                      borderBottom: idx < mockedVisits.length - 1 ? "1px solid var(--adm-bg)" : "none",
                      background: isNew ? "var(--adm-red-soft)" : "var(--adm-surface)",
                      transition: "background .2s",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "var(--adm-red-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "var(--adm-red)", fontVariationSettings: "'FILL' 1" }}
                      >
                        location_off
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--adm-text-1)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v.managerName ?? t("notif.unknownManager")}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          {isNew && (
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "var(--adm-red)",
                                display: "inline-block",
                              }}
                            />
                          )}
                          <span style={{ fontSize: 10, color: "var(--adm-text-3)", fontWeight: 500 }}>
                            {timeAgo}
                          </span>
                        </div>
                      </div>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--adm-text-2)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.branchName}
                      </p>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 20,
                          background: "var(--adm-red-soft)",
                          color: "var(--adm-red)",
                          border: "1px solid var(--adm-red-soft-border)",
                        }}
                      >
                        {t("notif.chipSpoofed")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {mockedVisits.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--adm-bg)" }}>
              <Link href="/reports">
                <a
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "7px",
                    borderRadius: 10,
                    background: "var(--adm-bg)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--adm-text-2)",
                    textDecoration: "none",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--adm-border)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--adm-bg)")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    open_in_new
                  </span>
                  {t("notif.openReport")}
                </a>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Layout Body (inside providers) ───────────────────────────────────────────
function DashboardLayoutBody({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, isRTL } = useLang();
  const [location] = useLocation();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const menuGroups = isAdmin ? adminMenuGroups : managerMenuGroups;

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "var(--adm-bg)", color: "var(--adm-text-1)" }}
      className="min-h-screen flex overflow-hidden relative"
    >
      {/* ── Ambient Background Blobs for Glassmorphism ── */}
      <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#5cb8c4] opacity-20 blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full bg-[#3a9aa8] opacity-15 blur-[140px] pointer-events-none mix-blend-screen" />

      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-[220px] h-screen sticky top-0 z-40 px-3 pt-6 pb-5"
        style={{ background: "var(--adm-bg)" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-2 mb-7">
          <div style={{ height: "40px", width: "100%" }}>
            <AutoPartsLogo />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <p className="px-2 text-[10px] font-bold tracking-widest text-[var(--adm-text-3)] uppercase mb-1.5">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    location === item.path ||
                    (item.path === "/" && location === "/dashboard");
                  return (
                    <Link key={item.path} href={item.path}>
                      <a
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer ${
                          active
                            ? ""
                            : "text-[var(--adm-text-2)] hover:text-[var(--adm-text-1)] hover:bg-[var(--adm-hover)]"
                        }`}
                        style={
                          active
                            ? { background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }
                            : undefined
                        }
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: 18,
                            fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                          }}
                        >
                          {item.icon}
                        </span>
                        {t(item.labelKey)}
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--adm-border)" }}>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold text-[var(--adm-text-2)] hover:text-[var(--adm-red)] hover:bg-[var(--adm-red-soft)] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              logout
            </span>
            {t("common.logout")}
          </button>
        </div>
      </aside>

      {/* ── White card wrapper ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden p-3 ps-0 md:p-4 md:ps-0">
        <div
          className="flex-1 bg-[var(--adm-surface)] flex flex-col overflow-hidden"
          style={{
            borderRadius: 24,
            border: "1px solid var(--adm-border)",
            boxShadow: "var(--adm-shadow)",
          }}
        >
          {/* ── Top bar ── */}
          <header
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--adm-bg)" }}
          >
            {/* Search */}
            <div className="relative flex-1 max-w-[280px]">
              <span
                className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-3)]"
                style={{ fontSize: 17 }}
              >
                search
              </span>
              <input
                type="text"
                placeholder={t("common.search")}
                className="w-full h-8 ps-9 pe-3 rounded-full text-[13px] font-medium text-[var(--adm-text-1)] outline-none transition-all placeholder:text-[var(--adm-text-3)]"
                style={{ background: "var(--adm-bg)", border: "1px solid transparent" }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid var(--adm-border)";
                  e.currentTarget.style.background = "var(--adm-surface)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid transparent";
                  e.currentTarget.style.background = "var(--adm-bg)";
                }}
              />
            </div>

            {/* Right */}
            <div className="flex items-center gap-1.5 ms-3">
              {/* Admin-only toggles + bell */}
              {isAdmin && <AdminToggles />}
              {isAdmin && <NotificationBell />}

              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[12px] text-[var(--adm-accent-fg)] ms-1"
                style={{ background: "var(--adm-accent)" }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "A"}
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">
            {children}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-[var(--adm-surface)]"
        style={{ borderTop: "1px solid var(--adm-border)" }}
      >
        <div className="flex justify-around items-center h-14 px-2">
          {menuGroups[0].items.map((item) => {
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all cursor-pointer ${
                    active ? "text-[var(--adm-text-1)]" : "text-[var(--adm-text-3)]"
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 21,
                      fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[9px] font-bold tracking-wide uppercase">
                    {t(item.labelKey)}
                  </span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ─── Main Layout (wraps everything in admin-scoped providers) ─────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLangProvider>
      <AdminThemeProvider>
        <DashboardLayoutBody>{children}</DashboardLayoutBody>
      </AdminThemeProvider>
    </AdminLangProvider>
  );
}
