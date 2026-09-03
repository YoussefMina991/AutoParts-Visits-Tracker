import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

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
    distanceToPrevBranchKm: visit?.distanceToPrevBranchKm || 0,
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
        distanceToPrevBranchKm: visit.distanceToPrevBranchKm || 0,
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

  if (!visit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">تعديل الزيارة (صلاحية سوبر أدمن)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="grid grid-cols-1 gap-2">
            <Label>المسافة للفرع السابق (Km)</Label>
            <Input 
              type="number" 
              step="0.01"
              className="bg-zinc-900 border-zinc-800 text-left"
              dir="ltr"
              value={formData.distanceToPrevBranchKm}
              onChange={(e) => setFormData(p => ({ ...p, distanceToPrevBranchKm: parseFloat(e.target.value) }))}
            />
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
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
