import { useState } from 'react';
import {
  Smile,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLogMood } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

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
}

export function MoodForm({ onSuccess, onCancel }: MoodFormProps) {
  const { isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logMood = useLogMood();

  const [formData, setFormData] = useState<MoodFormData>(defaultFormData);

  const selectedMood = MOODS.find(m => m.value === formData.mood);

  const handleSubmit = async () => {
    if (!formData.mood) {
      toast({ title: 'กรุณาเลือกอารมณ์', variant: 'destructive' });
      return;
    }

    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ title: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      await logMood.mutateAsync({
        patientId: resolvedPatientId,
        mood: formData.mood,
        mood_score: formData.mood_score || undefined,
        stress_level: formData.stress_level || undefined,
        stress_cause: formData.stress_cause || undefined,
        energy_level: formData.energy_level || undefined,
        note: formData.note || undefined,
      });

      toast({ title: 'บันทึกอารมณ์เรียบร้อยแล้ว' });
      setFormData(defaultFormData);
      onSuccess?.();
    } catch (error) {
      console.error('Error logging mood:', error);
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
      <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-5 text-white text-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full" />
        <div className="relative z-10 flex items-center justify-center gap-4">
          <Smile className="w-10 h-10" />
          <div>
            <p className="text-sm text-white/80">อารมณ์วันนี้</p>
            <p className="text-2xl font-bold">
              {selectedMood ? `${selectedMood.emoji} ${selectedMood.label}` : 'เลือกอารมณ์'}
            </p>
          </div>
        </div>
      </div>

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
                'p-3 rounded-xl border-2 transition-all text-center',
                formData.stress_level === level.value
                  ? level.color + ' border-current'
                  : 'bg-muted/50 border-transparent hover:bg-muted'
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
                'p-3 rounded-xl border-2 transition-all text-center',
                formData.energy_level === level.value
                  ? level.color + ' border-current'
                  : 'bg-muted/50 border-transparent hover:bg-muted'
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
          disabled={logMood.isPending}
        >
          {logMood.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'บันทึกอารมณ์'
          )}
        </Button>
      </div>
    </div>
  );
}
