# AI Health Insights & Predictions

> Advanced AI-powered health analysis and predictive insights

---

## Feature Name
AI Health Insights & Predictive Analytics

## Overview
ใช้ Claude AI วิเคราะห์ข้อมูลสุขภาพแบบ deep analysis ทำนายแนวโน้ม
ตรวจพบ patterns และให้คำแนะนำเชิงลึกที่ personalized

## User Story
**As a** ผู้ดูแลผู้สูงอายุ
**I want** AI ช่วยวิเคราะห์สุขภาพอัจฉริยะ
**So that** ตรวจพบปัญหาล่วงหน้าและปรับวิธีดูแลได้ทันท่วงที

## Requirements

### Functional Requirements
- [ ] FR-1: วิเคราะห์ correlation ระหว่าง vitals และกิจกรรม
- [ ] FR-2: ทำนายแนวโน้ม 7-30 วันข้างหน้า
- [ ] FR-3: ตรวจจับ anomalies (ข้อมูลผิดปกติ)
- [ ] FR-4: Pattern recognition (เช่น ความดันสูงหลังกินอาหารเค็ม)
- [ ] FR-5: Personalized recommendations ตามข้อมูลส่วนตัว
- [ ] FR-6: Risk assessment (คะแนนความเสี่ยงโรค)
- [ ] FR-7: Medication effectiveness analysis
- [ ] FR-8: Lifestyle impact analysis
- [ ] FR-9: Compare กับ population benchmarks
- [ ] FR-10: Natural language Q&A (ถามคำถามเกี่ยวกับสุขภาพ)

### Technical Requirements
- [ ] TR-1: Claude API สำหรับ deep analysis
- [ ] TR-2: Time-series data analysis
- [ ] TR-3: Statistical analysis และ ML models
- [ ] TR-4: Real-time insights engine
- [ ] TR-5: Caching สำหรับ insights ที่ซ้ำ

## Implementation Details

### Files to Create
```
src/
  ├── agents/specialized/AIHealthInsightsAgent.ts (NEW)
  ├── services/analytics.service.ts (NEW)
  └── utils/ml-helpers.ts (NEW)
```

### Files to Modify
- `src/agents/specialized/HealthAgent.ts` - Integration

## Data Model

### TypeScript Types
```typescript
interface HealthInsight {
  id: string;
  patientId: string;
  type: 'correlation' | 'prediction' | 'anomaly' | 'pattern' | 'recommendation';
  category: 'blood_pressure' | 'blood_sugar' | 'medications' | 'lifestyle' | 'overall';

  title: string;
  description: string;
  confidence: number; // 0-1
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';

  // For correlations
  correlatedFactors?: {
    factor1: string;
    factor2: string;
    correlation: number; // -1 to 1
    examples: string[];
  };

  // For predictions
  prediction?: {
    metric: string;
    currentValue: number;
    predictedValue: number;
    timeframe: string;
    trend: 'increasing' | 'stable' | 'decreasing';
  };

  // For anomalies
  anomaly?: {
    metric: string;
    normalRange: { min: number; max: number };
    actualValue: number;
    deviation: number; // standard deviations
  };

  // For patterns
  pattern?: {
    description: string;
    occurrences: number;
    lastSeen: Date;
    trigger?: string;
  };

  recommendations: string[];
  actionable: boolean;
  priority: number; // 1-10

  createdAt: Date;
  expiresAt?: Date;
}

interface RiskAssessment {
  patientId: string;
  overallRisk: number; // 0-100
  riskFactors: {
    factor: string;
    score: number;
    description: string;
    modifiable: boolean;
  }[];

  diseases: {
    name: string;
    risk: number;
    factors: string[];
    prevention: string[];
  }[];

  calculatedAt: Date;
}

interface HealthTrend {
  metric: string;
  historical: {
    date: Date;
    value: number;
  }[];

  trend: {
    direction: 'improving' | 'stable' | 'worsening';
    changeRate: number; // per week
    confidence: number;
  };

  prediction: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
}
```

## API Design

