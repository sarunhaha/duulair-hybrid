// supabase/functions/aggregate-daily-summaries/index.ts
// Supabase Edge Function for aggregating daily patient summaries
// Triggered by pg_cron at 00:30 daily (after midnight)
// Pre-aggregates data for fast LIFF report queries

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface BloodPressureReading {
  systolic: number
  diastolic: number
  heart_rate?: number
}

interface DailySummary {
  patient_id: string
  summary_date: string
  bp_readings_count: number
  bp_systolic_avg: number | null
  bp_systolic_min: number | null
  bp_systolic_max: number | null
  bp_diastolic_avg: number | null
  bp_diastolic_min: number | null
  bp_diastolic_max: number | null
  bp_status: string | null
  heart_rate_avg: number | null
  heart_rate_min: number | null
  heart_rate_max: number | null
  medications_scheduled: number
  medications_taken: number
  medications_missed: number
  medication_compliance_percent: number | null
  water_intake_ml: number
  water_goal_ml: number
  water_compliance_percent: number | null
  activities_count: number
  exercise_minutes: number
  mood_avg: number | null
  has_data: boolean
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse request body for optional date override (useful for backfill)
    let targetDate: string
    try {
      const body = await req.json()
      targetDate = body.date || getYesterdayDate()
    } catch {
      targetDate = getYesterdayDate()
    }

    console.log(`[Aggregate] Starting aggregation for date: ${targetDate}`)

    // Get all active patients
    const { data: patients, error: patientsError } = await supabase
      .from('patient_profiles')
      .select('id')

    if (patientsError) {
      throw new Error(`Failed to fetch patients: ${patientsError.message}`)
    }

