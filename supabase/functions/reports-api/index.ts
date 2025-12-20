// supabase/functions/reports-api/index.ts
// API for LIFF Report Dashboard
// Endpoints:
// - GET /summary?patientId=xxx&from=2024-01-01&to=2024-01-31
// - GET /export/csv?patientId=xxx&from=2024-01-01&to=2024-01-31
// - GET /export/pdf?patientId=xxx&from=2024-01-01&to=2024-01-31

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-liff-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID') || ''

// Rate limit config
const RATE_LIMIT_WINDOW_MINUTES = 60
const RATE_LIMIT_MAX_REQUESTS = {
  view: 100,
  export_csv: 10,
  export_pdf: 10
}

// Max date range (90 days = 3 months)
const MAX_DATE_RANGE_DAYS = 90

interface LIFFProfile {
  userId: string
  displayName: string
  pictureUrl?: string
}

interface DailySummary {
  id: string
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

  const url = new URL(req.url)
  const path = url.pathname.replace('/reports-api', '')

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify LIFF token and get user profile
    const liffToken = req.headers.get('x-liff-access-token')
    if (!liffToken) {
      return errorResponse(401, 'Missing LIFF access token')
    }

    const userProfile = await verifyLIFFToken(liffToken)
    if (!userProfile) {
      return errorResponse(401, 'Invalid LIFF token')
    }

    // Handle /patients endpoint first (doesn't require patientId, from, to)
    if (path === '/patients') {
      return await handleGetPatients(supabase, userProfile.userId)
    }

    // Parse query parameters (required for other endpoints)
    const patientId = url.searchParams.get('patientId')
    const dateFrom = url.searchParams.get('from')
    const dateTo = url.searchParams.get('to')

    // Validate required parameters
    if (!patientId || !dateFrom || !dateTo) {
      return errorResponse(400, 'Missing required parameters: patientId, from, to')
    }

    // Validate date range
    const fromDate = new Date(dateFrom)
    const toDate = new Date(dateTo)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return errorResponse(400, 'Invalid date format. Use YYYY-MM-DD')
    }

    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return errorResponse(400, `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`)
    }

    if (daysDiff < 0) {
      return errorResponse(400, 'from date must be before to date')
    }

    // Verify user has access to this patient
    const hasAccess = await verifyPatientAccess(supabase, userProfile.userId, patientId)
    if (!hasAccess) {
      return errorResponse(403, 'You do not have access to this patient data')
    }

    // Determine access type based on path
    let accessType: 'view' | 'export_csv' | 'export_pdf' = 'view'
    if (path.startsWith('/export/csv')) {
      accessType = 'export_csv'
    } else if (path.startsWith('/export/pdf')) {
      accessType = 'export_pdf'
    }

    // Check rate limit
    const isWithinLimit = await checkRateLimit(supabase, userProfile.userId, accessType)
    if (!isWithinLimit) {
      return errorResponse(429, 'Rate limit exceeded. Please try again later.')
    }

    // Log access
    await logAccess(supabase, patientId, userProfile.userId, accessType, dateFrom, dateTo, req)

    // Route to handler
    if (path === '/summary' || path === '' || path === '/') {
      return await handleSummary(supabase, patientId, dateFrom, dateTo)
    } else if (path === '/export/csv') {
      return await handleExportCSV(supabase, patientId, dateFrom, dateTo, userProfile)
    } else if (path === '/export/pdf') {
      return await handleExportPDF(supabase, patientId, dateFrom, dateTo, userProfile)
    } else {
      return errorResponse(404, 'Endpoint not found')
    }

  } catch (error) {
    console.error('[Reports API] Error:', error)
    return errorResponse(500, error instanceof Error ? error.message : 'Internal server error')
  }
})

// ============================================
// LIFF Token Verification
// ============================================

async function verifyLIFFToken(accessToken: string): Promise<LIFFProfile | null> {
  try {
    console.log('[LIFF] Verifying token via profile API, length:', accessToken?.length)

    // Use profile API directly to verify token
    // If token is valid, profile API will return user data
    // If token is invalid, it will return 401
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!profileResponse.ok) {
      const profileError = await profileResponse.text()
      console.error('[LIFF] Profile fetch failed:', profileResponse.status, profileError)
      return null
    }

    const profile = await profileResponse.json()
    console.log('[LIFF] Token valid, user:', profile.userId, profile.displayName)

    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    }
  } catch (error) {
    console.error('[LIFF] Token verification error:', error)
    return null
  }
}

