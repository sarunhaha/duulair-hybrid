# TASK-004: Daily/Weekly Reports

**Priority:** 🟡 High
**Status:** 📋 Ready to Start
**Owner:** Backend Developer / ReportAgent Specialist
**Estimated Time:** 4-5 hours
**Dependencies:** TASK-003 (Health Logging)

---

## 📝 Overview

พัฒนาระบบรายงานสุขภาพอัตโนมัติ:
- 📅 **รายงานรายวัน** (Daily Report)
- 📊 **รายงานรายสัปดาห์** (Weekly Report)
- 📈 **รายงานรายเดือน** (Monthly Report - future)

รายงานแสดงสรุปกิจกรรมสุขภาพ, Insights, และ Alerts

---

## 🎯 User Stories

### Story 1: รายงานประจำวัน
**As a** ผู้ป่วย/ผู้ดูแล
**I want** ดูรายงานประจำวันของการดูแลสุขภาพ
**So that** ทราบว่าทำกิจกรรมครบหรือยัง

**Acceptance Criteria:**
- ✅ พิมพ์ "รายงานวันนี้" → ดูรายงานวันนี้
- ✅ พิมพ์ "รายงานเมื่อวาน" → ดูรายงานเมื่อวาน
- ✅ กด Rich Menu "ดูรายงาน" → Quick Reply เลือกวันที่
- ✅ แสดงสรุปกิจกรรม (ยา, ความดัน, น้ำ, ออกกำลังกาย, อาหาร)
- ✅ แสดง % ความสำเร็จ
- ✅ แสดง Insights จาก AI
- ✅ รายงานเป็น Flex Message สวยงาม

### Story 2: รายงานรายสัปดาห์
**As a** ผู้ป่วย/ผู้ดูแล
**I want** ดูรายงานสรุป 7 วันที่ผ่านมา
**So that** เห็น Trend และความก้าวหน้า

**Acceptance Criteria:**
- ✅ พิมพ์ "รายงานสัปดาห์นี้" → ดูรายงาน 7 วัน
- ✅ แสดง Trend Chart (ข้อความ ASCII art)
- ✅ แสดง Average values
- ✅ เปรียบเทียบกับสัปดาห์ก่อน
- ✅ AI Insights สำหรับ 7 วัน

### Story 3: Auto-send รายงานประจำวัน
**As a** ผู้ดูแล
**I want** ได้รับรายงานประจำวันอัตโนมัติ
**So that** ติดตามสุขภาพผู้ป่วยได้ทุกวัน

**Acceptance Criteria:**
- ✅ ส่งรายงานอัตโนมัติทุกวันเวลา 20:00
- ✅ ส่งถึงผู้ป่วย + ผู้ดูแลที่เปิดการแจ้งเตือน
- ✅ สรุปกิจกรรมวันนั้น
- ✅ ไฮไลต์ประเด็นสำคัญ

---

## 🛠 Technical Implementation

### 1. Database Views

```sql
-- Daily Summary View
CREATE OR REPLACE VIEW daily_health_summary AS
SELECT
  patient_id,
  DATE(logged_at) as log_date,

  -- Medication count
  COUNT(CASE WHEN log_type = 'medication' THEN 1 END) as medication_count,

  -- Vitals (latest of the day)
  (SELECT log_data->>'systolic' FROM health_logs hl2
   WHERE hl2.patient_id = health_logs.patient_id
   AND hl2.log_type = 'vitals'
   AND DATE(hl2.logged_at) = DATE(health_logs.logged_at)
   ORDER BY hl2.logged_at DESC LIMIT 1)::int as latest_systolic,

  (SELECT log_data->>'diastolic' FROM health_logs hl2
   WHERE hl2.patient_id = health_logs.patient_id
   AND hl2.log_type = 'vitals'
   AND DATE(hl2.logged_at) = DATE(health_logs.logged_at)
   ORDER BY hl2.logged_at DESC LIMIT 1)::int as latest_diastolic,

  -- Water total
  SUM(CASE WHEN log_type = 'water' THEN (log_data->>'amount_ml')::int ELSE 0 END) as total_water_ml,

  -- Exercise total
  SUM(CASE WHEN log_type = 'exercise' THEN (log_data->>'duration_minutes')::int ELSE 0 END) as total_exercise_minutes,

  -- Food count
  COUNT(CASE WHEN log_type = 'food' THEN 1 END) as food_count

FROM health_logs
GROUP BY patient_id, DATE(logged_at);

-- Weekly Summary View
CREATE OR REPLACE VIEW weekly_health_summary AS
SELECT
  patient_id,
  DATE_TRUNC('week', logged_at) as week_start,

  -- Averages
  AVG(CASE WHEN log_type = 'vitals' THEN (log_data->>'systolic')::int END) as avg_systolic,
  AVG(CASE WHEN log_type = 'vitals' THEN (log_data->>'diastolic')::int END) as avg_diastolic,
  AVG(CASE WHEN log_type = 'water' THEN (log_data->>'amount_ml')::int END) as avg_water_per_log,

  -- Totals
  COUNT(CASE WHEN log_type = 'medication' THEN 1 END) as total_medications,
  SUM(CASE WHEN log_type = 'water' THEN (log_data->>'amount_ml')::int ELSE 0 END) as total_water_ml,
  SUM(CASE WHEN log_type = 'exercise' THEN (log_data->>'duration_minutes')::int ELSE 0 END) as total_exercise_minutes,
  COUNT(CASE WHEN log_type = 'food' THEN 1 END) as total_meals,

  -- Activity days
  COUNT(DISTINCT DATE(logged_at)) as active_days

FROM health_logs
GROUP BY patient_id, DATE_TRUNC('week', logged_at);
```

