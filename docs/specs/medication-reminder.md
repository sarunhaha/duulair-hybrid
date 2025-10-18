# Medication Reminder System

> Smart medication tracking and reminder system for elderly care

---

## Feature Name
Medication Reminder & Tracking System

## Overview
ระบบจัดการยาอัจฉริยะที่ช่วยเตือนผู้สูงอายุกินยาตามเวลา บันทึกประวัติการกินยา
และแจ้งเตือนญาติหากลืมกินยา รองรับการตั้งเวลาหลายมื้อ และ schedule ที่ซับซ้อน

## User Story
**As a** ผู้ป่วยที่ต้องกินยาหลายชนิด
**I want** ระบบเตือนกินยาตามเวลาอัตโนมัติ
**So that** ไม่ลืมกินยาและญาติสามารถติดตามได้

## Requirements

### Functional Requirements
- [ ] FR-1: สร้างรายการยาพร้อมกำหนดเวลากินยา (เช้า, กลางวัน, เย็น, ก่อนนอน)
- [ ] FR-2: รองรับ schedule ซับซ้อน (ทุกวัน, วันเว้นวัน, สัปดาห์ละครั้ง)
- [ ] FR-3: ส่ง LINE notification เตือนกินยาล่วงหน้า 15 นาที
- [ ] FR-4: ผู้ใช้ตอบรับว่ากินยาแล้วผ่าน Quick Reply
- [ ] FR-5: แจ้งเตือนญาติหากไม่ตอบรับภายใน 30 นาที
- [ ] FR-6: บันทึกประวัติการกินยาทุกครั้ง (กินตรงเวลา/สาย/ลืม)
- [ ] FR-7: แสดงสถิติการกินยาราย สัปดาห์/เดือน
- [ ] FR-8: แจ้งเตือนเมื่อยาใกล้หมด (เหลือ 3 วัน)
- [ ] FR-9: OCR อ่านฉลากยาจากรูปภาพ
- [ ] FR-10: ตรวจสอบ drug interaction (ยาที่ห้ามกินร่วมกัน)

### Technical Requirements
- [ ] TR-1: ใช้ Supabase Cron Jobs สำหรับ scheduled reminders
- [ ] TR-2: LINE Messaging API สำหรับส่ง notifications
- [ ] TR-3: Claude API สำหรับ OCR และ NLP
- [ ] TR-4: Edge Functions สำหรับ real-time notifications
- [ ] TR-5: Response time < 3 วินาที

### Non-Functional Requirements
- [ ] NFR-1: Notification ต้องส่งตรงเวลา (±1 minute)
- [ ] NFR-2: รองรับ timezone ของผู้ใช้
- [ ] NFR-3: Retry mechanism หาก LINE API fail
- [ ] NFR-4: Audit log ทุก medication event

## Implementation Details

### Files to Create
```
src/
  ├── agents/specialized/MedicationAgent.ts (NEW)
  ├── agents/specialized/MedicationAgent.test.ts (NEW)
  ├── services/medication.service.ts (NEW)
  ├── services/notification.service.ts (NEW)
  └── types/medication.types.ts (NEW)
```

### Files to Modify
- `src/agents/core/OrchestratorAgent.ts` - Route medication intents
- `src/agents/specialized/HealthAgent.ts` - Integration
- `docs/database-schema.sql` - Add medication tables

### Dependencies
- [ ] No new npm packages (ใช้ที่มีอยู่)
- [ ] Supabase Cron/Edge Functions (already available)
- [ ] LINE Messaging API (already integrated)
- [ ] Claude API (already integrated)

## Data Model

### Database Schema
```sql
-- Medications table
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100), -- "1 เม็ด", "10 mg"
  type VARCHAR(50), -- "tablet", "capsule", "syrup"
  purpose TEXT, -- ไว้รักษาอะไร
  side_effects TEXT[],
  warnings TEXT[],
  image_url TEXT, -- รูปยา
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Medication schedules
CREATE TABLE medication_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID REFERENCES medications(id) NOT NULL,
  time_of_day TIME NOT NULL, -- "08:00", "12:00", "18:00", "21:00"
  frequency VARCHAR(50) NOT NULL, -- "daily", "alternate_days", "weekly"
  days_of_week INTEGER[], -- [1,2,3,4,5,6,7] for daily, [1,3,5] for MWF
  remind_before_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Medication intake logs
CREATE TABLE medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID REFERENCES medications(id) NOT NULL,
  schedule_id UUID REFERENCES medication_schedules(id),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  scheduled_time TIMESTAMP NOT NULL,
  taken_at TIMESTAMP,
  status VARCHAR(20) CHECK (status IN ('taken', 'missed', 'late', 'pending')),
  notes TEXT,
  reminded_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Medication interactions (drug-drug interaction)
CREATE TABLE medication_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_a_name VARCHAR(255) NOT NULL,
  medication_b_name VARCHAR(255) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('minor', 'moderate', 'major')),
  description TEXT,
  recommendation TEXT
);

-- Indexes
CREATE INDEX idx_medication_patient ON medications(patient_id);
CREATE INDEX idx_schedule_medication ON medication_schedules(medication_id);
CREATE INDEX idx_logs_patient_time ON medication_logs(patient_id, scheduled_time DESC);
CREATE INDEX idx_logs_status ON medication_logs(status, scheduled_time);
```

