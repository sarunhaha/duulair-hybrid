# User Registration & LIFF App (ภาษาไทย)

> ระบบลงทะเบียนผู้ใช้งานผ่าน LINE LIFF พร้อมโปรไฟล์สุขภาพ

---

## Feature Name
ระบบลงทะเบียนและจัดการข้อมูลผู้ใช้ (User Registration & Profile Management)

## Overview
ระบบลงทะเบียนผู้ใช้งานผ่าน LINE LIFF รองรับ 2 บทบาท:
1. **ผู้ป่วย/ผู้สูงอายุ** - บันทึกข้อมูลสุขภาพส่วนตัว
2. **ผู้ดูแล/ญาติ** - เชื่อมต่อกับผู้ป่วยเพื่อติดตามดูแล

รองรับภาษาไทยทั้งระบบ พร้อม UI ที่เข้าใจง่ายสำหรับผู้สูงอายุ

## User Story

### Patient
**As a** ผู้สูงอายุที่ต้องการใช้ระบบดูแลสุขภาพ
**I want** ลงทะเบียนง่ายๆ ผ่าน LINE
**So that** ระบบเก็บข้อมูลส่วนตัวและสุขภาพของผม

### Caregiver
**As a** ญาติผู้ดูแลผู้สูงอายุ
**I want** ลงทะเบียนและเชื่อมต่อกับบัญชีผู้ป่วย
**So that** ติดตามและรับแจ้งเตือนสุขภาพของคนในครอบครัว

## Requirements

### Functional Requirements

#### FR-1: LINE LIFF App
- [ ] FR-1.1: เปิด LIFF App จาก Rich Menu หรือ Flex Message
- [ ] FR-1.2: Auto-login ด้วย LINE Account (OAuth)
- [ ] FR-1.3: ตรวจสอบสถานะการลงทะเบียน
- [ ] FR-1.4: UI ภาษาไทย responsive สำหรับมือถือ
- [ ] FR-1.5: Font ใหญ่ ชัดเจน อ่านง่ายสำหรับผู้สูงอายุ

#### FR-2: Role Selection (เลือกบทบาท)
- [ ] FR-2.1: เลือกบทบาท: "ผู้ป่วย" หรือ "ผู้ดูแล"
- [ ] FR-2.2: อธิบายความแตกต่างของแต่ละบทบาท
- [ ] FR-2.3: สามารถเปลี่ยนบทบาทได้ภายหลัง (ถ้ากรอกผิด)

#### FR-3: Patient Profile Setup
- [ ] FR-3.1: ข้อมูลพื้นฐาน
  - ชื่อ-นามสกุล (ภาษาไทย)
  - ชื่อเล่น
  - วันเกิด (เลือกจากปฏิทิน)
  - เพศ (ชาย/หญิง/ไม่ระบุ)
  - อายุ (คำนวณอัตโนมัติจากวันเกิด)

- [ ] FR-3.2: ข้อมูลสุขภาพ
  - น้ำหนัก (กิโลกรัม)
  - ส่วนสูง (เซนติเมตร)
  - กรุ๊ปเลือด (A/B/AB/O, Rh+/-)
  - โรคประจำตัว (เลือกได้หลายโรค)
    - ความดันโลหิตสูง
    - เบาหวาน
    - โรคหัวใจ
    - ไขมันในเลือดสูง
    - โรคไต
    - อื่นๆ (ระบุ)
  - การแพ้ยา (ระบุชื่อยา)
  - การแพ้อาหาร (ระบุ)

- [ ] FR-3.3: ยาที่กินประจำ
  - เพิ่มรายการยาได้หลายรายการ
  - ชื่อยา (ภาษาไทย)
  - ขนาด (เช่น 500mg)
  - เวลา (เช้า/กลางวัน/เย็น/ก่อนนอน)
  - วันที่เริ่มกิน

- [ ] FR-3.4: ข้อมูลติดต่อฉุกเฉิน
  - ที่อยู่ปัจจุบัน (เต็มรูปแบบ)
  - เบอร์โทรศัพท์ของตัวเอง
  - เบอร์โทรศัพท์ญาติ (อย่างน้อย 1 คน)

