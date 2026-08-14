import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ── Shared sub-components (defined OUTSIDE to avoid re-mount on every keystroke) ──

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-[#4a5568] text-[10px] uppercase tracking-widest font-bold mb-1.5">{label}</label>
    {children}
  </div>
);

const inputCls = "input-field w-full h-10 px-3 text-sm";

const ROLE_OPTIONS = [
  { role: "user",  label: "مدير فرع",  icon: "manage_accounts", color: "#34d399" },
  { role: "admin", label: "أدمن نظام", icon: "shield",           color: "#a78bfa" },
] as const;

const RoleSelector = ({
  value,
  onChange,
}: {
  value: "user" | "admin";
  onChange: (v: "user" | "admin") => void;
}) => (
  <div className="grid grid-cols-2 gap-2">
    {ROLE_OPTIONS.map(({ role, label, icon, color }) => (
      <button
        key={role}
        type="button"
        onClick={() => onChange(role)}
        className="flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all"
        style={{
          background:  value === role ? `${color}15` : "transparent",
          borderColor: value === role ? `${color}50` : "rgba(255,255,255,0.06)",
          color:       value === role ? color : "#4a5568",
        }}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: value === role ? "'FILL' 1" : "'FILL' 0" }}
        >
          {icon}
        </span>
        <span className="font-semibold text-sm">{label}</span>
      </button>
    ))}
  </div>
);

// ── Types ─────────────────────────────────────────────────────────────────────

type CreateForm = { username: string; password: string; name: string; email: string; role: "user" | "admin" };
type EditForm   = CreateForm & { id: number };

