/**
 * useAuth - Simple auth hook that fetches user data directly from API
 *
 * This hook bypasses Zustand complexity and fetches auth data directly
 * using LIFF profile.userId
 */

import { useQuery } from '@tanstack/react-query';
import { useLiff } from '@/lib/liff/provider';
import { registrationApi } from '@/lib/api/client';

interface AuthData {
  isLoading: boolean;
  isAuthenticated: boolean;
  isRegistered: boolean;
  error: string | null;
  role: 'patient' | 'caregiver' | null;
  profileId: string | null;
  patientId: string | null;
  lineUserId: string | null;
}

export function useAuth(): AuthData {
  const { isInitialized, isLoading: liffLoading, profile, error: liffError } = useLiff();

  const lineUserId = profile?.userId || null;

  const { data, isLoading: queryLoading, error: queryError } = useQuery({
    queryKey: ['auth', 'check', lineUserId],
    queryFn: async () => {
      if (!lineUserId) {
        throw new Error('No LINE user ID');
      }
      console.log('[useAuth] Fetching auth data for:', lineUserId);
      const result = await registrationApi.checkUser(lineUserId);
      console.log('[useAuth] API response:', result);
      return result;
    },
    enabled: isInitialized && !liffLoading && !!lineUserId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

  // Still initializing LIFF
  if (!isInitialized || liffLoading) {
    return {
      isLoading: true,
      isAuthenticated: false,
      isRegistered: false,
      error: null,
      role: null,
      profileId: null,
      patientId: null,
      lineUserId: null,
    };
  }

  // LIFF error
  if (liffError) {
    return {
      isLoading: false,
      isAuthenticated: false,
      isRegistered: false,
      error: 'LIFF Error: ' + liffError.message,
      role: null,
      profileId: null,
      patientId: null,
      lineUserId: null,
    };
  }

  // No LIFF profile
  if (!lineUserId) {
    return {
      isLoading: false,
      isAuthenticated: false,
      isRegistered: false,
      error: 'ไม่พบข้อมูลผู้ใช้ LINE',
      role: null,
      profileId: null,
      patientId: null,
      lineUserId: null,
    };
  }

  // Query loading
  if (queryLoading) {
    return {
      isLoading: true,
      isAuthenticated: false,
      isRegistered: false,
      error: null,
      role: null,
      profileId: null,
      patientId: null,
      lineUserId,
    };
  }

  // Query error
  if (queryError) {
    return {
      isLoading: false,
      isAuthenticated: false,
      isRegistered: false,
      error: 'API Error: ' + (queryError instanceof Error ? queryError.message : 'Unknown'),
      role: null,
      profileId: null,
      patientId: null,
      lineUserId,
    };
  }

  // Not registered
  if (!data?.exists || !data?.profile) {
    return {
      isLoading: false,
      isAuthenticated: true, // LIFF auth OK
      isRegistered: false,
      error: null,
      role: null,
      profileId: null,
      patientId: null,
      lineUserId,
    };
  }

  // Registered - return data
  const role = data.role || null;
  const profileId = data.profile.id;

  // For patients: patientId = their profile id
  // For caregivers: patientId = their linked_patient_id
  const patientId = role === 'patient'
    ? profileId
    : data.profile.linked_patient_id || null;

  console.log('[useAuth] Resolved:', { role, profileId, patientId, linked_patient_id: data.profile.linked_patient_id });

  return {
    isLoading: false,
    isAuthenticated: true,
    isRegistered: true,
    error: null,
    role,
    profileId,
    patientId,
    lineUserId,
  };
}

// Simple hook to just get patientId
export function usePatientIdSimple(): { patientId: string | null; isLoading: boolean; error: string | null } {
  const auth = useAuth();
  return {
    patientId: auth.patientId,
    isLoading: auth.isLoading,
    error: auth.error,
  };
}
