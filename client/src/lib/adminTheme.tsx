import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ─── Admin theme (dark / light) ───────────────────────────────────────────────
// Persisted in localStorage("admin_theme"), default light.
// Scope note: this provider is mounted inside DashboardLayout ONLY — it renders
// a wrapper div.admin-root (+" dark") and never touches document.documentElement,
// so manager pages are unaffected.

export type AdminTheme = "light" | "dark";

interface AdminThemeContextValue {
  theme: AdminTheme;
  toggle: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined);

function readStoredTheme(): AdminTheme {
  try {
    const saved = localStorage.getItem("admin_theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "light";
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>(readStoredTheme);

  const toggle = () => setTheme((p) => (p === "light" ? "dark" : "light"));

  useEffect(() => {
    try {
      localStorage.setItem("admin_theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle }), [theme]);

  return (
    <AdminThemeContext.Provider value={value}>
      <div className={`admin-root${theme === "dark" ? " dark" : ""}`}>{children}</div>
    </AdminThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error("useAdminTheme must be used inside <AdminThemeProvider>");
  return ctx;
}
