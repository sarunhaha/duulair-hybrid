import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Link2, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';

export default function EnterCodePage() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const caregiverId = user.role === 'caregiver' ? user.profileId : null;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const linkMutation = useMutation({
    mutationFn: async (linkCode: string) => {
      if (!caregiverId) throw new Error('ไม่พบข้อมูลผู้ดูแล');
      // Backend endpoint: POST /api/registration/link-patient
      return apiClient.post('/registration/link-patient', {
        link_code: linkCode,
        caregiver_id: caregiverId,
        relationship: 'family', // Default relationship
      });
    },
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    },
    onError: (err: Error) => {
      setError(err.message || 'รหัสไม่ถูกต้องหรือหมดอายุ');
      setSuccess(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length !== 6) {
      setError('กรุณากรอกรหัส 6 หลัก');
      return;
    }
    setError(null);
    linkMutation.mutate(cleanCode);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setCode(value);
      setError(null);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="border-none shadow-lg max-w-sm w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">เชื่อมต่อสำเร็จ!</h2>
            <p className="text-sm text-muted-foreground">
              คุณได้เชื่อมต่อกับสมาชิกเรียบร้อยแล้ว กำลังนำไปหน้าหลัก...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8 font-sans">
      {/* Header */}
      <header className="bg-card pt-4 pb-1 px-4 sticky top-0 z-20 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">เชื่อมต่อกับสมาชิก</h1>
            <p className="text-xs text-muted-foreground">กรอกรหัสที่ได้รับจากสมาชิก</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Enter Code Card */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent" />
              กรอกรหัสเชื่อมต่อ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="ABC123"
                  className="text-center text-3xl font-mono tracking-[0.3em] h-16 rounded-2xl uppercase"
                  maxLength={6}
                  autoComplete="off"
                  autoFocus
                />
                {code.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {code.length}/6
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-2xl"
                disabled={code.length !== 6 || linkMutation.isPending}
              >
                {linkMutation.isPending ? (
                  'กำลังเชื่อมต่อ...'
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    เชื่อมต่อ
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">ขอรหัสได้อย่างไร?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                1
              </div>
              <p className="text-sm text-muted-foreground">
                ให้สมาชิกเปิดแอป OONJAI
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                2
              </div>
              <p className="text-sm text-muted-foreground">
                ไปที่ &quot;โปรไฟล์&quot; → &quot;เชื่อมต่อผู้ดูแล&quot;
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                3
              </div>
              <p className="text-sm text-muted-foreground">
                คัดลอกหรือแชร์รหัส 6 หลักมาให้คุณ
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Why Link */}
        <Card className="border-none shadow-sm bg-accent/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-foreground mb-2">ทำไมต้องเชื่อมต่อ?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• ดูข้อมูลสุขภาพของสมาชิกได้แบบเรียลไทม์</li>
              <li>• รับแจ้งเตือนเมื่อมีความผิดปกติ</li>
              <li>• ช่วยเตือนการกินยาและนัดพบแพทย์</li>
              <li>• ติดตามดูแลได้ทุกที่ทุกเวลา</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
