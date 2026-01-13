import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// Types - matching database schema (database-schema-latest.sql)
export interface PatientProfile {
  id: string;
  user_id: string | null; // Nullable for quick-register
  // Basic Info
  first_name: string;
  last_name: string;
  nickname?: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other';
  // Health Info
  weight_kg?: number;
  height_cm?: number;
  blood_type?: string;
  chronic_diseases?: string[];
  drug_allergies?: string[];
  food_allergies?: string[];
  medical_condition?: string;
  // Medical Contacts
  hospital_name?: string;
  hospital_address?: string;
  hospital_phone?: string;
  doctor_name?: string;
  doctor_phone?: string;
  medical_notes?: string;
  // Contact Info
  address?: string;
  phone_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  // Timestamps
  created_at: string;
  updated_at?: string;
}

export interface CaregiverProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  relationship?: string;
  created_at: string;
}

export interface Medication {
  id: string;
  user_id?: string;
  patient_id: string;
  // Medication info
  name: string;
  dosage?: string; // Legacy: '500mg', '1 เม็ด'
  dosage_amount?: number;
  dosage_unit?: string; // 'mg', 'ml', 'tablet', 'capsule'
  dosage_form?: string; // 'tablet', 'capsule', 'liquid', 'injection'
  // Frequency
  frequency?: string; // 'daily', 'twice_daily', 'as_needed'
  times?: string[]; // ['08:00', '12:00', '18:00']
  days_of_week?: string[]; // ['monday', 'wednesday', 'friday']
  time_slots?: Record<string, unknown>; // complex scheduling
  // Instructions
  instructions?: string;
  note?: string;
  // Status
  active: boolean;
  reminder_enabled?: boolean;
  created_at: string;
}

export interface Reminder {
  id: string;
  patient_id: string;
  // Reminder info
  type: string; // 'medication', 'vitals', 'water', 'exercise', 'appointment', 'custom'
  title: string;
  // Timing
  time: string;
  custom_time?: string;
  frequency?: string; // 'daily', 'weekly', 'custom'
  // Days configuration
  days?: string[]; // for backward compatibility
  days_of_week?: string[]; // ['monday', 'wednesday', 'friday']
  // Additional
  note?: string;
  is_active: boolean;
  // Timestamps
  created_at: string;
  updated_at?: string;
}

export interface LinkCode {
  code: string;
  patient_id: string;
  expires_at: string;
  used: boolean;
}

// Query keys
export const profileKeys = {
  all: ['profile'] as const,
  patient: (patientId: string) => [...profileKeys.all, 'patient', patientId] as const,
  caregiver: (caregiverId: string) => [...profileKeys.all, 'caregiver', caregiverId] as const,
  caregivers: (patientId: string) => [...profileKeys.all, 'caregivers', patientId] as const,
  patients: (caregiverId: string) => [...profileKeys.all, 'patients', caregiverId] as const,
  linkCode: (patientId: string) => [...profileKeys.all, 'linkCode', patientId] as const,
  medications: (patientId: string) => [...profileKeys.all, 'medications', patientId] as const,
  reminders: (patientId: string) => [...profileKeys.all, 'reminders', patientId] as const,
};

// Patient Profile Hook
export function usePatientProfile(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? profileKeys.patient(patientId) : ['profile', 'patient', 'none'],
    queryFn: async (): Promise<PatientProfile | null> => {
      if (!patientId) return null;
      try {
        // Backend endpoint: GET /api/registration/profile/patient/:id
        const data = await apiClient.get<{ success: boolean; profile: PatientProfile }>(`/registration/profile/patient/${patientId}`);
        console.log('[usePatientProfile] API response:', data);
        return data.profile;
      } catch (err) {
        console.warn('[usePatientProfile] API error:', err);
        return getMockPatientProfile(patientId);
      }
    },
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });
}

// Update Patient Profile Hook
export function useUpdatePatientProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ patientId, data }: { patientId: string; data: Partial<PatientProfile> }) => {
      // Backend endpoint: PUT /api/registration/profile/patient/:id
      return apiClient.put(`/registration/profile/patient/${patientId}`, data);
    },
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.patient(patientId) });
    },
  });
}

