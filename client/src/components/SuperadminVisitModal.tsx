import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { X, ChevronDown, Loader2, Edit3 } from "lucide-react";

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

interface SuperadminVisitModalProps {
  visit: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuperadminVisitModal({ visit, open, onOpenChange }: SuperadminVisitModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const formatDateForInput = (dateStr: string | Date | null) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "yyyy-MM-dd'T'HH:mm");
    } catch {
      return "";
    }
  };

  const [formData, setFormData] = useState({
    checkInAt: formatDateForInput(visit?.checkInAt),
    checkOutAt: formatDateForInput(visit?.checkOutAt),
    visitType: visit?.visitType || "branch",
    noteType: visit?.noteType || "general",
    status: visit?.status || "checked_in",
    isMocked: visit?.isMocked || "no",
    notes: visit?.notes || "",
    distanceToPrevBranchKm: visit?.distanceToPrevBranchKm?.toString() || "0",
  });

  useEffect(() => {
    if (visit) {
      setFormData({
        checkInAt: formatDateForInput(visit.checkInAt),
        checkOutAt: formatDateForInput(visit.checkOutAt),
        visitType: visit.visitType || "branch",
        noteType: visit.noteType || "general",
        status: visit.status || "checked_in",
        isMocked: visit.isMocked || "no",
        notes: visit.notes || "",
        distanceToPrevBranchKm: visit.distanceToPrevBranchKm?.toString() || "0",
      });
    }
  }, [visit]);

  const updateMutation = trpc.visit.superadminUpdate.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الزيارة بنجاح (سوبر أدمن)");
      queryClient.invalidateQueries();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء التحديث");
    },
    onSettled: () => setLoading(false)
  });

  const handleSave = () => {
    if (!visit) return;
    setLoading(true);
    updateMutation.mutate({
      id: visit.id,
      checkInAt: formData.checkInAt ? new Date(formData.checkInAt).toISOString() : undefined,
      checkOutAt: formData.checkOutAt ? new Date(formData.checkOutAt).toISOString() : null,
      visitType: formData.visitType as any,
      noteType: formData.noteType as any,
      status: formData.status as any,
      isMocked: formData.isMocked as any,
      notes: formData.notes || null,
      distanceToPrevBranchKm: Number(formData.distanceToPrevBranchKm) || null,
    });
  };

  if (!open || !visit) return null;

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
          className="flex items-center justify-between px-6 py-5 sticky top-0 z-10"
          style={{ background: "var(--adm-surface)", borderBottom: "1px solid var(--adm-border)", borderRadius: "20px 20px 0 0" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.12)" }}
            >
              <Edit3 size={18} style={{ color: "#10b981" }} />
            </div>
            <div>
              <h2 className="font-bold text-[15px]" style={{ fontFamily: "'Cairo', sans-serif", color: "var(--adm-text-1)" }}>
                تعديل الزيارة
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

          {/* CheckIn / CheckOut */}
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="وقت الحضور (Check-in)"
              type="datetime-local"
              dir="ltr"
              value={formData.checkInAt}
              onChange={(v) => setFormData(p => ({ ...p, checkInAt: v }))}
              icon="login"
            />
            <FieldInput
              label="وقت الانصراف (Check-out)"
              type="datetime-local"
              dir="ltr"
              value={formData.checkOutAt}
              onChange={(v) => setFormData(p => ({ ...p, checkOutAt: v }))}
              icon="logout"
            />
          </div>

          {/* Status / Mocked */}
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect
              label="حالة الزيارة"
              value={formData.status}
              onChange={(v) => setFormData(p => ({ ...p, status: v }))}
              icon="flag"
              options={[
                { value: "checked_out", label: "✅ منتهية" },
                { value: "checked_in", label: "🟡 مفتوحة" },
              ]}
            />
            <FieldSelect
              label="تلاعب (Mocked)"
              value={formData.isMocked}
              onChange={(v) => setFormData(p => ({ ...p, isMocked: v }))}
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
              value={formData.visitType}
              onChange={(v) => setFormData(p => ({ ...p, visitType: v }))}
              icon="place"
              options={[
                { value: "branch", label: "🏢 فرع" },
                { value: "external_mission", label: "🚗 مهمة خارجية" },
              ]}
            />
            <FieldSelect
              label="نوع الملاحظة"
              value={formData.noteType}
              onChange={(v) => setFormData(p => ({ ...p, noteType: v }))}
              icon="label"
              options={[
                { value: "general", label: "عامة" },
                { value: "short_visit", label: "زيارة قصيرة" },
                { value: "non_primary", label: "غير أساسي" },
                { value: "external_mission", label: "مهمة خارجية" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <FieldInput
              label="المسافة للفرع السابق (Km)"
              type="number"
              dir="ltr"
              value={formData.distanceToPrevBranchKm}
              onChange={(v) => setFormData(p => ({ ...p, distanceToPrevBranchKm: v }))}
              icon="directions_car"
            />
          </div>

          {/* Notes */}
          <FieldInput
            label="الملاحظات"
            value={formData.notes}
            onChange={(v) => setFormData(p => ({ ...p, notes: v }))}
            placeholder="أضف ملاحظة..."
            icon="notes"
          />

        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 sticky bottom-0 z-10"
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
            disabled={loading}
            className="h-10 px-6 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: loading ? "rgba(16,185,129,0.4)" : "#10b981",
              color: "#fff",
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "جار الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </>
  );
}
