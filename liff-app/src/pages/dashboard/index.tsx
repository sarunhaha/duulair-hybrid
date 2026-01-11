import { TrendingUp, ArrowDownRight, ArrowUpRight, Flame, Moon, Sun, Droplets, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useLiff } from '@/lib/liff/provider';
import { useAuthStore } from '@/stores/auth';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useDashboardSummary } from '@/lib/api/hooks/use-dashboard';

// Map icon string to component
const iconMap: Record<string, React.ReactNode> = {
  moon: <Moon className="w-6 h-6" />,
  sun: <Sun className="w-6 h-6" />,
  droplets: <Droplets className="w-6 h-6" />,
};

// Mock data for fallback
const MOCK_INSIGHT = {
  icon: 'moon',
  title: 'อุ่นใจแนะนำ',
  message: 'เมื่อคืนคุณนอนน้อย ลองพักสายตา 10 นาทีช่วงบ่ายนะคะ',
};

const MOCK_VITALS = {
  bp_systolic: 122,
  bp_diastolic: 80,
  bp_change: -5,
  sleep_hours: 6.5,
  sleep_change: -1.2,
  weight: 64.2,
  weight_change: -0.3,
};

const MOCK_TASKS = {
  total: 4,
  completed: 2,
  items: [
    { id: 1, label: 'กินยาเช้า', done: true, time: '08:00' },
    { id: 2, label: 'วัดความดัน', done: true, time: '08:30' },
    { id: 3, label: 'ดื่มน้ำ 6 แก้ว', done: false, sub: 'เหลือ 3 แก้ว' },
    { id: 4, label: 'เดิน 15 นาที', done: false, sub: 'เย็นนี้' },
  ],
};

export default function DashboardPage() {
  const { profile } = useLiff();
  const { context } = useAuthStore();
  const displayName = profile?.displayName || 'คุณ';

  // Fetch dashboard data
  const { data: summary, isLoading } = useDashboardSummary(context.patientId);

  // Use mock data as fallback
  const vitals = summary?.latestVitals || MOCK_VITALS;
  const tasks = summary?.todayTasks || MOCK_TASKS;
  const insight = summary?.aiInsight || MOCK_INSIGHT;
  const streak = summary?.streak ?? 5;
  const remainingTasks = tasks.total - tasks.completed;

  return (
    <div className="min-h-screen pb-32 font-sans relative z-10 bg-background">
      {/* Top Bar */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex justify-between items-center border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">สุขภาพวันนี้</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Hero Section: Greeting & Insight */}
        <Card className="bg-card border-none shadow-sm overflow-hidden relative group">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all duration-700" />
          <CardContent className="p-6 relative z-10 space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">สวัสดี, {displayName}</h2>
              <p className="text-lg text-muted-foreground font-medium">เรามาดูภาพรวมสุขภาพประจำวันนี้กัน</p>
            </div>

            {/* OONJAI Recommendation */}
            <div className="bg-accent/10 p-5 rounded-2xl flex items-start gap-4 border border-accent/20">
              <div className="bg-accent text-white p-2.5 rounded-xl shrink-0 shadow-sm">
                {iconMap[insight.icon] || <Moon className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-accent">{insight.title}</h4>
                <p className="text-base text-foreground/80 leading-relaxed">{insight.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center shadow-sm text-orange-500 border border-orange-100 dark:border-orange-900/30 shrink-0">
                <Flame className="w-8 h-8 fill-orange-500" />
              </div>
              <span className="text-base font-bold text-foreground/80">
                จำนวนวันต่อเนื่อง<br />ที่คุณบันทึกสุขภาพ
              </span>
            </div>
            <div className="flex flex-col items-end justify-center pl-4">
              <span className="text-4xl font-black text-orange-600 leading-none">{streak}</span>
              <span className="text-xs font-bold text-orange-600/80 mt-1">วัน</span>
            </div>
          </CardContent>
        </Card>

        {/* Highlights: Compare to Previous Record */}
        <Card className="border-none shadow-sm bg-card overflow-hidden">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="w-4 h-4" /> เทียบกับก่อนหน้า
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2 grid grid-cols-3 gap-4 divide-x divide-border">
            {/* Blood Pressure */}
            <div className="space-y-1 text-center px-1">
              <p className="text-[10px] text-muted-foreground font-medium">ความดัน</p>
              <p className="text-lg font-bold text-foreground">
                {vitals.bp_systolic}/{vitals.bp_diastolic}
              </p>
              {vitals.bp_change !== null && vitals.bp_change !== undefined && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                    vitals.bp_change <= 0
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                  )}
                >
                  {vitals.bp_change <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  {vitals.bp_change > 0 ? '+' : ''}
                  {vitals.bp_change}
                </div>
              )}
            </div>

            {/* Sleep */}
            <div className="space-y-1 text-center px-1">
              <p className="text-[10px] text-muted-foreground font-medium">การนอน</p>
              <p className="text-lg font-bold text-foreground">{vitals.sleep_hours} ชม.</p>
              {vitals.sleep_change !== null && vitals.sleep_change !== undefined && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                    vitals.sleep_change >= 0
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                  )}
                >
                  {vitals.sleep_change < 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  {vitals.sleep_change > 0 ? '+' : ''}
                  {vitals.sleep_change}
                </div>
              )}
            </div>

            {/* Weight */}
            <div className="space-y-1 text-center px-1">
              <p className="text-[10px] text-muted-foreground font-medium">น้ำหนัก</p>
              <p className="text-lg font-bold text-foreground">{vitals.weight} กก.</p>
              {vitals.weight_change !== null && vitals.weight_change !== undefined && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                    vitals.weight_change <= 0
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                  )}
                >
                  {vitals.weight_change <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  {vitals.weight_change > 0 ? '+' : ''}
                  {vitals.weight_change}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today Tasks (Checklist Style) */}
        <Card className="border-none shadow-sm bg-card overflow-hidden">
          <CardHeader className="p-5 pb-0 flex flex-row justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">ภารกิจสุขภาพวันนี้</h3>
              <p className="text-xs font-bold text-accent uppercase tracking-wider">
                {remainingTasks > 0 ? `เหลือ ${remainingTasks} อย่าง` : 'เสร็จหมดแล้ว!'}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 space-y-4">
            {tasks.items.map((task) => (
              <div key={task.id} className="flex items-start gap-3">
                <Checkbox
                  id={`task-${task.id}`}
                  checked={task.done}
                  className="mt-1 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={`task-${task.id}`}
                    className={cn(
                      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                      task.done ? 'text-muted-foreground line-through' : 'text-foreground'
                    )}
                  >
                    {task.label}
                  </label>
                  {task.time && <p className="text-[11px] text-muted-foreground">เวลา {task.time}</p>}
                  {task.sub && <p className="text-[11px] text-accent font-medium">{task.sub}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Loading indicator overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50 pointer-events-none">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
