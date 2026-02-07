/**
 * useAuth - Simple auth hook that fetches user data directly from API
 *
 * This hook bypasses Zustand complexity and fetches auth data directly
 * using LIFF profile.userId
 *
 * OPTIMIZATION: Uses localStorage cache for instant loading on subsequent visits
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLiff } from '@/lib/liff/provider';
import { registrationApi } from '@/lib/api/client';
import type { RegistrationCheckResponse } from '@/lib/api/client';

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

// Cache key and duration
const AUTH_CACHE_KEY = 'oonjai_auth_cache';
const AUTH_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedAuth {
  data: RegistrationCheckResponse;
  lineUserId: string;
  timestamp: number;
}

// Get cached auth data
function getCachedAuth(lineUserId: string): RegistrationCheckResponse | null {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    console.log('[useAuth] getCachedAuth - cached raw:', cached ? 'exists' : 'null');
    if (!cached) return null;

    const parsed: CachedAuth = JSON.parse(cached);
    console.log('[useAuth] getCachedAuth - parsed:', {
      cachedUserId: parsed.lineUserId,
      currentUserId: lineUserId,
      timestamp: parsed.timestamp,
      age: Date.now() - parsed.timestamp,
      maxAge: AUTH_CACHE_DURATION,
      hasData: !!parsed.data
    });

    // Check if same user and not expired
    if (parsed.lineUserId !== lineUserId) {
      console.log('[useAuth] getCachedAuth - user mismatch, clearing cache');
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    if (Date.now() - parsed.timestamp > AUTH_CACHE_DURATION) {
      console.log('[useAuth] getCachedAuth - cache expired, clearing');
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    console.log('[useAuth] Using cached auth data:', parsed.data);
    return parsed.data;
  } catch (e) {
    console.error('[useAuth] getCachedAuth - error:', e);
    localStorage.removeItem(AUTH_CACHE_KEY);
    return null;
  }
}

// Save auth data to cache
function setCachedAuth(lineUserId: string, data: RegistrationCheckResponse): void {
  try {
    const cached: CachedAuth = {
      data,
      lineUserId,
      timestamp: Date.now(),
    };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cached));
    console.log('[useAuth] Cached auth data');
  } catch {
    // Ignore storage errors
  }
}

export function useAuth(): AuthData {
  const { isInitialized, isLoading: liffLoading, profile, error: liffError } = useLiff();
  const queryClient = useQueryClient();
  const hasTriggeredFetch = useRef(false);

  const lineUserId = profile?.userId || null;

  console.log('[useAuth] Hook called:', {
    isInitialized,
    liffLoading,
    lineUserId,
    hasProfile: !!profile,
    liffError: liffError?.message
  });

  // Get initial data from cache for instant loading
  const initialData = lineUserId ? getCachedAuth(lineUserId) : undefined;

  const queryEnabled = isInitialized && !liffLoading && !!lineUserId;
  console.log('[useAuth] Query enabled:', queryEnabled, { isInitialized, liffLoading, hasLineUserId: !!lineUserId });

  const { data, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['auth', 'check', lineUserId],
    queryFn: async () => {
      if (!lineUserId) {
        throw new Error('No LINE user ID');
      }
      console.log('[useAuth] Fetching auth data for:', lineUserId);
      const result = await registrationApi.checkUser(lineUserId);
      console.log('[useAuth] API response:', result);

      // Cache the result
      setCachedAuth(lineUserId, result);

      return result;
    },
    enabled: queryEnabled,
    initialData, // Use cached data for instant display
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
    retry: 2,
    refetchOnMount: true, // Always refetch to ensure fresh data
  });

  // Force fetch when lineUserId becomes available and no cache exists
  useEffect(() => {
    if (queryEnabled && lineUserId && !initialData && !hasTriggeredFetch.current) {
      console.log('[useAuth] Force triggering fetch for lineUserId:', lineUserId);
      hasTriggeredFetch.current = true;
      // Invalidate and refetch to ensure query runs
      queryClient.invalidateQueries({ queryKey: ['auth', 'check', lineUserId] });
    }
  }, [queryEnabled, lineUserId, initialData, queryClient]);

  console.log('[useAuth] Query state:', { queryLoading, hasData: !!data, queryError: queryError?.message });

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

  // Query loading - only show loading if NO cached data
  // With cached data, we display immediately and refresh in background
  if (queryLoading && !data) {
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

  // Query error - only show error if NO cached data
  // With cached data, continue using it even if refresh fails
  if (queryError && !data) {
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

  // Not registered - but still try to get patientId if profile exists
  if (!data?.exists || !data?.profile) {
    // Even if not fully registered, profile.id can be used as patientId for CRUD
    const fallbackPatientId = data?.profile?.id || null;

    return {
      isLoading: false,
      isAuthenticated: true, // LIFF auth OK
      isRegistered: false,
      error: null,
      role: data?.role || null,
      profileId: fallbackPatientId,
      patientId: fallbackPatientId, // Use profile.id for CRUD operations
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
