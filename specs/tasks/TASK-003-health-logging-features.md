# TASK-003: Health Logging Features

**Priority:** 🔴 CRITICAL
**Status:** 📋 Ready to Start
**Owner:** Backend Developer / HealthAgent Specialist
**Estimated Time:** 6-8 hours
**Dependencies:** TASK-001 (User Registration)

---

## 📝 Overview

พัฒนาระบบบันทึกข้อมูลสุขภาพครบถ้วน รองรับการบันทึกผ่าน:
- 💊 **ยา** (Medication)
- 🩺 **ความดันโลหิต** (Blood Pressure + Heart Rate)
- 💧 **น้ำ** (Water Intake)
- 🚶 **การเดิน/ออกกำลังกาย** (Exercise)
- 🍚 **อาหาร** (Food/Meals)

---

## 🎯 User Stories

### Story 1: บันทึกการกินยา
**As a** ผู้สูงอายุ
**I want** บันทึกว่ากินยาแล้ว
**So that** ระบบจำได้ว่ากินยาครบหรือยัง

**Acceptance Criteria:**
- ✅ พิมพ์ "กินยาแล้ว" → บันทึกอัตโนมัติ
- ✅ ระบุชื่อยา → บันทึกยาที่เฉพาเจาะจง
- ✅ ระบุเวลา → บันทึกย้อนหลังได้
- ✅ ดูประวัติการกินยา
- ✅ แจ้งเตือนถ้าลืมกิน (future)

### Story 2: บันทึกความดันโลหิต
**As a** ผู้สูงอายุ
**I want** บันทึกความดันโลหิต
**So that** ติดตามสุขภาพหัวใจ

**Acceptance Criteria:**
- ✅ พิมพ์ "วัดความดัน 120/80" → บันทึกอัตโนมัติ
- ✅ ส่งรูปเครื่องวัด → OCR อ่านค่าอัตโนมัติ
- ✅ บันทึกพร้อม Heart Rate
- ✅ เตือนถ้าความดันผิดปกติ
- ✅ Validation ค่าความดันที่เป็นไปได้

### Story 3: บันทึกการดื่มน้ำ
**As a** ผู้สูงอายุ
**I want** บันทึกปริมาณน้ำที่ดื่ม
**So that** แน่ใจว่าดื่มน้ำเพียงพอต่อวัน

**Acceptance Criteria:**
- ✅ พิมพ์ "ดื่มน้ำแล้ว" → บันทึก 250ml (default)
- ✅ ระบุปริมาณ "ดื่มน้ำ 500 ml"
- ✅ ดูสรุปรายวัน (เป้าหมาย 2000ml)
- ✅ แจ้งเตือนถ้าดื่มน้อย

### Story 4: บันทึกการออกกำลังกาย
**As a** ผู้สูงอายุ
**I want** บันทึกการเดินและออกกำลังกาย
**So that** ติดตามกิจกรรมประจำวัน

**Acceptance Criteria:**
- ✅ พิมพ์ "เดินแล้ว" → บันทึกอัตโนมัติ
- ✅ ระบุระยะทาง "เดิน 2 กม."
- ✅ ระบุเวลา "เดิน 30 นาที"
- ✅ บันทึกกิจกรรมอื่น (ยืดเหยียด, โยคะ)

### Story 5: บันทึกอาหาร
**As a** ผู้สูงอายุ
**I want** บันทึกมื้ออาหาร
**So that** ติดตามว่ากินอาหารครบหรือยัง

**Acceptance Criteria:**
- ✅ พิมพ์ "กินข้าวแล้ว" → บันทึกมื้อปัจจุบัน
- ✅ ระบุมื้อ "กินเช้าแล้ว"
- ✅ ส่งรูปอาหาร → AI วิเคราะห์ (future)
- ✅ บันทึกหมายเหตุ

---

## 🛠 Technical Implementation

### 1. Database Schema

