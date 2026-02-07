import { useState } from 'react';
import {
  Moon,
  Sun,
  Clock,
  Loader2,
  Star,
  Check,
  Trash2,
  Calendar,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-picker';
import { TimeInput } from '@/components/ui/time-picker';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useLogSleep, useTodaySleep, useUpdateSleep, useDeleteSleep } from '@/lib/api/hooks/use-health';
import type { SleepLog } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

const QUALITY_OPTIONS = [
  { value: 'poor', label: 'แย่', score: 1, icon: '😴', color: 'bg-red-100 text-red-600 border-red-300' },
  { value: 'fair', label: 'พอใช้', score: 2, icon: '😐', color: 'bg-yellow-100 text-yellow-600 border-yellow-300' },
  { value: 'good', label: 'ดี', score: 3, icon: '😊', color: 'bg-green-100 text-green-600 border-green-300' },
  { value: 'excellent', label: 'ดีมาก', score: 4, icon: '😄', color: 'bg-emerald-100 text-emerald-600 border-emerald-300' },
];

const HOURS_OPTIONS = [
  { value: 4, label: '4 ชม.' },
  { value: 5, label: '5 ชม.' },
  { value: 6, label: '6 ชม.' },
  { value: 7, label: '7 ชม.' },
  { value: 8, label: '8 ชม.' },
  { value: 9, label: '9 ชม.' },
  { value: 10, label: '10+ ชม.' },
];

interface SleepFormData {
  sleep_hours: number | null;
  sleep_quality: string;
  sleep_quality_score: number | null;
  sleep_time: string;
  wake_time: string;
  notes: string;
}

const defaultFormData: SleepFormData = {
  sleep_hours: null,
  sleep_quality: '',
  sleep_quality_score: null,
  sleep_time: '22:00',
  wake_time: '06:00',
  notes: '',
};

interface SleepFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: SleepLog;
}

