import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { AutoPartsLogo } from "./AutoPartsLogo";

// ─── Design Tokens (single source of truth) ──────────────────────────────────
// BG:        #F4F4F5  surface: #FFFFFF  border: #E4E4E7
// text-1:    #18181B  text-2:  #71717A  text-3: #A1A1AA
// accent:    #18181B  red:     #DC2626  green:  #16A34A

const adminMenuGroups = [
  {
    label: "Overview",
    items: [
      { icon: "dashboard",    label: "Dashboard",  path: "/" },
      { icon: "sensors",      label: "Live Map",   path: "/live-map" },
      { icon: "assessment",   label: "Reports",    path: "/reports" },
    ],
  },
  {
    label: "Manage",
    items: [
      { icon: "account_tree", label: "Branches",   path: "/branches" },
      { icon: "badge",        label: "Managers",   path: "/managers" },
      { icon: "group",        label: "Users",      path: "/users" },
    ],
  },
];

const managerMenuGroups = [
  {
    label: "Menu",
    items: [
      { icon: "dashboard",   label: "Home",    path: "/" },
      { icon: "location_on", label: "Check In", path: "/check-in" },
      { icon: "history",     label: "History",  path: "/history" },
      { icon: "cloud_sync",  label: "Sync",     path: "/sync" },
    ],
  },
];

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("notif_seen_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const ref = useRef<HTMLDivElement>(null);

  // جيب آخر 20 زيارة وهمية
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
          color: "#71717A",
          background: open ? "#F4F4F5" : "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F4F5")}
        onMouseLeave={(e) => (e.currentTarget.style.background = open ? "#F4F4F5" : "transparent")}
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
              right: 4,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              background: "#DC2626",
              color: "#fff",
              fontSize: 8,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              border: "1.5px solid #fff",
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
            right: 0,
            width: 320,
            background: "#fff",
            border: "1px solid #E4E4E7",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
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
              borderBottom: "1px solid #F4F4F5",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, color: "#DC2626", fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#18181B" }}>
                زيارات وهمية مكتشفة
              </p>
            </div>
            {mockedVisits.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "#FEF2F2",
                  color: "#DC2626",
                  border: "1px solid #FECACA",
                }}
              >
                {mockedVisits.length} زيارة
              </span>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: "auto", scrollbarWidth: "none" }}>
            {isLoading ? (
              <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: "#F4F4F5", flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ height: 12, borderRadius: 4, background: "#F4F4F5" }} />
                      <div style={{ height: 10, width: "60%", borderRadius: 4, background: "#F4F4F5" }} />
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
                  style={{ fontSize: 32, color: "#D4D4D8", fontVariationSettings: "'FILL' 1" }}
                >
                  verified_user
                </span>
                <p style={{ fontSize: 12, color: "#A1A1AA", fontWeight: 500, textAlign: "center" }}>
                  لا توجد زيارات وهمية مكتشفة
                </p>
              </div>
            ) : (
              mockedVisits.map((v: any, idx: number) => {
                const isNew = !seenIds.has(v.id);
                const checkin = new Date(v.checkInAt);
                const timeAgo = (() => {
                  const diff = Math.round((Date.now() - checkin.getTime()) / 60000);
                  if (diff < 1) return "الآن";
                  if (diff < 60) return `منذ ${diff} دقيقة`;
                  if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
                  return format(checkin, "d MMM");
                })();

                return (
                  <div
                    key={v.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 16px",
                      borderBottom: idx < mockedVisits.length - 1 ? "1px solid #F4F4F5" : "none",
                      background: isNew ? "#FFFBFB" : "#fff",
                      transition: "background .2s",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "#FEF2F2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "#DC2626", fontVariationSettings: "'FILL' 1" }}
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
                            color: "#18181B",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v.managerName ?? "مدير غير معروف"}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          {isNew && (
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#DC2626",
                                display: "inline-block",
                              }}
                            />
                          )}
                          <span style={{ fontSize: 10, color: "#A1A1AA", fontWeight: 500 }}>
                            {timeAgo}
                          </span>
                        </div>
                      </div>
                      <p
                        style={{
                          fontSize: 11,
                          color: "#71717A",
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
                          background: "#FEF2F2",
                          color: "#DC2626",
                          border: "1px solid #FECACA",
                        }}
                      >
                        موقع وهمي
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {mockedVisits.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #F4F4F5" }}>
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
                    background: "#F4F4F5",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#71717A",
                    textDecoration: "none",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#E4E4E7")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#F4F4F5")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    open_in_new
                  </span>
                  عرض كل التقارير
                </a>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isAdmin = user?.role === "admin";
  const menuGroups = isAdmin ? adminMenuGroups : managerMenuGroups;

  return (
    <div
      dir="ltr"
      style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#F4F4F5" }}
      className="min-h-screen flex overflow-hidden text-[#18181B]"
    >
      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-[220px] h-screen sticky top-0 z-40 px-3 pt-6 pb-5"
        style={{ background: "#F4F4F5" }}
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
              <p className="px-2 text-[10px] font-bold tracking-widest text-[#A1A1AA] uppercase mb-1.5">
                {group.label}
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
                            ? "bg-[#18181B] text-white"
                            : "text-[#71717A] hover:text-[#18181B] hover:bg-[#E4E4E7]/60"
                        }`}
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
                        {item.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="pt-3" style={{ borderTop: "1px solid #E4E4E7" }}>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold text-[#71717A] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              logout
            </span>
            Logout
          </button>
        </div>
      </aside>

      {/* ── White card wrapper ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden p-3 pl-0 md:p-4 md:pl-0">
        <div
          className="flex-1 bg-white flex flex-col overflow-hidden"
          style={{
            borderRadius: 24,
            border: "1px solid #E4E4E7",
            boxShadow: "0 1px 16px rgba(0,0,0,0.04)",
          }}
        >
          {/* ── Top bar ── */}
          <header
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{ borderBottom: "1px solid #F4F4F5" }}
          >
            {/* Search */}
            <div className="relative flex-1 max-w-[280px]">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]"
                style={{ fontSize: 17 }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search..."
                className="w-full h-8 pl-9 pr-3 rounded-full text-[13px] font-medium text-[#18181B] outline-none transition-all placeholder:text-[#A1A1AA]"
                style={{ background: "#F4F4F5", border: "1px solid transparent" }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid #E4E4E7";
                  e.currentTarget.style.background = "#fff";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid transparent";
                  e.currentTarget.style.background = "#F4F4F5";
                }}
              />
            </div>

            {/* Right */}
            <div className="flex items-center gap-1.5 ml-3">
              {/* Bell — للأدمن بس */}
              {isAdmin && <NotificationBell />}

              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[12px] text-white ml-1"
                style={{ background: "#18181B" }}
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
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white"
        style={{ borderTop: "1px solid #E4E4E7" }}
      >
        <div className="flex justify-around items-center h-14 px-2">
          {menuGroups[0].items.map((item) => {
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all cursor-pointer ${
                    active ? "text-[#18181B]" : "text-[#A1A1AA]"
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
                    {item.label}
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
