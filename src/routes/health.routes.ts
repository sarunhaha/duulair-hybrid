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
    meal_context,
    food_notes,
    notes,
    measured_at,
  } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const insertData: Record<string, unknown> = {
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
      };
    // Only include meal_context/food_notes if provided (columns may not exist yet)
    if (meal_context) insertData.meal_context = meal_context;
    if (food_notes) insertData.food_notes = food_notes;

    const { data, error } = await supabase
      .from('vitals_logs')
      .insert(insertData)
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
    meal_context,
    food_notes,
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
    // Only include meal_context/food_notes if provided (columns may not exist yet)
    if (meal_context !== undefined) updateData.meal_context = meal_context || null;
    if (food_notes !== undefined) updateData.food_notes = food_notes || null;

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
  const { patient_id, glasses, amount_ml, note, logged_at } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  const calculatedMl = amount_ml || (glasses ? glasses * 250 : 0);
  const calculatedGlasses = glasses || (amount_ml ? Math.round(amount_ml / 250) : 0);

  try {
    // Use provided logged_at or default to now
    const loggedAtTimestamp = logged_at ? new Date(logged_at) : new Date();
    const logDate = loggedAtTimestamp.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('water_logs')
      .insert({
        patient_id,
        log_date: logDate,
        glasses: calculatedGlasses,
        amount_ml: calculatedMl,
        note: note || null,
        logged_at: loggedAtTimestamp.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Get total for the logged date
    const { data: todayLogs } = await supabase
      .from('water_logs')
      .select('glasses, amount_ml')
      .eq('patient_id', patient_id)
      .eq('log_date', logDate);

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
 * PUT /api/health/water/:id
 * Update water log record
 */
router.put('/water/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { glasses, amount_ml, note, log_date } = req.body;

  try {
    const calculatedMl = amount_ml || (glasses ? glasses * 250 : null);
    const calculatedGlasses = glasses || (amount_ml ? Math.round(amount_ml / 250) : null);

    const updateData: Record<string, unknown> = {
      glasses: calculatedGlasses,
      amount_ml: calculatedMl,
      note: note ?? null,
    };

    if (log_date) {
      updateData.log_date = log_date;
    }

    const { data, error } = await supabase
      .from('water_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update water log error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update water log' });
  }
});

/**
 * DELETE /api/health/water/:id
 * Delete a water log record
 */
router.delete('/water/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('water_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete water log error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete water log' });
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
    // Convert scheduled_time from "HH:mm" format to full timestamp if provided
    let scheduledTimestamp = null;
    if (scheduled_time) {
      // If it's already an ISO timestamp, use it directly
      if (scheduled_time.includes('T') || scheduled_time.length > 10) {
        scheduledTimestamp = scheduled_time;
      } else {
        // Convert time-only format (e.g., "08:00") to today's timestamp in Bangkok timezone
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        scheduledTimestamp = `${today}T${scheduled_time}:00+07:00`;
      }
    }

    const { data, error } = await supabase
      .from('medication_logs')
      .insert({
        patient_id,
        medication_id: medication_id || null,
        medication_name: medication_name || null,
        dosage: dosage || null,
        scheduled_time: scheduledTimestamp,
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
 * PUT /api/health/symptoms/:id
 * Update symptom record
 */
router.put('/symptoms/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    symptom_name,
    severity_1to5,
    body_location,
    duration_text,
    notes,
  } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      symptom_name: symptom_name ?? null,
      severity_1to5: severity_1to5 ?? null,
      body_location: body_location ?? null,
      duration_text: duration_text ?? null,
      notes: notes ?? null,
    };

    const { data, error } = await supabase
      .from('symptoms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update symptom error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update symptom' });
  }
});

/**
 * DELETE /api/health/symptoms/:id
 * Delete a symptom record
 */
router.delete('/symptoms/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('symptoms')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete symptom error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete symptom' });
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
 * PUT /api/health/exercise/:id
 * Update exercise record
 */