// Link Code Hook
export function useLinkCode(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? profileKeys.linkCode(patientId) : ['profile', 'linkCode', 'none'],
    queryFn: async (): Promise<LinkCode | null> => {
      if (!patientId) return null;
      try {
        // Backend endpoint: POST /api/registration/generate-link-code
        const data = await apiClient.post<LinkCode>('/registration/generate-link-code', { patient_id: patientId });
        console.log('[useLinkCode] API response:', data);
        return data;
      } catch (err) {
        console.warn('[useLinkCode] API error:', err);
        return null;
      }
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

// Patient's Caregivers Hook
export function usePatientCaregivers(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? profileKeys.caregivers(patientId) : ['profile', 'caregivers', 'none'],
    queryFn: async (): Promise<CaregiverProfile[]> => {
      if (!patientId) return [];
      try {
        // Backend endpoint: GET /api/registration/patient/:patientId/caregivers
        const data = await apiClient.get<{ success: boolean; caregivers: CaregiverProfile[] }>(`/registration/patient/${patientId}/caregivers`);
        console.log('[usePatientCaregivers] API response:', data);
        return data.caregivers || [];
      } catch (err) {
        console.warn('[usePatientCaregivers] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });
}

// Caregiver's Patients Hook
export function useCaregiverPatients(caregiverId: string | null) {
  return useQuery({
    queryKey: caregiverId ? profileKeys.patients(caregiverId) : ['profile', 'patients', 'none'],
    queryFn: async (): Promise<PatientProfile[]> => {
      if (!caregiverId) return [];
      try {
        // Backend endpoint: GET /api/registration/caregiver/:caregiverId/patients
        const data = await apiClient.get<{ success: boolean; patients: PatientProfile[] }>(`/registration/caregiver/${caregiverId}/patients`);
        console.log('[useCaregiverPatients] API response:', data);
        return data.patients || [];
      } catch (err) {
        console.warn('[useCaregiverPatients] API error:', err);
        return [];
      }
    },
    enabled: !!caregiverId,
    staleTime: 60 * 1000,
  });
}

// Medications Hook
export function usePatientMedicationsAll(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? profileKeys.medications(patientId) : ['profile', 'medications', 'none'],
    queryFn: async (): Promise<Medication[]> => {
      if (!patientId) return [];
      try {
        // Backend endpoint: GET /api/medications/patient/:patientId (medication.routes.ts)
        const data = await apiClient.get<{ success: boolean; medications: Medication[] }>(`/medications/patient/${patientId}`);
        console.log('[usePatientMedicationsAll] API response:', data);
        return data.medications || [];
      } catch (err) {
        console.warn('[usePatientMedicationsAll] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });
}

// Add Medication Hook
export function useAddMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Medication, 'id' | 'created_at'>) => {
      // Backend endpoint: POST /api/medications/ (patient_id in body) - medication.routes.ts
      console.log('[useAddMedication] Adding medication:', data);
      return apiClient.post('/medications', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.medications(variables.patient_id) });
    },
  });
}

// Update Medication Hook
export function useUpdateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Medication> }) => {
      return apiClient.put(`/medications/${id}`, data);
    },
    onSuccess: (_, { data }) => {
      if (data.patient_id) {
        queryClient.invalidateQueries({ queryKey: profileKeys.medications(data.patient_id) });
      }
    },
  });
}

// Delete Medication Hook
export function useDeleteMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; patientId: string }) => {
      return apiClient.delete(`/medications/${id}`);
    },
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.medications(patientId) });
    },
  });
}

// Reminders Hook
export function usePatientReminders(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? profileKeys.reminders(patientId) : ['profile', 'reminders', 'none'],
    queryFn: async (): Promise<Reminder[]> => {
      if (!patientId) return [];
      try {
        // Backend endpoint: GET /api/reminders/patient/:patientId (reminder.routes.ts)
        const data = await apiClient.get<{ success: boolean; reminders: Reminder[] }>(`/reminders/patient/${patientId}`);
        console.log('[usePatientReminders] API response:', data);
        return data.reminders || [];
      } catch (err) {
        console.warn('[usePatientReminders] API error:', err);
        return [];
      }
    },
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });
}

// Add Reminder Hook
export function useAddReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Reminder, 'id' | 'created_at'>) => {
      return apiClient.post('/reminders', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.reminders(variables.patient_id) });
    },
  });
}

// Update Reminder Hook
export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Reminder> }) => {
      return apiClient.put(`/reminders/${id}`, data);
    },
    onSuccess: (_, { data }) => {
      if (data.patient_id) {
        queryClient.invalidateQueries({ queryKey: profileKeys.reminders(data.patient_id) });
      }
    },
  });
}

// Delete Reminder Hook
export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; patientId: string }) => {
      return apiClient.delete(`/reminders/${id}`);
    },
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.reminders(patientId) });
    },
  });
}

// Helper functions
export function calculateAge(birthDate: string | undefined): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function formatThaiDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export function formatGender(gender: string | undefined): string {
  if (!gender) return '-';
  const genderMap: Record<string, string> = { male: 'ชาย', female: 'หญิง', other: 'อื่นๆ' };
  return genderMap[gender] || gender;
}

// Mock data generators
function getMockPatientProfile(patientId: string): PatientProfile {
  return {
    id: patientId,
    user_id: 'mock-user-id',
    first_name: 'สมชาย',
    last_name: 'ใจดี',
    nickname: 'ชาย',
    birth_date: '1955-05-15',
    gender: 'male',
    phone_number: '081-234-5678',
    address: '123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    weight_kg: 65,
    height_cm: 168,
    blood_type: 'O',
    chronic_diseases: ['ความดันโลหิตสูง', 'เบาหวาน'],
    drug_allergies: ['Penicillin'],
    food_allergies: ['อาหารทะเล'],
    medical_condition: 'ความดันสูง ควบคุมด้วยยา',
    medical_notes: 'ต้องวัดความดันทุกเช้า',
    hospital_name: 'โรงพยาบาลบำรุงราษฎร์',
    hospital_phone: '02-667-1000',
    emergency_contact_name: 'สมหญิง ใจดี',
    emergency_contact_relation: 'ลูกสาว',
    emergency_contact_phone: '089-876-5432',
    created_at: '2024-01-15T00:00:00Z',
  };
}

