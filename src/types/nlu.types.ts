// src/types/nlu.types.ts
// Type definitions for Natural Language Understanding (NLU) system

/**
 * Main intent categories for health conversations
 */
export type MainIntent =
  | 'health_log'
  | 'profile_update'
  | 'medication_manage'
  | 'reminder_manage'
  | 'query'
  | 'emergency'
  | 'greeting'
  | 'general_chat';

/**
 * Sub-intents for health_log
 */
export type HealthLogSubIntent =
  | 'medication'
  | 'vitals'
  | 'water'
  | 'exercise'
  | 'food'
  | 'sleep'
  | 'symptom'
  | 'mood';

/**
 * Sub-intents for profile_update
 */
export type ProfileUpdateSubIntent =
  | 'weight'
  | 'height'
  | 'phone'
  | 'address'
  | 'blood_type'
  | 'allergies'
  | 'medical_condition'
  | 'emergency_contact';

/**
 * Sub-intents for medication_manage
 */
export type MedicationManageSubIntent =
  | 'add'
  | 'edit'
  | 'delete'
  | 'list';

/**
 * Sub-intents for reminder_manage
 */
export type ReminderManageSubIntent =
  | 'add'
  | 'edit'
  | 'delete'
  | 'list';

/**
 * Sub-intents for query
 */
export type QuerySubIntent =
  | 'patient_info'
  | 'medication_list'
  | 'reminder_list'
  | 'report'
  | 'history';

/**
 * All possible sub-intents
 */
export type SubIntent =
  | HealthLogSubIntent
  | ProfileUpdateSubIntent
  | MedicationManageSubIntent
  | ReminderManageSubIntent
  | QuerySubIntent
  | null;

/**
 * Time period indicators
 */
export type TimePeriod =
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'just_now'
  | 'specific';

/**
 * Extracted entities from user message
 */
export interface NLUEntities {
  patientName?: string | null;
  patientId?: string | null;
  time?: TimePeriod | null;
  timeValue?: string | null;
  values?: Record<string, any>;
}

/**
 * Medication-related health data
 */
export interface MedicationHealthData {
  taken: boolean;
  medicationName?: string | null;
  allMedications?: boolean;
  dosage?: string | null;
  time?: string | null;
}

/**
 * Vitals-related health data
 */
export interface VitalsHealthData {
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRate?: number;
  bloodSugar?: number;
  temperature?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
}

/**
 * Water intake health data
 */
export interface WaterHealthData {
  amount_ml?: number;
  glasses?: number;
}

/**
 * Exercise health data
 */
export interface ExerciseHealthData {
  type?: string;
  duration_minutes?: number;
  distance_km?: number;
  steps?: number;
  intensity?: 'light' | 'moderate' | 'vigorous';
}

/**
 * Food/meal health data
 */
export interface FoodHealthData {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description?: string;
  calories?: number;
}

/**
 * Sleep health data
 */
export interface SleepHealthData {
  duration_hours?: number;
  quality?: 'good' | 'fair' | 'poor';
  bedTime?: string;
  wakeTime?: string;
}

/**
 * Symptom health data
 */
export interface SymptomHealthData {
  symptom: string;
  severity?: 'mild' | 'moderate' | 'severe';
  duration?: string;
  location?: string;
  notes?: string;
}

/**
 * Mood health data
 */
export interface MoodHealthData {
  mood: string;
  stressLevel?: number; // 1-10
  energyLevel?: number; // 1-10
  notes?: string;
}

/**
 * Combined health data type
 */
export interface NLUHealthData {
  type: HealthLogSubIntent;
  medication?: MedicationHealthData;
  vitals?: VitalsHealthData;
  water?: WaterHealthData;
  exercise?: ExerciseHealthData;
  food?: FoodHealthData;
  sleep?: SleepHealthData;
  symptom?: SymptomHealthData;
  mood?: MoodHealthData;
}

/**
 * Action types that can be performed
 */
export type ActionType =
  | 'save'
  | 'update'
  | 'delete'
  | 'query'
  | 'confirm'
  | 'clarify'
  | 'none';

/**
 * Database tables that can be targeted
 */
export type ActionTarget =
  | 'activity_logs'
  | 'vitals_logs'
  | 'mood_logs'
  | 'sleep_logs'
  | 'exercise_logs'
  | 'symptoms'
  | 'medications'
  | 'reminders'
  | 'patient_profiles'
  | 'health_events';

/**
 * Action to be executed based on NLU result
 */
export interface NLUAction {
  type: ActionType;
  target?: ActionTarget;
  data?: Record<string, any>;
  requireConfirmation?: boolean;
}

/**
 * Complete NLU result from Claude
 */
export interface NLUResult {
  intent: MainIntent;
  subIntent: SubIntent;
  confidence: number;
  entities: NLUEntities;
  healthData?: NLUHealthData | null;
  action: NLUAction;
  response: string;
  followUp?: string | null;
}

/**
 * Context passed to NLU for processing
 */
export interface NLUContext {
  userId: string;
  patientId?: string;
  groupId?: string;
  isGroupChat: boolean;
  voiceConfirmed?: boolean; // Voice transcription already confirmed by user - execute immediately
  patientData?: {
    profile?: any;
    medications?: any[];
    reminders?: any[];
    recentActivities?: any[];
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
}

/**
 * Input to NLU processing
 */
export interface NLUInput {
  message: string;
  context: NLUContext;
}

/**
 * Result of action execution
 */
export interface ActionResult {
  success: boolean;
  savedRecords?: number;
  errors?: string[];
  data?: any;
  alerts?: string[];
}

/**
 * Final response after NLU + Action execution
 */
export interface NLUProcessingResult {
  nluResult: NLUResult;
  actionResult?: ActionResult;
  response: string;
  flexMessage?: any;
}

/**
 * Abnormal value alert
 */
export interface AbnormalAlert {
  type: 'blood_pressure' | 'heart_rate' | 'blood_sugar' | 'oxygen' | 'temperature';
  value: string;
  severity: 'warning' | 'critical';
  message: string;
}

export default {
  // Export all types for convenience
};
