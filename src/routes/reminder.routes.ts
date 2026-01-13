// Reminder CRUD Routes
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

const router = Router();

/**
 * GET /api/reminders/patient/:patientId
 * Get all reminders for a patient
 */
router.get('/patient/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('patient_id', patientId)
      .order('time', { ascending: true });

    if (error) throw error;

    res.json({ success: true, reminders: data || [] });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reminders' });
  }
});

/**
 * POST /api/reminders
 * Create new reminder
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      patient_id,
      type,
      title,
      time,
      days,
      days_of_week,
      frequency,
      note,
      custom_time,
      is_active = true,
    } = req.body;

    if (!patient_id || !type || !title || !time) {
      return res.status(400).json({
        success: false,
        error: 'patient_id, type, title, and time are required',
      });
    }

    const { data, error } = await supabase
      .from('reminders')
      .insert({
        patient_id,
        type,
        title,
        time,
        days: days || [],
        days_of_week: days_of_week || null,
        frequency: frequency || 'daily',
        note,
        custom_time,
        is_active,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, reminder: data });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ success: false, error: 'Failed to create reminder' });
  }
});

/**
 * PUT /api/reminders/:id
 * Update reminder
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      type,
      title,
      time,
      days,
      days_of_week,
      frequency,
      note,
      custom_time,
      is_active,
    } = req.body;

    console.log('[PUT /reminders/:id] Updating reminder:', { id, body: req.body });

    const updateData: Record<string, unknown> = {};

    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (time !== undefined) updateData.time = time;
    if (days !== undefined) updateData.days = days;
    if (days_of_week !== undefined) updateData.days_of_week = days_of_week;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (note !== undefined) updateData.note = note;
    if (custom_time !== undefined) updateData.custom_time = custom_time;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('reminders')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('[PUT /reminders/:id] Supabase error:', error);
      throw error;
    }

    // Check if any row was updated
    if (!data || data.length === 0) {
      console.warn('[PUT /reminders/:id] No reminder found with id:', id);
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }

    console.log('[PUT /reminders/:id] Updated successfully:', data[0]);
    res.json({ success: true, reminder: data[0] });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ success: false, error: 'Failed to update reminder' });
  }
});

/**
 * DELETE /api/reminders/:id
 * Delete reminder
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Reminder deleted' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ success: false, error: 'Failed to delete reminder' });
  }
});

export default router;
