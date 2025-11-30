// supabase/functions/send-reminders/index.ts
// Supabase Edge Function for sending reminder notifications
// Triggered by pg_cron every minute

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// LINE Messaging API
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Reminder {
  id: string
  patient_id: string
  type: string
  title: string
  description: string
  time: string
  frequency: string
  days_of_week: string[] | null
  is_active: boolean
  patient_profiles: {
    id: string
    first_name: string
    last_name: string
    user_id: string | null
  }
}

interface GroupInfo {
  id: string
  line_group_id: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get current time in Bangkok timezone
    const now = new Date()
    const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const currentTime = `${bangkokTime.getHours().toString().padStart(2, '0')}:${bangkokTime.getMinutes().toString().padStart(2, '0')}:00`
    const dayName = getDayName(bangkokTime)
    const today = bangkokTime.toISOString().split('T')[0]

    console.log(`[Reminder] Checking at ${currentTime} (${dayName})`)

    // Get all active reminders due at current time
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select(`
        *,
        patient_profiles(
          id,
          first_name,
          last_name,
          user_id
        )
      `)
      .eq('is_active', true)
      .eq('time', currentTime)

    if (error) {
      console.error('Error fetching reminders:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({
        message: 'No reminders due',
        time: currentTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Reminder] Found ${reminders.length} reminders`)

    // Process reminders
    const results = {
      sent: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    }

    // Group reminders by LINE group for multicast
    const groupMessages: Map<string, { message: string, reminder: Reminder }[]> = new Map()
    const directMessages: { userId: string, message: string, reminder: Reminder }[] = []

    for (const reminder of reminders as Reminder[]) {
      // Check frequency
      if (reminder.frequency === 'specific_days' && reminder.days_of_week) {
        if (!reminder.days_of_week.includes(dayName)) {
          results.skipped++
          results.details.push({ id: reminder.id, status: 'skipped', reason: 'not_scheduled_day' })
          continue
        }
      }

      // Check if already sent today
      const { data: existingLog } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('reminder_id', reminder.id)
        .gte('sent_at', `${today}T00:00:00`)
        .lte('sent_at', `${today}T23:59:59`)
        .limit(1)

      if (existingLog && existingLog.length > 0) {
        results.skipped++
        results.details.push({ id: reminder.id, status: 'skipped', reason: 'already_sent' })
        continue
      }

      const message = formatReminderMessage(reminder)

      // Get group for this patient
      const { data: groupPatient } = await supabase
        .from('group_patients')
        .select('group_id, groups(id, line_group_id)')
        .eq('patient_id', reminder.patient_id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (groupPatient?.groups) {
        const group = groupPatient.groups as unknown as GroupInfo
        if (group.line_group_id) {
          // Add to group messages
          if (!groupMessages.has(group.line_group_id)) {
            groupMessages.set(group.line_group_id, [])
          }
          groupMessages.get(group.line_group_id)!.push({ message, reminder })
        }
      }

      // Also get patient's LINE user ID for direct message
      if (reminder.patient_profiles?.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('id', reminder.patient_profiles.user_id)
          .single()

        if (user?.line_user_id) {
          directMessages.push({ userId: user.line_user_id, message, reminder })
        }
      }
    }

    // Send to LINE groups
    for (const [groupId, messages] of groupMessages) {
      try {
        // Combine messages if multiple reminders for same group
        const combinedMessage = messages.length > 1
          ? messages.map(m => m.message).join('\n\n---\n\n')
          : messages[0].message

        await sendLineMessage(groupId, combinedMessage)

        // Log all reminders as sent
        for (const { reminder } of messages) {
          await supabase.from('reminder_logs').insert({
            reminder_id: reminder.id,
            patient_id: reminder.patient_id,
            sent_at: new Date().toISOString(),
            status: 'sent',
            channel: 'group'
          })
          results.sent++
          results.details.push({ id: reminder.id, status: 'sent', channel: 'group' })
        }
      } catch (err) {
        console.error(`Error sending to group ${groupId}:`, err)
        results.errors++
      }
    }

    // Send direct messages (use multicast for efficiency)
    if (directMessages.length > 0) {
      // Group by unique users
      const userMessages = new Map<string, string[]>()
      for (const { userId, message, reminder } of directMessages) {
        if (!userMessages.has(userId)) {
          userMessages.set(userId, [])
        }
        userMessages.get(userId)!.push(message)
      }

      // Send using multicast (up to 500 users per request)
      const userIds = Array.from(userMessages.keys())
      const batchSize = 500

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)

        try {
          // For simplicity, send individual messages
          // In production, consider using multicast with same message
          for (const userId of batch) {
            const messages = userMessages.get(userId)!
            const combinedMessage = messages.join('\n\n---\n\n')
            await sendLineMessage(userId, combinedMessage)
          }
        } catch (err) {
          console.error('Error sending direct messages:', err)
          results.errors++
        }
      }

      // Log direct messages
      for (const { reminder } of directMessages) {
        await supabase.from('reminder_logs').insert({
          reminder_id: reminder.id,
          patient_id: reminder.patient_id,
          sent_at: new Date().toISOString(),
          status: 'sent',
          channel: 'direct'
        })
      }
    }

    console.log(`[Reminder] Results: sent=${results.sent}, skipped=${results.skipped}, errors=${results.errors}`)

    return new Response(JSON.stringify({
      success: true,
      time: currentTime,
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

// Helper functions
function getDayName(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

function formatReminderMessage(reminder: Reminder): string {
  const patient = reminder.patient_profiles
  const patientName = patient?.first_name || 'ผู้ป่วย'

  const typeEmojis: Record<string, string> = {
    medication: '💊',
    vitals: '🩺',
    water: '💧',
    exercise: '🏃',
    meal: '🍽️'
  }

  const typeNames: Record<string, string> = {
    medication: 'กินยา',
    vitals: 'วัดความดัน',
    water: 'ดื่มน้ำ',
    exercise: 'ออกกำลังกาย',
    meal: 'กินอาหาร'
  }

  const emoji = typeEmojis[reminder.type] || '🔔'
  const typeName = typeNames[reminder.type] || reminder.type

  let message = `${emoji} แจ้งเตือน${typeName}\n\n`
  message += `👤 ผู้ป่วย: ${patientName}\n`
  message += `🕐 เวลา: ${reminder.time.substring(0, 5)} น.\n`

  if (reminder.title) {
    message += `📝 ${reminder.title}\n`
  }

  if (reminder.description) {
    message += `💬 ${reminder.description}\n`
  }

  message += `\n✅ พิมพ์ "${getConfirmCommand(reminder.type)}" เพื่อบันทึก`

  return message
}

function getConfirmCommand(type: string): string {
  const commands: Record<string, string> = {
    medication: 'กินยาแล้ว',
    vitals: 'ความดัน [ค่า]',
    water: 'ดื่มน้ำแล้ว',
    exercise: 'ออกกำลังกายแล้ว',
    meal: 'กินข้าวแล้ว'
  }
  return commands[type] || 'บันทึกแล้ว'
}

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
