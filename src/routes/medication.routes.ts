// Medication CRUD Routes
import { Router, Request, Response } from 'express';
import { supabaseService } from '../services/supabase.service';

const router = Router();

// Get all medications for a patient
router.get('/patient/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const { data, error } = await supabaseService.supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, medications: data || [] });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch medications' });
  }
});

// Create new medication
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      patient_id,
      name,
      dosage,
      dosage_amount,
      dosage_unit,
      dosage_form,
      frequency,
      times,
      days_of_week,
      instructions,
      note,
      active = true,
      reminder_enabled = true,
    } = req.body;

    if (!patient_id || !name) {
      return res.status(400).json({ success: false, error: 'patient_id and name are required' });
    }

    const { data, error } = await supabaseService.supabase
      .from('medications')
      .insert({
        patient_id,
        name,
        dosage,
        dosage_amount,
        dosage_unit,
        dosage_form,
        frequency,
        times,
        days_of_week,
        instructions,
        note,
        active,
        reminder_enabled,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, medication: data });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ success: false, error: 'Failed to create medication' });
  }
});

// Update medication
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      dosage,
      dosage_amount,
      dosage_unit,
      dosage_form,
      frequency,
      times,
      days_of_week,
      instructions,
      note,
      active,
      reminder_enabled,
    } = req.body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (name !== undefined) updateData.name = name;
    if (dosage !== undefined) updateData.dosage = dosage;
    if (dosage_amount !== undefined) updateData.dosage_amount = dosage_amount;
    if (dosage_unit !== undefined) updateData.dosage_unit = dosage_unit;
    if (dosage_form !== undefined) updateData.dosage_form = dosage_form;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (times !== undefined) updateData.times = times;
    if (days_of_week !== undefined) updateData.days_of_week = days_of_week;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (note !== undefined) updateData.note = note;
    if (active !== undefined) updateData.active = active;
    if (reminder_enabled !== undefined) updateData.reminder_enabled = reminder_enabled;

    const { data, error } = await supabaseService.supabase
      .from('medications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, medication: data });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ success: false, error: 'Failed to update medication' });
  }
});

// Delete medication
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseService.supabase
      .from('medications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({ success: false, error: 'Failed to delete medication' });
  }
});

export default router;
