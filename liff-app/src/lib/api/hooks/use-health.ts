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
        // Backend endpoint: GET /api/health/today/:patientId (returns all health data)
        const data = await apiClient.get<{ vitals: VitalsLog[] }>(`/health/today/${patientId}`);
        console.log('[useTodayVitals] API response:', data);
        return data.vitals || [];
      } catch (err) {
        console.warn('[useTodayVitals] API error:', err);
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
      // Map to backend field names (snake_case patient_id)
      return await apiClient.post('/health/vitals', {
        patient_id: data.patientId,
        bp_systolic: data.bp_systolic,
        bp_diastolic: data.bp_diastolic,
        heart_rate: data.heart_rate,
        weight: data.weight,
        temperature: data.temperature,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.vitals(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Refresh dashboard
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
        // Backend endpoint: GET /api/health/today/:patientId (returns all health data)
        const data = await apiClient.get<{ water: WaterLog[] }>(`/health/today/${patientId}`);
        console.log('[useTodayWater] API response:', data);
        const logs = data.water || [];
        const total = logs.reduce((sum, log) => sum + (log.amount_ml || 0), 0);
        return { total, goal: 2000, logs };
      } catch (err) {
        console.warn('[useTodayWater] API error:', err);
        return { total: 0, goal: 2000, logs: [] };
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useAddWater() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { patientId: string; glasses?: number; amount_ml?: number }) => {
      return await apiClient.post('/health/water', {
        patient_id: data.patientId,
        glasses: data.glasses,
        amount_ml: data.amount_ml,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.water(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
        // Backend endpoint: GET /api/medications/patient/:patientId (medication.routes.ts)
        const data = await apiClient.get<{ success: boolean; medications: Medication[] }>(`/medications/patient/${patientId}`);
        console.log('[usePatientMedications] API response:', data);
        return data.medications || [];
      } catch (err) {
        console.warn('[usePatientMedications] API error:', err);
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
        // Backend endpoint: GET /api/health/today/:patientId (returns all health data)
        const data = await apiClient.get<{ medications: MedicationLog[] }>(`/health/today/${patientId}`);
        console.log('[useTodayMedicationLogs] API response:', data);
        return data.medications || [];
      } catch (err) {
        console.warn('[useTodayMedicationLogs] API error:', err);
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
      medication_id?: string;
      medication_name?: string;
      dosage?: string;
      scheduled_time?: string;
      note?: string;
      skipped?: boolean;
      skipped_reason?: string;
    }) => {
      return await apiClient.post('/health/medications', {
        patient_id: data.patientId,
        medication_id: data.medication_id,
        medication_name: data.medication_name,
        dosage: data.dosage,
        scheduled_time: data.scheduled_time,
        note: data.note,
        skipped: data.skipped,
        skipped_reason: data.skipped_reason,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.medicationLogs(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Symptom Hooks
export function useLogSymptom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      symptom_name: string;
      severity_1to5?: number;
      body_location?: string;
      duration_text?: string;
      notes?: string;
    }) => {
      return await apiClient.post('/health/symptoms', {
        patient_id: data.patientId,
        symptom_name: data.symptom_name,
        severity_1to5: data.severity_1to5,
        body_location: data.body_location,
        duration_text: data.duration_text,
        notes: data.notes,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.symptoms(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Sleep Hooks
export function useLogSleep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      sleep_hours?: number;
      sleep_quality?: string;
      sleep_quality_score?: number;
      sleep_time?: string;
      wake_time?: string;
      notes?: string;
    }) => {
      return await apiClient.post('/health/sleep', {
        patient_id: data.patientId,
        sleep_hours: data.sleep_hours,
        sleep_quality: data.sleep_quality,
        sleep_quality_score: data.sleep_quality_score,
        sleep_time: data.sleep_time,
        wake_time: data.wake_time,
        notes: data.notes,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['health', 'sleep', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Exercise Hooks
export function useLogExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      exercise_type?: string;
      duration_minutes?: number;
      intensity?: string;
      distance_meters?: number;
      calories_burned?: number;
      notes?: string;
    }) => {
      return await apiClient.post('/health/exercise', {
        patient_id: data.patientId,
        exercise_type: data.exercise_type,
        duration_minutes: data.duration_minutes,
        intensity: data.intensity,
        distance_meters: data.distance_meters,
        calories_burned: data.calories_burned,
        notes: data.notes,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['health', 'exercise', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
