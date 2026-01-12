import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';

/**
 * Hook to get patientId with multiple fallback sources
 *
 * Priority:
 * 1. context.patientId (set for group context or caregiver viewing patient)
 * 2. user.profileId (if user.role is 'patient')
 * 3. localStorage 'oonjai_user' (backwards compatibility)
 * 4. localStorage 'oonjai_auth' (Zustand persisted state)
 */
export function usePatientId(): { patientId: string | null; source: string } {
  const { context, user } = useAuthStore();

  return useMemo(() => {
    // Debug log
    console.log('[usePatientId] Auth state:', {
      'context.patientId': context.patientId,
      'user.role': user.role,
      'user.profileId': user.profileId,
    });

    // Source 1: context.patientId
    if (context.patientId) {
      console.log('[usePatientId] Using context.patientId:', context.patientId);
      return { patientId: context.patientId, source: 'context' };
    }

    // Source 2: user.profileId for patient role
    if (user.role === 'patient' && user.profileId) {
      console.log('[usePatientId] Using user.profileId:', user.profileId);
      return { patientId: user.profileId, source: 'user.profileId' };
    }

    // Source 3: localStorage 'oonjai_user' (set by index.tsx)
    try {
      const savedUser = localStorage.getItem('oonjai_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        console.log('[usePatientId] localStorage oonjai_user:', parsed);
        if (parsed.role === 'patient' && parsed.profile_id) {
          console.log('[usePatientId] Using oonjai_user.profile_id:', parsed.profile_id);
          return { patientId: parsed.profile_id, source: 'localStorage:oonjai_user' };
        }
      }
    } catch (e) {
      console.warn('[usePatientId] Failed to parse oonjai_user:', e);
    }

    // Source 4: localStorage 'oonjai_auth' (Zustand persist)
    try {
      const savedAuth = localStorage.getItem('oonjai_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        console.log('[usePatientId] localStorage oonjai_auth:', parsed);

        // Try context.patientId from persisted state
        if (parsed.state?.context?.patientId) {
          console.log('[usePatientId] Using oonjai_auth context.patientId:', parsed.state.context.patientId);
          return { patientId: parsed.state.context.patientId, source: 'localStorage:oonjai_auth.context' };
        }

        // Try user.profileId from persisted state
        if (parsed.state?.user?.role === 'patient' && parsed.state?.user?.profileId) {
          console.log('[usePatientId] Using oonjai_auth user.profileId:', parsed.state.user.profileId);
          return { patientId: parsed.state.user.profileId, source: 'localStorage:oonjai_auth.user' };
        }
      }
    } catch (e) {
      console.warn('[usePatientId] Failed to parse oonjai_auth:', e);
    }

    console.log('[usePatientId] No patientId found from any source');
    return { patientId: null, source: 'none' };
  }, [context.patientId, user.role, user.profileId]);
}
