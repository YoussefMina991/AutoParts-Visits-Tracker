import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Design Tokens — must match DashboardLayout exactly ──────────────────────
// bg:        #F4F4F5   surface: #FFFFFF   border: #E4E4E7
// text-1:    #18181B   text-2:  #71717A   text-3: #A1A1AA
// accent:    #18181B   green:   #16A34A   red:    #DC2626
// radius-sm: 12px      radius-md: 16px   radius-lg: 24px

type BranchForm = {
  name: string;
  code: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusMeters: number;
};

const emptyForm: BranchForm = {
  name: "",
  code: "",
  address: "",
  latitude: "",
  longitude: "",
  geofenceRadiusMeters: 200,
};

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
        style={{ color: "#A1A1AA" }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 13, color: "#A1A1AA" }}
        >
          {icon}
        </span>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
function AdminInput({
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  type?: string;
  value: any;
  onChange: (v: any) => void;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(type === "number" ? Number(e.target.value) : e.target.value)
      }
      placeholder={placeholder}
      className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium outline-none transition-all"
      style={{
        background: "#F4F4F5",
        border: "1px solid #E4E4E7",
        color: "#18181B",
      }}
      onFocus={(e) => {
        e.currentTarget.style.border = "1px solid #18181B";
        e.currentTarget.style.background = "#fff";
      }}
      onBlur={(e) => {
        e.currentTarget.style.border = "1px solid #E4E4E7";
        e.currentTarget.style.background = "#F4F4F5";
      }}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminBranches() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [search, setSearch] = useState("");

  const {
    data: branchesList = [],
    isLoading,
    refetch,
  } = trpc.branch.list.useQuery();

  const createMutation = trpc.branch.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الفرع");
      refetch();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.branch.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الفرع");
      refetch();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.branch.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفرع");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({
      name: b.name,
      code: b.code,
      address: b.address ?? "",
      latitude: b.latitude,
      longitude: b.longitude,
      geofenceRadiusMeters: b.geofenceRadiusMeters,
    });
    setOpen(true);
  };
  const handleSave = () => {
    if (!form.name || !form.code || !form.latitude || !form.longitude) {
      toast.error("الاسم والكود والإحداثيات مطلوبة");
      return;
    }
    if (editId) updateMutation.mutate({ id: editId, ...form });
    else createMutation.mutate(form);
  };
  const setField = (k: keyof BranchForm, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const list = branchesList as any[];
  const filtered = list.filter(
    (b) =>
      !search ||
      b.name.includes(search) ||
      b.code.includes(search) ||
      (b.address ?? "").includes(search)
  );
  const activeCount = list.filter((b) => b.isActive === "yes").length;
  const actPct =
    list.length > 0 ? Math.round((activeCount / list.length) * 100) : 0;

  return (
    <div className="p-5 md:p-7 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "#18181B" }}>
            الفروع
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#71717A" }}>
            إدارة مواقع الفروع ونطاقات الـ Geofence
          </p>
        </div>
        <button
          onClick={openAdd}
          className="h-9 px-4 flex items-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 cursor-pointer"
          style={{ background: "#18181B" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
            add
          </span>
          فرع جديد
        </button>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "إجمالي الفروع",
            value: isLoading ? "—" : list.length,
            icon: "location_city",
            color: "#18181B",
            bg: "#F4F4F5",
          },
          {
            label: "نشط",
            value: isLoading ? "—" : activeCount,
            icon: "check_circle",
            color: "#16A34A",
            bg: "#F0FDF4",
          },
          {
            label: "غير نشط",
            value: isLoading ? "—" : list.length - activeCount,
            icon: "cancel",
            color: "#DC2626",
            bg: "#FEF2F2",
          },
          {
            label: "نسبة النشاط",
            value: isLoading ? "—" : `${actPct}%`,
            icon: "percent",
            color: "#71717A",
            bg: "#F4F4F5",
          },
        ].map(({ label, value, icon, color, bg }) => (
          <div
            key={label}
            className="flex items-center justify-between p-4"
            style={{
              background: "#fff",
              border: "1px solid #E4E4E7",
              borderRadius: 16,
            }}
          >
            <div>
              <p
                className="text-[10px] font-bold tracking-widest uppercase mb-1"
                style={{ color: "#A1A1AA" }}
              >
                {label}
              </p>
              <p className="text-[26px] font-bold leading-none" style={{ color }}>
                {value}
              </p>
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: bg }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 18,
                  color,
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                {icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E4E4E7",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Search bar */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #F4F4F5" }}
        >
          <div className="relative flex-1 max-w-sm">
            <span
              className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2"
              style={{ fontSize: 16, color: "#A1A1AA" }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pr-9 pl-3 rounded-full text-[13px] outline-none transition-all"
              style={{ background: "#F4F4F5", border: "1px solid transparent", color: "#18181B" }}
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
          <span className="text-[12px] font-medium" style={{ color: "#A1A1AA" }}>
            {filtered.length} فرع
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#A1A1AA" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "#F4F4F5" }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, color: "#A1A1AA" }}
              >
                location_off
              </span>
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: "#18181B" }}>
                لا توجد فروع
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "#71717A" }}>
                اضغط "فرع جديد" للبدء
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Table Header (desktop) */}
            <div
              className="hidden md:grid grid-cols-[2fr_1fr_2fr_1fr_1fr_auto] px-5 py-2.5"
              style={{ borderBottom: "1px solid #F4F4F5" }}
            >
              {["الفرع", "الكود", "العنوان", "نطاق Geofence", "الحالة", ""].map(
                (h) => (
                  <span
                    key={h}
                    className="text-[10px] font-bold tracking-widest uppercase"
                    style={{ color: "#A1A1AA" }}
                  >
                    {h}
                  </span>
                )
              )}
            </div>

            {filtered.map((b) => {
              const isActive = b.isActive === "yes";
              return (
                <div
                  key={b.id}
                  className="flex flex-col md:grid md:grid-cols-[2fr_1fr_2fr_1fr_1fr_auto] md:items-center px-5 py-3.5 gap-2 md:gap-0 transition-colors hover:bg-[#FAFAFA]"
                  style={{ borderBottom: "1px solid #F4F4F5" }}
                >
                  {/* Name */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "#F4F4F5" }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 16,
                          color: "#71717A",
                          fontVariationSettings: "'FILL' 1",
                        }}
                      >
                        location_on
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold" style={{ color: "#18181B" }}>
                      {b.name}
                    </span>
                  </div>

                  {/* Code */}
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full w-fit"
                    style={{ background: "#F4F4F5", color: "#71717A" }}
                  >
                    {b.code}
                  </span>

                  {/* Address */}
                  <span
                    className="text-[12px] truncate max-w-[200px]"
                    style={{ color: "#71717A" }}
                  >
                    {b.address || "—"}
                  </span>

                  {/* Geofence */}
                  <span
                    className="text-[12px] font-mono flex items-center gap-1"
                    style={{ color: "#71717A" }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 13, color: "#A1A1AA" }}
                    >
                      radar
                    </span>
                    {b.geofenceRadiusMeters}م
                  </span>

                  {/* Status */}
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full w-fit"
                    style={{
                      background: isActive ? "#F0FDF4" : "#FEF2F2",
                      color: isActive ? "#16A34A" : "#DC2626",
                    }}
                  >
                    {isActive ? "نشط" : "متوقف"}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => openEdit(b)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#F4F4F5] cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "#71717A" }}
                      >
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("حذف هذا الفرع؟"))
                          deleteMutation.mutate({ id: b.id });
                      }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#FEF2F2] cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "#DC2626" }}
                      >
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 overflow-hidden sm:rounded-2xl max-w-md"
          style={{ background: "#fff", border: "1px solid #E4E4E7" }}
        >
          <DialogHeader
            className="px-6 py-4"
            style={{ borderBottom: "1px solid #F4F4F5" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "#18181B" }}
              >
                <span
                  className="material-symbols-outlined text-white"
                  style={{
                    fontSize: 16,
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  {editId ? "edit" : "add_location"}
                </span>
              </div>
              <DialogTitle
                className="text-[15px] font-bold"
                style={{ color: "#18181B" }}
              >
                {editId ? "تعديل الفرع" : "فرع جديد"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <Field label="اسم الفرع" icon="badge">
              <AdminInput
                value={form.name}
                onChange={(v) => setField("name", v)}
                placeholder="مثال: فرع المعادي"
              />
            </Field>
            <Field label="كود الفرع" icon="tag">
              <AdminInput
                value={form.code}
                onChange={(v) => setField("code", v)}
                placeholder="مثال: MAD-01"
              />
            </Field>
            <Field label="العنوان التفصيلي" icon="map">
              <AdminInput
                value={form.address}
                onChange={(v) => setField("address", v)}
                placeholder="اختياري"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="خط العرض" icon="public">
                <AdminInput
                  value={form.latitude}
                  onChange={(v) => setField("latitude", v)}
                  placeholder="30.0444"
                />
              </Field>
              <Field label="خط الطول" icon="public">
                <AdminInput
                  value={form.longitude}
                  onChange={(v) => setField("longitude", v)}
                  placeholder="31.2357"
                />
              </Field>
            </div>
            <Field label="نطاق Geofence (متر)" icon="radar">
              <AdminInput
                type="number"
                value={form.geofenceRadiusMeters}
                onChange={(v) => setField("geofenceRadiusMeters", v)}
                placeholder="200"
              />
            </Field>
          </div>

          <DialogFooter
            className="px-6 py-4 flex items-center justify-end gap-2"
            style={{ borderTop: "1px solid #F4F4F5" }}
          >
            <button
              onClick={() => setOpen(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[#F4F4F5] cursor-pointer"
              style={{ color: "#71717A" }}
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{ background: "#18181B" }}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              حفظ
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
