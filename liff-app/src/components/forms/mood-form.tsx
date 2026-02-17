import { useState } from 'react';
import {
  Loader2,
  History,
  Clock,
  Trash2,
  Calendar,
  X,
  Check,
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
import { useLogMood, useTodayMood, useDeleteMood, useUpdateMood, type MoodLogEntry } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { TimeSelectorPill } from './time-selector-pill';

const MOODS = [
  { value: 'happy', label: 'มีความสุข', emoji: '😊' },
  { value: 'calm', label: 'สงบ', emoji: '😌' },
  { value: 'excited', label: 'ตื่นเต้น', emoji: '🤩' },
  { value: 'neutral', label: 'ปกติ', emoji: '😐' },
  { value: 'tired', label: 'เหนื่อย', emoji: '😴' },
  { value: 'anxious', label: 'กังวล', emoji: '😰' },
  { value: 'sad', label: 'เศร้า', emoji: '😢' },
  { value: 'stressed', label: 'เครียด', emoji: '😤' },
  { value: 'exhausted', label: 'อ่อนเพลีย', emoji: '🥱' },
];

const SCORE_OPTIONS = [
  { value: 1, label: 'แย่มาก', emoji: '😫' },
  { value: 2, label: 'ไม่ดี', emoji: '😟' },
  { value: 3, label: 'ปกติ', emoji: '😐' },
  { value: 4, label: 'ดี', emoji: '😊' },
  { value: 5, label: 'ดีมาก', emoji: '😄' },
];

const LEVELS = [
  { value: 'low', label: 'ต่ำ', color: 'bg-green-100 text-green-600 border-green-300' },
  { value: 'medium', label: 'ปานกลาง', color: 'bg-yellow-100 text-yellow-600 border-yellow-300' },
  { value: 'high', label: 'สูง', color: 'bg-red-100 text-red-600 border-red-300' },
];

interface MoodFormData {
  mood: string;
  mood_score: number | null;
  stress_level: string;
  stress_cause: string;
  energy_level: string;
  note: string;
}

const defaultFormData: MoodFormData = {
  mood: '',
  mood_score: null,
  stress_level: '',
  stress_cause: '',
  energy_level: '',
  note: '',
};

interface MoodFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: MoodLogEntry;
}

