import { useState } from 'react';
import {
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Moon,
  Sun,
  Droplets,
  Loader2,
  Users,
  User,
  ChevronDown,
  Heart,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useGroupDashboard, type PatientInfo } from '@/lib/api/hooks/use-dashboard';

// Map icon string to component
const iconMap: Record<string, React.ReactNode> = {
  moon: <Moon className="w-6 h-6" />,
  sun: <Sun className="w-6 h-6" />,
  droplets: <Droplets className="w-6 h-6" />,
};

export default function GroupDashboardPage() {
  const { context } = useAuthStore();
  const { data, isLoading, error } = useGroupDashboard(context.groupId);
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null);

  // Set initial selected patient
  const activePatient = selectedPatient || data?.activePatient || null;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen pb-32 font-sans relative z-10 bg-background">
        <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex justify-between items-center border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">สุขภาพวันนี้</h1>
        </header>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="min-h-screen pb-32 font-sans relative z-10 bg-background">
        <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex justify-between items-center border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">สุขภาพวันนี้</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <p className="text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const summary = data?.summary;
  const vitals = summary?.latestVitals;
  const tasks = summary?.todayTasks;
  const insight = summary?.aiInsight;
  const streak = summary?.streak ?? 0;
  const remainingTasks = tasks ? tasks.total - tasks.completed : 0;
  const patients = data?.patients || [];
  const groupName = data?.group?.group_name || 'กลุ่ม';

  const patientDisplayName = activePatient
    ? activePatient.nickname || `${activePatient.first_name} ${activePatient.last_name}`
    : 'ไม่มีสมาชิก';

  return (
    <div className="min-h-screen pb-32 font-sans relative z-10 bg-background">
      {/* Top Bar */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 border-b border-border">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{groupName}</h1>
              <p className="text-xs text-muted-foreground">สุขภาพวันนี้</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Patient Selector Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-none shadow-lg overflow-hidden relative">
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm font-medium">กำลังดูแล</p>
                  <h2 className="text-xl font-bold">{patientDisplayName}</h2>
                  {activePatient?.chronic_diseases && activePatient.chronic_diseases.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Heart className="w-3.5 h-3.5 text-white/70" />
                      <p className="text-xs text-white/70">
                        {activePatient.chronic_diseases.slice(0, 2).join(', ')}
                        {activePatient.chronic_diseases.length > 2 && '...'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Dropdown */}
              {patients.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20 gap-1"
                    >
                      เปลี่ยน
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {patients.map((patient) => (
                      <DropdownMenuItem
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={cn(
                          activePatient?.id === patient.id && 'bg-accent/10'
                        )}
                      >
                        {patient.nickname || `${patient.first_name} ${patient.last_name}`}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Insight */}
        {insight && (
          <Card className="bg-card border-none shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="bg-accent/10 p-5 rounded-2xl flex items-start gap-4 border border-accent/20">
                <div className="bg-accent text-white p-2.5 rounded-xl shrink-0 shadow-sm">
                  {iconMap[insight.icon] || <Moon className="w-6 h-6" />}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-lg text-accent">{insight.title}</h4>
                  <p className="text-base text-foreground/80 leading-relaxed">
                    {insight.message}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Streak Card */}
        <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center shadow-sm text-orange-500 border border-orange-100 dark:border-orange-900/30 shrink-0">
                <Flame className="w-8 h-8 fill-orange-500" />
              </div>
              <span className="text-base font-bold text-foreground/80">
                จำนวนวันต่อเนื่อง<br />ที่บันทึกสุขภาพ
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
                {vitals?.bp_systolic && vitals?.bp_diastolic
                  ? `${vitals.bp_systolic}/${vitals.bp_diastolic}`
                  : '--/--'}
              </p>
              {vitals?.bp_change !== null && vitals?.bp_change !== undefined && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                    vitals.bp_change <= 0
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                  )}
                >
                  {vitals.bp_change <= 0 ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3" />
                  )}
                  {vitals.bp_change > 0 ? '+' : ''}{vitals.bp_change}
                </div>
              )}
            </div>

            {/* Sleep */}
            <div className="space-y-1 text-center px-1">
              <p className="text-[10px] text-muted-foreground font-medium">การนอน</p>
              <p className="text-lg font-bold text-foreground">
                {vitals?.sleep_hours ? `${vitals.sleep_hours} ชม.` : '-- ชม.'}
              </p>
              {vitals?.sleep_change !== null && vitals?.sleep_change !== undefined && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                    vitals.sleep_change >= 0
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                  )}
                >
                  {vitals.sleep_change < 0 ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3" />
                  )}
                  {vitals.sleep_change > 0 ? '+' : ''}{vitals.sleep_change}
                </div>
              )}
            </div>

            {/* Weight */}
            <div className="space-y-1 text-center px-1">
              <p className="text-[10px] text-muted-foreground font-medium">น้ำหนัก</p>
              <p className="text-lg font-bold text-foreground">
                {vitals?.weight ? `${vitals.weight} กก.` : '-- กก.'}
              </p>
              {vitals?.weight_change !== null && vitals?.weight_change !== undefined && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 text-[10px] font-bold w-fit mx-auto px-1.5 py-0.5 rounded-md',
                    vitals.weight_change <= 0
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'text-red-500 bg-red-50 dark:bg-red-950/30'
                  )}
                >
                  {vitals.weight_change <= 0 ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3" />
                  )}
                  {vitals.weight_change > 0 ? '+' : ''}{vitals.weight_change}
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
            {tasks?.items.map((task) => (
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
      </main>

      <BottomNav />
    </div>
  );
}