### TypeScript Types
```typescript
interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  type: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'other';
  purpose?: string;
  sideEffects?: string[];
  warnings?: string[];
  imageUrl?: string;
  stockQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MedicationSchedule {
  id: string;
  medicationId: string;
  timeOfDay: string; // "HH:mm" format
  frequency: 'daily' | 'alternate_days' | 'weekly' | 'custom';
  daysOfWeek?: number[]; // 1-7 (Mon-Sun)
  remindBeforeMinutes: number;
  isActive: boolean;
  createdAt: Date;
}

interface MedicationLog {
  id: string;
  medicationId: string;
  scheduleId?: string;
  patientId: string;
  scheduledTime: Date;
  takenAt?: Date;
  status: 'taken' | 'missed' | 'late' | 'pending';
  notes?: string;
  remindedAt?: Date;
  confirmedAt?: Date;
  createdAt: Date;
}

interface MedicationReminder {
  medication: Medication;
  schedule: MedicationSchedule;
  scheduledTime: Date;
  message: string;
}

interface MedicationStats {
  total: number;
  taken: number;
  missed: number;
  late: number;
  adherenceRate: number; // percentage
  trend: 'improving' | 'stable' | 'declining';
}
```

## API Design

### Agent Methods
```typescript
class MedicationAgent extends BaseAgent {
  /**
   * Add new medication
   */
  async addMedication(params: {
    patientId: string;
    name: string;
    dosage: string;
    schedules: MedicationSchedule[];
  }): Promise<Medication>

  /**
   * Add medication from OCR (photo of label)
   */
  async addMedicationFromImage(params: {
    patientId: string;
    imageUrl: string;
  }): Promise<Medication>

  /**
   * Log medication intake
   */
  async logIntake(params: {
    medicationId: string;
    scheduledTime: Date;
    status: 'taken' | 'missed' | 'late';
    notes?: string;
  }): Promise<MedicationLog>

  /**
   * Get upcoming medications (next 24 hours)
   */
  async getUpcomingMedications(
    patientId: string
  ): Promise<MedicationReminder[]>

  /**
   * Get medication adherence stats
   */
  async getAdherenceStats(
    patientId: string,
    days: number = 30
  ): Promise<MedicationStats>

  /**
   * Check drug interactions
   */
  async checkInteractions(
    patientId: string,
    newMedicationName?: string
  ): Promise<Interaction[]>

  /**
   * Send reminder notification
   */
  private async sendReminder(
    reminder: MedicationReminder
  ): Promise<void>

  /**
   * Process confirmation (when user replies "กินแล้ว")
   */
  async processConfirmation(params: {
    patientId: string;
    medicationId: string;
  }): Promise<MedicationLog>
}
```

### Notification Service
```typescript
class NotificationService {
  /**
   * Send LINE notification
   */
  async sendLineNotification(params: {
    userId: string;
    message: string;
    quickReplies?: QuickReply[];
  }): Promise<void>

  /**
   * Schedule notification
   */
  async scheduleNotification(params: {
    userId: string;
    scheduledTime: Date;
    message: string;
    type: 'medication' | 'appointment' | 'checkup';
  }): Promise<void>

  /**
   * Send to caregiver
   */
  async notifyCaregiver(params: {
    patientId: string;
    message: string;
    severity: 'info' | 'warning' | 'urgent';
  }): Promise<void>
}
```

## Testing Strategy

### Unit Tests
- Test medication creation and scheduling
- Test adherence calculation
- Test drug interaction checking
- Test OCR parsing (mock Claude API)
- Test notification scheduling

### Integration Tests
- Test with real LINE API (dev account)
- Test Supabase cron jobs
- Test full reminder flow
- Test caregiver notifications

