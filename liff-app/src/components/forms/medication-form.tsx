import { useState, useMemo } from 'react';
import {
  Pill,
  Clock,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Check,
  Loader2,
  Plus,
  Settings,
  History,
  Trash2,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { usePatientMedications, useTodayMedicationLogs, useLogMedication, useDeleteMedicationLog } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { TimeSelectorPill } from './time-selector-pill';

interface MedicationLogDB {
  id: string;
  medication_id: string;
  medication_name?: string;
  taken_at: string;
  dosage_taken: number | null;
  dosage?: string;
  time_period: string | null;
  notes: string | null;
  scheduled_time?: string;
}

interface MedicationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: MedicationLogDB;
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

export function MedicationForm({ onSuccess, onCancel }: MedicationFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: medications, isLoading: medsLoading } = usePatientMedications(patientId);
  const { data: todayLogs, refetch: refetchLogs } = useTodayMedicationLogs(patientId);
  const logMedication = useLogMedication();
  const deleteMedicationLog = useDeleteMedicationLog();

  const [currentPeriod, setCurrentPeriod] = useState<TimePeriod>(getCurrentPeriod());
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const now = new Date();
  const [selectedTime, setSelectedTime] = useState(
    `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  );
  const [selectedDate, setSelectedDate] = useState(
    `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
  );

  // Detail drawer for today's log
  const [detailLog, setDetailLog] = useState<MedicationLogDB | null>(null);

  // All active medications — no period filtering
  const activeMeds = useMemo(() => {
    if (!medications) return [];
    return medications.filter((med) => med.active !== false);
  }, [medications]);

  // IDs of meds already logged today
  const loggedMedIds = useMemo(() => {
    if (!todayLogs) return new Set<string>();
    return new Set(todayLogs.map((log) => log.medication_id));
  }, [todayLogs]);

  const toggleMed = (medId: string) => {
    if (loggedMedIds.has(medId)) return;
    setSelectedMeds((prev) => {
      const next = new Set(prev);
      if (next.has(medId)) next.delete(medId);
      else next.add(medId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedMeds.size === 0) return;
    setIsSaving(true);
    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ description: 'เกิดข้อผิดพลาด กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }
      const takenAt = `${selectedDate}T${selectedTime}:00+07:00`;
      for (const medId of Array.from(selectedMeds)) {
        const med = activeMeds.find(m => m.id === medId);
        await logMedication.mutateAsync({
          patientId: resolvedPatientId,
          medication_id: medId,
          medication_name: med?.name,
          scheduled_time: selectedTime,
          taken_at: takenAt,
        });
      }
      toast({ description: `บันทึกกินยา ${selectedMeds.size} รายการเรียบร้อย` });
      setSelectedMeds(new Set());
      refetchLogs();
      onSuccess?.();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!patientId) return;
    try {
      await deleteMedicationLog.mutateAsync({ id, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      setDetailLog(null);
      refetchLogs();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
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

  const todayLogsList = todayLogs || [];

  return (
    <div className="space-y-6 pb-4">
      {/* Time Selector Pill */}
      <TimeSelectorPill
        time={selectedTime}
        onTimeChange={setSelectedTime}
        date={selectedDate}
        onDateChange={setSelectedDate}
        showDate
      />

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
                'flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all',
                currentPeriod === period.id
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent bg-white dark:bg-card shadow-sm hover:bg-muted/50'
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
        ) : activeMeds.length === 0 ? (
          <div className="text-center py-8 border border-muted bg-white dark:bg-card rounded-2xl space-y-4">
            <Pill className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">ยังไม่มีรายการยา</p>
              <p className="text-xs text-muted-foreground/70 mt-1">เพิ่มรายการยาเพื่อเริ่มบันทึก</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/settings/medications')}>
              <Plus className="w-4 h-4" />
              เพิ่มรายการยา
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {activeMeds.map((med) => {
              const isLogged = loggedMedIds.has(med.id);
              const isSelected = selectedMeds.has(med.id);

              return (
                <button
                  key={med.id}
                  onClick={() => toggleMed(med.id)}
                  disabled={isLogged}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all',
                    isLogged
                      ? 'bg-muted/50 opacity-60 border-muted cursor-not-allowed'
                      : isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-muted bg-white dark:bg-card shadow-sm hover:border-primary/30'
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
                  </div>

                  {isLogged && (
                    <div className="text-xs font-medium px-2.5 py-1 rounded-xl bg-orange-500 text-white">
                      กินแล้ว
                    </div>
                  )}
                </button>
              );
            })}

            <button
              onClick={() => navigate('/settings/medications')}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Settings className="w-4 h-4" />
              จัดการรายการยา
            </button>
          </div>
        )}
      </div>

      {/* Selected Count */}
      {selectedMeds.size > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          เลือกแล้ว {selectedMeds.size} รายการ
        </p>
      )}

      {/* Today's Logged Medications */}
      {todayLogsList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="w-4 h-4 text-primary" />
            บันทึกวันนี้ ({todayLogsList.length} รายการ)
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {todayLogsList.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => deleteConfirmId !== log.id && setDetailLog(log)}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.taken_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {log.medication_name || 'ยา'}
                  </p>
                </div>
                {deleteConfirmId === log.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }}
                      disabled={deleteMedicationLog.isPending}
                    >
                      {deleteMedicationLog.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ลบ'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
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
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(log.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Drawer for log item */}
      {detailLog && (
        <Drawer open={true} onOpenChange={(open) => !open && setDetailLog(null)}>
          <DrawerContent className="max-h-[60vh]">
            <DrawerHeader className="flex items-center justify-between px-6">
              <DrawerTitle className="text-xl font-bold">รายละเอียด</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  <X className="w-5 h-5" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="px-6 pb-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
                  <Pill className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-bold text-lg text-foreground">{detailLog.medication_name || 'ยา'}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(detailLog.taken_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                className="w-full h-12 rounded-2xl font-bold gap-2"
                onClick={() => handleDeleteLog(detailLog.id)}
                disabled={deleteMedicationLog.isPending}
              >
                {deleteMedicationLog.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                ลบรายการนี้
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      )}

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
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
