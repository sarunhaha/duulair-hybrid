// Database types matching Supabase schema
// Last updated: 2025-01-10

// ============================================
// ENUMS
// ============================================

export type UserRole = 'patient' | 'caregiver';
export type Gender = 'male' | 'female' | 'other';
export type CaregiverStatus = 'pending' | 'active' | 'rejected';
export type AccessLevel = 'full' | 'limited';
export type GroupMemberRole = 'caregiver' | 'patient' | 'family';
export type SleepQuality = 'poor' | 'fair' | 'good' | 'excellent';
export type StressLevel = 'low' | 'medium' | 'high';
export type RiskLevel = 'normal' | 'warning' | 'critical';
export type AllergyType = 'drug' | 'food' | 'environmental';
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export type DataSource = 'manual' | 'image_ocr' | 'device';
export type ChatSource = '1:1' | 'group';

export type ReminderType =
  | 'medication'
  | 'water'
  | 'exercise'
  | 'vitals'
  | 'sleep'
  | 'appointment';

export type HealthEventType =
  | 'symptom'
  | 'vital'
  | 'mood'
  | 'sleep'
  | 'exercise'
  | 'medication'
  | 'water'
  | 'food';

export type Relationship =
  | 'child'
  | 'grandchild'
  | 'sibling'
  | 'spouse'
  | 'parent'
  | 'caregiver'
  | 'nurse'
  | 'other';

// ============================================
// CORE USER TABLES
// ============================================

