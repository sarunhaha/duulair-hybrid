import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase.service';

const router = Router();

/**
 * GET /api/dashboard/summary/:patientId
 * Get dashboard summary for a patient
 */
router.get('/summary/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [
      latestVitalsResult,
      previousVitalsResult,
      latestSleepResult,
      previousSleepResult,
      todayRemindersResult,
      todayMedLogsResult,
      todayWaterResult,
      streakResult,
    ] = await Promise.all([
      // Latest vitals (today or most recent)
      supabaseAdmin
        .from('vitals_logs')
        .select('bp_systolic, bp_diastolic, weight, measured_at')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false })
        .limit(1)
        .single(),

      // Previous vitals (second most recent)
      supabaseAdmin
        .from('vitals_logs')
        .select('bp_systolic, bp_diastolic, weight')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false })
        .range(1, 1)
        .single(),

      // Latest sleep (today or yesterday)
      supabaseAdmin
        .from('sleep_logs')
        .select('sleep_hours, sleep_date')
        .eq('patient_id', patientId)
        .order('sleep_date', { ascending: false })
        .limit(1)
        .single(),

      // Previous sleep
      supabaseAdmin
        .from('sleep_logs')
        .select('sleep_hours')
        .eq('patient_id', patientId)
        .order('sleep_date', { ascending: false })
        .range(1, 1)
        .single(),

      // Today's reminders
      supabaseAdmin
        .from('reminders')
        .select('id, type, title, time')
        .eq('patient_id', patientId)
        .eq('is_active', true),

      // Today's medication logs
      supabaseAdmin
        .from('medication_logs')
        .select('id, medication_name, taken_at, scheduled_time, status')
        .eq('patient_id', patientId)
        .gte('taken_at', today.toISOString())
        .order('taken_at', { ascending: true }),

      // Today's water intake
      supabaseAdmin
        .from('water_logs')
        .select('amount_ml, glasses')
        .eq('patient_id', patientId)
        .eq('log_date', todayStr),

      // Streak calculation - count consecutive days with data
      supabaseAdmin
        .from('daily_patient_summaries')
        .select('summary_date, has_data')
        .eq('patient_id', patientId)
        .eq('has_data', true)
        .order('summary_date', { ascending: false })
        .limit(30),
    ]);

    // Process vitals
    const latestVitals = latestVitalsResult.data;
    const previousVitals = previousVitalsResult.data;

    const bp_systolic = latestVitals?.bp_systolic || null;
    const bp_diastolic = latestVitals?.bp_diastolic || null;
    const weight = latestVitals?.weight || null;

    const bp_change = latestVitals?.bp_systolic && previousVitals?.bp_systolic
      ? latestVitals.bp_systolic - previousVitals.bp_systolic
      : null;
    const weight_change = latestVitals?.weight && previousVitals?.weight
      ? Number((latestVitals.weight - previousVitals.weight).toFixed(1))
      : null;

    // Process sleep
    const latestSleep = latestSleepResult.data;
    const previousSleep = previousSleepResult.data;

    const sleep_hours = latestSleep?.sleep_hours || null;
    const sleep_change = latestSleep?.sleep_hours && previousSleep?.sleep_hours
      ? Number((latestSleep.sleep_hours - previousSleep.sleep_hours).toFixed(1))
      : null;

    // Calculate streak
    let streak = 0;
    if (streakResult.data && streakResult.data.length > 0) {
      const summaries = streakResult.data;
      let expectedDate = new Date();
      expectedDate.setHours(0, 0, 0, 0);

      for (const summary of summaries) {
        const summaryDate = new Date(summary.summary_date);
        summaryDate.setHours(0, 0, 0, 0);

        // Check if this is the expected date or yesterday (allow gap for today not yet recorded)
        const diffDays = Math.floor((expectedDate.getTime() - summaryDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          streak++;
          expectedDate = new Date(summaryDate);
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Build today's tasks
    const tasks: Array<{ id: string; label: string; done: boolean; time?: string; sub?: string }> = [];

    // Add medication reminders
    const reminders = todayRemindersResult.data || [];
    const medLogs = todayMedLogsResult.data || [];

    for (const reminder of reminders) {
      if (reminder.type === 'medication') {
        const isTaken = medLogs.some(log => {
          // Match by scheduled time (approximate)
          const logTime = log.scheduled_time || (log.taken_at ? new Date(log.taken_at).toTimeString().slice(0, 5) : null);
          return logTime && reminder.time && logTime.slice(0, 5) === reminder.time.slice(0, 5);
        });

        tasks.push({
          id: reminder.id,
          label: reminder.title || 'กินยา',
          done: isTaken,
          time: reminder.time?.slice(0, 5),
        });
      }
    }

    // Add water goal task
    const waterLogs = todayWaterResult.data || [];
    const totalWaterMl = waterLogs.reduce((sum, log) => sum + (log.amount_ml || 0), 0);
    const totalGlasses = waterLogs.reduce((sum, log) => sum + (log.glasses || 0), 0);
    const waterGoalGlasses = 8; // Default goal
    const remainingGlasses = Math.max(0, waterGoalGlasses - totalGlasses);

    tasks.push({
      id: 'water-goal',
      label: `ดื่มน้ำ ${waterGoalGlasses} แก้ว`,
      done: remainingGlasses === 0,
      sub: remainingGlasses > 0 ? `เหลือ ${remainingGlasses} แก้ว` : undefined,
    });

    // Calculate completed tasks
    const completedTasks = tasks.filter(t => t.done).length;

    // Generate AI insight (simple rule-based for now)
    let aiInsight = null;
    if (sleep_hours !== null && sleep_hours < 6) {
      aiInsight = {
        title: 'อุ่นใจแนะนำ',
        message: 'เมื่อคืนคุณนอนน้อย ลองพักสายตา 10 นาทีช่วงบ่ายนะคะ',
        icon: 'moon',
      };
    } else if (bp_systolic !== null && bp_systolic > 140) {
      aiInsight = {
        title: 'อุ่นใจเตือน',
        message: 'ความดันสูงกว่าปกติ ลองพักผ่อนและหลีกเลี่ยงอาหารเค็มนะคะ',
        icon: 'sun',
      };
    } else if (remainingGlasses > 4) {
      aiInsight = {
        title: 'อุ่นใจแนะนำ',
        message: 'อย่าลืมดื่มน้ำให้เพียงพอนะคะ จะช่วยให้ร่างกายสดชื่น',
        icon: 'droplets',
      };
    } else {
      aiInsight = {
        title: 'อุ่นใจแนะนำ',
        message: 'วันนี้ดูแลสุขภาพดีมาก รักษาความต่อเนื่องไว้นะคะ',
        icon: 'sun',
      };
    }

    // Build response
    const summary = {
      streak,
      todayTasks: {
        total: tasks.length,
        completed: completedTasks,
        items: tasks,
      },
      latestVitals: {
        bp_systolic,
        bp_diastolic,
        bp_change,
        sleep_hours,
        sleep_change,
        weight,
        weight_change,
      },
      aiInsight,
    };

    return res.json(summary);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;
