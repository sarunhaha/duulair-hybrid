import { useEffect, type ReactNode } from 'react';
import { Loader2, AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';
import { useLiff } from '@/lib/liff/provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard - Lightweight auth guard for LIFF feature pages
 *
 * Design: LIFF pages should load FAST
 * - No heavy redirects or registration flows
 * - If not registered, show simple message to chat with น้องอุ่น
 * - Registration/onboarding happens in LINE Chat, not LIFF
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const auth = useAuth();
  const { setUser, setContext, setIsRegistered } = useAuthStore();
  const { isInClient, closeWindow } = useLiff();

  // Sync auth data to Zustand store when it changes
  useEffect(() => {
    if (auth.isRegistered && auth.profileId) {
      setUser({
        role: auth.role,
        profileId: auth.profileId,
        lineUserId: auth.lineUserId,
      });

      if (auth.patientId) {
        setContext({ patientId: auth.patientId });
      }

      setIsRegistered(true);

      // Save to localStorage for backwards compatibility
      const userData = {
        role: auth.role,
        profile_id: auth.profileId,
        line_user_id: auth.lineUserId,
      };
      localStorage.setItem('oonjai_user', JSON.stringify(userData));
    }
  }, [auth.isRegistered, auth.profileId, auth.patientId, auth.role, auth.lineUserId, setUser, setContext, setIsRegistered]);

  // Loading state - minimal
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (auth.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm border-destructive/20">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-lg font-bold">เกิดข้อผิดพลาด</h1>
            <p className="text-sm text-muted-foreground">{auth.error}</p>
            <Button onClick={() => window.location.reload()} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              ลองอีกครั้ง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not registered - show simple message to go chat (no redirect, no heavy UI)
  if (!auth.isRegistered) {
    const handleGoToChat = () => {
      if (isInClient) {
        closeWindow();
      } else {
        window.location.href = 'https://lin.ee/oonjai';
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <MessageCircle className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-lg font-bold">ลงทะเบียนก่อนนะคะ</h1>
            <p className="text-sm text-muted-foreground">
              พิมพ์ "สวัสดี" คุยกับน้องอุ่นใน LINE Chat เพื่อเริ่มต้นใช้งาน
            </p>
            <Button onClick={handleGoToChat} className="w-full gap-2">
              <MessageCircle className="w-4 h-4" />
              ไปที่ LINE Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated and registered - render children immediately
  return <>{children}</>;
}
