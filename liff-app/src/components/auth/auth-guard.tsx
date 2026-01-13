import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard - Simplified auth guard using useAuth hook
 *
 * This component:
 * 1. Uses useAuth hook which handles LIFF + API checks
 * 2. Shows loading while checking
 * 3. Redirects to registration if not registered
 * 4. Syncs auth state to Zustand store for backwards compatibility
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { setUser, setContext, setIsRegistered } = useAuthStore();

  // Sync auth data to Zustand store when it changes
  useEffect(() => {
    if (auth.isRegistered && auth.profileId) {
      console.log('[AuthGuard] Syncing to Zustand:', {
        role: auth.role,
        profileId: auth.profileId,
        patientId: auth.patientId,
      });

      setUser({
        role: auth.role,
        profileId: auth.profileId,
        lineUserId: auth.lineUserId,
      });

      if (auth.patientId) {
        setContext({ patientId: auth.patientId });
      }

      setIsRegistered(true);

      // Also save to localStorage for backwards compatibility
      const userData = {
        role: auth.role,
        profile_id: auth.profileId,
        line_user_id: auth.lineUserId,
      };
      localStorage.setItem('oonjai_user', JSON.stringify(userData));
    }
  }, [auth.isRegistered, auth.profileId, auth.patientId, auth.role, auth.lineUserId, setUser, setContext, setIsRegistered]);

  // Redirect to registration if authenticated but not registered
  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated && !auth.isRegistered && !auth.error) {
      console.log('[AuthGuard] Not registered, redirecting to registration');
      navigate('/registration/quick');
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.isRegistered, auth.error, navigate]);

  // Loading state - keep it simple and fast
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">กำลังตรวจสอบ...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (auth.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm border-destructive/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">เกิดข้อผิดพลาด</h1>
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

  // Not registered - show redirect message (will redirect via useEffect)
  if (!auth.isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">กำลังนำไปหน้าลงทะเบียน...</p>
        </div>
      </div>
    );
  }

  // Authenticated and registered - render children
  return <>{children}</>;
}