#### FR-4: Caregiver Profile Setup
- [ ] FR-4.1: ข้อมูลส่วนตัว
  - ชื่อ-นามสกุล
  - ความสัมพันธ์กับผู้ป่วย (ลูก/หลาน/พี่น้อง/เพื่อน/คนดูแล)
  - เบอร์โทรศัพท์

- [ ] FR-4.2: เชื่อมต่อกับ Patient
  - ใส่รหัสเชื่อมต่อ 6 หลัก (ที่ patient สร้าง)
  - หรือสแกน QR Code
  - ส่งคำขอเชื่อมต่อ (รอ patient อนุมัติ)

- [ ] FR-4.3: แจ้งเตือน
  - เลือกประเภทการแจ้งเตือนที่ต้องการรับ
    - ☑️ ฉุกเฉิน (บังคับรับ)
    - ☐ ยาขาด
    - ☐ รายงานประจำวัน
    - ☐ ผลสุขภาพผิดปกติ

#### FR-5: Health Goals & Settings
- [ ] FR-5.1: เป้าหมายสุขภาพ (Patient only)
  - ความดันเป้าหมาย (systolic/diastolic)
  - น้ำตาลเป้าหมาย (fasting/post-meal)
  - น้ำต่อวัน (มิลลิลิตร, default 2000ml)
  - ออกกำลังกายต่อวัน (นาที, default 30 นาที)
  - น้ำหนักเป้าหมาย (ถ้าต้องการลด/เพิ่ม)

- [ ] FR-5.2: ตั้งค่าการแจ้งเตือน
  - เวลาเตือนกินยา
  - เวลาเตือนดื่มน้ำ (ทุก X ชั่วโมง)
  - เวลาเตือนออกกำลังกาย
  - เวลาส่งรายงานประจำวัน (default 20:00)

#### FR-6: Linking & Relationships
- [ ] FR-6.1: Patient สร้างรหัสเชื่อมต่อ
  - สร้างรหัส 6 หลัก (valid 24 ชม.)
  - หรือสร้าง QR Code
  - แชร์รหัสให้ caregiver

- [ ] FR-6.2: อนุมัติคำขอเชื่อมต่อ
  - Patient เห็นรายชื่อผู้ขอเชื่อมต่อ
  - อนุมัติหรือปฏิเสธ
  - ตั้งระดับการเข้าถึงข้อมูล

- [ ] FR-6.3: จัดการผู้ดูแล
  - ดูรายชื่อผู้ดูแลทั้งหมด
  - ตั้ง primary caregiver
  - ยกเลิกการเชื่อมต่อได้

#### FR-7: Profile Management
- [ ] FR-7.1: แก้ไขข้อมูล
  - แก้ไขข้อมูลส่วนตัวได้ทุกเวลา
  - แก้ไขยาประจำ
  - แก้ไขเป้าหมายสุขภาพ

- [ ] FR-7.2: Export ข้อมูล
  - ส่งออกข้อมูลเป็น PDF
  - สำหรับแสดงหมอ

### Technical Requirements
- [ ] TR-1: LINE LIFF SDK v2.x
- [ ] TR-2: React หรือ Vue.js สำหรับ frontend
- [ ] TR-3: Responsive design (mobile-first)
- [ ] TR-4: Font ใหญ่ชัดเจน (min 16px)
- [ ] TR-5: Support Thai language (UTF-8)
- [ ] TR-6: Form validation แบบ real-time
- [ ] TR-7: Auto-save drafts (localStorage)
- [ ] TR-8: Accessibility (WCAG 2.1 Level AA)

### Non-Functional Requirements
- [ ] NFR-1: LIFF App load time < 3 วินาที
- [ ] NFR-2: Form save time < 1 วินาที
- [ ] NFR-3: ใช้งานได้บนมือถือทุกรุ่น (iOS/Android)
- [ ] NFR-4: PDPA compliant (ข้อมูลส่วนตัว)
- [ ] NFR-5: Encrypted data transmission (HTTPS)

## Implementation Details

