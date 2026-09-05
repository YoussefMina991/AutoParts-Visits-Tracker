import { Link, useLocation } from "wouter";

const NAV_ITEMS = [
  { icon: "home",          label: "الرئيسية",   path: "/" },
  { icon: "location_on",   label: "الفروع",     path: "/check-in" },
  { icon: "history",       label: "السجل",      path: "/history" },
  { icon: "bar_chart",     label: "تقاريري",    path: "/reports" },
  { icon: "sync",          label: "المزامنة",   path: "/sync" },
];

export function ManagerBottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(17, 20, 23, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex justify-around items-center h-16 px-4 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const active = location === item.path || (item.path === "/" && location === "/dashboard");
          return (
            <Link key={item.path} href={item.path}>
              <a
                className="flex flex-col items-center justify-center cursor-pointer relative"
                style={{ width: "64px", height: "100%" }}
              >
                {/* Active Indicator Background */}
                {active && (
                  <div 
                    style={{
                      position: "absolute",
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "rgba(15, 165, 248, 0.15)",
                      zIndex: 0
                    }}
                  />
                )}
                
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 24,
                    color: active ? "#0fa5f8" : "rgba(255, 255, 255, 0.4)",
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                    transition: "all 0.2s ease",
                    zIndex: 1
                  }}
                >
                  {item.icon}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    marginTop: 3,
                    fontFamily: "'Cairo', sans-serif",
                    color: active ? "#0fa5f8" : "rgba(255, 255, 255, 0.4)",
                    transition: "color 0.2s ease",
                    zIndex: 1
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
