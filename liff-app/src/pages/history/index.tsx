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
  Clock,
  Camera,
  Droplet,
  Check,
  X,
  FileText,
  ClipboardList,
  Loader2,
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
import { useHealthHistory } from '@/lib/api/hooks/use-health';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

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
};

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState('all');
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch real data
  const { patientId, isLoading: authLoading } = useEnsurePatient();
  const { data: healthHistory, isLoading: historyLoading } = useHealthHistory(patientId);

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
  const realHistoryData: HistoryItem[] = (healthHistory || []).map((item, index) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.health;
    const typeMapping: Record<string, string> = {
      vitals: 'health',
      medications: 'meds',
    };
    return {
      id: index + 1,
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

  const handleSave = () => {
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setEditingItem(null);
    }, 1500);
  };

  const handleCloseEdit = () => {
    setEditingItem(null);
    setSuccess(false);
  };

  return (
    <div className="min-h-screen bg-background pb-8 font-sans relative z-10">
      {/* Header - ไม่มี calendar icon เพราะ user อาจสับสนว่ากดได้ */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full -ml-2"
          onClick={() => setLocation('/records')}
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">ประวัติการบันทึก</h1>
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
                className="flex items-center justify-between bg-muted/50 rounded-xl p-3 cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => setEditingItem(item)}
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
              แก้ไข: {editingItem?.title}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="px-6 pb-8 overflow-y-auto max-h-[calc(90vh-80px)]">
            {success ? (
              <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 rounded-full flex items-center justify-center">
                  <Check className="w-10 h-10 stroke-[3px]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">แก้ไขเรียบร้อย!</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed px-8">
                    ข้อมูลของคุณถูกอัปเดตแล้ว
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Time Selection */}
                <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-3xl">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm font-bold">เวลาที่บันทึก</span>
                    <Button
                      variant="ghost"
                      className="text-foreground font-bold text-sm bg-card shadow-sm rounded-xl px-4 h-9"
                    >
                      {editingItem?.time}
                    </Button>
                  </div>
                </div>

                {/* Dynamic Form Content based on Type */}
                {editingItem?.type === 'symptoms' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">
                        อาการ
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button className="px-5 py-2.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-bold transition-all">
                          ปวดหัว
                        </button>
                        <button className="px-5 py-2.5 rounded-2xl bg-card border-2 border-border hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-bold transition-all">
                          เวียนหัว
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end pl-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          ระดับความรุนแรง
                        </label>
                        <span className="text-lg font-bold text-red-500">ระดับ 3</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        defaultValue="3"
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-red-500"
                      />
                    </div>
                  </div>
                )}

                {editingItem?.type === 'health' && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-center gap-4 py-4">
                      <div className="text-center space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          SYS
                        </p>
                        <div className="bg-card border-2 border-border rounded-[32px] w-24 h-24 flex items-center justify-center text-4xl font-bold shadow-sm text-foreground">
                          128
                        </div>
                      </div>
                      <span className="text-2xl text-muted-foreground pt-6">/</span>
                      <div className="text-center space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          DIA
                        </p>
                        <div className="bg-card border-2 border-border rounded-[32px] w-24 h-24 flex items-center justify-center text-4xl font-bold shadow-sm text-foreground">
                          82
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback for other types */}
                {editingItem && !['symptoms', 'health'].includes(editingItem.type) && (
                  <div className="p-4 bg-muted/20 rounded-2xl text-center text-muted-foreground text-sm">
                    แบบฟอร์มแก้ไขสำหรับประเภทนี้ยังไม่พร้อมใช้งาน
                  </div>
                )}

                {/* Shared: Notes & Photo */}
                <div className="space-y-4 pt-4">
                  <div className="bg-muted/20 rounded-3xl p-4 flex gap-4">
                    <Camera className="w-5 h-5 text-muted-foreground mt-1" />
                    <textarea
                      className="flex-1 bg-transparent border-none resize-none text-sm focus:outline-none min-h-[60px] text-foreground"
                      placeholder="เพิ่มโน้ตสั้นๆ หรือแนบรูปภาพ..."
                      defaultValue={editingItem?.detail}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="ghost"
                    className="flex-1 h-14 rounded-2xl font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    ลบรายการ
                  </Button>
                  <Button
                    className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20"
                    onClick={handleSave}
                  >
                    บันทึกการแก้ไข
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