### Files to Create
```
liff/
  ├── public/
  │   ├── index.html
  │   └── assets/
  ├── src/
  │   ├── App.tsx (Main LIFF App)
  │   ├── pages/
  │   │   ├── RoleSelection.tsx
  │   │   ├── PatientRegistration.tsx
  │   │   ├── CaregiverRegistration.tsx
  │   │   ├── ProfileView.tsx
  │   │   ├── HealthGoals.tsx
  │   │   └── LinkPatient.tsx
  │   ├── components/
  │   │   ├── StepProgress.tsx
  │   │   ├── FormInput.tsx
  │   │   ├── DatePicker.tsx
  │   │   └── QRCode.tsx
  │   └── services/
  │       ├── liff.service.ts
  │       └── api.service.ts
  └── package.json

src/
  ├── routes/
  │   └── registration.routes.ts (NEW)
  ├── services/
  │   └── user.service.ts (NEW)
  └── types/
      └── user.types.ts (NEW)
```

### Files to Modify
- `src/index.ts` - Add registration routes
- `docs/database-schema.sql` - Add user tables

## Data Model

### Database Schema
```sql
-- Users (base table)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  picture_url TEXT,
  role VARCHAR(20) CHECK (role IN ('patient', 'caregiver')) NOT NULL,
  language VARCHAR(10) DEFAULT 'th',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Patient profiles
CREATE TABLE patient_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,

  -- ข้อมูลพื้นฐาน
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(50),
  birth_date DATE NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),

  -- ข้อมูลสุขภาพ
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  blood_type VARCHAR(5), -- 'A+', 'B-', etc.
  chronic_diseases TEXT[], -- ['hypertension', 'diabetes', ...]
  drug_allergies TEXT[],
  food_allergies TEXT[],

  -- ข้อมูลติดต่อ
  address TEXT,
  phone_number VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Caregiver profiles
CREATE TABLE caregiver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Patient-Caregiver relationships
CREATE TABLE patient_caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,
  caregiver_id UUID REFERENCES caregiver_profiles(id) NOT NULL,

  relationship VARCHAR(50), -- 'child', 'grandchild', 'sibling', 'caregiver'
  is_primary BOOLEAN DEFAULT FALSE,
  access_level VARCHAR(20) DEFAULT 'full', -- 'full', 'limited'

  -- Notification settings
  notify_emergency BOOLEAN DEFAULT TRUE,
  notify_medication BOOLEAN DEFAULT TRUE,
  notify_daily_report BOOLEAN DEFAULT TRUE,
  notify_abnormal_vitals BOOLEAN DEFAULT TRUE,

  status VARCHAR(20) CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending',
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(patient_id, caregiver_id)
);

-- Link codes (for patient-caregiver linking)
CREATE TABLE link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,
  code VARCHAR(6) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Medications (patient's current medications)
CREATE TABLE patient_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) NOT NULL,

  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100), -- '500mg', '1 เม็ด'
  frequency TEXT[], -- ['morning', 'evening']
  started_at DATE,
  notes TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Health goals
CREATE TABLE health_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) UNIQUE NOT NULL,

  -- ความดัน
  target_bp_systolic INTEGER DEFAULT 120,
  target_bp_diastolic INTEGER DEFAULT 80,

  -- น้ำตาล
  target_blood_sugar_fasting INTEGER DEFAULT 100,
  target_blood_sugar_post_meal INTEGER DEFAULT 140,

  -- น้ำ
  target_water_ml INTEGER DEFAULT 2000,

  -- ออกกำลังกาย
  target_exercise_minutes INTEGER DEFAULT 30,
  target_exercise_days_per_week INTEGER DEFAULT 5,

  -- น้ำหนัก
  target_weight_kg DECIMAL(5,2),

  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notification settings
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patient_profiles(id) UNIQUE NOT NULL,

  -- เวลาเตือน
  medication_reminder_times TIME[],
  water_reminder_interval_hours INTEGER DEFAULT 2,
  water_reminder_start TIME DEFAULT '07:00',
  water_reminder_end TIME DEFAULT '21:00',
  exercise_reminder_time TIME DEFAULT '08:00',
  daily_report_time TIME DEFAULT '20:00',

  -- เปิด/ปิด
  medication_reminders_enabled BOOLEAN DEFAULT TRUE,
  water_reminders_enabled BOOLEAN DEFAULT TRUE,
  exercise_reminders_enabled BOOLEAN DEFAULT TRUE,
  daily_reports_enabled BOOLEAN DEFAULT TRUE,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_line_id ON users(line_user_id);
CREATE INDEX idx_patient_user ON patient_profiles(user_id);
CREATE INDEX idx_caregiver_user ON caregiver_profiles(user_id);
CREATE INDEX idx_patient_caregivers_patient ON patient_caregivers(patient_id);
CREATE INDEX idx_patient_caregivers_caregiver ON patient_caregivers(caregiver_id);
CREATE INDEX idx_link_codes_code ON link_codes(code) WHERE NOT used AND expires_at > NOW();
```

