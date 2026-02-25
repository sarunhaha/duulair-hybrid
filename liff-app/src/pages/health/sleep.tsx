import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Moon,
  Sun,
  Clock,
  Loader2,
  Save,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLogSleep } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

const QUALITY_OPTIONS = [
  { value: 'poor', label: 'แย่', score: 1, icon: '😴', color: 'bg-red-100 text-red-600 border-red-300' },
  { value: 'fair', label: 'พอใช้', score: 2, icon: '😐', color: 'bg-yellow-100 text-yellow-600 border-yellow-300' },
  { value: 'good', label: 'ดี', score: 3, icon: '😊', color: 'bg-green-100 text-green-600 border-green-300' },
  { value: 'excellent', label: 'ดีมาก', score: 4, icon: '😄', color: 'bg-emerald-100 text-emerald-600 border-emerald-300' },
];

const HOURS_OPTIONS = [
  { value: 4, label: '4 ชม.' },
  { value: 5, label: '5 ชม.' },
  { value: 6, label: '6 ชม.' },
  { value: 7, label: '7 ชม.' },
  { value: 8, label: '8 ชม.' },
  { value: 9, label: '9 ชม.' },
  { value: 10, label: '10+ ชม.' },
];

interface SleepForm {
  sleep_hours: number | null;
  sleep_quality: string;
  sleep_quality_score: number | null;
  sleep_time: string;
  wake_time: string;
  notes: string;
}

const defaultFormData: SleepForm = {
  sleep_hours: null,
  sleep_quality: '',
  sleep_quality_score: null,
  sleep_time: '22:00',
  wake_time: '06:00',
  notes: '',
};

export default function SleepLogPage() {
  const [, navigate] = useLocation();
  const { isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logSleep = useLogSleep();

  const [formData, setFormData] = useState<SleepForm>(defaultFormData);

  // Calculate sleep hours from times
  const calculateHours = (sleepTime: string, wakeTime: string): number => {
    const [sleepH, sleepM] = sleepTime.split(':').map(Number);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);

    let sleepMinutes = sleepH * 60 + sleepM;
    let wakeMinutes = wakeH * 60 + wakeM;

    // If wake time is earlier than sleep time, assume next day
    if (wakeMinutes < sleepMinutes) {
      wakeMinutes += 24 * 60;
    }

    return Math.round((wakeMinutes - sleepMinutes) / 60 * 10) / 10;
  };

  const handleTimeChange = (field: 'sleep_time' | 'wake_time', value: string) => {
    const newFormData = { ...formData, [field]: value };
    // Auto-calculate hours
    if (newFormData.sleep_time && newFormData.wake_time) {
      newFormData.sleep_hours = calculateHours(newFormData.sleep_time, newFormData.wake_time);
    }
    setFormData(newFormData);
  };

  const handleQualitySelect = (quality: typeof QUALITY_OPTIONS[0]) => {
    setFormData(prev => ({
      ...prev,
      sleep_quality: quality.value,
      sleep_quality_score: quality.score,
    }));
  };

  const handleHoursSelect = (hours: number) => {
    setFormData(prev => ({ ...prev, sleep_hours: hours }));
  };

  const handleSubmit = async () => {
    if (!formData.sleep_hours && !formData.sleep_time) {
      toast({ title: 'กรุณาระบุจำนวนชั่วโมงนอน', variant: 'destructive' });
      return;
    }

    try {
      // Ensure patient profile exists (auto-create if needed)
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ title: 'เกิดข้อผิดพลาด กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      await logSleep.mutateAsync({
        patientId: resolvedPatientId,
        sleep_hours: formData.sleep_hours || undefined,
        sleep_quality: formData.sleep_quality || undefined,
        sleep_quality_score: formData.sleep_quality_score || undefined,
        sleep_time: formData.sleep_time || undefined,
        wake_time: formData.wake_time || undefined,
        notes: formData.notes || undefined,
      });

      toast({ title: 'บันทึกการนอนเรียบร้อยแล้ว' });
      navigate('/settings');
    } catch (error) {
      console.error('Error logging sleep:', error);
      toast({ title: 'ไม่สามารถบันทึกได้', variant: 'destructive' });
    }
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen pb-8 font-sans bg-background">
        <header className="bg-card pt-4 pb-1 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">บันทึกการนอน</h1>
        </header>
        <main className="max-w-md mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8 font-sans bg-background">
      {/* Header */}
      <header className="bg-card pt-4 pb-1 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">บันทึกการนอน</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Summary Card */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex items-center gap-4">
              <Moon className="w-12 h-12" />
              <div>
                <p className="text-sm text-white/80">บันทึกการนอนหลับ</p>
                <p className="text-2xl font-bold">
                  {formData.sleep_hours ? `${formData.sleep_hours} ชั่วโมง` : 'เลือกข้อมูล'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sleep Time */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <Label className="text-base font-bold">เวลานอน - เวลาตื่น</Label>
            </div>

            <div className="space-y-4">
              {/* เข้านอน */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>เข้านอน</span>
                </Label>
                <Input
                  type="time"
                  value={formData.sleep_time}
                  onChange={(e) => handleTimeChange('sleep_time', e.target.value)}
                  className="text-xl h-12 font-medium"
                />
              </div>

              {/* ตื่นนอน */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>ตื่นนอน</span>
                </Label>
                <Input
                  type="time"
                  value={formData.wake_time}
                  onChange={(e) => handleTimeChange('wake_time', e.target.value)}
                  className="text-xl h-12 font-medium"
                />
              </div>
            </div>

            {formData.sleep_time && formData.wake_time && (
              <div className="text-center p-4 bg-primary/10 rounded-xl">
                <p className="text-sm text-muted-foreground">รวมเวลานอน</p>
                <p className="text-3xl font-bold text-primary">
                  {calculateHours(formData.sleep_time, formData.wake_time)} ชั่วโมง
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Or Select Hours */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-3">
            <Label className="text-base font-bold">หรือเลือกจำนวนชั่วโมง</Label>
            <div className="flex flex-wrap gap-2">
              {HOURS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={formData.sleep_hours === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleHoursSelect(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sleep Quality */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              <Label className="text-base font-bold">คุณภาพการนอน</Label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleQualitySelect(opt)}
                  className={cn(
                    'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1',
                    formData.sleep_quality === opt.value
                      ? opt.color + ' border-current'
                      : 'bg-muted/50 border-transparent hover:bg-muted'
                  )}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-2">
            <Label className="text-base font-bold">หมายเหตุ (ถ้ามี)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="เช่น ตื่นกลางดึก 2 ครั้ง, ฝันร้าย"
              rows={2}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={handleSubmit}
          disabled={logSleep.isPending}
        >
          {logSleep.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          บันทึกการนอน
        </Button>
      </main>
    </div>
  );
}
