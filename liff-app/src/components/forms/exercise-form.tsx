import { useState } from 'react';
import {
  Dumbbell,
  Footprints,
  Zap,
  Waves,
  Bike,
  Heart,
  Loader2,
  History,
  Clock,
  Trash2,
  X,
  Calendar,
  Check,
  ChevronRight,
  Pencil,
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
import { useLogExercise, useTodayExercise, useDeleteExercise, useUpdateExercise } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { TimeSelectorPill } from './time-selector-pill';

const EXERCISE_TYPES = [
  { value: 'walk', label: 'เดิน', icon: Footprints },
  { value: 'run', label: 'วิ่ง', icon: Zap },
  { value: 'swim', label: 'ว่ายน้ำ', icon: Waves },
  { value: 'bicycle', label: 'ปั่นจักรยาน', icon: Bike },
  { value: 'yoga', label: 'โยคะ', icon: Heart },
  { value: 'custom', label: 'กำหนดเอง', icon: Pencil },
];

const INTENSITY_LEVELS = [
  { value: 'light', label: 'เบา', color: 'bg-green-100 text-green-600 border-green-300' },
  { value: 'medium', label: 'ปานกลาง', color: 'bg-yellow-100 text-yellow-600 border-yellow-300' },
  { value: 'intense', label: 'หนัก', color: 'bg-red-100 text-red-600 border-red-300' },
];

interface ExerciseFormData {
  exercise_type: string;
  custom_type: string;
  duration_minutes: number;
  intensity: string;
  distance_meters: string;
  notes: string;
}

const defaultFormData: ExerciseFormData = {
  exercise_type: '',
  custom_type: '',
  duration_minutes: 30,
  intensity: '',
  distance_meters: '',
  notes: '',
};

interface ExerciseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: ExerciseLog;
}

interface ExerciseLog {
  id: string;
  exercise_type: string | null;
  duration_minutes: number | null;
  intensity: string | null;
  distance_meters: number | null;
  notes: string | null;
  created_at: string;
}

