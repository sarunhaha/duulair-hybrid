import { useLocation } from 'wouter';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-8xl font-black text-muted-foreground/20">404</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">ไม่พบหน้านี้</h1>
          <p className="text-sm text-muted-foreground">
            หน้าที่คุณกำลังหาไม่มีอยู่หรืออาจถูกย้ายไปแล้ว
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={() => setLocation('/dashboard')}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold"
          >
            <Home className="w-4 h-4 mr-2" />
            กลับหน้าหลัก
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="w-full h-12 rounded-xl text-muted-foreground font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ย้อนกลับ
          </Button>
        </div>
      </div>
    </div>
  );
}