### Test Scenarios
1. **Happy Path**: ผู้ใช้กินยาตรงเวลา → Log as "taken"
2. **Late**: กินยาช้า 1 ชั่วโมง → Log as "late"
3. **Missed**: ไม่ตอบกลับ 2 ชั่วโมง → Log as "missed" + notify caregiver
4. **Multiple Meds**: กินยาหลายชนิดพร้อมกัน → Group notifications
5. **OCR**: ถ่ายรูปฉลากยา → Parse ชื่อ, ขนาด, วิธีใช้
6. **Interaction**: เพิ่มยาใหม่ที่มี interaction → แจ้งเตือน
7. **Low Stock**: ยาเหลือน้อย → แจ้งเตือนสั่งซื้อ

## Acceptance Criteria

### Definition of Done
- [ ] MedicationAgent created และทำงานได้ครบ
- [ ] Database tables created และ indexed
- [ ] Notification service integrated
- [ ] OCR สำหรับฉลากยาทำงานได้
- [ ] Unit tests >85% coverage
- [ ] Integration tests ผ่านหมด
- [ ] Documentation complete

### Success Metrics
- [ ] Reminder ส่งตรงเวลา >99%
- [ ] Notification delivery rate >95%
- [ ] OCR accuracy >90%
- [ ] Response time <3s
- [ ] Adherence tracking accurate

## Timeline

### Estimated Effort
- Planning: 2 hours
- Implementation: 12 hours
  - MedicationAgent: 4 hours
  - Database & Services: 3 hours
  - Notifications: 3 hours
  - OCR Integration: 2 hours
- Testing: 4 hours
- Documentation: 2 hours
- **Total**: 20 hours (2.5 days)

### Milestones
- [ ] M1: Database schema & basic CRUD (Day 1)
- [ ] M2: Scheduling & reminders working (Day 2)
- [ ] M3: OCR & interactions (Day 2)
- [ ] M4: Tests & docs complete (Day 3)

## Examples

### Input Examples

```typescript
// LINE message: เพิ่มยา
"เพิ่มยา Metformin 500mg กินวันละ 2 เม็ด เช้า-เย็น"

// LINE message: ส่งรูปยา
[Image of medication label]

// LINE message: ยืนยันกินยา
"กินแล้ว" or "ยังไม่กิน"

// Quick Reply options
["✅ กินแล้ว", "⏰ เตือนอีกครั้ง", "❌ ข้าม"]
```

### Output Examples

```typescript
// Reminder notification
{
  type: "flex",
  altText: "เตือนกินยา: Metformin",
  contents: {
    type: "bubble",
    header: {
      type: "box",
      contents: [{
        type: "text",
        text: "⏰ เวลากินยาแล้วค่ะ",
        weight: "bold"
      }]
    },
    body: {
      type: "box",
      contents: [
        { type: "text", text: "💊 Metformin 500mg" },
        { type: "text", text: "📋 1 เม็ด หลังอาหารเย็น" },
        { type: "text", text: "🕐 18:00 น." }
      ]
    }
  },
  quickReply: {
    items: [
      { action: { type: "message", label: "✅ กินแล้ว", text: "กินยา Metformin แล้ว" }},
      { action: { type: "message", label: "⏰ เตือนอีกครั้ง", text: "เตือนอีก 15 นาที" }},
      { action: { type: "message", label: "❌ ข้ามมื้อนี้", text: "ข้ามยา Metformin" }}
    ]
  }
}

// Adherence stats
{
  period: "30 days",
  medications: [
    {
      name: "Metformin",
      total: 60,
      taken: 58,
      missed: 2,
      adherenceRate: 96.7
    }
  ],
  overall: {
    adherenceRate: 94.5,
    trend: "stable"
  }
}

// Drug interaction warning
{
  severity: "moderate",
  medications: ["Warfarin", "Aspirin"],
  warning: "ยา Warfarin และ Aspirin อาจเพิ่มความเสี่ยงเลือดออก",
  recommendation: "ควรปรึกษาแพทย์ก่อนใช้ร่วมกัน"
}
```

## Notes

### Timezone Handling
- เก็บ schedule เป็น local time ของผู้ใช้
- Convert เป็น UTC เมื่อ schedule cron jobs
- แสดงผลเป็น local time

### Notification Best Practices
- Group multiple meds ในเวลาเดียวกัน
- ไม่ spam notification (max 3 reminders)
- Escalate to caregiver หากไม่ตอบกลับ

### OCR Considerations
- ใช้ Claude Vision API
- Extract: ชื่อยา, ขนาด, วิธีใช้, ข้อควรระวัง
- Validate ข้อมูลก่อนบันทึก

---

**Created**: 2024-01-16
**Author**: Auto-spec
**Priority**: High (Core feature for elderly care)
**Status**: Ready for implementation
