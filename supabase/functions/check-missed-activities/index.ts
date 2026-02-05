// supabase/functions/check-missed-activities/index.ts
// Supabase Edge Function for checking missed activities
// Triggered by pg_cron every hour

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const now = new Date()
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    const today = now.toISOString().split('T')[0]

    console.log(`[MissedActivities] Checking at ${now.toISOString()}`)

    // Get all active patients
    const { data: patients, error } = await supabase
      .from('patient_profiles')
      .select('id, first_name, last_name')

    if (error || !patients) {
      console.error('Error fetching patients:', error)
      return new Response(JSON.stringify({ error: error?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = {
      checked: 0,
      alerts_sent: 0,
      details: [] as any[]
    }

    for (const patient of patients) {
      results.checked++

      // Check last activity
      const { data: lastActivity } = await supabase
        .from('activity_logs')
        .select('timestamp, created_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastActivityTime = lastActivity
        ? new Date(lastActivity.created_at || lastActivity.timestamp)
        : null

      // Skip if recent activity exists
      if (lastActivityTime && lastActivityTime >= fourHoursAgo) {
        results.details.push({
          patient_id: patient.id,
          status: 'ok',
          last_activity: lastActivityTime.toISOString()
        })
        continue
      }

      // Check if we already sent an alert today for this patient
      const { data: existingAlert } = await supabase
        .from('missed_activity_alerts')
        .select('id')
        .eq('patient_id', patient.id)
        .gte('sent_at', `${today}T00:00:00`)
        .limit(1)

      if (existingAlert && existingAlert.length > 0) {
        results.details.push({
          patient_id: patient.id,
          status: 'skipped',
          reason: 'alert_already_sent_today'
        })
        continue
      }

      // Get group for this patient
      const { data: groupPatient } = await supabase
        .from('group_patients')
        .select('group_id, groups(id, line_group_id)')
        .eq('patient_id', patient.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (groupPatient?.groups) {
        const group = groupPatient.groups as any
        if (group.line_group_id) {
          const message = `⚠️ แจ้งเตือน\n\nไม่พบกิจกรรมของคุณ${patient.first_name} มากกว่า 4 ชั่วโมงแล้ว\n\nกรุณาตรวจสอบสถานะสมาชิกค่ะ`

          try {
            await sendLineMessage(group.line_group_id, message)

            // Log the alert
            await supabase.from('missed_activity_alerts').insert({
              patient_id: patient.id,
              group_id: group.id,
              sent_at: new Date().toISOString(),
              last_activity_at: lastActivityTime?.toISOString() || null
            })

            results.alerts_sent++
            results.details.push({
              patient_id: patient.id,
              status: 'alert_sent',
              last_activity: lastActivityTime?.toISOString() || 'never'
            })

            console.log(`[MissedActivities] Alert sent for patient ${patient.first_name}`)
          } catch (err) {
            console.error(`Error sending alert for patient ${patient.id}:`, err)
            results.details.push({
              patient_id: patient.id,
              status: 'error',
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }
      }
    }

    console.log(`[MissedActivities] Results: checked=${results.checked}, alerts_sent=${results.alerts_sent}`)

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function sendLineMessage(to: string, message: string): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to,
      messages: [{
        type: 'text',
        text: message
      }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LINE API error: ${response.status} - ${error}`)
  }
}