// ============================================
// Access Control
// ============================================

async function verifyPatientAccess(
  supabase: SupabaseClient,
  lineUserId: string,
  patientId: string
): Promise<boolean> {
  // Route 1: Check if user is a member of a group that has this patient
  const { data: access, error } = await supabase
    .from('group_members')
    .select(`
      id,
      group_id,
      groups!inner (
        id,
        group_patients!inner (
          patient_id
        )
      )
    `)
    .eq('line_user_id', lineUserId)
    .eq('is_active', true)

  if (error) {
    console.error('[Access] Group access error:', error)
  }

  // Check if any of user's groups have this patient
  for (const membership of access || []) {
    const groups = membership.groups as any
    if (groups?.group_patients) {
      for (const gp of groups.group_patients) {
        if (gp.patient_id === patientId) {
          console.log(`[Access] User ${lineUserId} has group access to patient ${patientId}`)
          return true
        }
      }
    }
  }

  // Route 2: Check if user is a caregiver linked to this patient
  // Path: line_user_id -> users -> caregiver_profiles -> patient_caregivers
  const { data: caregiverAccess, error: caregiverError } = await supabase
    .from('users')
    .select(`
      caregiver_profiles (
        patient_caregivers (
          patient_id,
          status
        )
      )
    `)
    .eq('line_user_id', lineUserId)
    .eq('role', 'caregiver')
    .single()

  if (caregiverError && caregiverError.code !== 'PGRST116') {
    console.error('[Access] Caregiver access error:', caregiverError)
  }

  if (caregiverAccess?.caregiver_profiles) {
    const caregiverProfile = caregiverAccess.caregiver_profiles as any
    if (caregiverProfile?.patient_caregivers) {
      for (const pc of caregiverProfile.patient_caregivers) {
        if (pc.patient_id === patientId && pc.status === 'active') {
          console.log(`[Access] User ${lineUserId} has caregiver access to patient ${patientId}`)
          return true
        }
      }
    }
  }

  console.log(`[Access] User ${lineUserId} has NO access to patient ${patientId}`)
  return false
}

// ============================================
// Rate Limiting
// ============================================

async function checkRateLimit(
  supabase: SupabaseClient,
  lineUserId: string,
  accessType: 'view' | 'export_csv' | 'export_pdf'
): Promise<boolean> {
  const maxRequests = RATE_LIMIT_MAX_REQUESTS[accessType]

  const { count, error } = await supabase
    .from('report_access_logs')
    .select('*', { count: 'exact', head: true })
    .eq('accessed_by_line_user_id', lineUserId)
    .eq('access_type', accessType)
    .gte('accessed_at', new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString())

  if (error) {
    console.error('[RateLimit] Error:', error)
    return true // Allow on error (fail open)
  }

  return (count || 0) < maxRequests
}

// ============================================
// Access Logging
// ============================================

async function logAccess(
  supabase: SupabaseClient,
  patientId: string,
  lineUserId: string,
  accessType: string,
  dateFrom: string,
  dateTo: string,
  req: Request
): Promise<void> {
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'

  await supabase.from('report_access_logs').insert({
    patient_id: patientId,
    accessed_by_line_user_id: lineUserId,
    access_type: accessType,
    date_from: dateFrom,
    date_to: dateTo,
    ip_address: ipAddress,
    user_agent: userAgent,
  })
}

// ============================================
// Handler: Get Summary
// ============================================

