import { useState } from 'react';
import { Droplet, Check, Loader2, Save, Clock, Trash2, X, ChevronRight } from 'lucide-react';
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
import { useTodayVitals, useSaveVitals, useUpdateVitals, useDeleteVitals } from '@/lib/api/hooks/use-health';
import type { VitalsLog } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { TimeSelectorPill } from './time-selector-pill';

type MealContext = 'fasting' | 'post_meal_1h' | 'post_meal_2h' | 'before_bed';

const MEAL_CONTEXTS: { value: MealContext; label: string }[] = [
  { value: 'fasting', label: 'ตื่นนอน' },
  { value: 'post_meal_1h', label: 'หลังอาหาร 1 ชม.' },
  { value: 'post_meal_2h', label: 'หลังอาหาร 2 ชม.' },
  { value: 'before_bed', label: 'ก่อนนอน' },
];

const MEAL_CONTEXT_LABELS: Record<string, string> = {
  fasting: 'ตื่นนอน',
  post_meal_1h: 'หลังอาหาร 1 ชม.',
  post_meal_2h: 'หลังอาหาร 2 ชม.',
  before_bed: 'ก่อนนอน',
};

function getGlucoseStatus(value: number, mealContext?: string | null) {
  const isFasting = !mealContext || mealContext === 'fasting' || mealContext === 'before_bed';
  if (isFasting) {
    if (value >= 126) return { label: 'สูง', status: 'high', color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' };
    if (value >= 100) return { label: 'เสี่ยง', status: 'pre', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' };
    return { label: 'ปกติ', status: 'normal', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' };
  } else {
    if (value >= 200) return { label: 'สูง', status: 'high', color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' };
    if (value >= 140) return { label: 'เสี่ยง', status: 'pre', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' };
    return { label: 'ปกติ', status: 'normal', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' };
  }
}

interface GlucoseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: VitalsLog;
}

export function GlucoseForm({ onSuccess, onCancel, initialEditData }: GlucoseFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();

  const { data: todayLogs, isLoading: logsLoading, refetch } = useTodayVitals(patientId);
  const saveVitals = useSaveVitals();
  const updateVitals = useUpdateVitals();
  const deleteVitals = useDeleteVitals();

  const now = new Date();
  const nowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const nowDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

  const [glucose, setGlucose] = useState(() => initialEditData?.glucose?.toString() || '');
  const [mealContext, setMealContext] = useState<MealContext | null>(() => (initialEditData?.meal_context as MealContext) || null);
  const [foodNotes, setFoodNotes] = useState(() => initialEditData?.food_notes || '');
  const [selectedTime, setSelectedTime] = useState(() => {
    if (initialEditData?.measured_at) {
      const d = new Date(initialEditData.measured_at);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return nowTime;
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialEditData?.measured_at) {
      const d = new Date(initialEditData.measured_at);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
    return nowDate;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editingLog, setEditingLog] = useState<VitalsLog | null>(() => initialEditData || null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Drawer-based edit state
  const [editDrawerItem, setEditDrawerItem] = useState<VitalsLog | null>(null);
  const [editDrawerSuccess, setEditDrawerSuccess] = useState(false);

  const handleEditDrawer = (log: VitalsLog) => {
    setEditDrawerItem(log);
    setEditDrawerSuccess(false);
  };

  const handleCloseEditDrawer = () => {
    setEditDrawerItem(null);
    setEditDrawerSuccess(false);
    refetch();
  };

  const handleEditDrawerSuccess = () => {
    setEditDrawerSuccess(true);
    setTimeout(() => {
      handleCloseEditDrawer();
    }, 1500);
  };

  // Filter today's logs to only glucose entries
  const glucoseLogs = (todayLogs || []).filter((log) => log.glucose);

  const handleCancelEdit = () => {
    setEditingLog(null);
    setGlucose('');
    setMealContext(null);
    setFoodNotes('');
    setSelectedTime(nowTime);
    setSelectedDate(nowDate);
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    try {
      await deleteVitals.mutateAsync({ id, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      refetch();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
    }
  };

  const glucoseValue = parseInt(glucose);
  const currentStatus = glucoseValue ? getGlucoseStatus(glucoseValue, mealContext) : null;

  const handleSubmit = async () => {
    const val = parseInt(glucose);

    if (!val) {
      toast({ description: 'กรุณากรอกค่าระดับน้ำตาล', variant: 'destructive' });
      return;
    }
    if (val < 20 || val > 600) {
      toast({ description: 'ค่าน้ำตาลควรอยู่ระหว่าง 20-600 mg/dL', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ description: 'เกิดข้อผิดพลาด กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      const measuredAt = `${selectedDate}T${selectedTime}:00+07:00`;

      if (editingLog) {
        await updateVitals.mutateAsync({
          id: editingLog.id,
          patientId: resolvedPatientId,
          glucose: val,
          meal_context: mealContext || undefined,
          food_notes: foodNotes || undefined,
          measured_at: measuredAt,
        });
        toast({ description: 'แก้ไขข้อมูลเรียบร้อยแล้ว' });
        setEditingLog(null);
      } else {
        await saveVitals.mutateAsync({
          patientId: resolvedPatientId,
          glucose: val,
          meal_context: mealContext || undefined,
          food_notes: foodNotes || undefined,
        });
        toast({ description: 'บันทึกระดับน้ำตาลเรียบร้อยแล้ว' });
      }

      setGlucose('');
      setMealContext(null);
      setFoodNotes('');
      refetch();
      onSuccess?.();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    } finally {
      setIsSaving(false);
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
      {/* Time Selector Pill */}
      <TimeSelectorPill
        time={selectedTime}
        onTimeChange={setSelectedTime}
        date={selectedDate}
        onDateChange={setSelectedDate}
        showDate={!!editingLog}
      />

      {/* Glucose Input - Large Circular */}
      <div className="flex flex-col items-center gap-3">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Droplet className="w-3.5 h-3.5 text-pink-500" />
          ระดับน้ำตาลในเลือด
        </Label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder="100"
          min={20}
          max={600}
          value={glucose}
          onChange={(e) => setGlucose(e.target.value)}
          className="w-32 h-32 rounded-[32px] text-center text-5xl font-bold border-2 border-pink-200 dark:border-pink-900 bg-pink-50/50 dark:bg-pink-950/20 focus:border-pink-500 text-pink-700 dark:text-pink-300"
        />
        <p className="text-xs text-muted-foreground">mg/dL</p>
      </div>

      {/* Glucose Status Badge */}
      {currentStatus && !editingLog && (
        <div className="flex justify-center">
          <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold', currentStatus.color)}>
            <Check className="w-4 h-4" />
            {currentStatus.label}
          </div>
        </div>
      )}

      {/* Meal Context Pills */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">ช่วงเวลาวัด</Label>
        <div className="flex flex-wrap gap-2">
          {MEAL_CONTEXTS.map((ctx) => (
            <button
              key={ctx.value}
              onClick={() => setMealContext(mealContext === ctx.value ? null : ctx.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                mealContext === ctx.value
                  ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                  : 'bg-white dark:bg-card text-muted-foreground border-muted hover:border-pink-300'
              )}
            >
              {ctx.label}
            </button>
          ))}
        </div>
      </div>

      {/* Food Notes */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">อาหารที่ทาน (ไม่บังคับ)</Label>
        <Textarea
          placeholder="เช่น ข้าวต้ม ผักสด..."
          value={foodNotes}
          onChange={(e) => setFoodNotes(e.target.value)}
          className="rounded-xl resize-none h-16 text-sm"
        />
      </div>

      {/* Date/Time editing - only shown when editing */}
      {editingLog && (
        <div className="border border-muted bg-white dark:bg-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>วันที่และเวลาบันทึก</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground block">วันที่</Label>
              <DateInput value={selectedDate} onChange={setSelectedDate} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground block">เวลา</Label>
              <TimeInput value={selectedTime} onChange={setSelectedTime} />
            </div>
          </div>
        </div>
      )}

      {/* Today's Glucose Logs */}
      {glucoseLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="w-4 h-4" />
            บันทึกน้ำตาลวันนี้
          </div>
          <div className="space-y-2">
            {glucoseLogs.map((log) => {
              const status = log.glucose ? getGlucoseStatus(log.glucose, log.meal_context) : null;
              const time = new Date(log.measured_at).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const isDeleting = deleteConfirmId === log.id;
              const ctxLabel = log.meal_context ? MEAL_CONTEXT_LABELS[log.meal_context] : null;

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => !isDeleting && handleEditDrawer(log)}
                >
                  <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center shrink-0">
                    <Droplet className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{time} น.</span>
                      {ctxLabel && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{ctxLabel}</span>
                      )}
                      {status && (
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', status.color)}>
                          {status.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold font-mono text-foreground">
                      {log.glucose} mg/dL
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isDeleting ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                          disabled={deleteVitals.isPending}
                          className="h-7 px-2 text-xs"
                        >
                          {deleteVitals.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ยืนยัน'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
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
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(log.id); }}
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

      {/* Edit Drawer */}
      {editDrawerItem && (
        <Drawer open={true} onOpenChange={(open) => !open && handleCloseEditDrawer()}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="flex items-center justify-between px-6">
              <DrawerTitle className="text-xl font-bold">แก้ไขบันทึกน้ำตาล</DrawerTitle>
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
                    <p className="text-muted-foreground text-sm leading-relaxed px-8">ข้อมูลน้ำตาลของคุณถูกอัปเดตแล้ว</p>
                  </div>
                </div>
              ) : (
                <GlucoseForm
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

      {/* Empty State */}
      {glucoseLogs.length === 0 && !logsLoading && (
        <div className="text-center py-6 text-muted-foreground">
          <Droplet className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">ยังไม่มีการบันทึกน้ำตาลวันนี้</p>
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
          className="flex-[2] h-14 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-lg shadow-xl shadow-pink-500/20 hover:scale-[1.02] transition-all gap-2"
          onClick={handleSubmit}
          disabled={isSaving || !glucose}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {editingLog ? 'อัปเดต' : 'บันทึก'}
        </Button>
      </div>
    </div>
  );
}
