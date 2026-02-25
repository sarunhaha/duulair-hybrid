import { useEffect, useRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
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
 * - Auto-creates patient profile if user doesn't have one yet
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const auth = useAuth();
  const ensurePatient = useEnsurePatient();
  const { setUser, setContext, setIsRegistered } = useAuthStore();
  const hasTriggeredEnsure = useRef(false);

  // Auto-ensure patient profile exists when user is authenticated but has no patientId
  useEffect(() => {
    if (
      !auth.isLoading &&
      auth.isAuthenticated &&
      !auth.patientId &&
      !ensurePatient.patientId &&
      !ensurePatient.isLoading &&
      !hasTriggeredEnsure.current
    ) {
      hasTriggeredEnsure.current = true;
      ensurePatient.ensurePatient();
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.patientId, ensurePatient]);

  // Use patientId from ensurePatient (includes auto-created)
  const resolvedPatientId = ensurePatient.patientId;

  // Sync auth data to Zustand store when it changes (non-blocking)
  useEffect(() => {
    const profileId = auth.profileId || resolvedPatientId;
    if (profileId) {
      setUser({
        role: auth.role,
        profileId,
        lineUserId: auth.lineUserId,
      });

      if (resolvedPatientId) {
        setContext({ patientId: resolvedPatientId });
      }

      if (auth.isRegistered) {
        setIsRegistered(true);

        // Save to localStorage for backwards compatibility
        const userData = {
          role: auth.role,
          profile_id: profileId,
          line_user_id: auth.lineUserId,
        };
        localStorage.setItem('oonjai_user', JSON.stringify(userData));
      }
    }
  }, [auth.isRegistered, auth.profileId, resolvedPatientId, auth.role, auth.lineUserId, setUser, setContext, setIsRegistered]);

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
