// Health Category Preferences Routes
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

const router = Router();

// Preference columns (boolean toggles)
const PREF_COLUMNS = [
  'vitals_enabled',
  'glucose_enabled',
  'medications_enabled',
  'sleep_enabled',
  'water_enabled',
  'exercise_enabled',
  'mood_enabled',
  'symptoms_enabled',
  'notes_enabled',
  'lab_results_enabled',
] as const;

// All-true defaults when no row exists
const ALL_ENABLED_DEFAULTS = Object.fromEntries(
  PREF_COLUMNS.map((col) => [col, true])
);

// Map reminder types to preference columns
const REMINDER_TYPE_TO_PREF: Record<string, string> = {
  medication: 'medications_enabled',
  water: 'water_enabled',
  vitals: 'vitals_enabled',
  exercise: 'exercise_enabled',
  glucose: 'glucose_enabled',
};

/**
 * GET /api/preferences/:patientId
 * Fetch preferences or return all-true defaults
 */
router.get('/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const { data, error } = await supabase
      .from('health_category_preferences')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected for new patients)
      throw error;
    }

    res.json({
      success: true,
      preferences: data || { patient_id: patientId, ...ALL_ENABLED_DEFAULTS },
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/preferences/:patientId
 * Upsert preferences + auto-pause/resume reminders for toggled categories
 */
router.put('/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const newPrefs = req.body;

    // Fetch old preferences for diff
    const { data: oldRow } = await supabase
      .from('health_category_preferences')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    const oldPrefs = oldRow || ALL_ENABLED_DEFAULTS;

    // Build upsert payload (only known columns)
    const upsertData: Record<string, unknown> = { patient_id: patientId };
    for (const col of PREF_COLUMNS) {
      if (newPrefs[col] !== undefined) {
        upsertData[col] = newPrefs[col];
      }
    }
    upsertData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('health_category_preferences')
      .upsert(upsertData, { onConflict: 'patient_id' })
      .select()
      .single();

    if (error) throw error;

    // Auto-pause/resume reminders based on toggled categories
    for (const [reminderType, prefColumn] of Object.entries(REMINDER_TYPE_TO_PREF)) {
      const wasEnabled = (oldPrefs as Record<string, unknown>)[prefColumn] !== false;
      const isEnabled = newPrefs[prefColumn] !== false;

      if (wasEnabled && !isEnabled) {
        // Category was disabled → pause matching reminders
        await supabase
          .from('reminders')
          .update({ is_active: false })
          .eq('patient_id', patientId)
          .eq('type', reminderType)
          .eq('is_active', true);
      } else if (!wasEnabled && isEnabled) {
        // Category was re-enabled → resume matching reminders
        await supabase
          .from('reminders')
          .update({ is_active: true })
          .eq('patient_id', patientId)
          .eq('type', reminderType)
          .eq('is_active', false);
      }
    }

    res.json({ success: true, preferences: data });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

export default router;
