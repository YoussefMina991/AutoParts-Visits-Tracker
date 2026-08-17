import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";

// ─── Design Tokens (single source of truth) ──────────────────────────────────
// BG:        #F4F4F5  (outer shell)
// Surface:   #FFFFFF  (white card)
// Border:    #E4E4E7  (all borders)
// Text-1:    #18181B  (headings)
// Text-2:    #71717A  (secondary)
// Text-3:    #A1A1AA  (placeholder / muted)
// Active:    #18181B  (selected nav item)
// Accent:    #18181B  (primary button)
// Radius-sm: 12px     (buttons, inputs)
// Radius-md: 16px     (cards)
// Radius-lg: 24px     (main card)

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
          <div
            className="w-7 h-7 rounded-[10px] flex items-center justify-center"
            style={{ background: "#18181B" }}
          >
            <span
              className="material-symbols-outlined text-white"
              style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}
            >
              monitoring
            </span>
          </div>
          <span className="font-bold text-[14px] tracking-tight text-[#18181B]">
            HEITKAMP
          </span>
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
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717A] hover:bg-[#F4F4F5] transition-colors relative"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 19 }}>
                  notifications
                </span>
                <span
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: "#EF4444" }}
                />
              </button>
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
