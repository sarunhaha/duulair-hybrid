import { useState, useMemo, useEffect } from 'react';
import {
  Heart,
  Moon,
  Pill,
  MessageCircleHeart,
  Info,
  AlertCircle,
  Loader2,
  Calendar,
  X,
  Dumbbell,
  Smile,
  Droplets,
  Droplet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/bottom-nav';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DateInput } from '@/components/ui/date-picker';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import {
  useVitalsTrend,
  useMedsTrend,
  useSleepTrend,
  useExerciseTrend,
  useMoodTrend,
  useWaterTrend,
  useGlucoseTrend,
  type TimeRange,
  type TrendCategory,
  type TrendDataPoint,
  type TrendData,
  type CustomDateRange,
} from '@/lib/api/hooks/use-trends';

// Mock data for fallback (with required 'date' field for TrendDataPoint)
const MOCK_VITALS_DATA: TrendData = {
  data: [
    { day: 'จ', date: '2026-01-06', systolic: 122, diastolic: 80, pulse: 72, sys_am: 118, dia_am: 76, pulse_am: 68, sys_pm: 122, dia_pm: 80, pulse_pm: 72 },
    { day: 'อ', date: '2026-01-07', systolic: 125, diastolic: 82, pulse: 75, sys_am: 120, dia_am: 78, pulse_am: 70, sys_pm: 125, dia_pm: 82, pulse_pm: 75, event: 'สูงนิดหน่อย' },
    { day: 'พ', date: '2026-01-08', systolic: 118, diastolic: 78, pulse: 70, sys_am: 115, dia_am: 74, pulse_am: 66, sys_pm: 118, dia_pm: 78, pulse_pm: 70 },
    { day: 'พฤ', date: '2026-01-09', systolic: 120, diastolic: 79, pulse: 73, sys_am: 117, dia_am: 75, pulse_am: 69, sys_pm: 120, dia_pm: 79, pulse_pm: 73 },
    { day: 'ศ', date: '2026-01-10', systolic: 123, diastolic: 81, pulse: 74, sys_am: 119, dia_am: 77, pulse_am: 70, sys_pm: 123, dia_pm: 81, pulse_pm: 74, note: 'ตื่นมาเหนื่อย' },
    { day: 'ส', date: '2026-01-11', systolic: 119, diastolic: 77, pulse: 71, sys_am: 116, dia_am: 73, pulse_am: 67, sys_pm: 119, dia_pm: 77, pulse_pm: 71 },
    { day: 'อา', date: '2026-01-12', systolic: 121, diastolic: 80, pulse: 72, sys_am: 118, dia_am: 76, pulse_am: 68, sys_pm: 121, dia_pm: 80, pulse_pm: 72 },
  ],
  summary: {
    avg: '121/79',
    count: '7/7 วัน',
    label1: 'ค่าเฉลี่ย',
    label2: 'บันทึกครบ',
  },
  insight: 'ความดันคุณอยู่ในเกณฑ์ปกติตลอดสัปดาห์ ยอดเยี่ยม!',
};

const MOCK_MEDS_DATA: TrendData = {
  data: [
    { day: 'จ', date: '2026-01-06', percent: 100, target: 3, done: 3 },
    { day: 'อ', date: '2026-01-07', percent: 67, target: 3, done: 2, note: 'ลืมมื้อเที่ยง' },
    { day: 'พ', date: '2026-01-08', percent: 100, target: 3, done: 3 },
    { day: 'พฤ', date: '2026-01-09', percent: 100, target: 3, done: 3 },
    { day: 'ศ', date: '2026-01-10', percent: 100, target: 3, done: 3 },
    { day: 'ส', date: '2026-01-11', percent: 33, target: 3, done: 1, note: 'ลืม 2 มื้อ' },
    { day: 'อา', date: '2026-01-12', percent: 100, target: 3, done: 3 },
  ],
  summary: {
    avg: '86%',
    count: '5/7 วัน',
    label1: 'อัตราครบ',
    label2: 'กินครบทั้งวัน',
  },
  insight: 'สัปดาห์นี้คุณลืมยา 2 วัน ลองตั้งเตือนเพิ่มช่วงเที่ยงนะคะ',
};