### 2. API Endpoints

**File:** `src/routes/report.routes.ts` (new file)

```typescript
import { Router } from 'express';
import { SupabaseService } from '../services/supabase.service';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const supabase = new SupabaseService();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/reports/daily/:patient_id
router.get('/daily/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { date } = req.query; // Optional: YYYY-MM-DD

    const targetDate = date ? new Date(date as string) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get daily summary
    const { data: summary, error } = await supabase.client
      .from('daily_health_summary')
      .select('*')
      .eq('patient_id', patient_id)
      .eq('log_date', dateStr)
      .single();

    if (error && error.code !== 'PGRST116') { // Not "not found" error
      throw error;
    }

    // Get patient goals
    const { data: patient } = await supabase.client
      .from('patients')
      .select('health_goals')
      .eq('id', patient_id)
      .single();

    const goals = patient?.health_goals || {
      medications_per_day: 3,
      water_ml_per_day: 2000,
      exercise_minutes_per_day: 30,
      meals_per_day: 3
    };

    // Calculate completion rates
    const report = {
      date: dateStr,
      summary: summary || {
        medication_count: 0,
        total_water_ml: 0,
        total_exercise_minutes: 0,
        food_count: 0
      },
      goals,
      completion: {
        medications: Math.min(100, Math.round((summary?.medication_count || 0) / goals.medications_per_day * 100)),
        water: Math.min(100, Math.round((summary?.total_water_ml || 0) / goals.water_ml_per_day * 100)),
        exercise: Math.min(100, Math.round((summary?.total_exercise_minutes || 0) / goals.exercise_minutes_per_day * 100)),
        meals: Math.min(100, Math.round((summary?.food_count || 0) / goals.meals_per_day * 100))
      },
      vitals: summary ? {
        systolic: summary.latest_systolic,
        diastolic: summary.latest_diastolic
      } : null
    };

    // Calculate overall completion
    const overallCompletion = Math.round(
      (report.completion.medications + report.completion.water +
       report.completion.exercise + report.completion.meals) / 4
    );

    res.json({
      success: true,
      data: { ...report, overallCompletion }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/weekly/:patient_id
router.get('/weekly/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { week_start } = req.query; // Optional: YYYY-MM-DD

    const targetWeek = week_start ? new Date(week_start as string) : new Date();

    // Get start of week (Monday)
    const weekStart = new Date(targetWeek);
    weekStart.setDate(targetWeek.getDate() - targetWeek.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Get weekly summary
    const { data: summary, error } = await supabase.client
      .from('weekly_health_summary')
      .select('*')
      .eq('patient_id', patient_id)
      .eq('week_start', weekStartStr)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Get daily breakdown for the week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const { data: dailyBreakdown } = await supabase.client
      .from('daily_health_summary')
      .select('*')
      .eq('patient_id', patient_id)
      .gte('log_date', weekStart.toISOString().split('T')[0])
      .lte('log_date', weekEnd.toISOString().split('T')[0])
      .order('log_date', { ascending: true });

    res.json({
      success: true,
      data: {
        week_start: weekStartStr,
        summary: summary || {},
        daily_breakdown: dailyBreakdown || [],
        active_days: summary?.active_days || 0,
        target_days: 7
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/generate-insights
router.post('/generate-insights', async (req, res) => {
  try {
    const { patient_id, report_type, report_data } = req.body;

    // Get patient info
    const { data: patient } = await supabase.client
      .from('patients')
      .select('first_name, chronic_diseases')
      .eq('id', patient_id)
      .single();

    // Generate insights using Claude
    const systemPrompt = `You are a health assistant analyzing ${report_type} health data for a Thai elderly patient.

