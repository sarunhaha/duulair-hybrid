import { useState } from 'react';
import { Activity, HeartPulse, ArrowUp, ArrowDown, Minus, AlertTriangle, Check, Loader2, Save, Clock, Trash2, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useTodayVitals, useSaveVitals, useUpdateVitals, useDeleteVitals, getBloodPressureStatus } from '@/lib/api/hooks/use-health';
import type { VitalsLog } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { TimeSelectorPill } from './time-selector-pill';

interface VitalsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: VitalsLog;
}

export function VitalsForm({ onSuccess, onCancel, initialEditData }: VitalsFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();

  const { data: todayLogs, isLoading: logsLoading, refetch } = useTodayVitals(patientId);
  const saveVitals = useSaveVitals();
  const updateVitals = useUpdateVitals();
  const deleteVitals = useDeleteVitals();

  const now = new Date();
  const nowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const nowDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

  // Initialize state
  const [systolic, setSystolic] = useState(() => initialEditData?.bp_systolic?.toString() || '');
  const [diastolic, setDiastolic] = useState(() => initialEditData?.bp_diastolic?.toString() || '');
  const [pulse, setPulse] = useState(() => initialEditData?.heart_rate?.toString() || '');
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

  const allLogs = todayLogs || [];
  const latestLog = allLogs[0];

  const handleCancelEdit = () => {
    setEditingLog(null);
    setSystolic('');
    setDiastolic('');
    setPulse('');
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

  const bpStatus = latestLog?.bp_systolic && latestLog?.bp_diastolic
    ? getBloodPressureStatus(latestLog.bp_systolic, latestLog.bp_diastolic)
    : null;

  const handleSubmit = async () => {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);
    const hr = pulse ? parseInt(pulse) : undefined;

    if (!sys || !dia) {
      toast({ description: 'กรุณากรอกค่าความดันให้ครบถ้วน', variant: 'destructive' });
      return;
    }
    if (sys < 50 || sys > 250) {
      toast({ description: 'ค่าบนควรอยู่ระหว่าง 50-250 mmHg', variant: 'destructive' });
      return;
    }
    if (dia < 30 || dia > 150) {
      toast({ description: 'ค่าล่างควรอยู่ระหว่าง 30-150 mmHg', variant: 'destructive' });
      return;
    }
    if (sys <= dia) {
      toast({ description: 'ค่าบนต้องมากกว่าค่าล่าง', variant: 'destructive' });
      return;
    }
    if (hr && (hr < 40 || hr > 200)) {
      toast({ description: 'ค่าชีพจรควรอยู่ระหว่าง 40-200 ครั้ง/นาที', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ description: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      const measuredAt = `${selectedDate}T${selectedTime}:00+07:00`;

      if (editingLog) {
        await updateVitals.mutateAsync({
          id: editingLog.id,
          patientId: resolvedPatientId,
          bp_systolic: sys,
          bp_diastolic: dia,
          heart_rate: hr,
          measured_at: measuredAt,
        });
        toast({ description: 'แก้ไขข้อมูลเรียบร้อยแล้ว' });
        setEditingLog(null);
      } else {
        await saveVitals.mutateAsync({
          patientId: resolvedPatientId,
          bp_systolic: sys,
          bp_diastolic: dia,
          heart_rate: hr,
          measured_at: measuredAt,
        });
        toast({ description: 'บันทึกความดันเรียบร้อยแล้ว' });
      }

      setSystolic('');
      setDiastolic('');
      setPulse('');
      refetch();
      onSuccess?.();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <Check className="w-4 h-4" />;
      case 'low': return <ArrowDown className="w-4 h-4" />;
      case 'elevated': return <Minus className="w-4 h-4" />;
      case 'high-stage1':
      case 'high-stage2': return <ArrowUp className="w-4 h-4" />;
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      default: return null;
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

      {/* BP Input - Large Circular Inputs */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-2">
            <Label className="text-xs text-muted-foreground">ค่าบน (SYS)</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="120"
              min={50}
              max={250}
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              className="w-24 h-24 rounded-[32px] text-center text-4xl font-bold border-2 border-muted bg-muted/10 focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">mmHg</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Label className="text-xs text-muted-foreground">ค่าล่าง (DIA)</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="80"
              min={30}
              max={150}
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              className="w-24 h-24 rounded-[32px] text-center text-4xl font-bold border-2 border-muted bg-muted/10 focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">mmHg</p>
          </div>
        </div>

        {/* Pulse - smaller */}
        <div className="flex flex-col items-center gap-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <HeartPulse className="w-3.5 h-3.5 text-red-500" />
            ชีพจร (ไม่บังคับ)
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="72"
            min={40}
            max={200}
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            className="w-32 h-14 rounded-2xl text-center text-2xl font-bold border-2 border-muted bg-muted/10 focus:border-primary"
          />
          <p className="text-[10px] text-muted-foreground">ครั้ง/นาที</p>
        </div>
      </div>

      {/* BP Status Badge */}
      {bpStatus && !editingLog && (
        <div className="flex justify-center">
          <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold', bpStatus.color)}>
            {getStatusIcon(bpStatus.status)}
            {bpStatus.label}
          </div>
        </div>
      )}

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

      {/* Today's Logs */}
      {allLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="w-4 h-4" />
            บันทึกวันนี้
          </div>
          <div className="space-y-2">
            {allLogs.map((log) => {
              const status = log.bp_systolic && log.bp_diastolic
                ? getBloodPressureStatus(log.bp_systolic, log.bp_diastolic)
                : null;
              const time = new Date(log.measured_at).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const isDeleting = deleteConfirmId === log.id;

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => !isDeleting && handleEditDrawer(log)}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{time} น.</span>
                      {status && (
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', status.color)}>
                          {status.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold font-mono text-foreground">
                      {log.bp_systolic}/{log.bp_diastolic} mmHg
                      {log.heart_rate && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          <HeartPulse className="w-3 h-3 inline text-red-500" /> {log.heart_rate}
                        </span>
                      )}
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
              <DrawerTitle className="text-xl font-bold">แก้ไขบันทึกความดัน</DrawerTitle>
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
                    <p className="text-muted-foreground text-sm leading-relaxed px-8">ข้อมูลความดันของคุณถูกอัปเดตแล้ว</p>
                  </div>
                </div>
              ) : (
                <VitalsForm
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
      {allLogs.length === 0 && !logsLoading && (
        <div className="text-center py-6 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">ยังไม่มีการบันทึกวันนี้</p>
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
          disabled={isSaving || !systolic || !diastolic}
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
