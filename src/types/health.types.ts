/**
 * Health Data Types
 * สำหรับระบบบันทึกสุขภาพผ่านบทสนทนา (AI Extraction)
 */

// ========================================
// Symptoms (อาการ)
// ========================================

export interface Symptom {
  id: string;
  patientId: string;
  activityLogId?: string;
  conversationLogId?: string;

  // Symptom Data
  symptomName: string;           // 'ปวดหัว', 'มึนหัว', 'ไอ'
  symptomNameEn?: string;        // 'headache', 'dizziness', 'cough'
  severity1to5?: number;         // 1-5
  bodyLocation?: string;         // 'head', 'back', 'chest'
  bodyLocationTh?: string;       // 'หัว', 'หลัง', 'หน้าอก'

  // Duration
  durationText?: string;         // '2 วัน', '3-4 สัปดาห์'
  durationMinutes?: number;      // parsed duration
  startedAt?: Date;

  // Context
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  triggers?: string;             // สาเหตุที่เป็นไปได้
  associatedSymptoms?: string[]; // อาการร่วม

  // AI Metadata
  aiConfidence?: number;         // 0.00 - 1.00
  rawText?: string;              // ข้อความต้นฉบับ

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SymptomSeverity = 1 | 2 | 3 | 4 | 5;

export type BodyLocation =
  | 'head' | 'neck' | 'chest' | 'back'
  | 'abdomen' | 'arm' | 'leg' | 'joint'
  | 'whole_body' | 'other';

// ========================================
// Sleep Logs (การนอน)
// ========================================

export interface SleepLog {
  id: string;
  patientId: string;
  activityLogId?: string;
  conversationLogId?: string;

  // Sleep Data
  sleepDate: Date;
  sleepTime?: string;            // HH:MM เวลาเข้านอน
  wakeTime?: string;             // HH:MM เวลาตื่น
  sleepHours?: number;           // ชั่วโมงนอน (decimal)

  // Quality
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  sleepQualityScore?: number;    // 1-5
  wakeUps?: number;              // จำนวนครั้งที่ตื่นกลางคืน

  // Context
  sleepIssues?: string[];        // ['นอนไม่หลับ', 'ตื่นกลางดึก', 'ฝันร้าย']
  factors?: string[];            // ['เครียด', 'กาแฟ', 'ออกกำลังกาย']

  // AI Metadata
  aiConfidence?: number;
  rawText?: string;

  notes?: string;
  createdAt: Date;
}

export type SleepQuality = 'poor' | 'fair' | 'good' | 'excellent';

// ========================================
// Exercise Logs (การออกกำลังกาย)
// ========================================

export interface ExerciseLog {
  id: string;
  patientId: string;
  activityLogId?: string;
  conversationLogId?: string;

  // Exercise Data
  exerciseDate: Date;
  exerciseType?: string;         // 'walk', 'gym', 'swim', 'yoga', 'run'
  exerciseTypeTh?: string;       // 'เดิน', 'ฟิตเนส', 'ว่ายน้ำ'

  // Duration & Intensity
  durationMinutes?: number;
  intensity?: 'light' | 'medium' | 'intense';

  // Additional Data
  distanceMeters?: number;       // ระยะทาง
  caloriesBurned?: number;       // แคลอรี่
  steps?: number;                // จำนวนก้าว

  // Time Context
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  startedAt?: Date;
  endedAt?: Date;

  // AI Metadata
  aiConfidence?: number;
  rawText?: string;

  notes?: string;
  createdAt: Date;
}

export type ExerciseType =
  | 'walk' | 'run' | 'gym' | 'swim'
  | 'yoga' | 'bike' | 'aerobic' | 'tai_chi'
  | 'stretch' | 'other';

export type ExerciseIntensity = 'light' | 'medium' | 'intense';

// ========================================
// Health Events (Linking Table)
// ========================================

export interface HealthEvent {
  id: string;
  patientId: string;
  conversationLogId?: string;
  activityLogId?: string;

  // Event Classification
  eventType: HealthEventType;
  eventSubtype?: string;         // e.g., 'blood_pressure', 'headache'

