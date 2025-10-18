# Water Intake Tracking

> Smart water drinking reminder and tracking system

---

## Feature Name
Water Intake Tracking & Reminder

## Overview
ระบบติดตามปริมาณน้ำที่ดื่มต่อวัน เตือนดื่มน้ำสม่ำเสมอ และแสดงสถิติการดื่มน้ำ
เหมาะสำหรับผู้สูงอายุที่ต้องดื่มน้ำให้เพียงพอต่อวัน

## User Story
**As a** ผู้สูงอายุ
**I want** ระบบเตือนและบันทึกการดื่มน้ำ
**So that** ดื่มน้ำเพียงพอ 2000ml/วัน ป้องกันภาวะขาดน้ำ

## Requirements

### Functional Requirements
- [ ] FR-1: บันทึกปริมาณน้ำที่ดื่มแต่ละครั้ง (ml)
- [ ] FR-2: รองรับคำสั่งย่อ เช่น "ดื่มน้ำ 1 แก้ว" = 250ml
- [ ] FR-3: ตั้งเป้าหมายดื่มน้ำต่อวัน (default 2000ml, ปรับได้ตามน้ำหนัก/อายุ)
- [ ] FR-4: เตือนดื่มน้ำทุก 2 ชั่วโมง (customize ได้)
- [ ] FR-5: แสดง progress bar ปริมาณน้ำต่อวัน
- [ ] FR-6: สถิติรายวัน/สัปดาห์/เดือน
- [ ] FR-7: แจ้งเตือนถ้าดื่มน้ำน้อยกว่า 50% ของเป้าหมาย
- [ ] FR-8: Integration กับ weather API (ดื่มมากขึ้นในวันร้อน)

### Technical Requirements
- [ ] TR-1: ใช้ Supabase สำหรับเก็บ logs
- [ ] TR-2: Real-time update progress
- [ ] TR-3: Cache daily total ลด queries
- [ ] TR-4: Notification scheduling

## Implementation Details

### Files to Create
```
src/
  └── agents/specialized/WaterIntakeAgent.ts (NEW)
```

### Files to Modify
- `src/agents/specialized/HealthAgent.ts` - Add water tracking

## Data Model

### Database Schema
```sql
CREATE TABLE water_intake_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  amount_ml INTEGER NOT NULL,
  logged_at TIMESTAMP DEFAULT NOW(),
  type VARCHAR(50), -- 'water', 'juice', 'coffee', 'other'
  source VARCHAR(50), -- 'manual', 'quick_reply', 'reminder'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE water_intake_settings (
  patient_id UUID PRIMARY KEY REFERENCES patients(id),
  daily_goal_ml INTEGER DEFAULT 2000,
  reminder_interval_hours INTEGER DEFAULT 2,
  reminder_start_time TIME DEFAULT '07:00',
  reminder_end_time TIME DEFAULT '21:00',
  weight_kg DECIMAL(5,2), -- ใช้คำนวณเป้าหมาย
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_water_logs_patient_date ON water_intake_logs(patient_id, DATE(logged_at));
```

### TypeScript Types
```typescript
interface WaterIntakeLog {
  id: string;
  patientId: string;
  amountMl: number;
  loggedAt: Date;
  type: 'water' | 'juice' | 'coffee' | 'tea' | 'other';
  source: 'manual' | 'quick_reply' | 'reminder';
  notes?: string;
}

interface WaterIntakeSettings {
  patientId: string;
  dailyGoalMl: number;
  reminderIntervalHours: number;
  reminderStartTime: string;
  reminderEndTime: string;
  weightKg?: number;
}

interface WaterIntakeStats {
  today: {
    total: number;
    goal: number;
    percentage: number;
    remaining: number;
  };
  week: {
    average: number;
    daysMetGoal: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}

// Preset amounts
const WATER_PRESETS = {
  '1 แก้ว': 250,
  'ครึ่งแก้ว': 125,
  '1 ขวด': 500,
  '1 ลิตร': 1000
};
```

## API Design

```typescript
class WaterIntakeAgent extends BaseAgent {
  async logWater(params: {
    patientId: string;
    amountMl: number;
    type?: string;
  }): Promise<WaterIntakeLog>

  async getTodayStats(patientId: string): Promise<WaterIntakeStats>

  async updateGoal(params: {
    patientId: string;
    dailyGoalMl?: number;
    reminderInterval?: number;
  }): Promise<WaterIntakeSettings>

  // Calculate goal based on weight (30ml per kg)
  async calculateRecommendedGoal(weightKg: number): Promise<number>
}
```

## Testing Strategy

### Test Scenarios
1. **Basic**: "ดื่มน้ำ 250" → บันทึก 250ml
2. **Preset**: "ดื่มน้ำ 1 แก้ว" → 250ml
3. **Multiple**: ดื่มหลายครั้งต่อวัน → รวมยอด
4. **Goal Met**: ดื่มครบ 2000ml → แสดงความยินดี
5. **Reminder**: ไม่ดื่ม 2 ชม → ส่งเตือน

## Timeline

**Estimated**: 6 hours (1 day)

## Examples

### Input
```
"ดื่มน้ำ 250"
"ดื่มน้ำ 1 แก้ว"
"ดื่มน้ำ 1 ขวด"
```

### Output
```json
{
  "message": "บันทึกแล้วค่ะ ดื่มน้ำไปแล้ว 1,250ml วันนี้ 🎯",
  "progress": {
    "current": 1250,
    "goal": 2000,
    "percentage": 62.5,
    "remaining": 750
  }
}
```

---

**Created**: 2024-01-16
**Priority**: Medium
**Status**: Ready for implementation
