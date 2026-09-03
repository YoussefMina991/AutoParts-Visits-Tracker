import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { compressImageFile, type ImageExtension } from "@/lib/imageCompression";
import { useLang } from "@/lib/i18n";
import { useAdminTheme } from "@/lib/adminTheme";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Design tokens — CSS vars scoped to .admin-root (see index.css) ──────────

// ─── Assign Branches Dialog ───────────────────────────────────────────────────
function AssignBranchesDialog({
  manager,
  onClose,
}: {
  manager: any;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useAdminTheme();
  const { data: branchesList = [] } = trpc.branch.list.useQuery();
  const { data: rawCurrentBranches = [], isLoading } =
    trpc.manager.getManagerBranches.useQuery(
      { managerId: manager.id },
      { enabled: !!manager }
    );
  // getManagerBranches يرجع [{ branchId, isPrimary }] — استخرج الـ IDs بس
  const currentIds = (rawCurrentBranches as any[]).map((b) => b.branchId as number);
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);
  const effectiveIds = selectedIds ?? currentIds;

  const assignMutation = trpc.manager.assignBranches.useMutation({
    onSuccess: () => {
      toast.success(t("managers.toastAssignUpdated"));
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
      className={`p-0 overflow-hidden sm:rounded-2xl max-w-md admin-root ${theme === 'dark' ? 'dark' : ''}`}
      style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)" }}
    >
      <DialogHeader
        className="px-6 py-4"
        style={{ borderBottom: "1px solid var(--adm-bg)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "var(--adm-accent)" }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, color: "var(--adm-accent-fg)", fontVariationSettings: "'FILL' 1" }}
            >
              account_tree
            </span>
          </div>
          <div>
            <DialogTitle
              className="text-[15px] font-bold leading-none"
              style={{ color: "var(--adm-text-1)" }}
            >
              {t("managers.assignTitle")}
            </DialogTitle>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--adm-text-2)" }}>
              {manager.userName ?? ""}
            </p>
          </div>
        </div>
      </DialogHeader>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--adm-text-3)" }} />
        </div>
      ) : (
        <div className="px-6 py-5 space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <p className="text-[12px]" style={{ color: "var(--adm-text-2)" }}>
              <span className="font-bold" style={{ color: "var(--adm-text-1)" }}>
                {selected.length}
              </span>{" "}
              {t("managers.selectedSuffix", { total: branches.length })}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() =>
                  setSelectedIds(branches.map((b: any) => b.id))
                }
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
                style={{ color: "var(--adm-text-1)" }}
              >
                {t("managers.selectAll")}
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-colors hover:bg-[var(--adm-red-soft)] cursor-pointer"
                style={{ color: "var(--adm-red)" }}
              >
                {t("managers.clearAll")}
              </button>
            </div>
          </div>

          {/* Branch list */}
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {branches.length === 0 ? (
              <div className="py-8 text-center">
                <span
                  className="material-symbols-outlined block mb-2"
                  style={{ fontSize: 32, color: "var(--adm-text-3)" }}
                >
                  domain_disabled
                </span>
                <p className="text-[13px]" style={{ color: "var(--adm-text-2)" }}>
                  {t("managers.noBranchesYet")}
                </p>
              </div>
            ) : (
              branches.map((b: any) => {
                const checked = selected.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => toggle(b.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer text-start"
                    style={{
                      background: checked ? "var(--adm-bg)" : "var(--adm-chip)",
                      borderColor: checked ? "var(--adm-accent)" : "var(--adm-border)",
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className="rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        width: 18,
                        height: 18,
                        background: checked ? "var(--adm-accent)" : "transparent",
                        borderColor: checked ? "var(--adm-accent)" : "var(--adm-text-3)",
                      }}
                    >
                      {checked && (
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 12, color: "var(--adm-accent-fg)" }}
                        >
                          check
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-start">
                      <p
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--adm-text-1)" }}
                      >
                        {b.name}
                      </p>
                      {b.address && (
                        <p
                          className="text-[11px] truncate"
                          style={{ color: "var(--adm-text-3)" }}
                        >
                          {b.address}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--adm-bg)", color: "var(--adm-text-2)" }}
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
        style={{ borderTop: "1px solid var(--adm-bg)" }}
      >
        <button
          onClick={onClose}
          className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
          style={{ color: "var(--adm-text-2)" }}
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={() =>
            assignMutation.mutate({
              managerId: manager.id,
              branches: selected.map(id => ({ branchId: id, isPrimary: "no" })),
            })
          }
          disabled={assignMutation.isPending || isLoading}
          className="h-9 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
          style={{ background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
        >
          {assignMutation.isPending && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          {t("managers.saveAssign")}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminManagers() {
  const { t } = useLang();
  const { theme } = useAdminTheme();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignManager, setAssignManager] = useState<any>(null);
  const [editPhotoManager, setEditPhotoManager] = useState<any>(null);
  const [updatePhotoFile, setUpdatePhotoFile] = useState<{ base64: string; ext: ImageExtension; preview: string } | null>(null);
  const [form, setForm] = useState({ userId: "", employeeCode: "", phone: "" });
  const [photoFile, setPhotoFile] = useState<{ base64: string; ext: ImageExtension; preview: string } | null>(null);

  const {
    data: managersList = [],
    isLoading,
    refetch,
  } = trpc.manager.list.useQuery();
  const { data: usersList = [] } = trpc.users.list.useQuery();

  const uploadPhotoMutation = trpc.manager.uploadPhoto.useMutation({
    onError: (e) => toast.error(t("managers.toastPhotoFailed", { msg: e.message })),
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
      toast.success(t("managers.toastAdded"));
      refetch();
      setCreateOpen(false);
      setForm({ userId: "", employeeCode: "", phone: "" });
      setPhotoFile(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.manager.delete.useMutation({
    onSuccess: () => {
      toast.success(t("managers.toastDeleted"));
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error(t("managers.toastPhotoTooLarge"));
      return;
    }
    try {
      // ✅ ضغط الصورة في المتصفح قبل الإرسال — بدل رفع ميجابيات خام
      const { base64, extension } = await compressImageFile(file);
      setPhotoFile({ base64, ext: extension, preview: base64 });
    } catch (err: any) {
      toast.error(t("managers.toastPhotoProcessFailed", { msg: err.message || String(err) }));
    }
  };

  const handleCreateSave = () => {
    if (!form.userId) {
      toast.error(t("managers.toastPickUser"));
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
      <div className="adm-page-header-inner">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--adm-text-1)", letterSpacing: "-0.02em" }}>
            {t("managers.title")}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--adm-text-2)" }}>
            {t("managers.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="h-9 px-4 flex items-center gap-1.5 rounded-xl text-[13px] font-bold transition-all hover:opacity-90 cursor-pointer"
          style={{ background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
            person_add
          </span>
          {t("managers.add")}
        </button>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: t("managers.kpiTotal"),
            value: isLoading ? "—" : managers.length,
            icon: "group",
            color: "var(--adm-text-1)",
            bg: "var(--adm-bg)",
          },
          {
            label: t("managers.kpiActive"),
            value: isLoading ? "—" : activeCount,
            icon: "person_check",
            color: "var(--adm-green)",
            bg: "var(--adm-green-soft)",
          },
        ].map(({ label, value, icon, color, bg }) => (
          <div
            key={label}
            className="flex items-center justify-between p-4"
            style={{
              background: "var(--adm-surface)",
              border: "1px solid var(--adm-border)",
              borderRadius: 16,
            }}
          >
            <div>
              <p
                className="text-[10px] font-bold tracking-widest uppercase mb-1"
                style={{ color: "var(--adm-text-3)" }}
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
          background: "var(--adm-surface)",
          border: "1px solid var(--adm-border)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--adm-bg)" }}
        >
          <p className="text-[12px] font-bold tracking-widest uppercase" style={{ color: "var(--adm-text-3)" }}>
            {t("managers.listTitle")}
          </p>
          <span className="text-[12px] font-medium" style={{ color: "var(--adm-text-3)" }}>
            {t("managers.count", { n: managers.length })}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--adm-text-3)" }} />
          </div>
        ) : managers.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--adm-bg)" }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, color: "var(--adm-text-3)" }}
              >
                group_off
              </span>
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: "var(--adm-text-1)" }}>
                {t("managers.noManagers")}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--adm-text-2)" }}>
                {t("managers.noManagersHint")}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {managers.map((m) => {
              const isActive = m.isActive === "yes";
              const initial = (m.userName ?? t("managers.unknownUser")).charAt(0).toUpperCase();
              return (
                <div
                  key={m.id}
                  className="flex flex-col md:flex-row md:items-center justify-between px-5 py-4 gap-3 transition-colors hover:bg-[var(--adm-chip)]"
                  style={{ borderBottom: "1px solid var(--adm-bg)" }}
                >
                  {/* Left: avatar + info */}
                  <div className="flex items-center gap-4">
                    {m.photoUrl ? (
                      <img
                        src={m.photoUrl}
                        alt={m.userName ?? ""}
                        style={{ width: 80, height: 80, borderRadius: 40, objectFit: "cover", flexShrink: 0, border: "1px solid var(--adm-border)" }}
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-[28px] flex-shrink-0"
                        style={{ background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
                      >
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: "var(--adm-text-1)" }}
                        >
                          {m.userName ?? t("managers.unknownUser")}
                        </span>
                        {m.employeeCode && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "var(--adm-bg)", color: "var(--adm-text-2)" }}
                          >
                            {m.employeeCode}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: isActive ? "var(--adm-green-soft)" : "var(--adm-red-soft)",
                            color: isActive ? "var(--adm-green)" : "var(--adm-red)",
                          }}
                        >
                          {isActive ? t("managers.statusActive") : t("managers.statusStopped")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {m.userEmail && (
                          <span
                            className="text-[12px]"
                            style={{ color: "var(--adm-text-3)" }}
                          >
                            {m.userEmail}
                          </span>
                        )}
                        {m.phone && (
                          <span
                            className="text-[12px] font-mono"
                            style={{ color: "var(--adm-text-3)" }}
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
                      onClick={() => setEditPhotoManager(m)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
                      title={t("managers.editPhoto")}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 15, color: "var(--adm-text-1)" }}
                      >
                        add_a_photo
                      </span>
                    </button>
                    <button
                      onClick={() => setAssignManager(m)}
                      className="h-8 px-3 flex items-center gap-1.5 rounded-xl text-[12px] font-semibold transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
                      style={{ color: "var(--adm-text-2)", border: "1px solid var(--adm-border)" }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 14 }}
                      >
                        account_tree
                      </span>
                      {t("managers.assignBranches")}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("managers.confirmDelete")))
                          deleteMutation.mutate({ id: m.id });
                      }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--adm-red-soft)] cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 15, color: "var(--adm-red)" }}
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
          className={`p-0 overflow-hidden sm:rounded-2xl max-w-md admin-root ${theme === 'dark' ? 'dark' : ''}`}
          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)" }}
        >
          <DialogHeader
            className="px-6 py-4"
            style={{ borderBottom: "1px solid var(--adm-bg)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--adm-accent)" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16, color: "var(--adm-accent-fg)", fontVariationSettings: "'FILL' 1" }}
                >
                  person_add
                </span>
              </div>
              <DialogTitle
                className="text-[15px] font-bold"
                style={{ color: "var(--adm-text-1)" }}
              >
                {t("managers.createTitle")}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            {/* User selector */}
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
                style={{ color: "var(--adm-text-3)" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 13, color: "var(--adm-text-3)" }}
                >
                  person
                </span>
                {t("managers.fieldUser")}
              </label>
              <div className="relative">
                <select
                  value={form.userId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, userId: e.target.value }))
                  }
                  className="w-full h-10 ps-3.5 pe-8 rounded-xl text-[13px] font-medium outline-none appearance-none transition-all cursor-pointer"
                  style={{
                    background: "var(--adm-bg)",
                    border: "1px solid var(--adm-border)",
                    color: form.userId ? "var(--adm-text-1)" : "var(--adm-text-3)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = "1px solid var(--adm-accent)";
                    e.currentTarget.style.background = "var(--adm-surface)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = "1px solid var(--adm-border)";
                    e.currentTarget.style.background = "var(--adm-bg)";
                  }}
                >
                  <option value="">{t("managers.pickUser")}</option>
                  {availableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.username} ({u.username})
                    </option>
                  ))}
                </select>
                <span
                  className="material-symbols-outlined absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ fontSize: 14, color: "var(--adm-text-3)" }}
                >
                  expand_more
                </span>
              </div>
              {availableUsers.length === 0 && (
                <p
                  className="text-[11px] mt-1.5 flex items-center gap-1 px-3 py-2 rounded-xl"
                  style={{ background: "var(--adm-amber-soft)", color: "var(--adm-amber)" }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 13 }}
                  >
                    warning
                  </span>
                  {t("managers.allUsersHaveProfiles")}
                </p>
              )}
            </div>

            {/* Photo upload */}
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
                style={{ color: "var(--adm-text-3)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: "var(--adm-text-3)" }}>
                  photo_camera
                </span>
                {t("managers.fieldPhoto")}
              </label>
              <label
                className="flex items-center gap-3 cursor-pointer"
                style={{
                  background: "var(--adm-bg)",
                  border: "1px dashed var(--adm-text-3)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  transition: "border-color .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--adm-accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--adm-text-3)")}
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
                      style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", flexShrink: 0, border: "2px solid var(--adm-border)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold" style={{ color: "var(--adm-text-1)" }}>{t("managers.photoSelected")}</p>
                      <p className="text-[11px]" style={{ color: "var(--adm-text-3)" }}>{t("managers.tapToChange")}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{ width: 44, height: 44, borderRadius: 22, background: "var(--adm-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--adm-text-3)", fontVariationSettings: "'FILL' 1" }}>
                        add_a_photo
                      </span>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: "var(--adm-text-2)" }}>{t("managers.tapToUpload")}</p>
                      <p className="text-[11px]" style={{ color: "var(--adm-text-3)" }}>{t("managers.photoHint")}</p>
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
                  label: t("managers.fieldEmployeeCode"),
                  placeholder: "MGR-001",
                  icon: "badge",
                },
                {
                  key: "phone",
                  label: t("managers.fieldPhone"),
                  placeholder: "01xxxxxxxxx",
                  icon: "phone",
                },
              ].map(({ key, label, placeholder, icon }) => (
                <div key={key}>
                  <label
                    className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase mb-2"
                    style={{ color: "var(--adm-text-3)" }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 12, color: "var(--adm-text-3)" }}
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
                      background: "var(--adm-bg)",
                      border: "1px solid var(--adm-border)",
                      color: "var(--adm-text-1)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = "1px solid var(--adm-accent)";
                      e.currentTarget.style.background = "var(--adm-surface)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = "1px solid var(--adm-border)";
                      e.currentTarget.style.background = "var(--adm-bg)";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter
            className="px-6 py-4 flex items-center justify-end gap-2"
            style={{ borderTop: "1px solid var(--adm-bg)" }}
          >
            <button
              onClick={() => setCreateOpen(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
              style={{ color: "var(--adm-text-2)" }}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleCreateSave}
              disabled={createMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{ background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {t("common.add")}
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

      {/* ── Update Photo Dialog ────────────────────────────────────────────────────── */}
      <Dialog
        open={!!editPhotoManager}
        onOpenChange={(open) => {
          if (!open) {
            setEditPhotoManager(null);
            setUpdatePhotoFile(null);
          }
        }}
      >
        <DialogContent
          className={`p-0 overflow-hidden sm:rounded-2xl max-w-md admin-root ${theme === 'dark' ? 'dark' : ''}`}
          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)" }}
        >
          <DialogHeader
            className="px-6 py-4"
            style={{ borderBottom: "1px solid var(--adm-bg)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--adm-accent)" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16, color: "var(--adm-accent-fg)", fontVariationSettings: "'FILL' 1" }}
                >
                  photo_camera
                </span>
              </div>
              <div>
                <DialogTitle
                  className="text-[15px] font-bold leading-none"
                  style={{ color: "var(--adm-text-1)" }}
                >
                  {t("managers.updatePhotoTitle")}
                </DialogTitle>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--adm-text-2)" }}>
                  {editPhotoManager?.userName ?? ""}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <label
              className="flex items-center gap-3 cursor-pointer"
              style={{
                background: "var(--adm-bg)",
                border: "1px dashed var(--adm-text-3)",
                borderRadius: 12,
                padding: "10px 14px",
                transition: "border-color .15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--adm-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--adm-text-3)")}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 15 * 1024 * 1024) {
                    toast.error(t("managers.toastPhotoTooLarge"));
                    return;
                  }
                  try {
                    const { base64, extension } = await compressImageFile(file);
                    setUpdatePhotoFile({ base64, ext: extension, preview: base64 });
                  } catch (err: any) {
                    toast.error(t("managers.toastPhotoProcessFailed", { msg: err.message || String(err) }));
                  }
                }}
              />
              {updatePhotoFile ? (
                <>
                  <img
                    src={updatePhotoFile.preview}
                    alt="preview"
                    style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", flexShrink: 0, border: "2px solid var(--adm-border)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold" style={{ color: "var(--adm-text-1)" }}>{t("managers.photoSelected")}</p>
                    <p className="text-[11px]" style={{ color: "var(--adm-text-3)" }}>{t("managers.tapToChange")}</p>
                  </div>
                </>
              ) : (
                <>
                  {editPhotoManager?.photoUrl ? (
                    <img
                      src={editPhotoManager.photoUrl}
                      alt="current"
                      style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", flexShrink: 0, border: "2px solid var(--adm-border)" }}
                    />
                  ) : (
                    <div
                      style={{ width: 44, height: 44, borderRadius: 22, background: "var(--adm-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--adm-text-3)", fontVariationSettings: "'FILL' 1" }}>
                        add_a_photo
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: "var(--adm-text-2)" }}>
                      {editPhotoManager?.photoUrl ? t("managers.changeCurrentPhoto") : t("managers.tapToUpload")}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--adm-text-3)" }}>{t("managers.photoHint")}</p>
                  </div>
                </>
              )}
            </label>
          </div>

          <DialogFooter
            className="px-6 py-4 flex items-center justify-end gap-2"
            style={{ borderTop: "1px solid var(--adm-bg)" }}
          >
            <button
              onClick={() => {
                setEditPhotoManager(null);
                setUpdatePhotoFile(null);
              }}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
              style={{ color: "var(--adm-text-2)" }}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={async () => {
                if (!updatePhotoFile || !editPhotoManager) return;
                try {
                  await uploadPhotoMutation.mutateAsync({
                    managerId: editPhotoManager.id,
                    base64: updatePhotoFile.base64,
                    extension: updatePhotoFile.ext,
                  });
                  toast.success(t("managers.toastPhotoUpdated"));
                  refetch();
                  setEditPhotoManager(null);
                  setUpdatePhotoFile(null);
                } catch (e: any) {
                  // error is handled by mutation onError
                }
              }}
              disabled={uploadPhotoMutation.isPending || !updatePhotoFile}
              className="h-9 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{ background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
            >
              {uploadPhotoMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {t("managers.savePhoto")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
