import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

interface SuperadminCreateVisitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managers: any[];
}

export function SuperadminCreateVisitModal({ open, onOpenChange, managers }: SuperadminCreateVisitModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    managerId: "",
    branchId: "", // Optional, but usually provided for "branch" type
    visitType: "branch",
    noteType: "general",
    checkInAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    checkOutAt: "",
    status: "checked_in",
    isMocked: "no",
    notes: "",
    latitudeIn: "0.000000",
    longitudeIn: "0.000000",
  });

  const createMutation = trpc.visit.superadminCreate.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الزيارة بنجاح (سوبر أدمن)");
      queryClient.invalidateQueries();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء الإنشاء");
    },
    onSettled: () => setLoading(false)
  });

  const handleSave = () => {
    if (!formData.managerId) {
      toast.error("يرجى اختيار المدير");
      return;
    }
    if (!formData.checkInAt) {
      toast.error("يرجى تحديد وقت الحضور");
      return;
    }

    setLoading(true);
    createMutation.mutate({
      managerId: Number(formData.managerId),
      branchId: formData.branchId ? Number(formData.branchId) : null,
      visitType: formData.visitType as any,
      noteType: formData.noteType as any,
      checkInAt: new Date(formData.checkInAt).toISOString(),
      checkOutAt: formData.checkOutAt ? new Date(formData.checkOutAt).toISOString() : null,
      status: formData.status as any,
      isMocked: formData.isMocked as any,
      notes: formData.notes || null,
      latitudeIn: formData.latitudeIn,
      longitudeIn: formData.longitudeIn,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">إضافة زيارة جديدة (صلاحية سوبر أدمن)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-2">
            <Label>المدير</Label>
            <Select value={formData.managerId} onValueChange={(v) => setFormData(p => ({ ...p, managerId: v }))}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="اختر المدير" /></SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>{m.name || m.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label>رقم الفرع (Branch ID) - اختياري</Label>
            <Input 
              type="number"
              className="bg-zinc-900 border-zinc-800 text-left"
              dir="ltr"
              value={formData.branchId}
              onChange={(e) => setFormData(p => ({ ...p, branchId: e.target.value }))}
              placeholder="مثال: 1"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label>وقت الحضور (Check-in)</Label>
            <Input 
              type="datetime-local" 
              className="bg-zinc-900 border-zinc-800 text-left"
              dir="ltr"
              value={formData.checkInAt}
              onChange={(e) => setFormData(p => ({ ...p, checkInAt: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label>وقت الانصراف (Check-out)</Label>
            <Input 
              type="datetime-local" 
              className="bg-zinc-900 border-zinc-800 text-left"
              dir="ltr"
              value={formData.checkOutAt}
              onChange={(e) => setFormData(p => ({ ...p, checkOutAt: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>حالة الزيارة</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checked_in">مفتوحة (Checked In)</SelectItem>
                  <SelectItem value="checked_out">منتهية (Checked Out)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>تلاعب (Mocked)</Label>
              <Select value={formData.isMocked} onValueChange={(v) => setFormData(p => ({ ...p, isMocked: v }))}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">نعم</SelectItem>
                  <SelectItem value="no">لا</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>نوع الزيارة</Label>
              <Select value={formData.visitType} onValueChange={(v) => setFormData(p => ({ ...p, visitType: v }))}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch">فرع</SelectItem>
                  <SelectItem value="external_mission">مهمة خارجية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>نوع الملاحظة</Label>
              <Select value={formData.noteType} onValueChange={(v) => setFormData(p => ({ ...p, noteType: v }))}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">عامة</SelectItem>
                  <SelectItem value="short_visit">قصيرة</SelectItem>
                  <SelectItem value="non_primary">غير أساسي</SelectItem>
                  <SelectItem value="external_mission">مهمة خارجية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Latitude</Label>
              <Input 
                type="text" 
                className="bg-zinc-900 border-zinc-800 text-left"
                dir="ltr"
                value={formData.latitudeIn}
                onChange={(e) => setFormData(p => ({ ...p, latitudeIn: e.target.value }))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Longitude</Label>
              <Input 
                type="text" 
                className="bg-zinc-900 border-zinc-800 text-left"
                dir="ltr"
                value={formData.longitudeIn}
                onChange={(e) => setFormData(p => ({ ...p, longitudeIn: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label>الملاحظات (Notes)</Label>
            <Input 
              className="bg-zinc-900 border-zinc-800"
              value={formData.notes}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            إنشاء الزيارة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
