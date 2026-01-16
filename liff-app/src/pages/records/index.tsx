import { useState } from 'react';
import {
  Activity,
  Pill,
  Moon,
  Droplet,
  Dumbbell,
  Smile,
  Stethoscope,
  PlusCircle,
  ChevronRight,
  History,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { BottomNav } from '@/components/layout/bottom-nav';
import { VitalsForm, WaterForm, MedicationForm, SymptomForm, SleepForm } from '@/components/forms';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

type CategoryId = 'health' | 'meds' | 'sleep' | 'water' | 'exercise' | 'stress' | 'symptoms' | 'notes';

interface Category {
  id: CategoryId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  desc: string;
  hasForm: boolean;
}

const categories: Category[] = [
  {
    id: 'health',
    title: 'ความดัน/ชีพจร',
    icon: Activity,
    color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
    desc: 'ความดัน, ชีพจร, น้ำหนัก',
    hasForm: true,
  },
  {
    id: 'meds',
    title: 'ยา',
    icon: Pill,
    color: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
    desc: 'เช้า, กลางวัน, เย็น, ก่อนนอน',
    hasForm: true,
  },
  {
    id: 'sleep',
    title: 'การนอน',
    icon: Moon,
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400',
    desc: 'ชม.นอน, คุณภาพการหลับ',
    hasForm: true,
  },
  {
    id: 'water',
    title: 'การดื่มน้ำ',
    icon: Droplet,
    color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400',
    desc: 'จำนวนแก้วน้ำที่ดื่ม',
    hasForm: true,
  },
  {
    id: 'exercise',
    title: 'กิจกรรม/ออกกำลัง',
    icon: Dumbbell,
    color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
    desc: 'เดิน, วิ่ง, กายภาพ',
    hasForm: false,
  },
  {
    id: 'stress',
    title: 'ความเครียด',
    icon: Smile,
    color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-400',
    desc: 'ระดับความเครียด',
    hasForm: false,
  },
  {
    id: 'symptoms',
    title: 'อาการ',
    icon: Stethoscope,
    color: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    desc: 'ปวดหัว, เวียนหัว, มีไข้',
    hasForm: true,
  },
  {
    id: 'notes',
    title: 'โน้ต/รูปเอกสาร',
    icon: PlusCircle,
    color: 'bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400',
    desc: 'บันทึกสั้น, แนบรูป',
    hasForm: false,
  },
];

export default function RecordsPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [success, setSuccess] = useState(false);
  const [, setLocation] = useLocation();

  const handleOpenCategory = (id: CategoryId) => {
    setSelectedCategory(id);
    setSuccess(false);
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setSuccess(false);
  };

  const handleSuccess = () => {
    setSuccess(true);
    // Auto-close after showing success
    setTimeout(() => {
      handleClose();
    }, 2000);
  };

  const renderForm = () => {
    switch (selectedCategory) {
      case 'health':
        return <VitalsForm onSuccess={handleSuccess} onCancel={handleClose} />;
      case 'water':
        return <WaterForm onSuccess={handleSuccess} onCancel={handleClose} />;
      case 'meds':
        return <MedicationForm onSuccess={handleSuccess} onCancel={handleClose} />;
      case 'symptoms':
        return <SymptomForm onSuccess={handleSuccess} onCancel={handleClose} />;
      case 'sleep':
        return <SleepForm onSuccess={handleSuccess} onCancel={handleClose} />;
      default:
        return (
          <div className="space-y-6 pb-8">
            <p className="text-muted-foreground text-center py-8">
              ฟอร์มบันทึก {categories.find((c) => c.id === selectedCategory)?.title}
              <br />
              <span className="text-xs">(Coming soon)</span>
            </p>

            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
                onClick={handleClose}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20"
                onClick={handleSuccess}
              >
                บันทึกข้อมูล
              </Button>
            </div>
          </div>
        );
    }
  };

  const selectedCategoryData = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="min-h-screen pb-32 font-sans overflow-x-hidden relative z-10 bg-background">
      {/* Top Bar */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex justify-between items-center border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">บันทึก</h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-muted/30 hover:bg-muted/50 transition-colors"
          onClick={() => setLocation('/history')}
        >
          <History className="h-5 w-5 text-foreground" />
        </Button>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-8">
        {/* All Categories */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-widest pl-1">
            เลือกหมวดบันทึก
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {categories.map((cat) => (
              <Card
                key={cat.id}
                className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group active:scale-[0.98]"
                onClick={() => handleOpenCategory(cat.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110',
                      cat.color
                    )}
                  >
                    <cat.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground text-sm">{cat.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{cat.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Drawer Bottom Sheet */}
      <Drawer open={selectedCategory !== null} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="flex items-center justify-between px-6">
            <DrawerTitle className="text-xl font-bold">
              {selectedCategoryData?.title}
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
                  <h2 className="text-2xl font-bold text-foreground">บันทึกเรียบร้อย!</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed px-8">
                    ข้อมูลของคุณถูกเก็บเข้าสู่ระบบแล้ว อุ่นใจพร้อมดูแลคุณต่อ
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="w-full h-12 text-muted-foreground font-bold"
                  onClick={handleClose}
                >
                  บันทึกอย่างอื่นต่อ
                </Button>
              </div>
            ) : (
              renderForm()
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <BottomNav />
    </div>
  );
}
