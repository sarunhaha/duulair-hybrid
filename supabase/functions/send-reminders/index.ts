// supabase/functions/send-reminders/index.ts
// Supabase Edge Function for sending reminder notifications
// Triggered by pg_cron every minute
// Supports both reminders and medications

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

// Time period mapping (Thai timezone)
const TIME_PERIOD_MAP: Record<string, { start: string, end: string, label: string }> = {
  morning: { start: '06:00', end: '10:59', label: 'เช้า' },
  afternoon: { start: '11:00', end: '14:59', label: 'กลางวัน' },
  evening: { start: '15:00', end: '18:59', label: 'เย็น' },
  night: { start: '19:00', end: '23:59', label: 'ก่อนนอน' }
}

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

interface Medication {
  id: string
  patient_id: string
  name: string
  dosage_amount: string
  dosage_unit: string
  dosage_form: string
  times: string[]
  frequency: string
  instructions: string
  active: boolean
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

    // Determine current time period for medications
    const currentHour = bangkokTime.getHours()
    const currentMinute = bangkokTime.getMinutes()
    const currentTimePeriod = getCurrentTimePeriod(currentHour)
    const isTimePeriodStart = isStartOfTimePeriod(currentHour, currentMinute)

    console.log(`[Medication] Current period: ${currentTimePeriod}, isStart: ${isTimePeriodStart}`)

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
    const directMessages: { userId: string, reminder: Reminder }[] = []

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

      // Get ALL groups for this patient (not just one)
      const { data: groupPatients } = await supabase
        .from('group_patients')
        .select('group_id, groups(id, line_group_id)')
        .eq('patient_id', reminder.patient_id)
        .eq('is_active', true)

