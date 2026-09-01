import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Design tokens — CSS vars scoped to .admin-root (see index.css) ──────────

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
        style={{ color: "var(--adm-text-3)" }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 13, color: "var(--adm-text-3)" }}
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
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminBranches() {
  const { t } = useLang();
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
      toast.success(t("branches.toastAdded"));
      refetch();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.branch.update.useMutation({
    onSuccess: () => {
      toast.success(t("branches.toastUpdated"));
      refetch();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.branch.delete.useMutation({
    onSuccess: () => {
      toast.success(t("branches.toastDeleted"));
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
      toast.error(t("branches.toastRequired"));
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
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--adm-text-1)" }}>
            {t("branches.title")}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--adm-text-2)" }}>
            {t("branches.subtitle")}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="h-9 px-4 flex items-center gap-1.5 rounded-xl text-[13px] font-bold transition-all hover:opacity-90 cursor-pointer"
          style={{ background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
            add
          </span>
          {t("branches.add")}
        </button>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: t("branches.kpiTotal"),
            value: isLoading ? "—" : list.length,
            icon: "location_city",
            color: "var(--adm-text-1)",
            bg: "var(--adm-bg)",
          },
          {
            label: t("branches.kpiActive"),
            value: isLoading ? "—" : activeCount,
            icon: "check_circle",
            color: "var(--adm-green)",
            bg: "var(--adm-green-soft)",
          },
          {
            label: t("branches.kpiInactive"),
            value: isLoading ? "—" : list.length - activeCount,
            icon: "cancel",
            color: "var(--adm-red)",
            bg: "var(--adm-red-soft)",
          },
          {
            label: t("branches.kpiActiveRate"),
            value: isLoading ? "—" : `${actPct}%`,
            icon: "percent",
            color: "var(--adm-text-2)",
            bg: "var(--adm-bg)",
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

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--adm-surface)",
          border: "1px solid var(--adm-border)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Search bar */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--adm-bg)" }}
        >
          <div className="relative flex-1 max-w-sm">
            <span
              className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2"
              style={{ fontSize: 16, color: "var(--adm-text-3)" }}
            >
              search
            </span>
            <input
              type="text"
              placeholder={t("branches.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 ps-9 pe-3 rounded-full text-[13px] outline-none transition-all"
              style={{ background: "var(--adm-bg)", border: "1px solid transparent", color: "var(--adm-text-1)" }}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid var(--adm-border)";
                e.currentTarget.style.background = "var(--adm-surface)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid transparent";
                e.currentTarget.style.background = "var(--adm-bg)";
              }}
            />
          </div>
          <span className="text-[12px] font-medium" style={{ color: "var(--adm-text-3)" }}>
            {t("branches.count", { n: filtered.length })}
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--adm-text-3)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--adm-bg)" }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, color: "var(--adm-text-3)" }}
              >
                location_off
              </span>
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: "var(--adm-text-1)" }}>
                {t("branches.noBranches")}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--adm-text-2)" }}>
                {t("branches.noBranchesHint")}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Table Header (desktop) */}
            <div
              className="hidden md:grid grid-cols-[2fr_1fr_2fr_1fr_1fr_auto] px-5 py-2.5"
              style={{ borderBottom: "1px solid var(--adm-bg)" }}
            >
              {[t("branches.thName"), t("branches.thCode"), t("branches.thAddress"), t("branches.thGeofence"), t("branches.thStatus"), ""].map(
                (h, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold tracking-widest uppercase"
                    style={{ color: "var(--adm-text-3)" }}
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
                  className="flex flex-col md:grid md:grid-cols-[2fr_1fr_2fr_1fr_1fr_auto] md:items-center px-5 py-3.5 gap-2 md:gap-0 transition-colors hover:bg-[var(--adm-chip)]"
                  style={{ borderBottom: "1px solid var(--adm-bg)" }}
                >
                  {/* Name */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--adm-bg)" }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 16,
                          color: "var(--adm-text-2)",
                          fontVariationSettings: "'FILL' 1",
                        }}
                      >
                        location_on
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold" style={{ color: "var(--adm-text-1)" }}>
                      {b.name}
                    </span>
                  </div>

                  {/* Code */}
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full w-fit"
                    style={{ background: "var(--adm-bg)", color: "var(--adm-text-2)" }}
                  >
                    {b.code}
                  </span>

                  {/* Address */}
                  <span
                    className="text-[12px] truncate max-w-[200px]"
                    style={{ color: "var(--adm-text-2)" }}
                  >
                    {b.address || "—"}
                  </span>

                  {/* Geofence */}
                  <span
                    className="text-[12px] font-mono flex items-center gap-1"
                    style={{ color: "var(--adm-text-2)" }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 13, color: "var(--adm-text-3)" }}
                    >
                      radar
                    </span>
                    {t("branches.geofenceMeters", { n: b.geofenceRadiusMeters })}
                  </span>

                  {/* Status */}
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full w-fit"
                    style={{
                      background: isActive ? "var(--adm-green-soft)" : "var(--adm-red-soft)",
                      color: isActive ? "var(--adm-green)" : "var(--adm-red)",
                    }}
                  >
                    {isActive ? t("branches.statusActive") : t("branches.statusStopped")}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => openEdit(b)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "var(--adm-text-2)" }}
                      >
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("branches.confirmDelete")))
                          deleteMutation.mutate({ id: b.id });
                      }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--adm-red-soft)] cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "var(--adm-red)" }}
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
                  style={{
                    fontSize: 16,
                    color: "var(--adm-accent-fg)",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  {editId ? "edit" : "add_location"}
                </span>
              </div>
              <DialogTitle
                className="text-[15px] font-bold"
                style={{ color: "var(--adm-text-1)" }}
              >
                {editId ? t("branches.editTitle") : t("branches.addTitle")}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <Field label={t("branches.fieldName")} icon="badge">
              <AdminInput
                value={form.name}
                onChange={(v) => setField("name", v)}
                placeholder={t("branches.phName")}
              />
            </Field>
            <Field label={t("branches.fieldCode")} icon="tag">
              <AdminInput
                value={form.code}
                onChange={(v) => setField("code", v)}
                placeholder={t("branches.phCode")}
              />
            </Field>
            <Field label={t("branches.fieldAddress")} icon="map">
              <AdminInput
                value={form.address}
                onChange={(v) => setField("address", v)}
                placeholder={t("branches.phOptional")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("branches.fieldLat")} icon="public">
                <AdminInput
                  value={form.latitude}
                  onChange={(v) => setField("latitude", v)}
                  placeholder="30.0444"
                />
              </Field>
              <Field label={t("branches.fieldLng")} icon="public">
                <AdminInput
                  value={form.longitude}
                  onChange={(v) => setField("longitude", v)}
                  placeholder="31.2357"
                />
              </Field>
            </div>
            <Field label={t("branches.fieldGeofence")} icon="radar">
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
            style={{ borderTop: "1px solid var(--adm-bg)" }}
          >
            <button
              onClick={() => setOpen(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-[var(--adm-bg)] cursor-pointer"
              style={{ color: "var(--adm-text-2)" }}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={{ background: "var(--adm-accent)", color: "var(--adm-accent-fg)" }}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {t("common.save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
