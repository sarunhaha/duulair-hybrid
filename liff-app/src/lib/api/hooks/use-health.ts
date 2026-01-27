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

export interface MoodLogEntry {
  id: string;
  mood: string;
  mood_score: number | null;
  stress_level: string | null;
  stress_cause: string | null;
  energy_level: string | null;
  note: string | null;
  timestamp: string;
}

export interface MedicalNote {
  id: string;
  event_date: string;
  event_type: string;
  description: string;
  hospital_name: string | null;
  doctor_name: string | null;
  created_at: string;
}

// Query keys
export const healthKeys = {
  all: ['health'] as const,
  vitals: (patientId: string, date?: string) => [...healthKeys.all, 'vitals', patientId, date] as const,
  water: (patientId: string, date?: string) => [...healthKeys.all, 'water', patientId, date] as const,
  medications: (patientId: string) => [...healthKeys.all, 'medications', patientId] as const,
  medicationLogs: (patientId: string, date?: string) => [...healthKeys.all, 'medication-logs', patientId, date] as const,
  symptoms: (patientId: string, date?: string) => [...healthKeys.all, 'symptoms', patientId, date] as const,
  exercise: (patientId: string, date?: string) => [...healthKeys.all, 'exercise', patientId, date] as const,
  mood: (patientId: string, date?: string) => [...healthKeys.all, 'mood', patientId, date] as const,
  medicalNotes: (patientId: string, date?: string) => [...healthKeys.all, 'medical-notes', patientId, date] as const,
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

export function useUpdateVitals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      patientId: string;
      bp_systolic?: number;
      bp_diastolic?: number;
      heart_rate?: number;
      weight?: number;
      temperature?: number;
      measured_at?: string;
      notes?: string;
    }) => {
      return await apiClient.put(`/health/vitals/${data.id}`, {
        bp_systolic: data.bp_systolic,
        bp_diastolic: data.bp_diastolic,
        heart_rate: data.heart_rate,
        weight: data.weight,
        temperature: data.temperature,
        measured_at: data.measured_at,
        notes: data.notes,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.vitals(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteVitals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; patientId: string }) => {
      return await apiClient.delete(`/health/vitals/${data.id}`);
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.vitals(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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

// Sleep Types
export interface SleepLog {
  id: string;
  sleep_date: string;
  sleep_hours: number | null;
  sleep_quality: string | null;
  sleep_quality_score: number | null;
  sleep_time: string | null;
  wake_time: string | null;
  notes: string | null;
  created_at: string;
}

// Sleep Hooks
export function useTodaySleep(patientId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: patientId ? ['health', 'sleep', patientId, today] : ['sleep', 'none'],
    queryFn: async (): Promise<SleepLog[]> => {
      if (!patientId) return [];
      try {
        const data = await apiClient.get<{ sleep: SleepLog[] }>(`/health/today/${patientId}`);
        console.log('[useTodaySleep] API response:', data);
        return data.sleep || [];
      } catch (err) {
        console.warn('[useTodaySleep] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

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
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ['health', 'sleep', variables.patientId, today] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateSleep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      patientId: string;
      sleep_hours?: number;
      sleep_quality?: string;
      sleep_quality_score?: number;
      sleep_time?: string;
      wake_time?: string;
      sleep_date?: string;
      notes?: string;
    }) => {
      return await apiClient.put(`/health/sleep/${data.id}`, {
        sleep_hours: data.sleep_hours,
        sleep_quality: data.sleep_quality,
        sleep_quality_score: data.sleep_quality_score,
        sleep_time: data.sleep_time,
        wake_time: data.wake_time,
        sleep_date: data.sleep_date,
        notes: data.notes,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ['health', 'sleep', variables.patientId, today] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteSleep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; patientId: string }) => {
      return await apiClient.delete(`/health/sleep/${data.id}`);
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ['health', 'sleep', variables.patientId, today] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Exercise Hooks
export function useTodayExercise(patientId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: patientId ? healthKeys.exercise(patientId, today) : ['exercise', 'none'],
    queryFn: async () => {
      if (!patientId) return [];
      try {
        const data = await apiClient.get<{ exercise: unknown[] }>(`/health/today/${patientId}`);
        return data.exercise || [];
      } catch (err) {
        console.warn('[useTodayExercise] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useLogExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      exercise_type?: string;
      exercise_type_th?: string;
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
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.exercise(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Mood Hooks
export function useTodayMood(patientId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: patientId ? healthKeys.mood(patientId, today) : ['mood', 'none'],
    queryFn: async (): Promise<MoodLogEntry[]> => {
      if (!patientId) return [];
      try {
        const data = await apiClient.get<{ mood: MoodLogEntry[] }>(`/health/today/${patientId}`);
        return data.mood || [];
      } catch (err) {
        console.warn('[useTodayMood] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useLogMood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      mood: string;
      mood_score?: number;
      stress_level?: string;
      stress_cause?: string;
      energy_level?: string;
      note?: string;
    }) => {
      return await apiClient.post('/health/mood', {
        patient_id: data.patientId,
        mood: data.mood,
        mood_score: data.mood_score,
        stress_level: data.stress_level,
        stress_cause: data.stress_cause,
        energy_level: data.energy_level,
        note: data.note,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.mood(variables.patientId, today) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Medical Notes Hooks
export function useTodayMedicalNotes(patientId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: patientId ? healthKeys.medicalNotes(patientId, today) : ['medical-notes', 'none'],
    queryFn: async (): Promise<MedicalNote[]> => {
      if (!patientId) return [];
      try {
        const data = await apiClient.get<{ medicalNotes: MedicalNote[] }>(`/health/today/${patientId}`);
        return data.medicalNotes || [];
      } catch (err) {
        console.warn('[useTodayMedicalNotes] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useLogMedicalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      event_date?: string;
      event_type: string;
      description: string;
      hospital_name?: string;
      doctor_name?: string;
    }) => {
      return await apiClient.post('/health/medical-notes', {
        patient_id: data.patientId,
        event_date: data.event_date,
        event_type: data.event_type,
        description: data.description,
        hospital_name: data.hospital_name,
        doctor_name: data.doctor_name,
      });
    },
    onSuccess: (_, variables) => {
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: healthKeys.medicalNotes(variables.patientId, today) });
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

// Health History Hook - for History page
export interface HealthHistoryItem {
  id: string;
  type: 'vitals' | 'sleep' | 'symptoms' | 'medications' | 'water' | 'exercise' | 'mood' | 'medical_notes';
  title: string;
  detail: string;
  time: string;
  date: string;
  raw: unknown;
}

export function useHealthHistory(patientId: string | null, days: number = 7) {
  return useQuery({
    queryKey: patientId ? ['health', 'history', patientId, days] : ['history', 'none'],
    queryFn: async (): Promise<HealthHistoryItem[]> => {
      if (!patientId) return [];
      try {
        // Get historical data (configurable days, default 7)
        const data = await apiClient.get<{
          vitals: VitalsLog[];
          sleep: SleepLog[];
          symptoms: { id: string; symptom_name: string; severity_1to5: number | null; created_at: string }[];
          medications: MedicationLog[];
          water: WaterLog[];
          exercise: { id: string; exercise_type: string | null; duration_minutes: number | null; created_at: string }[];
          mood: MoodLogEntry[];
          medicalNotes: MedicalNote[];
        }>(`/health/history/${patientId}?days=${days}`);

        const items: HealthHistoryItem[] = [];
        const today = new Date().toISOString().split('T')[0];

        // Format vitals
        (data.vitals || []).forEach(v => {
          items.push({
            id: v.id,
            type: 'vitals',
            title: 'ความดัน',
            detail: `${v.bp_systolic}/${v.bp_diastolic} mmHg${v.heart_rate ? ` (ชีพจร ${v.heart_rate})` : ''}`,
            time: new Date(v.measured_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            date: v.measured_at.split('T')[0] === today ? 'วันนี้' : formatDate(v.measured_at),
            raw: v,
          });
        });

        // Format sleep
        (data.sleep || []).forEach(s => {
          const quality = s.sleep_quality ? `(${getQualityLabel(s.sleep_quality)})` : '';
          items.push({
            id: s.id,
            type: 'sleep',
            title: 'การนอน',
            detail: `${s.sleep_hours || 0} ชม. ${quality}`.trim(),
            time: s.wake_time ? `ตื่น ${s.wake_time} น.` : new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            date: s.sleep_date === today ? 'วันนี้' : formatDate(s.sleep_date),
            raw: s,
          });
        });

        // Format symptoms
        (data.symptoms || []).forEach(s => {
          items.push({
            id: s.id,
            type: 'symptoms',
            title: 'อาการ',
            detail: `${s.symptom_name}${s.severity_1to5 ? ` (ระดับ ${s.severity_1to5})` : ''}`,
            time: new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            date: s.created_at.split('T')[0] === today ? 'วันนี้' : formatDate(s.created_at),
            raw: s,
          });
        });

        // Format medications
        (data.medications || []).forEach(m => {
          items.push({
            id: m.id,
            type: 'medications',
            title: 'ยา',
            detail: m.medication_name || 'ทานยาแล้ว',
            time: new Date(m.taken_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            date: m.taken_at.split('T')[0] === today ? 'วันนี้' : formatDate(m.taken_at),
            raw: m,
          });
        });

        // Format mood
        const moodLabels: Record<string, string> = {
          happy: 'มีความสุข', calm: 'สงบ', excited: 'ตื่นเต้น', neutral: 'ปกติ',
          tired: 'เหนื่อย', anxious: 'กังวล', sad: 'เศร้า', stressed: 'เครียด', exhausted: 'อ่อนเพลีย',
        };
        (data.mood || []).forEach(m => {
          const moodTh = moodLabels[m.mood] || m.mood;
          const scoreText = m.mood_score ? ` (ระดับ ${m.mood_score}/5)` : '';
          items.push({
            id: m.id,
            type: 'mood',
            title: 'อารมณ์',
            detail: `${moodTh}${scoreText}`,
            time: new Date(m.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            date: m.timestamp.split('T')[0] === today ? 'วันนี้' : formatDate(m.timestamp),
            raw: m,
          });
        });

        // Format medical notes
        const eventTypeLabels: Record<string, string> = {
          checkup: 'ตรวจสุขภาพ', doctor_visit: 'พบแพทย์', hospitalization: 'นอน รพ.',
          surgery: 'ผ่าตัด', vaccination: 'ฉีดวัคซีน', other: 'อื่นๆ',
        };
        (data.medicalNotes || []).forEach(n => {
          const typeTh = eventTypeLabels[n.event_type] || n.event_type;
          items.push({
            id: n.id,
            type: 'medical_notes',
            title: 'บันทึกแพทย์',
            detail: `${typeTh}: ${n.description}`,
            time: new Date(n.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            date: n.event_date === today ? 'วันนี้' : formatDate(n.event_date),
            raw: n,
          });
        });

        // Sort by time (most recent first)
        items.sort((a, b) => {
          const timeA = (a.raw as any).created_at || (a.raw as any).measured_at || (a.raw as any).taken_at;
          const timeB = (b.raw as any).created_at || (b.raw as any).measured_at || (b.raw as any).taken_at;
          return new Date(timeB).getTime() - new Date(timeA).getTime();
        });

        return items;
      } catch (err) {
        console.warn('[useHealthHistory] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'วันนี้';
  if (date.toDateString() === yesterday.toDateString()) return 'เมื่อวาน';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function getQualityLabel(quality: string): string {
  const labels: Record<string, string> = {
    poor: 'แย่',
    fair: 'พอใช้',
    good: 'ดี',
    excellent: 'ดีมาก',
  };
  return labels[quality] || quality;
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
