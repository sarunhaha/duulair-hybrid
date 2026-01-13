import { useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard - Lightweight auth sync for LIFF feature pages
 *
 * Design: LIFF pages should load FAST
 * - NO blocking or registration walls
 * - User can choose: conversation with AI OR form input in LIFF
 * - Just sync auth data if available, then render children immediately
 * - Works for both registered and unregistered users
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const auth = useAuth();
  const { setUser, setContext, setIsRegistered } = useAuthStore();

  // Sync auth data to Zustand store when it changes (non-blocking)
  useEffect(() => {
    if (auth.profileId) {
      setUser({
        role: auth.role,
        profileId: auth.profileId,
        lineUserId: auth.lineUserId,
      });

      if (auth.patientId) {
        setContext({ patientId: auth.patientId });
      }

      if (auth.isRegistered) {
        setIsRegistered(true);

        // Save to localStorage for backwards compatibility
        const userData = {
          role: auth.role,
          profile_id: auth.profileId,
          line_user_id: auth.lineUserId,
        };
        localStorage.setItem('oonjai_user', JSON.stringify(userData));
      }
    }
  }, [auth.isRegistered, auth.profileId, auth.patientId, auth.role, auth.lineUserId, setUser, setContext, setIsRegistered]);

  // Minimal loading state - only show briefly while LIFF initializes
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Always render children - no blocking!
  // Users can access LIFF features whether registered or not
  return <>{children}</>;
}