      // Send to ALL groups that have this patient
      if (groupPatients && groupPatients.length > 0) {
        for (const groupPatient of groupPatients) {
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
          directMessages.push({ userId: user.line_user_id, reminder })
        }
      }
    }

    // Send to LINE groups - each reminder separately with Flex Message
    for (const [groupId, messages] of groupMessages) {
      for (const { message, reminder } of messages) {
        try {
          // Use Flex Message instead of text
          const flexMessage = createReminderFlexMessage(reminder)
          await sendFlexMessage(groupId, flexMessage.contents, flexMessage.altText)

          // Log reminder as sent
          await supabase.from('reminder_logs').insert({
            reminder_id: reminder.id,
            patient_id: reminder.patient_id,
            sent_at: new Date().toISOString(),
            status: 'sent',
            channel: 'group'
          })
          results.sent++
          results.details.push({ id: reminder.id, status: 'sent', channel: 'group' })
        } catch (err) {
          console.error(`Error sending reminder ${reminder.id} to group ${groupId}:`, err)
          results.errors++
        }
      }
    }

    // Send direct messages with Flex Message
    if (directMessages.length > 0) {
      for (const { userId, reminder } of directMessages) {
        try {
          // Use Flex Message for direct messages too
          const flexMessage = createReminderFlexMessage(reminder)
          await sendFlexMessage(userId, flexMessage.contents, flexMessage.altText)

          // Log reminder as sent
          await supabase.from('reminder_logs').insert({
            reminder_id: reminder.id,
            patient_id: reminder.patient_id,
            sent_at: new Date().toISOString(),
            status: 'sent',
            channel: 'direct'
          })
          results.sent++
          results.details.push({ id: reminder.id, status: 'sent', channel: 'direct' })
          console.log(`[Reminder] Sent Flex to direct user: ${userId}`)
        } catch (err) {
          console.error(`Error sending direct reminder ${reminder.id} to ${userId}:`, err)
          results.errors++
        }
      }
    }

    console.log(`[Reminder] Results: sent=${results.sent}, skipped=${results.skipped}, errors=${results.errors}`)

    // ============================================
    // MEDICATIONS PROCESSING
    // Only process at the start of each time period
    // ============================================
    const medicationResults = {
      sent: 0,
      skipped: 0,
      errors: 0
    }

    if (currentTimePeriod && isTimePeriodStart) {
      console.log(`[Medication] Processing medications for period: ${currentTimePeriod}`)

      // Get all active medications that include current time period
      const { data: medications, error: medError } = await supabase
        .from('medications')
        .select(`
          *,
          patient_profiles(
            id,
            first_name,
            last_name,
            user_id
          )
        `)
        .eq('active', true)
        .contains('times', [currentTimePeriod])

      if (medError) {
        console.error('Error fetching medications:', medError)
      } else if (medications && medications.length > 0) {
        console.log(`[Medication] Found ${medications.length} medications for ${currentTimePeriod}`)

        for (const medication of medications as Medication[]) {
          // Check frequency (daily/weekly)
          if (medication.frequency === 'weekly') {
            // For weekly, only send on specific day (e.g., Monday)
            if (dayName !== 'monday') {
              medicationResults.skipped++
              continue
            }
          }

          // Check if already sent today for this medication
          const { data: existingLog } = await supabase
            .from('medication_notification_logs')
            .select('id')
            .eq('medication_id', medication.id)
            .eq('time_period', currentTimePeriod)
            .gte('sent_at', `${today}T00:00:00`)
            .lte('sent_at', `${today}T23:59:59`)
            .limit(1)

          if (existingLog && existingLog.length > 0) {
            medicationResults.skipped++
            continue
          }

          const message = formatMedicationMessage(medication, currentTimePeriod)

          // Get ALL groups for this patient
          const { data: groupPatients } = await supabase
            .from('group_patients')
            .select('group_id, groups(id, line_group_id)')
            .eq('patient_id', medication.patient_id)
            .eq('is_active', true)

          const patientName = medication.patient_profiles?.first_name || 'สมาชิก'
          // Use Flex Message for medication reminders
          const flexMessage = createMedicationFlexMessage(medication, currentTimePeriod!)
          let sentToAny = false

          // Send to ALL groups that have this patient with Flex Message
          if (groupPatients && groupPatients.length > 0) {
            for (const groupPatient of groupPatients) {
              if (groupPatient?.groups) {
                const group = groupPatient.groups as unknown as GroupInfo
                if (group.line_group_id) {
                  try {
                    await sendFlexMessage(group.line_group_id, flexMessage.contents, flexMessage.altText)
                    console.log(`[Medication] Sent Flex: ${medication.name} for ${patientName} to group ${group.line_group_id}`)
                    sentToAny = true
                  } catch (err) {
                    console.error(`Error sending medication reminder to group ${group.line_group_id}:`, err)
                    medicationResults.errors++
                  }
                }
              }
            }
          }

          // Also send to patient's direct LINE chat
          if (medication.patient_profiles?.user_id) {
            const { data: user } = await supabase
              .from('users')
              .select('line_user_id')
              .eq('id', medication.patient_profiles.user_id)
              .single()

            if (user?.line_user_id) {
              try {
                await sendFlexMessage(user.line_user_id, flexMessage.contents, flexMessage.altText)
                console.log(`[Medication] Sent Flex to direct user: ${user.line_user_id} for ${patientName}`)
                sentToAny = true
              } catch (err) {
                console.error(`Error sending medication to direct user ${user.line_user_id}:`, err)
                medicationResults.errors++
              }
            }
          }

          // Log medication notification if sent to any channel
          if (sentToAny) {
            await supabase.from('medication_notification_logs').insert({
              medication_id: medication.id,
              patient_id: medication.patient_id,
              time_period: currentTimePeriod,
              sent_at: new Date().toISOString(),
              status: 'sent',
              channel: 'all'
            })

            medicationResults.sent++
          }
        }
      }
    }

    console.log(`[Medication] Results: sent=${medicationResults.sent}, skipped=${medicationResults.skipped}, errors=${medicationResults.errors}`)

    return new Response(JSON.stringify({
      success: true,
      time: currentTime,
      timePeriod: currentTimePeriod,
      results,
      medicationResults
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
  const patientName = patient?.first_name || 'สมาชิก'

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
  message += `👤 สมาชิก: ${patientName}\n`
  message += `🕐 เวลา: ${reminder.time.substring(0, 5)} น.\n`

  if (reminder.title) {
    message += `📝 ${reminder.title}\n`
  }

  if (reminder.description) {
    message += `💬 ${reminder.description}\n`
  }

  message += `\n✅ กดปุ่มด้านล่าง หรือพิมพ์ "${getConfirmCommand(reminder.type)} ${patientName}"`

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

function createQuickReplyItems(type: string, patientName: string): QuickReplyItem[] {
  const typeActions: Record<string, { label: string, text: string }> = {
    medication: { label: '✅ กินยาแล้ว', text: `กินยาแล้ว ${patientName}` },
    vitals: { label: '📊 บันทึกความดัน', text: `ความดัน ${patientName}` },
    water: { label: '💧 ดื่มน้ำแล้ว', text: `ดื่มน้ำแล้ว ${patientName}` },
    exercise: { label: '🏃 ออกกำลังกายแล้ว', text: `ออกกำลังกายแล้ว ${patientName}` },
    meal: { label: '🍽️ กินข้าวแล้ว', text: `กินข้าวแล้ว ${patientName}` }
  }

  const action = typeActions[type] || { label: '✅ บันทึกแล้ว', text: `บันทึกแล้ว ${patientName}` }

  return [{
    type: 'action',
    action: {
      type: 'message',
      label: action.label,
      text: action.text
    }
  }]
}

interface QuickReplyItem {
  type: 'action'
  action: {
    type: 'message'
    label: string
    text: string
  }
}

async function sendLineMessage(to: string, message: string, quickReplyItems?: QuickReplyItem[]): Promise<void> {
  const messageObj: any = {
    type: 'text',
    text: message
  }

  // Add Quick Reply if provided
  if (quickReplyItems && quickReplyItems.length > 0) {
    messageObj.quickReply = {
      items: quickReplyItems
    }
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to,
      messages: [messageObj]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LINE API error: ${response.status} - ${error}`)
  }
}

// Send Flex Message for reminders
async function sendFlexMessage(to: string, flexContent: any, altText: string): Promise<void> {
  const messageObj = {
    type: 'flex',
    altText: altText,
    contents: flexContent
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to,
      messages: [messageObj]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LINE API error: ${response.status} - ${error}`)
  }
}

// ============================================
// MEDICATION HELPER FUNCTIONS
// ============================================

function getCurrentTimePeriod(hour: number): string | null {
  if (hour >= 6 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 14) return 'afternoon'
  if (hour >= 15 && hour <= 18) return 'evening'
  if (hour >= 19 && hour <= 23) return 'night'
  return null
}

function isStartOfTimePeriod(hour: number, minute: number): boolean {
  // Only trigger at the start of each period (first minute)
  // morning: 06:00, afternoon: 11:00, evening: 15:00, night: 19:00
  if (minute !== 0) return false

  return hour === 6 || hour === 11 || hour === 15 || hour === 19
}

function formatMedicationMessage(medication: Medication, timePeriod: string): string {
  const patient = medication.patient_profiles
  const patientName = patient?.first_name || 'สมาชิก'

  const periodLabels: Record<string, string> = {
    morning: 'เช้า',
    afternoon: 'กลางวัน',
    evening: 'เย็น',
    night: 'ก่อนนอน'
  }

  const periodLabel = periodLabels[timePeriod] || timePeriod

  let message = `💊 แจ้งเตือนกินยา (${periodLabel})\n\n`
  message += `👤 สมาชิก: ${patientName}\n`
  message += `💊 ยา: ${medication.name}\n`

  if (medication.dosage_amount && medication.dosage_unit) {
    message += `📏 ขนาด: ${medication.dosage_amount} ${medication.dosage_unit}\n`
  }

  if (medication.instructions) {
    message += `📝 ${medication.instructions}\n`
  }

  message += `\n✅ กดปุ่มด้านล่าง หรือพิมพ์ "กินยาแล้ว ${patientName}"`

  return message
}

// Create Flex Message for medication reminder
function createMedicationFlexMessage(medication: Medication, timePeriod: string): { contents: any, altText: string } {
  const patient = medication.patient_profiles
  const patientName = patient?.first_name || 'สมาชิก'

  const periodLabels: Record<string, string> = {
    morning: 'เช้า',
    afternoon: 'กลางวัน',
    evening: 'เย็น',
    night: 'ก่อนนอน'
  }
  const periodLabel = periodLabels[timePeriod] || timePeriod

  const contents = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '💊', size: 'xl', flex: 0 },
            { type: 'text', text: `แจ้งเตือนกินยา (${periodLabel})`, weight: 'bold', size: 'md', color: '#FFFFFF', margin: 'sm', wrap: true }
          ],
          alignItems: 'center'
        }
      ],
      backgroundColor: '#9333EA',
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '👤', flex: 0 },
            { type: 'text', text: patientName, color: '#555555', margin: 'sm', weight: 'bold' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '💊', flex: 0 },
            { type: 'text', text: medication.name, color: '#555555', margin: 'sm', weight: 'bold' }
          ],
          margin: 'md'
        },
        ...(medication.dosage_amount && medication.dosage_unit ? [{
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '📏', flex: 0 },
            { type: 'text', text: `${medication.dosage_amount} ${medication.dosage_unit}`, color: '#888888', margin: 'sm', size: 'sm' }
          ],
          margin: 'md'
        }] : []),
        ...(medication.instructions ? [{
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '📝', flex: 0 },
            { type: 'text', text: medication.instructions, color: '#888888', margin: 'sm', size: 'sm', wrap: true }
          ],
          margin: 'md'
        }] : [])
      ],
      paddingAll: 'lg'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: '✅ กินยาแล้ว', text: 'กินยาแล้ว' },
          style: 'primary',
          color: '#9333EA',
          height: 'sm'
        },
        {
          type: 'button',
          action: { type: 'message', label: '⏰ ยังไม่ได้กิน', text: 'ยังไม่ได้กินยา' },
          style: 'secondary',
          height: 'sm',
          margin: 'sm'
        }
      ],
      paddingAll: 'lg'
    }
  }

  return {
    contents,
    altText: `💊 แจ้งเตือนกินยา${periodLabel} - ${patientName}: ${medication.name}`
  }
}

