import { useState, useEffect } from 'react';
import { Droplet, Plus, Clock, Trash2, Target, Settings, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface WaterLog {
  id: string;
  amount: number;
  time: string;
  timestamp: string;
}

interface WaterFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function WaterForm({ onSuccess, onCancel }: WaterFormProps) {
  // Note: patientId is available for future API integration
  // const { context } = useAuthStore();
  // const patientId = context.patientId;
  const { toast } = useToast();

  const [totalToday, setTotalToday] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [todayLogs, setTodayLogs] = useState<WaterLog[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load data on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedData = JSON.parse(localStorage.getItem(`water_${today}`) || '{"total": 0, "logs": [], "goal": 2000}');
    setTotalToday(savedData.total || 0);
    setTodayLogs(savedData.logs || []);
    setDailyGoal(savedData.goal || 2000);
  }, []);

  const saveData = (total: number, logs: WaterLog[], goal: number) => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`water_${today}`, JSON.stringify({
      total,
      logs,
      goal,
    }));
  };

  const addWater = async (amount: number) => {
    if (amount < 1) return;

    setIsSaving(true);

    try {
      const now = new Date();
      const log: WaterLog = {
        id: Date.now().toString(),
        amount,
        time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString(),
      };

      const newTotal = totalToday + amount;
      const newLogs = [log, ...todayLogs];

      setTotalToday(newTotal);
      setTodayLogs(newLogs);
      saveData(newTotal, newLogs, dailyGoal);

      toast({ description: `เพิ่ม ${amount} ml เรียบร้อยแล้ว` });
    } catch (error) {
      console.error('Error adding water:', error);
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
    addWater(amount);
    setCustomAmount('');
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

  return (
    <div className="space-y-6 pb-4">
      {/* Progress Section */}
      <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            วันนี้
          </span>
          <span className="text-muted-foreground">เป้าหมาย: {dailyGoal} ml</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {/* Water Summary Card */}
      <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 text-white text-center overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-white/5 rounded-full" />

        <div className="relative z-10 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Droplet className="w-6 h-6" />
          </div>
          <div className="text-5xl font-bold font-mono">{totalToday}</div>
          <div className="text-white/90">มิลลิลิตร ({glassCount} แก้ว)</div>
          <div className="flex items-center justify-center gap-1.5 text-sm text-white/80">
            <Target className="w-4 h-4" />
            <span>{remaining} ml เพื่อบรรลุเป้าหมาย</span>
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
              onClick={() => addWater(opt.amount)}
              disabled={isSaving}
              className={cn(
                'bg-muted/50 border-2 border-transparent rounded-xl p-3 text-center transition-all',
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
            className="flex-1"
          />
          <Button
            variant="default"
            onClick={addCustomWater}
            disabled={isSaving || !customAmount}
            className="gap-1.5"
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
                className="flex items-center justify-between bg-muted/50 rounded-xl p-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {log.time}
                  </div>
                  <p className="text-base font-semibold text-blue-600">+{log.amount} ml</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => deleteLog(log.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
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
