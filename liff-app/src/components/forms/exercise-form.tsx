import { useState } from 'react';
import {
  Dumbbell,
  Footprints,
  Zap,
  Waves,
  Bike,
  Heart,
  Pencil,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLogExercise } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

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
}

export function ExerciseForm({ onSuccess, onCancel }: ExerciseFormProps) {
  const { isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logExercise = useLogExercise();

  const [formData, setFormData] = useState<ExerciseFormData>(defaultFormData);

  const handleSubmit = async () => {
    const type = formData.exercise_type === 'custom' ? formData.custom_type : formData.exercise_type;
    if (!type) {
      toast({ title: 'กรุณาเลือกประเภทกิจกรรม', variant: 'destructive' });
      return;
    }

    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ title: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

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

      toast({ title: 'บันทึกกิจกรรมเรียบร้อยแล้ว' });
      setFormData(defaultFormData);
      onSuccess?.();
    } catch (error) {
      console.error('Error logging exercise:', error);
      toast({ title: 'ไม่สามารถบันทึกได้', variant: 'destructive' });
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
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-5 text-white text-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full" />
        <div className="relative z-10 flex items-center justify-center gap-4">
          <Dumbbell className="w-10 h-10" />
          <div>
            <p className="text-sm text-white/80">ออกกำลังกาย</p>
            <p className="text-2xl font-bold">
              {formData.duration_minutes ? `${formData.duration_minutes} นาที` : 'เลือกข้อมูล'}
            </p>
          </div>
        </div>
      </div>

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
                  'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5',
                  formData.exercise_type === type.value
                    ? 'bg-purple-100 text-purple-600 border-purple-300 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-700'
                    : 'bg-muted/50 border-transparent hover:bg-muted'
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
            className="h-12"
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
          className="h-12 text-lg"
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
                'p-3 rounded-xl border-2 transition-all text-center',
                formData.intensity === level.value
                  ? level.color + ' border-current'
                  : 'bg-muted/50 border-transparent hover:bg-muted'
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
          className="h-12"
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
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
          onClick={onCancel}
        >
          ยกเลิก
        </Button>
        <Button
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
          onClick={handleSubmit}
          disabled={logExercise.isPending}
        >
          {logExercise.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'บันทึกกิจกรรม'
          )}
        </Button>
      </div>
    </div>
  );
}
