import { useState } from 'react';
import {
  Stethoscope,
  Activity,
  Pill,
  Moon,
  Dumbbell,
  Smile,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplet,
  Check,
  X,
  FileText,
  ClipboardList,
  Loader2,
  Calendar,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  useHealthHistory,
  useDeleteVitals,
  useDeleteSymptom,
  useDeleteExercise,
  useDeleteMood,
  useDeleteMedicalNote,
  useDeleteMedicationLog,
  useDeleteSleep,
  useDeleteWater,
} from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { BottomNav } from '@/components/layout/bottom-nav';
import { VitalsForm, WaterForm, MedicationForm, SymptomForm, SleepForm, ExerciseForm, MoodForm, MedicalNotesForm, GlucoseForm } from '@/components/forms';

interface HistoryItem {
  id: number;
  type: string;
  title: string;
  detail: string;
  time: string;
  date: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

// Icon and color mapping for history types
const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  vitals: { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  health: { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  sleep: { icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  symptoms: { icon: Stethoscope, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
  medications: { icon: Pill, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  meds: { icon: Pill, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  water: { icon: Droplet, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  exercise: { icon: Dumbbell, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  glucose: { icon: Droplet, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/30' },
};

// Date range options
const DATE_RANGES = [
  { id: 7, label: '7 วัน', shortLabel: '7 วัน' },
  { id: 14, label: '14 วัน', shortLabel: '14 วัน' },
  { id: 30, label: '30 วัน', shortLabel: '30 วัน' },
  { id: 90, label: '3 เดือน', shortLabel: '3 เดือน' },
  { id: -1, label: 'กำหนดเอง', shortLabel: 'กำหนดเอง' },
];

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState(7); // Default 7 days, -1 = custom
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCustomDateDrawer, setShowCustomDateDrawer] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null);
  const [success, setSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch real data with date range
  const ensurePatient = useEnsurePatient();
  const { patientId, isLoading: authLoading } = ensurePatient;

  // Delete hooks
  const deleteVitals = useDeleteVitals();
  const deleteSymptom = useDeleteSymptom();
  const deleteExercise = useDeleteExercise();
  const deleteMood = useDeleteMood();
  const deleteMedicalNote = useDeleteMedicalNote();
  const deleteMedicationLog = useDeleteMedicationLog();
  const deleteSleep = useDeleteSleep();
  const deleteWater = useDeleteWater();

  // Map type to delete function
  const getDeleteMutation = (type: string) => {
    const deleteMap: Record<string, typeof deleteVitals> = {
      health: deleteVitals,
      vitals: deleteVitals,
      symptoms: deleteSymptom,
      exercise: deleteExercise,
      mood: deleteMood,
      medical_notes: deleteMedicalNote,
      meds: deleteMedicationLog,
      medications: deleteMedicationLog,
      sleep: deleteSleep,
      water: deleteWater,
    };
    return deleteMap[type];
  };

  const isDeleting = deleteVitals.isPending || deleteSymptom.isPending || deleteExercise.isPending ||
    deleteMood.isPending || deleteMedicalNote.isPending || deleteMedicationLog.isPending ||
    deleteSleep.isPending || deleteWater.isPending;

  // Use custom dates if dateRange is -1, otherwise use days
  const historyOptions = dateRange === -1 && customStartDate && customEndDate
    ? { startDate: customStartDate, endDate: customEndDate }
    : undefined;
  const { data: healthHistory, isLoading: historyLoading, refetch: refetchHistory } = useHealthHistory(
    patientId,
    dateRange === -1 ? 30 : dateRange, // fallback to 30 if custom but no dates yet
    historyOptions
  );

  // Handle delete from real data
  const handleDeleteRealItem = async (item: HistoryItem) => {
    if (!patientId) return;

    // Get the raw data ID - the item.id is the index, we need the actual ID from raw
    const rawData = realHistoryData.find(h => h.id === item.id);
    if (!rawData) return;

    // Extract actual ID from the raw item (stored in the item when converted)
    const actualId = (rawData as any).rawId;
    if (!actualId) return;

    const deleteMutation = getDeleteMutation(item.type);
    if (!deleteMutation) return;

    try {
      await deleteMutation.mutateAsync({ id: actualId, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      refetchHistory();
    } catch (error) {
      console.error('Error deleting history item:', error);
      toast({ description: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
    }
  };

  // Auto-ensure patient on mount
  const [hasEnsured, setHasEnsured] = useState(false);

  // Trigger auto-create when auth is ready but no patientId
  if (!authLoading && !patientId && !hasEnsured) {
    setHasEnsured(true);
    ensurePatient.ensurePatient();
  }

  // Mock History Data - แสดงเฉพาะใน tab "ตัวอย่างข้อมูล"
  const mockHistoryData: HistoryItem[] = [
    { id: 1, type: 'symptoms', title: 'อาการ', detail: 'ปวดหัว (ระดับ 3)', time: '10:30 น.', date: 'วันนี้', icon: Stethoscope, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
    { id: 2, type: 'health', title: 'ความดัน', detail: '128/82 mmHg', time: '08:15 น.', date: 'วันนี้', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { id: 3, type: 'meds', title: 'ยาเช้า', detail: 'ทานครบตามรายการ', time: '08:00 น.', date: 'วันนี้', icon: Pill, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
    { id: 4, type: 'sleep', title: 'การนอน', detail: '6.5 ชม. (หลับดี)', time: '07:00 น.', date: 'วันนี้', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
    { id: 5, type: 'water', title: 'น้ำ', detail: '8 แก้ว', time: '18:00 น.', date: 'เมื่อวาน', icon: Droplet, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-950/30' },
    { id: 6, type: 'exercise', title: 'ออกกำลังกาย', detail: 'เดินเร็ว 20 นาที', time: '17:45 น.', date: 'เมื่อวาน', icon: Dumbbell, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
    { id: 7, type: 'mood', title: 'อารมณ์', detail: 'สดชื่น แจ่มใส', time: '09:00 น.', date: 'เมื่อวาน', icon: Smile, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
    { id: 8, type: 'other', title: 'บันทึกทั่วไป', detail: 'นัดหมอฟันเลื่อนเป็นอาทิตย์หน้า', time: '14:20 น.', date: '15 ม.ค.', icon: MoreHorizontal, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-950/30' },
    { id: 9, type: 'health', title: 'ความดัน', detail: '135/88 mmHg (สูงนิดหน่อย)', time: '18:30 น.', date: '15 ม.ค.', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { id: 10, type: 'symptoms', title: 'อาการ', detail: 'เวียนหัว บ้านหมุน', time: '15:00 น.', date: '14 ม.ค.', icon: Stethoscope, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
  ];

  // Convert API data to display format
  const realHistoryData: (HistoryItem & { rawId: string })[] = (healthHistory || []).map((item, index) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.health;
    const typeMapping: Record<string, string> = {
      vitals: 'health',
      medications: 'meds',
    };
    return {
      id: index + 1,
      rawId: item.id, // Store actual DB ID
      type: typeMapping[item.type] || item.type,
      title: item.title,
      detail: item.detail,
      time: item.time,
      date: item.date,
      icon: config.icon,
      color: config.color,
      bg: config.bg,
    };
  });

  // เลือก data ตาม filter
  const isExampleTab = filter === 'example';
  const isLoading = authLoading || historyLoading;
  const dataSource = isExampleTab ? mockHistoryData : realHistoryData;
  const filteredData = filter === 'all' || filter === 'example'
    ? dataSource
    : dataSource.filter((item) => item.type === filter);

  const handleEditSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setEditingItem(null);
      refetchHistory();
    }, 1500);
  };

  const handleCloseEdit = () => {
    setEditingItem(null);
    setSuccess(false);
    refetchHistory();
  };

  // Map type to form component
  const renderEditForm = () => {
    if (!editingItem) return null;

    // Map display type to form type
    const typeMap: Record<string, string> = {
      health: 'vitals',
      meds: 'medications',
    };
    const formType = typeMap[editingItem.type] || editingItem.type;

    switch (formType) {
      case 'vitals':
        return <VitalsForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'glucose':
        return <GlucoseForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'water':
        return <WaterForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'medications':
        return <MedicationForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'symptoms':
        return <SymptomForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'sleep':
        return <SleepForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'exercise':
        return <ExerciseForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'mood':
        return <MoodForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      case 'medical_notes':
        return <MedicalNotesForm onSuccess={handleEditSuccess} onCancel={handleCloseEdit} />;
      default:
        return (
          <div className="p-4 bg-muted/20 rounded-2xl text-center text-muted-foreground text-sm">
            แบบฟอร์มสำหรับประเภทนี้ยังไม่พร้อมใช้งาน
          </div>
        );
    }
  };

  // Get the drawer title based on type
  const getEditDrawerTitle = () => {
    if (!editingItem) return '';
    const typeLabels: Record<string, string> = {
      health: 'ความดัน/ชีพจร',
      vitals: 'ความดัน/ชีพจร',
      glucose: 'ระดับน้ำตาล',
      meds: 'ยา',
      medications: 'ยา',
      sleep: 'การนอน',
      water: 'การดื่มน้ำ',
      exercise: 'ออกกำลังกาย',
      symptoms: 'อาการ',
      mood: 'อารมณ์',
      medical_notes: 'โน้ต/บันทึกแพทย์',
    };
    return typeLabels[editingItem.type] || editingItem.title;
  };

  return (
    <div className="min-h-screen bg-background pb-32 font-sans relative z-10">
      {/* Header with date range selector */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full -ml-2"
              onClick={() => setLocation('/records')}
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">ประวัติการบันทึก</h1>
          </div>
          {/* Date Range Button */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 px-3 h-9"
            onClick={() => setShowDatePicker(!showDatePicker)}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">
              {dateRange === -1 ? 'กำหนดเอง' : DATE_RANGES.find(d => d.id === dateRange)?.shortLabel}
            </span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", showDatePicker && "rotate-180")} />
          </Button>
        </div>

        {/* Date Range Dropdown */}
        {showDatePicker && (
          <div className="mt-3 flex gap-2 flex-wrap animate-in slide-in-from-top-2 duration-200">
            {DATE_RANGES.map((range) => (
              <button
                key={range.id}
                onClick={() => {
                  if (range.id === -1) {
                    // Show custom date drawer
                    setShowCustomDateDrawer(true);
                    setShowDatePicker(false);
                  } else {
                    setDateRange(range.id);
                    setShowDatePicker(false);
                  }
                }}
                className={cn(
                  'flex-1 min-w-[70px] py-2 px-3 rounded-xl text-xs font-bold transition-all border',
                  dateRange === range.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        )}

        {/* Custom Date Range Display */}
        {dateRange === -1 && customStartDate && customEndDate && (
          <div className="mt-2 text-xs text-muted-foreground text-center">
            {new Date(customStartDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            {' - '}
            {new Date(customEndDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
              filter === 'all'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border'
            )}
          >
            ทั้งหมด
          </button>
          {[
            { id: 'symptoms', label: 'อาการ' },
            { id: 'health', label: 'ความดัน' },
            { id: 'glucose', label: 'ระดับน้ำตาล' },
            { id: 'meds', label: 'ยา' },
            { id: 'water', label: 'น้ำ' },
            { id: 'sleep', label: 'การนอน' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
                filter === f.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                  : 'bg-card text-muted-foreground border-border'
              )}
            >
              {f.label}
            </button>
          ))}
          {/* Tab ตัวอย่างข้อมูล - แสดง mock data */}
          <button
            onClick={() => setFilter('example')}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1',
              filter === 'example'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-card text-muted-foreground border-border'
            )}
          >
            <FileText className="w-3 h-3" />
            ตัวอย่าง
          </button>
        </div>

        {/* Loading State */}
        {isLoading && !isExampleTab && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          </div>
        )}

        {/* List */}
        {(!isLoading || isExampleTab) && (
          <div className="space-y-2">
            {filteredData.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-muted/50 rounded-xl p-3 cursor-pointer active:scale-[0.99] transition-transform group"
                onClick={() => !isExampleTab && deleteConfirmId !== item.id && setEditingItem(item)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      item.bg
                    )}
                  >
                    <item.icon className={cn('w-5 h-5', item.color)} />
                  </div>
                  {/* Content */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {item.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{item.title}</span>
                      <span className="text-sm font-bold text-foreground truncate">{item.detail}</span>
                    </div>
                  </div>
                </div>
                {/* Delete / Edit Indicator */}
                {!isExampleTab && (
                  deleteConfirmId === item.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRealItem(item);
                        }}
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ลบ'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(item.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  )
                )}
                {isExampleTab && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State - แยกตาม tab */}
        {filteredData.length === 0 && !isLoading && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-12 flex flex-col items-center text-center space-y-4">
              {isExampleTab ? (
                <>
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/30 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground">ข้อมูลตัวอย่าง</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                      นี่คือตัวอย่างข้อมูลที่จะแสดงเมื่อมีการบันทึกจริง
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <ClipboardList className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground">ยังไม่มีข้อมูล</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                      {filter === 'all'
                        ? 'เริ่มบันทึกสุขภาพประจำวันโดยพิมพ์คุยกับน้องอุ่นใน LINE Chat'
                        : 'ยังไม่มีประวัติการบันทึกในหมวดนี้'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => setFilter('example')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    ดูตัวอย่างข้อมูล
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Example tab banner */}
        {isExampleTab && filteredData.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              นี่คือข้อมูลตัวอย่าง ไม่ใช่ข้อมูลจริงจากการบันทึกของคุณ
            </p>
          </div>
        )}
      </main>

      {/* Edit Drawer */}
      <Drawer open={editingItem !== null} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="flex items-center justify-between px-6">
            <DrawerTitle className="text-xl font-bold">
              {getEditDrawerTitle()}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="px-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {success ? (
              <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 rounded-full flex items-center justify-center">
                  <Check className="w-10 h-10 stroke-[3px]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">อัปเดตเรียบร้อย!</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed px-8">
                    ข้อมูลของคุณถูกอัปเดตแล้ว
                  </p>
                </div>
              </div>
            ) : (
              renderEditForm()
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Custom Date Range Drawer */}
      <Drawer open={showCustomDateDrawer} onOpenChange={setShowCustomDateDrawer}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex items-center justify-between px-6">
            <DrawerTitle className="text-xl font-bold">กำหนดช่วงวันที่</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="px-6 pb-8 space-y-6">
            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">วันเริ่มต้น</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                max={customEndDate || new Date().toISOString().split('T')[0]}
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">วันสิ้นสุด</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                max={new Date().toISOString().split('T')[0]}
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">เลือกด่วน</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'สัปดาห์นี้', days: 7 },
                  { label: 'เดือนนี้', days: 30 },
                  { label: '3 เดือน', days: 90 },
                  { label: '6 เดือน', days: 180 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - preset.days);
                      setCustomStartDate(start.toISOString().split('T')[0]);
                      setCustomEndDate(end.toISOString().split('T')[0]);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply Button */}
            <Button
              className="w-full h-14 rounded-2xl font-bold text-lg"
              disabled={!customStartDate || !customEndDate}
              onClick={() => {
                setDateRange(-1);
                setShowCustomDateDrawer(false);
              }}
            >
              <Calendar className="w-5 h-5 mr-2" />
              ใช้ช่วงวันที่นี้
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <BottomNav />
    </div>
  );
}
