# Exercise & Walking Tracking

> Activity and exercise tracking for elderly health monitoring

---

## Feature Name
Exercise & Walking Activity Tracker

## Overview
ติดตามกิจกรรมการออกกำลังกายและการเดินของผู้สูงอายุ
บันทึกระยะทาง เวลา และแคลอรี่ที่เผาผลาญ

## User Story
**As a** ผู้สูงอายุ
**I want** บันทึกการเดินและออกกำลังกาย
**So that** ติดตามสุขภาพและกระตุ้นให้เคลื่อนไหวสม่ำเสมอ

## Requirements

### Functional Requirements
- [ ] FR-1: บันทึกกิจกรรม (เดิน, วิ่ง, ออกกำลังกาย, โยคะ)
- [ ] FR-2: บันทึกระยะทาง (km) และเวลา (นาที)
- [ ] FR-3: คำนวณแคลอรี่ที่เผาผลาญ (ตามน้ำหนัก + กิจกรรม)
- [ ] FR-4: ตั้งเป้าหมายรายวัน (เช่น เดิน 30 นาที/วัน)
- [ ] FR-5: เตือนออกกำลังกายหากยังไม่ทำ
- [ ] FR-6: แสดงสถิติ streak (ทำต่อเนื่องกี่วัน)
- [ ] FR-7: แสดงผลกระทบต่อสุขภาพ (ความดัน, น้ำตาล)
- [ ] FR-8: Integration กับ fitness apps (optional)

### Technical Requirements
- [ ] TR-1: Calculate calories burned based on MET values
- [ ] TR-2: Store activity history
- [ ] TR-3: Generate weekly/monthly reports

## Data Model

### Database Schema
```sql
CREATE TABLE exercise_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'walking', 'jogging', 'cycling', 'yoga', 'other'
  duration_minutes INTEGER NOT NULL,
  distance_km DECIMAL(5,2),
  calories_burned INTEGER,
  intensity VARCHAR(20), -- 'light', 'moderate', 'vigorous'
  heart_rate_avg INTEGER,
  notes TEXT,
  performed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exercise_goals (
  patient_id UUID PRIMARY KEY REFERENCES patients(id),
  daily_minutes INTEGER DEFAULT 30,
  weekly_days INTEGER DEFAULT 5, -- เป้าหมายออกกำลังกายอย่างน้อย 5 วัน/สัปดาห์
  preferred_activities TEXT[],
  reminder_time TIME DEFAULT '08:00',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_exercise_patient_date ON exercise_logs(patient_id, DATE(performed_at) DESC);
```

### TypeScript Types
```typescript
interface ExerciseLog {
  id: string;
  patientId: string;
  activityType: 'walking' | 'jogging' | 'cycling' | 'swimming' | 'yoga' | 'tai_chi' | 'other';
  durationMinutes: number;
  distanceKm?: number;
  caloriesBurned?: number;
  intensity: 'light' | 'moderate' | 'vigorous';
  heartRateAvg?: number;
  notes?: string;
  performedAt: Date;
}

interface ExerciseStats {
  today: {
    minutes: number;
    calories: number;
    goalMet: boolean;
  };
  week: {
    totalMinutes: number;
    daysActive: number;
    streak: number;
    averageCalories: number;
  };
  trends: {
    weekOverWeek: number; // percentage change
    recommendation: string;
  };
}

// MET values for calorie calculation
const MET_VALUES = {
  walking: 3.5,
  jogging: 7.0,
  cycling: 6.0,
  swimming: 8.0,
  yoga: 2.5,
  tai_chi: 3.0
};

// Calories = MET × weight(kg) × time(hours)
```

## API Design

```typescript
class ExerciseAgent extends BaseAgent {
  async logExercise(params: {
    patientId: string;
    activityType: string;
    durationMinutes: number;
    distanceKm?: number;
    intensity?: string;
  }): Promise<ExerciseLog>

  async getStats(
    patientId: string,
    period: 'day' | 'week' | 'month'
  ): Promise<ExerciseStats>

  async calculateCalories(params: {
    activityType: string;
    durationMinutes: number;
    weightKg: number;
  }): Promise<number>

  async checkGoalProgress(patientId: string): Promise<{
    completed: boolean;
    remaining: number;
    streak: number;
  }>
}
```

## Testing Strategy

### Test Scenarios
1. **Walking**: "เดิน 30 นาที" → บันทึก + คำนวณแคลอรี่
2. **With Distance**: "เดิน 2 km" → คำนวณเวลาโดยประมาณ
3. **Goal Met**: ออกกำลังกายครบเป้าหมาย → แสดงความยินดี
4. **Streak**: ทำต่อเนื่อง 7 วัน → Badge/achievement
5. **Correlation**: เปรียบเทียบกับค่าความดัน/น้ำตาล

## Timeline

**Estimated**: 8 hours (1 day)

## Examples

### Input
```
"เดิน 30 นาที"
"เดิน 2 km"
"วิ่ง 20 นาที"
"โยคะ 45 นาที"
```

### Output
```json
{
  "message": "บันทึกแล้วค่ะ เดิน 30 นาที เผาผลาญ 105 แคลอรี่ 🏃‍♂️",
  "stats": {
    "today": { "minutes": 30, "calories": 105, "goalMet": true },
    "streak": 5,
    "achievement": "🎉 ออกกำลังกายต่อเนื่อง 5 วันแล้ว!"
  }
}
```

---

**Created**: 2024-01-16
**Priority**: Medium
**Status**: Ready for implementation
