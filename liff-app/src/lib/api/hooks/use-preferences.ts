import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface HealthCategoryPreferences {
  id?: string;
  patient_id: string;
  vitals_enabled: boolean;
  glucose_enabled: boolean;
  medications_enabled: boolean;
  sleep_enabled: boolean;
  water_enabled: boolean;
  exercise_enabled: boolean;
  mood_enabled: boolean;
  symptoms_enabled: boolean;
  notes_enabled: boolean;
  lab_results_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// All-true defaults for new patients / loading state
const ALL_ENABLED: Omit<HealthCategoryPreferences, 'patient_id'> = {
  vitals_enabled: true,
  glucose_enabled: true,
  medications_enabled: true,
  sleep_enabled: true,
  water_enabled: true,
  exercise_enabled: true,
  mood_enabled: true,
  symptoms_enabled: true,
  notes_enabled: true,
  lab_results_enabled: true,
};

export const preferencesKeys = {
  all: ['preferences'] as const,
  patient: (patientId: string) => [...preferencesKeys.all, patientId] as const,
};

export function useHealthPreferences(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? preferencesKeys.patient(patientId) : ['preferences', 'none'],
    queryFn: async (): Promise<HealthCategoryPreferences> => {
      if (!patientId) return { patient_id: '', ...ALL_ENABLED };
      try {
        const data = await apiClient.get<{ success: boolean; preferences: HealthCategoryPreferences }>(
          `/preferences/${patientId}`
        );
        return data.preferences;
      } catch {
        return { patient_id: patientId, ...ALL_ENABLED };
      }
    },
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });
}

export function useUpdateHealthPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<HealthCategoryPreferences>;
    }) => {
      return apiClient.put<{ success: boolean; preferences: HealthCategoryPreferences }>(
        `/preferences/${patientId}`,
        data
      );
    },
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: preferencesKeys.patient(patientId) });
    },
  });
}
