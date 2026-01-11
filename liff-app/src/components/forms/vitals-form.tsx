import { useState, useEffect } from 'react';
import { Activity, HeartPulse, ArrowUp, ArrowDown, Minus, AlertTriangle, Check, Loader2, Save, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useTodayVitals, useSaveVitals, getBloodPressureStatus, type VitalsLog } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';

interface VitalsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function VitalsForm({ onSuccess, onCancel }: VitalsFormProps) {
  const { context } = useAuthStore();
  const patientId = context.patientId;
  const { toast } = useToast();

  const { data: todayLogs, isLoading: logsLoading, refetch } = useTodayVitals(patientId);
  const saveVitals = useSaveVitals();

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Local logs for development mode (when API not available)
  const [localLogs, setLocalLogs] = useState<VitalsLog[]>([]);

  // Load local logs on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedData = JSON.parse(localStorage.getItem(`vitals_${today}`) || '{"readings": []}');
    const logs = (savedData.readings || []).map((r: any, i: number) => ({
      id: r.id || `local-${i}`,
      bp_systolic: r.systolic,
      bp_diastolic: r.diastolic,
      heart_rate: r.pulse,
      weight: null,
      temperature: null,
      measured_at: r.timestamp || new Date().toISOString(),
      source: 'manual' as const,
    }));
    setLocalLogs(logs);
  }, []);

  // Combine API logs with local logs
  const allLogs = todayLogs && todayLogs.length > 0 ? todayLogs : localLogs;
  const latestLog = allLogs[0];

  // BP Status
  const bpStatus = latestLog?.bp_systolic && latestLog?.bp_diastolic
    ? getBloodPressureStatus(latestLog.bp_systolic, latestLog.bp_diastolic)
    : null;

  const handleSubmit = async () => {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);
    const hr = pulse ? parseInt(pulse) : undefined;

    // Validation
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
      if (patientId) {
        await saveVitals.mutateAsync({
          patientId,
          bp_systolic: sys,
          bp_diastolic: dia,
          heart_rate: hr,
        });
      } else {
        // Save to localStorage for development
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const reading = {
          id: Date.now().toString(),
          systolic: sys,
          diastolic: dia,
          pulse: hr,
          timestamp: now.toISOString(),
        };

        const savedData = JSON.parse(localStorage.getItem(`vitals_${today}`) || '{"readings": []}');
        savedData.readings.unshift(reading);
        localStorage.setItem(`vitals_${today}`, JSON.stringify(savedData));

        // Update local logs
        const newLog: VitalsLog = {
          id: reading.id,
          bp_systolic: sys,
          bp_diastolic: dia,
          heart_rate: hr || null,
          weight: null,
          temperature: null,
          measured_at: reading.timestamp,
          source: 'manual',
        };
        setLocalLogs((prev) => [newLog, ...prev]);
      }

      toast({ description: 'บันทึกความดันเรียบร้อยแล้ว' });

      // Clear form
      setSystolic('');
      setDiastolic('');
      setPulse('');

      // Refetch data
      refetch();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving vitals:', error);
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLog = (logId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const savedData = JSON.parse(localStorage.getItem(`vitals_${today}`) || '{"readings": []}');
    savedData.readings = savedData.readings.filter((r: any) => r.id !== logId);
    localStorage.setItem(`vitals_${today}`, JSON.stringify(savedData));
    setLocalLogs((prev) => prev.filter((l) => l.id !== logId));
    toast({ description: 'ลบรายการเรียบร้อยแล้ว' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <Check className="w-4 h-4" />;
      case 'low':
        return <ArrowDown className="w-4 h-4" />;
      case 'elevated':
        return <Minus className="w-4 h-4" />;
      case 'high-stage1':
      case 'high-stage2':
        return <ArrowUp className="w-4 h-4" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Current BP Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">ค่าบน (Systolic)</p>
          <p className="text-3xl font-bold text-foreground font-mono">
            {latestLog?.bp_systolic ?? '--'}
          </p>
          <p className="text-xs text-muted-foreground">mmHg</p>
        </div>
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">ค่าล่าง (Diastolic)</p>
          <p className="text-3xl font-bold text-foreground font-mono">
            {latestLog?.bp_diastolic ?? '--'}
          </p>
          <p className="text-xs text-muted-foreground">mmHg</p>
        </div>
      </div>

      {/* BP Status */}
      {bpStatus && (
        <div className="flex justify-center">
          <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold', bpStatus.color)}>
            {getStatusIcon(bpStatus.status)}
            {bpStatus.label}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="w-4 h-4 text-primary" />
          บันทึกค่าใหม่
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="systolic" className="text-xs text-muted-foreground">
              ค่าบน
            </Label>
            <Input
              id="systolic"
              type="number"
              inputMode="numeric"
              placeholder="120"
              min={50}
              max={250}
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              className="text-center text-lg font-semibold h-12"
            />
            <p className="text-[10px] text-muted-foreground text-center">mmHg</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="diastolic" className="text-xs text-muted-foreground">
              ค่าล่าง
            </Label>
            <Input
              id="diastolic"
              type="number"
              inputMode="numeric"
              placeholder="80"
              min={30}
              max={150}
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              className="text-center text-lg font-semibold h-12"
            />
            <p className="text-[10px] text-muted-foreground text-center">mmHg</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pulse" className="text-xs text-muted-foreground">
            ชีพจร (ไม่บังคับ)
          </Label>
          <Input
            id="pulse"
            type="number"
            inputMode="numeric"
            placeholder="72"
            min={40}
            max={200}
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            className="text-center text-lg font-semibold h-12"
          />
          <p className="text-[10px] text-muted-foreground text-center">ครั้ง/นาที</p>
        </div>
      </div>

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
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between bg-muted/50 rounded-xl p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {time}
                    </div>
                    <p className="text-lg font-bold font-mono">
                      {log.bp_systolic}/{log.bp_diastolic} mmHg
                    </p>
                    {log.heart_rate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <HeartPulse className="w-3 h-3 text-red-500" />
                        {log.heart_rate} ครั้ง/นาที
                      </div>
                    )}
                    {status && (
                      <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium', status.color)}>
                        {getStatusIcon(status.status)}
                        {status.label}
                      </div>
                    )}
                  </div>
                  {!patientId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8"
                      onClick={() => handleDeleteLog(log.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
          onClick={onCancel}
        >
          ยกเลิก
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
          บันทึก
        </Button>
      </div>
    </div>
  );
}
