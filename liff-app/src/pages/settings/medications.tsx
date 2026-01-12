import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Plus,
  Pill,
  Clock,
  Calendar,
  Edit2,
  Trash2,
  Loader2,
  Bell,
  BellOff,
  X,
  Save,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  usePatientMedicationsAll,
  useAddMedication,
  useUpdateMedication,
  useDeleteMedication,
  type Medication,
} from '@/lib/api/hooks/use-profile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePatientId } from '@/hooks/use-patient-id';

const TIME_OPTIONS = [
  { value: 'morning', label: 'เช้า (08:00)' },
  { value: 'afternoon', label: 'กลางวัน (12:00)' },
  { value: 'evening', label: 'เย็น (18:00)' },
  { value: 'night', label: 'ก่อนนอน (21:00)' },
];

const TIME_LABELS: Record<string, string> = {
  morning: 'เช้า',
  afternoon: 'กลางวัน',
  evening: 'เย็น',
  night: 'ก่อนนอน',
};

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'ทุกวัน' },
  { value: 'specific_days', label: 'เลือกวัน' },
  { value: 'as_needed', label: 'เมื่อจำเป็น' },
];

const DAY_OPTIONS = [
  { value: 'monday', label: 'จันทร์' },
  { value: 'tuesday', label: 'อังคาร' },
  { value: 'wednesday', label: 'พุธ' },
  { value: 'thursday', label: 'พฤหัสบดี' },
  { value: 'friday', label: 'ศุกร์' },
  { value: 'saturday', label: 'เสาร์' },
  { value: 'sunday', label: 'อาทิตย์' },
];

interface MedicationForm {
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  dosage_form: string;
  frequency: string;
  days_of_week: string[];
  times: string[];
  instructions: string;
  note: string;
  reminder_enabled: boolean;
}

const defaultFormData: MedicationForm = {
  name: '',
  dosage_amount: 1,
  dosage_unit: 'tablet',
  dosage_form: 'tablet',
  frequency: 'daily',
  days_of_week: [],
  times: [],
  instructions: '',
  note: '',
  reminder_enabled: true,
};