router.put('/exercise/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    exercise_type,
    duration_minutes,
    intensity,
    distance_meters,
    calories_burned,
    exercise_date,
    notes,
  } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      exercise_type: exercise_type ?? null,
      duration_minutes: duration_minutes ?? null,
      intensity: intensity ?? null,
      distance_meters: distance_meters ?? null,
      calories_burned: calories_burned ?? null,
      notes: notes ?? null,
    };

    if (exercise_date) {
      updateData.exercise_date = exercise_date;
    }

    const { data, error } = await supabase
      .from('exercise_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update exercise error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update exercise' });
  }
});

/**
 * DELETE /api/health/exercise/:id
 * Delete an exercise record
 */
router.delete('/exercise/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('exercise_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete exercise error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete exercise' });
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
 * PUT /api/health/mood/:id
 * Update mood record
 */
router.put('/mood/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    mood,
    mood_score,
    stress_level,
    stress_cause,
    energy_level,
    note,
  } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      mood: mood ?? null,
      mood_score: mood_score ?? null,
      stress_level: stress_level ?? null,
      stress_cause: stress_cause ?? null,
      energy_level: energy_level ?? null,
      note: note ?? null,
    };

    const { data, error } = await supabase
      .from('mood_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update mood error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update mood' });
  }
});

/**
 * DELETE /api/health/mood/:id
 * Delete a mood record
 */
router.delete('/mood/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('mood_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete mood error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete mood' });
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
 * PUT /api/health/medical-notes/:id
 * Update medical note record
 */
router.put('/medical-notes/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    event_date,
    event_type,
    description,
    hospital_name,
    doctor_name,
  } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      event_type: event_type ?? null,
      description: description ?? null,
      hospital_name: hospital_name ?? null,
      doctor_name: doctor_name ?? null,
    };

    if (event_date) {
      updateData.event_date = event_date;
    }

    const { data, error } = await supabase
      .from('medical_history')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update medical note error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update medical note' });
  }
});

/**
 * DELETE /api/health/medical-notes/:id
 * Delete a medical note record
 */
router.delete('/medical-notes/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('medical_history')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete medical note error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete medical note' });
  }
});

/**
 * PUT /api/health/medications/:id
 * Update medication log record
 */
router.put('/medications/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    medication_name,
    dosage,
    scheduled_time,
    taken_at,
    note,
    status,
    skipped_reason,
  } = req.body;

  try {
    // Convert scheduled_time from "HH:mm" format to full timestamp if provided
    let scheduledTimestamp = scheduled_time ?? null;
    if (scheduled_time) {
      // If it's already an ISO timestamp, use it directly
      if (scheduled_time.includes('T') || scheduled_time.length > 10) {
        scheduledTimestamp = scheduled_time;
      } else {
        // Convert time-only format (e.g., "08:00") to today's timestamp in Bangkok timezone
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        scheduledTimestamp = `${today}T${scheduled_time}:00+07:00`;
      }
    }

    const updateData: Record<string, unknown> = {
      medication_name: medication_name ?? null,
      dosage: dosage ?? null,
      scheduled_time: scheduledTimestamp,
      note: note ?? null,
      status: status ?? null,
      skipped_reason: skipped_reason ?? null,
    };

    // Only update taken_at if explicitly provided
    if (taken_at !== undefined) {
      updateData.taken_at = taken_at;
    }

    const { data, error } = await supabase
      .from('medication_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update medication log error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update medication log' });
  }
});

/**
 * DELETE /api/health/medications/:id
 * Delete a medication log record
 */
router.delete('/medications/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('medication_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete medication log error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete medication log' });
  }
});

/**
 * POST /api/health/lab-results
 * Record one or multiple lab results (batch insert for a panel)
 */