  // Timing
  eventDate: Date;
  eventTime?: string;            // HH:MM
  eventTimestamp: Date;

  // Reference to specific table
  referenceTable?: string;       // 'symptoms', 'vitals_logs', 'sleep_logs', etc.
  referenceId?: string;          // ID in that table

  // AI Extraction Info
  rawText?: string;              // ข้อความต้นฉบับที่ extract มา
  aiConfidence?: number;         // 0.00 - 1.00
  extractionModel?: string;      // 'claude-3-sonnet', etc.

  // Quick Summary (denormalized for fast queries)
  summaryText?: string;          // "ปวดหัว ระดับ 3/5"
  summaryJson?: Record<string, any>; // key values for quick access

  createdAt: Date;
}

export type HealthEventType =
  | 'symptom'
  | 'vital'
  | 'mood'
  | 'sleep'
  | 'exercise'
  | 'medication'
  | 'water'
  | 'food'
  | 'medical_record';

// ========================================
// Vitals Logs (Enhanced)
// ========================================

export interface VitalsLog {
  id: string;
  userId?: string;               // Legacy
  patientId?: string;            // New
  conversationLogId?: string;
  activityLogId?: string;

  // Vitals Data
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  glucose?: number;
  weight?: number;
  temperature?: number;
  spo2?: number;

  // Context
  source?: 'manual' | 'text' | 'image' | 'device';
  measuredAtText?: string;       // "เมื่อเช้า 8:30 น."
  measuredAt: Date;

  // AI Metadata
  aiConfidence?: number;
  rawText?: string;
  loggedByLineUserId?: string;
  loggedByDisplayName?: string;

  notes?: string;
}

// ========================================
// Mood Logs (Enhanced)
// ========================================

export interface MoodLog {
  id: string;
  userId?: string;               // Legacy
  patientId?: string;            // New
  conversationLogId?: string;
  activityLogId?: string;

  // Mood Data
  mood: MoodType;
  moodScore?: number;            // 1-5

  // Enhanced fields
  stressLevel?: 'low' | 'medium' | 'high';
  stressCause?: string;
  energyLevel?: 'low' | 'medium' | 'high';

  // AI Metadata
  aiConfidence?: number;
  rawText?: string;
  loggedByLineUserId?: string;

  note?: string;
  activities?: string[];
  timestamp: Date;
}

export type MoodType =
  | 'happy' | 'neutral' | 'tired'
  | 'sad' | 'anxious' | 'exhausted'
  | 'stressed' | 'calm' | 'excited';

// ========================================
// Conversation Logs (Enhanced)
// ========================================

export interface ConversationLog {
  id: string;
  userId?: string;
  patientId?: string;
  groupId?: string;

  // Message Data
  role: 'user' | 'assistant' | 'system';
  text: string;
  intent?: string;
  flags?: any[];

  // Media
  messageId?: string;
  replyToken?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'file';

  // AI Extraction
  aiExtractedData?: AIExtractedData;
  aiConfidence?: number;
  aiModel?: string;

  // Context
  source?: '1:1' | 'group';
  timestamp: Date;
}

// ========================================
// AI Extraction Types
// ========================================

export interface AIExtractedData {
  intent: AIIntent;

  profileUpdate?: {
    displayName?: string;
    birthYear?: number;
    gender?: 'male' | 'female';
  };

  symptoms?: ExtractedSymptom[];
  vitals?: ExtractedVitals;
  mood?: ExtractedMood;
  sleep?: ExtractedSleep;
  exercise?: ExtractedExercise;
  medication?: ExtractedMedication;
  water?: ExtractedWater;
  medicalInfo?: ExtractedMedicalInfo;

