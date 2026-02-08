import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Calendar,
  Heart,
  Pill,
  Activity,
  FileDown,
  ClipboardList,
  History,
  User,
  AlertCircle,
  Star,
  CheckCircle2,
  Eye,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Trash2,
  Plus,
  FileText,
  Loader2,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { subDays, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth';
import { usePatientProfile, usePatientMedicationsAll } from '@/lib/api/hooks/use-profile';
import {
  useReportData,
  exportToPDF,
  type DateRange,
} from '@/lib/api/hooks/use-reports';
import {
  useDoctorQuestions,
  useAddDoctorQuestion,
  useDeleteDoctorQuestion,
} from '@/lib/api/hooks/use-health';
import { BottomNav } from '@/components/layout/bottom-nav';

// Calculate dates for today reference
const today = new Date();

const REPORT_HISTORY = [
  {
    id: 'RPT-001',
    title: 'รายงานส่งหมอ (1 หน้า)',
    range: '1 - 31 ม.ค. 2026',
    createdAt: '1 ก.พ. 2026 • 09:12 น.',
    status: 'พร้อมดาวน์โหลด',
    expiresIn: 'เหลือ 12 วัน',
  },
  {
    id: 'RPT-002',
    title: 'รายงานละเอียด 90 วัน',
    range: '1 พ.ย. 2025 - 31 ม.ค. 2026',
    createdAt: '31 ม.ค. 2026 • 20:05 น.',
    status: 'พร้อมดาวน์โหลด',
    expiresIn: 'เหลือ 3 วัน',
  },
  {
    id: 'RPT-000',
    title: 'รายงานเก่า (เกินกำหนด)',
    range: '1 - 15 ต.ค. 2025',
    createdAt: '16 ต.ค. 2025 • 08:30 น.',
    status: 'หมดอายุแล้ว',
    expiresIn: 'เก็บไว้ครบ 15 วัน',
  },
];

type RangeKey = '30d' | '60d' | '90d' | '180d' | 'custom';

// Map RangeKey to DateRange for API
const mapRangeToDateRange = (range: RangeKey): DateRange => {
  switch (range) {
    case '30d': return '30d';
    case '60d': return '90d'; // Use 90d for 60d as closest match
    case '90d': return '90d';
    case '180d': return '90d'; // API max is 90d
    case 'custom': return '30d';
    default: return '30d';
  }
};

export default function ReportsPage() {
  const [, navigate] = useLocation();
  const { user, context } = useAuthStore();
  const patientId = context.patientId || (user.role === 'patient' ? user.profileId : null);

  const [range, setRange] = useState<RangeKey>('30d');
  const [showA4Preview, setShowA4Preview] = useState(false);
  const [onlySignificant, setOnlySignificant] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: profile } = usePatientProfile(patientId);
  const { data: medications } = usePatientMedicationsAll(patientId);
  const { data: reportData, isLoading: isReportLoading } = useReportData(patientId, mapRangeToDateRange(range));
  const { data: doctorQuestions, isLoading: isQuestionsLoading } = useDoctorQuestions(patientId);
  const addQuestionMutation = useAddDoctorQuestion();
  const deleteQuestionMutation = useDeleteDoctorQuestion();

  // Get allergies from profile
  const drugAllergies = profile?.drug_allergies || [];
  const foodAllergies = profile?.food_allergies || [];
  const hasAllergies = drugAllergies.length > 0 || foodAllergies.length > 0;

  // Get active medications
  const activeMedications = medications?.filter(m => m.active) || [];

  const patientName = profile ? `${profile.first_name} ${profile.last_name}` : 'ผู้ใช้งาน';
  const patientAge = profile?.birth_date
    ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const patientGender = profile?.gender === 'male' ? 'ชาย' : profile?.gender === 'female' ? 'หญิง' : null;

  // Dynamic Date Range Text
  const { daysToSubtract, dateRangeText } = useMemo(() => {
    let days = 30;
    if (range === '30d') days = 30;
    else if (range === '60d') days = 60;
    else if (range === '90d') days = 90;
    else if (range === '180d') days = 180;

    const startDate = subDays(today, days);
    return {
      daysToSubtract: days,
      dateRangeText: `${format(startDate, 'd MMM', { locale: th })} - ${format(today, 'd MMM yyyy', { locale: th })}`,
    };
  }, [range]);

  // Get summary data from API or fallback
  const summary = reportData?.summary;
  const chartData = reportData?.chartData || [];
  const significantEvents = reportData?.significantEvents || [];

  // Questions State (now uses database)
  const questions = doctorQuestions?.filter(q => !q.answered) || [];
  const [newQuestion, setNewQuestion] = useState('');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  const addQuestion = async () => {
    if (newQuestion.trim() && patientId) {
      await addQuestionMutation.mutateAsync({
        patientId,
        question: newQuestion.trim(),
      });
      setNewQuestion('');
      setIsAddingQuestion(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (patientId) {
      await deleteQuestionMutation.mutateAsync({
        id: questionId,
        patientId,
      });
    }
  };

  // Filter chart data based on range
  const chartDataSliced = useMemo(() => {
    if (!chartData.length) return [];
    // Take the last N days from chartData
    return chartData.slice(-daysToSubtract);
  }, [chartData, daysToSubtract]);

  // Filter significant events based on "only significant" toggle
  const activeEvents = useMemo(() => {
    if (!significantEvents.length) return [];
    // If onlySignificant is on, show all (already filtered by backend)
    // Otherwise, show all events
    return significantEvents;
  }, [significantEvents, onlySignificant]);

  // Calculate BP average for display
  const bpAvgDisplay = useMemo(() => {
    if (!summary?.bp) return 'ไม่มีข้อมูล';
    return `${summary.bp.avgSystolic}/${summary.bp.avgDiastolic} mmHg`;
  }, [summary]);

  // Calculate meds adherence for display
  const medsAdherenceDisplay = useMemo(() => {
    if (!summary?.meds) return 'ไม่มีข้อมูล';
    return `${summary.meds.adherencePercent}%`;
  }, [summary]);

  // Calculate sleep average for display
  const sleepAvgDisplay = useMemo(() => {
    if (!summary?.sleep) return 'ไม่มีข้อมูล';
    return `${summary.sleep.avgHours.toFixed(1)} ชม.`;
  }, [summary]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    // Debug: show what's blocking (TEMPORARY — remove after fix confirmed)
    if (!reportData) {
      alert('PDF: reportData is null/undefined — data not loaded yet');
      return;
    }
    if (isExporting) {
      alert('PDF: already exporting');
      return;
    }
    setIsExporting(true);
    try {
      await exportToPDF(reportData, patientName, dateRangeText, {
        patientName,
        patientAge,
        patientGender: profile?.gender,
        dateRange: dateRangeText,
        drugAllergies,
        foodAllergies,
        medications: activeMedications.map(m => ({
          name: m.name,
          dosage_amount: m.dosage_amount,
          dosage_unit: m.dosage_unit,
        })),
        doctorQuestions: questions.map(q => q.question),
      });
      alert('PDF: export completed successfully');
    } catch (error) {
      alert('PDF export error: ' + (error instanceof Error ? error.message : String(error)));
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen pb-32 font-sans relative z-10 bg-background">
      {/* Top Bar */}
      <header className="bg-card pt-12 pb-4 px-4 sticky top-0 z-20 flex justify-between items-center border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">รายงาน</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-muted/30"
          onClick={() => setShowHistory(true)}
        >
          <History className="h-5 w-5 text-foreground" />
        </Button>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-500">
        {/* Report Range Selection */}
        <div className="space-y-3">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            <div className="flex bg-muted/50 p-1 rounded-xl w-max">
              {['30 วัน', '60 วัน', '90 วัน', '180 วัน', 'กำหนดเอง'].map((label, i) => {
                const val = ['30d', '60d', '90d', '180d', 'custom'][i] as RangeKey;
                const isActive = range === val;
                return (
                  <button
                    key={val}
                    onClick={() => setRange(val)}
                    className={cn(
                      'px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                      isActive ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground pl-1">
            <Calendar className="w-3.5 h-3.5" />
            <p className="text-xs font-bold uppercase tracking-wider">{dateRangeText}</p>
          </div>
        </div>

        {/* Patient Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 px-1">
            <div className="bg-card border border-border/50 px-3 py-1.5 rounded-full text-[10px] font-bold text-foreground flex items-center gap-1.5 shadow-sm">
              <User className="w-3 h-3 text-primary" /> {patientName}
            </div>
            {patientAge && patientGender && (
              <div className="bg-card border border-border/50 px-3 py-1.5 rounded-full text-[10px] font-bold text-foreground shadow-sm">
                {patientAge} ปี / {patientGender}
              </div>
            )}
            {hasAllergies && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 px-3 py-1.5 rounded-full text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 shadow-sm">
                <AlertCircle className="w-3 h-3" /> แพ้: {[...drugAllergies, ...foodAllergies].join(', ')}
              </div>
            )}
            {activeMedications.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/30 px-3 py-1.5 rounded-full text-[10px] font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5 shadow-sm">
                <Pill className="w-3 h-3" /> ยา {activeMedications.length} รายการ
              </div>
            )}
          </div>

          {/* Medications List */}
          {activeMedications.length > 0 && (
            <div className="bg-card border border-border/50 rounded-2xl p-3 shadow-sm">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">รายการยา</p>
              <div className="space-y-1.5">
                {activeMedications.map((med) => (
                  <div key={med.id} className="flex items-center gap-2 text-xs">
                    <Pill className="w-3 h-3 text-orange-500 shrink-0" />
                    <span className="font-medium">{med.name}</span>
                    {med.dosage_amount && med.dosage_unit && (
                      <span className="text-muted-foreground">({med.dosage_amount} {med.dosage_unit})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Executive Summary */}
        <Card className="border-none shadow-md bg-card overflow-hidden ring-1 ring-primary/10">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">สรุป 10 วินาที</h3>
            </div>
            {isReportLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    summary?.bp?.status === 'high' || summary?.bp?.status === 'crisis' ? 'bg-red-500' : 'bg-primary'
                  )} />
                  <p className="text-sm leading-relaxed">
                    <span className="font-bold">ความดันเฉลี่ย:</span> {bpAvgDisplay}
                    {summary?.bp?.status === 'high' && ' (สูงกว่าปกติ)'}
                    {summary?.bp?.status === 'crisis' && ' (สูงมาก - ควรพบแพทย์)'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    summary?.meds?.status === 'poor' ? 'bg-orange-500' : summary?.meds?.status === 'fair' ? 'bg-yellow-500' : 'bg-emerald-500'
                  )} />
                  <p className="text-sm leading-relaxed">
                    <span className="font-bold">การกินยา:</span> ครบ {medsAdherenceDisplay}
                    {summary?.meds && summary.meds.totalCount > summary.meds.takenCount &&
                      ` (พลาด ${summary.meds.totalCount - summary.meds.takenCount} ครั้ง)`
                    }
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    summary?.water?.status === 'poor' ? 'bg-orange-500' : 'bg-primary'
                  )} />
                  <p className="text-sm leading-relaxed">
                    <span className="font-bold">น้ำดื่มเฉลี่ย:</span> {summary?.water?.avgMl || 0} มล./วัน
                    {summary?.water?.status === 'poor' && ' (น้อยเกินไป)'}
                  </p>
                </div>
                {summary?.sleep && (
                  <div className="flex gap-3">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                      summary.sleep.status === 'poor' ? 'bg-purple-500' : 'bg-primary'
                    )} />
                    <p className="text-sm leading-relaxed">
                      <span className="font-bold">การนอนเฉลี่ย:</span> {sleepAvgDisplay}
                      {summary.sleep.status === 'poor' && ' (น้อยกว่าที่ควร)'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Charts */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
            กราฟสรุป
          </h3>
          <Card className="border-none shadow-sm bg-card p-4 space-y-6">
            {isReportLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* BP Chart */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Heart className="w-3 h-3 text-primary" /> ความดัน & ชีพจร
                    </p>
                    <p className="text-[10px] text-muted-foreground">เฉลี่ย {bpAvgDisplay}</p>
                  </div>
                  <div className="h-[100px] w-full">
                    {chartDataSliced.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartDataSliced}>
                          <Line type="monotone" dataKey="systolic" stroke="#0E8A9A" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="diastolic" stroke="#0E8A9A" strokeOpacity={0.5} strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="pulse" stroke="#F2994A" strokeWidth={2} dot={false} />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <Tooltip contentStyle={{ fontSize: '10px' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        ไม่มีข้อมูล
                      </div>
                    )}
                  </div>
                </div>

                {/* Meds Chart */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Pill className="w-3 h-3 text-orange-500" /> การกินยา
                    </p>
                    <p className="text-[10px] text-muted-foreground">ครบ {medsAdherenceDisplay}</p>
                  </div>
                  <div className="h-[60px] w-full">
                    {chartDataSliced.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartDataSliced}>
                          <Bar dataKey="medsPercent" radius={[4, 4, 0, 0]}>
                            {chartDataSliced.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.medsPercent === 100 ? '#10b981' : (entry.medsPercent ?? 0) < 50 ? '#ef4444' : '#f97316'}
                              />
                            ))}
                          </Bar>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        ไม่มีข้อมูล
                      </div>
                    )}
                  </div>
                </div>

                {/* Sleep Chart */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Moon className="w-3 h-3 text-purple-500" /> การนอน
                    </p>
                    <p className="text-[10px] text-muted-foreground">เฉลี่ย {sleepAvgDisplay}</p>
                  </div>
                  <div className="h-[60px] w-full">
                    {chartDataSliced.some(d => d.sleepHours !== undefined) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartDataSliced}>
                          <Bar dataKey="sleepHours" radius={[4, 4, 0, 0]} fill="#8b5cf6" />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        ไม่มีข้อมูล
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Consistency Metrics */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
            ความสม่ำเสมอ
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-none shadow-sm bg-card p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                <Heart className="w-3 h-3 text-primary" /> ความดัน
              </div>
              <div className="space-y-1">
                {isReportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <>
                    <p className="text-lg font-bold">
                      {summary?.bp?.avgSystolic || '-'} / {summary?.bp?.avgDiastolic || '-'} <span className="text-[10px] text-muted-foreground font-normal ml-1">เฉลี่ย</span>
                    </p>
                    <p className={cn(
                      'text-[10px] font-medium',
                      summary?.bp?.count && summary.bp.count >= daysToSubtract * 0.8 ? 'text-emerald-600' : 'text-orange-600'
                    )}>
                      บันทึก {summary?.bp?.count || 0}/{daysToSubtract} วัน
                    </p>
                  </>
                )}
              </div>
            </Card>
            <Card className="border-none shadow-sm bg-card p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                <Activity className="w-3 h-3 text-orange-500" /> ชีพจร
              </div>
              <div className="space-y-1">
                {isReportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <>
                    <p className="text-lg font-bold">
                      {summary?.bp?.avgHeartRate || '-'} <span className="text-[10px] text-muted-foreground font-normal ml-1">เฉลี่ย</span>
                    </p>
                    <p className={cn(
                      'text-[10px] font-medium',
                      summary?.bp?.count && summary.bp.count >= daysToSubtract * 0.8 ? 'text-emerald-600' : 'text-orange-600'
                    )}>
                      บันทึก {summary?.bp?.count || 0}/{daysToSubtract} วัน
                    </p>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Significant Days */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-orange-400 fill-orange-400" /> วันที่มีนัยยะ (หมอควรดู)
            </h3>
            <button
              onClick={() => setOnlySignificant(!onlySignificant)}
              className="text-[10px] font-bold text-primary flex items-center gap-1"
            >
              {onlySignificant ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-primary" />
              )}
              คัดมาให้แล้ว
            </button>
          </div>
          <div className="bg-card rounded-3xl shadow-sm divide-y divide-border/30 overflow-hidden ring-1 ring-orange-100 dark:ring-orange-900/30">
            {isReportLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : activeEvents.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                ไม่มีเหตุการณ์สำคัญในช่วงนี้
              </div>
            ) : (
              activeEvents.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors cursor-pointer active:bg-orange-50 dark:active:bg-orange-950/20"
                >
                  <div className="flex flex-col items-center gap-1 min-w-[40px]">
                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                      {item.date.split(' ')[0]}
                    </span>
                    {item.date.split(' ')[1] && (
                      <span className="text-[9px] text-muted-foreground/70">{item.date.split(' ')[1]}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-foreground leading-tight">{item.title}</p>
                      <span
                        className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide',
                          item.type === 'health'
                            ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                            : item.type === 'meds'
                              ? 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                              : item.type === 'sleep'
                                ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400'
                                : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                        )}
                      >
                        {item.tag}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Doctor Questions */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
            คำถามถึงหมอ
          </h3>
          <div className="bg-card rounded-2xl p-4 shadow-sm border-2 border-dashed border-border relative space-y-3">
            <MessageSquare className="absolute top-4 right-4 w-4 h-4 text-muted-foreground/30" />

            {isQuestionsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : questions.length === 0 && !isAddingQuestion ? (
              <p className="text-xs text-muted-foreground text-center py-2">ยังไม่มีคำถาม</p>
            ) : (
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-2 group">
                    <span className="text-xs font-bold text-muted-foreground min-w-[16px] mt-0.5">{i + 1})</span>
                    <p className="text-xs text-foreground flex-1 leading-relaxed">{q.question}</p>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      disabled={deleteQuestionMutation.isPending}
                      className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isAddingQuestion ? (
              <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                <input
                  autoFocus
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="พิมพ์คำถาม..."
                  className="flex-1 bg-muted/30 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addQuestion();
                    if (e.key === 'Escape') setIsAddingQuestion(false);
                  }}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-primary text-primary-foreground"
                  onClick={addQuestion}
                  disabled={addQuestionMutation.isPending}
                >
                  {addQuestionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setIsAddingQuestion(true)}
                className="w-full h-8 text-xs font-bold text-accent border border-accent/20 rounded-xl mt-1 hover:bg-accent/5"
              >
                + เพิ่มคำถาม
              </Button>
            )}
          </div>
        </div>

        {/* A4 Preview & Export */}
        <div className="space-y-4 pt-2">
          {/* Collapsible Preview */}
          <div className="border border-border rounded-2xl bg-muted/20 overflow-hidden">
            <button
              onClick={() => setShowA4Preview(!showA4Preview)}
              className="w-full flex items-center justify-between p-4 bg-card/50 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Eye className="w-4 h-4 text-primary" /> พรีวิวเอกสาร A4
              </div>
              {showA4Preview ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showA4Preview && (
              <div className="p-4 flex justify-center bg-muted/50">
                <div className="w-full max-w-[300px] bg-card shadow-2xl p-4 text-[8px] leading-relaxed flex flex-col gap-2 text-foreground rounded-lg">
                  {/* Fake A4 Content */}
                  <div className="flex justify-between border-b pb-2 border-border">
                    <h1 className="text-sm font-bold">รายงานสุขภาพ: {patientName}</h1>
                  </div>
                  <div className="text-[7px] text-muted-foreground">
                    <p>ช่วงเวลา: {dateRangeText}</p>
                    <p>สร้างเมื่อ: {format(new Date(), 'd MMM yyyy', { locale: th })}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="border border-border p-2 rounded">
                      <h2 className="font-bold mb-1">สรุปสำคัญ</h2>
                      <ul className="list-disc pl-2 space-y-0.5">
                        <li>ความดัน: {bpAvgDisplay}</li>
                        <li>กินยาครบ: {medsAdherenceDisplay}</li>
                        {activeEvents.length > 0 && (
                          <li>เหตุการณ์สำคัญ: {activeEvents.length} รายการ</li>
                        )}
                      </ul>
                    </div>
                    <div className="border border-border p-2 rounded">
                      <h2 className="font-bold mb-1">สถิติรวม</h2>
                      <p>ความดันเฉลี่ย: {summary?.bp ? `${summary.bp.avgSystolic}/${summary.bp.avgDiastolic}` : '-'}</p>
                      <p>ชีพจรเฉลี่ย: {summary?.bp?.avgHeartRate || '-'} bpm</p>
                      <p>นอนเฉลี่ย: {sleepAvgDisplay}</p>
                    </div>
                  </div>
                  <div className="h-16 border border-border bg-muted/30 flex items-center justify-center text-muted-foreground rounded mt-2">
                    [กราฟสรุป]
                  </div>
                  <div className="mt-auto border-t border-border pt-1 text-center text-[6px] text-muted-foreground">
                    ข้อมูลนี้เป็นข้อมูลที่ผู้ใช้บันทึกเอง
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleExportPDF}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold shadow-xl shadow-primary/20 relative z-[60]"
            disabled={isReportLoading || !reportData || isExporting}
          >
            {isReportLoading || isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            {isExporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
          </Button>
        </div>
      </main>

      {/* Report History Drawer */}
      <Drawer open={showHistory} onOpenChange={setShowHistory}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg font-bold">ประวัติรายงานที่สร้างแล้ว</DrawerTitle>
            <DrawerDescription className="text-center text-[11px] leading-snug">
              รายงานที่สร้างจะถูกเก็บไว้ให้ดาวน์โหลดได้ภายใน{' '}
              <span className="font-semibold text-foreground">15 วัน</span> นับจากวันที่สร้าง
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-3 overflow-y-auto">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/30 rounded-2xl px-3 py-2 text-[11px] text-amber-800 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
              <p>ตัวอย่างนี้เป็นข้อมูลเดโม่ เพื่อให้เห็นหน้าตารายการรายงานที่เคยสร้าง</p>
            </div>

            <div className="bg-card rounded-2xl shadow-sm divide-y divide-border/30 overflow-hidden">
              {REPORT_HISTORY.map((report) => {
                const isExpired = report.status === 'หมดอายุแล้ว';
                return (
                  <div key={report.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                    <div className="mt-1">
                      <FileText className={cn('w-5 h-5', isExpired ? 'text-muted-foreground' : 'text-primary')} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{report.title}</p>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap',
                            isExpired ? 'bg-muted text-muted-foreground' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                          )}
                        >
                          {report.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">ช่วงข้อมูล: {report.range}</p>
                      <p className="text-[11px] text-muted-foreground/80">สร้างเมื่อ: {report.createdAt}</p>
                      <p className={cn('text-[10px] font-medium', isExpired ? 'text-muted-foreground' : 'text-orange-600 dark:text-orange-400')}>
                        {report.expiresIn}
                      </p>
                    </div>
                    <div className="mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isExpired}
                        className={cn(
                          'h-8 px-3 text-[11px] rounded-xl border',
                          isExpired
                            ? 'border-muted text-muted-foreground cursor-not-allowed opacity-50'
                            : 'border-primary/30 text-primary hover:bg-primary/5'
                        )}
                      >
                        ดาวน์โหลด
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <BottomNav />
    </div>
  );
}
