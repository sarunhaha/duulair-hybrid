import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// Types
export interface PatientProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other';
  phone_number?: string;
  address?: string;
  weight_kg?: number;
  height_cm?: number;
  blood_type?: string;
  chronic_diseases?: string[];
  drug_allergies?: string[];
  food_allergies?: string[];
  medical_condition?: string;
  medical_notes?: string;
  hospital_name?: string;
  hospital_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
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
  patient_id: string;
  name: string;
  dosage_amount?: number;
  dosage_unit?: string;
  dosage_form?: string;
  frequency?: string;
  days_of_week?: string[];
  times?: string[];
  instructions?: string;
  note?: string;
  reminder_enabled?: boolean;
  active: boolean;
  created_at: string;
}

export interface Reminder {
  id: string;
  patient_id: string;
  type: string;
  title: string;
  time?: string;
  custom_time?: string;
  note?: string;
  frequency?: string;
  days_of_week?: string[];
  is_active: boolean;
  created_at: string;
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
        const data = await apiClient.get<{ success: boolean; profile: PatientProfile }>(`/patient/${patientId}`);
        return data.profile;
      } catch {
        console.warn('Patient profile API not available');
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
      return apiClient.put(`/patient/${patientId}`, data);
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
        const data = await apiClient.post<LinkCode>('/link-code/generate', { patient_id: patientId });
        return data;
      } catch {
        console.warn('Link code API not available');
        return { code: 'ABC123', patient_id: patientId, expires_at: new Date(Date.now() + 86400000).toISOString(), used: false };
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
        const data = await apiClient.get<{ success: boolean; caregivers: CaregiverProfile[] }>(`/patient/${patientId}/caregivers`);
        return data.caregivers || [];
      } catch {
        console.warn('Caregivers API not available');
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
        const data = await apiClient.get<{ success: boolean; patients: PatientProfile[] }>(`/caregiver/${caregiverId}/patients`);
        return data.patients || [];
      } catch {
        console.warn('Patients API not available');
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
        const data = await apiClient.get<{ success: boolean; medications: Medication[] }>(`/patient/${patientId}/medications`);
        return data.medications || [];
      } catch {
        console.warn('Medications API not available');
        return getMockMedications(patientId);
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
        const data = await apiClient.get<{ success: boolean; reminders: Reminder[] }>(`/patient/${patientId}/reminders`);
        return data.reminders || [];
      } catch {
        console.warn('Reminders API not available');
        return getMockReminders(patientId);
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

function getMockMedications(patientId: string): Medication[] {
  return [
    {
      id: 'med-1',
      patient_id: patientId,
      name: 'ยาลดความดัน Amlodipine',
      dosage_amount: 1,
      dosage_unit: 'tablet',
      dosage_form: 'tablet',
      frequency: 'daily',
      times: ['morning'],
      instructions: 'หลังอาหาร',
      reminder_enabled: true,
      active: true,
      created_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 'med-2',
      patient_id: patientId,
      name: 'Metformin 500mg',
      dosage_amount: 1,
      dosage_unit: 'tablet',
      dosage_form: 'tablet',
      frequency: 'daily',
      times: ['morning', 'evening'],
      instructions: 'หลังอาหาร',
      reminder_enabled: true,
      active: true,
      created_at: '2024-01-15T00:00:00Z',
    },
  ];
}

function getMockReminders(patientId: string): Reminder[] {
  return [
    {
      id: 'rem-1',
      patient_id: patientId,
      type: 'medication',
      title: 'กินยาเช้า',
      time: '08:00',
      custom_time: '08:00',
      frequency: 'daily',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 'rem-2',
      patient_id: patientId,
      type: 'vitals',
      title: 'วัดความดัน',
      time: '07:00',
      custom_time: '07:00',
      frequency: 'daily',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 'rem-3',
      patient_id: patientId,
      type: 'water',
      title: 'ดื่มน้ำ',
      time: '10:00',
      custom_time: '10:00',
      frequency: 'daily',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
    },
  ];
}