### TypeScript Types
```typescript
// User base
interface User {
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

// Patient profile
interface PatientProfile {
  id: string;
  userId: string;

  // Basic info
  firstName: string;
  lastName: string;
  nickname?: string;
  birthDate: Date;
  gender: 'male' | 'female' | 'other';
  age?: number; // calculated

  // Health info
  weightKg?: number;
  heightCm?: number;
  bmi?: number; // calculated
  bloodType?: string;
  chronicDiseases: string[];
  drugAllergies: string[];
  foodAllergies: string[];

  // Contact
  address?: string;
  phoneNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  createdAt: Date;
  updatedAt: Date;
}

// Caregiver profile
interface CaregiverProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Relationship
interface PatientCaregiver {
  id: string;
  patientId: string;
  caregiverId: string;
  relationship: 'child' | 'grandchild' | 'sibling' | 'friend' | 'caregiver';
  isPrimary: boolean;
  accessLevel: 'full' | 'limited';

  // Notifications
  notifyEmergency: boolean;
  notifyMedication: boolean;
  notifyDailyReport: boolean;
  notifyAbnormalVitals: boolean;

  status: 'pending' | 'active' | 'rejected';
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Link code
interface LinkCode {
  id: string;
  patientId: string;
  code: string; // 6 digits
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

// Patient medication
interface PatientMedication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: ('morning' | 'afternoon' | 'evening' | 'bedtime')[];
  startedAt: Date;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Health goals
interface HealthGoals {
  id: string;
  patientId: string;

  targetBpSystolic: number;
  targetBpDiastolic: number;
  targetBloodSugarFasting: number;
  targetBloodSugarPostMeal: number;
  targetWaterMl: number;
  targetExerciseMinutes: number;
  targetExerciseDaysPerWeek: number;
  targetWeightKg?: number;

  updatedAt: Date;
}

// Notification settings
interface NotificationSettings {
  id: string;
  patientId: string;

  medicationReminderTimes: string[]; // ['08:00', '20:00']
  waterReminderIntervalHours: number;
  waterReminderStart: string; // '07:00'
  waterReminderEnd: string; // '21:00'
  exerciseReminderTime: string;
  dailyReportTime: string;

  medicationRemindersEnabled: boolean;
  waterRemindersEnabled: boolean;
  exerciseRemindersEnabled: boolean;
  dailyReportsEnabled: boolean;

  updatedAt: Date;
}

// Registration forms
interface PatientRegistrationForm {
  // Basic
  firstName: string;
  lastName: string;
  nickname?: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';

  // Health
  weightKg?: number;
  heightCm?: number;
  bloodType?: string;
  chronicDiseases: string[];
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

interface CaregiverRegistrationForm {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  linkCode?: string; // รหัสเชื่อมต่อจาก patient
}
```

## API Design

### Registration Endpoints
```typescript
// Check if user exists
POST /api/registration/check
Body: { lineUserId: string }
Response: {
  exists: boolean;
  role?: 'patient' | 'caregiver';
  profile?: PatientProfile | CaregiverProfile;
}

// Register as patient
POST /api/registration/patient
Body: PatientRegistrationForm
Response: {
  success: boolean;
  user: User;
  profile: PatientProfile;
  linkCode: string; // 6-digit code
}

// Register as caregiver
POST /api/registration/caregiver
Body: CaregiverRegistrationForm
Response: {
  success: boolean;
  user: User;
  profile: CaregiverProfile;
  linkedPatients?: PatientProfile[];
}

// Generate link code (patient)
POST /api/registration/generate-link-code
Body: { patientId: string }
Response: {
  code: string;
  qrCode: string; // base64 QR code image
  expiresAt: Date;
}

// Link to patient (caregiver)
POST /api/registration/link-patient
Body: {
  caregiverId: string;
  linkCode: string;
}
Response: {
  success: boolean;
  relationship: PatientCaregiver;
  patient: PatientProfile;
}

// Approve/reject caregiver link (patient)
POST /api/registration/approve-caregiver
Body: {
  relationshipId: string;
  approved: boolean;
}
Response: {
  success: boolean;
  relationship: PatientCaregiver;
}

// Update profile
PUT /api/profile/patient/:id
Body: Partial<PatientProfile>
Response: {
  success: boolean;
  profile: PatientProfile;
}

PUT /api/profile/caregiver/:id
Body: Partial<CaregiverProfile>
Response: {
  success: boolean;
  profile: CaregiverProfile;
}

// Health goals
GET /api/health-goals/:patientId
Response: HealthGoals

PUT /api/health-goals/:patientId
Body: Partial<HealthGoals>
Response: HealthGoals

// Notification settings
GET /api/notification-settings/:patientId
Response: NotificationSettings

PUT /api/notification-settings/:patientId
Body: Partial<NotificationSettings>
Response: NotificationSettings
```

