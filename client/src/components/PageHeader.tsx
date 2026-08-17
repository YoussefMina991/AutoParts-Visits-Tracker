// ─── PageHeader — shared across all admin pages ───────────────────────────────
// Tokens: text-1 #18181B · text-3 #A1A1AA · border #F4F4F5

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 shrink-0"
      style={{ borderBottom: "1px solid #F4F4F5" }}
    >
      <div>
        <h1 className="text-[20px] font-bold text-[#18181B]">{title}</h1>
        {subtitle && (
          <p className="text-[12px] text-[#A1A1AA] mt-0.5 font-medium">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Shared button styles (use inline) ───────────────────────────────────────
// Primary:   bg #18181B  color #fff  border none
// Secondary: bg #F4F4F5  color #71717A  border 1px solid #E4E4E7
// Danger:    bg #FEF2F2  color #DC2626  border 1px solid #FECACA
// borderRadius: 10px  padding: 6px 14px  fontSize: 12px  fontWeight: 700

// ─── Shared Panel component ───────────────────────────────────────────────────
export function Panel({
  title, badge, children, footer, className = "",
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden ${className}`}
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
        <p className="text-[13px] font-bold text-[#18181B]">{title}</p>
        {badge}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid #F4F4F5" }}>
          {footer}
        </div>
      )}
    </div>
  );
}
