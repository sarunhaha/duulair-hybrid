import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useLiff, useLiffContext } from '@/lib/liff/provider';
import { useAuthStore } from '@/stores/auth';
import { registrationApi } from '@/lib/api/client';
import { Loader2, HeartPulse, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type CheckStatus = 'idle' | 'checking' | 'registered' | 'not-registered' | 'error';

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { isInitialized, isLoading, profile, error: liffError } = useLiff();
  const { isGroup, groupId } = useLiffContext();
  const { setUser, setContext, setIsRegistered } = useAuthStore();
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('กำลังเริ่มต้นระบบ...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkRegistration() {
      if (!isInitialized || isLoading || !profile?.userId) return;

      try {
        setStatus('checking');
        setStatusMessage('กำลังตรวจสอบข้อมูล...');

        // Set line user id to store
        setUser({ lineUserId: profile.userId });

        let result;

        if (isGroup && groupId) {
          // Check group registration
          setStatusMessage('ตรวจสอบการลงทะเบียนกลุ่ม...');
          result = await registrationApi.checkGroup(groupId);

          if (result.exists && result.group) {
            setContext({
              groupId,
              patientId: result.group.active_patient_id || null,
            });
            setIsRegistered(true);
            setStatus('registered');
            setStatusMessage('พบข้อมูล กำลังเปลี่ยนหน้า...');

            // Redirect to group dashboard
            setTimeout(() => {
              setLocation('/dashboard/group');
            }, 500);
            return;
          }
        } else {
          // Check user registration (1:1 chat)
          setStatusMessage('ตรวจสอบการลงทะเบียนผู้ใช้...');
          result = await registrationApi.checkUser(profile.userId);

          if (result.exists && result.profile) {
            setUser({
              role: result.role || null,
              profileId: result.profile.id,
              lineUserId: profile.userId,
            });
            setIsRegistered(true);
            setStatus('registered');
            setStatusMessage('พบข้อมูล กำลังเปลี่ยนหน้า...');

            // Save to localStorage for backwards compatibility
            const userData = {
              role: result.role,
              profile_id: result.profile.id,
              line_user_id: profile.userId,
            };
            localStorage.setItem('oonjai_user', JSON.stringify(userData));

            // Redirect to dashboard
            setTimeout(() => {
              setLocation('/dashboard');
            }, 500);
            return;
          }
        }

        // Not registered - redirect to registration
        setStatus('not-registered');
        setStatusMessage('ยังไม่ได้ลงทะเบียน กำลังเปลี่ยนหน้า...');

        setTimeout(() => {
          if (isGroup && groupId) {
            setLocation('/registration/group');
          } else {
            setLocation('/registration/quick');
          }
        }, 500);
      } catch (err) {
        console.error('Registration check failed:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตรวจสอบ');
      }
    }

    if (isInitialized && !isLoading && profile) {
      checkRegistration();
    }
  }, [
    isInitialized,
    isLoading,
    profile,
    isGroup,
    groupId,
    setLocation,
    setUser,
    setContext,
    setIsRegistered,
  ]);

  // LIFF error state
  if (liffError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm border-destructive/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">เกิดข้อผิดพลาด</h1>
            <p className="text-sm text-muted-foreground">
              ไม่สามารถเชื่อมต่อกับ LINE ได้
            </p>
            <p className="text-xs text-muted-foreground/70">{liffError.message}</p>
            <Button onClick={() => window.location.reload()} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              ลองอีกครั้ง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // API error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm border-destructive/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">เกิดข้อผิดพลาด</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              ลองอีกครั้ง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      {/* Welcome Card */}
      <Card className="w-full max-w-sm bg-gradient-to-br from-primary to-primary/80 text-white border-none shadow-lg overflow-hidden relative mb-6">
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
        <CardContent className="pt-8 pb-8 text-center relative z-10">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
            <HeartPulse className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-1">OONJAI</h1>
          <p className="text-white/90">ระบบดูแลสุขภาพผู้สูงอายุ</p>
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card className="w-full max-w-sm">
        <CardContent className="py-8 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
          {profile && (
            <p className="text-xs text-muted-foreground/70">สวัสดี, {profile.displayName}</p>
          )}
          {isGroup && (
            <p className="text-xs text-accent font-medium">Context: กลุ่ม LINE</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
