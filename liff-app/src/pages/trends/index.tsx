import { useState, useMemo, useEffect } from 'react';
import {
  Heart,
  Moon,
  Pill,
  MessageCircleHeart,
  Info,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/layout/bottom-nav';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import {
  useVitalsTrend,
  useMedsTrend,
  useSleepTrend,
  type TimeRange,
  type TrendCategory,
  type TrendDataPoint,
  type TrendData,
} from '@/lib/api/hooks/use-trends';

// Mock data for fallback (with required 'date' field for TrendDataPoint)
const MOCK_VITALS_DATA: TrendData = {
  data: [
    { day: 'จ', date: '2026-01-06', systolic: 122, diastolic: 80, pulse: 72 },
    { day: 'อ', date: '2026-01-07', systolic: 125, diastolic: 82, pulse: 75, event: 'สูงนิดหน่อย' },
    { day: 'พ', date: '2026-01-08', systolic: 118, diastolic: 78, pulse: 70 },
    { day: 'พฤ', date: '2026-01-09', systolic: 120, diastolic: 79, pulse: 73 },
    { day: 'ศ', date: '2026-01-10', systolic: 123, diastolic: 81, pulse: 74, note: 'ตื่นมาเหนื่อย' },
    { day: 'ส', date: '2026-01-11', systolic: 119, diastolic: 77, pulse: 71 },
    { day: 'อา', date: '2026-01-12', systolic: 121, diastolic: 80, pulse: 72 },
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

export default function TrendsPage() {
  const { context } = useAuthStore();
  const patientId = context.patientId;

  const [range, setRange] = useState<TimeRange>('7d');
  const [category, setCategory] = useState<TrendCategory>('heart');
  const [selectedPoint, setSelectedPoint] = useState<TrendDataPoint | null>(null);

  // Fetch data based on category
  const { data: vitalsData, isLoading: vitalsLoading } = useVitalsTrend(patientId, range);
  const { data: medsData, isLoading: medsLoading } = useMedsTrend(patientId, range);
  const { data: sleepData, isLoading: sleepLoading } = useSleepTrend(patientId, range);

  // Get active data based on category (with mock fallback)
  const activeData = useMemo(() => {
    switch (category) {
      case 'heart':
        return vitalsData || MOCK_VITALS_DATA;
      case 'meds':
        return medsData || MOCK_MEDS_DATA;
      case 'sleep':
        return sleepData || MOCK_SLEEP_DATA;
      default:
        return vitalsData || MOCK_VITALS_DATA;
    }
  }, [category, vitalsData, medsData, sleepData]);

  const isLoading = useMemo(() => {
    switch (category) {
      case 'heart':
        return vitalsLoading;
      case 'meds':
        return medsLoading;
      case 'sleep':
        return sleepLoading;
      default:
        return false;
    }
  }, [category, vitalsLoading, medsLoading, sleepLoading]);

  // Clear selected point when changing range/category
  useEffect(() => {
    setSelectedPoint(null);
  }, [range, category]);

  const categories = [
    { id: 'heart' as TrendCategory, label: 'ความดัน', icon: Heart },
    { id: 'meds' as TrendCategory, label: 'ยา', icon: Pill },
    { id: 'sleep' as TrendCategory, label: 'นอน', icon: Moon },
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
        <div className="flex bg-muted/50 p-1 rounded-xl">
          {(['7d', '15d', '30d'] as const).map((val, i) => {
            const label = ['7 วัน', '15 วัน', '30 วัน'][i];
            const isActive = range === val;
            return (
              <button
                key={val}
                onClick={() => setRange(val)}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm border border-primary/30'
                    : 'text-muted-foreground'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Category Tabs */}
        <div className="flex bg-muted/50 p-1 rounded-xl">
          {categories.map((cat) => {
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                <cat.icon className="w-4 h-4" />
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
              {/* Chart Legend for Heart */}
              {category === 'heart' && (
                <div className="flex flex-wrap gap-4 mb-6 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 bg-[#0E8A9A] rounded" />
                    <span className="text-muted-foreground">SYS</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 border-t-2 border-dashed border-[#0E8A9A]" />
                    <span className="text-muted-foreground">DIA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 bg-[#F2994A] rounded" />
                    <span className="text-muted-foreground">HR</span>
                  </div>
                </div>
              )}

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {category === 'heart' ? (
                    <LineChart
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
                      />
                      <Tooltip cursor={{ stroke: '#0E8A9A', strokeWidth: 1, strokeDasharray: '4 4' }} content={() => null} />
                      <Line
                        type="monotone"
                        dataKey="systolic"
                        stroke="#0E8A9A"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'white', strokeWidth: 2, stroke: '#0E8A9A' }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#0E8A9A' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="diastolic"
                        stroke="rgba(14, 138, 154, 0.5)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: 'rgba(14, 138, 154, 0.5)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pulse"
                        stroke="#F2994A"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#F2994A' }}
                      />
                      {activeData.data.map((entry, index) =>
                        entry.event ? (
                          <ReferenceDot
                            key={index}
                            x={entry.day}
                            y={entry.systolic as number}
                            r={6}
                            fill="hsl(var(--destructive) / 0.2)"
                            stroke="hsl(var(--destructive))"
                            strokeWidth={1}
                          />
                        ) : null
                      )}
                    </LineChart>
                  ) : category === 'meds' ? (
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
                      <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
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
                  ) : (
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
                      <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                        {activeData.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.hours && entry.hours < 6 ? '#f97316' : '#8b5cf6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

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
                        <div className="flex items-baseline gap-2 mt-1">
                          <p className="text-xl font-bold text-primary">
                            {selectedPoint.systolic}/{selectedPoint.diastolic}{' '}
                            <span className="text-xs font-normal text-muted-foreground">mmHg</span>
                          </p>
                          <p className="text-base font-bold text-orange-500">
                            {selectedPoint.pulse}{' '}
                            <span className="text-xs font-normal text-muted-foreground">bpm</span>
                          </p>
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

      <BottomNav />
    </div>
  );
}