export function ExerciseForm({ onSuccess, onCancel, initialEditData }: ExerciseFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logExercise = useLogExercise();
  const updateExercise = useUpdateExercise();
  const deleteExercise = useDeleteExercise();
  const { data: todayExercise, refetch: refetchExercise } = useTodayExercise(patientId);

  // Initialize state - use initialEditData if provided (component is re-mounted via key prop)
  const [formData, setFormData] = useState<ExerciseFormData>(() => {
    if (initialEditData) {
      const isCustomType = !EXERCISE_TYPES.some(t => t.value === initialEditData.exercise_type);
      return {
        exercise_type: isCustomType ? 'custom' : (initialEditData.exercise_type || ''),
        custom_type: isCustomType ? (initialEditData.exercise_type || '') : '',
        duration_minutes: initialEditData.duration_minutes || 30,
        intensity: initialEditData.intensity || '',
        distance_meters: initialEditData.distance_meters?.toString() || '',
        notes: initialEditData.notes || '',
      };
    }
    return defaultFormData;
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<ExerciseLog | null>(() => initialEditData || null);
  const [editDate, setEditDate] = useState(() => {
    if (initialEditData?.created_at) {
      const d = new Date(initialEditData.created_at);
      // Use local date (Bangkok timezone)
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
    return '';
  });
  const [editTime, setEditTime] = useState(() => {
    if (initialEditData?.created_at) {
      const d = new Date(initialEditData.created_at);
      // Use local time (Bangkok timezone)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return '';
  });

  // Drawer-based edit state
  const [editDrawerItem, setEditDrawerItem] = useState<ExerciseLog | null>(null);
  const [editDrawerSuccess, setEditDrawerSuccess] = useState(false);

  // Open edit drawer
  const handleEditDrawer = (log: ExerciseLog) => {
    setEditDrawerItem(log);
    setEditDrawerSuccess(false);
  };

  // Close edit drawer
  const handleCloseEditDrawer = () => {
    setEditDrawerItem(null);
    setEditDrawerSuccess(false);
    refetchExercise();
  };

  // Handle edit drawer success
  const handleEditDrawerSuccess = () => {
    setEditDrawerSuccess(true);
    setTimeout(() => {
      handleCloseEditDrawer();
    }, 1500);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingLog(null);
    setFormData(defaultFormData);
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    try {
      await deleteExercise.mutateAsync({ id, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      refetchExercise();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    const type = formData.exercise_type === 'custom' ? formData.custom_type : formData.exercise_type;
    if (!type) {
      toast({ description: 'กรุณาเลือกประเภทกิจกรรม', variant: 'destructive' });
      return;
    }

    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ description: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      if (editingLog) {
        // Build created_at from date and time - send as Bangkok local time with +07:00 offset
        const createdAt = editDate && editTime
          ? `${editDate}T${editTime}:00+07:00`
          : undefined;

        // Update existing record
        await updateExercise.mutateAsync({
          id: editingLog.id,
          patientId: resolvedPatientId,
          exercise_type: type,
          duration_minutes: formData.duration_minutes || undefined,
          intensity: formData.intensity || undefined,
          distance_meters: formData.distance_meters ? Number(formData.distance_meters) : undefined,
          notes: formData.notes || undefined,
          created_at: createdAt,
        });
        toast({ description: 'แก้ไขข้อมูลเรียบร้อยแล้ว' });
        setEditingLog(null);
      } else {
        // Create new record
        const typeTh = EXERCISE_TYPES.find(t => t.value === formData.exercise_type)?.label || formData.custom_type;

        await logExercise.mutateAsync({
          patientId: resolvedPatientId,
          exercise_type: type,
          exercise_type_th: typeTh,
          duration_minutes: formData.duration_minutes || undefined,
          intensity: formData.intensity || undefined,
          distance_meters: formData.distance_meters ? Number(formData.distance_meters) : undefined,
          notes: formData.notes || undefined,
        });
        toast({ description: 'บันทึกกิจกรรมเรียบร้อยแล้ว' });
      }

      setFormData(defaultFormData);
      refetchExercise();
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

  const exerciseList = (todayExercise || []) as ExerciseLog[];
  const isSaving = logExercise.isPending || updateExercise.isPending;

  const now = new Date();
  const [selectedTime, setSelectedTime] = useState(() => {
    if (initialEditData?.created_at) {
      const d = new Date(initialEditData.created_at);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  return (
    <div className="space-y-6 pb-4">
      {/* Edit Drawer */}
      {editDrawerItem && (
        <Drawer open={true} onOpenChange={(open) => !open && handleCloseEditDrawer()}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="flex items-center justify-between px-6">
              <DrawerTitle className="text-xl font-bold">แก้ไขบันทึกออกกำลังกาย</DrawerTitle>
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
                      ข้อมูลออกกำลังกายของคุณถูกอัปเดตแล้ว
                    </p>
                  </div>
                </div>
              ) : (
                <ExerciseForm
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

      {/* Exercise Type */}
      <div className="space-y-3">
        <Label className="text-base font-bold">ประเภทกิจกรรม</Label>
        <div className="grid grid-cols-3 gap-2">
          {EXERCISE_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, exercise_type: type.value }))}
                className={cn(
                  'p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5',
                  formData.exercise_type === type.value
                    ? 'bg-purple-100 text-purple-600 border-purple-300 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-700'
                    : 'bg-white dark:bg-card border-muted shadow-sm hover:bg-muted/50'
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Type Input */}
      {formData.exercise_type === 'custom' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">ระบุประเภท</Label>
          <Input
            value={formData.custom_type}
            onChange={(e) => setFormData(prev => ({ ...prev, custom_type: e.target.value }))}
            placeholder="เช่น เต้นแอโรบิค, ว่ายน้ำ"
            className="h-12 rounded-2xl bg-muted/20 border border-muted"
          />
        </div>
      )}

      {/* Duration */}
      <div className="space-y-2">
        <Label className="text-base font-bold">ระยะเวลา (นาที)</Label>
        <Input
          type="number"
          value={formData.duration_minutes}
          onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
          placeholder="30"
          min={1}
          className="h-12 text-lg rounded-2xl bg-muted/20 border border-muted"
        />
      </div>

      {/* Intensity */}
      <div className="space-y-3">
        <Label className="text-base font-bold">ความเข้มข้น</Label>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITY_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, intensity: level.value }))}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all text-center',
                formData.intensity === level.value
                  ? level.color + ' border-current'
                  : 'bg-white dark:bg-card border-muted shadow-sm hover:bg-muted/50'
              )}
            >
              <span className="text-sm font-medium">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Distance (optional) */}
      <div className="space-y-2">
        <Label className="text-base font-bold">ระยะทาง (เมตร) — ไม่บังคับ</Label>
        <Input
          type="number"
          value={formData.distance_meters}
          onChange={(e) => setFormData(prev => ({ ...prev, distance_meters: e.target.value }))}
          placeholder="เช่น 5000"
          min={0}
          className="h-12 rounded-2xl bg-muted/20 border border-muted"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-base font-bold">หมายเหตุ (ถ้ามี)</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="เช่น เดินในสวน, วิ่งบนลู่"
          rows={2}
          className="rounded-2xl bg-muted/20 border border-muted"
        />
      </div>

      {/* Today's Logged Exercise */}
      {exerciseList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="w-4 h-4 text-primary" />
            บันทึกวันนี้ ({exerciseList.length} รายการ)
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {exerciseList.map((exercise) => {
              const typeInfo = EXERCISE_TYPES.find(t => t.value === exercise.exercise_type);
              const TypeIcon = typeInfo?.icon || Dumbbell;
              const isDeleting = deleteConfirmId === exercise.id;
              return (
                <div
                  key={exercise.id}
                  className="flex items-center gap-3 bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => !isDeleting && handleEditDrawer(exercise)}
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                    <TypeIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(exercise.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                      {exercise.duration_minutes && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {exercise.duration_minutes} นาที
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {typeInfo?.label || exercise.exercise_type || 'ออกกำลังกาย'}
                      {exercise.intensity && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          • {exercise.intensity === 'light' ? 'เบา' : exercise.intensity === 'medium' ? 'ปานกลาง' : 'หนัก'}
                        </span>
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
                          handleDelete(exercise.id);
                        }}
                        disabled={deleteExercise.isPending}
                      >
                        {deleteExercise.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ลบ'}
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
                          setDeleteConfirmId(exercise.id);
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
            editingLog ? 'อัปเดต' : 'บันทึกกิจกรรม'
          )}
        </Button>
      </div>
    </div>
  );
}