const MOCK_SLEEP_DATA: TrendData = {
  data: [
    { day: 'จ', date: '2026-01-06', hours: 7.5 },
    { day: 'อ', date: '2026-01-07', hours: 6.2, note: 'นอนดึก' },
    { day: 'พ', date: '2026-01-08', hours: 7.0 },
    { day: 'พฤ', date: '2026-01-09', hours: 5.5, note: 'ตื่นกลางดึก' },
    { day: 'ศ', date: '2026-01-10', hours: 8.0 },
    { day: 'ส', date: '2026-01-11', hours: 7.2 },
    { day: 'อา', date: '2026-01-12', hours: 6.8 },
  ],
  summary: {
    avg: '6.9 ชม.',
    count: '7/7 วัน',
    label1: 'เฉลี่ย/คืน',
    label2: 'บันทึกครบ',
  },
  insight: 'สัปดาห์นี้คุณนอนเฉลี่ย 6.9 ชม. ลองนอนก่อน 22:00 จะดีขึ้นนะคะ',
};

// Helper to get local date string
const getLocalDateString = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

export default function TrendsPage() {
  const { context, user } = useAuthStore();
  // Fallback to user.profileId if context.patientId is null (for patient role)
  const patientId = context.patientId || (user.role === 'patient' ? user.profileId : null);

  const [range, setRange] = useState<TimeRange>('7d');
  const [category, setCategory] = useState<TrendCategory>('heart');
  const [selectedPoint, setSelectedPoint] = useState<TrendDataPoint | null>(null);

  // Custom date range state
  const [customRange, setCustomRange] = useState<CustomDateRange>({
    startDate: getLocalDateString(30),
    endDate: getLocalDateString(0),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(customRange.startDate);
  const [tempEndDate, setTempEndDate] = useState(customRange.endDate);

  // Fetch data based on category
  const { data: vitalsData, isLoading: vitalsLoading } = useVitalsTrend(patientId, range, range === 'custom' ? customRange : undefined);
  const { data: medsData, isLoading: medsLoading } = useMedsTrend(patientId, range, range === 'custom' ? customRange : undefined);
  const { data: sleepData, isLoading: sleepLoading } = useSleepTrend(patientId, range, range === 'custom' ? customRange : undefined);
  const { data: exerciseData, isLoading: exerciseLoading } = useExerciseTrend(patientId, range, range === 'custom' ? customRange : undefined);
  const { data: moodData, isLoading: moodLoading } = useMoodTrend(patientId, range, range === 'custom' ? customRange : undefined);
  const { data: waterData, isLoading: waterLoading } = useWaterTrend(patientId, range, range === 'custom' ? customRange : undefined);
  const { data: glucoseData, isLoading: glucoseLoading } = useGlucoseTrend(patientId, range, range === 'custom' ? customRange : undefined);

  // Get active data based on category
  const activeData = useMemo(() => {
    switch (category) {
      case 'heart':
        return vitalsData || MOCK_VITALS_DATA;
      case 'meds':
        return medsData || MOCK_MEDS_DATA;
      case 'sleep':
        return sleepData || MOCK_SLEEP_DATA;
      case 'exercise':
        return exerciseData;
      case 'mood':
        return moodData;
      case 'water':
        return waterData;
      case 'glucose':
        return glucoseData;
      default:
        return vitalsData || MOCK_VITALS_DATA;
    }
  }, [category, vitalsData, medsData, sleepData, exerciseData, moodData, waterData, glucoseData]);

  const isLoading = useMemo(() => {
    switch (category) {
      case 'heart':
        return vitalsLoading;
      case 'meds':
        return medsLoading;
      case 'sleep':
        return sleepLoading;
      case 'exercise':
        return exerciseLoading;
      case 'mood':
        return moodLoading;
      case 'water':
        return waterLoading;
      case 'glucose':
        return glucoseLoading;
      default:
        return false;
    }
  }, [category, vitalsLoading, medsLoading, sleepLoading, exerciseLoading, moodLoading, waterLoading, glucoseLoading]);

  // Clear selected point when changing range/category
  useEffect(() => {
    setSelectedPoint(null);
  }, [range, category]);

  const categories = [
    { id: 'heart' as TrendCategory, label: 'ความดัน', icon: Heart },
    { id: 'meds' as TrendCategory, label: 'ยา', icon: Pill },
    { id: 'sleep' as TrendCategory, label: 'นอน', icon: Moon },
    { id: 'exercise' as TrendCategory, label: 'ออกกำลัง', icon: Dumbbell },
    { id: 'mood' as TrendCategory, label: 'อารมณ์', icon: Smile },
    { id: 'water' as TrendCategory, label: 'น้ำ', icon: Droplets },
    { id: 'glucose' as TrendCategory, label: 'ระดับน้ำตาล', icon: Droplet },
  ];

  const handleChartClick = (e: any) => {
    if (e && e.activePayload && e.activePayload[0]) {
      setSelectedPoint(e.activePayload[0].payload);
    }
  };

  return (
    <div className="min-h-screen pb-32 font-sans overflow-x-hidden relative z-10 bg-background">
      {/* Top Bar */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex justify-between items-center border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">แนวโน้ม</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-500">
        {/* Time Range Selection */}
        <div className="flex bg-muted/50 p-1 rounded-xl gap-1">
          {(['7d', '15d', '30d', 'custom'] as const).map((val, i) => {
            const labels = ['7 วัน', '15 วัน', '30 วัน', 'กำหนดเอง'];
            const isActive = range === val;
            return (
              <button
                key={val}
                onClick={() => {
                  setRange(val);
                  if (val === 'custom') {
                    setTempStartDate(customRange.startDate);
                    setTempEndDate(customRange.endDate);
                    setShowDatePicker(true);
                  }
                }}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm border border-primary/30'
                    : 'text-muted-foreground'
                )}
              >
                {val === 'custom' && <Calendar className="w-3 h-3" />}
                {labels[i]}
              </button>
            );
          })}
        </div>

        {/* Show selected custom date range */}
        {range === 'custom' && (
          <button
            onClick={() => {
              setTempStartDate(customRange.startDate);
              setTempEndDate(customRange.endDate);
              setShowDatePicker(true);
            }}
            className="flex items-center justify-center gap-2 text-xs text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/20"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {new Date(customRange.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              {' - '}
              {new Date(customRange.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          </button>
        )}

        {/* Category Tabs - Horizontal Scrollable (matching history page style) */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => {
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                    : 'bg-card text-muted-foreground border-border'
                )}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Content */}
        {!isLoading && activeData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 transition-all">
              <Card className="border-none shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {activeData.summary.label1}
                  </p>
                  <p className="text-xl font-bold text-foreground">{activeData.summary.avg}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {activeData.summary.label2}
                  </p>
                  <p className="text-xl font-bold text-foreground">{activeData.summary.count}</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card className="border-none shadow-sm bg-card p-6 relative">
              {/* Heart: 3 separate AM/PM charts */}
              {category === 'heart' && (
                <div className="space-y-6">
                  {/* Morning BP Chart */}
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                      ความดันช่วงเช้า (AM)
                    </h3>
                    <div className="flex flex-wrap gap-3 mb-2 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 bg-[#EF4444] rounded" />
                        <span className="text-muted-foreground">SYS</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 bg-[#3B82F6] rounded" />
                        <span className="text-muted-foreground">DIA</span>
                      </div>
                    </div>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={activeData.data}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                          onClick={handleChartClick}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[50, 180]} />
                          <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                          <ReferenceLine y={135} stroke="#EF4444" strokeDasharray="6 4" strokeOpacity={0.4} />
                          <Line type="monotone" dataKey="sys_am" name="SYS เช้า" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#EF4444' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#EF4444' }} connectNulls />
                          <Line type="monotone" dataKey="dia_am" name="DIA เช้า" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#3B82F6' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#3B82F6' }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Evening BP Chart */}
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#991B1B]" />
                      ความดันช่วงเย็น (PM)
                    </h3>
                    <div className="flex flex-wrap gap-3 mb-2 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 bg-[#991B1B] rounded" />
                        <span className="text-muted-foreground">SYS</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 bg-[#1E3A8A] rounded" />
                        <span className="text-muted-foreground">DIA</span>
                      </div>
                    </div>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={activeData.data}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                          onClick={handleChartClick}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[50, 180]} />
                          <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                          <ReferenceLine y={135} stroke="#991B1B" strokeDasharray="6 4" strokeOpacity={0.4} />
                          <Line type="monotone" dataKey="sys_pm" name="SYS เย็น" stroke="#991B1B" strokeWidth={2.5} dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#991B1B' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#991B1B' }} connectNulls />
                          <Line type="monotone" dataKey="dia_pm" name="DIA เย็น" stroke="#1E3A8A" strokeWidth={2} dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#1E3A8A' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#1E3A8A' }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Heart Rate Chart */}
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                      ชีพจร (Heart Rate)
                    </h3>
                    <div className="flex flex-wrap gap-3 mb-2 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 border-t-2 border-dashed border-[#F59E0B]" />
                        <span className="text-muted-foreground">เช้า</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 bg-[#F97316] rounded" />
                        <span className="text-muted-foreground">เย็น</span>
                      </div>
                    </div>
                    <div className="h-[150px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={activeData.data}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                          onClick={handleChartClick}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[40, 120]} />
                          <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                          <Line type="monotone" dataKey="pulse_am" name="HR เช้า" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#F59E0B' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#F59E0B' }} connectNulls />
                          <Line type="monotone" dataKey="pulse_pm" name="HR เย็น" stroke="#F97316" strokeWidth={2.5} dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#F97316' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#F97316' }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Glucose legend */}
              {category === 'glucose' && (
                <div className="flex flex-wrap gap-3 mb-2 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                    <span className="text-muted-foreground">ตื่นนอน</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                    <span className="text-muted-foreground">หลังอาหาร 1 ชม.</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                    <span className="text-muted-foreground">หลังอาหาร 2 ชม.</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                    <span className="text-muted-foreground">ก่อนนอน</span>
                  </div>
                </div>
              )}

              {/* Non-heart charts */}
              {category !== 'heart' && (
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {category === 'meds' ? (
                    <BarChart
                      data={activeData.data}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      onClick={handleChartClick}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--muted))"
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        domain={[0, 100]}
                      />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="percent" radius={[6, 6, 0, 0]}>
                        {activeData.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.percent === 100
                                ? '#10b981'
                                : entry.percent === 0
                                  ? '#ef4444'
                                  : '#f97316'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : category === 'sleep' ? (
                    <BarChart
                      data={activeData.data}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      onClick={handleChartClick}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--muted))"
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        domain={[0, 10]}
                      />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                        {activeData.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.hours && entry.hours < 6 ? '#f97316' : '#8b5cf6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : category === 'exercise' ? (
                    <BarChart
                      data={activeData.data}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      onClick={handleChartClick}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--muted))"
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        domain={[0, 60]}
                      />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="duration" radius={[6, 6, 0, 0]}>
                        {activeData.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.duration == null ? '#e5e7eb' : (entry.duration ?? 0) >= 30 ? '#10b981' : '#f97316'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : category === 'mood' ? (
                    <BarChart
                      data={activeData.data}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      onClick={handleChartClick}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--muted))"
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        domain={[0, 5]}
                      />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="moodScore" radius={[6, 6, 0, 0]}>
                        {activeData.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.moodScore == null
                                ? '#e5e7eb'
                                : (entry.moodScore ?? 0) >= 4
                                  ? '#10b981'
                                  : (entry.moodScore ?? 0) >= 3
                                    ? '#f59e0b'
                                    : '#ef4444'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : category === 'glucose' ? (
                    (() => {
                      // Flatten all glucose readings into scatter points
                      const mealColorMap: Record<string, string> = {
                        fasting: '#6366f1',      // indigo — ตื่นนอน
                        post_meal_1h: '#f97316',  // orange — หลังอาหาร 1 ชม.
                        post_meal_2h: '#f59e0b',  // amber — หลังอาหาร 2 ชม.
                        before_bed: '#8b5cf6',    // violet — ก่อนนอน
                      };
                      const mealLabelMap: Record<string, string> = {
                        fasting: 'ตื่นนอน',
                        post_meal_1h: 'หลังอาหาร 1 ชม.',
                        post_meal_2h: 'หลังอาหาร 2 ชม.',
                        before_bed: 'ก่อนนอน',
                      };

                      // Build scatter points: each reading becomes a dot
                      const scatterPoints: { dayIndex: number; glucose: number; mealContext: string; time: string; day: string; date: string }[] = [];
                      activeData.data.forEach((d, i) => {
                        if (d.glucoseReadings) {
                          d.glucoseReadings.forEach((r, ri) => {
                            // Offset dots slightly so multiple readings don't overlap
                            const offset = d.glucoseReadings!.length > 1
                              ? (ri - (d.glucoseReadings!.length - 1) / 2) * 0.15
                              : 0;
                            scatterPoints.push({
                              dayIndex: i + offset,
                              glucose: r.glucose,
                              mealContext: r.mealContext || 'fasting',
                              time: r.time,
                              day: d.day,
                              date: d.date,
                            });
                          });
                        }
                      });

                      // Group by meal context for separate Scatter series
                      const groups: Record<string, typeof scatterPoints> = {};
                      scatterPoints.forEach(p => {
                        const key = p.mealContext;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(p);
                      });

                      const dayLabels = activeData.data.map(d => d.day);

                      return (
                        <ScatterChart margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                          <XAxis
                            type="number"
                            dataKey="dayIndex"
                            domain={[-0.5, activeData.data.length - 0.5]}
                            ticks={activeData.data.map((_, i) => i)}
                            tickFormatter={(val: number) => dayLabels[Math.round(val)] || ''}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            dy={10}
                          />
                          <YAxis
                            type="number"
                            dataKey="glucose"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            domain={[50, 250]}
                          />
                          <ZAxis range={[80, 80]} />
                          <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="6 4" strokeOpacity={0.5} label={{ value: 'เสี่ยง 100', position: 'insideTopLeft', fontSize: 9, fill: '#f59e0b' }} />
                          <ReferenceLine y={126} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.5} label={{ value: 'สูง 126', position: 'insideTopLeft', fontSize: 9, fill: '#ef4444' }} />
                          <Tooltip
                            content={({ payload }) => {
                              if (!payload || !payload[0]) return null;
                              const p = payload[0].payload;
                              return (
                                <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-md text-xs space-y-0.5">
                                  <p className="font-bold">{p.day} ({p.date})</p>
                                  <p className="font-bold text-base" style={{ color: mealColorMap[p.mealContext] || '#ec4899' }}>
                                    {p.glucose} mg/dL
                                  </p>
                                  <p className="text-muted-foreground">
                                    {mealLabelMap[p.mealContext] || p.mealContext} · {p.time}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          {Object.entries(groups).map(([ctx, points]) => (
                            <Scatter
                              key={ctx}
                              name={mealLabelMap[ctx] || ctx}
                              data={points}
                              fill={mealColorMap[ctx] || '#ec4899'}
                              stroke="white"
                              strokeWidth={2}
                              onClick={(data: any) => {
                                if (data && data.date) {
                                  const dayData = activeData.data.find(d => d.date === data.date);
                                  if (dayData) setSelectedPoint(dayData);
                                }
                              }}
                              cursor="pointer"
                            />
                          ))}
                        </ScatterChart>
                      );
                    })()
                  ) : (
                    /* Water */
                    <BarChart
                      data={activeData.data}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      onClick={handleChartClick}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--muted))"
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        domain={[0, 12]}
                      />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="glasses" radius={[6, 6, 0, 0]}>
                        {activeData.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              (entry.glasses || 0) >= 8
                                ? '#3b82f6'
                                : (entry.glasses || 0) >= 6
                                  ? '#60a5fa'
                                  : '#93c5fd'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              )}

              <div className="mt-4 flex justify-center">
                <p className="text-[10px] text-muted-foreground font-medium bg-muted/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Info className="w-3 h-3" /> แตะจุดบนกราฟเพื่อดูรายละเอียด
                </p>
              </div>

              {/* Selected Point Details */}
              {selectedPoint && (
                <div className="mt-4 pt-4 border-t border-muted/50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">{selectedPoint.day}</p>
                      {category === 'heart' && (
                        <div className="space-y-2 mt-1">
                          {/* AM reading */}
                          {(selectedPoint.sys_am || selectedPoint.pulse_am) && (
                            <div className="flex items-baseline gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-8">เช้า</span>
                              <p className="text-base font-bold text-[#EF4444]">
                                {selectedPoint.sys_am}/{selectedPoint.dia_am}{' '}
                                <span className="text-[10px] font-normal text-muted-foreground">mmHg</span>
                              </p>
                              <p className="text-sm font-bold text-[#F59E0B]">
                                {selectedPoint.pulse_am}{' '}
                                <span className="text-[10px] font-normal text-muted-foreground">bpm</span>
                              </p>
                            </div>
                          )}
                          {/* PM reading */}
                          {(selectedPoint.sys_pm || selectedPoint.pulse_pm) && (
                            <div className="flex items-baseline gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-8">เย็น</span>
                              <p className="text-base font-bold text-[#991B1B]">
                                {selectedPoint.sys_pm}/{selectedPoint.dia_pm}{' '}
                                <span className="text-[10px] font-normal text-muted-foreground">mmHg</span>
                              </p>
                              <p className="text-sm font-bold text-[#F97316]">
                                {selectedPoint.pulse_pm}{' '}
                                <span className="text-[10px] font-normal text-muted-foreground">bpm</span>
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      {category === 'meds' && (
                        <div className="mt-1">
                          <p className="text-sm font-bold text-foreground">
                            ตั้งไว้ {selectedPoint.target} ช่วง | ทำได้ {selectedPoint.done} ช่วง |{' '}
                            = {selectedPoint.percent}%
                          </p>
                        </div>
                      )}
                      {category === 'sleep' && (
                        <div className="mt-1">
                          <p className="text-xl font-bold text-indigo-600">
                            {selectedPoint.hours}{' '}
                            <span className="text-xs font-normal text-muted-foreground">ชม.</span>
                          </p>
                        </div>
                      )}
                      {category === 'exercise' && (
                        <div className="mt-1">
                          <p className="text-xl font-bold text-emerald-600">
                            {selectedPoint.duration !== null ? (
                              <>
                                {selectedPoint.duration}{' '}
                                <span className="text-xs font-normal text-muted-foreground">นาที</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-base">ไม่ได้ออกกำลังกาย</span>
                            )}
                          </p>
                          {selectedPoint.exerciseType && (
                            <p className="text-xs text-muted-foreground mt-0.5">{selectedPoint.exerciseType}</p>
                          )}
                        </div>
                      )}
                      {category === 'mood' && (
                        <div className="mt-1">
                          <p className="text-xl font-bold text-amber-600">
                            {selectedPoint.moodScore !== null ? (
                              <>
                                {selectedPoint.moodScore}/5{' '}
                                <span className="text-xs font-normal text-muted-foreground">คะแนน</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-base">ไม่ได้บันทึก</span>
                            )}
                          </p>
                          {selectedPoint.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">{selectedPoint.note}</p>
                          )}
                        </div>
                      )}
                      {category === 'water' && (
                        <div className="mt-1">
                          <p className="text-xl font-bold text-blue-600">
                            {selectedPoint.glasses}{' '}
                            <span className="text-xs font-normal text-muted-foreground">แก้ว</span>
                          </p>
                          {selectedPoint.ml && (
                            <p className="text-xs text-muted-foreground mt-0.5">≈ {selectedPoint.ml} ml</p>
                          )}
                        </div>
                      )}
                      {category === 'glucose' && (
                        <div className="mt-1 space-y-2">
                          {selectedPoint.glucoseReadings && selectedPoint.glucoseReadings.length > 0 ? (
                            <>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                วัด {selectedPoint.glucoseReadings.length} ครั้ง · เฉลี่ย {selectedPoint.glucose} mg/dL
                              </p>
                              {selectedPoint.glucoseReadings.map((r, ri) => {
                                const mealLabel: Record<string, string> = { fasting: 'ตื่นนอน', post_meal_1h: 'หลังอาหาร 1 ชม.', post_meal_2h: 'หลังอาหาร 2 ชม.', before_bed: 'ก่อนนอน' };
                                const mealColor: Record<string, string> = { fasting: '#6366f1', post_meal_1h: '#f97316', post_meal_2h: '#f59e0b', before_bed: '#8b5cf6' };
                                return (
                                  <div key={ri} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: mealColor[r.mealContext || ''] || '#ec4899' }} />
                                    <span className="text-base font-bold" style={{ color: mealColor[r.mealContext || ''] || '#ec4899' }}>
                                      {r.glucose}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">mg/dL</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {mealLabel[r.mealContext || ''] || r.mealContext} · {r.time}
                                    </span>
                                  </div>
                                );
                              })}
                            </>
                          ) : (
                            <p className="text-muted-foreground text-base">ไม่ได้วัด</p>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedPoint.note && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2 rounded-xl text-xs font-medium text-yellow-700 dark:text-yellow-400 max-w-[150px]">
                        &quot;{selectedPoint.note}&quot;
                      </div>
                    )}
                  </div>
                  {selectedPoint.event && !selectedPoint.note && (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{selectedPoint.event}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Insight Cards */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 pl-1">
                <div className="w-1 h-4 bg-accent rounded-full" />
                อุ่นใจสังเกตให้
              </h2>
              <Card className="border-none shadow-sm bg-accent/5 overflow-hidden group hover:bg-accent/10 transition-colors">
                <CardContent className="p-5 flex gap-4 items-start">
                  <div className="bg-accent/10 p-3 rounded-2xl text-accent group-hover:scale-110 transition-transform">
                    <MessageCircleHeart className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm leading-relaxed font-semibold text-foreground">
                      &quot;{activeData.insight}&quot;
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Custom Date Range Picker Drawer */}
      <Drawer open={showDatePicker} onOpenChange={setShowDatePicker}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex items-center justify-between px-6">
            <DrawerTitle className="text-xl font-bold">เลือกช่วงวันที่</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="px-6 pb-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">วันเริ่มต้น</label>
                <DateInput
                  value={tempStartDate}
                  onChange={setTempStartDate}
                  maxDate={tempEndDate}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">วันสิ้นสุด</label>
                <DateInput
                  value={tempEndDate}
                  onChange={setTempEndDate}
                  minDate={tempStartDate}
                  maxDate={getLocalDateString(0)}
                />
              </div>
            </div>

            {/* Quick select buttons */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">เลือกด่วน</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '7 วันที่แล้ว', days: 7 },
                  { label: '14 วันที่แล้ว', days: 14 },
                  { label: '30 วันที่แล้ว', days: 30 },
                  { label: '60 วันที่แล้ว', days: 60 },
                  { label: '90 วันที่แล้ว', days: 90 },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => {
                      setTempStartDate(getLocalDateString(opt.days - 1));
                      setTempEndDate(getLocalDateString(0));
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                className="flex-1 h-12 rounded-xl"
                onClick={() => setShowDatePicker(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground"
                onClick={() => {
                  setCustomRange({
                    startDate: tempStartDate,
                    endDate: tempEndDate,
                  });
                  setShowDatePicker(false);
                }}
              >
                ยืนยัน
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <BottomNav />
    </div>
  );
}
