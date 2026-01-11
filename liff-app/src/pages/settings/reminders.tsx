import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Plus,
  Bell,
  Edit2,
  Trash2,
  Loader2,
  X,
  Save,
  Pill,
  Droplet,
  Heart,
  Utensils,
  Footprints,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { useAuthStore } from '@/stores/auth';
import {
  usePatientReminders,
  useAddReminder,
  useUpdateReminder,
  useDeleteReminder,
  type Reminder,
} from '@/lib/api/hooks/use-profile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const REMINDER_TYPES = [
  { value: 'medication', label: 'กินยา', icon: Pill, color: 'bg-purple-500/10 text-purple-500' },
  { value: 'water', label: 'ดื่มน้ำ', icon: Droplet, color: 'bg-blue-500/10 text-blue-500' },
  { value: 'vitals', label: 'วัดความดัน', icon: Heart, color: 'bg-red-500/10 text-red-500' },
  { value: 'food', label: 'ทานอาหาร', icon: Utensils, color: 'bg-orange-500/10 text-orange-500' },
  { value: 'exercise', label: 'ออกกำลังกาย', icon: Footprints, color: 'bg-green-500/10 text-green-500' },
];

const DAY_OPTIONS = [
  { value: 'monday', label: 'จ' },
  { value: 'tuesday', label: 'อ' },
  { value: 'wednesday', label: 'พ' },
  { value: 'thursday', label: 'พฤ' },
  { value: 'friday', label: 'ศ' },
  { value: 'saturday', label: 'ส' },
  { value: 'sunday', label: 'อา' },
];

interface ReminderForm {
  type: string;
  title: string;
  time: string;
  note: string;
  frequency: 'daily' | 'specific_days';
  days_of_week: string[];
  is_active: boolean;
}

const defaultFormData: ReminderForm = {
  type: 'medication',
  title: '',
  time: '08:00',
  note: '',
  frequency: 'daily',
  days_of_week: [],
  is_active: true,
};

