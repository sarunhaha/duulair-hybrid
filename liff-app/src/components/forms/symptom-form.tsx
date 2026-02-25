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
  History,
  Trash2,
  Calendar,
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
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { useLogSymptom, useTodaySymptoms, useDeleteSymptom, useUpdateSymptom } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { TimeSelectorPill } from './time-selector-pill';

interface SymptomLog {
  id: string;
  patient_id: string;
  symptom_name: string;
  severity_1to5?: number;
  body_location?: string;
  duration_text?: string;
  notes?: string;
  created_at: string;
}

interface SymptomFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: SymptomLog;
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

export function SymptomForm({ onSuccess, onCancel, initialEditData }: SymptomFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logSymptom = useLogSymptom();
  const updateSymptom = useUpdateSymptom();
  const deleteSymptom = useDeleteSymptom();
  const { data: todaySymptoms, refetch: refetchSymptoms } = useTodaySymptoms(patientId);

  const now = new Date();
  const [selectedTime, setSelectedTime] = useState(() => {
    if (initialEditData?.created_at) {
      const d = new Date(initialEditData.created_at);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  // Initialize state - use initialEditData if provided (component is re-mounted via key prop)
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(() => {
    if (initialEditData?.symptom_name) {
      const preset = PRESET_SYMPTOMS.find(s => s.label === initialEditData.symptom_name);
      if (preset) {
        return new Set([preset.id]);
      } else {
        return new Set([`custom_${initialEditData.symptom_name}`]);
      }
    }
    return new Set();
  });
  const [customSymptoms, setCustomSymptoms] = useState<string[]>(() => {
    if (initialEditData?.symptom_name) {
      const preset = PRESET_SYMPTOMS.find(s => s.label === initialEditData.symptom_name);
      if (!preset) {
        return [initialEditData.symptom_name];
      }
    }
    return [];
  });
  const [customInput, setCustomInput] = useState('');
  const [severity, setSeverity] = useState<number | null>(() => initialEditData?.severity_1to5 ?? null);
  const [location, setLocation] = useState<string | null>(() => initialEditData?.body_location ?? null);
  const [duration, setDuration] = useState<string | null>(() => initialEditData?.duration_text ?? null);
  const [note, setNote] = useState(() => initialEditData?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<SymptomLog | null>(() => initialEditData ?? null);
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
  const [editDrawerItem, setEditDrawerItem] = useState<SymptomLog | null>(null);
  const [editDrawerSuccess, setEditDrawerSuccess] = useState(false);

  // Open edit drawer
  const handleEditDrawer = (log: SymptomLog) => {
    setEditDrawerItem(log);
    setEditDrawerSuccess(false);
  };

  // Close edit drawer
  const handleCloseEditDrawer = () => {
    setEditDrawerItem(null);
    setEditDrawerSuccess(false);
    refetchSymptoms();
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
    setSelectedSymptoms(new Set());
    setCustomSymptoms([]);
    setSeverity(null);
    setLocation(null);
    setDuration(null);
    setNote('');
    setEditDate('');
    setEditTime('');
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    try {
      await deleteSymptom.mutateAsync({ id, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      refetchSymptoms();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
    }
  };

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
        toast({ description: 'เกิดข้อผิดพลาด กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      const symptomLabels = getSymptomLabels();

      // If we're in edit mode, update the existing symptom
      if (editingLog) {
        const symptomName = symptomLabels[0] || editingLog.symptom_name;

        // Build created_at from date and time - send as Bangkok local time with +07:00 offset
        const createdAt = editDate && editTime
          ? `${editDate}T${editTime}:00+07:00`
          : undefined;

        await updateSymptom.mutateAsync({
          id: editingLog.id,
          patientId: resolvedPatientId,
          symptom_name: symptomName,
          severity_1to5: severity,
          body_location: location || undefined,
          duration_text: duration || undefined,
          notes: note.trim() || undefined,
          created_at: createdAt,
        });
        toast({ description: 'อัปเดตอาการเรียบร้อย' });
      } else {
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
      }

      // Show warning for severe symptoms
      if (severity >= 4) {
        setTimeout(() => {
          toast({
            description: 'อาการรุนแรง! กรุณาปรึกษาแพทย์หากอาการไม่ดีขึ้น',
            variant: 'destructive',
          });
        }, 1500);
      }

      // Refetch today's symptoms to show in the list
      refetchSymptoms();
      onSuccess?.();
    } catch {
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
      {/* Edit Drawer */}
      {editDrawerItem && (
        <Drawer open={true} onOpenChange={(open) => !open && handleCloseEditDrawer()}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="flex items-center justify-between px-6">
              <DrawerTitle className="text-xl font-bold">แก้ไขบันทึกอาการ</DrawerTitle>
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
                      ข้อมูลอาการของคุณถูกอัปเดตแล้ว
                    </p>
                  </div>
                </div>
              ) : (
                <SymptomForm
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
                  'flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'bg-white dark:bg-card border-muted shadow-sm hover:bg-muted/50'
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
                'flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 transition-all',
                severity === level.level
                  ? `border-primary ${level.color}`
                  : 'bg-white dark:bg-card border-muted shadow-sm hover:bg-muted/50'
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
                'px-3 py-1.5 rounded-2xl text-sm border-2 transition-all',
                location === loc
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'bg-white dark:bg-card border-muted shadow-sm text-muted-foreground hover:bg-muted/50'
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
                'px-3 py-1.5 rounded-2xl text-sm border-2 transition-all',
                duration === d.id
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'bg-white dark:bg-card border-muted shadow-sm text-muted-foreground hover:bg-muted/50'
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
          className="min-h-[80px] resize-none rounded-2xl bg-muted/20 border border-muted"
        />
      </div>

      {/* Today's Logged Symptoms */}
      {todaySymptoms && todaySymptoms.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="w-4 h-4 text-primary" />
            บันทึกวันนี้ ({todaySymptoms.length} รายการ)
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {todaySymptoms.map((symptom) => {
              const isDeleting = deleteConfirmId === symptom.id;
              return (
                <div
                  key={symptom.id}
                  className="flex items-center gap-3 bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => !isDeleting && handleEditDrawer(symptom)}
                >
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(symptom.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                      {symptom.severity_1to5 && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          ระดับ {symptom.severity_1to5}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{symptom.symptom_name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isDeleting ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(symptom.id);
                          }}
                          disabled={deleteSymptom.isPending}
                          className="h-7 px-2 text-xs"
                        >
                          {deleteSymptom.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'ยืนยัน'
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          ยกเลิก
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(symptom.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                      </>
                    )}
                  </div>
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
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2"
          onClick={handleSubmit}
          disabled={isSaving || !canSubmit}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {editingLog ? 'อัปเดต' : 'บันทึกอาการ'}
        </Button>
      </div>
    </div>
  );
}
