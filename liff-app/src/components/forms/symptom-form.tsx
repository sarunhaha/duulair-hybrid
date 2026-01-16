import { useState } from 'react';
import {
  Brain,
  Frown,
  AlertCircle,
  Thermometer,
  Wind,
  Heart,
  Battery,
  Activity,
  Volume2,
  MapPin,
  Clock,
  FileText,
  Save,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { useLogSymptom } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';

interface SymptomFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PRESET_SYMPTOMS = [
  { id: 'headache', icon: Brain, label: 'ปวดหัว' },
  { id: 'nausea', icon: Frown, label: 'คลื่นไส้' },
  { id: 'dizzy', icon: AlertCircle, label: 'เวียนหัว' },
  { id: 'fever', icon: Thermometer, label: 'มีไข้' },
  { id: 'breathing', icon: Wind, label: 'หายใจลำบาก' },
  { id: 'chest', icon: Heart, label: 'แน่นหน้าอก' },
  { id: 'fatigue', icon: Battery, label: 'เหนื่อย/อ่อนเพลีย' },
  { id: 'pain', icon: Activity, label: 'ปวดตามตัว' },
  { id: 'cough', icon: Volume2, label: 'ไอ/จาม' },
];

const LOCATIONS = ['หัว', 'คอ', 'หน้าอก', 'ท้อง', 'หลัง', 'แขน', 'ขา', 'ทั้งตัว'];

const DURATIONS = [
  { id: 'just_now', label: 'เพิ่งเป็น' },
  { id: 'this_morning', label: 'เมื่อเช้า' },
  { id: 'yesterday', label: 'เมื่อวาน' },
  { id: 'few_days', label: '2-3 วัน' },
  { id: 'week', label: 'สัปดาห์ก่อน' },
  { id: 'ongoing', label: 'เป็นมานาน' },
];

const SEVERITY_LEVELS = [
  { level: 1, emoji: '😊', label: 'น้อย', color: 'bg-emerald-100 dark:bg-emerald-950/50' },
  { level: 2, emoji: '😐', label: 'เล็กน้อย', color: 'bg-yellow-100 dark:bg-yellow-950/50' },
  { level: 3, emoji: '😣', label: 'ปานกลาง', color: 'bg-orange-100 dark:bg-orange-950/50' },
  { level: 4, emoji: '😫', label: 'มาก', color: 'bg-red-100 dark:bg-red-950/50' },
  { level: 5, emoji: '😵', label: 'รุนแรง', color: 'bg-red-200 dark:bg-red-900/50' },
];

export function SymptomForm({ onSuccess, onCancel }: SymptomFormProps) {
  const { isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logSymptom = useLogSymptom();

  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [customSymptoms, setCustomSymptoms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [severity, setSeverity] = useState<number | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addCustomSymptom = () => {
    const value = customInput.trim();
    if (!value) return;
    if (!customSymptoms.includes(value)) {
      setCustomSymptoms((prev) => [...prev, value]);
      setSelectedSymptoms((prev) => new Set([...prev, `custom_${value}`]));
    }
    setCustomInput('');
  };

  const removeCustomSymptom = (value: string) => {
    setCustomSymptoms((prev) => prev.filter((s) => s !== value));
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      next.delete(`custom_${value}`);
      return next;
    });
  };

  const getSymptomLabels = () => {
    const labels: string[] = [];

    selectedSymptoms.forEach((id) => {
      if (id.startsWith('custom_')) {
        labels.push(id.replace('custom_', ''));
      } else {
        const preset = PRESET_SYMPTOMS.find((s) => s.id === id);
        if (preset) labels.push(preset.label);
      }
    });

    return labels;
  };

  const handleSubmit = async () => {
    if (selectedSymptoms.size === 0 || severity === null) return;

    setIsSaving(true);

    try {
      // Ensure patient profile exists (auto-create if needed)
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ description: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      const symptomLabels = getSymptomLabels();

      // Log each symptom separately
      for (const symptomName of symptomLabels) {
        await logSymptom.mutateAsync({
          patientId: resolvedPatientId,
          symptom_name: symptomName,
          severity_1to5: severity,
          body_location: location || undefined,
          duration_text: duration || undefined,
          notes: note.trim() || undefined,
        });
      }

      toast({ description: `บันทึก ${symptomLabels.length} อาการเรียบร้อย` });

      // Show warning for severe symptoms
      if (severity >= 4) {
        setTimeout(() => {
          toast({
            description: 'อาการรุนแรง! กรุณาปรึกษาแพทย์หากอาการไม่ดีขึ้น',
            variant: 'destructive',
          });
        }, 1500);
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error logging symptoms:', error);
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const allSelectedLabels = getSymptomLabels();
  const canSubmit = selectedSymptoms.size > 0 && severity !== null;

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
      {/* Selected Symptoms Tags */}
      {allSelectedLabels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Check className="w-4 h-4" />
            อาการที่เลือก
          </div>
          <div className="flex flex-wrap gap-2">
            {allSelectedLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
              >
                {label}
                <button
                  onClick={() => {
                    const preset = PRESET_SYMPTOMS.find((s) => s.label === label);
                    if (preset) {
                      toggleSymptom(preset.id);
                    } else {
                      removeCustomSymptom(label);
                    }
                  }}
                  className="hover:text-primary/70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Symptom Grid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="w-4 h-4 text-primary" />
          เลือกอาการ
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_SYMPTOMS.map((symptom) => {
            const isSelected = selectedSymptoms.has(symptom.id);
            return (
              <button
                key={symptom.id}
                onClick={() => toggleSymptom(symptom.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent bg-muted/50 hover:bg-muted'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    isSelected ? 'bg-primary/20' : 'bg-background'
                  )}
                >
                  <symptom.icon
                    className={cn(
                      'w-5 h-5',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-medium text-center',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {symptom.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Symptom Input */}
        <div className="flex gap-2">
          <Input
            placeholder="พิมพ์อาการอื่นๆ..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomSymptom();
              }
            }}
            className="flex-1"
          />
          <Button variant="secondary" onClick={addCustomSymptom} disabled={!customInput.trim()}>
            เพิ่ม
          </Button>
        </div>
      </div>

      {/* Severity Selector */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertCircle className="w-4 h-4 text-primary" />
          ความรุนแรง
        </div>
        <div className="grid grid-cols-5 gap-2">
          {SEVERITY_LEVELS.map((level) => (
            <button
              key={level.level}
              onClick={() => setSeverity(level.level)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all',
                severity === level.level
                  ? `border-primary ${level.color}`
                  : 'border-transparent bg-muted/50 hover:bg-muted'
              )}
            >
              <span className="text-2xl">{level.emoji}</span>
              <span className="text-[10px] font-medium text-muted-foreground text-center">
                {level.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Location Chips */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MapPin className="w-4 h-4" />
          ตำแหน่ง (ไม่บังคับ)
        </div>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocation(location === loc ? null : loc)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border-2 transition-all',
                location === loc
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Chips */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="w-4 h-4" />
          เริ่มเป็นตั้งแต่
        </div>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDuration(duration === d.id ? null : d.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border-2 transition-all',
                duration === d.id
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="w-4 h-4" />
          รายละเอียดเพิ่มเติม (ไม่บังคับ)
        </div>
        <Textarea
          placeholder="อธิบายอาการเพิ่มเติม..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[80px] resize-none"
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
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2"
          onClick={handleSubmit}
          disabled={isSaving || !canSubmit}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          บันทึกอาการ
        </Button>
      </div>
    </div>
  );
}