// Create Flex Message for general reminder
function createReminderFlexMessage(reminder: Reminder): { contents: any, altText: string } {
  const patient = reminder.patient_profiles
  const patientName = patient?.first_name || 'สมาชิก'

  const typeConfig: Record<string, { emoji: string, name: string, color: string }> = {
    medication: { emoji: '💊', name: 'กินยา', color: '#9333EA' },
    vitals: { emoji: '🩺', name: 'วัดความดัน', color: '#EF4444' },
    water: { emoji: '💧', name: 'ดื่มน้ำ', color: '#3B82F6' },
    exercise: { emoji: '🏃', name: 'ออกกำลังกาย', color: '#22C55E' },
    food: { emoji: '🍽️', name: 'ทานอาหาร', color: '#F97316' }
  }

  const config = typeConfig[reminder.type] || { emoji: '🔔', name: reminder.type, color: '#1E7B9C' }
  const timeDisplay = reminder.time?.substring(0, 5) || '00:00'

  const contents = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: config.emoji, size: 'xl', flex: 0 },
            { type: 'text', text: `แจ้งเตือน${config.name}`, weight: 'bold', size: 'lg', color: '#FFFFFF', margin: 'sm' }
          ],
          alignItems: 'center'
        }
      ],
      backgroundColor: config.color,
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '👤', flex: 0 },
            { type: 'text', text: `สมาชิก: ${patientName}`, color: '#555555', margin: 'sm', weight: 'bold' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '🕐', flex: 0 },
            { type: 'text', text: `เวลา: ${timeDisplay} น.`, color: '#555555', margin: 'sm' }
          ],
          margin: 'md'
        },
        ...(reminder.title ? [{
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '📝', flex: 0 },
            { type: 'text', text: reminder.title, color: '#555555', margin: 'sm', wrap: true }
          ],
          margin: 'md'
        }] : []),
        ...(reminder.description ? [{
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '💬', flex: 0 },
            { type: 'text', text: reminder.description, color: '#888888', margin: 'sm', wrap: true, size: 'sm' }
          ],
          margin: 'md'
        }] : [])
      ],
      paddingAll: 'lg'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: `✅ ${config.name}แล้ว`, text: `${getConfirmCommand(reminder.type)} ${patientName}` },
          style: 'primary',
          color: config.color,
          height: 'sm'
        },
        {
          type: 'button',
          action: { type: 'message', label: '⏰ ยังไม่ได้ทำ', text: `ยัง${config.name} ${patientName}` },
          style: 'secondary',
          height: 'sm',
          margin: 'sm'
        }
      ],
      paddingAll: 'lg'
    }
  }

  return {
    contents,
    altText: `${config.emoji} แจ้งเตือน${config.name} - ${patientName} เวลา ${timeDisplay} น.`
  }
}
