# Daily Health Report

> Automated daily and weekly health summary reports

---

## Feature Name
Automated Health Report Generation

## Overview
ระบบสร้างรายงานสุขภาพอัตโนมัติทุกวัน/สัปดาห์ สรุปข้อมูลสุขภาพทั้งหมด
พร้อม insights และคำแนะนำจาก AI

## User Story
**As a** ผู้ดูแลผู้สูงอายุ
**I want** รายงานสุขภาพสรุปทุกวัน
**So that** ติดตามสุขภาพและตรวจพบปัญหาก่อนจะรุนแรง

## Requirements

### Functional Requirements
- [ ] FR-1: สร้างรายงานประจำวันอัตโนมัติ (ส่งเวลา 20:00 น.)
- [ ] FR-2: สร้างรายงานรายสัปดาห์ (ส่งทุกวันอาทิตย์)
- [ ] FR-3: รวมข้อมูล: ความดัน, น้ำตาล, ยา, น้ำ, ออกกำลังกาย
- [ ] FR-4: Completion rate ของกิจกรรมต่างๆ
- [ ] FR-5: Trends และ insights จาก AI
- [ ] FR-6: Recommendations สำหรับปรับปรุงสุขภาพ
- [ ] FR-7: Alerts หากมีข้อมูลผิดปกติ
- [ ] FR-8: Export เป็น PDF สำหรับหมอ
- [ ] FR-9: Compare กับสัปดาห์/เดือนที่แล้ว
- [ ] FR-10: คำนวณ Health Score (0-100)

### Technical Requirements
- [ ] TR-1: Supabase Cron สำหรับ scheduled reports
- [ ] TR-2: Claude API สำหรับ AI insights
- [ ] TR-3: PDF generation library
- [ ] TR-4: Data aggregation และ analytics

## Data Model

### TypeScript Types
```typescript
interface DailyReport {
  id: string;
  patientId: string;
  reportDate: Date;

  // Vital signs
  bloodPressure: {
    readings: number;
    average: { systolic: number; diastolic: number };
    status: 'normal' | 'elevated' | 'high';
  };

  bloodSugar: {
    readings: number;
    average: number;
    status: 'normal' | 'pre_diabetic' | 'diabetic';
  };

  // Activities
  medications: {
    scheduled: number;
    taken: number;
    missed: number;
    adherenceRate: number;
  };

  waterIntake: {
    total: number;
    goal: number;
    percentage: number;
  };

  exercise: {
    minutes: number;
    calories: number;
    goalMet: boolean;
  };

  // Overall
  completionRate: number; // percentage of all tasks completed
  healthScore: number; // 0-100

  // AI Insights
  insights: string[];
  recommendations: string[];
  alerts: Alert[];

  trend: {
    vsYesterday: number; // percentage change
    vsLastWeek: number;
    direction: 'improving' | 'stable' | 'declining';
  };

  createdAt: Date;
}

interface WeeklyReport {
  id: string;
  patientId: string;
  weekStartDate: Date;
  weekEndDate: Date;

  summary: {
    daysActive: number;
    medicationAdherence: number;
    exerciseDays: number;
    averageHealthScore: number;
  };

  vitals: {
    bloodPressureTrend: 'improving' | 'stable' | 'worsening';
    bloodSugarTrend: 'improving' | 'stable' | 'worsening';
  };

  achievements: Achievement[];
  concerns: Concern[];

  aiSummary: string;
  recommendations: string[];

  createdAt: Date;
}

interface HealthScore {
  total: number; // 0-100
  breakdown: {
    vitals: number; // 30 points
    medications: number; // 30 points
    activities: number; // 20 points (water, exercise)
    consistency: number; // 20 points (daily logging)
  };
}
```

## API Design

```typescript
class ReportAgent extends BaseAgent {
  /**
   * Generate daily report
   */
  async generateDailyReport(
    patientId: string,
    date: Date = new Date()
  ): Promise<DailyReport>

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(
    patientId: string,
    weekStartDate: Date
  ): Promise<WeeklyReport>

  /**
   * Calculate health score
   */
  async calculateHealthScore(
    patientId: string,
    date: Date
  ): Promise<HealthScore>

  /**
   * Generate AI insights
   */
  private async generateInsights(data: {
    vitals: any;
    activities: any;
    history: any;
  }): Promise<string[]>

  /**
   * Export report as PDF
   */
  async exportToPDF(reportId: string): Promise<Buffer>

  /**
   * Send report to caregivers
   */
  async sendReport(
    report: DailyReport | WeeklyReport,
    recipients: string[]
  ): Promise<void>

  /**
   * Schedule automatic reports
   */
  async scheduleReports(patientId: string): Promise<void>
}
```

## Health Score Calculation