export interface User {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  role: UserRole | null;
  language: 'th' | 'en';
  persona: string;
  conditions: string[] | null;
  timezone: string;
  opt_in: boolean;
  primary_group_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientProfile {
  id: string;
  user_id: string | null; // Nullable for quick-register
  // Basic Info
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  birth_date: string | null;
  gender: Gender | null;
  // Health Info
  weight_kg: number | null;
  height_cm: number | null;
  blood_type: string | null;
  chronic_diseases: string[];
  drug_allergies: string[];
  food_allergies: string[];
  medical_condition: string | null;
  // Medical Contacts
  hospital_name: string | null;
  hospital_address: string | null;
  hospital_phone: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  medical_notes: string | null;
  // Contact Info
  address: string | null;
  phone_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CaregiverProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// GROUP MANAGEMENT
// ============================================

export interface Group {
  id: string;
  line_group_id: string;
  group_name: string | null;
  primary_caregiver_id: string | null;
  active_patient_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  role: GroupMemberRole;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface GroupPatient {
  id: string;
  group_id: string;
  patient_id: string;
  added_by_caregiver_id: string | null;
  added_at: string;
  is_active: boolean;
}

// ============================================
// PATIENT-CAREGIVER RELATIONSHIPS
// ============================================

export interface PatientCaregiver {
  id: string;
  patient_id: string;
  caregiver_id: string;
  relationship: Relationship | null;
  is_primary: boolean;
  access_level: AccessLevel;
  status: CaregiverStatus;
  // Notification preferences
  notify_emergency: boolean;
  notify_medication: boolean;
  notify_daily_report: boolean;
  notify_abnormal_vitals: boolean;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// HEALTH DATA TRACKING
// ============================================

export interface Medication {
  id: string;
  user_id: string | null;
  patient_id: string | null;
  name: string;
  dosage: string | null;
  dosage_amount: number | null;
  dosage_unit: string | null;
  dosage_form: string | null;
  frequency: string | null;
  times: string[];
  days_of_week: string[];
  time_slots: Record<string, unknown> | null;
  instructions: string | null;
  note: string | null;
  active: boolean;
  reminder_enabled: boolean;
  created_at: string;
}

export interface VitalsLog {
  id: string;
  user_id: string | null;
  patient_id: string | null;
  // Vital signs
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  pulse: number | null;
  glucose: number | null;
  weight: number | null;
  temperature: number | null;
  spo2: number | null;
  // Metadata
  notes: string | null;
  measured_at: string | null;
  measured_at_text: string | null;
  source: DataSource;
  // AI extraction
  ai_confidence: number | null;
  raw_text: string | null;
  // References
  conversation_log_id: string | null;
  activity_log_id: string | null;
  logged_by_line_user_id: string | null;
  logged_by_display_name: string | null;
}

export interface Symptom {
  id: string;
  patient_id: string;
  symptom_name: string;
  symptom_name_en: string | null;
  severity_1to5: number | null; // 1-5
  body_location: string | null;
  body_location_th: string | null;
  duration_text: string | null;
  duration_minutes: number | null;
  started_at: string | null;
  time_of_day: string | null;
  triggers: string | null;
  associated_symptoms: string[];
  // AI metadata
  ai_confidence: number | null;
  raw_text: string | null;
  notes: string | null;
  // References
  activity_log_id: string | null;
  conversation_log_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface SleepLog {
  id: string;
  patient_id: string;
  sleep_date: string;
  sleep_time: string | null;
  wake_time: string | null;
  sleep_hours: number | null;
  sleep_quality: SleepQuality | null;
  sleep_quality_score: number | null; // 1-5
  wake_ups: number | null;
  sleep_issues: string[];
  factors: string[];
  // AI metadata
  ai_confidence: number | null;
  raw_text: string | null;
  // References
  activity_log_id: string | null;
  conversation_log_id: string | null;
  created_at: string;
}

export interface ExerciseLog {
  id: string;
  patient_id: string;
  exercise_date: string;
  exercise_type: string | null;
  exercise_type_th: string | null;
  duration_minutes: number | null;
  intensity: string | null;
  distance_meters: number | null;
  calories_burned: number | null;
  steps: number | null;
  time_of_day: string | null;
  started_at: string | null;
  ended_at: string | null;
  // AI metadata
  ai_confidence: number | null;
  raw_text: string | null;
  // References
  activity_log_id: string | null;
  conversation_log_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface MoodLog {
  id: string;
  user_id: string | null;
  patient_id: string | null;
  mood: string | null;
  mood_score: number | null; // 1-5
  stress_level: StressLevel | null;
  stress_cause: string | null;
  energy_level: string | null;
  activities: Record<string, unknown>[] | null;
  note: string | null;
  notes: string | null;
  // AI metadata
  ai_confidence: number | null;
  raw_text: string | null;
  // References
  activity_log_id: string | null;
  conversation_log_id: string | null;
  logged_by_line_user_id: string | null;
  timestamp: string;
}

// ============================================
// REMINDERS & GOALS
// ============================================

export interface Reminder {
  id: string;
  patient_id: string;
  type: ReminderType;
  title: string | null;
  time: string;
  days: string[];
  days_of_week: Record<string, unknown> | null;
  custom_time: string | null;
  frequency: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthGoal {
  id: string;
  patient_id: string;
  // Targets
  target_bp_systolic: number | null;
  target_bp_diastolic: number | null;
  target_water_ml: number | null;
  target_water_glasses: number | null;
  target_exercise_minutes: number | null;
  target_exercise_days_per_week: number | null;
  target_sleep_hours: number | null;
  target_steps: number | null;
  updated_at: string;
}

// ============================================
// LINK CODES
// ============================================

export interface LinkCode {
  id: string;
  patient_id: string;
  code: string; // 6-digit
  expires_at: string;
  used: boolean;
  created_at: string;
}

// ============================================
// FORM DATA TYPES (for Registration)
// ============================================

export interface PatientRegistrationData {
  // Step 1: Basic Info
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  gender: Gender;
  // Step 2: Health Info
  weightKg: number | null;
  heightCm: number | null;
  bloodType: string;
  chronicDiseases: string[];
  drugAllergies: string[];
  foodAllergies: string[];
  // Step 3: Medications
  medications: Array<{
    name: string;
    dosage: string;
    times: string[];
  }>;
  // Step 4: Emergency Contact
  address: string;
  phoneNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export interface CaregiverRegistrationData {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface GroupRegistrationData {
  lineGroupId: string;
  groupName: string;
  caregiver: CaregiverRegistrationData;
  patient: PatientRegistrationData;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface RegistrationCheckResponse {
  isRegistered: boolean;
  role: UserRole | null;
  profileId: string | null;
  patientId: string | null;
  caregiverId: string | null;
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  data: {
    userId?: string;
    profileId?: string;
    patientId?: string;
    caregiverId?: string;
  };
}
