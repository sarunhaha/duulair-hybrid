import { useState, useEffect } from 'react';
import { Droplet, Plus, Clock, Trash2, Target, Settings, Zap, Pencil, Check, X } from 'lucide-react';
import { TimeInput } from '@/components/ui/time-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAddWater, useTodayWater } from '@/lib/api/hooks/use-health';
import { TimeSelectorPill } from './time-selector-pill';

interface WaterLog {
  id: string;
  amount: number;
  time: string;
  timestamp: string;
}

interface WaterLogDB {
  id: string;
  amount_ml: number;
  logged_at: string;
}

interface WaterFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: WaterLogDB;
}

export function WaterForm({ onSuccess, onCancel }: WaterFormProps) {
  const { patientId } = useAuth();
  const { toast } = useToast();

  // API hooks
  const addWaterMutation = useAddWater();
  const { refetch: refetchTodayWater } = useTodayWater(patientId);

  const [totalToday, setTotalToday] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [todayLogs, setTodayLogs] = useState<WaterLog[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState('');

  // Helper to get local date string (Bangkok timezone)
  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  // Load data on mount
  useEffect(() => {
    const today = getLocalDateString();
    const savedData = JSON.parse(localStorage.getItem(`water_${today}`) || '{"total": 0, "logs": [], "goal": 2000}');
    setTotalToday(savedData.total || 0);
    setTodayLogs(savedData.logs || []);
    setDailyGoal(savedData.goal || 2000);
  }, []);

  const saveData = (total: number, logs: WaterLog[], goal: number) => {
    const today = getLocalDateString();
    localStorage.setItem(`water_${today}`, JSON.stringify({
      total,
      logs,
      goal,
    }));
  };

  const addWater = async (amount: number, timeOverride?: string) => {
    if (amount < 1) return;

    setIsSaving(true);

    try {
      const now = new Date();
      let displayTime: string;
      let timestamp: string;

      if (timeOverride) {
        // Use the custom time provided
        displayTime = timeOverride;
        // Create timestamp with custom time for today
        const [hours, minutes] = timeOverride.split(':').map(Number);
        const customDate = new Date();
        customDate.setHours(hours, minutes, 0, 0);
        timestamp = customDate.toISOString();
      } else {
        displayTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        timestamp = now.toISOString();
      }

      // Calculate glasses (1 glass = 250ml)
      const glasses = Math.round(amount / 250);

      // Save to backend API
      if (patientId) {
        try {
          await addWaterMutation.mutateAsync({
            patientId,
            glasses: glasses || 1,
            amount_ml: amount,
            logged_at: timestamp,
          });
          // Refetch to get updated data from API
          refetchTodayWater();
        } catch {
          // API error - still save locally
        }
      } else {
        // No patientId, skip API call
      }

      // Also save to localStorage for local display
      const log: WaterLog = {
        id: Date.now().toString(),
        amount,
        time: displayTime,
        timestamp,
      };

      const newTotal = totalToday + amount;
      const newLogs = [log, ...todayLogs];

      setTotalToday(newTotal);
      setTodayLogs(newLogs);
      saveData(newTotal, newLogs, dailyGoal);

      toast({ description: `เพิ่ม ${amount} ml เรียบร้อยแล้ว` });
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการบันทึก', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const addCustomWater = () => {
    const amount = parseInt(customAmount);
    if (!amount || amount < 1 || amount > 5000) {
      toast({ description: 'กรุณาระบุปริมาณระหว่าง 1-5000 ml', variant: 'destructive' });
      return;
    }
    addWater(amount, pillTime);
    setCustomAmount('');
  };

  const startEditingTime = (log: WaterLog) => {
    setEditingLogId(log.id);
    // Convert display time to input format (HH:mm)
    setEditingTime(log.time);
  };

  const cancelEditingTime = () => {
    setEditingLogId(null);
    setEditingTime('');
  };

  const saveEditedTime = (logId: string) => {
    if (!editingTime) {
      cancelEditingTime();
      return;
    }

    const newLogs = todayLogs.map((log) => {
      if (log.id === logId) {
        // Update timestamp with new time
        const [hours, minutes] = editingTime.split(':').map(Number);
        const newDate = new Date();
        newDate.setHours(hours, minutes, 0, 0);

        return {
          ...log,
          time: editingTime,
          timestamp: newDate.toISOString(),
        };
      }
      return log;
    });

    setTodayLogs(newLogs);
    saveData(totalToday, newLogs, dailyGoal);
    setEditingLogId(null);
    setEditingTime('');
    toast({ description: 'อัพเดทเวลาเรียบร้อยแล้ว' });
  };

  const deleteLog = (logId: string) => {
    const log = todayLogs.find((l) => l.id === logId);
    if (!log) return;

    const newTotal = totalToday - log.amount;
    const newLogs = todayLogs.filter((l) => l.id !== logId);

    setTotalToday(newTotal);
    setTodayLogs(newLogs);
    saveData(newTotal, newLogs, dailyGoal);
    toast({ description: 'ลบรายการเรียบร้อยแล้ว' });
  };

  const updateGoal = () => {
    saveData(totalToday, todayLogs, dailyGoal);
    setShowSettings(false);
    toast({ description: 'อัพเดทเป้าหมายแล้ว' });
  };

  const progress = Math.min(100, (totalToday / dailyGoal) * 100);
  const remaining = Math.max(0, dailyGoal - totalToday);
  const glassCount = Math.floor(totalToday / 250);

  const quickAddOptions = [
    { amount: 250, label: '1 แก้ว' },
    { amount: 500, label: '2 แก้ว' },
    { amount: 750, label: '3 แก้ว' },
  ];

  // Time state for custom logging
  const [pillTime, setPillTime] = useState(() => {
    const n = new Date();
    return `${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`;
  });

  return (
    <div className="space-y-6 pb-4">
      {/* Time Selector Pill */}
      <TimeSelectorPill
        time={pillTime}
        onTimeChange={setPillTime}
      />

      {/* Water Summary Card - Clean style */}
      <div className="bg-blue-50/50 dark:bg-blue-950/20 p-6 rounded-[32px] text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Droplet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-5xl font-bold font-mono text-foreground">{totalToday}</div>
        <div className="text-muted-foreground">มิลลิลิตร ({glassCount} แก้ว)</div>

        {/* Progress */}
        <div className="space-y-2 pt-2">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              เป้าหมาย: {dailyGoal} ml
            </span>
            <span>{remaining} ml อีก</span>
          </div>
        </div>
      </div>

      {/* Quick Add */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Zap className="w-4 h-4 text-primary" />
          เพิ่มเร็ว
        </div>
        <div className="grid grid-cols-3 gap-3">
          {quickAddOptions.map((opt) => (
            <button
              key={opt.amount}
              onClick={() => addWater(opt.amount, pillTime)}
              disabled={isSaving}
              className={cn(
                'bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 text-center transition-all',
                'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30',
                'active:scale-95'
              )}
            >
              <div className="text-lg font-semibold text-blue-600">{opt.amount} ml</div>
              <div className="text-xs text-muted-foreground">{opt.label}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="ระบุปริมาณ (ml)"
            min={1}
            max={5000}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="flex-1 rounded-2xl bg-muted/20 border border-muted"
          />
          <Button
            variant="default"
            onClick={addCustomWater}
            disabled={isSaving || !customAmount}
            className="gap-1.5 rounded-2xl"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม
          </Button>
        </div>
      </div>

      {/* Today's Logs */}
      {todayLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="w-4 h-4" />
            บันทึกวันนี้
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {todayLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3"
              >
                <div className="space-y-0.5 flex-1">
                  {editingLogId === log.id ? (
                    <div className="flex items-center gap-2">
                      <TimeInput
                        value={editingTime}
                        onChange={(val) => {
                          setEditingTime(val);
                          // Auto-save after picker confirms
                          const newLogs = todayLogs.map((l) => {
                            if (l.id === log.id) {
                              const [hours, mins] = val.split(':').map(Number);
                              const newDate = new Date();
                              newDate.setHours(hours, mins, 0, 0);
                              return { ...l, time: val, timestamp: newDate.toISOString() };
                            }
                            return l;
                          });
                          setTodayLogs(newLogs);
                          saveData(totalToday, newLogs, dailyGoal);
                          setEditingLogId(null);
                          setEditingTime('');
                          toast({ description: 'อัพเดทเวลาเรียบร้อยแล้ว' });
                        }}
                        className="w-28 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={cancelEditingTime}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-blue-600 transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      onClick={() => startEditingTime(log)}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-medium">{log.time}</span>
                      <Pencil className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                  )}
                  <p className="text-base font-semibold text-blue-600">+{log.amount} ml</p>
                </div>
                {editingLogId !== log.id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => deleteLog(log.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {todayLogs.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Droplet className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">ยังไม่มีการบันทึกวันนี้</p>
        </div>
      )}

      {/* Settings */}
      <div className="space-y-3">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <Settings className="w-4 h-4" />
          ตั้งค่า
        </button>
        {showSettings && (
          <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
            <span className="text-sm text-muted-foreground">เป้าหมายรายวัน (ml)</span>
            <Input
              type="number"
              inputMode="numeric"
              min={500}
              max={5000}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(parseInt(e.target.value) || 2000)}
              className="w-24 text-center"
            />
            <Button size="sm" onClick={updateGoal}>
              บันทึก
            </Button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
          onClick={onCancel}
        >
          ปิด
        </Button>
        <Button
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
          onClick={onSuccess}
        >
          เสร็จสิ้น
        </Button>
      </div>
    </div>
  );
}
