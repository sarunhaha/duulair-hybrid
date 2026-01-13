import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

const router = Router();

// Type for dashboard summary
interface DashboardSummary {
  streak: number;
  todayTasks: {
    total: number;
    completed: number;
    items: Array<{ id: string; label: string; done: boolean; time?: string; sub?: string }>;
  };
  latestVitals: {
    bp_systolic: number | null;
    bp_diastolic: number | null;
    bp_change: number | null;
    sleep_hours: number | null;
    sleep_change: number | null;
    weight: number | null;
    weight_change: number | null;
  };
  aiInsight: { title: string; message: string; icon: string } | null;
}

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
      supabase
        .from('vitals_logs')
        .select('bp_systolic, bp_diastolic, weight, measured_at')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false })
        .limit(1)
        .single(),

      // Previous vitals (second most recent)
      supabase
        .from('vitals_logs')
        .select('bp_systolic, bp_diastolic, weight')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false })
        .range(1, 1)
        .single(),

      // Latest sleep (today or yesterday)
      supabase
        .from('sleep_logs')
        .select('sleep_hours, sleep_date')
        .eq('patient_id', patientId)
        .order('sleep_date', { ascending: false })
        .limit(1)
        .single(),

      // Previous sleep
      supabase
        .from('sleep_logs')
        .select('sleep_hours')
        .eq('patient_id', patientId)
        .order('sleep_date', { ascending: false })
        .range(1, 1)
        .single(),

      // Today's reminders
      supabase
        .from('reminders')
        .select('id, type, title, time')
        .eq('patient_id', patientId)
        .eq('is_active', true),

      // Today's medication logs
      supabase
        .from('medication_logs')
        .select('id, medication_name, taken_at, scheduled_time, status')
        .eq('patient_id', patientId)
        .gte('taken_at', today.toISOString())
        .order('taken_at', { ascending: true }),

      // Today's water intake
      supabase
        .from('water_logs')
        .select('amount_ml, glasses')
        .eq('patient_id', patientId)
        .eq('log_date', todayStr),

      // Streak calculation - count consecutive days with data
      supabase
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

/**
 * GET /api/dashboard/group/:groupId
 * Get group dashboard data (for LINE group context)
 */
router.get('/group/:groupId', async (req: Request, res: Response) => {
  const { groupId } = req.params; // This is the LINE group ID

  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }

  try {
    // Step 1: Get group info by LINE group ID
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, line_group_id, group_name, active_patient_id, primary_caregiver_id')
      .eq('line_group_id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Step 2: Get all patients in this group
    const { data: groupPatients, error: patientsError } = await supabase
      .from('group_patients')
      .select(`
        patient_id,
        patient_profiles (
          id,
          first_name,
          last_name,
          nickname,
          chronic_diseases
        )
      `)
      .eq('group_id', group.id)
      .eq('is_active', true)
      .order('added_at', { ascending: true });

    if (patientsError) {
      console.error('Error fetching group patients:', patientsError);
    }

    const patients = (groupPatients || [])
      .map((gp: any) => gp.patient_profiles)
      .filter(Boolean)
      .map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        nickname: p.nickname,
        chronic_diseases: p.chronic_diseases || [],
      }));

    // Step 3: Determine active patient
    let activePatient = null;
    let activePatientId = group.active_patient_id;

    if (!activePatientId && patients.length > 0) {
      activePatientId = patients[0].id;
    }

    if (activePatientId) {
      activePatient = patients.find((p: any) => p.id === activePatientId) || patients[0] || null;
    }

    // Step 4: Get dashboard summary for active patient
    let summary = getEmptyDashboardSummary();

    if (activePatientId) {
      try {
        summary = await getPatientDashboardSummary(activePatientId);
      } catch (err) {
        console.warn('Error getting patient summary:', err);
      }
    }

    // Build response
    const response = {
      group: {
        id: group.line_group_id, // Return LINE group ID for frontend
        group_name: group.group_name,
      },
      activePatient,
      patients,
      summary,
    };

    return res.json(response);
  } catch (error) {
    console.error('Group dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch group dashboard' });
  }
});

// Helper: Get empty dashboard summary
function getEmptyDashboardSummary(): DashboardSummary {
  return {
    streak: 0,
    todayTasks: {
      total: 0,
      completed: 0,
      items: [],
    },
    latestVitals: {
      bp_systolic: null,
      bp_diastolic: null,
      bp_change: null,
      sleep_hours: null,
      sleep_change: null,
      weight: null,
      weight_change: null,
    },
    aiInsight: null,
  };
}

// Helper: Get dashboard summary for a patient (reuse logic from /summary/:patientId)
async function getPatientDashboardSummary(patientId: string): Promise<DashboardSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

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
    supabase
      .from('vitals_logs')
      .select('bp_systolic, bp_diastolic, weight, measured_at')
      .eq('patient_id', patientId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('vitals_logs')
      .select('bp_systolic, bp_diastolic, weight')
      .eq('patient_id', patientId)
      .order('measured_at', { ascending: false })
      .range(1, 1)
      .single(),
    supabase
      .from('sleep_logs')
      .select('sleep_hours, sleep_date')
      .eq('patient_id', patientId)
      .order('sleep_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('sleep_logs')
      .select('sleep_hours')
      .eq('patient_id', patientId)
      .order('sleep_date', { ascending: false })
      .range(1, 1)
      .single(),
    supabase
      .from('reminders')
      .select('id, type, title, time')
      .eq('patient_id', patientId)
      .eq('is_active', true),
    supabase
      .from('medication_logs')
      .select('id, medication_name, taken_at, scheduled_time, status')
      .eq('patient_id', patientId)
      .gte('taken_at', today.toISOString())
      .order('taken_at', { ascending: true }),
    supabase
      .from('water_logs')
      .select('amount_ml, glasses')
      .eq('patient_id', patientId)
      .eq('log_date', todayStr),
    supabase
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

  const reminders = todayRemindersResult.data || [];
  const medLogs = todayMedLogsResult.data || [];

  for (const reminder of reminders) {
    if (reminder.type === 'medication') {
      const isTaken = medLogs.some((log: any) => {
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
  const totalGlasses = waterLogs.reduce((sum: number, log: any) => sum + (log.glasses || 0), 0);
  const waterGoalGlasses = 8;
  const remainingGlasses = Math.max(0, waterGoalGlasses - totalGlasses);

  tasks.push({
    id: 'water-goal',
    label: `ดื่มน้ำ ${waterGoalGlasses} แก้ว`,
    done: remainingGlasses === 0,
    sub: remainingGlasses > 0 ? `เหลือ ${remainingGlasses} แก้ว` : undefined,
  });

  const completedTasks = tasks.filter(t => t.done).length;

  // Generate AI insight
  let aiInsight = null;
  if (sleep_hours !== null && sleep_hours < 6) {
    aiInsight = {
      title: 'อุ่นใจแนะนำ',
      message: 'เมื่อคืนนอนน้อย ลองพักสายตา 10 นาทีช่วงบ่ายนะคะ',
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

  return {
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
}

export default router;
