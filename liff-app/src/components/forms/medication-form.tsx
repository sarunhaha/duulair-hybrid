import { useState, useEffect, useMemo } from 'react';
import {
  Pill,
  Clock,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Check,
  Loader2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { usePatientMedications, useTodayMedicationLogs, useLogMedication, type Medication } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';

interface MedicationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

const TIME_PERIODS = [
  { id: 'morning' as TimePeriod, label: 'เช้า', icon: Sunrise },
  { id: 'afternoon' as TimePeriod, label: 'กลางวัน', icon: Sun },
  { id: 'evening' as TimePeriod, label: 'เย็น', icon: Sunset },
  { id: 'night' as TimePeriod, label: 'ก่อนนอน', icon: Moon },
];

function getCurrentPeriod(): TimePeriod {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'afternoon';
  if (hour >= 14 && hour < 20) return 'evening';
  return 'night';
}

function formatDosage(med: Medication): string {
  const amount = med.dosage_amount || 1;
  const form = med.dosage_form || 'tablet';

  let dosageText = '';
  if (form === 'tablet' || form === 'capsule') {
    if (amount === 0.25) dosageText = '1/4 เม็ด';
    else if (amount === 0.5) dosageText = '1/2 เม็ด';
    else if (amount === 0.75) dosageText = '3/4 เม็ด';
    else if (amount === 1) dosageText = '1 เม็ด';
    else if (amount === 1.5) dosageText = '1.5 เม็ด';
    else dosageText = `${amount} เม็ด`;
  } else if (form === 'liquid') {
    dosageText = `${amount} ml`;
  } else {
    dosageText = `${amount} ${med.dosage_unit || form}`;
  }

  if (med.instructions) {
    dosageText += ` - ${med.instructions}`;
  }

  return dosageText;
}

export function MedicationForm({ onSuccess, onCancel }: MedicationFormProps) {
  const { context } = useAuthStore();
  const patientId = context.patientId;
  const { toast } = useToast();

  const { data: medications, isLoading: medsLoading } = usePatientMedications(patientId);
  const { data: todayLogs, refetch: refetchLogs } = useTodayMedicationLogs(patientId);
  const logMedication = useLogMedication();

  const [currentPeriod, setCurrentPeriod] = useState<TimePeriod>(getCurrentPeriod());
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Current time display
  const currentTime = new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Filter medications for current period
  const medsForPeriod = useMemo(() => {
    if (!medications) return [];
    return medications.filter((med) => {
      const times = med.times || [];
      return times.includes(currentPeriod);
    });
  }, [medications, currentPeriod]);

  // Check which meds are already logged today for this period
  const loggedMedIds = useMemo(() => {
    if (!todayLogs) return new Set<string>();
    return new Set(
      todayLogs
        .filter((log) => log.time_period === currentPeriod)
        .map((log) => log.medication_id)
    );
  }, [todayLogs, currentPeriod]);

  // Clear selection when period changes
  useEffect(() => {
    setSelectedMeds(new Set());
  }, [currentPeriod]);

  const toggleMed = (medId: string) => {
    if (loggedMedIds.has(medId)) return; // Already logged

    setSelectedMeds((prev) => {
      const next = new Set(prev);
      if (next.has(medId)) {
        next.delete(medId);
      } else {
        next.add(medId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedMeds.size === 0) return;

    setIsSaving(true);

    try {
      if (patientId) {
        // Log each medication separately
        for (const medId of Array.from(selectedMeds)) {
          const med = (medications || []).find(m => m.id === medId);
          await logMedication.mutateAsync({
            patientId,
            medication_id: medId,
            medication_name: med?.name,
            dosage: med?.dosage_amount ? `${med.dosage_amount} ${med.dosage_unit}` : undefined,
            note: note.trim() || undefined,
          });
        }
      } else {
        // Save to localStorage for development
        const today = new Date().toISOString().split('T')[0];
        const logs = Array.from(selectedMeds).map((medId) => ({
          medication_id: medId,
          time_period: currentPeriod,
          note: note.trim() || null,
          logged_at: new Date().toISOString(),
        }));
        const savedData = JSON.parse(localStorage.getItem(`meds_${today}`) || '{"logs": []}');
        savedData.logs.push(...logs);
        localStorage.setItem(`meds_${today}`, JSON.stringify(savedData));
      }

      toast({ description: `บันทึกกินยา ${selectedMeds.size} รายการเรียบร้อย` });
      setSelectedMeds(new Set());
      setNote('');
      refetchLogs();
      onSuccess?.();
    } catch (error) {
      console.error('Error logging medication:', error);
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const periodLabels: Record<TimePeriod, string> = {
    morning: 'เช้า',
    afternoon: 'กลางวัน',
    evening: 'เย็น',
    night: 'ก่อนนอน',
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Current Time Card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-4 text-white flex items-center justify-center gap-3">
        <Clock className="w-6 h-6 opacity-90" />
        <span className="text-2xl font-semibold font-mono">{currentTime}</span>
      </div>

      {/* Time Period Selector */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="w-4 h-4" />
          ช่วงเวลา
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.id}
              onClick={() => setCurrentPeriod(period.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all',
                currentPeriod === period.id
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent bg-muted/50 hover:bg-muted'
              )}
            >
              <period.icon
                className={cn(
                  'w-5 h-5',
                  currentPeriod === period.id ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium',
                  currentPeriod === period.id ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {period.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Medication List */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Pill className="w-4 h-4 text-primary" />
          เลือกยาที่กินแล้ว
        </div>

        {medsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : medsForPeriod.length === 0 ? (
          <div className="text-center py-8 bg-muted/50 rounded-xl">
            <Pill className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">ไม่มียาสำหรับช่วงเวลานี้</p>
          </div>
        ) : (
          <div className="space-y-2">
            {medsForPeriod.map((med) => {
              const isLogged = loggedMedIds.has(med.id);
              const isSelected = selectedMeds.has(med.id);

              return (
                <button
                  key={med.id}
                  onClick={() => toggleMed(med.id)}
                  disabled={isLogged}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all',
                    isLogged
                      ? 'bg-muted opacity-60 border-transparent cursor-not-allowed'
                      : isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-card hover:border-border'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors',
                      isLogged
                        ? 'bg-muted-foreground border-muted-foreground'
                        : isSelected
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground/30'
                    )}
                  >
                    {(isLogged || isSelected) && <Check className="w-4 h-4 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{med.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDosage(med)}</p>
                  </div>

                  <div
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded',
                      isLogged
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {isLogged ? 'บันทึกแล้ว' : periodLabels[currentPeriod]}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Note Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="w-4 h-4" />
          หมายเหตุ (ไม่บังคับ)
        </div>
        <Textarea
          placeholder="เช่น ลืมกินยาตอนเช้า, กินยาช้ากว่าปกติ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>

      {/* Selected Count */}
      <p className="text-center text-sm text-muted-foreground">
        เลือกแล้ว {selectedMeds.size} รายการ
      </p>

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
          disabled={isSaving || selectedMeds.size === 0}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