export default function RemindersPage() {
  const [, navigate] = useLocation();
  const { context } = useAuthStore();
  const patientId = context.patientId;
  const { toast } = useToast();

  const { data: reminders, isLoading } = usePatientReminders(patientId);
  const addReminder = useAddReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ReminderForm>(defaultFormData);

  // Group reminders by type
  const groupedReminders = REMINDER_TYPES.map((type) => ({
    ...type,
    reminders: (reminders || []).filter((r) => r.type === type.value),
  }));

  const handleOpenAdd = (type: string) => {
    setEditingId(null);
    setFormData({ ...defaultFormData, type });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setFormData({
      type: reminder.type,
      title: reminder.title,
      time: reminder.custom_time || reminder.time || '08:00',
      note: reminder.note || '',
      frequency: reminder.frequency === 'specific_days' ? 'specific_days' : 'daily',
      days_of_week: reminder.days_of_week || [],
      is_active: reminder.is_active,
    });
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    if (!confirm('ต้องการลบการเตือนนี้หรือไม่?')) return;

    try {
      await deleteReminder.mutateAsync({ id, patientId });
      toast({ title: 'ลบการเตือนเรียบร้อยแล้ว' });
    } catch {
      toast({ title: 'ไม่สามารถลบการเตือนได้', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (reminder: Reminder) => {
    if (!patientId) return;

    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        data: { is_active: !reminder.is_active, patient_id: patientId },
      });
    } catch {
      toast({ title: 'ไม่สามารถเปลี่ยนสถานะได้', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!patientId) return;
    if (!formData.title.trim()) {
      toast({ title: 'กรุณาระบุชื่อเตือน', variant: 'destructive' });
      return;
    }
    if (!formData.time) {
      toast({ title: 'กรุณาระบุเวลาเตือน', variant: 'destructive' });
      return;
    }
    if (formData.frequency === 'specific_days' && formData.days_of_week.length === 0) {
      toast({ title: 'กรุณาเลือกวันที่ต้องการเตือน', variant: 'destructive' });
      return;
    }

    try {
      if (editingId) {
        await updateReminder.mutateAsync({
          id: editingId,
          data: {
            ...formData,
            custom_time: formData.time,
            days_of_week: formData.frequency === 'specific_days' ? formData.days_of_week : undefined,
            patient_id: patientId,
          },
        });
        toast({ title: 'แก้ไขการเตือนเรียบร้อยแล้ว' });
      } else {
        await addReminder.mutateAsync({
          ...formData,
          custom_time: formData.time,
          days_of_week: formData.frequency === 'specific_days' ? formData.days_of_week : undefined,
          patient_id: patientId,
        });
        toast({ title: 'เพิ่มการเตือนเรียบร้อยแล้ว' });
      }
      setDrawerOpen(false);
    } catch {
      toast({ title: 'ไม่สามารถบันทึกการเตือนได้', variant: 'destructive' });
    }
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const getTypeConfig = (type: string) => {
    return REMINDER_TYPES.find((t) => t.value === type) || REMINDER_TYPES[0];
  };

  return (
    <div className="min-h-screen pb-8 font-sans bg-background">
      {/* Header */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">ตั้งเวลาเตือน</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Reminder Sections by Type */}
        {!isLoading &&
          groupedReminders.map((group) => {
            const Icon = group.icon;
            return (
              <Card key={group.value} className="border-none shadow-sm bg-card overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-xl', group.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-foreground">{group.label}</span>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleOpenAdd(group.value)}
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มเตือน
                    </Button>
                  </div>

                  <div className="p-4">
                    {group.reminders.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">ยังไม่มีการเตือน</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {group.reminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className={cn(
                              'p-3 bg-muted/50 rounded-xl border-l-4 transition-opacity',
                              reminder.is_active ? 'border-primary' : 'border-muted-foreground opacity-50'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-foreground text-sm">{reminder.title}</p>
                                <p className="text-xl font-bold text-primary mt-1">
                                  {reminder.custom_time || reminder.time}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {reminder.frequency === 'daily'
                                    ? 'ทุกวัน'
                                    : reminder.days_of_week
                                        ?.map((d) => DAY_OPTIONS.find((opt) => opt.value === d)?.label)
                                        .join(', ') || 'ตามกำหนด'}
                                </p>
                                {reminder.note && (
                                  <p className="text-xs text-muted-foreground mt-1">{reminder.note}</p>
                                )}
                              </div>
                              <Switch
                                checked={reminder.is_active}
                                onCheckedChange={() => handleToggleActive(reminder)}
                              />
                            </div>

                            {/* Day badges for specific days */}
                            {reminder.frequency === 'specific_days' && reminder.days_of_week && (
                              <div className="flex gap-1 mt-2">
                                {DAY_OPTIONS.map((day) => (
                                  <span
                                    key={day.value}
                                    className={cn(
                                      'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold',
                                      reminder.days_of_week?.includes(day.value)
                                        ? 'bg-primary text-white'
                                        : 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    {day.label}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-1 h-8"
                                onClick={() => handleOpenEdit(reminder)}
                              >
                                <Edit2 className="w-3 h-3" />
                                แก้ไข
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex-1 gap-1 h-8"
                                onClick={() => handleDelete(reminder.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                                ลบ
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </main>

      {/* Add/Edit Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                {editingId ? 'แก้ไขการเตือน' : `เพิ่มเตือน${getTypeConfig(formData.type).label}`}
              </DrawerTitle>
              <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <Label htmlFor="reminder_title">ชื่อเตือน *</Label>
              <Input
                id="reminder_title"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="เช่น กินยาความดัน"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminder_time">เวลาเตือน *</Label>
              <Input
                id="reminder_time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>ความถี่</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.frequency === 'daily' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData((p) => ({ ...p, frequency: 'daily' }))}
                >
                  ทุกวัน
                </Button>
                <Button
                  type="button"
                  variant={formData.frequency === 'specific_days' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData((p) => ({ ...p, frequency: 'specific_days' }))}
                >
                  เลือกวัน
                </Button>
              </div>
            </div>

            {formData.frequency === 'specific_days' && (
              <div className="space-y-2">
                <Label>เลือกวันที่ต้องการเตือน</Label>
                <div className="flex gap-2 justify-center">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                        formData.days_of_week.includes(day.value)
                          ? 'bg-primary text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
                placeholder="เพิ่มรายละเอียดเพิ่มเติม"
                rows={2}
              />
            </div>
          </div>

          <DrawerFooter className="border-t border-border">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={addReminder.isPending || updateReminder.isPending}
              >
                {(addReminder.isPending || updateReminder.isPending) && (
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