router.post('/lab-results', async (req: Request, res: Response) => {
  const { patient_id, results } = req.body;

  if (!patient_id || !results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'Patient ID and results array are required' });
  }

  try {
    const rows = results.map((r: any) => ({
      patient_id,
      test_type: r.test_type,
      test_name: r.test_name,
      value: r.value,
      unit: r.unit || null,
      normal_min: r.normal_min ?? null,
      normal_max: r.normal_max ?? null,
      status: r.status || null,
      lab_date: r.lab_date || new Date().toISOString().split('T')[0],
      lab_name: r.lab_name || null,
      notes: r.notes || null,
      source: 'manual',
    }));

    const { data, error } = await supabase
      .from('lab_results')
      .insert(rows)
      .select();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Record lab results error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record lab results' });
  }
});

/**
 * PUT /api/health/lab-results/:id
 * Update single lab result
 */
router.put('/lab-results/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { value, unit, normal_min, normal_max, status, lab_date, lab_name, notes } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      value: value ?? null,
      unit: unit ?? null,
      normal_min: normal_min ?? null,
      normal_max: normal_max ?? null,
      status: status ?? null,
      lab_name: lab_name ?? null,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    };

    if (lab_date) {
      updateData.lab_date = lab_date;
    }

    const { data, error } = await supabase
      .from('lab_results')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update lab result error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update lab result' });
  }
});

/**
 * DELETE /api/health/lab-results/:id
 * Delete single lab result
 */
router.delete('/lab-results/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('lab_results')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete lab result error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete lab result' });
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

    const [vitals, water, medications, symptoms, sleep, exercise, mood, medicalNotes, labResults] = await Promise.all([
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

      supabase
        .from('lab_results')
        .select('*')
        .eq('patient_id', patientId)
        .eq('lab_date', today)
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
      labResults: labResults.data || [],
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

    const [vitals, water, medications, symptoms, sleep, exercise, mood, medicalNotes, labResults] = await Promise.all([
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

      supabase
        .from('lab_results')
        .select('*')
        .eq('patient_id', patientId)
        .gte('lab_date', startDate)
        .order('lab_date', { ascending: false })
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
      labResults: labResults.data || [],
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

/**
 * GET /api/health/doctor-questions/:patientId
 * Get all doctor questions for a patient
 */
router.get('/doctor-questions/:patientId', async (req: Request, res: Response) => {
  const { patientId } = req.params;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('doctor_questions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ success: true, questions: data || [] });
  } catch (error: any) {
    console.error('Get doctor questions error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get doctor questions' });
  }
});

/**
 * POST /api/health/doctor-questions
 * Add a new doctor question
 */
router.post('/doctor-questions', async (req: Request, res: Response) => {
  const { patient_id, question } = req.body;

  if (!patient_id || !question) {
    return res.status(400).json({ error: 'Patient ID and question are required' });
  }

  try {
    const { data, error } = await supabase
      .from('doctor_questions')
      .insert({
        patient_id,
        question,
      })
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Add doctor question error:', error);
    return res.status(500).json({ error: error.message || 'Failed to add doctor question' });
  }
});

/**
 * PUT /api/health/doctor-questions/:id
 * Update a doctor question
 */
router.put('/doctor-questions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { question, answered, answer } = req.body;

  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (question !== undefined) {
      updateData.question = question;
    }

    if (answered !== undefined) {
      updateData.answered = answered;
      if (answered) {
        updateData.answered_at = new Date().toISOString();
      } else {
        updateData.answered_at = null;
        updateData.answer = null;
      }
    }

    if (answer !== undefined) {
      updateData.answer = answer;
    }

    const { data, error } = await supabase
      .from('doctor_questions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update doctor question error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update doctor question' });
  }
});

/**
 * DELETE /api/health/doctor-questions/:id
 * Delete a doctor question
 */
router.delete('/doctor-questions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('doctor_questions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Delete doctor question error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete doctor question' });
  }
});

export default router;