```typescript
class AIHealthInsightsAgent extends BaseAgent {
  /**
   * Generate comprehensive health insights
   */
  async generateInsights(
    patientId: string,
    timeframe: number = 30 // days
  ): Promise<HealthInsight[]>

  /**
   * Detect correlations between vitals and activities
   */
  async detectCorrelations(params: {
    patientId: string;
    factor1: string;
    factor2: string;
  }): Promise<HealthInsight>

  /**
   * Predict future trends
   */
  async predictTrends(params: {
    patientId: string;
    metric: string;
    days: number;
  }): Promise<HealthTrend>

  /**
   * Detect anomalies
   */
  async detectAnomalies(params: {
    patientId: string;
    data: DataPoint[];
  }): Promise<HealthInsight[]>

  /**
   * Assess health risks
   */
  async assessRisks(patientId: string): Promise<RiskAssessment>

  /**
   * Natural language Q&A
   */
  async askQuestion(params: {
    patientId: string;
    question: string;
  }): Promise<{
    answer: string;
    sources: string[];
    confidence: number;
  }>

  /**
   * Analyze medication effectiveness
   */
  async analyzeMedicationEffectiveness(params: {
    patientId: string;
    medicationId: string;
  }): Promise<{
    effectiveness: number;
    sideEffects: string[];
    recommendation: string;
  }>

  /**
   * Compare with population benchmarks
   */
  async compareWithBenchmarks(params: {
    patientId: string;
    metric: string;
  }): Promise<{
    patientValue: number;
    populationAverage: number;
    percentile: number;
    interpretation: string;
  }>
}
```

## Claude AI Prompts

### Correlation Analysis
```typescript
const CORRELATION_PROMPT = `
Analyze the following health data for correlations:

Patient Data (30 days):
- Blood Pressure: [readings]
- Medications: [adherence]
- Exercise: [minutes]
- Water Intake: [ml]
- Sleep: [hours]

Identify:
1. Strong correlations between any factors
2. Causation vs correlation
3. Actionable insights
4. Recommendations

Format: JSON with correlations, confidence, and recommendations
`;
```

### Anomaly Detection
```typescript
const ANOMALY_PROMPT = `
Analyze these blood pressure readings for anomalies:

Recent readings: [120/80, 125/82, 165/95, 122/81, 118/78]
Historical average: 122/80
Patient context: Male, 65 years, on medication

Identify:
1. Any abnormal readings
2. Severity of anomaly
3. Possible causes
4. Recommended actions

Format: JSON with anomalies, severity, causes, actions
`;
```

### Predictive Analysis
```typescript
const PREDICTION_PROMPT = `
Predict health trends based on historical data:

Blood Sugar (past 30 days):
Week 1: avg 105
Week 2: avg 110
Week 3: avg 115
Week 4: avg 118

Context:
- Diet changes: reduced sweets
- Exercise: increased from 0 to 20 min/day
- Medication: started Metformin

Predict:
1. Next 7 days trend
2. Next 30 days trend
3. Confidence level
4. Recommendations

Format: JSON with predictions and confidence
`;
```

## Analysis Examples

### Correlation Example
```json
{
  "type": "correlation",
  "title": "ความดันสูงหลังข้ามยา",
  "description": "พบว่าทุกครั้งที่ไม่กินยาความดัน ความดันจะสูงกว่าปกติ 15-20 mmHg ในวันถัดไป",
  "confidence": 0.92,
  "correlatedFactors": {
    "factor1": "medication_adherence",
    "factor2": "blood_pressure",
    "correlation": -0.87,
    "examples": [
      "12 ม.ค.: ข้ามยา → 13 ม.ค.: ความดัน 145/92",
      "18 ม.ค.: ข้ามยา → 19 ม.ค.: ความดัน 148/95"
    ]
  },
  "recommendations": [
    "ตั้งเตือนกินยาทุกวัน",
    "หากลืมกินยา ควรวัดความดันในวันถัดไป",
    "ปรึกษาหมอหากข้ามยาบ่อย"
  ]
}
```