```sql
-- Health Logs Table
CREATE TABLE health_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  log_type VARCHAR(50) NOT NULL, -- medication, vitals, water, exercise, food
  log_data JSONB NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,

  CONSTRAINT valid_log_type CHECK (log_type IN ('medication', 'vitals', 'water', 'exercise', 'food'))
);

-- Indexes
CREATE INDEX idx_health_logs_patient ON health_logs(patient_id);
CREATE INDEX idx_health_logs_type ON health_logs(log_type);
CREATE INDEX idx_health_logs_date ON health_logs(logged_at);
CREATE INDEX idx_health_logs_combined ON health_logs(patient_id, log_type, logged_at);

-- Sample data structures
-- Medication log
{
  "medication_id": "uuid or null",
  "medication_name": "Amlodipine 5mg",
  "dosage": "1 เม็ด",
  "time_of_day": "morning",
  "notes": ""
}

-- Vitals log
{
  "systolic": 120,
  "diastolic": 80,
  "heart_rate": 72,
  "measurement_method": "auto|manual|ocr",
  "device": "Omron HEM-7121",
  "notes": ""
}

-- Water log
{
  "amount_ml": 250,
  "notes": ""
}

-- Exercise log
{
  "activity_type": "walking",
  "duration_minutes": 30,
  "distance_km": 2.0,
  "intensity": "light|moderate|vigorous",
  "notes": ""
}

-- Food log
{
  "meal_type": "breakfast|lunch|dinner|snack",
  "description": "ข้าวผัด ไข่เจียว",
  "photo_url": "https://...",
  "notes": ""
}
```

### 2. API Endpoints

**File:** `src/routes/health.routes.ts` (new file)

