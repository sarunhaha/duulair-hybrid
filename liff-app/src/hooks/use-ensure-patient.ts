/**
 * useEnsurePatient - Hook to ensure patient profile exists before saving health data
 *
 * This hook auto-creates a patient profile if one doesn't exist,
 * allowing users to record health data without going through full registration.
 */

import { useState, useCallback } from 'react';
import { useLiff } from '@/lib/liff/provider';
import { useAuth } from '@/hooks/use-auth';
import { registrationApi } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';

interface EnsurePatientResult {
  patientId: string | null;
  isLoading: boolean;
  error: string | null;
  ensurePatient: () => Promise<string | null>;
}

export function useEnsurePatient(): EnsurePatientResult {
  const { profile } = useLiff();
  const auth = useAuth();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);

  const ensurePatient = useCallback(async (): Promise<string | null> => {
    // If patientId already exists from auth, return it
    if (auth.patientId) {
      return auth.patientId;
    }

    // If we already created one in this session, return it
    if (createdPatientId) {
      return createdPatientId;
    }

    // Need to auto-create
    if (!profile?.userId || !profile?.displayName) {
      setError('ไม่พบข้อมูล LINE profile');
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('[useEnsurePatient] Auto-creating patient profile...');
      const result = await registrationApi.autoCreatePatient(
        profile.userId,
        profile.displayName,
        profile.pictureUrl || undefined
      );

      if (result.success && result.patientId) {
        console.log('[useEnsurePatient] Created/found patient:', result.patientId, 'isNew:', result.isNew);
        setCreatedPatientId(result.patientId);

        // Invalidate auth cache to pick up new profile
        queryClient.invalidateQueries({ queryKey: ['auth'] });

        // Clear localStorage cache
        localStorage.removeItem('oonjai_auth_cache');

        return result.patientId;
      } else {
        throw new Error('ไม่สามารถสร้าง profile ได้');
      }
    } catch (err: any) {
      console.error('[useEnsurePatient] Error:', err);
      setError(err.message || 'เกิดข้อผิดพลาด');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [auth.patientId, createdPatientId, profile, queryClient]);

  return {
    patientId: auth.patientId || createdPatientId,
    isLoading: auth.isLoading || isCreating,
    error: error || auth.error,
    ensurePatient,
  };
}