### Prediction Example
```json
{
  "type": "prediction",
  "title": "น้ำตาลมีแนวโน้มดีขึ้น",
  "description": "จากข้อมูล 30 วันที่ผ่านมา พบว่าน้ำตาลมีแนวโน้มลดลงต่อเนื่อง คาดว่า 7 วันข้างหน้าจะลดลงเหลือ 110 mg/dL",
  "confidence": 0.85,
  "prediction": {
    "metric": "blood_sugar",
    "currentValue": 118,
    "predictedValue": 110,
    "timeframe": "7 days",
    "trend": "decreasing"
  },
  "recommendations": [
    "รักษาการออกกำลังกายในระดับปัจจุบัน",
    "ควรลดคาร์โบไฮเดรตอีกเล็กน้อยเพื่อเป้าหมาย < 100",
    "วัดน้ำตาลต่อเนื่องเพื่อติดตาม"
  ]
}
```

### Anomaly Example
```json
{
  "type": "anomaly",
  "title": "⚠️ ความดันสูงผิดปกติ",
  "description": "ความดัน 165/95 สูงกว่าค่าเฉลี่ย 43/15 mmHg (3.2 SD)",
  "severity": "high",
  "anomaly": {
    "metric": "blood_pressure",
    "normalRange": { "min": 110, "max": 130 },
    "actualValue": 165,
    "deviation": 3.2
  },
  "recommendations": [
    "🚨 วัดความดันอีกครั้งภายใน 1 ชั่วโมง",
    "หลีกเลี่ยงการออกแรง",
    "หากยังสูง ควรติดต่อแพทย์ทันที",
    "ตรวจสอบว่ากินยาครบหรือไม่"
  ]
}
```

## Testing Strategy

### Test Scenarios
1. **Correlation**: ข้อมูล 30 วัน → หา correlation
2. **Prediction**: Historical trend → ทำนาย 7 วันข้างหน้า
3. **Anomaly**: ความดันสูงผิดปกติ → ตรวจจับและแจ้งเตือน
4. **Pattern**: พบ pattern ความดันสูงทุกวันจันทร์ (stress)
5. **Q&A**: "ทำไมความดันผมถึงสูง" → ตอบพร้อมเหตุผล
6. **Risk**: คำนวณความเสี่ยงโรคหัวใจ
7. **Medication**: วิเคราะห์ว่ายาใหม่ช่วยลดน้ำตาลได้จริงหรือไม่

## Timeline

**Estimated**: 20 hours (2.5 days)

## Examples - Natural Language Q&A

### User Question
```
"ทำไมสัปดาห์นี้ความดันผมถึงสูงกว่าปกติ"
```

### AI Answer
```
จากข้อมูลสัปดาห์นี้ของคุณ พบปัจจัยที่อาจทำให้ความดันสูงดังนี้:

1. **การกินยาไม่สม่ำเสมอ** (ความเชื่อมั่น: สูง)
   - ข้ามยาความดัน 2 วันในสัปดาห์นี้ (วันพุธและศุกร์)
   - ความดันในวันถัดไปสูงถึง 145/92 และ 148/95

2. **ออกกำลังกายน้อยลง** (ความเชื่อมั่น: ปานกลาง)
   - สัปดาห์นี้ออกกำลังกายเพียง 2 วัน เทียบกับสัปดาห์ที่แล้ว 5 วัน
   - การออกกำลังกายช่วยลดความดันได้ 5-10 mmHg

3. **ดื่มน้ำน้อยลง** (ความเชื่อมั่น: ต่ำ)
   - เฉลี่ย 1,500ml/วัน ลดลงจาก 2,000ml/วัน

**คำแนะนำ:**
✅ กินยาให้ตรงเวลาทุกวัน
✅ กลับมาออกกำลังกาย 30 นาที/วันอย่างน้อย 5 วัน/สัปดาห์
✅ ดื่มน้ำให้ครบ 2,000ml/วัน

**แหล่งข้อมูล:**
- ข้อมูลยาของคุณ (12-18 ม.ค.)
- บันทึกออกกำลังกาย (สัปดาห์ที่ 3)
- การวัดความดัน (10 ครั้งในสัปดาห์นี้)
```

---

**Created**: 2024-01-16
**Priority**: High (Value-add feature)
**Status**: Ready for implementation
**Note**: Requires Claude API integration
