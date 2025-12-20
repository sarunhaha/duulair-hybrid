/**
 * User Registration & Profile Types
 * สำหรับระบบลงทะเบียนผู้ใช้งาน (Patient & Caregiver)
 */

// ========================================
// Base User
// ========================================

export interface User {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  role: 'patient' | 'caregiver';
  language: 'th' | 'en';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Patient Profile
// ========================================

export interface PatientProfile {
  id: string;
  userId: string;

  // ข้อมูลพื้นฐาน
  firstName: string;
  lastName: string;
  nickname?: string;
  birthDate: Date;
  gender: 'male' | 'female' | 'other';
  age?: number; // calculated

  // ข้อมูลสุขภาพ
  weightKg?: number;
  heightCm?: number;
  bmi?: number; // calculated
  bloodType?: string; // 'A+', 'B-', etc.
  medicalCondition?: string; // โรคประจำตัว (free text)
  chronicDiseases: string[]; // โรคเรื้อรัง ['hypertension', 'diabetes', ...]
  drugAllergies: string[];
  foodAllergies: string[];

  // ข้อมูลติดต่อ
  address?: string;
  phoneNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Caregiver Profile
// ========================================

export interface CaregiverProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Patient-Caregiver Relationship
// ========================================

export interface PatientCaregiver {
  id: string;
  patientId: string;
  caregiverId: string;
  relationship: 'child' | 'grandchild' | 'sibling' | 'friend' | 'caregiver' | 'other';
  isPrimary: boolean;
  accessLevel: 'full' | 'limited';

  // Notification settings
  notifyEmergency: boolean;
  notifyMedication: boolean;
  notifyDailyReport: boolean;
  notifyAbnormalVitals: boolean;

  status: 'pending' | 'active' | 'rejected';
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Link Code (for patient-caregiver linking)
// ========================================

export interface LinkCode {
  id: string;
  patientId: string;
  code: string; // 6 digits
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

// ========================================
// Patient Medication
// ========================================

export interface PatientMedication {
  id: string;
  patientId: string;
  name: string;
  dosage: string; // '500mg', '1 เม็ด'
  frequency: ('morning' | 'afternoon' | 'evening' | 'bedtime')[];
  startedAt: Date;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Health Goals
// ========================================

export interface HealthGoals {
  id: string;
  patientId: string;

  // ความดัน
  targetBpSystolic: number;
  targetBpDiastolic: number;

  // น้ำตาล
  targetBloodSugarFasting: number;
  targetBloodSugarPostMeal: number;

  // น้ำ
  targetWaterMl: number;

  // ออกกำลังกาย
  targetExerciseMinutes: number;
  targetExerciseDaysPerWeek: number;

  // น้ำหนัก
  targetWeightKg?: number;

  updatedAt: Date;
}

// ========================================
// Notification Settings
// ========================================

export interface NotificationSettings {
  id: string;
  patientId: string;

  // เวลาเตือน
  medicationReminderTimes: string[]; // ['08:00', '20:00']
  waterReminderIntervalHours: number;
  waterReminderStart: string; // '07:00'
  waterReminderEnd: string; // '21:00'
  exerciseReminderTime: string;
  dailyReportTime: string;

  // เปิด/ปิด
  medicationRemindersEnabled: boolean;
  waterRemindersEnabled: boolean;
  exerciseRemindersEnabled: boolean;
  dailyReportsEnabled: boolean;

  updatedAt: Date;
}

// ========================================
// Registration Forms
// ========================================

export interface PatientRegistrationForm {
  // Basic
  firstName: string;
  lastName: string;
  nickname?: string;
  birthDate: string; // ISO date string
  gender: 'male' | 'female' | 'other';

  // Health
  weightKg?: number;
  heightCm?: number;
  bloodType?: string;
  medicalCondition?: string; // โรคประจำตัว
  chronicDiseases: string[]; // โรคเรื้อรัง
  drugAllergies?: string[];
  foodAllergies?: string[];

  // Medications
  medications: {
    name: string;
    dosage: string;
    frequency: string[];
  }[];

  // Contact
  address?: string;
  phoneNumber?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;

