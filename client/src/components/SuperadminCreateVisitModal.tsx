import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { X, Search, ChevronDown, Check, Loader2, Plus } from "lucide-react";

// ─── Searchable Dropdown ──────────────────────────────────────────────────────
interface DropdownOption { id: number; label: string; sub?: string; }
function SearchableDropdown({
  options, value, onChange, placeholder, icon,
}: {
  options: DropdownOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder: string;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);
  const filtered = useMemo(
    () => options.filter(o =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.sub || "").toLowerCase().includes(query.toLowerCase())
    ),
    [options, query]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full" style={{ direction: "rtl" }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        className="w-full flex items-center gap-2 px-4 h-11 rounded-xl text-sm transition-all"
        style={{
          background: "var(--adm-bg)",
          border: "1px solid var(--adm-border)",
          color: selected ? "var(--adm-text-1)" : "var(--adm-text-3)",
        }}
      >
        {icon && <span className="material-symbols-outlined text-[var(--adm-text-2)]" style={{ fontSize: 17 }}>{icon}</span>}
        <span className="flex-1 text-start truncate" style={{ fontFamily: "'Cairo', sans-serif" }}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.label}
              {selected.sub && <span className="text-[11px] text-[var(--adm-text-3)]">({selected.sub})</span>}
            </span>
          ) : placeholder}
        </span>
        <ChevronDown size={15} className={`text-[var(--adm-text-3)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 w-full rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)" }}
        >
          {/* Search box */}
          <div className="p-2 border-b" style={{ borderColor: "var(--adm-border)" }}>
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg" style={{ background: "var(--adm-bg)" }}>
              <Search size={14} className="text-[var(--adm-text-3)]" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث..."
                className="flex-1 bg-transparent text-sm outline-none text-[var(--adm-text-1)] placeholder:text-[var(--adm-text-3)]"
                style={{ fontFamily: "'Cairo', sans-serif" }}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-4 h-9 text-sm text-start hover:bg-[var(--adm-hover)] transition-colors"
              style={{ color: "var(--adm-text-3)", fontFamily: "'Cairo', sans-serif" }}
            >
              — لا شيء
            </button>
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-center text-[var(--adm-text-3)]">لا نتائج</div>
            ) : filtered.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-4 h-10 text-sm text-start transition-colors"
                style={{
                  color: "var(--adm-text-1)",
                  background: value === opt.id ? "var(--adm-accent-soft, rgba(92,184,196,0.12))" : undefined,
                  fontFamily: "'Cairo', sans-serif",
                }}
                onMouseEnter={e => { if (value !== opt.id) (e.currentTarget as HTMLElement).style.background = "var(--adm-hover)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = value === opt.id ? "var(--adm-accent-soft, rgba(92,184,196,0.12))" : ""; }}
              >
                <span className="flex flex-col gap-0">
                  <span>{opt.label}</span>
                  {opt.sub && <span className="text-[11px] text-[var(--adm-text-3)]">{opt.sub}</span>}
                </span>
                {value === opt.id && <Check size={14} className="text-[var(--adm-accent)] shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Select row ───────────────────────────────────────────────────────────────
function FieldSelect({ label, value, onChange, options, icon }: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--adm-text-2)] px-1" style={{ fontFamily: "'Cairo', sans-serif" }}>{label}</label>
      <div className="relative">
        {icon && <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-3)]" style={{ fontSize: 16, pointerEvents: "none" }}>{icon}</span>}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-11 rounded-xl text-sm outline-none appearance-none cursor-pointer"
          style={{
            paddingInlineStart: icon ? "36px" : "16px",
            paddingInlineEnd: "32px",
            background: "var(--adm-bg)",
            border: "1px solid var(--adm-border)",
            color: "var(--adm-text-1)",
            fontFamily: "'Cairo', sans-serif",
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-3)] pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Text Input ───────────────────────────────────────────────────────────────
function FieldInput({ label, value, onChange, type = "text", dir = "rtl", placeholder, icon }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; dir?: string; placeholder?: string; icon?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--adm-text-2)] px-1" style={{ fontFamily: "'Cairo', sans-serif" }}>{label}</label>
      <div className="relative">
        {icon && <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-3)]" style={{ fontSize: 16, pointerEvents: "none" }}>{icon}</span>}
        <input
          type={type}
          dir={dir}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 rounded-xl text-sm outline-none placeholder:text-[var(--adm-text-3)]"
          style={{
            paddingInlineStart: icon ? "36px" : "16px",
            paddingInlineEnd: "16px",
            background: "var(--adm-bg)",
            border: "1px solid var(--adm-border)",
            color: "var(--adm-text-1)",
            fontFamily: "'Cairo', sans-serif",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
interface SuperadminCreateVisitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managers: any[];
}

export function SuperadminCreateVisitModal({ open, onOpenChange, managers }: SuperadminCreateVisitModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const { data: branches = [] } = trpc.branch.list.useQuery();

  const [form, setForm] = useState({
    managerId: null as number | null,
    branchId: null as number | null,
    visitType: "branch",
    noteType: "general",
    checkInAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    checkOutAt: "",
    status: "checked_out",
    isMocked: "no",
    notes: "",
    latitudeIn: "0.000000",
    longitudeIn: "0.000000",
  });

  const set = (k: keyof typeof form) => (v: any) => setForm(p => ({ ...p, [k]: v }));

  const managerOptions: DropdownOption[] = managers.map(m => ({
    id: m.id,
    label: m.name || m.userName || m.username || `Manager ${m.id}`,
  }));

  const branchOptions: DropdownOption[] = (branches as any[]).map((b: any) => ({
    id: b.id,
    label: b.name,
    sub: b.code,
  }));

  const createMutation = trpc.visit.superadminCreate.useMutation({
    onSuccess: () => {
      toast.success("✅ تم إنشاء الزيارة بنجاح");
      queryClient.invalidateQueries();
      onOpenChange(false);
      setForm({
        managerId: null, branchId: null,
        visitType: "branch", noteType: "general",
        checkInAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        checkOutAt: "", status: "checked_out", isMocked: "no",
        notes: "", latitudeIn: "0.000000", longitudeIn: "0.000000",
      });
    },
    onError: (err) => toast.error(err.message || "حدث خطأ أثناء الإنشاء"),
    onSettled: () => setLoading(false),
  });

  const handleSave = () => {
    if (!form.managerId) { toast.error("يرجى اختيار المدير"); return; }
    if (!form.checkInAt) { toast.error("يرجى تحديد وقت الحضور"); return; }
    setLoading(true);
    createMutation.mutate({
      managerId: form.managerId,
      branchId: form.branchId,
      visitType: form.visitType as any,
      noteType: form.noteType as any,
      checkInAt: new Date(form.checkInAt).toISOString(),
      checkOutAt: form.checkOutAt ? new Date(form.checkOutAt).toISOString() : null,
      status: form.status as any,
      isMocked: form.isMocked as any,
      notes: form.notes || null,
      latitudeIn: form.latitudeIn,
      longitudeIn: form.longitudeIn,
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => onOpenChange(false)}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
        }}
      />

      {/* Modal */}
      <div
        dir="rtl"
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 96vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--adm-surface)",
          border: "1px solid var(--adm-border)",
          borderRadius: "20px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          zIndex: 9999,
          scrollbarWidth: "thin",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 sticky top-0"
          style={{ background: "var(--adm-surface)", borderBottom: "1px solid var(--adm-border)", borderRadius: "20px 20px 0 0" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.12)" }}
            >
              <Plus size={18} style={{ color: "#10b981" }} />
            </div>
            <div>
              <h2 className="font-bold text-[15px]" style={{ fontFamily: "'Cairo', sans-serif", color: "var(--adm-text-1)" }}>
                إضافة زيارة جديدة
              </h2>
              <p className="text-[11px]" style={{ color: "var(--adm-text-3)", fontFamily: "'Cairo', sans-serif" }}>
                صلاحية سوبر أدمن
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: "var(--adm-text-2)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--adm-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Manager */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--adm-text-2)] px-1" style={{ fontFamily: "'Cairo', sans-serif" }}>
              المدير <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <SearchableDropdown
              options={managerOptions}
              value={form.managerId}
              onChange={set("managerId")}
              placeholder="اختر المدير..."
              icon="badge"
            />
          </div>

          {/* Branch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--adm-text-2)] px-1" style={{ fontFamily: "'Cairo', sans-serif" }}>
              الفرع (اختياري)
            </label>
            <SearchableDropdown
              options={branchOptions}
              value={form.branchId}
              onChange={set("branchId")}
              placeholder="اختر الفرع أو ابحث عنه..."
              icon="account_tree"
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--adm-border)" }} />

          {/* CheckIn / CheckOut */}
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="وقت الحضور *"
              type="datetime-local"
              dir="ltr"
              value={form.checkInAt}
              onChange={set("checkInAt")}
              icon="login"
            />
            <FieldInput
              label="وقت الانصراف"
              type="datetime-local"
              dir="ltr"
              value={form.checkOutAt}
              onChange={set("checkOutAt")}
              icon="logout"
            />
          </div>

          {/* Status / Mocked */}
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect
              label="حالة الزيارة"
              value={form.status}
              onChange={set("status")}
              icon="flag"
              options={[
                { value: "checked_out", label: "✅ منتهية" },
                { value: "checked_in", label: "🟡 مفتوحة" },
              ]}
            />
            <FieldSelect
              label="تلاعب (Mocked)"
              value={form.isMocked}
              onChange={set("isMocked")}
              icon="gpp_bad"
              options={[
                { value: "no", label: "✅ لا (حقيقي)" },
                { value: "yes", label: "⚠️ نعم (مزيف)" },
              ]}
            />
          </div>

          {/* Visit type / Note type */}
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect
              label="نوع الزيارة"
              value={form.visitType}
              onChange={set("visitType")}
              icon="place"
              options={[
                { value: "branch", label: "🏢 فرع" },
                { value: "external_mission", label: "🚗 مهمة خارجية" },
              ]}
            />
            <FieldSelect
              label="نوع الملاحظة"
              value={form.noteType}
              onChange={set("noteType")}
              icon="label"
              options={[
                { value: "general", label: "عامة" },
                { value: "short_visit", label: "زيارة قصيرة" },
                { value: "non_primary", label: "غير أساسي" },
                { value: "external_mission", label: "مهمة خارجية" },
              ]}
            />
          </div>

          {/* Notes */}
          <FieldInput
            label="الملاحظات"
            value={form.notes}
            onChange={set("notes")}
            placeholder="أضف ملاحظة..."
            icon="notes"
          />

          {/* Lat/Lng */}
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="Latitude" value={form.latitudeIn} onChange={set("latitudeIn")} dir="ltr" icon="my_location" />
            <FieldInput label="Longitude" value={form.longitudeIn} onChange={set("longitudeIn")} dir="ltr" icon="my_location" />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 sticky bottom-0"
          style={{ background: "var(--adm-surface)", borderTop: "1px solid var(--adm-border)", borderRadius: "0 0 20px 20px" }}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="h-10 px-5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "var(--adm-bg)",
              border: "1px solid var(--adm-border)",
              color: "var(--adm-text-2)",
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !form.managerId}
            className="h-10 px-6 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: loading || !form.managerId ? "rgba(16,185,129,0.4)" : "#10b981",
              color: "#fff",
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "جار الإنشاء..." : "إنشاء الزيارة"}
          </button>
        </div>
      </div>
    </>
  );
}
