import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useLiff } from '@/lib/liff/provider';
import { useAuthStore } from '@/stores/auth';
import { registrationApi } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard - Ensures user is authenticated before rendering children
 *
 * This component:
 * 1. Waits for LIFF to initialize
 * 2. Checks if patientId exists in auth store
 * 3. If not, fetches from API using lineUserId
 * 4. Sets auth state and renders children
 * 5. Redirects to registration if user not found
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [, navigate] = useLocation();
  const { isInitialized, isLoading: liffLoading, profile, error: liffError } = useLiff();
  const { user, context, setUser, setContext, setIsRegistered } = useAuthStore();

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  // Check if we have patientId from any source
  const hasPatientId = !!(
    context.patientId ||
    (user.role === 'patient' && user.profileId)
  );

  useEffect(() => {
    async function checkAuth() {
      // Wait for LIFF to be ready
      if (!isInitialized || liffLoading) {
        return;
      }

      // LIFF error
      if (liffError) {
        setStatus('error');
        setError('ไม่สามารถเชื่อมต่อกับ LINE ได้');
        return;
      }

      // No profile from LIFF
      if (!profile?.userId) {
        setStatus('error');
        setError('ไม่พบข้อมูลผู้ใช้ LINE');
        return;
      }

      // Already have patientId - we're good
      if (hasPatientId) {
        console.log('[AuthGuard] Already have patientId, authenticated');
        setStatus('authenticated');
        return;
      }

      // Need to fetch from API
      console.log('[AuthGuard] No patientId, fetching from API...');

      try {
        const result = await registrationApi.checkUser(profile.userId);
        console.log('[AuthGuard] API response:', result);

        if (result.exists && result.profile) {
          // User is registered - set auth state
          setUser({
            role: result.role || null,
            profileId: result.profile.id,
            lineUserId: profile.userId,
          });

          // Set patientId in context
          if (result.role === 'patient') {
            setContext({ patientId: result.profile.id });
          }

          // Also save to localStorage for backwards compatibility
          const userData = {
            role: result.role,
            profile_id: result.profile.id,
            line_user_id: profile.userId,
          };
          localStorage.setItem('oonjai_user', JSON.stringify(userData));

          setIsRegistered(true);
          setStatus('authenticated');
          console.log('[AuthGuard] Auth state set, patientId:', result.profile.id);
        } else {
          // User not registered - redirect to registration
          console.log('[AuthGuard] User not registered');
          setStatus('unauthenticated');
          navigate('/registration/quick');
        }
      } catch (err) {
        console.error('[AuthGuard] API error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    }

    checkAuth();
  }, [isInitialized, liffLoading, liffError, profile, hasPatientId, setUser, setContext, setIsRegistered, navigate]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
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

  // Unauthenticated - already redirected
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">กำลังนำไปหน้าลงทะเบียน...</p>
        </div>
      </div>
    );
  }

  // Authenticated - render children
  return <>{children}</>;
}