## LIFF App UI/UX

### Color Scheme (ผู้สูงอายุ-friendly)
```css
:root {
  --primary: #4CAF50; /* เขียว - ปลอดภัย */
  --danger: #F44336; /* แดง - อันตราย */
  --warning: #FF9800; /* ส้ม - คำเตือน */
  --info: #2196F3; /* ฟ้า - ข้อมูล */
  --text: #212121; /* ดำ - อ่านง่าย */
  --background: #FAFAFA;

  --font-size-base: 18px; /* ใหญ่กว่าปกติ */
  --font-size-large: 24px;
  --button-height: 56px; /* สูงกว่าปกติ - กดง่าย */
}
```

### Registration Flow (Patient)

#### Step 1: Welcome & Role Selection
```
┌─────────────────────────┐
│  ยินดีต้อนรับสู่ Duulair  │
│                         │
│  [รูป Logo]             │
│                         │
│  คุณเป็นใคร?             │
│                         │
│  ┌───────────────────┐  │
│  │  👤 ผู้ป่วย        │  │
│  │  (ใช้ระบบบันทึก    │  │
│  │   สุขภาพตัวเอง)    │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │  👨‍⚕️ ผู้ดูแล       │  │
│  │  (ติดตามดูแล      │  │
│  │   คนในครอบครัว)    │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

#### Step 2: Patient Basic Info
```
┌─────────────────────────┐
│  📝 ข้อมูลพื้นฐาน        │
│  ขั้นตอน 1/4            │
│  ████░░░░               │
│                         │
│  ชื่อ *                 │
│  [กรอกชื่อ]             │
│                         │
│  นามสกุล *              │
│  [กรอกนามสกุล]          │
│                         │
│  ชื่อเล่น               │
│  [กรอกชื่อเล่น]         │
│                         │
│  วันเกิด *              │
│  [เลือกวันเกิด 📅]      │
│  (อายุ: 65 ปี)          │
│                         │
│  เพศ *                  │
│  ⚪ ชาย ⚪ หญิง ⚪ อื่นๆ │
│                         │
│  [ถัดไป →]             │
└─────────────────────────┘
```

#### Step 3: Health Info
```
┌─────────────────────────┐
│  🏥 ข้อมูลสุขภาพ         │
│  ขั้นตอน 2/4            │
│  ████████░░             │
│                         │
│  น้ำหนัก (กก.)          │
│  [65] กิโลกรัม          │
│                         │
│  ส่วนสูง (ซม.)          │
│  [165] เซนติเมตร        │
│  BMI: 23.9 (ปกติ ✓)    │
│                         │
│  กรุ๊ปเลือด              │
│  [เลือก ▼] A+ B+ AB+ O+ │
│                         │
│  โรคประจำตัว (เลือกได้หลายโรค) │
│  ☑️ ความดันโลหิตสูง      │
│  ☑️ เบาหวาน             │
│  ☐ โรคหัวใจ             │
│  ☐ ไขมันในเลือดสูง      │
│  ☐ โรคไต               │
│                         │
│  [← ก่อนหน้า]  [ถัดไป →] │
└─────────────────────────┘
```

#### Step 4: Medications & Allergies
```
┌─────────────────────────┐
│  💊 ยาและการแพ้          │
│  ขั้นตอน 3/4            │
│  ████████████░          │
│                         │
│  ยาที่กินประจำ          │
│                         │
│  ┌─────────────────┐    │
│  │ Metformin 500mg │    │
│  │ เช้า, เย็น      │    │
│  │ [แก้ไข] [ลบ]   │    │
│  └─────────────────┘    │
│                         │
│  [+ เพิ่มยา]            │
│                         │
│  แพ้ยา (ถ้ามี)          │
│  [ระบุชื่อยาที่แพ้]     │
│                         │
│  แพ้อาหาร (ถ้ามี)       │
│  [ระบุอาหารที่แพ้]      │
│                         │
│  [← ก่อนหน้า]  [ถัดไป →] │
└─────────────────────────┘
```

#### Step 5: Emergency Contact
```
┌─────────────────────────┐
│  🚨 ติดต่อฉุกเฉิน        │
│  ขั้นตอน 4/4            │
│  ████████████████       │
│                         │
│  ที่อยู่ปัจจุบัน *       │
│  [123 ถ.สุขุมวิท        │
│   แขวงคลองเตย          │
│   เขตคลองเตย กทม.      │
│   10110]               │
│                         │
│  เบอร์โทรของคุณ         │
│  [081-234-5678]        │
│                         │
│  ผู้ติดต่อฉุกเฉิน *      │
│  ชื่อ: [สมชาย]         │
│  ความสัมพันธ์: [ลูก]   │
│  เบอร์: [082-345-6789] │
│                         │
│  [← ก่อนหน้า]  [เสร็จสิ้น ✓] │
└─────────────────────────┘
```

#### Step 6: Success & Link Code
```
┌─────────────────────────┐
│  🎉 ลงทะเบียนสำเร็จ!     │
│                         │
│  สวัสดี คุณสมศรี 👋     │
│                         │
│  ข้อมูลของคุณถูกบันทึก  │
│  เรียบร้อยแล้ว          │
│                         │
│  ┌─────────────────┐    │
│  │ รหัสเชื่อมต่อ:   │    │
│  │  2 4 6 8 9 1    │    │
│  │                 │    │
│  │  [QR Code]      │    │
│  │                 │    │
│  │ แชร์รหัสนี้ให้   │    │
│  │ ญาติผู้ดูแล      │    │
│  │ (ใช้ได้ 24 ชม.) │    │
│  └─────────────────┘    │
│                         │
│  [แชร์รหัส 📤]         │
│  [เริ่มใช้งาน →]       │
└─────────────────────────┘
```

### Registration Flow (Caregiver)

#### Step 1: Caregiver Info
```
┌─────────────────────────┐
│  👨‍⚕️ ข้อมูลผู้ดูแล       │
│                         │
│  ชื่อ *                 │
│  [กรอกชื่อ]             │
│                         │
│  นามสกุล *              │
│  [กรอกนามสกุล]          │
│                         │
│  เบอร์โทร               │
│  [081-xxx-xxxx]        │
│                         │
│  [ถัดไป →]             │
└─────────────────────────┘
```

#### Step 2: Link to Patient
```
┌─────────────────────────┐
│  🔗 เชื่อมต่อกับผู้ป่วย   │
│                         │
│  ใส่รหัสเชื่อมต่อ       │
│  6 หลักจากผู้ป่วย       │
│                         │
│  ┌───┬───┬───┬───┬───┬───┐ │
│  │ 2 │ 4 │ 6 │ 8 │ 9 │ 1 │ │
│  └───┴───┴───┴───┴───┴───┘ │
│                         │
│  หรือ                   │
│                         │
│  [📷 สแกน QR Code]      │
│                         │
│  [ตรวจสอบรหัส]          │
└─────────────────────────┘
```

#### Step 3: Confirm Relationship
```
┌─────────────────────────┐
│  ✅ ยืนยันการเชื่อมต่อ    │
│                         │
│  พบข้อมูลผู้ป่วย:        │
│                         │
│  ┌─────────────────┐    │
│  │ 👤 คุณสมศรี      │    │
│  │    (65 ปี)       │    │
│  └─────────────────┘    │
│                         │
│  คุณคือ?               │
│  ⚪ ลูก                 │
│  ⚪ หลาน                │
│  ⚪ พี่น้อง              │
│  ⚪ คนดูแล              │
│  ⚪ เพื่อน              │
│                         │
│  [ยกเลิก] [ส่งคำขอ ✓]  │
└─────────────────────────┘
```

#### Step 4: Wait for Approval
```
┌─────────────────────────┐
│  ⏳ รอการอนุมัติ         │
│                         │
│  ส่งคำขอเชื่อมต่อ       │
│  ไปยัง คุณสมศรี แล้ว    │
│                         │
│  กรุณารอการอนุมัติ      │
│  จากผู้ป่วย             │
│                         │
│  [รอ...]               │
│                         │
│  (จะแจ้งเตือนเมื่อ      │
│   ได้รับการอนุมัติ)     │
└─────────────────────────┘
```

## Testing Strategy

### Unit Tests
- Form validation
- Date calculations (age from birthDate)
- BMI calculation
- Link code generation (6 digits)
- QR code generation

### Integration Tests
- LIFF login flow
- Registration complete flow (patient)
- Registration complete flow (caregiver)
- Patient-caregiver linking
- Approval/rejection flow

### E2E Tests
1. **Patient Registration Flow**
   - เปิด LIFF
   - เลือก "ผู้ป่วย"
   - กรอกข้อมูลทุกขั้นตอน
   - บันทึกสำเร็จ
   - ได้รหัสเชื่อมต่อ

2. **Caregiver Registration & Link**
   - เปิด LIFF
   - เลือก "ผู้ดูแล"
   - กรอกข้อมูล
   - ใส่รหัสเชื่อมต่อ
   - ส่งคำขอ
   - Patient อนุมัติ
   - เชื่อมต่อสำเร็จ

3. **Profile Update**
   - เปิด profile
   - แก้ไขข้อมูล
   - บันทึก
   - ข้อมูลอัพเดท

### Accessibility Tests
- Screen reader ใช้งานได้
- Keyboard navigation
- High contrast mode
- Font scaling (200%)

## Timeline

**Estimated Effort**: 24 hours (3 days)

**Breakdown**:
- Database schema: 2 hours
- Backend APIs: 8 hours
- LIFF Frontend: 12 hours
- Testing: 2 hours

**With Auto-Dev**: ~3-5 hours (setup LIFF + review + test)

## Examples

### API Request/Response

#### Register Patient
```typescript
// Request
POST /api/registration/patient
{
  "firstName": "สมศรี",
  "lastName": "ใจดี",
  "nickname": "ศรี",
  "birthDate": "1959-03-15",
  "gender": "female",
  "weightKg": 65,
  "heightCm": 155,
  "bloodType": "A+",
  "chronicDiseases": ["hypertension", "diabetes"],
  "drugAllergies": ["Penicillin"],
  "medications": [
    {
      "name": "Metformin",
      "dosage": "500mg",
      "frequency": ["morning", "evening"]
    }
  ],
  "address": "123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กทม. 10110",
  "phoneNumber": "081-234-5678",
  "emergencyContactName": "สมชาย ใจดี",
  "emergencyContactPhone": "082-345-6789",
  "emergencyContactRelation": "ลูก"
}