    if (!patients || patients.length === 0) {
      console.log('[Aggregate] No patients found')
      return new Response(
        JSON.stringify({ success: true, message: 'No patients to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Aggregate] Processing ${patients.length} patients`)

    let processedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const patient of patients) {
      try {
        const summary = await aggregatePatientData(supabase, patient.id, targetDate)

        // Upsert into daily_patient_summaries
        const { error: upsertError } = await supabase
          .from('daily_patient_summaries')
          .upsert(summary, {
            onConflict: 'patient_id,summary_date',
            ignoreDuplicates: false
          })

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`)
        }

        processedCount++
      } catch (err) {
        errorCount++
        const errorMsg = `Patient ${patient.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(`[Aggregate] Error: ${errorMsg}`)
      }
    }

    console.log(`[Aggregate] Completed: ${processedCount} processed, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        processed: processedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Aggregate] Fatal error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function getYesterdayDate(): string {
  const now = new Date()
  const bangkok = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  bangkok.setDate(bangkok.getDate() - 1)
  return bangkok.toISOString().split('T')[0]
}

async function aggregatePatientData(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  date: string
): Promise<DailySummary> {
  const startOfDay = `${date}T00:00:00+07:00`
  const endOfDay = `${date}T23:59:59+07:00`

  // Fetch all data in parallel for performance
  const [
    bpData,
    waterData,
    waterGoal,
    medicationsData,
    medicationLogsData,
    activitiesData
  ] = await Promise.all([
    // Blood Pressure from activity_logs
    supabase
      .from('activity_logs')
      .select('value, metadata')
      .eq('patient_id', patientId)
      .eq('task_type', 'blood_pressure')
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay),

    // Water intake
    supabase
      .from('water_intake_logs')
      .select('amount_ml')
      .eq('patient_id', patientId)
      .gte('logged_at', startOfDay)
      .lte('logged_at', endOfDay),

    // Water goal
    supabase
      .from('water_intake_goals')
      .select('daily_goal_ml')
      .eq('patient_id', patientId)
      .single(),

    // Medications scheduled for this patient
    supabase
      .from('patient_medications')
      .select('id, times, frequency_type, days_of_week')
      .eq('patient_id', patientId)
      .eq('is_active', true),

    // Medication logs (taken)
    supabase
      .from('activity_logs')
      .select('id, metadata')
      .eq('patient_id', patientId)
      .eq('task_type', 'medication')
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay),

    // All activities
    supabase
      .from('activity_logs')
      .select('task_type, metadata')
      .eq('patient_id', patientId)
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay)
  ])

  // Process Blood Pressure
  const bpReadings: BloodPressureReading[] = []
  if (bpData.data) {
    for (const log of bpData.data) {
      const bp = parseBPReading(log.value, log.metadata)
      if (bp) bpReadings.push(bp)
    }
  }

  const bpStats = calculateBPStats(bpReadings)

  // Process Water Intake
  const totalWater = waterData.data?.reduce((sum, log) => sum + (log.amount_ml || 0), 0) || 0
  const waterGoalMl = waterGoal.data?.daily_goal_ml || 2000

  // Process Medications
  const dayOfWeek = getDayOfWeek(date)
  let medicationsScheduled = 0

  if (medicationsData.data) {
    for (const med of medicationsData.data) {
      // Check if medication is scheduled for this day
      if (isMedicationScheduledForDay(med, dayOfWeek)) {
        // Count times per day
        const timesPerDay = Array.isArray(med.times) ? med.times.length : 1
        medicationsScheduled += timesPerDay
      }
    }
  }

  const medicationsTaken = medicationLogsData.data?.length || 0
  const medicationsMissed = Math.max(0, medicationsScheduled - medicationsTaken)

  // Process Activities
  const activitiesCount = activitiesData.data?.length || 0
  let exerciseMinutes = 0

  if (activitiesData.data) {
    for (const activity of activitiesData.data) {
      if (activity.task_type === 'exercise') {
        const minutes = activity.metadata?.duration_minutes || activity.metadata?.minutes || 30
        exerciseMinutes += minutes
      }
    }
  }

  // Determine if there's any data for this day
  const hasData = bpReadings.length > 0 || totalWater > 0 || medicationsTaken > 0 || activitiesCount > 0

  return {
    patient_id: patientId,
    summary_date: date,
    bp_readings_count: bpReadings.length,
    bp_systolic_avg: bpStats.systolicAvg,
    bp_systolic_min: bpStats.systolicMin,
    bp_systolic_max: bpStats.systolicMax,
    bp_diastolic_avg: bpStats.diastolicAvg,
    bp_diastolic_min: bpStats.diastolicMin,
    bp_diastolic_max: bpStats.diastolicMax,
    bp_status: bpStats.status,
    heart_rate_avg: bpStats.heartRateAvg,
    heart_rate_min: bpStats.heartRateMin,
    heart_rate_max: bpStats.heartRateMax,
    medications_scheduled: medicationsScheduled,
    medications_taken: medicationsTaken,
    medications_missed: medicationsMissed,
    medication_compliance_percent: medicationsScheduled > 0
      ? Math.round((medicationsTaken / medicationsScheduled) * 100 * 100) / 100
      : null,
    water_intake_ml: totalWater,
    water_goal_ml: waterGoalMl,
    water_compliance_percent: waterGoalMl > 0
      ? Math.round((totalWater / waterGoalMl) * 100 * 100) / 100
      : null,
    activities_count: activitiesCount,
    exercise_minutes: exerciseMinutes,
    mood_avg: null, // TODO: implement mood tracking
    has_data: hasData
  }
}

function parseBPReading(value: string | null, metadata: Record<string, unknown> | null): BloodPressureReading | null {
  // Try to parse from metadata first
  if (metadata) {
    if (typeof metadata.systolic === 'number' && typeof metadata.diastolic === 'number') {
      return {
        systolic: metadata.systolic,
        diastolic: metadata.diastolic,
        heart_rate: typeof metadata.heart_rate === 'number' ? metadata.heart_rate : undefined
      }
    }
  }

  // Try to parse from value string (e.g., "120/80" or "120/80 pulse 72")
  if (value) {
    const bpMatch = value.match(/(\d+)\s*\/\s*(\d+)/)
    if (bpMatch) {
      const result: BloodPressureReading = {
        systolic: parseInt(bpMatch[1]),
        diastolic: parseInt(bpMatch[2])
      }

      // Try to extract heart rate
      const hrMatch = value.match(/(?:pulse|hr|heart[_\s]?rate)[:\s]*(\d+)/i)
      if (hrMatch) {
        result.heart_rate = parseInt(hrMatch[1])
      }

      return result
    }
  }

  return null
}

function calculateBPStats(readings: BloodPressureReading[]): {
  systolicAvg: number | null
  systolicMin: number | null
  systolicMax: number | null
  diastolicAvg: number | null
  diastolicMin: number | null
  diastolicMax: number | null
  heartRateAvg: number | null
  heartRateMin: number | null
  heartRateMax: number | null
  status: string | null
} {
  if (readings.length === 0) {
    return {
      systolicAvg: null,
      systolicMin: null,
      systolicMax: null,
      diastolicAvg: null,
      diastolicMin: null,
      diastolicMax: null,
      heartRateAvg: null,
      heartRateMin: null,
      heartRateMax: null,
      status: null
    }
  }

  const systolics = readings.map(r => r.systolic)
  const diastolics = readings.map(r => r.diastolic)
  const heartRates = readings.filter(r => r.heart_rate).map(r => r.heart_rate!)

  const systolicAvg = Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length)
  const diastolicAvg = Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length)

  // Determine BP status based on average
  let status = 'normal'
  if (systolicAvg >= 180 || diastolicAvg >= 120) {
    status = 'crisis'
  } else if (systolicAvg >= 140 || diastolicAvg >= 90) {
    status = 'high'
  } else if (systolicAvg >= 130 || diastolicAvg >= 80) {
    status = 'elevated'
  }

  return {
    systolicAvg,
    systolicMin: Math.min(...systolics),
    systolicMax: Math.max(...systolics),
    diastolicAvg,
    diastolicMin: Math.min(...diastolics),
    diastolicMax: Math.max(...diastolics),
    heartRateAvg: heartRates.length > 0
      ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
      : null,
    heartRateMin: heartRates.length > 0 ? Math.min(...heartRates) : null,
    heartRateMax: heartRates.length > 0 ? Math.max(...heartRates) : null,
    status
  }
}

function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

function isMedicationScheduledForDay(
  medication: { frequency_type: string; days_of_week: unknown },
  dayOfWeek: string
): boolean {
  const frequencyType = medication.frequency_type || 'daily'

  if (frequencyType === 'daily') {
    return true
  }

  if (frequencyType === 'specific_days' && medication.days_of_week) {
    const days = Array.isArray(medication.days_of_week)
      ? medication.days_of_week
      : (typeof medication.days_of_week === 'object' ? Object.keys(medication.days_of_week) : [])

    return days.some(d => d.toLowerCase() === dayOfWeek)
  }

  return true
}
