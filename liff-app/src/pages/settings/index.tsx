import { Link } from 'wouter';
import { User, Pill, Bell, Heart, ShieldAlert, Lock, LogOut, ChevronRight, Moon, Sun, BarChart3, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useLiff } from '@/lib/liff/provider';
import { useUIStore } from '@/stores/ui';

export default function SettingsPage() {
  const { profile, closeWindow } = useLiff();
  const { theme, toggleTheme } = useUIStore();

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
      title: 'แพ็กเกจและการสมัคร',
      items: [
        { id: 'C1', title: 'แพ็กเกจของฉัน', icon: Crown, description: 'Free - อัปเกรดเพื่อฟีเจอร์เพิ่ม', href: '/settings/package' },
      ],
    },
    {
      id: 'D',
      title: 'ข้อมูลและความเป็นส่วนตัว',
      items: [
        { id: 'D1', title: 'รายงานสุขภาพ', icon: BarChart3, description: 'สรุปภาพรวม, กราฟ, ส่งออก', href: '/reports' },
        { id: 'D2', title: 'ความเป็นส่วนตัว', icon: Lock, description: 'การบันทึกข้อมูล, สิทธิ์การเข้าถึง' },
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

      <BottomNav />
    </div>
  );
}
