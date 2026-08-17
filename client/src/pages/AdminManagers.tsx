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
// bg: #F4F4F5  surface: #FFFFFF  border: #E4E4E7
// text-1: #18181B  text-2: #71717A  text-3: #A1A1AA
// accent: #18181B  green: #16A34A  red: #DC2626

// ─── Assign Branches Dialog ───────────────────────────────────────────────────
function AssignBranchesDialog({
  manager,
  onClose,
}: {
  manager: any;
  onClose: () => void;
}) {
  const { data: branchesList = [] } = trpc.branch.list.useQuery();
  const { data: currentIds = [], isLoading } =
    trpc.manager.getManagerBranches.useQuery(
      { managerId: manager.id },
      { enabled: !!manager }
    );
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);
  const effectiveIds = selectedIds ?? currentIds;

  const assignMutation = trpc.manager.assignBranches.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الفروع المخصصة");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const base = prev ?? (currentIds as number[]);
      return base.includes(id) ? base.filter((b) => b !== id) : [...base, id];
    });
  };

  const branches = branchesList as any[];
  const selected = effectiveIds as number[];

  return (
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
              account_tree
            </span>
          </div>
          <div>
            <DialogTitle
              className="text-[15px] font-bold leading-none"
              style={{ color: "#18181B" }}
            >
              تخصيص فروع
            </DialogTitle>
            <p className="text-[12px] mt-0.5" style={{ color: "#71717A" }}>
              {manager.userName ?? ""}
            </p>
          </div>
        </div>
      </DialogHeader>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#A1A1AA" }} />
        </div>
      ) : (
        <div className="px-6 py-4 space-y-3">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <p className="text-[12px]" style={{ color: "#71717A" }}>
              <span className="font-bold" style={{ color: "#18181B" }}>
                {selected.length}
              </span>{" "}
              من {branches.length} فرع محدد
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() =>
                  setSelectedIds(branches.map((b: any) => b.id))
                }
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-colors hover:bg-[#F4F4F5] cursor-pointer"
                style={{ color: "#18181B" }}
              >
                تحديد الكل
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-colors hover:bg-[#FEF2F2] cursor-pointer"
                style={{ color: "#DC2626" }}
              >
                إلغاء الكل
              </button>
            </div>
          </div>

          {/* Branch list */}
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {branches.length === 0 ? (
              <div className="py-8 text-center">
                <span
                  className="material-symbols-outlined block mb-2"
                  style={{ fontSize: 32, color: "#A1A1AA" }}
                >
                  domain_disabled
                </span>
                <p className="text-[13px]" style={{ color: "#71717A" }}>
                  لا توجد فروع — أضف فروعاً أولاً
                </p>
              </div>
            ) : (
              branches.map((b: any) => {
                const checked = selected.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => toggle(b.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer text-right"
                    style={{
                      background: checked ? "#F4F4F5" : "#FAFAFA",
                      borderColor: checked ? "#18181B" : "#E4E4E7",
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className="w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        width: 18,
                        height: 18,
                        background: checked ? "#18181B" : "transparent",
                        borderColor: checked ? "#18181B" : "#D1D5DB",
                      }}
                    >
                      {checked && (
                        <span
                          className="material-symbols-outlined text-white"
                          style={{ fontSize: 12 }}
                        >
                          check
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p
                        className="text-[13px] font-semibold"
                        style={{ color: "#18181B" }}
                      >
                        {b.name}
                      </p>
                      {b.address && (
                        <p
                          className="text-[11px] truncate"
                          style={{ color: "#A1A1AA" }}
                        >
                          {b.address}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "#F4F4F5", color: "#71717A" }}
                    >
                      {b.code}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <DialogFooter
        className="px-6 py-4 flex items-center justify-end gap-2"
        style={{ borderTop: "1px solid #F4F4F5" }}
      >
        <button
          onClick={onClose}
          className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[#F4F4F5] cursor-pointer"
          style={{ color: "#71717A" }}
        >
          إلغاء
        </button>
        <button
          onClick={() =>
            assignMutation.mutate({
              managerId: manager.id,
              branchIds: selected,
            })
          }
          disabled={assignMutation.isPending || isLoading}
          className="h-9 px-5 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
          style={{ background: "#18181B" }}
        >
          {assignMutation.isPending && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          حفظ التخصيص
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminManagers() {
  const [createOpen, setCreateOpen] = useState(false);
  const [assignManager, setAssignManager] = useState<any>(null);
  const [form, setForm] = useState({ userId: "", employeeCode: "", phone: "" });
  const [photoFile, setPhotoFile] = useState<{ base64: string; ext: string; preview: string } | null>(null);

  const {
    data: managersList = [],
    isLoading,
    refetch,
  } = trpc.manager.list.useQuery();
  const { data: usersList = [] } = trpc.users.list.useQuery();

  const uploadPhotoMutation = trpc.manager.uploadPhoto.useMutation({
    onError: (e) => toast.error("فشل رفع الصورة: " + e.message),
  });

  const createMutation = trpc.manager.create.useMutation({
    onSuccess: async (_, vars) => {
      // لو في صورة، ارفعها بعد إنشاء المدير
      if (photoFile) {
        // جيب الـ id بتاع المدير الجديد من القائمة
        await refetch();
        const freshList = (await refetch()).data as any[];
        const newManager = freshList?.find((m: any) => m.userId === Number(form.userId));
        if (newManager) {
          await uploadPhotoMutation.mutateAsync({
            managerId: newManager.id,
            base64: photoFile.base64,
            extension: photoFile.ext,
          });
        }
      }
      toast.success("تم إضافة المدير");
      refetch();
      setCreateOpen(false);
      setForm({ userId: "", employeeCode: "", phone: "" });
      setPhotoFile(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.manager.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المدير");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("الصورة أكبر من 5 ميجا");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoFile({ base64, ext, preview: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSave = () => {
    if (!form.userId) {
      toast.error("يرجى اختيار المستخدم");
      return;
    }
    createMutation.mutate({
      userId: Number(form.userId),
      employeeCode: form.employeeCode || undefined,
      phone: form.phone || undefined,
    });
  };

  const managers = managersList as any[];
  const users = usersList as any[];
  const existingManagerUserIds = new Set(managers.map((m) => m.userId));
  const availableUsers = users.filter(
    (u) => u.role === "user" && !existingManagerUserIds.has(u.id)
  );
  const activeCount = managers.filter((m) => m.isActive === "yes").length;

  return (
    <div className="p-5 md:p-7 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "#18181B" }}>
            المديرون
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#71717A" }}>
            إدارة مديري الفروع وتخصيص مواقعهم
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="h-9 px-4 flex items-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 cursor-pointer"
          style={{ background: "#18181B" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
            person_add
          </span>
          مدير جديد
        </button>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "إجمالي المديرين",
            value: isLoading ? "—" : managers.length,
            icon: "group",
            color: "#18181B",
            bg: "#F4F4F5",
          },
          {
            label: "نشط حالياً",
            value: isLoading ? "—" : activeCount,
            icon: "person_check",
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

      {/* ── Managers List ────────────────────────────────────────────────────── */}
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
          <p className="text-[12px] font-bold tracking-widest uppercase" style={{ color: "#A1A1AA" }}>
            قائمة المديرين
          </p>
          <span className="text-[12px] font-medium" style={{ color: "#A1A1AA" }}>
            {managers.length} مدير
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#A1A1AA" }} />
          </div>
        ) : managers.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "#F4F4F5" }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, color: "#A1A1AA" }}
              >
                group_off
              </span>
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: "#18181B" }}>
                لا يوجد مديرون بعد
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "#71717A" }}>
                اضغط "مدير جديد" للبدء
              </p>
            </div>
          </div>
        ) : (
          <div>
            {managers.map((m) => {
              const isActive = m.isActive === "yes";
              const initial = (m.userName ?? "م").charAt(0).toUpperCase();
              return (
                <div
                  key={m.id}
                  className="flex flex-col md:flex-row md:items-center justify-between px-5 py-4 gap-3 transition-colors hover:bg-[#FAFAFA]"
                  style={{ borderBottom: "1px solid #F4F4F5" }}
                >
                  {/* Left: avatar + info */}
                  <div className="flex items-center gap-3">
                    {m.photoUrl ? (
                      <img
                        src={m.photoUrl}
                        alt={m.userName ?? ""}
                        style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover", flexShrink: 0, border: "1px solid #E4E4E7" }}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-[14px] flex-shrink-0"
                        style={{ background: "#18181B" }}
                      >
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: "#18181B" }}
                        >
                          {m.userName ?? "مستخدم غير معروف"}
                        </span>
                        {m.employeeCode && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "#F4F4F5", color: "#71717A" }}
                          >
                            {m.employeeCode}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: isActive ? "#F0FDF4" : "#FEF2F2",
                            color: isActive ? "#16A34A" : "#DC2626",
                          }}
                        >
                          {isActive ? "نشط" : "متوقف"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {m.userEmail && (
                          <span
                            className="text-[12px]"
                            style={{ color: "#A1A1AA" }}
                          >
                            {m.userEmail}
                          </span>
                        )}
                        {m.phone && (
                          <span
                            className="text-[12px] font-mono"
                            style={{ color: "#A1A1AA" }}
                          >
                            {m.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1.5 self-end md:self-auto">
                    <button
                      onClick={() => setAssignManager(m)}
                      className="h-8 px-3 flex items-center gap-1.5 rounded-xl text-[12px] font-semibold transition-colors hover:bg-[#F4F4F5] cursor-pointer"
                      style={{ color: "#71717A", border: "1px solid #E4E4E7" }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 14 }}
                      >
                        account_tree
                      </span>
                      تخصيص فروع
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("حذف هذا المدير؟"))
                          deleteMutation.mutate({ id: m.id });
                      }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#FEF2F2] cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 15, color: "#DC2626" }}
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
                مدير جديد
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            {/* User selector */}
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
                style={{ color: "#A1A1AA" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 13, color: "#A1A1AA" }}
                >
                  person
                </span>
                المستخدم *
              </label>
              <div className="relative">
                <select
                  value={form.userId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, userId: e.target.value }))
                  }
                  className="w-full h-10 pr-3.5 pl-8 rounded-xl text-[13px] font-medium outline-none appearance-none transition-all cursor-pointer"
                  style={{
                    background: "#F4F4F5",
                    border: "1px solid #E4E4E7",
                    color: form.userId ? "#18181B" : "#A1A1AA",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = "1px solid #18181B";
                    e.currentTarget.style.background = "#fff";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = "1px solid #E4E4E7";
                    e.currentTarget.style.background = "#F4F4F5";
                  }}
                >
                  <option value="">-- اختر مستخدم --</option>
                  {availableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.username} ({u.username})
                    </option>
                  ))}
                </select>
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ fontSize: 14, color: "#A1A1AA" }}
                >
                  expand_more
                </span>
              </div>
              {availableUsers.length === 0 && (
                <p
                  className="text-[11px] mt-1.5 flex items-center gap-1 px-3 py-2 rounded-xl"
                  style={{ background: "#FEF9C3", color: "#A16207" }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 13 }}
                  >
                    warning
                  </span>
                  جميع المستخدمين لديهم بروفايل مدير
                </p>
              )}
            </div>

            {/* Photo upload */}
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
                style={{ color: "#A1A1AA" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#A1A1AA" }}>
                  photo_camera
                </span>
                صورة المدير (اختياري)
              </label>
              <label
                className="flex items-center gap-3 cursor-pointer"
                style={{
                  background: "#F4F4F5",
                  border: "1px dashed #D4D4D8",
                  borderRadius: 12,
                  padding: "10px 14px",
                  transition: "border-color .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#18181B")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#D4D4D8")}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                {photoFile ? (
                  <>
                    <img
                      src={photoFile.preview}
                      alt="preview"
                      style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", flexShrink: 0, border: "2px solid #E4E4E7" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold" style={{ color: "#18181B" }}>تم اختيار الصورة ✓</p>
                      <p className="text-[11px]" style={{ color: "#A1A1AA" }}>اضغط لتغييرها</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{ width: 44, height: 44, borderRadius: 22, background: "#E4E4E7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#A1A1AA", fontVariationSettings: "'FILL' 1" }}>
                        add_a_photo
                      </span>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: "#71717A" }}>اضغط لرفع صورة</p>
                      <p className="text-[11px]" style={{ color: "#A1A1AA" }}>JPG أو PNG — حد أقصى 5 ميجا</p>
                    </div>
                  </>
                )}
              </label>
            </div>

            {/* Employee code + phone */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  key: "employeeCode",
                  label: "كود الموظف",
                  placeholder: "MGR-001",
                  icon: "badge",
                },
                {
                  key: "phone",
                  label: "رقم الهاتف",
                  placeholder: "01xxxxxxxxx",
                  icon: "phone",
                },
              ].map(({ key, label, placeholder, icon }) => (
                <div key={key}>
                  <label
                    className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
                    style={{ color: "#A1A1AA" }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 12, color: "#A1A1AA" }}
                    >
                      {icon}
                    </span>
                    {label}
                  </label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
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
                </div>
              ))}
            </div>
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
              onClick={handleCreateSave}
              disabled={createMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{ background: "#18181B" }}
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              إضافة
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Dialog ────────────────────────────────────────────────────── */}
      <Dialog
        open={!!assignManager}
        onOpenChange={() => setAssignManager(null)}
      >
        {assignManager && (
          <AssignBranchesDialog
            manager={assignManager}
            onClose={() => setAssignManager(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