```typescript
const calculateHealthScore = (data: HealthData): HealthScore => {
  let vitalsScore = 0;
  let medicationsScore = 0;
  let activitiesScore = 0;
  let consistencyScore = 0;

  // Vitals (30 points)
  if (data.bloodPressure.status === 'normal') vitalsScore += 15;
  else if (data.bloodPressure.status === 'elevated') vitalsScore += 10;

  if (data.bloodSugar.status === 'normal') vitalsScore += 15;
  else if (data.bloodSugar.status === 'pre_diabetic') vitalsScore += 10;

  // Medications (30 points)
  medicationsScore = (data.medications.adherenceRate / 100) * 30;

  // Activities (20 points)
  const waterScore = Math.min((data.waterIntake.percentage / 100) * 10, 10);
  const exerciseScore = data.exercise.goalMet ? 10 : (data.exercise.minutes / 30) * 10;
  activitiesScore = waterScore + exerciseScore;

  // Consistency (20 points) - based on logging frequency
  consistencyScore = data.loggingRate * 20;

  return {
    total: Math.round(vitalsScore + medicationsScore + activitiesScore + consistencyScore),
    breakdown: {
      vitals: Math.round(vitalsScore),
      medications: Math.round(medicationsScore),
      activities: Math.round(activitiesScore),
      consistency: Math.round(consistencyScore)
    }
  };
};
```

## Report Template

### Daily Report (LINE Flex Message)

```json
{
  "type": "flex",
  "altText": "รายงานสุขภาพประจำวัน",
  "contents": {
    "type": "carousel",
    "contents": [
      {
        "type": "bubble",
        "header": {
          "type": "box",
          "contents": [{
            "type": "text",
            "text": "📊 รายงานประจำวัน",
            "size": "xl",
            "weight": "bold"
          }]
        },
        "body": {
          "type": "box",
          "contents": [
            {
              "type": "box",
              "layout": "baseline",
              "contents": [
                { "type": "text", "text": "คะแนนสุขภาพ", "flex": 0 },
                { "type": "text", "text": "87/100", "size": "xxl", "weight": "bold", "color": "#06C755", "align": "end" }
              ]
            },
            { "type": "separator" },
            { "type": "text", "text": "💊 ยา: 100% (2/2)", "margin": "md" },
            { "type": "text", "text": "💧 น้ำ: 85% (1,700/2,000ml)", "margin": "sm" },
            { "type": "text", "text": "🏃 ออกกำลังกาย: ✅ 30 นาที", "margin": "sm" },
            { "type": "text", "text": "🩺 ความดัน: 120/80 ปกติ", "margin": "sm" }
          ]
        }
      },
      {
        "type": "bubble",
        "header": {
          "type": "box",
          "contents": [{
            "type": "text",
            "text": "💡 Insights",
            "size": "xl",
            "weight": "bold"
          }]
        },
        "body": {
          "type": "box",
          "contents": [
            { "type": "text", "text": "✅ คุณกินยาตรงเวลาทุกมื้อ!", "wrap": true },
            { "type": "text", "text": "📈 ความดันดีขึ้นกว่าสัปดาห์ที่แล้ว 5%", "wrap": true, "margin": "md" },
            { "type": "text", "text": "💡 ควรดื่มน้ำเพิ่มอีก 300ml", "wrap": true, "margin": "md" }
          ]
        }
      }
    ]
  }
}
```

## Testing Strategy

### Test Scenarios
1. **Daily Report**: สร้างรายงานประจำวันครบทุกส่วน
2. **Missing Data**: บางข้อมูลไม่มี → แสดง N/A
3. **Perfect Day**: ทำครบทุกอย่าง → Health Score 100
4. **Poor Adherence**: ยาขาดหลายมื้อ → คะแนนต่ำ + แจ้งเตือน
5. **Trending**: เปรียบเทียบกับสัปดาห์ที่แล้ว
6. **PDF Export**: Export เป็น PDF ได้
7. **Scheduled**: รายงานส่งเวลา 20:00 น. ทุกวัน

## Timeline

**Estimated**: 12 hours (1.5 days)

## Examples

### AI-Generated Insights

```typescript
[
  "✅ คุณกินยาครบทุกมื้อติดต่อกัน 7 วันแล้ว ยอดเยี่ยม!",
  "📊 ความดันโลหิตเฉลี่ย 125/82 ดีกว่าเดือนที่แล้ว 8%",
  "💡 ควรออกกำลังกายเพิ่มอีก 10 นาที/วัน เพื่อคะแนนสุขภาพเต็ม 100",
  "⚠️ น้ำตาลในเลือดสูงกว่าปกติ 3 วันติดต่อกัน ควรลดหวาน",
  "🎯 เป้าหมายสัปดาห์หน้า: ออกกำลังกายครบ 5 วัน"
]
```

---

**Created**: 2024-01-16
**Priority**: High
**Status**: Ready for implementation
