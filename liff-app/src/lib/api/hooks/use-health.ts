import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// Types
export interface VitalsLog {
  id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  weight: number | null;
  temperature: number | null;
  measured_at: string;
  source: 'manual' | 'ocr';
}

export interface WaterLog {
  id: string;
  amount_ml: number;
  logged_at: string;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  medication_name: string;
  time_period: 'morning' | 'afternoon' | 'evening' | 'night';
  taken_at: string;
  note?: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage_amount: number;
  dosage_form: string;
  dosage_unit: string;
  times: string[];
  instructions?: string;
  active: boolean;
}

export interface SymptomLog {
  id: string;
  symptoms: string[];
  severity: number;
  location?: string;
  duration?: string;
  note?: string;
  logged_at: string;
}

// Query keys
export const healthKeys = {
  all: ['health'] as const,
  vitals: (patientId: string, date?: string) => [...healthKeys.all, 'vitals', patientId, date] as const,
  water: (patientId: string, date?: string) => [...healthKeys.all, 'water', patientId, date] as const,
  medications: (patientId: string) => [...healthKeys.all, 'medications', patientId] as const,
  medicationLogs: (patientId: string, date?: string) => [...healthKeys.all, 'medication-logs', patientId, date] as const,
  symptoms: (patientId: string, date?: string) => [...healthKeys.all, 'symptoms', patientId, date] as const,
};

// Vitals Hooks
export function useTodayVitals(patientId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: patientId ? healthKeys.vitals(patientId, today) : ['vitals', 'none'],
    queryFn: async (): Promise<VitalsLog[]> => {
      if (!patientId) return [];
      try {
        const data = await apiClient.get<VitalsLog[]>(`/health/vitals/${patientId}?date=${today}`);
        return data;
      } catch {
        console.warn('Vitals API not available, using empty data');
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useSaveVitals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      bp_systolic?: number;
      bp_diastolic?: number;
      heart_rate?: number;
      weight?: number;
      temperature?: number;
    }) => {
      return await apiClient.post('/health/vitals', data);
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.vitals(variables.patientId, today) });
    },
  });
}

// Water Tracking Hooks
export function useTodayWater(patientId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: patientId ? healthKeys.water(patientId, today) : ['water', 'none'],
    queryFn: async (): Promise<{ total: number; goal: number; logs: WaterLog[] }> => {
      if (!patientId) return { total: 0, goal: 2000, logs: [] };
      try {
        const data = await apiClient.get<{ total: number; goal: number; logs: WaterLog[] }>(
          `/health/water/${patientId}?date=${today}`
        );
        return data;
      } catch {
        // Return from localStorage as fallback
        const savedData = JSON.parse(localStorage.getItem(`water_${today}`) || '{"total": 0, "goal": 2000, "logs": []}');
        return savedData;
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useAddWater() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { patientId: string; amount_ml: number }) => {
      return await apiClient.post('/health/water', data);
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.water(variables.patientId, today) });
    },
  });
}

// Medication Hooks
export function usePatientMedications(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? healthKeys.medications(patientId) : ['medications', 'none'],
    queryFn: async (): Promise<Medication[]> => {
      if (!patientId) return [];
      try {
        const data = await apiClient.get<Medication[]>(`/health/medications/${patientId}`);
        return data;
      } catch {
        console.warn('Medications API not available');
        return getMockMedications();
      }
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTodayMedicationLogs(patientId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: patientId ? healthKeys.medicationLogs(patientId, today) : ['medication-logs', 'none'],
    queryFn: async (): Promise<MedicationLog[]> => {
      if (!patientId) return [];
      try {
        const data = await apiClient.get<MedicationLog[]>(`/health/medication-logs/${patientId}?date=${today}`);
        return data;
      } catch {
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useLogMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      medicationIds: string[];
      time_period: 'morning' | 'afternoon' | 'evening' | 'night';
      note?: string;
    }) => {
      return await apiClient.post('/health/medication-logs', data);
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.medicationLogs(variables.patientId, today) });
    },
  });
}

// Symptom Hooks
export function useLogSymptom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      symptoms: string[];
      severity: number;
      location?: string;
      duration?: string;
      note?: string;
    }) => {
      return await apiClient.post('/health/symptoms', data);
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.symptoms(variables.patientId, today) });
    },
  });
}

// BP Status Helper
export function getBloodPressureStatus(systolic: number, diastolic: number) {
  if (systolic >= 180 || diastolic >= 120) {
    return { label: 'วิกฤต', status: 'critical', color: 'bg-red-600 text-white' };
  } else if (systolic >= 140 || diastolic >= 90) {
    return { label: 'สูง ระยะ 2', status: 'high-stage2', color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' };
  } else if (systolic >= 130 || diastolic >= 80) {
    return { label: 'สูง ระยะ 1', status: 'high-stage1', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400' };
  } else if (systolic >= 120 && diastolic < 80) {
    return { label: 'สูงกว่าปกติ', status: 'elevated', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400' };
  } else if (systolic < 90 || diastolic < 60) {
    return { label: 'ต่ำ', status: 'low', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' };
  } else {
    return { label: 'ปกติ', status: 'normal', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' };
  }
}

// Mock data for development
function getMockMedications(): Medication[] {
  return [
    {
      id: '1',
      name: 'Amlodipine',
      dosage_amount: 1,
      dosage_form: 'tablet',
      dosage_unit: 'tablet',
      times: ['morning'],
      instructions: 'กินหลังอาหาร',
      active: true,
    },
    {
      id: '2',
      name: 'Metformin',
      dosage_amount: 1,
      dosage_form: 'tablet',
      dosage_unit: 'tablet',
      times: ['morning', 'evening'],
      instructions: 'กินพร้อมอาหาร',
      active: true,
    },
    {
      id: '3',
      name: 'Atorvastatin',
      dosage_amount: 1,
      dosage_form: 'tablet',
      dosage_unit: 'tablet',
      times: ['night'],
      instructions: 'กินก่อนนอน',
      active: true,
    },
  ];
}
