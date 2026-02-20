import {
  ArrowLeft,
  Lock,
  Check,
  Cookie,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function PrivacyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="bg-card pt-4 pb-1 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10 shrink-0"
          onClick={() => setLocation('/settings')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">ความเป็นส่วนตัว</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Section header */}
        <div className="space-y-2 pl-1">
          <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-widest">
            ข้อกำหนดและเงื่อนไข
          </h3>
        </div>

        {/* Privacy Policy */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">นโยบายความเป็นส่วนตัว</p>
                <p className="text-xs text-muted-foreground">Privacy Policy</p>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl text-xs text-muted-foreground leading-relaxed h-32 overflow-y-auto border border-muted">
              <h4 className="font-bold text-foreground mb-2">นโยบายความเป็นส่วนตัว (Privacy Policy)</h4>
              <p>1. การเก็บรวบรวมข้อมูล: เราเก็บข้อมูลสุขภาพของคุณเพื่อวัตถุประสงค์ในการประมวลผลและแสดงผลรายงานสุขภาพส่วนบุคคลเท่านั้น</p>
              <p className="mt-2">2. การเปิดเผยข้อมูล: เราจะไม่เปิดเผยข้อมูลของคุณต่อบุคคลภายนอกโดยไม่ได้รับความยินยอม เว้นแต่เป็นการปฏิบัติตามกฎหมาย</p>
              <p className="mt-2">3. ความปลอดภัย: ข้อมูลของคุณถูกเข้ารหัสและเก็บรักษาด้วยมาตรฐานความปลอดภัยสูงสุด</p>
              <p className="mt-2">4. สิทธิเจ้าของข้อมูล: คุณมีสิทธิในการขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลของคุณได้ตลอดเวลา</p>
            </div>

            <div className="flex items-start gap-3 px-1">
              <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-950/30 mt-0.5 shrink-0">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium leading-tight text-foreground">
                  ฉันยอมรับ <span className="text-accent underline cursor-pointer">นโยบายความเป็นส่วนตัว (Privacy Policy)</span>
                </p>
                <p className="text-[10px] text-muted-foreground">ยอมรับเมื่อลงทะเบียน</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cookie Policy */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Cookie className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">นโยบายคุกกี้</p>
                <p className="text-xs text-muted-foreground">Cookie Policy</p>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl text-xs text-muted-foreground leading-relaxed h-32 overflow-y-auto border border-muted">
              <h4 className="font-bold text-foreground mb-2">นโยบายคุกกี้ (Cookie Policy)</h4>
              <p>1. คุกกี้ที่จำเป็น: ช่วยให้แอปพลิเคชันทำงานได้ตามปกติ เช่น การจดจำสถานะการเข้าสู่ระบบ</p>
              <p className="mt-2">2. คุกกี้เพื่อการวิเคราะห์: ช่วยให้เราเข้าใจพฤติกรรมการใช้งานเพื่อปรับปรุงประสบการณ์ผู้ใช้ (ข้อมูลระบุตัวตนจะไม่ถูกเก็บ)</p>
              <p className="mt-2">3. การจัดการคุกกี้: คุณสามารถตั้งค่าเบราว์เซอร์เพื่อปฏิเสธคุกกี้ได้ แต่อาจส่งผลต่อการใช้งานบางฟีเจอร์</p>
            </div>

            <div className="flex items-start gap-3 px-1">
              <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-950/30 mt-0.5 shrink-0">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium leading-tight text-foreground">
                  ฉันยอมรับ <span className="text-accent underline cursor-pointer">นโยบายคุกกี้ (Cookie Policy)</span>
                </p>
                <p className="text-[10px] text-muted-foreground">ยอมรับเมื่อลงทะเบียน</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
