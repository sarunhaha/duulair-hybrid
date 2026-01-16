import { useState } from 'react';
import { Link } from 'wouter';
import {
  User,
  Pill,
  Bell,
  Heart,
  ShieldAlert,
  Lock,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  BarChart3,
  Star,
  Check,
  X,
  AlertTriangle,
  FileDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useLiff } from '@/lib/liff/provider';
import { useUIStore } from '@/stores/ui';
import { cn } from '@/lib/utils';

type UserStatus = 'free' | 'trial' | 'plus';

export default function SettingsPage() {
  const { profile, closeWindow } = useLiff();
  const { theme, toggleTheme } = useUIStore();

  const [viewPkg, setViewPkg] = useState<'free' | 'plus'>('free');
  const [userStatus, setUserStatus] = useState<UserStatus>('free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleStartTrial = () => {
    if (acceptedTerms) {
      setUserStatus('trial');
      setShowUpgradeModal(false);
      setViewPkg('plus');
    }
  };

  const sections = [
    {
      id: 'A',
      title: 'ยาและการเตือน',
      items: [
        { id: 'A1', title: 'ยาของฉัน', icon: Pill, description: 'ชื่อยา, เวลา, ยาหมด', href: '/settings/medications' },
        { id: 'A2', title: 'เตือนกิจกรรมสุขภาพ', icon: Bell, description: 'ความดัน, น้ำดื่ม, เดิน', href: '/settings/reminders' },
      ],
    },
    {
      id: 'A2',
      title: 'บันทึกประจำวัน',
      items: [
        { id: 'A2-1', title: 'บันทึกการนอน', icon: Moon, description: 'ชั่วโมงนอน, คุณภาพการนอน', href: '/health/sleep' },
      ],
    },
    {
      id: 'B',
      title: 'ข้อมูลสุขภาพส่วนตัว',
      items: [
        { id: 'B1', title: 'ข้อมูลพื้นฐาน', icon: User, description: 'อายุ, ส่วนสูง, น้ำหนัก', href: '/profile' },
        { id: 'B2', title: 'โรคประจำตัวและประวัติ', icon: Heart, description: 'โรคประจำตัว, ประวัติรักษา', href: '/profile' },
        { id: 'B3', title: 'การแพ้', icon: ShieldAlert, description: 'แพ้ยา, แพ้อาหาร', href: '/profile' },
      ],
    },
    {
      id: 'C',
      title: 'ฉุกเฉินและความปลอดภัย',
      items: [
        { id: 'C1', title: 'ผู้ติดต่อฉุกเฉิน', icon: AlertTriangle, description: 'เพิ่ม/แก้ไข ผู้ติดต่อหลัก' },
      ],
    },
    {
      id: 'D',
      title: 'ข้อมูลและความเป็นส่วนตัว',
      items: [
        { id: 'D1', title: 'รายงานสุขภาพ', icon: BarChart3, description: 'สรุปภาพรวม, กราฟ, ส่งออก', href: '/reports' },
        { id: 'D2', title: 'ความเป็นส่วนตัว', icon: Lock, description: 'การบันทึกข้อมูล, สิทธิ์การเข้าถึง' },
        { id: 'D3', title: 'ส่งออกข้อมูล', icon: FileDown, description: 'CSV เท่านั้น' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-32 font-sans">
      {/* Top Bar */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex justify-between items-center border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">ตั้งค่า</h1>
        <Button variant="ghost" size="sm" className="text-accent font-bold h-auto p-0">
          ช่วยเหลือ
        </Button>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Mini Profile Card */}
        <Card className="border-none shadow-sm bg-card overflow-hidden relative">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent overflow-hidden">
              {profile?.pictureUrl ? (
                <img
                  src={profile.pictureUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {profile?.displayName || 'ผู้ใช้งาน'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {profile?.statusMessage || 'OONJAI Member'}
              </p>
              <Link href="/profile/edit">
                <Button variant="link" className="p-0 h-auto text-xs text-accent font-bold hover:no-underline mt-1">
                  แก้ไขโปรไฟล์
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Dark Mode Toggle */}
        <Card className="border-none shadow-sm bg-card overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-muted/20 p-2 rounded-xl text-muted-foreground">
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">โหมดมืด</p>
                <p className="text-[11px] text-muted-foreground">
                  {theme === 'dark' ? 'เปิดอยู่' : theme === 'light' ? 'ปิดอยู่' : 'ตามระบบ'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme} className="rounded-xl">
              สลับ
            </Button>
          </CardContent>
        </Card>

        {/* Settings Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-widest pl-2">
                {section.title}
              </h3>
              <div className="bg-card rounded-3xl shadow-sm overflow-hidden divide-y divide-border/30">
                {section.items.map((item) => {
                  const ItemContent = (
                    <>
                      <div className="bg-muted/20 p-2 rounded-xl text-muted-foreground group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform" />
                    </>
                  );

                  if ('href' in item && item.href) {
                    return (
                      <Link key={item.id} href={item.href}>
                        <a className="w-full flex items-center gap-4 p-4 hover:bg-muted/10 active:bg-muted/20 transition-colors text-left group">
                          {ItemContent}
                        </a>
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      className="w-full flex items-center gap-4 p-4 hover:bg-muted/10 active:bg-muted/20 transition-colors text-left group"
                    >
                      {ItemContent}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Package Section - Inline */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-widest pl-2">
              แพ็กเกจของคุณ
            </h3>
            <div
              className={cn(
                'rounded-3xl shadow-sm p-5 border space-y-4 transition-all',
                userStatus === 'free'
                  ? 'bg-card border-border'
                  : userStatus === 'trial'
                    ? 'bg-gradient-to-br from-orange-50 dark:from-orange-950/20 to-card border-orange-200 dark:border-orange-900/30'
                    : 'bg-gradient-to-br from-primary/5 to-card border-primary/20'
              )}
            >
              {/* Toggle Header */}
              <div className="flex bg-muted/30 p-1 rounded-xl">
                <button
                  onClick={() => setViewPkg('free')}
                  className={cn(
                    'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                    viewPkg === 'free' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                  )}
                >
                  Free Package
                </button>
                <button
                  onClick={() => setViewPkg('plus')}
                  className={cn(
                    'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 relative',
                    viewPkg === 'plus' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  <Star className="w-3 h-3 fill-current" /> Plus Package
                  {userStatus === 'free' && (
                    <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full animate-bounce">
                      FREE TRIAL
                    </span>
                  )}
                </button>
              </div>

              {/* Content based on viewPkg */}
              <div className="min-h-[200px]">
                {viewPkg === 'free' ? (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-center py-2">
                      <p className="text-lg font-bold text-foreground">สมาชิกทั่วไป</p>
                      <p className="text-xs text-muted-foreground">บันทึกพื้นฐาน + เช็คอินตอนเช้า</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="bg-muted rounded-full p-1 mt-0.5">
                          <Check className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-foreground/70">
                          บันทึกข้อมูลย้อนหลังได้ <span className="font-bold">30 วัน</span>
                        </p>
                      </div>
                      <div className="flex items-start gap-3 opacity-50">
                        <div className="bg-muted rounded-full p-1 mt-0.5">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-foreground/70">แนบรูป/เอกสารไม่ได้</p>
                      </div>
                      <div className="flex items-start gap-3 opacity-50">
                        <div className="bg-muted rounded-full p-1 mt-0.5">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-foreground/70">สร้างรายงาน PDF ไม่ได้</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="bg-muted rounded-full p-1 mt-0.5">
                          <Check className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-foreground/70">เตือนวันละ 1 ครั้ง (Daily Check-in)</p>
                      </div>
                    </div>

                    {userStatus === 'free' && (
                      <Button
                        onClick={() => setViewPkg('plus')}
                        variant="outline"
                        className="w-full h-10 rounded-xl text-primary font-bold border-primary/20 hover:bg-primary/5"
                      >
                        ดูสิทธิประโยชน์ Plus
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-center py-2">
                      <p className="text-lg font-bold text-primary flex items-center justify-center gap-1">
                        Oonjai Plus <Star className="w-4 h-4 fill-orange-400 text-orange-400" />
                      </p>
                      <p className="text-xs text-muted-foreground">ผู้ช่วยสุขภาพ Real-time + รายงาน + แนบไฟล์</p>
                    </div>

                    <div className="bg-primary/5 rounded-xl p-4 space-y-3 border border-primary/10">
                      <div className="flex items-start gap-3">
                        <div className="bg-green-100 dark:bg-green-950/30 rounded-full p-1 mt-0.5">
                          <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-xs text-foreground font-medium">เก็บข้อมูลไม่จำกัด (ตั้งแต่เริ่มสมัคร)</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="bg-green-100 dark:bg-green-950/30 rounded-full p-1 mt-0.5">
                          <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-xs text-foreground font-medium">แนบรูปถ่ายและเอกสารได้</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="bg-green-100 dark:bg-green-950/30 rounded-full p-1 mt-0.5">
                          <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-xs text-foreground font-medium">สร้างรายงาน PDF ส่งหมอได้</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="bg-green-100 dark:bg-green-950/30 rounded-full p-1 mt-0.5">
                          <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-xs text-foreground font-medium">เตือน Real-time ตามเหตุการณ์</p>
                      </div>
                    </div>

                    {/* Action Buttons based on User Status */}
                    {userStatus === 'free' && (
                      <div className="space-y-2 pt-2">
                        <Button
                          onClick={() => setShowUpgradeModal(true)}
                          className="w-full bg-[#635BFF] hover:bg-[#5851E3] text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        >
                          อัปเกรดเป็น Plus
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground">
                          ทดลองใช้ฟรี 15 วัน • ยกเลิกได้ตลอด
                        </p>
                      </div>
                    )}

                    {userStatus === 'trial' && (
                      <div className="space-y-3 pt-2">
                        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/30 rounded-lg p-3 text-center">
                          <p className="text-xs font-bold text-orange-700 dark:text-orange-400">
                            กำลังทดลองใช้ฟรี (เหลือ 15 วัน)
                          </p>
                          <p className="text-[10px] text-orange-600 dark:text-orange-500">
                            ตัดรอบบิลแรก: 21 ม.ค. 2026
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="h-10 text-xs rounded-xl border-muted">
                            ยกเลิกก่อนชำระ
                          </Button>
                          <Button className="h-10 text-xs rounded-xl bg-foreground text-background">
                            จัดการการสมัคร
                          </Button>
                        </div>
                      </div>
                    )}

                    {userStatus === 'plus' && (
                      <div className="space-y-3 pt-2">
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/30 rounded-lg p-3 text-center">
                          <p className="text-xs font-bold text-green-700 dark:text-green-400">
                            สมาชิก Plus (รายเดือน)
                          </p>
                          <p className="text-[10px] text-green-600 dark:text-green-500">
                            ต่ออายุอัตโนมัติ: 21 ก.พ. 2026
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <Button className="h-10 text-xs rounded-xl bg-foreground text-background w-full">
                            จัดการการสมัครสมาชิก
                          </Button>
                          <Button variant="ghost" className="h-8 text-[10px] text-muted-foreground w-full">
                            เปลี่ยนวิธีชำระเงิน
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground h-8 hover:bg-muted/30 -mt-2"
                onClick={() => setShowComparison(true)}
              >
                ดูตารางเปรียบเทียบทั้งหมด
              </Button>
            </div>
          </div>

          {/* Logout */}
          <div className="space-y-3">
            <div className="bg-card rounded-3xl shadow-sm overflow-hidden">
              <button
                onClick={closeWindow}
                className="w-full flex items-center gap-4 p-4 hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 dark:active:bg-red-950/30 transition-colors text-left group"
              >
                <div className="bg-red-100 dark:bg-red-950/30 p-2 rounded-xl text-red-500">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-500">ออกจากระบบ</p>
                </div>
                <ChevronRight className="w-4 h-4 text-red-500/30" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Paywall Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-[360px] rounded-3xl p-0 overflow-hidden gap-0">
          <div className="bg-gradient-to-br from-primary/10 to-card p-6 pb-4 pt-8 text-center relative">
            <div className="absolute top-4 right-4">
              <div className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                Free 15 Days
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-card shadow-sm flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-primary fill-current" />
            </div>
            <DialogTitle className="text-xl font-bold text-primary mb-1">สมัคร Plus รายเดือน</DialogTitle>
            <DialogDescription className="text-xs">ทดลองใช้ฟรี 15 วัน • ยกเลิกได้ตลอด</DialogDescription>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-3">
              {[
                'เตือนแบบ Real-time ตามเหตุการณ์',
                'ส่งออก PDF รายงานผลสุขภาพ',
                'แนบรูปถ่ายและเอกสารการรักษา',
                'เก็บประวัติย้อนหลังตั้งแต่เริ่มสมัคร',
                'ได้ฟีเจอร์ใหม่ในอนาคตก่อนใคร',
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="min-w-[20px] h-5 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-xs font-medium text-foreground">{benefit}</p>
                </div>
              ))}
            </div>

            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-bold">รายเดือน (Auto)</p>
                <p className="text-lg font-bold text-primary">
                  ฿59<span className="text-xs text-muted-foreground font-normal">/ด.</span>
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(c as boolean)}
                  className="w-4 h-4 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <label
                  htmlFor="terms"
                  className="text-[10px] text-muted-foreground leading-tight cursor-pointer select-none"
                >
                  ฉันยอมรับการ<span className="font-bold text-foreground">ตัดเงินอัตโนมัติรายเดือน</span>{' '}
                  และสามารถยกเลิกได้ตลอดเวลา
                </label>
              </div>
            </div>

            <Button
              onClick={handleStartTrial}
              disabled={!acceptedTerms}
              className="w-full bg-[#635BFF] hover:bg-[#5851E3] text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              เริ่มทดลองใช้ฟรี 15 วัน
            </Button>

            <p className="text-[9px] text-center text-muted-foreground">
              จะไม่ถูกเรียกเก็บเงินจนกว่าจะครบกำหนดทดลองในวันที่ 21 ม.ค. 2026
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comparison Drawer */}
      <Drawer open={showComparison} onOpenChange={setShowComparison}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center text-xl font-bold">เปรียบเทียบแพ็กเกจ</DrawerTitle>
            <DrawerDescription className="text-center text-xs">เลือกสิ่งที่เหมาะกับสุขภาพของคุณ</DrawerDescription>
          </DrawerHeader>

          <div className="p-4 overflow-y-auto pb-8">
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-3 bg-muted/30 p-3 text-xs font-bold border-b border-border">
                <div className="text-muted-foreground">ฟีเจอร์</div>
                <div className="text-center text-foreground">Free</div>
                <div className="text-center text-primary">Plus</div>
              </div>

              {/* Rows */}
              {[
                { name: 'บันทึกข้อมูลย้อนหลัง', free: '30 วัน', plus: 'ไม่จำกัด' },
                { name: 'แนบรูป/เอกสาร', free: false, plus: true },
                { name: 'รายงาน PDF', free: false, plus: true },
                { name: 'ระบบแจ้งเตือน', free: '1 ครั้ง/วัน', plus: 'Real-time' },
                { name: 'ส่งออก CSV', free: true, plus: true },
                { name: 'ฟีเจอร์อนาคต', free: 'พื้นฐาน', plus: 'ทั้งหมด' },
              ].map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 p-3 text-xs border-b border-border last:border-0 items-center"
                >
                  <div className="font-medium text-foreground">{row.name}</div>
                  <div className="text-center flex justify-center text-muted-foreground">
                    {typeof row.free === 'boolean' ? (
                      row.free ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/30" />
                      )
                    ) : (
                      row.free
                    )}
                  </div>
                  <div className="text-center flex justify-center text-primary font-bold">
                    {typeof row.plus === 'boolean' ? (
                      row.plus ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/30" />
                      )
                    ) : (
                      row.plus
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Button onClick={() => setShowComparison(false)} variant="outline" className="w-full h-12 rounded-xl font-bold">
                ปิดหน้าต่าง
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <BottomNav />
    </div>
  );
}