  confidence: number;
  requiresFollowup: boolean;
  followupQuestion?: string;
}

export type AIIntent =
  | 'report_symptom'
  | 'report_vital'
  | 'report_mood'
  | 'report_sleep'
  | 'report_exercise'
  | 'report_medication'
  | 'report_water'
  | 'general_chat'
  | 'greeting'
  | 'question';

export interface ExtractedSymptom {
  symptomName: string;
  symptomNameEn?: string;
  severity1to5?: number;
  bodyLocation?: string;
  durationText?: string;
  durationMinutes?: number;
  timeOfDay?: string;
  triggers?: string;
}

export interface ExtractedVitals {
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  weight?: number;
  temperature?: number;
  glucose?: number;
  spo2?: number;
  measuredAtText?: string;
}

export interface ExtractedMood {
  mood?: MoodType;
  moodScore?: number;
  stressLevel?: 'low' | 'medium' | 'high';
  stressCause?: string;
  energyLevel?: 'low' | 'medium' | 'high';
}

export interface ExtractedSleep {
  sleepHours?: number;
  sleepTime?: string;
  wakeTime?: string;
  sleepQuality?: SleepQuality;
  wakeUps?: number;
}

export interface ExtractedExercise {
  exerciseType?: string;
  durationMinutes?: number;
  intensity?: ExerciseIntensity;
  timeOfDay?: string;
}

export interface ExtractedMedication {
  medicationName?: string;
  taken?: boolean;
  timeTaken?: string;
}

export interface ExtractedWater {
  amountMl?: number;
}

export interface ExtractedMedicalInfo {
  diagnosis?: string;
  doctorNote?: string;
  hospitalName?: string;
}

// ========================================
// Health Goals (Enhanced)
// ========================================

export interface HealthGoals {
  id: string;
  patientId: string;

  // Blood Pressure
  targetBpSystolic: number;
  targetBpDiastolic: number;

  // Blood Sugar
  targetBloodSugarFasting: number;
  targetBloodSugarPostMeal: number;

  // Water
  targetWaterMl: number;
  targetWaterGlasses?: number;   // New

  // Exercise
  targetExerciseMinutes: number;
  targetExerciseDaysPerWeek: number;
  targetSteps?: number;          // New

  // Sleep
  targetSleepHours?: number;     // New

  // Weight
  targetWeightKg?: number;

  updatedAt: Date;
}

// ========================================
// Database Insert Types (snake_case for Supabase)
// ========================================

export interface SymptomInsert {
  patient_id: string;
  activity_log_id?: string;
  conversation_log_id?: string;
  symptom_name: string;
  symptom_name_en?: string;
  severity_1to5?: number;
  body_location?: string;
  body_location_th?: string;
  duration_text?: string;
  duration_minutes?: number;
  started_at?: string;
  time_of_day?: string;
  triggers?: string;
  associated_symptoms?: string[];
  ai_confidence?: number;
  raw_text?: string;
  notes?: string;
}

export interface SleepLogInsert {
  patient_id: string;
  activity_log_id?: string;
  conversation_log_id?: string;
  sleep_date?: string;
  sleep_time?: string;
  wake_time?: string;
  sleep_hours?: number;
  sleep_quality?: string;
  sleep_quality_score?: number;
  wake_ups?: number;
  sleep_issues?: string[];
  factors?: string[];
  ai_confidence?: number;
  raw_text?: string;
  notes?: string;
}

export interface ExerciseLogInsert {
  patient_id: string;
  activity_log_id?: string;
  conversation_log_id?: string;
  exercise_date?: string;
  exercise_type?: string;
  exercise_type_th?: string;
  duration_minutes?: number;
  intensity?: string;
  distance_meters?: number;
  calories_burned?: number;
  steps?: number;
  time_of_day?: string;
  started_at?: string;
  ended_at?: string;
  ai_confidence?: number;
  raw_text?: string;
  notes?: string;
}

export interface HealthEventInsert {
  patient_id: string;
  conversation_log_id?: string;
  activity_log_id?: string;
  event_type: string;
  event_subtype?: string;
  event_date?: string;
  event_time?: string;
  event_timestamp?: string;
  reference_table?: string;
  reference_id?: string;
  raw_text?: string;
  ai_confidence?: number;
  extraction_model?: string;
  summary_text?: string;
  summary_json?: Record<string, any>;
}
