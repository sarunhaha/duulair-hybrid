import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

const router = Router();

/**
 * POST /api/health/vitals
 * Record vitals (blood pressure, weight, heart rate, etc.)
 */
router.post('/vitals', async (req: Request, res: Response) => {
  const {
    patient_id,
    bp_systolic,
    bp_diastolic,
    heart_rate,
    weight,
    temperature,
    spo2,
    glucose,
    notes,
    measured_at,
  } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('vitals_logs')
      .insert({
        patient_id,
        bp_systolic: bp_systolic || null,
        bp_diastolic: bp_diastolic || null,
        heart_rate: heart_rate || null,
        weight: weight || null,
        temperature: temperature || null,
        spo2: spo2 || null,
        glucose: glucose || null,
        notes: notes || null,
        measured_at: measured_at || new Date().toISOString(),
        source: 'manual',
      })
      .select()
      .single();

    if (error) throw error;

    // Update daily summary
    await updateDailySummary(patient_id);

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record vitals error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record vitals' });
  }
});

/**
 * PUT /api/health/vitals/:id
 * Update vitals record
 */
router.put('/vitals/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    bp_systolic,
    bp_diastolic,
    heart_rate,
    weight,
    temperature,
    spo2,
    glucose,
    notes,
    measured_at,
  } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      bp_systolic: bp_systolic ?? null,
      bp_diastolic: bp_diastolic ?? null,
      heart_rate: heart_rate ?? null,
      weight: weight ?? null,
      temperature: temperature ?? null,
      spo2: spo2 ?? null,
      glucose: glucose ?? null,
      notes: notes ?? null,
    };

    // Allow updating measured_at if provided
    if (measured_at) {
      updateData.measured_at = measured_at;
    }

    const { data, error } = await supabase
      .from('vitals_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update vitals error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update vitals' });
  }
});

/**
 * DELETE /api/health/vitals/:id
 * Delete vitals record
 */
router.delete('/vitals/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('vitals_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete vitals error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete vitals' });
  }
});

/**
 * POST /api/health/water
 * Record water intake
 */
router.post('/water', async (req: Request, res: Response) => {
  const { patient_id, glasses, amount_ml, note } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  const calculatedMl = amount_ml || (glasses ? glasses * 250 : 0);
  const calculatedGlasses = glasses || (amount_ml ? Math.round(amount_ml / 250) : 0);

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('water_logs')
      .insert({
        patient_id,
        log_date: today,
        glasses: calculatedGlasses,
        amount_ml: calculatedMl,
        note: note || null,
        logged_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Get today's total
    const { data: todayLogs } = await supabase
      .from('water_logs')
      .select('glasses, amount_ml')
      .eq('patient_id', patient_id)
      .eq('log_date', today);

    const totalGlasses = todayLogs?.reduce((sum, log) => sum + (log.glasses || 0), 0) || 0;
    const totalMl = todayLogs?.reduce((sum, log) => sum + (log.amount_ml || 0), 0) || 0;

    // Update daily summary
    await updateDailySummary(patient_id);

    return res.json({
      success: true,
      data,
      today: { glasses: totalGlasses, amount_ml: totalMl },
    });
  } catch (error: any) {
    console.error('Record water error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record water intake' });
  }
});

/**
 * POST /api/health/medications
 * Record medication taken
 */
router.post('/medications', async (req: Request, res: Response) => {
  const {
    patient_id,
    medication_id,
    medication_name,
    dosage,
    scheduled_time,
    note,
    skipped,
    skipped_reason,
  } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('medication_logs')
      .insert({
        patient_id,
        medication_id: medication_id || null,
        medication_name: medication_name || null,
        dosage: dosage || null,
        scheduled_time: scheduled_time || null,
        taken_at: new Date().toISOString(),
        status: skipped ? 'skipped' : 'taken',
        note: note || null,
        skipped: skipped || false,
        skipped_reason: skipped_reason || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update daily summary
    await updateDailySummary(patient_id);

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record medication error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record medication' });
  }
});

/**
 * POST /api/health/symptoms
 * Record symptoms
 */
router.post('/symptoms', async (req: Request, res: Response) => {
  const {
    patient_id,
    symptom_name,
    severity_1to5,
    body_location,
    duration_text,
    notes,
    started_at,
  } = req.body;

  if (!patient_id || !symptom_name) {
    return res.status(400).json({ error: 'Patient ID and symptom name are required' });
  }

  try {
    const { data, error } = await supabase
      .from('symptoms')
      .insert({
        patient_id,
        symptom_name,
        severity_1to5: severity_1to5 || null,
        body_location: body_location || null,
        duration_text: duration_text || null,
        notes: notes || null,
        started_at: started_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update daily summary
    await updateDailySummary(patient_id);

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record symptom error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record symptom' });
  }
});

/**
 * POST /api/health/sleep
 * Record sleep data
 */
router.post('/sleep', async (req: Request, res: Response) => {
  const {
    patient_id,
    sleep_hours,
    sleep_quality,
    sleep_quality_score,
    sleep_time,
    wake_time,
    notes,
  } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('sleep_logs')
      .insert({
        patient_id,
        sleep_date: today,
        sleep_hours: sleep_hours || null,
        sleep_quality: sleep_quality || null,
        sleep_quality_score: sleep_quality_score || null,
        sleep_time: sleep_time || null,
        wake_time: wake_time || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update daily summary
    await updateDailySummary(patient_id);

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record sleep error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record sleep' });
  }
});

/**
 * PUT /api/health/sleep/:id
 * Update sleep record
 */
router.put('/sleep/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    sleep_hours,
    sleep_quality,
    sleep_quality_score,
    sleep_time,
    wake_time,
    sleep_date,
    notes,
  } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      sleep_hours: sleep_hours ?? null,
      sleep_quality: sleep_quality ?? null,
      sleep_quality_score: sleep_quality_score ?? null,
      sleep_time: sleep_time ?? null,
      wake_time: wake_time ?? null,
      notes: notes ?? null,
    };

    // Allow updating sleep_date if provided
    if (sleep_date) {
      updateData.sleep_date = sleep_date;
    }

    const { data, error } = await supabase
      .from('sleep_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update sleep error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update sleep' });
  }
});