Patient: ${patient?.first_name}
Chronic conditions: ${patient?.chronic_diseases?.join(', ') || 'None'}

Data: ${JSON.stringify(report_data)}

Provide 2-3 brief insights in Thai (ภาษาไทย):
1. Positive feedback on what went well
2. Gentle suggestions for improvement
3. Health tips related to their data

Keep each insight under 30 words. Be supportive, not critical. Use polite Thai (ค่ะ/ครับ).`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: 'Generate health insights from this data.'
      }],
      system: systemPrompt
    });

    const insights = response.content[0].type === 'text' ? response.content[0].text : '';

    res.json({ success: true, insights });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 3. Update ReportAgent

**File:** `src/agents/specialized/ReportAgent.ts`

```typescript
import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';
import { FlexMessage } from '@line/bot-sdk';

export class ReportAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'report',
      role: 'Generate health reports and insights',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
      maxTokens: 500,
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Report Agent initialized');
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();

    try {
      const userId = message.context.userId;
      const reportType = this.detectReportType(message.content);

      // Get patient
      const patient = await this.supabase.getPatientByLineId(userId);
      if (!patient) {
        return {
          success: true,
          data: {
            response: 'กรุณาลงทะเบียนก่อนเพื่อดูรายงานค่ะ'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      let reportData;

      if (reportType === 'daily') {
        reportData = await this.generateDailyReport(patient.id, message.content);
      } else if (reportType === 'weekly') {
        reportData = await this.generateWeeklyReport(patient.id);
      } else {
        return {
          success: true,
          data: {
            response: 'กรุณาระบุประเภทรายงาน เช่น "รายงานวันนี้" หรือ "รายงานสัปดาห์นี้" ค่ะ'
          },
          agentName: this.config.name,
          processingTime: Date.now() - startTime
        };
      }

      // Generate insights
      const insights = await this.generateInsights(patient.id, reportType, reportData);

      return {
        success: true,
        data: {
          reportType,
          reportData,
          insights,
          flexMessage: this.createReportFlexMessage(reportType, reportData, insights)
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.log('error', 'Report generation failed', error);
      return {
        success: false,
        error: error.message,
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  private detectReportType(content: string): string {
    if (/วันนี้|ประจำวัน|daily|today/i.test(content)) {
      return 'daily';
    }
    if (/เมื่อวาน|yesterday/i.test(content)) {
      return 'daily_yesterday';
    }
    if (/สัปดาห์|รายสัปดาห์|weekly|week/i.test(content)) {
      return 'weekly';
    }
    if (/เดือน|รายเดือน|monthly|month/i.test(content)) {
      return 'monthly';
    }
    return 'unknown';
  }

  private async generateDailyReport(patientId: string, content: string) {
    // Determine date
    const isYesterday = /เมื่อวาน|yesterday/i.test(content);
    const targetDate = new Date();
    if (isYesterday) {
      targetDate.setDate(targetDate.getDate() - 1);
    }
    const dateStr = targetDate.toISOString().split('T')[0];

    // Fetch from API
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/reports/daily/${patientId}?date=${dateStr}`);
    const result = await response.json();

    return result.data;
  }

  private async generateWeeklyReport(patientId: string) {
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/reports/weekly/${patientId}`);
    const result = await response.json();

    return result.data;
  }

  private async generateInsights(patientId: string, reportType: string, reportData: any) {
    const systemPrompt = `You are analyzing ${reportType} health report for a Thai elderly patient.

Report data: ${JSON.stringify(reportData)}

Provide 2-3 brief insights in Thai:
1. ชมเชยในสิ่งที่ทำได้ดี
2. แนะนำสิ่งที่ควรปรับปรุง (ใช้ภาษาอ่อนโยน)
3. เคล็ดลับสุขภาพที่เกี่ยวข้อง

แต่ละข้อไม่เกิน 30 คำ ใช้ภาษาสุภาพ`;

    const insights = await this.askClaude(
      'Generate insights',
      systemPrompt
    );

    return insights;
  }

  private createReportFlexMessage(reportType: string, reportData: any, insights: string): any {
    if (reportType === 'daily') {
      return this.createDailyReportFlex(reportData, insights);
    } else if (reportType === 'weekly') {
      return this.createWeeklyReportFlex(reportData, insights);
    }
  }

  private createDailyReportFlex(data: any, insights: string): any {
    const { date, summary, completion, overallCompletion, vitals } = data;

    return {
      type: 'flex',
      altText: `รายงานประจำวัน ${date}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📅 รายงานประจำวัน',
              weight: 'bold',
              size: 'xl',
              color: '#4CAF50'
            },
            {
              type: 'text',
              text: date,
              size: 'sm',
              color: '#999999'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // Overall completion
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: `ความสำเร็จโดยรวม: ${overallCompletion}%`,
                  weight: 'bold',
                  size: 'md',
                  color: overallCompletion >= 70 ? '#4CAF50' : '#FF9800'
                },
                {
                  type: 'text',
                  text: this.createProgressBar(overallCompletion),
                  wrap: true,
                  size: 'xs',
                  margin: 'sm'
                }
              ],
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            // Medication
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '💊 ยา',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${summary.medication_count || 0} ครั้ง`,
                  size: 'sm',
                  align: 'end',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${completion.medications}%`,
                  size: 'sm',
                  align: 'end',
                  color: completion.medications >= 70 ? '#4CAF50' : '#FF9800',
                  flex: 1
                }
              ],
              margin: 'lg'
            },
            // Water
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '💧 น้ำ',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${summary.total_water_ml || 0} ml`,
                  size: 'sm',
                  align: 'end',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${completion.water}%`,
                  size: 'sm',
                  align: 'end',
                  color: completion.water >= 70 ? '#4CAF50' : '#FF9800',
                  flex: 1
                }
              ],
              margin: 'md'
            },
            // Exercise
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '🚶 ออกกำลังกาย',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${summary.total_exercise_minutes || 0} นาที`,
                  size: 'sm',
                  align: 'end',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${completion.exercise}%`,
                  size: 'sm',
                  align: 'end',
                  color: completion.exercise >= 70 ? '#4CAF50' : '#FF9800',
                  flex: 1
                }
              ],
              margin: 'md'
            },
            // Meals
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '🍚 อาหาร',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${summary.food_count || 0} มื้อ`,
                  size: 'sm',
                  align: 'end',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${completion.meals}%`,
                  size: 'sm',
                  align: 'end',
                  color: completion.meals >= 70 ? '#4CAF50' : '#FF9800',
                  flex: 1
                }
              ],
              margin: 'md'
            },
            // Vitals
            ...(vitals && vitals.systolic ? [
              {
                type: 'separator',
                margin: 'lg'
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: '🩺 ความดัน',
                    size: 'sm',
                    flex: 2
                  },
                  {
                    type: 'text',
                    text: `${vitals.systolic}/${vitals.diastolic}`,
                    size: 'sm',
                    align: 'end',
                    color: (vitals.systolic > 140 || vitals.diastolic > 90) ? '#F44336' : '#4CAF50'
                  }
                ],
                margin: 'lg'
              }
            ] : []),
            // Insights
            {
              type: 'separator',
              margin: 'xl'
            },
            {
              type: 'text',
              text: '💡 ข้อเสนอแนะ',
              weight: 'bold',
              size: 'sm',
              margin: 'xl'
            },
            {
              type: 'text',
              text: insights,
              size: 'xs',
              color: '#666666',
              wrap: true,
              margin: 'sm'
            }
          ]
        }
      }
    };
  }

  private createWeeklyReportFlex(data: any, insights: string): any {
    const { week_start, summary, active_days, target_days } = data;

    return {
      type: 'flex',
      altText: `รายงานสัปดาห์ ${week_start}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📊 รายงานรายสัปดาห์',
              weight: 'bold',
              size: 'xl',
              color: '#4CAF50'
            },
            {
              type: 'text',
              text: `สัปดาห์ที่เริ่ม ${week_start}`,
              size: 'sm',
              color: '#999999'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // Active days
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '📅 วันที่มีกิจกรรม',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: `${active_days}/${target_days} วัน`,
                  size: 'sm',
                  align: 'end',
                  weight: 'bold',
                  color: active_days >= 5 ? '#4CAF50' : '#FF9800'
                }
              ],
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            // Totals
            {
              type: 'text',
              text: '📈 สรุปรวม 7 วัน',
              weight: 'bold',
              size: 'sm',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: `💊 ยา: ${summary.total_medications || 0} ครั้ง`,
                  size: 'xs',
                  color: '#666666'
                },
                {
                  type: 'text',
                  text: `💧 น้ำ: ${summary.total_water_ml || 0} ml`,
                  size: 'xs',
                  color: '#666666',
                  margin: 'sm'
                },
                {
                  type: 'text',
                  text: `🚶 ออกกำลังกาย: ${summary.total_exercise_minutes || 0} นาที`,
                  size: 'xs',
                  color: '#666666',
                  margin: 'sm'
                },
                {
                  type: 'text',
                  text: `🍚 อาหาร: ${summary.total_meals || 0} มื้อ`,
                  size: 'xs',
                  color: '#666666',
                  margin: 'sm'
                }
              ],
              margin: 'sm'
            },
            // Averages
            ...(summary.avg_systolic ? [
              {
                type: 'separator',
                margin: 'lg'
              },
              {
                type: 'text',
                text: '📊 ค่าเฉลี่ย',
                weight: 'bold',
                size: 'sm',
                margin: 'lg'
              },
              {
                type: 'text',
                text: `🩺 ความดันเฉลี่ย: ${Math.round(summary.avg_systolic)}/${Math.round(summary.avg_diastolic)}`,
                size: 'xs',
                color: '#666666',
                margin: 'sm'
              }
            ] : []),
            // Insights
            {
              type: 'separator',
              margin: 'xl'
            },
            {
              type: 'text',
              text: '💡 ข้อเสนอแนะ',
              weight: 'bold',
              size: 'sm',
              margin: 'xl'
            },
            {
              type: 'text',
              text: insights,
              size: 'xs',
              color: '#666666',
              wrap: true,
              margin: 'sm'
            }
          ]
        }
      }
    };
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
  }

  getCapabilities(): string[] {
    return [
      'daily-reports',
      'weekly-reports',
      'health-insights',
      'flex-message-generation'
    ];
  }
}
```

### 4. Update IntentAgent

**File:** `src/agents/specialized/IntentAgent.ts`

```typescript
private patterns = {
  // ... existing patterns
  report: [
    /รายงาน/, /สรุป/, /report/, /summary/,
    /วันนี้/, /เมื่อวาน/, /สัปดาห์/, /เดือน/,
    /today/, /yesterday/, /week/, /month/,
    /daily/, /weekly/, /monthly/
  ]
};
```

### 5. Update index.ts

**File:** `src/index.ts`

```typescript
import reportRoutes from './routes/report.routes';

