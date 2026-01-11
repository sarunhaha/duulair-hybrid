import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Calendar,
  Heart,
  Pill,
  Droplets,
  Activity,
  Download,
  FileText,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Legend,
} from 'recharts';
import { useAuthStore } from '@/stores/auth';
import {
  useReportData,
  type DateRange,
  getDateRange,
  formatDateRange,
  getBpStatusLabel,
  getMedsStatusLabel,
  getWaterStatusLabel,
  getActivityTypeLabel,
  exportToCSV,
  exportToPDF,
} from '@/lib/api/hooks/use-reports';
import { usePatientProfile } from '@/lib/api/hooks/use-profile';

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7 วัน' },
  { value: '30d', label: '30 วัน' },
  { value: '90d', label: '90 วัน' },
];

export default function ReportsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const patientId = user.role === 'patient' ? user.profileId : null;

  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { startDate, endDate } = getDateRange(dateRange);
  const dateRangeLabel = formatDateRange(startDate, endDate);

  const { data: reportData, isLoading } = useReportData(patientId, dateRange);
  const { data: profile } = usePatientProfile(patientId);

  const patientName = profile ? `${profile.first_name} ${profile.last_name}` : 'ผู้ใช้งาน';

  const handleExportCSV = () => {
    if (reportData) {
      exportToCSV(reportData, patientName, dateRangeLabel);
    }
  };

  const handleExportPDF = () => {
    if (reportData) {
      exportToPDF(reportData, patientName, dateRangeLabel);
    }
  };

  const getBpTrend = () => {
    if (!reportData?.chartData || reportData.chartData.length < 2) return null;
    const recent = reportData.chartData.slice(-3);
    const older = reportData.chartData.slice(0, 3);
    const recentAvg = recent.reduce((sum, d) => sum + (d.systolic || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + (d.systolic || 0), 0) / older.length;
    if (recentAvg > olderAvg + 5) return 'up';
    if (recentAvg < olderAvg - 5) return 'down';
    return 'stable';
  };

  const bpTrend = getBpTrend();

  // Group activities by date
  const groupedActivities = reportData?.activities.reduce(
    (acc, activity) => {
      const date = activity.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    },
    {} as Record<string, typeof reportData.activities>
  );

  return (
    <div className="min-h-screen bg-background pb-8 font-sans">
      {/* Header */}
      <header className="bg-card pt-12 pb-4 px-4 sticky top-0 z-20 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">รายงานสุขภาพ</h1>
            <p className="text-xs text-muted-foreground">{dateRangeLabel}</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Date Range Selector */}
        <div className="relative">
          <Button
            variant="outline"
            className="w-full justify-between rounded-2xl h-12"
            onClick={() => setShowDatePicker(!showDatePicker)}
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span className="font-medium">
                {dateRangeOptions.find((o) => o.value === dateRange)?.label}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
          </Button>

          {showDatePicker && (
            <Card className="absolute top-14 left-0 right-0 z-30 shadow-lg">
              <CardContent className="p-2">
                {dateRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setDateRange(option.value);
                      setShowDatePicker(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                      dateRange === option.value
                        ? 'bg-accent/10 text-accent font-bold'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูล...</div>
        ) : reportData ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* BP Card */}
              <Card className="border-none shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="bg-red-100 dark:bg-red-950/30 p-2 rounded-xl">
                      <Heart className="w-5 h-5 text-red-500" />
                    </div>
                    {bpTrend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
                    {bpTrend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
                    {bpTrend === 'stable' && <Minus className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <p className="text-2xl font-bold mt-3">
                    {reportData.summary.bp.avgSystolic}/{reportData.summary.bp.avgDiastolic}
                  </p>
                  <p className="text-xs text-muted-foreground">mmHg เฉลี่ย</p>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      reportData.summary.bp.status === 'normal'
                        ? 'text-green-600'
                        : reportData.summary.bp.status === 'elevated'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {getBpStatusLabel(reportData.summary.bp.status)}
                  </p>
                </CardContent>
              </Card>

              {/* Meds Card */}
              <Card className="border-none shadow-sm">
                <CardContent className="p-4">
                  <div className="bg-blue-100 dark:bg-blue-950/30 p-2 rounded-xl w-fit">
                    <Pill className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold mt-3">{reportData.summary.meds.adherencePercent}%</p>
                  <p className="text-xs text-muted-foreground">กินยาครบ</p>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      reportData.summary.meds.status === 'good'
                        ? 'text-green-600'
                        : reportData.summary.meds.status === 'fair'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {getMedsStatusLabel(reportData.summary.meds.status)}
                  </p>
                </CardContent>
              </Card>

              {/* Water Card */}
              <Card className="border-none shadow-sm">
                <CardContent className="p-4">
                  <div className="bg-cyan-100 dark:bg-cyan-950/30 p-2 rounded-xl w-fit">
                    <Droplets className="w-5 h-5 text-cyan-500" />
                  </div>
                  <p className="text-2xl font-bold mt-3">{reportData.summary.water.avgMl}</p>
                  <p className="text-xs text-muted-foreground">มล./วัน เฉลี่ย</p>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      reportData.summary.water.status === 'good'
                        ? 'text-green-600'
                        : reportData.summary.water.status === 'fair'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {getWaterStatusLabel(reportData.summary.water.status)}
                  </p>
                </CardContent>
              </Card>

              {/* Activities Card */}
              <Card className="border-none shadow-sm">
                <CardContent className="p-4">
                  <div className="bg-purple-100 dark:bg-purple-950/30 p-2 rounded-xl w-fit">
                    <Activity className="w-5 h-5 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold mt-3">{reportData.summary.activities.total}</p>
                  <p className="text-xs text-muted-foreground">กิจกรรมทั้งหมด</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Object.entries(reportData.summary.activities.byType)
                      .slice(0, 2)
                      .map(([type, count]) => `${getActivityTypeLabel(type)} ${count}`)
                      .join(', ')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* BP Chart */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  กราฟความดันโลหิต
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData.chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[60, 180]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line
                        type="monotone"
                        dataKey="systolic"
                        name="ตัวบน"
                        stroke="hsl(0, 84%, 60%)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="diastolic"
                        name="ตัวล่าง"
                        stroke="hsl(210, 84%, 60%)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Meds Chart */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Pill className="w-4 h-4 text-blue-500" />
                  กราฟการกินยา
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [`${value ?? 0}%`, 'กินยา']}
                      />
                      <Bar dataKey="medsPercent" name="กินยา (%)" fill="hsl(210, 84%, 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Water Chart */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-cyan-500" />
                  กราฟน้ำดื่ม
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 3000]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [`${value ?? 0} มล.`, 'น้ำดื่ม']}
                      />
                      <Bar dataKey="waterMl" name="น้ำดื่ม (มล.)" fill="hsl(187, 84%, 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  รายละเอียดกิจกรรม
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupedActivities &&
                  Object.entries(groupedActivities)
                    .slice(0, 5)
                    .map(([date, activities]) => (
                      <div key={date}>
                        <p className="text-xs font-bold text-muted-foreground mb-2">{date}</p>
                        <div className="space-y-2">
                          {activities.map((activity) => (
                            <div
                              key={activity.id}
                              className="flex items-center gap-3 p-2 rounded-xl bg-muted/20"
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  activity.type === 'medication'
                                    ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-500'
                                    : activity.type === 'vitals'
                                      ? 'bg-red-100 dark:bg-red-950/30 text-red-500'
                                      : activity.type === 'water'
                                        ? 'bg-cyan-100 dark:bg-cyan-950/30 text-cyan-500'
                                        : 'bg-purple-100 dark:bg-purple-950/30 text-purple-500'
                                }`}
                              >
                                {activity.type === 'medication' && <Pill className="w-4 h-4" />}
                                {activity.type === 'vitals' && <Heart className="w-4 h-4" />}
                                {activity.type === 'water' && <Droplets className="w-4 h-4" />}
                                {activity.type === 'symptom' && <Activity className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{activity.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{activity.value}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">{activity.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
              </CardContent>
            </Card>

            {/* Export Buttons */}
            <div className="flex gap-3">
              <Button onClick={handleExportCSV} variant="outline" className="flex-1 h-12 rounded-2xl">
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button onClick={handleExportPDF} variant="outline" className="flex-1 h-12 rounded-2xl">
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล</div>
        )}
      </main>
    </div>
  );
}