/**
 * DELETE /api/health/sleep/:id
 * Delete sleep record
 */
router.delete('/sleep/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('sleep_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete sleep error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete sleep' });
  }
});

/**
 * POST /api/health/exercise
 * Record exercise data
 */
router.post('/exercise', async (req: Request, res: Response) => {
  const {
    patient_id,
    exercise_type,
    duration_minutes,
    intensity,
    distance_meters,
    calories_burned,
    notes,
  } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('exercise_logs')
      .insert({
        patient_id,
        exercise_date: today,
        exercise_type: exercise_type || null,
        duration_minutes: duration_minutes || null,
        intensity: intensity || null,
        distance_meters: distance_meters || null,
        calories_burned: calories_burned || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update daily summary
    await updateDailySummary(patient_id);

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record exercise error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record exercise' });
  }
});

/**
 * POST /api/health/mood
 * Record mood data
 */
router.post('/mood', async (req: Request, res: Response) => {
  const {
    patient_id,
    mood,
    mood_score,
    stress_level,
    stress_cause,
    energy_level,
    note,
  } = req.body;

  if (!patient_id || !mood) {
    return res.status(400).json({ error: 'Patient ID and mood are required' });
  }

  try {
    const { data, error } = await supabase
      .from('mood_logs')
      .insert({
        patient_id,
        mood,
        mood_score: mood_score || null,
        stress_level: stress_level || null,
        stress_cause: stress_cause || null,
        energy_level: energy_level || null,
        note: note || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update daily summary
    await updateDailySummary(patient_id);

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record mood error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record mood' });
  }
});

/**
 * POST /api/health/medical-notes
 * Record medical history notes
 */
router.post('/medical-notes', async (req: Request, res: Response) => {
  const {
    patient_id,
    event_date,
    event_type,
    description,
    hospital_name,
    doctor_name,
  } = req.body;

  if (!patient_id || !event_type || !description) {
    return res.status(400).json({ error: 'Patient ID, event type, and description are required' });
  }

  try {
    const { data, error } = await supabase
      .from('medical_history')
      .insert({
        patient_id,
        event_date: event_date || new Date().toISOString().split('T')[0],
        event_type,
        description,
        hospital_name: hospital_name || null,
        doctor_name: doctor_name || null,
      })
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record medical note error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record medical note' });
  }
});

/**
 * GET /api/health/today/:patientId
 * Get all health data for today
 */
router.get('/today/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    // Use Thailand timezone (GMT+7) for date calculations
    const nowInThailand = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    const today = nowInThailand.toISOString().split('T')[0];

    // Start of today in Thailand timezone, converted to UTC for DB query
    const todayStart = new Date(today + 'T00:00:00+07:00');

    console.log('[/health/today] patientId:', patientId, 'today:', today, 'todayStart:', todayStart.toISOString());

    const [vitals, water, medications, symptoms, sleep, exercise, mood, medicalNotes] = await Promise.all([
      supabase
        .from('vitals_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('measured_at', todayStart.toISOString())
        .order('measured_at', { ascending: false }),

      supabase
        .from('water_logs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('log_date', today)
        .order('logged_at', { ascending: false }),

      supabase
        .from('medication_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('taken_at', todayStart.toISOString())
        .order('taken_at', { ascending: false }),

      supabase
        .from('symptoms')
        .select('*')
        .eq('patient_id', patientId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false }),

      supabase
        .from('sleep_logs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('sleep_date', today),

      supabase
        .from('exercise_logs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('exercise_date', today),

      supabase
        .from('mood_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('timestamp', todayStart.toISOString())
        .order('timestamp', { ascending: false }),

      supabase
        .from('medical_history')
        .select('*')
        .eq('patient_id', patientId)
        .eq('event_date', today)
        .order('created_at', { ascending: false }),
    ]);

    return res.json({
      vitals: vitals.data || [],
      water: water.data || [],
      medications: medications.data || [],
      symptoms: symptoms.data || [],
      sleep: sleep.data || [],
      exercise: exercise.data || [],
      mood: mood.data || [],
      medicalNotes: medicalNotes.data || [],
    });
  } catch (error: any) {
    console.error('Get today health error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get health data' });
  }
});

/**
 * GET /api/health/history/:patientId
 * Get all health data history (last 30 days)
 */
router.get('/history/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const { days = '30' } = req.query;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    // Use Thailand timezone (GMT+7) for date calculations
    const nowInThailand = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    const daysAgo = new Date(nowInThailand.getTime());
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

    // Start of the day X days ago in Thailand timezone
    const startDate = daysAgo.toISOString().split('T')[0];
    const startDateTime = new Date(startDate + 'T00:00:00+07:00');

    console.log('[/health/history] patientId:', patientId, 'days:', days, 'startDate:', startDate, 'startDateTime:', startDateTime.toISOString());

    const startDateTimeISO = startDateTime.toISOString();

    const [vitals, water, medications, symptoms, sleep, exercise, mood, medicalNotes] = await Promise.all([
      supabase
        .from('vitals_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('measured_at', startDateTimeISO)
        .order('measured_at', { ascending: false })
        .limit(100),

      supabase
        .from('water_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('log_date', startDate)
        .order('logged_at', { ascending: false })
        .limit(100),

      supabase
        .from('medication_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('taken_at', startDateTimeISO)
        .order('taken_at', { ascending: false })
        .limit(100),

      supabase
        .from('symptoms')
        .select('*')
        .eq('patient_id', patientId)
        .gte('created_at', startDateTimeISO)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('sleep_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('sleep_date', startDate)
        .order('sleep_date', { ascending: false })
        .limit(100),

      supabase
        .from('exercise_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('exercise_date', startDate)
        .order('exercise_date', { ascending: false })
        .limit(100),

      supabase
        .from('mood_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('timestamp', startDateTimeISO)
        .order('timestamp', { ascending: false })
        .limit(100),

      supabase
        .from('medical_history')
        .select('*')
        .eq('patient_id', patientId)
        .gte('event_date', startDate)
        .order('event_date', { ascending: false })
        .limit(100),
    ]);

    console.log('[/health/history] Results - vitals:', vitals.data?.length || 0, 'sleep:', sleep.data?.length || 0);

    return res.json({
      vitals: vitals.data || [],
      water: water.data || [],
      medications: medications.data || [],
      symptoms: symptoms.data || [],
      sleep: sleep.data || [],
      exercise: exercise.data || [],
      mood: mood.data || [],
      medicalNotes: medicalNotes.data || [],
    });
  } catch (error: any) {
    console.error('Get health history error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get health history' });
  }
});

/**
 * Helper: Update daily patient summary
 */
async function updateDailySummary(patientId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get today's data
    const [vitals, water, medications] = await Promise.all([
      supabase
        .from('vitals_logs')
        .select('bp_systolic')
        .eq('patient_id', patientId)
        .gte('measured_at', todayStart.toISOString()),

      supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('patient_id', patientId)
        .eq('log_date', today),

      supabase
        .from('medication_logs')
        .select('status')
        .eq('patient_id', patientId)
        .gte('taken_at', todayStart.toISOString()),
    ]);

    const bpReadings = vitals.data?.filter(v => v.bp_systolic) || [];
    const bpAvg = bpReadings.length > 0
      ? bpReadings.reduce((sum, v) => sum + v.bp_systolic, 0) / bpReadings.length
      : null;

    const waterTotal = water.data?.reduce((sum, w) => sum + (w.amount_ml || 0), 0) || 0;
    const medsTaken = medications.data?.filter(m => m.status === 'taken').length || 0;

    // Upsert daily summary
    await supabase
      .from('daily_patient_summaries')
      .upsert({
        patient_id: patientId,
        summary_date: today,
        bp_readings_count: bpReadings.length,
        bp_systolic_avg: bpAvg,
        water_intake_ml: waterTotal,
        medications_taken: medsTaken,
        has_data: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'patient_id,summary_date',
      });
  } catch (error) {
    console.error('Update daily summary error:', error);
  }
}

export default router;