export function MoodForm({ onSuccess, onCancel, initialEditData }: MoodFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logMood = useLogMood();
  const updateMood = useUpdateMood();
  const deleteMood = useDeleteMood();
  const { data: todayMood, refetch: refetchMood } = useTodayMood(patientId);

  const now = new Date();
  const [selectedTime, setSelectedTime] = useState(() => {
    if (initialEditData?.timestamp) {
      const d = new Date(initialEditData.timestamp);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  // Initialize state - use initialEditData if provided (component is re-mounted via key prop)
  const [formData, setFormData] = useState<MoodFormData>(() => {
    if (initialEditData) {
      return {
        mood: initialEditData.mood || '',
        mood_score: initialEditData.mood_score,
        stress_level: initialEditData.stress_level || '',
        stress_cause: initialEditData.stress_cause || '',
        energy_level: initialEditData.energy_level || '',
        note: initialEditData.note || '',
      };
    }
    return defaultFormData;
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<MoodLogEntry | null>(() => initialEditData || null);
  const [editDate, setEditDate] = useState(() => {
    if (initialEditData?.timestamp) {
      const d = new Date(initialEditData.timestamp);
      // Use local date (Bangkok timezone)
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
    return '';
  });
  const [editTime, setEditTime] = useState(() => {
    if (initialEditData?.timestamp) {
      const d = new Date(initialEditData.timestamp);
      // Use local time (Bangkok timezone)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return '';
  });

  // Drawer-based edit state
  const [editDrawerItem, setEditDrawerItem] = useState<MoodLogEntry | null>(null);
  const [editDrawerSuccess, setEditDrawerSuccess] = useState(false);

  // Open edit drawer
  const handleEditDrawer = (log: MoodLogEntry) => {
    setEditDrawerItem(log);
    setEditDrawerSuccess(false);
  };

  // Close edit drawer
  const handleCloseEditDrawer = () => {
    setEditDrawerItem(null);
    setEditDrawerSuccess(false);
    refetchMood();
  };

  // Handle edit drawer success
  const handleEditDrawerSuccess = () => {
    setEditDrawerSuccess(true);
    setTimeout(() => {
      handleCloseEditDrawer();
    }, 1500);
  };

  const isSaving = logMood.isPending || updateMood.isPending;

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingLog(null);
    setFormData(defaultFormData);
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    try {
      await deleteMood.mutateAsync({ id, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      refetchMood();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!formData.mood) {
      toast({ description: 'กรุณาเลือกอารมณ์', variant: 'destructive' });
      return;
    }

    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ description: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      if (editingLog) {
        // Build timestamp from date and time - send as Bangkok local time with +07:00 offset
        const timestamp = editDate && editTime
          ? `${editDate}T${editTime}:00+07:00`
          : undefined;

        // Update existing record
        await updateMood.mutateAsync({
          id: editingLog.id,
          patientId: resolvedPatientId,
          mood: formData.mood,
          mood_score: formData.mood_score || undefined,
          stress_level: formData.stress_level || undefined,
          stress_cause: formData.stress_cause || undefined,
          energy_level: formData.energy_level || undefined,
          note: formData.note || undefined,
          timestamp,
        });
        toast({ description: 'แก้ไขข้อมูลเรียบร้อยแล้ว' });
        setEditingLog(null);
      } else {
        // Create new record
        await logMood.mutateAsync({
          patientId: resolvedPatientId,
          mood: formData.mood,
          mood_score: formData.mood_score || undefined,
          stress_level: formData.stress_level || undefined,
          stress_cause: formData.stress_cause || undefined,
          energy_level: formData.energy_level || undefined,
          note: formData.note || undefined,
        });
        toast({ description: 'บันทึกอารมณ์เรียบร้อยแล้ว' });
      }

      setFormData(defaultFormData);
      refetchMood();
      onSuccess?.();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    }
  };

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
      {/* Edit Drawer - like history tab */}
      {editDrawerItem && (
        <Drawer open={true} onOpenChange={(open) => !open && handleCloseEditDrawer()}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="flex items-center justify-between px-6">
              <DrawerTitle className="text-xl font-bold">แก้ไขบันทึกอารมณ์</DrawerTitle>
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
                      ข้อมูลอารมณ์ของคุณถูกอัปเดตแล้ว
                    </p>
                  </div>
                </div>
              ) : (
                <MoodForm
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

      {/* Time Selector Pill */}
      <TimeSelectorPill
        time={selectedTime}
        onTimeChange={setSelectedTime}
      />

      {/* Mood Selection */}
      <div className="space-y-3">
        <Label className="text-base font-bold">อารมณ์</Label>
        <div className="grid grid-cols-3 gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, mood: mood.value }))}
              className={cn(
                'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1',
                formData.mood === mood.value
                  ? 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-700'
                  : 'bg-muted/50 border-transparent hover:bg-muted'
              )}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="text-xs font-medium">{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mood Score */}
      <div className="space-y-3">
        <Label className="text-base font-bold">ระดับอารมณ์</Label>
        <div className="grid grid-cols-5 gap-2">
          {SCORE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, mood_score: opt.value }))}
              className={cn(
                'p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1',
                formData.mood_score === opt.value
                  ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-700'
                  : 'bg-muted/50 border-transparent hover:bg-muted'
              )}
            >
              <span className="text-xl">{opt.emoji}</span>
              <span className="text-[10px] font-medium leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stress Level */}
      <div className="space-y-3">
        <Label className="text-base font-bold">ระดับความเครียด</Label>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, stress_level: level.value }))}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all text-center',
                formData.stress_level === level.value
                  ? level.color + ' border-current'
                  : 'bg-white dark:bg-card border-muted shadow-sm hover:bg-muted/50'
              )}
            >
              <span className="text-sm font-medium">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stress Cause */}
      <div className="space-y-2">
        <Label className="text-base font-bold">สาเหตุความเครียด (ถ้ามี)</Label>
        <Input
          value={formData.stress_cause}
          onChange={(e) => setFormData(prev => ({ ...prev, stress_cause: e.target.value }))}
          placeholder="เช่น งาน, สุขภาพ, ครอบครัว"
          className="h-12"
        />
      </div>

      {/* Energy Level */}
      <div className="space-y-3">
        <Label className="text-base font-bold">ระดับพลังงาน</Label>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, energy_level: level.value }))}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all text-center',
                formData.energy_level === level.value
                  ? level.color + ' border-current'
                  : 'bg-white dark:bg-card border-muted shadow-sm hover:bg-muted/50'
              )}
            >
              <span className="text-sm font-medium">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-base font-bold">หมายเหตุ (ถ้ามี)</Label>
        <Textarea
          value={formData.note}
          onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
          placeholder="เช่น วันนี้อารมณ์ดีมาก, นอนหลับสบาย"
          rows={2}
        />
      </div>

      {/* Today's Logged Mood */}
      {todayMood && todayMood.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="w-4 h-4 text-primary" />
            บันทึกวันนี้ ({todayMood.length} รายการ)
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {todayMood.map((mood) => {
              const moodInfo = MOODS.find(m => m.value === mood.mood);
              const isDeleting = deleteConfirmId === mood.id;
              return (
                <div
                  key={mood.id}
                  className="flex items-center gap-3 bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => !isDeleting && handleEditDrawer(mood)}
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-950/50 flex items-center justify-center text-xl shrink-0">
                    {moodInfo?.emoji || '😐'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(mood.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                      {mood.stress_level && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          เครียด: {mood.stress_level === 'low' ? 'ต่ำ' : mood.stress_level === 'medium' ? 'กลาง' : 'สูง'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {moodInfo?.label || mood.mood}
                      {mood.mood_score && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">({mood.mood_score}/5)</span>
                      )}
                    </p>
                  </div>
                  {isDeleting ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(mood.id);
                        }}
                        disabled={deleteMood.isPending}
                      >
                        {deleteMood.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ลบ'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(mood.id);
                        }}
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

      {/* Date/Time editing - only shown when editing */}
      {editingLog && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>วันที่และเวลาบันทึก</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                วันที่
              </Label>
              <DateInput
                value={editDate}
                onChange={setEditDate}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                เวลา
              </Label>
              <TimeInput
                value={editTime}
                onChange={setEditTime}
              />
            </div>
          </div>
        </div>
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
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            editingLog ? 'อัปเดต' : 'บันทึกอารมณ์'
          )}
        </Button>
      </div>
    </div>
  );
}
