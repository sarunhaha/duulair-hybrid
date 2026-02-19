import {
  ArrowLeft,
  Activity,
  Droplet,
  Pill,
  Moon,
  Dumbbell,
  Smile,
  Stethoscope,
  PlusCircle,
  FlaskConical,
  Info,
  Loader2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { useHealthPreferences, useUpdateHealthPreferences, type HealthCategoryPreferences } from '@/lib/api/hooks/use-preferences';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type PrefKey = keyof Pick<
  HealthCategoryPreferences,
  | 'vitals_enabled'
  | 'glucose_enabled'
  | 'medications_enabled'
  | 'sleep_enabled'
  | 'water_enabled'
  | 'exercise_enabled'
  | 'mood_enabled'
  | 'symptoms_enabled'
  | 'notes_enabled'
  | 'lab_results_enabled'
>;

interface ToggleItem {
  key: PrefKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const toggleItems: ToggleItem[] = [
  { key: 'vitals_enabled', label: 'ความดัน/ชีพจร', icon: Activity, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' },
  { key: 'glucose_enabled', label: 'ระดับน้ำตาล', icon: Droplet, color: 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400' },
  { key: 'medications_enabled', label: 'ยา', icon: Pill, color: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' },
  { key: 'sleep_enabled', label: 'การนอน', icon: Moon, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400' },
  { key: 'water_enabled', label: 'การดื่มน้ำ', icon: Droplet, color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400' },
  { key: 'exercise_enabled', label: 'กิจกรรม/ออกกำลัง', icon: Dumbbell, color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400' },
  { key: 'mood_enabled', label: 'ความเครียด', icon: Smile, color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-400' },
  { key: 'symptoms_enabled', label: 'อาการ', icon: Stethoscope, color: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' },
  { key: 'notes_enabled', label: 'โน้ต/รูปเอกสาร', icon: PlusCircle, color: 'bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400' },
  { key: 'lab_results_enabled', label: 'ผลตรวจเลือด', icon: FlaskConical, color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400' },
];

// Keys that have matching reminder types
const REMINDER_KEYS: PrefKey[] = ['medications_enabled', 'water_enabled', 'vitals_enabled', 'exercise_enabled', 'glucose_enabled'];

export default function DataRecordingPage() {
  const [, setLocation] = useLocation();
  const { patientId } = useEnsurePatient();
  const { data: prefs, isLoading } = useHealthPreferences(patientId);
  const updatePrefs = useUpdateHealthPreferences();
  const { toast } = useToast();

  const handleToggle = (key: PrefKey, checked: boolean) => {
    if (!patientId) return;

    const updatedData = { [key]: checked };

    updatePrefs.mutate(
      { patientId, data: updatedData },
      {
        onError: () => {
          toast({ description: 'ไม่สามารถบันทึกได้ กรุณาลองใหม่', variant: 'destructive' });
        },
      }
    );

    // Show reminder auto-pause notice when toggling OFF a category with reminders
    if (!checked && REMINDER_KEYS.includes(key)) {
      const item = toggleItems.find(t => t.key === key);
      toast({
        description: `ปิดหมวด${item?.label}แล้ว — การเตือนที่เกี่ยวข้องจะถูกหยุดชั่วคราว`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10 shrink-0"
          onClick={() => setLocation('/settings')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">การบันทึกข้อมูล</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Section header */}
        <div className="space-y-2 pl-1">
          <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-widest">
            จัดการหมวดหมู่บันทึก
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            เลือกหมวดที่ต้องการแสดงในแอป เปิด/ปิดได้ตลอดเวลา
          </p>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Toggle list */}
            <div className="bg-card rounded-3xl shadow-sm overflow-hidden divide-y divide-border/30">
              {toggleItems.map((item) => {
                const enabled = prefs ? prefs[item.key] !== false : true;

                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-4 p-4"
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity',
                        item.color,
                        !enabled && 'opacity-40'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span
                      className={cn(
                        'flex-1 text-sm font-bold transition-colors',
                        enabled ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {item.label}
                    </span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleToggle(item.key, checked)}
                      disabled={updatePrefs.isPending}
                    />
                  </div>
                );
              })}
            </div>

            {/* Warning note */}
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                การปิดหมวดจะซ่อนจากหน้าบันทึก แนวโน้ม และสรุปวันนี้ แต่ข้อมูลเดิมยังอยู่ครบ
                และรายงานสุขภาพยังแสดงข้อมูลทุกหมวดเพื่อส่งแพทย์
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