  // Goals (optional, use defaults)
  healthGoals?: Partial<HealthGoals>;
}

export interface CaregiverRegistrationForm {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  relationship: string;
  linkCode?: string; // รหัสเชื่อมต่อจาก patient
}

// ========================================
// API Response Types
// ========================================

export interface RegistrationCheckResponse {
  exists: boolean;
  role?: 'patient' | 'caregiver';
  profile?: PatientProfile | CaregiverProfile;
}

export interface PatientRegistrationResponse {
  success: boolean;
  user: User;
  profile: PatientProfile;
  linkCode: string; // 6-digit code
  qrCode: string; // base64 QR code image
}

export interface CaregiverRegistrationResponse {
  success: boolean;
  user: User;
  profile: CaregiverProfile;
  linkedPatients?: PatientProfile[];
}

export interface LinkCodeResponse {
  code: string;
  qrCode: string; // base64 QR code image
  expiresAt: Date;
}

export interface LinkPatientResponse {
  success: boolean;
  relationship: PatientCaregiver;
  patient: PatientProfile;
}

export interface ApproveCaregiverResponse {
  success: boolean;
  relationship: PatientCaregiver;
}

// ========================================
// Utility Types
// ========================================

export type ChronicDisease =
  | 'hypertension'      // ความดันโลหิตสูง
  | 'diabetes'          // เบาหวาน
  | 'heart_disease'     // โรคหัวใจ
  | 'high_cholesterol'  // ไขมันในเลือดสูง
  | 'kidney_disease'    // โรคไต
  | 'stroke'            // โรคหลอดเลือดสมอง
  | 'copd'              // ปอดอุดกั้นเรื้อรัง
  | 'asthma'            // โรคหอบหืด
  | 'arthritis'         // โรคข้ออักเสบ
  | 'other';            // อื่นๆ

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type MedicationFrequency = 'morning' | 'afternoon' | 'evening' | 'bedtime';

export type CaregiverRelationship =
  | 'child'       // ลูก
  | 'grandchild'  // หลาน
  | 'sibling'     // พี่น้อง
  | 'spouse'      // คู่สมรส
  | 'friend'      // เพื่อน
  | 'caregiver'   // คนดูแล
  | 'other';      // อื่นๆ

// ========================================
// Group-Based Care (TASK-002)
// ========================================

export interface Group {
  id: string;
  lineGroupId: string; // LINE Group ID
  groupName?: string;
  primaryCaregiverId: string;
  activePatientId?: string; // Currently selected patient (NULL = use first)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Populated fields (optional, for API responses)
  patients?: PatientProfile[]; // Multiple patients support
  activePatient?: PatientProfile; // Currently active patient
  primaryCaregiver?: CaregiverProfile;
  members?: GroupMember[];
}

export interface GroupPatient {
  id: string;
  groupId: string;
  patientId: string;
  addedByCaregiverId?: string;
  addedAt: Date;
  isActive: boolean;

  // Populated fields
  patient?: PatientProfile;
}

export interface GroupMember {
  id: string;
  groupId: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  role: 'caregiver' | 'patient' | 'family';
  isActive: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

export interface GroupRegistrationForm {
  lineGroupId: string;
  groupName?: string;

  // Caregiver info
  caregiver: {
    lineUserId: string;
    displayName: string;
    pictureUrl?: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  };

  // Patient info
  patient: {
    firstName: string;
    lastName: string;
    nickname?: string;
    birthDate: string; // ISO date
    gender: 'male' | 'female' | 'other';
    weightKg?: number;
    heightCm?: number;
    bloodType?: string;
    medicalCondition?: string; // โรคประจำตัว
    chronicDiseases: string[]; // โรคเรื้อรัง
    drugAllergies?: string[];
    foodAllergies?: string[];
    address?: string;
    phoneNumber?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;

    // Optional: if patient has LINE
    lineUserId?: string;
    displayName?: string;
    pictureUrl?: string;
  };
}

export interface GroupRegistrationResponse {
  success: boolean;
  group: Group;
  message: string;
}

export interface GroupInfoResponse {
  success: boolean;
  group: Group;
  patient: PatientProfile;
  patients?: PatientProfile[];  // All patients in the group (TASK-002)
  primaryCaregiver: CaregiverProfile;
  members: GroupMember[];
}

export interface GroupCheckResponse {
  exists: boolean;
  group?: Group;
  patient?: PatientProfile; // For backward compatibility - first patient
  patients?: PatientProfile[]; // All patients in group
  primaryCaregiver?: CaregiverProfile;
}

export interface AddGroupMemberRequest {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  role: 'caregiver' | 'patient' | 'family';
}

export interface AddGroupMemberResponse {
  success: boolean;
  member: GroupMember;
}

// ========================================
// Caregiver Patient Preferences (Phase 4)
// ========================================

export interface CaregiverPatientPreference {
  id: string;
  groupId: string;
  caregiverLineUserId: string;
  defaultPatientId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetDefaultPatientRequest {
  groupId: string;
  caregiverLineUserId: string;
  patientId: string;
}

export interface SetDefaultPatientResponse {
  success: boolean;
  message: string;
  preference?: CaregiverPatientPreference;
}

export interface GetDefaultPatientResponse {
  hasDefault: boolean;
  patientId?: string;
  patientName?: string;
}

// ========================================
// Activity Logs (TASK-002)
// ========================================

export interface ActivityLog {
  id?: string;
  patient_id: string;
  task_type: string;
  value?: any;
  timestamp: Date;

  // Group-based fields (TASK-002)
  group_id?: string | null;
  actor_line_user_id?: string | null;
  actor_display_name?: string | null;
  source?: '1:1' | 'group';

  // Additional metadata
  message_id?: string;
  intent?: string;
  processing_result?: any;
}

export interface CreateActivityLogRequest {
  patient_id: string;
  task_type: string;
  value?: any;
  timestamp?: Date;

  // Group context (optional)
  group_id?: string;
  actor_line_user_id?: string;
  actor_display_name?: string;
  source?: '1:1' | 'group';
}

// ========================================
// Helper Functions Types
// ========================================

export interface UserUtils {
  calculateAge(birthDate: Date): number;
  calculateBMI(weightKg: number, heightCm: number): number;
  generateLinkCode(): string;
  validateLinkCode(code: string): boolean;
  formatThaiDate(date: Date): string;
}