// Add after health routes
app.use('/api/reports', reportRoutes);

// In handleTextMessage, check for report intent
const intent = result.metadata?.intent;

if (intent === 'report') {
  // ReportAgent already processed, get flex message from result
  const flexMessage = result.data?.flexMessage;
  if (flexMessage) {
    await lineClient.replyMessage(replyToken, flexMessage);
    return;
  }
}
```

---

## 📂 Files to Create/Modify

### New Files:
1. `src/routes/report.routes.ts` - Report API endpoints
2. `database/migrations/004_report_views.sql` - Database views

### Modified Files:
1. `src/agents/specialized/ReportAgent.ts` - Complete implementation
2. `src/agents/specialized/IntentAgent.ts` - Add report patterns
3. `src/index.ts` - Register report routes, handle flex messages

---

## ✅ Testing Checklist

### API Tests
- [ ] GET /api/reports/daily/:patient_id
- [ ] GET /api/reports/daily/:patient_id?date=2024-01-01
- [ ] GET /api/reports/weekly/:patient_id
- [ ] POST /api/reports/generate-insights

### LINE Bot Tests
- [ ] พิมพ์ "รายงานวันนี้" → ได้ Flex Message รายงานวันนี้
- [ ] พิมพ์ "รายงานเมื่อวาน" → ได้รายงานเมื่อวาน
- [ ] พิมพ์ "รายงานสัปดาห์นี้" → ได้รายงาน 7 วัน
- [ ] Rich Menu "ดูรายงาน" → Quick Reply เลือกประเภท
- [ ] Flex Message แสดงผลถูกต้องบน iOS
- [ ] Flex Message แสดงผลถูกต้องบน Android

### Data Accuracy
- [ ] % Completion คำนวณถูกต้อง
- [ ] ความดันแสดงค่าล่าสุด
- [ ] น้ำรวมยอดถูกต้อง
- [ ] Insights มีความหมาย ไม่ generic

---

## 🚀 Deployment

```bash
# Create migration
cat > database/migrations/004_report_views.sql << 'EOF'
-- (SQL code from above)
EOF

# Run migration
psql $SUPABASE_DB_URL -f database/migrations/004_report_views.sql

# Build and test
npm run build
npm test

# Commit
git add .
git commit -m "Add daily/weekly health reports with AI insights"
git push origin master
```

---

## 📊 Success Metrics

- ✅ รายงานสร้างได้ภายใน 3 วินาที
- ✅ Insights มีคุณภาพ (user feedback)
- ✅ User ดูรายงานอย่างน้อย 1 ครั้ง/วัน
- ✅ Flex Message แสดงผลถูกต้อง 100%

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
