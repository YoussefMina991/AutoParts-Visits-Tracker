import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type BranchForm = {
  name: string; code: string; address: string;
  latitude: string; longitude: string; geofenceRadiusMeters: number;
};

const emptyForm: BranchForm = { name: "", code: "", address: "", latitude: "", longitude: "", geofenceRadiusMeters: 200 };

// ─── Input Field Component ────────────────────────────────────────────────────
function LightInput({
  label, fieldKey, type = "text", icon, value, focused, onFocus, onBlur, onChange
}: {
  label: string; fieldKey: string; type?: string; icon: string;
  value: any; focused: string | null;
  onFocus: (k: string) => void; onBlur: () => void; onChange: (k: string, v: any) => void;
}) {
  const isFocused = focused === fieldKey;
  return (
    <div>
      <label className="block text-[#6B7280] text-xs font-semibold mb-1.5" style={{ fontFamily: "'Cairo', sans-serif" }}>
        {label}
      </label>
      <div className={`relative rounded-xl border transition-all duration-200 ${isFocused ? "border-[#7C3AED] ring-2 ring-[#7C3AED]/20" : "border-[#E5E7EB]"} bg-white`}>
        <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] transition-colors ${isFocused ? "text-[#7C3AED]" : "text-[#9CA3AF]"}`}>
          {icon}
        </span>
        <input
          type={type}
          className="w-full h-11 pr-10 pl-4 text-sm text-[#111827] bg-transparent outline-none rounded-xl"
          value={value}
          onFocus={() => onFocus(fieldKey)}
          onBlur={onBlur}
          onChange={e => onChange(fieldKey, type === "number" ? Number(e.target.value) : e.target.value)}
          style={{ fontFamily: "'Cairo', sans-serif" }}
        />
      </div>
    </div>
  );
}

export default function AdminBranches() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: branchesList = [], isLoading, refetch } = trpc.branch.list.useQuery();

  const createMutation = trpc.branch.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة الفرع ✅"); refetch(); setOpen(false); },
    onError: (e) => toast.error(`خطأ: ${e.message}`)
  });
  const updateMutation = trpc.branch.update.useMutation({
    onSuccess: () => { toast.success("تم التحديث ✅"); refetch(); setOpen(false); },
    onError: (e) => toast.error(`خطأ: ${e.message}`)
  });
  const deleteMutation = trpc.branch.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الفرع 🗑️"); refetch(); },
    onError: (e) => toast.error(`خطأ: ${e.message}`)
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({ name: b.name, code: b.code, address: b.address ?? "", latitude: b.latitude, longitude: b.longitude, geofenceRadiusMeters: b.geofenceRadiusMeters });
    setOpen(true);
  };
  const handleSave = () => {
    if (!form.name || !form.code || !form.latitude || !form.longitude) {
      toast.error("يرجى ملء الاسم والكود وإحداثيات الموقع");
      return;
    }
    if (editId) updateMutation.mutate({ id: editId, ...form });
    else createMutation.mutate(form);
  };

  const filtered = (branchesList as any[]).filter(b =>
    !search || b.name.includes(search) || b.code.includes(search) || (b.address ?? "").includes(search)
  );
  const activeCount = (branchesList as any[]).filter(b => b.isActive === "yes").length;

  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ background: "#F8F7FF" }}>

      {/* ── Mobile Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#EDE9FE] md:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_city</span>
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-[#7C3AED] leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>إدارة الفروع</h1>
              <p className="text-[10px] text-[#9CA3AF] leading-none mt-0.5">{isLoading ? "..." : `${branchesList.length} فرع`}</p>
            </div>
          </div>
          <button onClick={openAdd} className="w-9 h-9 flex items-center justify-center text-[#7C3AED] hover:bg-[#EDE9FE] rounded-xl transition-colors">
            <span className="material-symbols-outlined text-[22px]">add</span>
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-6 max-w-7xl mx-auto space-y-5">

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>الفروع الجغرافية</h1>
            <p className="text-[#6B7280] text-sm mt-1">إدارة المواقع ونطاقات التتبع</p>
          </div>
          <button onClick={openAdd}
            className="h-11 px-6 flex items-center gap-2 rounded-2xl text-sm font-bold text-white bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] hover:shadow-lg hover:shadow-[#A78BFA]/30 hover:scale-105 transition-all duration-200 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
            إضافة فرع جديد
          </button>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] rounded-2xl p-5 text-white col-span-2 md:col-span-1">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
            </div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">إجمالي الفروع</p>
            <p className="font-bold text-4xl font-mono leading-none">{isLoading ? "—" : branchesList.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#D1FAE5]">
            <div className="w-9 h-9 bg-[#ECFDF5] rounded-xl flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[#059669] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-1">نشط</p>
            <p className="font-bold text-3xl text-[#059669] font-mono leading-none">{isLoading ? "—" : activeCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#FEF3C7]">
            <div className="w-9 h-9 bg-[#FEF3C7] rounded-xl flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[#D97706] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>domain_disabled</span>
            </div>
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-1">غير نشط</p>
            <p className="font-bold text-3xl text-[#D97706] font-mono leading-none">
              {isLoading ? "—" : (branchesList as any[]).length - activeCount}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#EDE9FE] flex flex-col justify-center">
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-2">نسبة النشاط</p>
            <div className="h-3 bg-[#EDE9FE] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] rounded-full transition-all duration-700"
                style={{ width: `${branchesList.length > 0 ? Math.round((activeCount / branchesList.length) * 100) : 0}%` }} />
            </div>
            <p className="text-[#7C3AED] font-bold text-sm font-mono mt-1.5">
              {branchesList.length > 0 ? Math.round((activeCount / branchesList.length) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* ── Search + List ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#EDE9FE] overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-[#F3F4F6] flex items-center gap-3">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[18px]">search</span>
              <input
                type="text"
                placeholder="بحث باسم الفرع أو الكود..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pr-10 pl-4 text-sm text-[#111827] bg-[#F8F7FF] rounded-xl border border-[#EDE9FE] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all"
                style={{ fontFamily: "'Cairo', sans-serif" }}
              />
            </div>
            <button onClick={openAdd}
              className="md:hidden h-10 w-10 flex items-center justify-center rounded-xl bg-[#EDE9FE] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#EDE9FE] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[#7C3AED] text-[32px]">domain_disabled</span>
              </div>
              <p className="font-bold text-[#111827] text-sm">لا توجد فروع</p>
              <p className="text-[#9CA3AF] text-xs mt-1">اضغط على "إضافة فرع جديد" للبدء</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {filtered.map(b => {
                const isActive = b.isActive === "yes";
                return (
                  <div key={b.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-[#FAFAFA] transition-colors gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${isActive ? "bg-[#EDE9FE]" : "bg-[#F3F4F6]"}`}>
                        <span className={`material-symbols-outlined text-[20px] ${isActive ? "text-[#7C3AED]" : "text-[#9CA3AF]"}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}>
                          location_on
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="font-bold text-[#111827] text-sm" style={{ fontFamily: "'Cairo', sans-serif" }}>{b.name}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED]">{b.code}</span>
                          {!isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626]">غير نشط</span>}
                        </div>
                        <p className="text-[#6B7280] text-xs truncate max-w-xs">{b.address || "بدون عنوان محدد"}</p>
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-[#9CA3AF] font-mono">
                            <span className="material-symbols-outlined text-[12px]">radar</span>
                            {b.geofenceRadiusMeters}م
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-[#9CA3AF] font-mono">
                            <span className="material-symbols-outlined text-[12px]">my_location</span>
                            {Number(b.latitude).toFixed(4)}, {Number(b.longitude).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto border-t border-[#F3F4F6] pt-3 md:border-0 md:pt-0 w-full md:w-auto justify-end">
                      <button onClick={() => openEdit(b)}
                        className="h-9 px-4 flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] bg-[#EDE9FE] hover:bg-[#DDD6FE] rounded-xl transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        تعديل
                      </button>
                      <button
                        onClick={() => { if (confirm("هل أنت متأكد من حذف هذا الفرع؟")) deleteMutation.mutate({ id: b.id }); }}
                        className="h-9 px-4 flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] bg-[#FEE2E2] hover:bg-[#FECACA] rounded-xl transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Dialog ────────────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border border-[#EDE9FE] p-0 overflow-hidden sm:rounded-2xl max-w-lg text-[#111827]">
          <DialogHeader className="px-6 py-4 border-b border-[#EDE9FE]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {editId ? "edit" : "add_location"}
                </span>
              </div>
              <DialogTitle className="text-base font-bold" style={{ fontFamily: "'Cairo', sans-serif" }}>
                {editId ? "تعديل بيانات الفرع" : "إضافة فرع جديد"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {[
              { key: "name", label: "اسم الفرع", type: "text", icon: "badge" },
              { key: "code", label: "كود الفرع", type: "text", icon: "tag" },
              { key: "address", label: "العنوان التفصيلي", type: "text", icon: "map" },
              { key: "latitude", label: "خط العرض (Latitude)", type: "text", icon: "public" },
              { key: "longitude", label: "خط الطول (Longitude)", type: "text", icon: "public" },
              { key: "geofenceRadiusMeters", label: "نطاق الـ Geofence (متر)", type: "number", icon: "radar" },
            ].map(({ key, label, type, icon }) => (
              <LightInput key={key} label={label} fieldKey={key} type={type} icon={icon}
                value={(form as any)[key]} focused={focusedField}
                onFocus={setFocusedField} onBlur={() => setFocusedField(null)}
                onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
              />
            ))}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#EDE9FE] flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)}
              className="h-10 px-5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl transition-colors cursor-pointer">
              إلغاء
            </button>
            <button onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="h-10 px-6 text-sm font-bold text-white bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] rounded-xl flex items-center gap-2 hover:shadow-md hover:shadow-[#A78BFA]/30 transition-all cursor-pointer disabled:opacity-50">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ الفرع
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
