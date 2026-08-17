import { Link, useLocation } from "wouter";

const NAV_ITEMS = [
  { icon: "dashboard",   label: "الرئيسية", path: "/" },
  { icon: "location_on", label: "تسجيل",    path: "/check-in" },
  { icon: "history",     label: "التاريخ",  path: "/history" },
  { icon: "cloud_sync",  label: "مزامنة",   path: "/sync" },
];

export function ManagerBottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "oklch(0.13 0.025 256 / 0.95)",
        borderTop: "1px solid oklch(0.82 0.15 200 / 0.12)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const active = location === item.path || (item.path === "/" && location === "/dashboard");
          return (
            <Link key={item.path} href={item.path}>
              <a
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all cursor-pointer"
                style={{
                  background: active ? "oklch(0.82 0.15 200 / 0.12)" : "transparent",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 22,
                    color: active ? "oklch(0.82 0.15 200)" : "oklch(0.6 0.03 256)",
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                    filter: active ? "drop-shadow(0 0 6px oklch(0.82 0.15 200 / 0.6))" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  {item.icon}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: active ? "oklch(0.82 0.15 200)" : "oklch(0.5 0.03 256)",
                    transition: "color 0.2s ease",
                  }}
                >
                  {item.label}
                </span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