const emptyCreate: CreateForm = { username: "", password: "", name: "", email: "", role: "user" };

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [createOpen,       setCreateOpen]       = useState(false);
  const [editOpen,         setEditOpen]         = useState(false);
  const [deleteOpen,       setDeleteOpen]       = useState(false);
  const [showPassword,     setShowPassword]     = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [form,             setForm]             = useState<CreateForm>(emptyCreate);
  const [editForm,         setEditForm]         = useState<EditForm | null>(null);
  const [deleteTarget,     setDeleteTarget]     = useState<{ id: number; name: string } | null>(null);

  const { data: users = [], isLoading, refetch } = trpc.users.list.useQuery();

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => { toast.success("✅ تم إنشاء الحساب"); refetch(); setCreateOpen(false); setForm(emptyCreate); },
    onError:   (e) => toast.error(e.message),
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => { toast.success("✅ تم تحديث البيانات"); refetch(); setEditOpen(false); setEditForm(null); },
    onError:   (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("🗑️ تم حذف الحساب"); refetch(); setDeleteOpen(false); setDeleteTarget(null); },
    onError:   (e) => toast.error(e.message),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!form.username)            { toast.error("اسم المستخدم مطلوب"); return; }
    if (form.password.length < 6)  { toast.error("كلمة السر 6 أحرف على الأقل"); return; }
    createMutation.mutate({
      username: form.username,
      password: form.password,
      name:     form.name  || undefined,
      email:    form.email || undefined,
      role:     form.role,
    });
  };

  const handleEdit = (u: any) => {
    setEditForm({ id: u.id, username: u.username, password: "", name: u.name ?? "", email: u.email ?? "", role: u.role });
    setShowEditPassword(false);
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editForm) return;
    if (!editForm.username)                              { toast.error("اسم المستخدم مطلوب"); return; }
    if (editForm.password && editForm.password.length < 6) { toast.error("كلمة السر 6 أحرف على الأقل"); return; }
    updateMutation.mutate({
      id:       editForm.id,
      username: editForm.username,
      name:     editForm.name  || undefined,
      email:    editForm.email || undefined,
      role:     editForm.role,
      ...(editForm.password ? { password: editForm.password } : {}),
    });
  };

  const handleDeleteClick = (u: any) => {
    setDeleteTarget({ id: u.id, name: u.name ?? u.username });
    setDeleteOpen(true);
  };

  const admins   = (users as any[]).filter(u => u.role === "admin");
  const managers = (users as any[]).filter(u => u.role === "user");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-enter min-h-screen pb-24 md:pb-8">

      {/* Mobile Header */}
      <header
        className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-2xl md:hidden"
        style={{ background: "rgba(2,6,23,0.9)" }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#a78bfa] text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            </div>
            <h1 className="font-bold text-[15px] text-[#e2e8f0]"
              style={{ fontFamily: "'Fira Sans', sans-serif" }}>المستخدمين</h1>
          </div>
          <button
            onClick={() => { setForm(emptyCreate); setShowPassword(false); setCreateOpen(true); }}
            className="btn-ghost w-9 h-9 flex items-center justify-center text-[#a78bfa]"
          >
            <span className="material-symbols-outlined text-[24px]">person_add</span>
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-5 md:pt-8 max-w-7xl mx-auto space-y-5">

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#e2e8f0]"
              style={{ fontFamily: "'Fira Sans', sans-serif" }}>إدارة المستخدمين</h1>
            <p className="text-[#64748b] text-sm mt-1">إنشاء وتعديل وحذف حسابات الدخول</p>
          </div>
          <button
            onClick={() => { setForm(emptyCreate); setShowPassword(false); setCreateOpen(true); }}
            className="btn-primary h-10 px-5 flex items-center gap-2 rounded-xl text-sm font-semibold cursor-pointer transition-transform hover:scale-105"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            مستخدم جديد
          </button>
        </div>

        {/* Stats */}
        <div className="stagger grid grid-cols-3 gap-3">
          {[
            { label: "الإجمالي",     value: isLoading ? "—" : (users as any[]).length, color: "#00d4ff", icon: "group" },
            { label: "مديرو النظام", value: isLoading ? "—" : admins.length,           color: "#a78bfa", icon: "shield" },
            { label: "مديرو الفروع", value: isLoading ? "—" : managers.length,         color: "#34d399", icon: "manage_accounts" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="stat-card text-center">
              <div className="icon-box mx-auto mb-2"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
              </div>
              <p className="text-[#4a5568] text-[10px] uppercase tracking-widest font-bold mb-1">{label}</p>
              <p className="font-bold text-2xl font-mono" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Users List */}
        <section className="bento-card p-1 md:p-5">
          <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-white/[0.04] mb-2">
            <h2 className="font-semibold text-[#e2e8f0] text-sm">كل الحسابات</h2>
            <span className="text-[#4a5568] text-xs font-mono">{(users as any[]).length} حساب</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#00d4ff]" />
            </div>
          ) : (users as any[]).length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#4a5568] text-[32px]">person_off</span>
              </div>
              <p className="text-[#64748b] text-sm">لا توجد حسابات مسجلة</p>
            </div>
          ) : (
            <div className="space-y-1 p-2 md:p-0 stagger">
              {(users as any[]).map((u: any) => {
                const isAdminUser = u.role === "admin";
                const color = isAdminUser ? "#a78bfa" : "#34d399";
                return (
                  <div
                    key={u.id}
                    className="group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
                      >
                        {(u.name ?? u.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-semibold text-sm text-[#e2e8f0] truncate"
                            style={{ fontFamily: "'Fira Sans', sans-serif" }}>
                            {u.name ?? u.username}
                          </span>
                          <span className="text-[10px] font-mono text-[#4a5568] bg-white/5 border border-white/[0.06] px-2 py-0.5 rounded-full">
                            @{u.username}
                          </span>
                          <span className="badge text-[9px] px-2 py-0.5"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                            {isAdminUser ? "أدمن" : "مدير فرع"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {u.email && <span className="text-[#4a5568] text-xs truncate">{u.email}</span>}
                          {u.lastSignedIn && (
                            <span className="text-[#4a5568] text-xs font-mono">
                              آخر دخول: {format(new Date(u.lastSignedIn), "dd MMM yyyy", { locale: ar })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 cursor-pointer"
                        style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff" }}
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteClick(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 cursor-pointer"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ── Create Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#0b1326] border border-white/[0.1] text-[#e2e8f0] p-0 overflow-hidden sm:rounded-2xl max-w-lg">
          <DialogHeader className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
            <DialogTitle className="text-base font-semibold" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
              إنشاء حساب جديد
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <Field label="الدور">
              <RoleSelector value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="اسم المستخدم *">
                <input
                  className={inputCls}
                  placeholder="ahmed.ali"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, ".") }))}
                />
              </Field>
              <Field label="الاسم الكامل">
                <input
                  className={inputCls}
                  placeholder="أحمد علي"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="كلمة السر *">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${inputCls} pr-10`}
                  placeholder="6 أحرف على الأقل"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568] hover:text-[#94a3b8]"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </Field>
            <Field label="البريد الإلكتروني (اختياري)">
              <input
                type="email"
                className={inputCls}
                placeholder="ahmed@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </Field>
            {form.role === "user" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#00d4ff]/5 border border-[#00d4ff]/15">
                <span className="material-symbols-outlined text-[#00d4ff] text-[16px] mt-0.5 flex-shrink-0">info</span>
                <p className="text-[#64748b] text-xs leading-relaxed">
                  بعد الإنشاء، روح لصفحة <strong className="text-[#00d4ff]">المديرين</strong> عشان تخصصله فروع.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
            <button onClick={() => setCreateOpen(false)} className="btn-ghost px-4 py-2 text-sm font-semibold rounded-xl">
              إلغاء
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="btn-primary px-5 py-2 text-sm font-semibold flex items-center gap-2 rounded-xl"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              إنشاء الحساب
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#0b1326] border border-white/[0.1] text-[#e2e8f0] p-0 overflow-hidden sm:rounded-2xl max-w-lg">
          <DialogHeader className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
            <DialogTitle className="text-base font-semibold" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
              تعديل الحساب
            </DialogTitle>
          </DialogHeader>

          {editForm && (
            <div className="p-6 space-y-4">
              <Field label="الدور">
                <RoleSelector
                  value={editForm.role}
                  onChange={v => setEditForm(f => f ? { ...f, role: v } : f)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم المستخدم *">
                  <input
                    className={inputCls}
                    value={editForm.username}
                    onChange={e => setEditForm(f => f ? { ...f, username: e.target.value.toLowerCase().replace(/\s/g, ".") } : f)}
                  />
                </Field>
                <Field label="الاسم الكامل">
                  <input
                    className={inputCls}
                    value={editForm.name}
                    onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)}
                  />
                </Field>
              </div>
              <Field label="كلمة السر الجديدة (اتركها فارغة إذا لم تريد تغييرها)">
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    className={`${inputCls} pr-10`}
                    placeholder="اتركها فارغة للإبقاء على القديمة"
                    value={editForm.password}
                    onChange={e => setEditForm(f => f ? { ...f, password: e.target.value } : f)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(s => !s)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568] hover:text-[#94a3b8]"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showEditPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </Field>
              <Field label="البريد الإلكتروني">
                <input
                  type="email"
                  className={inputCls}
                  value={editForm.email}
                  onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : f)}
                />
              </Field>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
            <button onClick={() => setEditOpen(false)} className="btn-ghost px-4 py-2 text-sm font-semibold rounded-xl">
              إلغاء
            </button>
            <button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="btn-primary px-5 py-2 text-sm font-semibold flex items-center gap-2 rounded-xl"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ التعديلات
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-[#0b1326] border border-white/[0.1] text-[#e2e8f0] p-0 overflow-hidden sm:rounded-2xl max-w-sm">
          <DialogHeader className="px-6 py-4 border-b border-white/[0.06]">
            <DialogTitle className="text-base font-semibold text-[#ef4444]"
              style={{ fontFamily: "'Fira Sans', sans-serif" }}>
              تأكيد الحذف
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#ef4444] text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}>person_remove</span>
            </div>
            <p className="text-center text-[#94a3b8] text-sm leading-relaxed">
              هتحذف حساب <strong className="text-[#e2e8f0]">{deleteTarget?.name}</strong> نهائياً.
              <br />مش هتقدر ترجع الداتا دي.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
            <button onClick={() => setDeleteOpen(false)} className="btn-ghost px-4 py-2 text-sm font-semibold rounded-xl">
              إلغاء
            </button>
            <button
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
              className="px-5 py-2 text-sm font-semibold flex items-center gap-2 rounded-xl transition-all hover:scale-105 cursor-pointer"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              نعم، احذف
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