export default function MedicationsPage() {
  const [, navigate] = useLocation();
  const { patientId, source } = usePatientId();
  const { toast } = useToast();

  // Debug: Log patientId source
  console.log('[MedicationsPage] patientId:', patientId, 'source:', source);

  const { data: medications, isLoading } = usePatientMedicationsAll(patientId);
  const addMedication = useAddMedication();
  const updateMedication = useUpdateMedication();
  const deleteMedication = useDeleteMedication();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MedicationForm>(defaultFormData);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingId(med.id);
    setFormData({
      name: med.name,
      dosage_amount: med.dosage_amount || 1,
      dosage_unit: med.dosage_unit || 'tablet',
      dosage_form: med.dosage_form || 'tablet',
      frequency: med.frequency || 'daily',
      days_of_week: med.days_of_week || [],
      times: med.times || [],
      instructions: med.instructions || '',
      note: med.note || '',
      reminder_enabled: med.reminder_enabled !== false,
    });
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    if (!confirm('ต้องการลบรายการยานี้หรือไม่?')) return;

    try {
      await deleteMedication.mutateAsync({ id, patientId });
      toast({ title: 'ลบรายการยาเรียบร้อยแล้ว' });
    } catch {
      toast({ title: 'ไม่สามารถลบรายการยาได้', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    console.log('[MedicationsPage] handleSubmit called, patientId:', patientId);

    if (!patientId) {
      toast({ title: 'ไม่พบข้อมูลผู้ป่วย กรุณาลงทะเบียนก่อน', variant: 'destructive' });
      return;
    }
    if (!formData.name.trim()) {
      toast({ title: 'กรุณาระบุชื่อยา', variant: 'destructive' });
      return;
    }
    if (formData.times.length === 0 && formData.frequency !== 'as_needed') {
      toast({ title: 'กรุณาเลือกเวลาทานยา', variant: 'destructive' });
      return;
    }

    try {
      console.log('[MedicationsPage] Submitting medication:', formData);

      if (editingId) {
        await updateMedication.mutateAsync({
          id: editingId,
          data: { ...formData, patient_id: patientId },
        });
        toast({ title: 'แก้ไขรายการยาเรียบร้อยแล้ว' });
      } else {
        await addMedication.mutateAsync({
          ...formData,
          patient_id: patientId,
          active: true,
        });
        toast({ title: 'เพิ่มรายการยาเรียบร้อยแล้ว' });
      }
      setDrawerOpen(false);
    } catch (error) {
      console.error('[MedicationsPage] Error saving medication:', error);
      toast({ title: 'ไม่สามารถบันทึกรายการยาได้', variant: 'destructive' });
    }
  };

  const toggleTime = (time: string) => {
    setFormData((prev) => ({
      ...prev,
      times: prev.times.includes(time)
        ? prev.times.filter((t) => t !== time)
        : [...prev.times, time],
    }));
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const formatDosage = (med: Medication) => {
    const amount = med.dosage_amount || 1;
    if (amount === 0.25) return '1/4 เม็ด';
    if (amount === 0.5) return '1/2 เม็ด';
    if (amount === 0.75) return '3/4 เม็ด';
    return `${amount} เม็ด`;
  };

  // If no patientId, show error state with re-auth option
  if (!patientId) {
    return (
      <div className="min-h-screen pb-8 font-sans bg-background">
        <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">รายการยา</h1>
        </header>

        <main className="max-w-md mx-auto px-4 py-6">
          <Card className="border-destructive/20">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <Pill className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">ไม่พบข้อมูลผู้ป่วย</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  กรุณากลับไปหน้าแรกเพื่อตรวจสอบการลงทะเบียน
                </p>
              </div>
              <div className="pt-2 space-y-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    // Clear auth and redirect to home
                    localStorage.removeItem('oonjai_auth');
                    localStorage.removeItem('oonjai_user');
                    navigate('/');
                  }}
                >
                  ไปหน้าแรก (ล้างข้อมูล)
                </Button>
                <p className="text-xs text-muted-foreground">
                  Debug: source={source}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8 font-sans bg-background">
      {/* Header */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">รายการยา</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Summary */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-sm text-white/80">รายการยาทั้งหมด</p>
              <p className="text-4xl font-bold mt-1">
                {medications?.length || 0} <span className="text-lg font-normal">รายการ</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Add Button */}
        <Button className="w-full gap-2" size="lg" onClick={handleOpenAdd}>
          <Plus className="w-5 h-5" />
          เพิ่มรายการยา
        </Button>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!medications || medications.length === 0) && (
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <Pill className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-bold text-foreground">ยังไม่มีรายการยา</p>
              <p className="text-sm text-muted-foreground mt-1">กดปุ่มด้านบนเพื่อเพิ่มยา</p>
            </CardContent>
          </Card>
        )}

        {/* Medication List */}
        {medications && medications.length > 0 && (
          <div className="space-y-3">
            {medications.map((med) => (
              <Card key={med.id} className="border-none shadow-sm bg-card overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-foreground">{med.name}</h3>
                      <p className="text-sm text-muted-foreground">{formatDosage(med)}</p>
                    </div>
                    <div className={cn(
                      'p-1.5 rounded-full',
                      med.reminder_enabled ? 'bg-green-100 dark:bg-green-950/30' : 'bg-muted'
                    )}>
                      {med.reminder_enabled ? (
                        <Bell className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <BellOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {med.frequency === 'daily'
                        ? 'ทุกวัน'
                        : med.frequency === 'as_needed'
                          ? 'เมื่อจำเป็น'
                          : med.days_of_week?.join(', ') || 'ตามแพทย์สั่ง'}
                    </span>
                  </div>

                  {med.times && med.times.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {med.times.map((time) => (
                        <span
                          key={time}
                          className="px-2 py-1 bg-muted rounded-md text-xs font-medium text-muted-foreground"
                        >
                          {TIME_LABELS[time] || time}
                        </span>
                      ))}
                    </div>
                  )}

                  {med.instructions && (
                    <p className="text-xs text-muted-foreground mb-3">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {med.instructions}
                    </p>
                  )}

                  {med.note && (
                    <div className="p-2 bg-accent/10 border-l-2 border-accent rounded text-xs text-muted-foreground mb-3">
                      {med.note}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => handleOpenEdit(med)}
                    >
                      <Edit2 className="w-4 h-4" />
                      แก้ไข
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => handleDelete(med.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      ลบ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                {editingId ? 'แก้ไขรายการยา' : 'เพิ่มรายการยา'}
              </DrawerTitle>
              <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <Label htmlFor="med_name">ชื่อยา *</Label>
              <Input
                id="med_name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="เช่น ยาลดความดัน"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>จำนวน</Label>
                <Select
                  value={String(formData.dosage_amount)}
                  onValueChange={(v) => setFormData((p) => ({ ...p, dosage_amount: parseFloat(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">1/4 เม็ด</SelectItem>
                    <SelectItem value="0.5">1/2 เม็ด</SelectItem>
                    <SelectItem value="0.75">3/4 เม็ด</SelectItem>
                    <SelectItem value="1">1 เม็ด</SelectItem>
                    <SelectItem value="1.5">1.5 เม็ด</SelectItem>
                    <SelectItem value="2">2 เม็ด</SelectItem>
                    <SelectItem value="3">3 เม็ด</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>รูปแบบยา</Label>
                <Select
                  value={formData.dosage_form}
                  onValueChange={(v) => setFormData((p) => ({ ...p, dosage_form: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tablet">เม็ด</SelectItem>
                    <SelectItem value="capsule">แคปซูล</SelectItem>
                    <SelectItem value="liquid">น้ำ</SelectItem>
                    <SelectItem value="injection">ฉีด</SelectItem>
                    <SelectItem value="topical">ทา</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ความถี่</Label>
              <Select
                value={formData.frequency}
                onValueChange={(v) => setFormData((p) => ({ ...p, frequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.frequency === 'specific_days' && (
              <div className="space-y-2">
                <Label>เลือกวัน</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_OPTIONS.map((day) => (
                    <label
                      key={day.value}
                      className={cn(
                        'flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors',
                        formData.days_of_week.includes(day.value)
                          ? 'bg-primary/10 border-primary'
                          : 'border-border'
                      )}
                    >
                      <Checkbox
                        checked={formData.days_of_week.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>เวลาทานยา *</Label>
              <div className="grid grid-cols-2 gap-2">
                {TIME_OPTIONS.map((time) => (
                  <label
                    key={time.value}
                    className={cn(
                      'flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors',
                      formData.times.includes(time.value)
                        ? 'bg-primary/10 border-primary'
                        : 'border-border'
                    )}
                  >
                    <Checkbox
                      checked={formData.times.includes(time.value)}
                      onCheckedChange={() => toggleTime(time.value)}
                    />
                    <span className="text-sm">{time.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>วิธีรับประทาน</Label>
              <Select
                value={formData.instructions}
                onValueChange={(v) => setFormData((p) => ({ ...p, instructions: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกวิธีรับประทาน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ก่อนอาหาร">ก่อนอาหาร</SelectItem>
                  <SelectItem value="หลังอาหาร">หลังอาหาร</SelectItem>
                  <SelectItem value="ระหว่างอาหาร">ระหว่างอาหาร</SelectItem>
                  <SelectItem value="ห่างอาหาร">ห่างอาหาร</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
                placeholder="เช่น ทานพร้อมน้ำมากๆ"
                rows={2}
              />
            </div>

            <label className="flex items-center gap-3 p-3 bg-muted rounded-lg cursor-pointer">
              <Checkbox
                checked={formData.reminder_enabled}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, reminder_enabled: checked === true }))
                }
              />
              <div className="flex-1">
                <p className="font-medium text-sm">เปิดการเตือน</p>
                <p className="text-xs text-muted-foreground">รับการแจ้งเตือนเมื่อถึงเวลาทานยา</p>
              </div>
              {formData.reminder_enabled ? (
                <Bell className="w-5 h-5 text-green-500" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
            </label>
          </div>

          <DrawerFooter className="border-t border-border">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={addMedication.isPending || updateMedication.isPending}
              >
                {(addMedication.isPending || updateMedication.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <Save className="w-4 h-4" />
                บันทึก
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