```typescript
import { Router } from 'express';
import { SupabaseService } from '../services/supabase.service';

const router = Router();
const supabase = new SupabaseService();

// POST /api/health/medication
router.post('/medication', async (req, res) => {
  try {
    const { patient_id, medication_name, logged_at, notes } = req.body;

    const { data, error } = await supabase.client
      .from('health_logs')
      .insert({
        patient_id,
        log_type: 'medication',
        log_data: {
          medication_name,
          notes
        },
        logged_at: logged_at || new Date()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health/vitals
router.post('/vitals', async (req, res) => {
  try {
    const { patient_id, systolic, diastolic, heart_rate, logged_at } = req.body;

    // Validation
    if (systolic < 70 || systolic > 200) {
      return res.status(400).json({ error: 'Invalid systolic value' });
    }
    if (diastolic < 40 || diastolic > 130) {
      return res.status(400).json({ error: 'Invalid diastolic value' });
    }

    const { data, error } = await supabase.client
      .from('health_logs')
      .insert({
        patient_id,
        log_type: 'vitals',
        log_data: {
          systolic,
          diastolic,
          heart_rate,
          measurement_method: 'manual'
        },
        logged_at: logged_at || new Date()
      })
      .select()
      .single();

    if (error) throw error;

    // Check if abnormal
    const isAbnormal = systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60;

    res.json({ success: true, data, alert: isAbnormal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health/water
router.post('/water', async (req, res) => {
  try {
    const { patient_id, amount_ml, logged_at } = req.body;

    const { data, error } = await supabase.client
      .from('health_logs')
      .insert({
        patient_id,
        log_type: 'water',
        log_data: {
          amount_ml: amount_ml || 250
        },
        logged_at: logged_at || new Date()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health/exercise
router.post('/exercise', async (req, res) => {
  try {
    const { patient_id, activity_type, duration_minutes, distance_km, logged_at } = req.body;

    const { data, error } = await supabase.client
      .from('health_logs')
      .insert({
        patient_id,
        log_type: 'exercise',
        log_data: {
          activity_type: activity_type || 'walking',
          duration_minutes,
          distance_km
        },
        logged_at: logged_at || new Date()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health/food
router.post('/food', async (req, res) => {
  try {
    const { patient_id, meal_type, description, logged_at } = req.body;

    const { data, error } = await supabase.client
      .from('health_logs')
      .insert({
        patient_id,
        log_type: 'food',
        log_data: {
          meal_type,
          description
        },
        logged_at: logged_at || new Date()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health/logs/:patient_id
router.get('/logs/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { log_type, start_date, end_date, limit = 50 } = req.query;

    let query = supabase.client
      .from('health_logs')
      .select('*')
      .eq('patient_id', patient_id)
      .order('logged_at', { ascending: false })
      .limit(Number(limit));

    if (log_type) {
      query = query.eq('log_type', log_type);
    }

    if (start_date) {
      query = query.gte('logged_at', start_date);
    }

    if (end_date) {
      query = query.lte('logged_at', end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 3. Update HealthAgent

**File:** `src/agents/specialized/HealthAgent.ts`

```typescript
async process(message: Message): Promise<Response> {
  const startTime = Date.now();

  try {
    const intent = message.metadata?.intent;
    const userId = message.context.userId;

    // Get patient profile
    const patient = await this.supabase.getPatientByLineId(userId);
    if (!patient) {
      return {
        success: false,
        error: 'Patient not registered',
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }

    let result;

    switch(intent) {
      case 'medication':
        result = await this.processMedication(message, patient.id);
        break;
      case 'vitals':
        result = await this.processVitals(message, patient.id);
        break;
      case 'water':
        result = await this.processWater(message, patient.id);
        break;
      case 'walk':
      case 'exercise':
        result = await this.processExercise(message, patient.id);
        break;
      case 'food':
        result = await this.processFood(message, patient.id);
        break;
      default:
        throw new Error('Unknown health intent');
    }

    return {
      success: true,
      data: result,
      agentName: this.config.name,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    this.log('error', 'Health processing failed', error);
    return {
      success: false,
      error: error.message,
      agentName: this.config.name,
      processingTime: Date.now() - startTime
    };
  }
}

private async processMedication(message: Message, patientId: string) {
  // Use Claude to extract medication details
  const systemPrompt = `Extract medication information from Thai text.

  Examples:
  - "กินยาแล้ว" → { medication_name: null, notes: "ทั่วไป" }
  - "กินยาความดัน" → { medication_name: "ยาความดัน", notes: "" }
  - "กิน Amlodipine 5mg แล้ว" → { medication_name: "Amlodipine 5mg", notes: "" }

  Output JSON only.`;

  const extracted = await this.askClaude(message.content, systemPrompt);
  const medicationData = JSON.parse(extracted);

  // Save to database
  const { data, error } = await this.supabase.client
    .from('health_logs')
    .insert({
      patient_id: patientId,
      log_type: 'medication',
      log_data: medicationData,
      logged_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;

  return {
    response: `บันทึกการกินยาเรียบร้อยแล้วค่ะ ${medicationData.medication_name ? `(${medicationData.medication_name})` : ''}`,
    data
  };
}

private async processVitals(message: Message, patientId: string) {
  // Extract BP values using regex or Claude
  const bpPattern = /(\d{2,3})\s*\/\s*(\d{2,3})/;
  const match = message.content.match(bpPattern);

  if (!match) {
    return {
      response: 'กรุณาระบุค่าความดันในรูปแบบ 120/80 ค่ะ',
      requiresInput: true
    };
  }

  const systolic = parseInt(match[1]);
  const diastolic = parseInt(match[2]);

  // Validation
  if (systolic < 70 || systolic > 200 || diastolic < 40 || diastolic > 130) {
    return {
      response: 'ค่าความดันที่ระบุดูผิดปกติ กรุณาตรวจสอบอีกครั้งค่ะ',
      requiresInput: true
    };
  }

  // Save to database
  const { data, error } = await this.supabase.client
    .from('health_logs')
    .insert({
      patient_id: patientId,
      log_type: 'vitals',
      log_data: {
        systolic,
        diastolic,
        measurement_method: 'manual'
      },
      logged_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;

  // Check if abnormal
  let response = `บันทึกความดัน ${systolic}/${diastolic} เรียบร้อยค่ะ`;

  if (systolic > 140 || diastolic > 90) {
    response += '\n\n⚠️ ความดันสูงกว่าปกติ ควรพักผ่อนและติดตามอาการค่ะ';
  } else if (systolic < 90 || diastolic < 60) {
    response += '\n\n⚠️ ความดันต่ำกว่าปกติ ควรระวังอาการเวียนศีรษะค่ะ';
  }

  return { response, data, alert: systolic > 140 || diastolic > 90 || systolic < 90 || diastolic < 60 };
}

private async processWater(message: Message, patientId: string) {
  // Extract amount
  const amountPattern = /(\d+)\s*(ml|มล|มิลลิลิตร)?/i;
  const match = message.content.match(amountPattern);

  const amount_ml = match ? parseInt(match[1]) : 250; // default 250ml

  // Save to database
  const { data, error } = await this.supabase.client
    .from('health_logs')
    .insert({
      patient_id: patientId,
      log_type: 'water',
      log_data: { amount_ml },
      logged_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;

  // Get today's total
  const today = new Date().toISOString().split('T')[0];
  const { data: todayLogs } = await this.supabase.client
    .from('health_logs')
    .select('log_data')
    .eq('patient_id', patientId)
    .eq('log_type', 'water')
    .gte('logged_at', today)
    .lt('logged_at', `${today}T23:59:59`);

  const totalToday = todayLogs?.reduce((sum, log) => sum + (log.log_data.amount_ml || 0), 0) || 0;
  const goal = 2000; // 2L per day

  return {
    response: `บันทึกการดื่มน้ำ ${amount_ml} ml เรียบร้อยค่ะ\n\nวันนี้ดื่มไปแล้ว: ${totalToday}/${goal} ml (${Math.round(totalToday/goal*100)}%)`,
    data,
    totalToday
  };
}

private async processExercise(message: Message, patientId: string) {
  // Use Claude to extract exercise details
  const systemPrompt = `Extract exercise information from Thai text.

  Examples:
  - "เดินแล้ว" → { activity_type: "walking", duration_minutes: null, distance_km: null }
  - "เดิน 30 นาที" → { activity_type: "walking", duration_minutes: 30, distance_km: null }
  - "เดิน 2 กม" → { activity_type: "walking", duration_minutes: null, distance_km: 2.0 }
  - "ยืดเหยียด 15 นาที" → { activity_type: "stretching", duration_minutes: 15, distance_km: null }

  Output JSON only.`;

  const extracted = await this.askClaude(message.content, systemPrompt);
  const exerciseData = JSON.parse(extracted);

  // Save to database
  const { data, error } = await this.supabase.client
    .from('health_logs')
    .insert({
      patient_id: patientId,
      log_type: 'exercise',
      log_data: exerciseData,
      logged_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;

  let response = `บันทึกการ${exerciseData.activity_type === 'walking' ? 'เดิน' : 'ออกกำลังกาย'}เรียบร้อยค่ะ`;
  if (exerciseData.duration_minutes) {
    response += ` ${exerciseData.duration_minutes} นาที`;
  }
  if (exerciseData.distance_km) {
    response += ` ${exerciseData.distance_km} กม.`;
  }

  return { response, data };
}

private async processFood(message: Message, patientId: string) {
  // Use Claude to extract meal details
  const systemPrompt = `Extract meal information from Thai text.

  Determine meal_type based on time or explicit mention:
  - breakfast: 06:00-10:00 or explicit "เช้า"
  - lunch: 11:00-14:00 or explicit "เที่ยง"
  - dinner: 17:00-21:00 or explicit "เย็น"
  - snack: other times or explicit "ว่าง"

  Examples:
  - "กินข้าวแล้ว" → { meal_type: "based on time", description: "ข้าว" }
  - "กินเช้าแล้ว" → { meal_type: "breakfast", description: "" }
  - "กินข้าวผัด ไข่เจียว" → { meal_type: "based on time", description: "ข้าวผัด ไข่เจียว" }

  Output JSON only.`;

  const extracted = await this.askClaude(message.content, systemPrompt);
  const foodData = JSON.parse(extracted);

  // Determine meal_type if not set
  if (foodData.meal_type === 'based on time') {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) foodData.meal_type = 'breakfast';
    else if (hour >= 11 && hour < 14) foodData.meal_type = 'lunch';
    else if (hour >= 17 && hour < 21) foodData.meal_type = 'dinner';
    else foodData.meal_type = 'snack';
  }

  // Save to database
  const { data, error } = await this.supabase.client
    .from('health_logs')
    .insert({
      patient_id: patientId,
      log_type: 'food',
      log_data: foodData,
      logged_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;

  const mealNames = {
    breakfast: 'อาหารเช้า',
    lunch: 'อาหารเที่ยง',
    dinner: 'อาหารเย็น',
    snack: 'ของว่าง'
  };

  return {
    response: `บันทึก${mealNames[foodData.meal_type]}เรียบร้อยค่ะ${foodData.description ? ` (${foodData.description})` : ''}`,
    data
  };
}
```

### 4. Update IntentAgent Patterns

**File:** `src/agents/specialized/IntentAgent.ts`

```typescript
private patterns = {
  medication: [
    /ยา/, /กิน.*ยา/, /ทาน.*ยา/, /medication/,
    /amlodipine/i, /metformin/i  // common meds
  ],
  vitals: [
    /ความดัน/, /วัด.*ความดัน/, /blood.*pressure/i,
    /\d{2,3}\s*\/\s*\d{2,3}/,  // BP pattern
    /bp/i, /hr/i, /heart.*rate/i
  ],
  water: [
    /น้ำ/, /ดื่ม/, /water/, /ml/, /มล/, /มิลลิลิตร/
  ],
  walk: [
    /เดิน/, /walking/, /walk/, /ออกกำลัง/, /exercise/,
    /ยืดเหยียด/, /stretching/, /โยคะ/, /yoga/
  ],
  food: [
    /กิน/, /อาหาร/, /ข้าว/, /เช้า/, /เที่ยง/, /เย็น/, /ว่าง/,
    /breakfast/, /lunch/, /dinner/, /snack/, /meal/
  ],
  // ... existing patterns
};
```

### 5. Update OrchestratorAgent Routing

**File:** `src/agents/core/OrchestratorAgent.ts`

```typescript
case 'medication':
case 'vitals':
case 'water':
case 'walk':
case 'food':
  plan.agents = ['health'];
  break;
```

### 6. Register Routes in index.ts

**File:** `src/index.ts`

```typescript
import healthRoutes from './routes/health.routes';

// Add after registration routes
app.use('/api/health', healthRoutes);
```

---

## 📂 Files to Create/Modify

### New Files:
1. `src/routes/health.routes.ts` - Health API endpoints
2. `database/migrations/003_health_logs.sql` - Health logs table

### Modified Files:
1. `src/agents/specialized/HealthAgent.ts` - Complete implementation
2. `src/agents/specialized/IntentAgent.ts` - Add health patterns
3. `src/agents/core/OrchestratorAgent.ts` - Update routing
4. `src/index.ts` - Register health routes

---

## ✅ Testing Checklist

### Unit Tests
- [ ] Medication extraction works
- [ ] BP pattern matching works
- [ ] Water amount extraction works
- [ ] Exercise extraction works
- [ ] Food/meal detection works

### Integration Tests
- [ ] POST /api/health/medication
- [ ] POST /api/health/vitals (with validation)
- [ ] POST /api/health/water
- [ ] POST /api/health/exercise
- [ ] POST /api/health/food
- [ ] GET /api/health/logs/:patient_id

### LINE Bot Tests
- [ ] พิมพ์ "กินยาแล้ว" → บันทึกสำเร็จ
- [ ] พิมพ์ "วัดความดัน 120/80" → บันทึกสำเร็จ
- [ ] พิมพ์ "วัดความดัน 180/100" → แจ้งเตือนความดันสูง
- [ ] พิมพ์ "ดื่มน้ำ 500 ml" → บันทึก + แสดงยอดรวม
- [ ] พิมพ์ "เดิน 30 นาที" → บันทึกสำเร็จ
- [ ] พิมพ์ "กินข้าวแล้ว" → บันทึกมื้ออาหาร

### Edge Cases
- [ ] ค่าความดันผิดปกติ (300/200) → reject
- [ ] ค่าความดันติดลบ → reject
- [ ] ดื่มน้ำเกิน 5L/วัน → warn
- [ ] User ไม่ได้ลงทะเบียน → แจ้งให้ลงทะเบียนก่อน

---

## 🚀 Deployment Steps

### 1. Create Migration

```bash
# Create migration file
cat > database/migrations/003_health_logs.sql << 'EOF'
-- Create health_logs table
CREATE TABLE IF NOT EXISTS health_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_type VARCHAR(50) NOT NULL,
  log_data JSONB NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,

  CONSTRAINT valid_log_type CHECK (log_type IN ('medication', 'vitals', 'water', 'exercise', 'food'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_logs_patient ON health_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_type ON health_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_health_logs_date ON health_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_health_logs_combined ON health_logs(patient_id, log_type, logged_at DESC);

-- RLS Policies
ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;

-- Patients can read their own logs
CREATE POLICY "Patients can view own health logs"
  ON health_logs FOR SELECT
  USING (patient_id IN (
    SELECT id FROM patients WHERE line_user_id = auth.uid()::text
  ));

-- Caregivers can read linked patients' logs
CREATE POLICY "Caregivers can view linked patients health logs"
  ON health_logs FOR SELECT
  USING (patient_id IN (
    SELECT patient_id FROM caregiver_links
    WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE line_user_id = auth.uid()::text
    )
    AND status = 'approved'
  ));

-- Service role can insert
CREATE POLICY "Service can insert health logs"
  ON health_logs FOR INSERT
  WITH CHECK (true);
EOF

# Run migration
psql $SUPABASE_DB_URL -f database/migrations/003_health_logs.sql
```

### 2. Build and Test

```bash
npm run build
npm run test
```

### 3. Commit and Push

```bash
git add .
git commit -m "Add health logging features (medication, vitals, water, exercise, food)"
git push origin master
```

---

## 📊 Success Metrics

- ✅ ทุก health intent มี API endpoint
- ✅ บันทึกข้อมูลได้ถูกต้อง 95%+
- ✅ Validation ทำงานถูกต้อง
- ✅ Response time < 1s
- ✅ ผู้ใช้บันทึกข้อมูลเพิ่มขึ้น 50%

---

## 🔮 Future Enhancements

- 🖼 OCR for blood pressure device photos
- 🍽 Image recognition for food
- 📈 Trend analysis and insights
- ⏰ Medication reminders
- 🎯 Personalized health goals
- 📱 Integration with health wearables

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
