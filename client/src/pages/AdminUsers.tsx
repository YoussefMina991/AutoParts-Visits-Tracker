import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Design Tokens — must match DashboardLayout exactly ──────────────────────
// bg: #F4F4F5  surface: #FFFFFF  border: #E4E4E7
// text-1: #18181B  text-2: #71717A  text-3: #A1A1AA
// accent: #18181B  green: #16A34A  red: #DC2626

// ─── Types ────────────────────────────────────────────────────────────────────
type CreateForm = {
  username: string;
  password: string;
  name: string;
  email: string;
  role: "user" | "admin";
};
type EditForm = CreateForm & { id: number };
const emptyCreate: CreateForm = {
  username: "",
  password: "",
  name: "",
  email: "",
  role: "user",
};

// ─── Shared Field ─────────────────────────────────────────────────────────────
function Field({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
        style={{ color: "#A1A1AA" }}
      >
        {icon && (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 12, color: "#A1A1AA" }}
          >
            {icon}
          </span>
        )}
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Shared Input ─────────────────────────────────────────────────────────────
function AdminInput({
  type = "text",
  value,
  onChange,
  placeholder,
  suffix,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium outline-none transition-all"
        style={{
          background: "#F4F4F5",
          border: "1px solid #E4E4E7",
          color: "#18181B",
          paddingLeft: suffix ? 36 : undefined,
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
      {suffix && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2">{suffix}</div>
      )}
    </div>
  );
}

// ─── Role Selector ────────────────────────────────────────────────────────────
function RoleSelector({
  value,
  onChange,
}: {
  value: "user" | "admin";
  onChange: (v: "user" | "admin") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          { role: "user", label: "مدير فرع", icon: "manage_accounts" },
          { role: "admin", label: "أدمن نظام", icon: "shield" },
        ] as const
      ).map(({ role, label, icon }) => {
        const active = value === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className="flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer"
            style={{
              background: active ? "#18181B" : "#F4F4F5",
              borderColor: active ? "#18181B" : "#E4E4E7",
              color: active ? "#fff" : "#71717A",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 18,
                fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {icon}
            </span>
            <span className="font-semibold text-[13px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [unbindTarget, setUnbindTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const {
    data: users = [],
    isLoading,
    refetch,
  } = trpc.users.list.useQuery();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الحساب");
      refetch();
      setCreateOpen(false);
      setForm(emptyCreate);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث البيانات");
      refetch();
      setEditOpen(false);
      setEditForm(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الحساب");
      refetch();
      setDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // 🔓 فك ربط الجهاز — يسمح للمستخدم بتسجيل الدخول من موبايل جديد
  const unbindMutation = trpc.users.unbindDevice.useMutation({
    onSuccess: () => {
      toast.success("تم فك ربط الجهاز — المستخدم هيسجل دخول من موبايله الجديد وهيتربط تلقائياً");
      refetch();
      setUnbindTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.username) {
      toast.error("اسم المستخدم مطلوب");
      return;
    }
    if (form.password.length < 6) {
      toast.error("كلمة السر 6 أحرف على الأقل");
      return;
    }
    createMutation.mutate({
      username: form.username,
      password: form.password,
      name: form.name || undefined,
      email: form.email || undefined,
      role: form.role,
    });
  };

  const handleEdit = (u: any) => {
    setEditForm({
      id: u.id,
      username: u.username,
      password: "",
      name: u.name ?? "",
      email: u.email ?? "",
      role: u.role,
    });
    setShowEditPassword(false);
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editForm) return;
    if (!editForm.username) {
      toast.error("اسم المستخدم مطلوب");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast.error("كلمة السر 6 أحرف على الأقل");
      return;
    }
    updateMutation.mutate({
      id: editForm.id,
      username: editForm.username,
      name: editForm.name || undefined,
      email: editForm.email || undefined,
      role: editForm.role,
      ...(editForm.password ? { password: editForm.password } : {}),
    });
  };

  const handleDeleteClick = (u: any) => {
    setDeleteTarget({ id: u.id, name: u.name ?? u.username });
    setDeleteOpen(true);
  };

  const allUsers = users as any[];
  const admins = allUsers.filter((u) => u.role === "admin");
  const managers = allUsers.filter((u) => u.role === "user");

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 md:p-7 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "#18181B" }}>
            المستخدمون
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#71717A" }}>
            إنشاء وتعديل وحذف حسابات الدخول
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyCreate);
            setShowPassword(false);
            setCreateOpen(true);
          }}
          className="h-9 px-4 flex items-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 cursor-pointer"
          style={{ background: "#18181B" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
            person_add
          </span>
          مستخدم جديد
        </button>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "الإجمالي",
            value: isLoading ? "—" : allUsers.length,
            icon: "group",
            color: "#18181B",
            bg: "#F4F4F5",
          },
          {
            label: "أدمن",
            value: isLoading ? "—" : admins.length,
            icon: "shield",
            color: "#71717A",
            bg: "#F4F4F5",
          },
          {
            label: "مديرو فروع",
            value: isLoading ? "—" : managers.length,
            icon: "manage_accounts",
            color: "#16A34A",
            bg: "#F0FDF4",
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

      {/* ── Users Table ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E4E4E7",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid #F4F4F5" }}
        >
          <p
            className="text-[12px] font-bold tracking-widest uppercase"
            style={{ color: "#A1A1AA" }}
          >
            كل الحسابات
          </p>
          <span className="text-[12px] font-medium" style={{ color: "#A1A1AA" }}>
            {allUsers.length} حساب
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#A1A1AA" }} />
          </div>
        ) : allUsers.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "#F4F4F5" }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, color: "#A1A1AA" }}
              >
                person_off
              </span>
            </div>
            <p className="text-[14px] font-bold" style={{ color: "#18181B" }}>
              لا توجد حسابات
            </p>
          </div>
        ) : (
          <div>
            {allUsers.map((u: any) => {
              const isAdminUser = u.role === "admin";
              return (
                <div
                  key={u.id}
                  className="flex flex-col md:flex-row md:items-center justify-between px-5 py-4 gap-3 transition-colors hover:bg-[#FAFAFA]"
                  style={{ borderBottom: "1px solid #F4F4F5" }}
                >
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] flex-shrink-0"
                      style={{
                        background: isAdminUser ? "#18181B" : "#F4F4F5",
                        color: isAdminUser ? "#fff" : "#71717A",
                      }}
                    >
                      {(u.name ?? u.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: "#18181B" }}
                        >
                          {u.name ?? u.username}
                        </span>
                        <span
                          className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                          style={{ background: "#F4F4F5", color: "#71717A" }}
                        >
                          @{u.username}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: isAdminUser ? "#F4F4F5" : "#F0FDF4",
                            color: isAdminUser ? "#18181B" : "#16A34A",
                          }}
                        >
                          {isAdminUser ? "أدمن" : "مدير فرع"}
                        </span>
                        {/* 🔒 حالة ربط الجهاز — للمديرين فقط */}
                        {!isAdminUser && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                            style={{
                              background: u.isDeviceBound ? "#EFF6FF" : "#FEFCE8",
                              color: u.isDeviceBound ? "#2563EB" : "#A16207",
                            }}
                            title={u.isDeviceBound ? "الحساب مربوط بموبايل محدد" : "لسه مسجلش دخول من أي موبايل"}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 11 }}
                            >
                              {u.isDeviceBound ? "smartphone" : "smartphone_question"}
                            </span>
                            {u.isDeviceBound ? "جهاز مربوط" : "بدون جهاز"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {u.email && (
                          <span
                            className="text-[12px]"
                            style={{ color: "#A1A1AA" }}
                          >
                            {u.email}
                          </span>
                        )}
                        {u.lastSignedIn && (
                          <span
                            className="text-[12px] font-mono"
                            style={{ color: "#A1A1AA" }}
                          >
                            آخر دخول:{" "}
                            {format(new Date(u.lastSignedIn), "dd MMM yyyy", {
                              locale: ar,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* 🔓 فك ربط الجهاز — للمديرين المربوطين فقط */}
                    {!isAdminUser && u.isDeviceBound && (
                      <button
                        onClick={() =>
                          setUnbindTarget({ id: u.id, name: u.name ?? u.username })
                        }
                        title="فك ربط الجهاز (للسماح بموبايل جديد)"
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#EFF6FF] cursor-pointer"
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16, color: "#2563EB" }}
                        >
                          link_off
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(u)}
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
                      onClick={() => handleDeleteClick(u)}
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

      {/* ── Create Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                  style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
                >
                  person_add
                </span>
              </div>
              <DialogTitle
                className="text-[15px] font-bold"
                style={{ color: "#18181B" }}
              >
                حساب جديد
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <Field label="الدور" icon="badge">
              <RoleSelector
                value={form.role}
                onChange={(v) => setForm((f) => ({ ...f, role: v }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="اسم المستخدم *" icon="alternate_email">
                <AdminInput
                  value={form.username}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      username: v.toLowerCase().replace(/\s/g, "."),
                    }))
                  }
                  placeholder="ahmed.ali"
                />
              </Field>
              <Field label="الاسم الكامل" icon="person">
                <AdminInput
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="أحمد علي"
                />
              </Field>
            </div>

            <Field label="كلمة السر *" icon="lock">
              <AdminInput
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder="6 أحرف على الأقل"
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="cursor-pointer"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 16, color: "#A1A1AA" }}
                    >
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                }
              />
            </Field>

            <Field label="البريد الإلكتروني" icon="mail">
              <AdminInput
                type="email"
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="ahmed@example.com"
              />
            </Field>

            {form.role === "user" && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: "#F0FDF4", border: "1px solid #D1FAE5" }}
              >
                <span
                  className="material-symbols-outlined flex-shrink-0 mt-0.5"
                  style={{ fontSize: 15, color: "#16A34A" }}
                >
                  info
                </span>
                <p className="text-[12px] leading-relaxed" style={{ color: "#15803D" }}>
                  بعد الإنشاء، اذهب لصفحة{" "}
                  <strong>المديرين</strong> لتخصيص الفروع.
                </p>
              </div>
            )}
          </div>

          <DialogFooter
            className="px-6 py-4 flex items-center justify-end gap-2"
            style={{ borderTop: "1px solid #F4F4F5" }}
          >
            <button
              onClick={() => setCreateOpen(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[#F4F4F5] cursor-pointer"
              style={{ color: "#71717A" }}
            >
              إلغاء
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{ background: "#18181B" }}
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              إنشاء الحساب
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
                  style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
                >
                  edit
                </span>
              </div>
              <DialogTitle
                className="text-[15px] font-bold"
                style={{ color: "#18181B" }}
              >
                تعديل الحساب
              </DialogTitle>
            </div>
          </DialogHeader>

          {editForm && (
            <div className="px-6 py-5 space-y-4">
              <Field label="الدور" icon="badge">
                <RoleSelector
                  value={editForm.role}
                  onChange={(v) =>
                    setEditForm((f) => (f ? { ...f, role: v } : f))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم المستخدم *" icon="alternate_email">
                  <AdminInput
                    value={editForm.username}
                    onChange={(v) =>
                      setEditForm((f) =>
                        f
                          ? {
                              ...f,
                              username: v.toLowerCase().replace(/\s/g, "."),
                            }
                          : f
                      )
                    }
                  />
                </Field>
                <Field label="الاسم الكامل" icon="person">
                  <AdminInput
                    value={editForm.name}
                    onChange={(v) =>
                      setEditForm((f) => (f ? { ...f, name: v } : f))
                    }
                  />
                </Field>
              </div>
              <Field label="كلمة السر الجديدة" icon="lock">
                <AdminInput
                  type={showEditPassword ? "text" : "password"}
                  value={editForm.password}
                  onChange={(v) =>
                    setEditForm((f) => (f ? { ...f, password: v } : f))
                  }
                  placeholder="اتركها فارغة للإبقاء على القديمة"
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowEditPassword((s) => !s)}
                      className="cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "#A1A1AA" }}
                      >
                        {showEditPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  }
                />
              </Field>
              <Field label="البريد الإلكتروني" icon="mail">
                <AdminInput
                  type="email"
                  value={editForm.email}
                  onChange={(v) =>
                    setEditForm((f) => (f ? { ...f, email: v } : f))
                  }
                />
              </Field>
            </div>
          )}

          <DialogFooter
            className="px-6 py-4 flex items-center justify-end gap-2"
            style={{ borderTop: "1px solid #F4F4F5" }}
          >
            <button
              onClick={() => setEditOpen(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[#F4F4F5] cursor-pointer"
              style={{ color: "#71717A" }}
            >
              إلغاء
            </button>
            <button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{ background: "#18181B" }}
            >
              {updateMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              حفظ التعديلات
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="p-0 overflow-hidden sm:rounded-2xl max-w-sm"
          style={{ background: "#fff", border: "1px solid #E4E4E7" }}
        >
          <DialogHeader
            className="px-6 py-4"
            style={{ borderBottom: "1px solid #F4F4F5" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "#FEF2F2" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 16,
                    color: "#DC2626",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  person_remove
                </span>
              </div>
              <DialogTitle
                className="text-[15px] font-bold"
                style={{ color: "#DC2626" }}
              >
                تأكيد الحذف
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-5">
            <p className="text-[13px] leading-relaxed" style={{ color: "#71717A" }}>
              ستحذف حساب{" "}
              <strong style={{ color: "#18181B" }}>{deleteTarget?.name}</strong>{" "}
              بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
            </p>
          </div>

          <DialogFooter
            className="px-6 py-4 flex items-center justify-end gap-2"
            style={{ borderTop: "1px solid #F4F4F5" }}
          >
            <button
              onClick={() => setDeleteOpen(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[#F4F4F5] cursor-pointer"
              style={{ color: "#71717A" }}
            >
              إلغاء
            </button>
            <button
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })
              }
              disabled={deleteMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#DC2626",
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              نعم، احذف
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 🔓 Unbind Device Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!unbindTarget} onOpenChange={(open) => !open && setUnbindTarget(null)}>
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
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#EFF6FF" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: "#2563EB" }}
                >
                  link_off
                </span>
              </div>
              <DialogTitle
                className="text-[15px] font-bold"
                style={{ color: "#18181B" }}
              >
                فك ربط الجهاز
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-5">
            <p className="text-[13px] leading-relaxed" style={{ color: "#71717A" }}>
              سيتم فك ربط جهاز المستخدم{" "}
              <strong style={{ color: "#18181B" }}>{unbindTarget?.name}</strong>.
              أول ما يسجل دخول من موبايله الجديد هيتربط بيه تلقائياً، ومش هينفع
              يدخل من أي موبايل تاني غيره.
            </p>
          </div>

          <DialogFooter
            className="px-6 py-4 flex items-center justify-end gap-2"
            style={{ borderTop: "1px solid #F4F4F5" }}
          >
            <button
              onClick={() => setUnbindTarget(null)}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[#F4F4F5] cursor-pointer"
              style={{ color: "#71717A" }}
            >
              إلغاء
            </button>
            <button
              onClick={() =>
                unbindTarget && unbindMutation.mutate({ id: unbindTarget.id })
              }
              disabled={unbindMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#2563EB",
              }}
            >
              {unbindMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              نعم، افك الربط
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