export function SleepForm({ onSuccess, onCancel, initialEditData }: SleepFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logSleep = useLogSleep();
  const updateSleep = useUpdateSleep();
  const deleteSleep = useDeleteSleep();
  const { data: todayLogs, refetch } = useTodaySleep(patientId);

  // Initialize state - use initialEditData if provided (component is re-mounted via key prop)
  const [formData, setFormData] = useState<SleepFormData>(() => {
    if (initialEditData) {
      console.log('[SleepForm] Initializing from initialEditData:', initialEditData);
      return {
        sleep_hours: initialEditData.sleep_hours,
        sleep_quality: initialEditData.sleep_quality || '',
        sleep_quality_score: initialEditData.sleep_quality_score,
        sleep_time: initialEditData.sleep_time || '22:00',
        wake_time: initialEditData.wake_time || '06:00',
        notes: initialEditData.notes || '',
      };
    }
    return defaultFormData;
  });
  const [editingLog, setEditingLog] = useState<SleepLog | null>(() => initialEditData || null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(() => initialEditData?.sleep_date || '');
  const allLogs = todayLogs || [];

  // Drawer-based edit state
  const [editDrawerItem, setEditDrawerItem] = useState<SleepLog | null>(null);
  const [editDrawerSuccess, setEditDrawerSuccess] = useState(false);

  // Open edit drawer
  const handleEditDrawer = (log: SleepLog) => {
    setEditDrawerItem(log);
    setEditDrawerSuccess(false);
  };

  // Close edit drawer
  const handleCloseEditDrawer = () => {
    setEditDrawerItem(null);
    setEditDrawerSuccess(false);
    refetch();
  };

  // Handle edit drawer success
  const handleEditDrawerSuccess = () => {
    setEditDrawerSuccess(true);
    setTimeout(() => {
      handleCloseEditDrawer();
    }, 1500);
  };

  // Load log data into form for editing (used by initialEditData mode)
  const handleEdit = (log: SleepLog) => {
    setEditingLog(log);
    setFormData({
      sleep_hours: log.sleep_hours,
      sleep_quality: log.sleep_quality || '',
      sleep_quality_score: log.sleep_quality_score,
      sleep_time: log.sleep_time || '22:00',
      wake_time: log.wake_time || '06:00',
      notes: log.notes || '',
    });
    // Set the date for editing
    const d = new Date();
    const localDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    setEditDate(log.sleep_date || localDate);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingLog(null);
    setFormData(defaultFormData);
    setEditDate('');
  };

  // Delete log
  const handleDelete = async (id: string) => {
    if (!patientId) return;

    try {
      await deleteSleep.mutateAsync({ id, patientId });
      toast({ title: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      refetch();
    } catch (error) {
      console.error('Error deleting sleep:', error);
      toast({ title: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
    }
  };

  // Calculate sleep hours from times
  const calculateHours = (sleepTime: string, wakeTime: string): number => {
    const [sleepH, sleepM] = sleepTime.split(':').map(Number);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);

    let sleepMinutes = sleepH * 60 + sleepM;
    let wakeMinutes = wakeH * 60 + wakeM;

    // If wake time is earlier than sleep time, assume next day
    if (wakeMinutes < sleepMinutes) {
      wakeMinutes += 24 * 60;
    }

    return Math.round((wakeMinutes - sleepMinutes) / 60 * 10) / 10;
  };

  const handleTimeChange = (field: 'sleep_time' | 'wake_time', value: string) => {
    const newFormData = { ...formData, [field]: value };
    // Auto-calculate hours
    if (newFormData.sleep_time && newFormData.wake_time) {
      newFormData.sleep_hours = calculateHours(newFormData.sleep_time, newFormData.wake_time);
    }
    setFormData(newFormData);
  };

  const handleQualitySelect = (quality: typeof QUALITY_OPTIONS[0]) => {
    setFormData(prev => ({
      ...prev,
      sleep_quality: quality.value,
      sleep_quality_score: quality.score,
    }));
  };

  const handleHoursSelect = (hours: number) => {
    setFormData(prev => ({ ...prev, sleep_hours: hours }));
  };

  const handleSubmit = async () => {
    if (!formData.sleep_hours && !formData.sleep_time) {
      toast({ title: 'กรุณาระบุจำนวนชั่วโมงนอน', variant: 'destructive' });
      return;
    }

    try {
      // Ensure patient profile exists (auto-create if needed)
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ title: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      if (editingLog) {
        // Update existing record
        await updateSleep.mutateAsync({
          id: editingLog.id,
          patientId: resolvedPatientId,
          sleep_hours: formData.sleep_hours || undefined,
          sleep_quality: formData.sleep_quality || undefined,
          sleep_quality_score: formData.sleep_quality_score || undefined,
          sleep_time: formData.sleep_time || undefined,
          wake_time: formData.wake_time || undefined,
          sleep_date: editDate || undefined,
          notes: formData.notes || undefined,
        });
        toast({ title: 'แก้ไขข้อมูลเรียบร้อยแล้ว' });
        setEditingLog(null);
        setEditDate('');
      } else {
        // Create new record
        await logSleep.mutateAsync({
          patientId: resolvedPatientId,
          sleep_hours: formData.sleep_hours || undefined,
          sleep_quality: formData.sleep_quality || undefined,
          sleep_quality_score: formData.sleep_quality_score || undefined,
          sleep_time: formData.sleep_time || undefined,
          wake_time: formData.wake_time || undefined,
          notes: formData.notes || undefined,
        });
        toast({ title: 'บันทึกการนอนเรียบร้อยแล้ว' });
      }

      setFormData(defaultFormData);
      refetch();
      onSuccess?.();
    } catch (error) {
      console.error('Error logging sleep:', error);
      toast({ title: 'ไม่สามารถบันทึกได้', variant: 'destructive' });
    }
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white text-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full" />
        <div className="relative z-10 flex items-center justify-center gap-4">
          <Moon className="w-10 h-10" />
          <div>
            <p className="text-sm text-white/80">การนอนหลับ</p>
            <p className="text-2xl font-bold">
              {formData.sleep_hours ? `${formData.sleep_hours} ชั่วโมง` : 'เลือกข้อมูล'}
            </p>
          </div>
        </div>
      </div>

      {/* Sleep Time */}
      <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <Label className="text-base font-bold">เวลานอน - เวลาตื่น</Label>
        </div>

        <div className="space-y-4">
          {/* เข้านอน */}
          <div className="bg-card rounded-xl p-4 space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-500" />
              <span>เข้านอน</span>
            </Label>
            <TimeInput
              value={formData.sleep_time}
              onChange={(value) => handleTimeChange('sleep_time', value)}
            />
          </div>

          {/* ตื่นนอน */}
          <div className="bg-card rounded-xl p-4 space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>ตื่นนอน</span>
            </Label>
            <TimeInput
              value={formData.wake_time}
              onChange={(value) => handleTimeChange('wake_time', value)}
            />
          </div>
        </div>

        {formData.sleep_time && formData.wake_time && (
          <div className="text-center p-4 bg-primary/10 rounded-xl">
            <p className="text-sm text-muted-foreground">รวมเวลานอน</p>
            <p className="text-3xl font-bold text-primary">
              {calculateHours(formData.sleep_time, formData.wake_time)} ชั่วโมง
            </p>
          </div>
        )}
      </div>

      {/* Or Select Hours */}
      <div className="space-y-3">
        <Label className="text-base font-bold">หรือเลือกจำนวนชั่วโมง</Label>
        <div className="flex flex-wrap gap-2">
          {HOURS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={formData.sleep_hours === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleHoursSelect(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Sleep Quality */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          <Label className="text-base font-bold">คุณภาพการนอน</Label>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleQualitySelect(opt)}
              className={cn(
                'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1',
                formData.sleep_quality === opt.value
                  ? opt.color + ' border-current'
                  : 'bg-muted/50 border-transparent hover:bg-muted'
              )}
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-base font-bold">หมายเหตุ (ถ้ามี)</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="เช่น ตื่นกลางดึก 2 ครั้ง, ฝันร้าย"
          rows={2}
        />
      </div>

      {/* Date editing - only shown when editing */}
      {editingLog && (
        <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <Label className="text-base font-bold">วันที่บันทึก</Label>
          </div>
          <DateInput
            value={editDate}
            onChange={setEditDate}
          />
        </div>
      )}

      {/* Today's Logs */}
      {allLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Check className="w-4 h-4" />
            บันทึกวันนี้
          </div>
          <div className="space-y-2">
            {allLogs.map((log) => {
              const qualityOpt = QUALITY_OPTIONS.find(q => q.value === log.sleep_quality);
              const isDeleting = deleteConfirmId === log.id;

              // Format date for display
              const dateDisplay = new Date(log.sleep_date).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
              });

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 bg-muted/50 rounded-xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => !isDeleting && handleEditDrawer(log)}
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                    <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{dateDisplay}</span>
                      {qualityOpt && (
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', qualityOpt.color)}>
                          {qualityOpt.icon} {qualityOpt.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {log.sleep_hours ? `${log.sleep_hours} ชม.` : '-'}
                      {(log.sleep_time || log.wake_time) && (
                        <span className="text-muted-foreground font-normal ml-2">
                          {log.sleep_time && `นอน ${log.sleep_time}`}
                          {log.sleep_time && log.wake_time && ' · '}
                          {log.wake_time && `ตื่น ${log.wake_time}`}
                        </span>
                      )}
                    </p>
                    {log.notes && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{log.notes}</p>
                    )}
                  </div>

                  {/* Edit/Delete Buttons */}
                  {isDeleting ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                        disabled={deleteSleep.isPending}
                        className="h-8 px-2 text-xs"
                      >
                        {deleteSleep.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'ยืนยัน'
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                        className="h-8 px-2 text-xs"
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(log.id); }}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Drawer - like history tab */}
      {editDrawerItem && (
        <Drawer open={true} onOpenChange={(open) => !open && handleCloseEditDrawer()}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="flex items-center justify-between px-6">
              <DrawerTitle className="text-xl font-bold">แก้ไขบันทึกการนอน</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  <X className="w-5 h-5" />
                </Button>
              </DrawerClose>
            </DrawerHeader>

            <div className="px-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {editDrawerSuccess ? (
                <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 rounded-full flex items-center justify-center">
                    <Check className="w-10 h-10 stroke-[3px]" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">อัปเดตเรียบร้อย!</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed px-8">
                      ข้อมูลการนอนของคุณถูกอัปเดตแล้ว
                    </p>
                  </div>
                </div>
              ) : (
                <SleepForm
                  key={editDrawerItem.id}
                  onSuccess={handleEditDrawerSuccess}
                  onCancel={handleCloseEditDrawer}
                  initialEditData={editDrawerItem}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
          onClick={editingLog ? handleCancelEdit : onCancel}
        >
          {editingLog ? 'ยกเลิกแก้ไข' : 'ยกเลิก'}
        </Button>
        <Button
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
          onClick={handleSubmit}
          disabled={logSleep.isPending || updateSleep.isPending}
        >
          {(logSleep.isPending || updateSleep.isPending) ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            editingLog ? 'อัปเดต' : 'บันทึกการนอน'
          )}
        </Button>
      </div>
    </div>
  );
}
