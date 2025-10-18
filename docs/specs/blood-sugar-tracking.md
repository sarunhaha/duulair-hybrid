# Blood Sugar Tracking Feature

> Auto-implementation spec for blood sugar monitoring

---

## Feature Name
Blood Sugar Tracking and Analysis

## Overview
ให้ผู้ใช้สามารถบันทึกค่าน้ำตาลในเลือด (Blood Sugar/Glucose) ผ่าน LINE ได้
ระบบจะเก็บข้อมูล วิเคราะห์แนวโน้ม และแจ้งเตือนหากค่าผิดปกติ

## User Story
**As a** ผู้ป่วยโรคเบาหวาน
**I want** บันทึกค่าน้ำตาลในเลือดผ่าน LINE
**So that** ติดตามสุขภาพและรับคำแนะนำจากระบบ

## Requirements

### Functional Requirements
- [ ] FR-1: รับข้อมูลค่าน้ำตาลจาก LINE message (รูปแบบ: "น้ำตาล 120" หรือ "glucose 120")
- [ ] FR-2: บันทึกข้อมูลลง Supabase พร้อม timestamp
- [ ] FR-3: วิเคราะห์ระดับน้ำตาล (Normal, Pre-diabetic, Diabetic)
- [ ] FR-4: แสดงสถิติ 7 วัน/30 วัน (average, min, max)
- [ ] FR-5: ส่งคำแนะนำเมื่อค่าผิดปกติ
- [ ] FR-6: Support ทั้งก่อนและหลังอาหาร (fasting/post-meal)

### Technical Requirements
- [ ] TR-1: ใช้ Claude API สำหรับ NLP parsing
- [ ] TR-2: บันทึกใน Supabase table `blood_sugar`
- [ ] TR-3: Response time < 2 วินาที
- [ ] TR-4: รองรับทั้งภาษาไทยและอังกฤษ

### Non-Functional Requirements
- [ ] NFR-1: ข้อมูลต้อง encrypted at rest
- [ ] NFR-2: Audit log ทุก action
- [ ] NFR-3: PDPA compliant

## Implementation Details

### Files to Create
```
src/
  └── agents/specialized/BloodSugarAgent.ts  (NEW)
```

### Files to Modify
- `src/agents/specialized/HealthAgent.ts` - Add blood sugar methods
- `src/types/health.types.ts` - Add BloodSugar types
- `docs/database-schema.sql` - Add blood_sugar table

### Dependencies
- [ ] No new npm packages needed
- [ ] Claude API (already integrated)
- [ ] Supabase (already integrated)

## Data Model

### Database Schema
```sql
-- Add to blood_sugar table
CREATE TABLE IF NOT EXISTS blood_sugar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  value INTEGER NOT NULL, -- mg/dL
  type VARCHAR(20) CHECK (type IN ('fasting', 'post_meal', 'random')),
  measured_at TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_blood_sugar_patient ON blood_sugar(patient_id, measured_at DESC);
```

### TypeScript Types
```typescript
interface BloodSugarReading {
  id: string;
  patientId: string;
  value: number; // mg/dL
  type: 'fasting' | 'post_meal' | 'random';
  measuredAt: Date;
  notes?: string;
  createdAt: Date;
}

interface BloodSugarAnalysis {
  current: number;
  status: 'normal' | 'pre_diabetic' | 'diabetic' | 'low';
  trend: 'increasing' | 'stable' | 'decreasing';
  average7d: number;
  average30d: number;
  recommendation: string;
}
```

## API Design

### Agent Methods
```typescript
class HealthAgent {
  /**
   * Log blood sugar reading
   */
  async logBloodSugar(params: {
    patientId: string;
    value: number;
    type: 'fasting' | 'post_meal' | 'random';
    measuredAt?: Date;
  }): Promise<BloodSugarReading>

  /**
   * Get blood sugar analysis
   */
  async getBloodSugarAnalysis(
    patientId: string,
    days: number = 7
  ): Promise<BloodSugarAnalysis>

  /**
   * Check if blood sugar is in normal range
   */
  private validateBloodSugar(value: number, type: string): {
    status: string;
    recommendation: string;
  }
}
```

### Reference Ranges
```typescript
const BLOOD_SUGAR_RANGES = {
  fasting: {
    normal: { min: 70, max: 100 },
    preDiabetic: { min: 100, max: 125 },
    diabetic: { min: 126, max: 400 }
  },
  post_meal: {
    normal: { min: 70, max: 140 },
    preDiabetic: { min: 140, max: 199 },
    diabetic: { min: 200, max: 400 }
  }
};
```

## Testing Strategy

### Unit Tests
- Test blood sugar parsing from messages
- Test range validation (normal, pre-diabetic, diabetic)
- Test trend calculation
- Test error handling for invalid values

### Integration Tests
- Test with real LINE messages
- Test Supabase insert/query
- Test Claude API response

### Test Scenarios
1. **Happy Path**: "น้ำตาล 95 ตอนเช้า" → Log fasting sugar 95 mg/dL
2. **Post-meal**: "glucose 130 หลังอาหาร" → Log post-meal sugar 130
3. **High Sugar**: "น้ำตาล 250" → Alert diabetic range
4. **Low Sugar**: "น้ำตาล 60" → Alert hypoglycemia
5. **Invalid**: "น้ำตาล xyz" → Error message

## Acceptance Criteria

### Definition of Done
- [ ] HealthAgent มี methods สำหรับ blood sugar
- [ ] Database schema created และ migrated
- [ ] Unit tests coverage > 80%
- [ ] Integration tests ผ่านหมด
- [ ] Documentation updated
- [ ] Tested with real LINE messages

### Success Metrics
- [ ] สามารถบันทึกค่าน้ำตาลได้ถูกต้อง
- [ ] วิเคราะห์แนวโน้มได้ถูกต้อง
- [ ] Response time < 2s
- [ ] ไม่มี errors ใน logs

## Timeline

### Estimated Effort
- Planning: 1 hour
- Implementation: 4 hours
- Testing: 2 hours
- Documentation: 1 hour
- **Total**: 8 hours (1 day)

## Examples

### Input Example
```typescript
// LINE message
"น้ำตาล 110 ตอนเช้า"
"glucose 140 after meal"
"วัดน้ำตาลได้ 95"
```

### Output Example
```typescript
{
  success: true,
  data: {
    reading: {
      value: 110,
      type: 'fasting',
      status: 'pre_diabetic'
    },
    analysis: {
      average7d: 105,
      trend: 'stable',
      recommendation: 'ค่าน้ำตาลของคุณอยู่ในระดับเสี่ยง Pre-diabetic ควรควบคุมอาหารและออกกำลังกาย'
    }
  }
}
```

---

**Created**: 2024-01-16
**Author**: Auto-spec
**Status**: Draft
