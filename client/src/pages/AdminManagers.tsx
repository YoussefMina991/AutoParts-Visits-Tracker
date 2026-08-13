import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ─── Assign Branches Dialog ───────────────────────────────────────────────────
function AssignBranchesDialog({ manager, onClose }: { manager: any; onClose: () => void }) {
  const { data: branchesList = [] } = trpc.branch.list.useQuery();
  const { data: currentIds = [], isLoading } = trpc.manager.getManagerBranches.useQuery(
    { managerId: manager.id },
    { enabled: !!manager }
  );
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);
  const effectiveIds = selectedIds ?? currentIds;

  const assignMutation = trpc.manager.assignBranches.useMutation({
    onSuccess: () => { toast.success("تم تحديث الفروع المخصصة ✅"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const base = prev ?? currentIds;
      return (base as number[]).includes(id) ? (base as number[]).filter(b => b !== id) : [...(base as number[]), id];
    });
  };

  return (
    <DialogContent className="bg-white border border-[#EDE9FE] p-0 overflow-hidden sm:rounded-2xl max-w-lg text-[#111827]">
      <DialogHeader className="px-6 py-4 border-b border-[#EDE9FE]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_tree</span>
          </div>
          <DialogTitle className="text-base font-bold" style={{ fontFamily: "'Cairo', sans-serif" }}>
            تخصيص فروع — {manager.userName ?? ""}
          </DialogTitle>
        </div>
      </DialogHeader>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[#6B7280] text-sm">اختر الفروع المخصصة لهذا المدير</p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedIds((branchesList as any[]).map((b: any) => b.id))}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[#7C3AED] bg-[#EDE9FE] hover:bg-[#DDD6FE] transition-colors cursor-pointer">
                تحديد الكل
              </button>
              <button onClick={() => setSelectedIds([])}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[#DC2626] bg-[#FEE2E2] hover:bg-[#FECACA] transition-colors cursor-pointer">
                إلغاء الكل
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {(branchesList as any[]).length === 0 ? (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-[#9CA3AF] text-[36px] block mb-2">domain_disabled</span>
                <p className="text-[#6B7280] text-sm">لا توجد فروع — أضف فروعاً أولاً</p>
              </div>
            ) : (
              (branchesList as any[]).map((b: any) => {
                const checked = (effectiveIds as number[]).includes(b.id);
                return (
                  <button key={b.id} onClick={() => toggle(b.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all text-right"
                    style={{
                      background: checked ? "#F5F3FF" : "#FAFAFA",
                      borderColor: checked ? "#A78BFA" : "#E5E7EB",
                    }}>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: checked ? "#7C3AED" : "transparent", borderColor: checked ? "#7C3AED" : "#D1D5DB" }}>
                      {checked && <span className="material-symbols-outlined text-white text-[13px]">check</span>}
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <p className="text-sm font-semibold text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>{b.name}</p>
                      {b.address && <p className="text-xs text-[#9CA3AF] truncate">{b.address}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED] flex-shrink-0">{b.code}</span>
                  </button>
                );
              })
            )}
          </div>

          <p className="text-center text-[#9CA3AF] text-xs">
            <span className="font-bold text-[#7C3AED]">{(effectiveIds as number[]).length}</span> فرع محدد من {(branchesList as any[]).length}
          </p>
        </div>
      )}

      <DialogFooter className="px-6 py-4 border-t border-[#EDE9FE] flex items-center justify-end gap-2">
        <button onClick={onClose} className="h-10 px-5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl transition-colors cursor-pointer">إلغاء</button>
        <button onClick={() => assignMutation.mutate({ managerId: manager.id, branchIds: effectiveIds as number[] })}
          disabled={assignMutation.isPending || isLoading}
          className="h-10 px-6 text-sm font-bold text-white bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] rounded-xl flex items-center gap-2 hover:shadow-md hover:shadow-[#A78BFA]/30 transition-all cursor-pointer disabled:opacity-50">
          {assignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          حفظ التخصيص
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminManagers() {
  const [createOpen, setCreateOpen] = useState(false);
  const [assignManager, setAssignManager] = useState<any>(null);
  const [form, setForm] = useState({ userId: "", employeeCode: "", phone: "" });

  const { data: managersList = [], isLoading, refetch } = trpc.manager.list.useQuery();
  const { data: usersList = [] } = trpc.users.list.useQuery();

  const createMutation = trpc.manager.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المدير ✅");
      refetch(); setCreateOpen(false);
      setForm({ userId: "", employeeCode: "", phone: "" });
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.manager.delete.useMutation({
    onSuccess: () => { toast.success("تم الحذف 🗑️"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreateSave = () => {
    if (!form.userId) { toast.error("يرجى اختيار المستخدم"); return; }
    createMutation.mutate({ userId: Number(form.userId), employeeCode: form.employeeCode || undefined, phone: form.phone || undefined });
  };

  const existingManagerUserIds = new Set((managersList as any[]).map((m: any) => m.userId));
  const availableUsers = (usersList as any[]).filter(u => u.role === "user" && !existingManagerUserIds.has(u.id));
  const activeCount = (managersList as any[]).filter(m => m.isActive === "yes").length;

  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ background: "#F8F7FF" }}>

      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#EDE9FE] md:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
            </div>
            <h1 className="font-bold text-[15px] text-[#7C3AED]" style={{ fontFamily: "'Cairo', sans-serif" }}>المديرين</h1>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-[#7C3AED] hover:bg-[#EDE9FE] rounded-xl transition-colors">
            <span className="material-symbols-outlined text-[22px]">person_add</span>
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-6 max-w-7xl mx-auto space-y-5">

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>مديرو الفروع</h1>
            <p className="text-[#6B7280] text-sm mt-1">إدارة المديرين وتخصيص الفروع</p>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="h-11 px-6 flex items-center gap-2 rounded-2xl text-sm font-bold text-white bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] hover:shadow-lg hover:shadow-[#A78BFA]/30 hover:scale-105 transition-all duration-200 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            إضافة مدير
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] rounded-2xl p-5 text-white">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            </div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">إجمالي المديرين</p>
            <p className="font-bold text-4xl font-mono leading-none">{isLoading ? "—" : (managersList as any[]).length}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#D1FAE5]">
            <div className="w-9 h-9 bg-[#ECFDF5] rounded-xl flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[#059669] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_check</span>
            </div>
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-1">النشطين</p>
            <p className="font-bold text-3xl text-[#059669] font-mono leading-none">{isLoading ? "—" : activeCount}</p>
          </div>
        </div>

        {/* Managers List */}
        <div className="bg-white rounded-2xl border border-[#EDE9FE] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
            <h2 className="font-bold text-[#111827] text-sm" style={{ fontFamily: "'Cairo', sans-serif" }}>قائمة المديرين</h2>
            <span className="text-[#9CA3AF] text-xs font-mono">{(managersList as any[]).length} مدير</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
            </div>
          ) : (managersList as any[]).length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#EDE9FE] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#7C3AED] text-[32px]">group_off</span>
              </div>
              <p className="font-bold text-[#111827] text-sm">لا يوجد مديرين بعد</p>
              <p className="text-[#9CA3AF] text-xs">اضغط على "إضافة مدير" للبدء</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {(managersList as any[]).map((m: any) => {
                const isActive = m.isActive === "yes";
                const initial = (m.userName ?? "م").charAt(0).toUpperCase();
                return (
                  <div key={m.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-[#FAFAFA] transition-colors gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center font-bold text-white text-sm flex-shrink-0 shadow-md shadow-[#A78BFA]/30">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-sm text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>
                            {m.userName ?? "مستخدم غير معروف"}
                          </span>
                          {m.employeeCode && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED]">{m.employeeCode}</span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FEE2E2] text-[#DC2626]"}`}>
                            {isActive ? "نشط" : "غير نشط"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {m.userEmail && <span className="text-[#6B7280] text-xs">{m.userEmail}</span>}
                          {m.phone && <span className="text-[#6B7280] text-xs font-mono">{m.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto border-t border-[#F3F4F6] pt-3 md:border-0 md:pt-0 w-full md:w-auto justify-end">
                      <button onClick={() => setAssignManager(m)}
                        className="h-9 px-4 flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] bg-[#EDE9FE] hover:bg-[#DDD6FE] rounded-xl transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">account_tree</span>
                        تخصيص فروع
                      </button>
                      <button onClick={() => { if (confirm("هل أنت متأكد من حذف هذا المدير؟")) deleteMutation.mutate({ id: m.id }); }}
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white border border-[#EDE9FE] p-0 overflow-hidden sm:rounded-2xl max-w-lg text-[#111827]">
          <DialogHeader className="px-6 py-4 border-b border-[#EDE9FE]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
              </div>
              <DialogTitle className="text-base font-bold" style={{ fontFamily: "'Cairo', sans-serif" }}>إضافة مدير جديد</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[#6B7280] text-xs font-semibold mb-1.5">المستخدم *</label>
              <div className="relative rounded-xl border border-[#E5E7EB] focus-within:border-[#7C3AED] focus-within:ring-2 focus-within:ring-[#7C3AED]/20 transition-all bg-white">
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[18px]">person</span>
                <select className="w-full h-11 pr-10 pl-4 text-sm text-[#111827] bg-transparent outline-none rounded-xl cursor-pointer"
                  value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                  style={{ fontFamily: "'Cairo', sans-serif" }}>
                  <option value="">-- اختر مستخدم --</option>
                  {availableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.username} ({u.username})</option>
                  ))}
                </select>
              </div>
              {availableUsers.length === 0 && (
                <p className="text-[#D97706] text-xs mt-1.5 flex items-center gap-1 bg-[#FEF3C7] px-3 py-2 rounded-xl">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  كل المستخدمين لديهم بروفايل مدير
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "employeeCode", label: "كود الموظف", placeholder: "MGR-001", icon: "badge" },
                { key: "phone", label: "رقم الهاتف", placeholder: "01xxxxxxxxx", icon: "phone" },
              ].map(({ key, label, placeholder, icon }) => (
                <div key={key}>
                  <label className="block text-[#6B7280] text-xs font-semibold mb-1.5">{label}</label>
                  <div className="relative rounded-xl border border-[#E5E7EB] focus-within:border-[#7C3AED] focus-within:ring-2 focus-within:ring-[#7C3AED]/20 transition-all bg-white">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[16px]">{icon}</span>
                    <input type="text" placeholder={placeholder}
                      className="w-full h-10 pr-10 pl-3 text-sm text-[#111827] bg-transparent outline-none rounded-xl"
                      value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ fontFamily: "'Cairo', sans-serif" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-[#EDE9FE] flex items-center justify-end gap-2">
            <button onClick={() => setCreateOpen(false)}
              className="h-10 px-5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl transition-colors cursor-pointer">إلغاء</button>
            <button onClick={handleCreateSave} disabled={createMutation.isPending}
              className="h-10 px-6 text-sm font-bold text-white bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] rounded-xl flex items-center gap-2 hover:shadow-md hover:shadow-[#A78BFA]/30 transition-all cursor-pointer disabled:opacity-50">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              إضافة مدير
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!assignManager} onOpenChange={() => setAssignManager(null)}>
        {assignManager && <AssignBranchesDialog manager={assignManager} onClose={() => setAssignManager(null)} />}
      </Dialog>
    </div>
  );
}