async function handleSummary(
  supabase: SupabaseClient,
  patientId: string,
  dateFrom: string,
  dateTo: string
): Promise<Response> {
  // Get patient info
  const { data: patient, error: patientError } = await supabase
    .from('patient_profiles')
    .select('id, first_name, last_name, nickname, birth_date')
    .eq('id', patientId)
    .single()

  if (patientError || !patient) {
    return errorResponse(404, 'Patient not found')
  }

  // Get daily summaries
  const { data: summaries, error: summariesError } = await supabase
    .from('daily_patient_summaries')
    .select('*')
    .eq('patient_id', patientId)
    .gte('summary_date', dateFrom)
    .lte('summary_date', dateTo)
    .order('summary_date', { ascending: true })

  if (summariesError) {
    console.error('[Summary] Error fetching summaries:', summariesError)
    return errorResponse(500, 'Failed to fetch summaries')
  }

  const dailyData = summaries || []

  // Get activity details from activity_logs
  // Only include actual activities, not queries/intents
  const ACTIVITY_TYPES = [
    'medication', 'water', 'walk', 'blood_pressure', 'exercise',
    'food', 'patient_conditions', 'sleep', 'mood', 'vitals'
  ]

  const { data: activityLogs, error: activityError } = await supabase
    .from('activity_logs')
    .select('task_type, value, metadata, timestamp')
    .eq('patient_id', patientId)
    .in('task_type', ACTIVITY_TYPES)
    .gte('timestamp', `${dateFrom}T00:00:00+07:00`)
    .lte('timestamp', `${dateTo}T23:59:59+07:00`)
    .order('timestamp', { ascending: false })

  if (activityError) {
    console.error('[Summary] Error fetching activities:', activityError)
  }

  // Group activities by date
  const activitiesByDate: Record<string, Array<{type: string, value: string, time: string}>> = {}
  for (const log of activityLogs || []) {
    const date = log.timestamp.split('T')[0]
    if (!activitiesByDate[date]) {
      activitiesByDate[date] = []
    }
    activitiesByDate[date].push({
      type: log.task_type,
      value: log.value || '',
      time: new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    })
  }

  // Calculate aggregate stats
  const daysWithData = dailyData.filter(d => d.has_data).length
  const totalDays = Math.ceil(
    (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1

  // BP averages
  const bpReadings = dailyData.filter(d => d.bp_readings_count > 0)
  const avgSystolic = bpReadings.length > 0
    ? Math.round(bpReadings.reduce((sum, d) => sum + (d.bp_systolic_avg || 0), 0) / bpReadings.length)
    : null
  const avgDiastolic = bpReadings.length > 0
    ? Math.round(bpReadings.reduce((sum, d) => sum + (d.bp_diastolic_avg || 0), 0) / bpReadings.length)
    : null

  // Determine BP trend
  let bpTrend: 'improving' | 'stable' | 'worsening' | 'unknown' = 'unknown'
  if (bpReadings.length >= 7) {
    const firstWeek = bpReadings.slice(0, Math.floor(bpReadings.length / 2))
    const secondWeek = bpReadings.slice(Math.floor(bpReadings.length / 2))

    const firstAvg = firstWeek.reduce((sum, d) => sum + (d.bp_systolic_avg || 0), 0) / firstWeek.length
    const secondAvg = secondWeek.reduce((sum, d) => sum + (d.bp_systolic_avg || 0), 0) / secondWeek.length

    if (secondAvg < firstAvg - 5) bpTrend = 'improving'
    else if (secondAvg > firstAvg + 5) bpTrend = 'worsening'
    else bpTrend = 'stable'
  }

  // Medication compliance
  const totalScheduled = dailyData.reduce((sum, d) => sum + d.medications_scheduled, 0)
  const totalTaken = dailyData.reduce((sum, d) => sum + d.medications_taken, 0)
  const medCompliancePercent = totalScheduled > 0
    ? Math.round((totalTaken / totalScheduled) * 100)
    : null

  // Water intake
  const totalWater = dailyData.reduce((sum, d) => sum + d.water_intake_ml, 0)
  const avgDailyWater = daysWithData > 0 ? Math.round(totalWater / daysWithData) : 0
  const avgWaterGoal = dailyData.length > 0
    ? Math.round(dailyData.reduce((sum, d) => sum + d.water_goal_ml, 0) / dailyData.length)
    : 2000

  // Activities
  const totalActivities = dailyData.reduce((sum, d) => sum + d.activities_count, 0)
  const totalExerciseMinutes = dailyData.reduce((sum, d) => sum + d.exercise_minutes, 0)

  // Calculate age
  const birthDate = new Date(patient.birth_date)
  const age = Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))

  const response = {
    patient: {
      id: patient.id,
      name: patient.nickname || `${patient.first_name} ${patient.last_name}`,
      firstName: patient.first_name,
      lastName: patient.last_name,
      age: age,
    },
    period: {
      from: dateFrom,
      to: dateTo,
      totalDays: totalDays,
      daysWithData: daysWithData,
    },
    summary: {
      bloodPressure: {
        avgSystolic: avgSystolic,
        avgDiastolic: avgDiastolic,
        trend: bpTrend,
        readingsCount: bpReadings.reduce((sum, d) => sum + d.bp_readings_count, 0),
        status: determineBPStatus(avgSystolic, avgDiastolic),
      },
      medications: {
        compliancePercent: medCompliancePercent,
        totalScheduled: totalScheduled,
        totalTaken: totalTaken,
        totalMissed: totalScheduled - totalTaken,
      },
      water: {
        totalMl: totalWater,
        avgDailyMl: avgDailyWater,
        goalMl: avgWaterGoal,
        compliancePercent: avgWaterGoal > 0 ? Math.round((avgDailyWater / avgWaterGoal) * 100) : null,
      },
      activities: {
        totalCount: totalActivities,
        exerciseMinutes: totalExerciseMinutes,
      },
    },
    dailyData: dailyData.map(d => ({
      date: d.summary_date,
      hasData: d.has_data,
      bp: d.bp_readings_count > 0 ? {
        systolic: d.bp_systolic_avg,
        diastolic: d.bp_diastolic_avg,
        status: d.bp_status,
      } : null,
      medications: {
        scheduled: d.medications_scheduled,
        taken: d.medications_taken,
        compliancePercent: d.medication_compliance_percent,
      },
      water: {
        ml: d.water_intake_ml,
        goal: d.water_goal_ml,
        compliancePercent: d.water_compliance_percent,
      },
      activities: d.activities_count,
      exerciseMinutes: d.exercise_minutes,
      activityDetails: activitiesByDate[d.summary_date] || [],
    })),
    // All activities in period (for summary view)
    recentActivities: (activityLogs || []).slice(0, 20).map(log => ({
      type: log.task_type,
      value: log.value || '',
      time: log.timestamp,
      displayTime: new Date(log.timestamp).toLocaleString('th-TH', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      })
    })),
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ============================================
// Handler: Export CSV
// ============================================

async function handleExportCSV(
  supabase: SupabaseClient,
  patientId: string,
  dateFrom: string,
  dateTo: string,
  user: LIFFProfile
): Promise<Response> {
  // Get patient info
  const { data: patient } = await supabase
    .from('patient_profiles')
    .select('first_name, last_name, nickname')
    .eq('id', patientId)
    .single()

  const patientName = patient?.nickname || `${patient?.first_name} ${patient?.last_name}` || 'Unknown'

  // Get daily summaries
  const { data: summaries, error } = await supabase
    .from('daily_patient_summaries')
    .select('*')
    .eq('patient_id', patientId)
    .gte('summary_date', dateFrom)
    .lte('summary_date', dateTo)
    .order('summary_date', { ascending: true })

  if (error) {
    return errorResponse(500, 'Failed to fetch data for export')
  }

  // Generate CSV
  const now = new Date().toISOString()
  const csvLines: string[] = []

  // Header with metadata
  csvLines.push(`# Health Report for ${patientName}`)
  csvLines.push(`# Period: ${dateFrom} to ${dateTo}`)
  csvLines.push(`# Generated: ${now}`)
  csvLines.push(`# Generated by: ${user.displayName} (${user.userId})`)
  csvLines.push(`# WARNING: This data is confidential. Do not share without authorization.`)
  csvLines.push('')

  // Column headers
  csvLines.push([
    'Date',
    'BP Systolic (avg)',
    'BP Diastolic (avg)',
    'BP Status',
    'Heart Rate (avg)',
    'Meds Scheduled',
    'Meds Taken',
    'Med Compliance %',
    'Water (ml)',
    'Water Goal (ml)',
    'Water Compliance %',
    'Activities',
    'Exercise (min)',
    'Has Data',
  ].join(','))

  // Data rows
  for (const summary of summaries || []) {
    csvLines.push([
      summary.summary_date,
      summary.bp_systolic_avg || '',
      summary.bp_diastolic_avg || '',
      summary.bp_status || '',
      summary.heart_rate_avg || '',
      summary.medications_scheduled,
      summary.medications_taken,
      summary.medication_compliance_percent || '',
      summary.water_intake_ml,
      summary.water_goal_ml,
      summary.water_compliance_percent || '',
      summary.activities_count,
      summary.exercise_minutes,
      summary.has_data ? 'Yes' : 'No',
    ].join(','))
  }

  const csvContent = csvLines.join('\n')
  const filename = `health-report-${patientName.replace(/\s+/g, '-')}-${dateFrom}-to-${dateTo}.csv`

  return new Response(csvContent, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ============================================
// Handler: Export PDF (returns data for client-side PDF generation)
// ============================================

async function handleExportPDF(
  supabase: SupabaseClient,
  patientId: string,
  dateFrom: string,
  dateTo: string,
  user: LIFFProfile
): Promise<Response> {
  // For PDF, we return JSON data that the client will use to generate the PDF
  // This is more efficient than generating PDF on the server

  // Get patient info
  const { data: patient } = await supabase
    .from('patient_profiles')
    .select('first_name, last_name, nickname, birth_date')
    .eq('id', patientId)
    .single()

  const patientName = patient?.nickname || `${patient?.first_name} ${patient?.last_name}` || 'Unknown'

  // Get daily summaries
  const { data: summaries, error } = await supabase
    .from('daily_patient_summaries')
    .select('*')
    .eq('patient_id', patientId)
    .gte('summary_date', dateFrom)
    .lte('summary_date', dateTo)
    .order('summary_date', { ascending: true })

  if (error) {
    return errorResponse(500, 'Failed to fetch data for export')
  }

  // Calculate summary stats
  const dailyData = summaries || []
  const daysWithData = dailyData.filter(d => d.has_data).length

  const bpReadings = dailyData.filter(d => d.bp_readings_count > 0)
  const avgSystolic = bpReadings.length > 0
    ? Math.round(bpReadings.reduce((sum, d) => sum + (d.bp_systolic_avg || 0), 0) / bpReadings.length)
    : null
  const avgDiastolic = bpReadings.length > 0
    ? Math.round(bpReadings.reduce((sum, d) => sum + (d.bp_diastolic_avg || 0), 0) / bpReadings.length)
    : null

  const totalScheduled = dailyData.reduce((sum, d) => sum + d.medications_scheduled, 0)
  const totalTaken = dailyData.reduce((sum, d) => sum + d.medications_taken, 0)
  const totalWater = dailyData.reduce((sum, d) => sum + d.water_intake_ml, 0)

  const pdfData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: user.displayName,
      period: { from: dateFrom, to: dateTo },
    },
    patient: {
      name: patientName,
      birthDate: patient?.birth_date,
    },
    summary: {
      totalDays: dailyData.length,
      daysWithData: daysWithData,
      bloodPressure: {
        avgSystolic,
        avgDiastolic,
        status: determineBPStatus(avgSystolic, avgDiastolic),
        minSystolic: bpReadings.length > 0 ? Math.min(...bpReadings.map(d => d.bp_systolic_min || Infinity)) : null,
        maxSystolic: bpReadings.length > 0 ? Math.max(...bpReadings.map(d => d.bp_systolic_max || 0)) : null,
      },
      medications: {
        totalScheduled,
        totalTaken,
        compliancePercent: totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : null,
      },
      water: {
        totalMl: totalWater,
        avgDailyMl: daysWithData > 0 ? Math.round(totalWater / daysWithData) : 0,
      },
    },
    dailyData: dailyData.map(d => ({
      date: d.summary_date,
      bp: d.bp_systolic_avg ? `${d.bp_systolic_avg}/${d.bp_diastolic_avg}` : '-',
      meds: `${d.medications_taken}/${d.medications_scheduled}`,
      water: d.water_intake_ml,
      activities: d.activities_count,
    })),
    disclaimer: 'This report is for informational purposes only and should not be used as a substitute for professional medical advice.',
  }

  return new Response(JSON.stringify(pdfData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ============================================
// Handler: Get Patients
// ============================================

async function handleGetPatients(
  supabase: SupabaseClient,
  lineUserId: string
): Promise<Response> {
  console.log(`[Patients] Getting patients for LINE user: ${lineUserId}`)

  const patients: Array<{
    id: string
    name: string
    groupId: string | null
    groupName: string
    source: 'group' | 'caregiver'
  }> = []

  // Route 1: Get patients via group membership
  console.log('[Patients] Route 1: Checking group_members...')
  const { data: memberships, error: groupError } = await supabase
    .from('group_members')
    .select(`
      group_id,
      groups (
        id,
        group_name,
        group_patients (
          patient_id,
          patient_profiles (
            id,
            first_name,
            last_name,
            nickname
          )
        )
      )
    `)
    .eq('line_user_id', lineUserId)
    .eq('is_active', true)

  if (groupError) {
    console.error('[Patients] Group query error:', groupError)
  } else {
    console.log(`[Patients] Route 1: Found ${memberships?.length || 0} group memberships`)
  }

  for (const membership of memberships || []) {
    const groups = membership.groups as any
    if (groups?.group_patients) {
      for (const gp of groups.group_patients) {
        if (gp.patient_profiles) {
          const p = gp.patient_profiles
          console.log(`[Patients] Route 1: Adding patient ${p.id} from group ${groups.group_name}`)
          patients.push({
            id: p.id,
            name: p.nickname || `${p.first_name} ${p.last_name}`,
            groupId: groups.id,
            groupName: groups.group_name || 'Unknown Group',
            source: 'group',
          })
        }
      }
    }
  }

  // Route 2: Get patients via caregiver link (for LINE OA / single caregiver)
  // Path: line_user_id -> users -> caregiver_profiles -> patient_caregivers -> patient_profiles
  console.log('[Patients] Route 2: Checking users -> caregiver_profiles -> patient_caregivers...')
  const { data: caregiverData, error: caregiverError } = await supabase
    .from('users')
    .select(`
      id,
      role,
      caregiver_profiles (
        id,
        first_name,
        last_name,
        patient_caregivers (
          patient_id,
          status,
          patient_profiles (
            id,
            first_name,
            last_name,
            nickname
          )
        )
      )
    `)
    .eq('line_user_id', lineUserId)
    .single()

  if (caregiverError) {
    if (caregiverError.code === 'PGRST116') {
      console.log('[Patients] Route 2: User not found in users table')
    } else {
      console.error('[Patients] Route 2: Caregiver query error:', caregiverError)
    }
  } else {
    console.log(`[Patients] Route 2: Found user, role=${caregiverData?.role}, has caregiver_profiles=${!!caregiverData?.caregiver_profiles}`)
  }

  if (caregiverData?.caregiver_profiles) {
    const caregiverProfile = caregiverData.caregiver_profiles as any
    console.log(`[Patients] Route 2: Caregiver has ${caregiverProfile?.patient_caregivers?.length || 0} patient links`)

    if (caregiverProfile?.patient_caregivers) {
      for (const pc of caregiverProfile.patient_caregivers) {
        console.log(`[Patients] Route 2: Patient link - patient_id=${pc.patient_id}, status=${pc.status}`)
        // Only include active patient-caregiver relationships
        if (pc.status === 'active' && pc.patient_profiles) {
          const p = pc.patient_profiles
          console.log(`[Patients] Route 2: Adding patient ${p.id} via caregiver link`)
          patients.push({
            id: p.id,
            name: p.nickname || `${p.first_name} ${p.last_name}`,
            groupId: null,
            groupName: 'Direct Care',
            source: 'caregiver',
          })
        }
      }
    }
  }

  console.log(`[Patients] Total patients before dedup: ${patients.length}`)

  // Remove duplicates (same patient from multiple sources)
  const uniquePatients = patients.filter(
    (p, index, self) => index === self.findIndex(t => t.id === p.id)
  )

  console.log(`[Patients] Final unique patients: ${uniquePatients.length}`)
  console.log(`[Patients] Patient list:`, JSON.stringify(uniquePatients.map(p => ({ id: p.id, name: p.name, source: p.source }))))

  return new Response(JSON.stringify({ patients: uniquePatients }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ============================================
// Helper Functions
// ============================================

function determineBPStatus(systolic: number | null, diastolic: number | null): string | null {
  if (systolic === null || diastolic === null) return null

  if (systolic >= 180 || diastolic >= 120) return 'crisis'
  if (systolic >= 140 || diastolic >= 90) return 'high'
  if (systolic >= 130 || diastolic >= 80) return 'elevated'
  return 'normal'
}

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}
