import { TrendingUp, ArrowDownRight, ArrowUpRight, Flame, Moon, Sun, Droplets, Loader2, PlusCircle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useLiff } from '@/lib/liff/provider';
import { useAuthStore } from '@/stores/auth';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useDashboardSummary } from '@/lib/api/hooks/use-dashboard';
import { useLocation } from 'wouter';

// Map icon string to component
const iconMap: Record<string, React.ReactNode> = {
  moon: <Moon className="w-6 h-6" />,
  sun: <Sun className="w-6 h-6" />,
  droplets: <Droplets className="w-6 h-6" />,
};

// Default insight when no data
const DEFAULT_INSIGHT = {
  icon: 'sun',
  title: 'เริ่มต้นวันใหม่',
  message: 'มาบันทึกสุขภาพกันเถอะ! เริ่มต้นวันนี้ด้วยการบันทึกความดัน หรือกินยา',
};

export default function DashboardPage() {
  const { profile } = useLiff();
  const { context } = useAuthStore();
  const [, setLocation] = useLocation();
  const displayName = profile?.displayName || 'คุณ';

  // Fetch dashboard data
  const { data: summary, isLoading } = useDashboardSummary(context.patientId);

  // Use real data with proper empty states
  const vitals = summary?.latestVitals;
  const tasks = summary?.todayTasks;
  const insight = summary?.aiInsight || DEFAULT_INSIGHT;
  const streak = summary?.streak ?? 0;

  // Check if we have any vitals data
  const hasVitalsData = vitals && (vitals.bp_systolic !== null || vitals.sleep_hours !== null || vitals.weight !== null);

  // Check if we have tasks
  const hasTasks = tasks && tasks.items && tasks.items.length > 0;
  const remainingTasks = hasTasks ? tasks.total - tasks.completed : 0;

  const goToRecords = () => setLocation('/records');

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
                {iconMap[insight.icon] || <Sun className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-accent">{insight.title}</h4>
                <p className="text-base text-foreground/80 leading-relaxed">{insight.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className={cn(
          "shadow-sm",
          streak > 0
            ? "bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30"
            : "bg-muted/30 border-border"
        )}>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl bg-card flex items-center justify-center shadow-sm shrink-0 border",
                streak > 0
                  ? "text-orange-500 border-orange-100 dark:border-orange-900/30"
                  : "text-muted-foreground border-border"
              )}>
                <Flame className={cn("w-8 h-8", streak > 0 && "fill-orange-500")} />
              </div>
              <span className={cn(
                "text-base font-bold",
                streak > 0 ? "text-foreground/80" : "text-muted-foreground"
              )}>
                จำนวนวันต่อเนื่อง<br />ที่คุณบันทึกสุขภาพ
              </span>
            </div>
            <div className="flex flex-col items-end justify-center pl-4">
              <span className={cn(
                "text-4xl font-black leading-none",
                streak > 0 ? "text-orange-600" : "text-muted-foreground"
              )}>
                {streak}
              </span>
              <span className={cn(
                "text-xs font-bold mt-1",
                streak > 0 ? "text-orange-600/80" : "text-muted-foreground"
              )}>
                วัน
              </span>
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
          <CardContent className="p-5 pt-2">
            {hasVitalsData ? (
              <div className="grid grid-cols-3 gap-4 divide-x divide-border">
                {/* Blood Pressure */}
                <div className="space-y-1 text-center px-1">
                  <p className="text-[10px] text-muted-foreground font-medium">ความดัน</p>
                  {vitals.bp_systolic !== null ? (
                    <>
                      <p className="text-lg font-bold text-foreground">
                        {vitals.bp_systolic}/{vitals.bp_diastolic}
                      </p>
                      {vitals.bp_change !== null && (
                        <div
                          className={cn(
                            'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                            vitals.bp_change <= 0
                              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                          )}
                        >
                          {vitals.bp_change <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {vitals.bp_change > 0 ? '+' : ''}{vitals.bp_change}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">-</p>
                  )}
                </div>

                {/* Sleep */}
                <div className="space-y-1 text-center px-1">
                  <p className="text-[10px] text-muted-foreground font-medium">การนอน</p>
                  {vitals.sleep_hours !== null ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{vitals.sleep_hours} ชม.</p>
                      {vitals.sleep_change !== null && (
                        <div
                          className={cn(
                            'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                            vitals.sleep_change >= 0
                              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                          )}
                        >
                          {vitals.sleep_change < 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {vitals.sleep_change > 0 ? '+' : ''}{vitals.sleep_change}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">-</p>
                  )}
                </div>

                {/* Weight */}
                <div className="space-y-1 text-center px-1">
                  <p className="text-[10px] text-muted-foreground font-medium">น้ำหนัก</p>
                  {vitals.weight !== null ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{vitals.weight} กก.</p>
                      {vitals.weight_change !== null && (
                        <div
                          className={cn(
                            'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                            vitals.weight_change <= 0
                              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                          )}
                        >
                          {vitals.weight_change <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {vitals.weight_change > 0 ? '+' : ''}{vitals.weight_change}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">-</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">ยังไม่มีข้อมูล</p>
                  <p className="text-xs text-muted-foreground/70">เริ่มบันทึกความดัน น้ำหนัก หรือการนอน</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToRecords}
                  className="rounded-full"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  บันทึกเลย
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today Tasks (Checklist Style) */}
        <Card className="border-none shadow-sm bg-card overflow-hidden">
          <CardHeader className="p-5 pb-0 flex flex-row justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">ภารกิจสุขภาพวันนี้</h3>
              {hasTasks && (
                <p className="text-xs font-bold text-accent uppercase tracking-wider">
                  {remainingTasks > 0 ? `เหลือ ${remainingTasks} อย่าง` : 'เสร็จหมดแล้ว!'}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {hasTasks ? (
              <div className="space-y-4">
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
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">ยังไม่มีภารกิจ</p>
                  <p className="text-xs text-muted-foreground/70">บันทึกสุขภาพเพื่อเริ่มสร้างภารกิจประจำวัน</p>
                </div>
                <Button
                  onClick={goToRecords}
                  className="rounded-full bg-primary text-primary-foreground"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  เริ่มบันทึกสุขภาพ
                </Button>
              </div>
            )}
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