// Response
{
  "success": true,
  "user": {
    "id": "uuid-123",
    "lineUserId": "U1234567890",
    "role": "patient",
    ...
  },
  "profile": {
    "id": "uuid-456",
    "firstName": "สมศรี",
    "lastName": "ใจดี",
    "age": 65,
    "bmi": 27.1,
    ...
  },
  "linkCode": "246891",
  "qrCode": "data:image/png;base64,..."
}
```

## Security Considerations

### Data Protection
- ✅ HTTPS only
- ✅ JWT authentication
- ✅ Rate limiting on APIs
- ✅ Input sanitization
- ✅ PDPA consent checkbox

### Privacy
- ✅ ข้อมูลสุขภาพเข้ารหัส (encrypted at rest)
- ✅ Access control (caregivers เห็นเฉพาะที่ได้รับอนุมัติ)
- ✅ Audit logs ทุกการเข้าถึงข้อมูล
- ✅ สิทธิ์ลบบัญชี (right to be forgotten)

### Link Code Security
- ✅ Random 6-digit code
- ✅ Expires ใน 24 ชั่วโมง
- ✅ One-time use
- ✅ Requires patient approval

---

**Created**: 2024-01-16
**Priority**: CRITICAL (Phase 0.5 - ต้องทำก่อน features อื่น)
**Language**: Thai-first (รองรับภาษาไทยทุก UI/field)
**Status**: Ready for implementation
**Note**: ต้องทำก่อนทุก feature เพราะต้องมี patient profile
