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
    // IMPORTANT: Send to GROUP **OR** DIRECT, not both!
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

      // Check if already sent for THIS scheduled time today.
      // Uses a ±30min window around the reminder's time so that if the user
      // changes the reminder time (e.g. 21:00→23:10), the old log at 21:00
      // won't block the new 23:10 trigger.
      const [rH, rM] = reminder.time.split(':').map(Number)
      const windowStart = new Date(bangkokTime)
      windowStart.setHours(rH, rM - 30, 0, 0)
      const windowEnd = new Date(bangkokTime)
      windowEnd.setHours(rH, rM + 30, 0, 0)

      // Convert window to UTC ISO for Supabase query
      const offsetMs = bangkokTime.getTime() - now.getTime()
      const windowStartUTC = new Date(windowStart.getTime() - offsetMs).toISOString()
      const windowEndUTC = new Date(windowEnd.getTime() - offsetMs).toISOString()

      const { data: existingLog } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('reminder_id', reminder.id)
        .gte('sent_at', windowStartUTC)
        .lte('sent_at', windowEndUTC)
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

      // Check if patient is in any group
      let hasGroup = false

      // Send to ALL groups that have this patient
      if (groupPatients && groupPatients.length > 0) {
        for (const groupPatient of groupPatients) {
          if (groupPatient?.groups) {
            const group = groupPatient.groups as unknown as GroupInfo
            if (group.line_group_id) {
              hasGroup = true
              // Add to group messages
              if (!groupMessages.has(group.line_group_id)) {
                groupMessages.set(group.line_group_id, [])
              }
              groupMessages.get(group.line_group_id)!.push({ message, reminder })
            }
          }
        }
      }

      // ONLY send direct message if patient is NOT in any group
      // This prevents duplicate messages (group + direct)
      if (!hasGroup && reminder.patient_profiles?.user_id) {
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
    // Use optimistic locking: try to insert log first, then send if successful
    for (const [groupId, messages] of groupMessages) {
      for (const { message, reminder } of messages) {
        try {
          // Try to insert log first (atomic check-and-lock)
          // This prevents race condition - only one insert will succeed
          const { error: lockError } = await supabase.from('reminder_logs').insert({
            reminder_id: reminder.id,
            patient_id: reminder.patient_id,
            sent_at: new Date().toISOString(),
            status: 'pending',  // Mark as pending first
            channel: 'group'
          })

          // If insert failed (duplicate), skip - already being processed
          if (lockError) {
            console.log(`[Reminder] Already processing or sent (skipping): ${reminder.id}`)
            results.skipped++
            results.details.push({ id: reminder.id, status: 'skipped', reason: 'already_processing' })
            continue
          }

          // Now send the message (we have the lock)
          const flexMessage = createReminderFlexMessage(reminder)
          await sendFlexMessage(groupId, flexMessage.contents, flexMessage.altText)

          // Update status to sent
          await supabase.from('reminder_logs')
            .update({ status: 'sent' })
            .eq('reminder_id', reminder.id)
            .eq('status', 'pending')

          results.sent++
          results.details.push({ id: reminder.id, status: 'sent', channel: 'group' })
        } catch (err) {
          console.error(`Error sending reminder ${reminder.id} to group ${groupId}:`, err)
          // Update status to error
          await supabase.from('reminder_logs')
            .update({ status: 'error', error_message: String(err) })
            .eq('reminder_id', reminder.id)
            .eq('status', 'pending')
          results.errors++
        }
      }
    }

    // Send direct messages with Flex Message
    if (directMessages.length > 0) {
      for (const { userId, reminder } of directMessages) {
        try {
          // Try to insert log first (atomic check-and-lock)
          const { error: lockError } = await supabase.from('reminder_logs').insert({
            reminder_id: reminder.id,
            patient_id: reminder.patient_id,
            sent_at: new Date().toISOString(),
            status: 'pending',
            channel: 'direct'
          })

          // If insert failed (duplicate), skip
          if (lockError) {
            console.log(`[Reminder] Already processing or sent (skipping): ${reminder.id}`)
            results.skipped++
            results.details.push({ id: reminder.id, status: 'skipped', reason: 'already_processing' })
            continue
          }

          // Now send the message
          const flexMessage = createReminderFlexMessage(reminder)
          await sendFlexMessage(userId, flexMessage.contents, flexMessage.altText)

          // Update status to sent
          await supabase.from('reminder_logs')
            .update({ status: 'sent' })
            .eq('reminder_id', reminder.id)
            .eq('status', 'pending')

          results.sent++
          results.details.push({ id: reminder.id, status: 'sent', channel: 'direct' })
          console.log(`[Reminder] Sent Flex to direct user: ${userId}`)
        } catch (err) {
          console.error(`Error sending direct reminder ${reminder.id} to ${userId}:`, err)
          await supabase.from('reminder_logs')
            .update({ status: 'error', error_message: String(err) })
            .eq('reminder_id', reminder.id)
            .eq('status', 'pending')
          results.errors++
        }
      }
    }

    console.log(`[Reminder] Results: sent=${results.sent}, skipped=${results.skipped}, errors=${results.errors}`)

    // ============================================
    // MEDICATIONS PROCESSING - DISABLED
    // Disabled to avoid duplicate notifications with reminders
    // Use reminders table for all notifications including medications
    // Re-enable if needed by removing the false && condition
    // ============================================
    const medicationResults = {
      sent: 0,
      skipped: 0,
      errors: 0
    }

    // DISABLED: medications processing - use reminders instead
    if (false && currentTimePeriod && isTimePeriodStart) {
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
          let hasGroup = false

          // Send to ALL groups that have this patient with Flex Message
          if (groupPatients && groupPatients.length > 0) {
            for (const groupPatient of groupPatients) {
              if (groupPatient?.groups) {
                const group = groupPatient.groups as unknown as GroupInfo
                if (group.line_group_id) {
                  hasGroup = true
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

          // ONLY send direct message if patient is NOT in any group
          // This prevents duplicate messages (group + direct)
          if (!hasGroup && medication.patient_profiles?.user_id) {
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
    meal: '🍽️',
    glucose: '🩸'
  }

  const typeNames: Record<string, string> = {
    medication: 'กินยา',
    vitals: 'วัดความดัน',
    water: 'ดื่มน้ำ',
    exercise: 'ออกกำลังกาย',
    meal: 'กินอาหาร',
    glucose: 'วัดน้ำตาล'
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

  message += `\n✅ กดปุ่มด้านล่าง หรือพิมพ์ "${getConfirmCommand(reminder.type)}"`

  return message
}

function getConfirmCommand(type: string): string {
  const commands: Record<string, string> = {
    medication: 'กินยาแล้ว',
    vitals: 'วัดความดันแล้ว',  // Changed - will trigger NLU to ask for value
    water: 'ดื่มน้ำแล้ว',
    exercise: 'ออกกำลังกายแล้ว',
    meal: 'กินข้าวแล้ว',
    glucose: 'วัดน้ำตาลแล้ว'
  }
  return commands[type] || 'บันทึกแล้ว'
}

function createQuickReplyItems(type: string, patientName: string): QuickReplyItem[] {
  const typeActions: Record<string, { label: string, text: string }> = {
    medication: { label: '✅ กินยาแล้ว', text: 'กินยาแล้ว' },
    vitals: { label: '📊 วัดความดันแล้ว', text: 'วัดความดันแล้ว' },
    water: { label: '💧 ดื่มน้ำแล้ว', text: 'ดื่มน้ำแล้ว' },
    exercise: { label: '🏃 ออกกำลังกายแล้ว', text: 'ออกกำลังกายแล้ว' },
    meal: { label: '🍽️ กินข้าวแล้ว', text: 'กินข้าวแล้ว' },
    glucose: { label: '🩸 วัดน้ำตาลแล้ว', text: 'วัดน้ำตาลแล้ว' }
  }

  const action = typeActions[type] || { label: '✅ บันทึกแล้ว', text: 'บันทึกแล้ว' }

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

  message += `\n✅ กดปุ่มด้านล่าง หรือพิมพ์ "กินยาแล้ว"`

  return message
}

// ============================================
// OONJAI DESIGN SYSTEM — Flex Message Theme
// Matches LIFF app: Emerald primary, clean cards, Kanit-style
// ============================================
const OONJAI = {
  primary: '#0FA968',       // Emerald green (LIFF --primary)
  primaryDark: '#0D8F58',
  bg: '#F5F7FA',            // Soft blue-grey (LIFF --background)
  card: '#FFFFFF',
  text: '#3B4C63',          // Dark blue-grey (LIFF --foreground)
  textMuted: '#7B8DA0',     // (LIFF --muted-foreground)
  border: '#E2E8F0',        // (LIFF --border)
  // Type-specific accent colors (matching LIFF REMINDER_TYPES)
  types: {
    medication: { accent: '#A855F7', bg: '#F3E8FF', label: 'กินยา' },
    vitals:     { accent: '#EF4444', bg: '#FEF2F2', label: 'วัดความดัน' },
    water:      { accent: '#3B82F6', bg: '#EFF6FF', label: 'ดื่มน้ำ' },
    exercise:   { accent: '#22C55E', bg: '#F0FDF4', label: 'ออกกำลังกาย' },
    food:       { accent: '#F97316', bg: '#FFF7ED', label: 'ทานอาหาร' },
    glucose:    { accent: '#F59E0B', bg: '#FFFBEB', label: 'วัดน้ำตาล' },
  } as Record<string, { accent: string, bg: string, label: string }>,
}

// Colored circle indicator (replaces emoji icons)
function colorDot(color: string, size = '12px') {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [],
    width: size,
    height: size,
    backgroundColor: color,
    cornerRadius: '50px',
    flex: 0,
  }
}

// Info row: colored dot + label + value
function infoRow(dotColor: string, label: string, value: string, bold = false) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      colorDot(dotColor),
      { type: 'text', text: label, size: 'xs', color: OONJAI.textMuted, flex: 0, margin: 'md' },
      { type: 'text', text: value, size: 'sm', color: OONJAI.text, weight: bold ? 'bold' : 'regular', margin: 'md', wrap: true },
    ],
    alignItems: 'center',
    margin: 'lg',
  }
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
  const typeConf = OONJAI.types.medication

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
            colorDot('#FFFFFF', '10px'),
            { type: 'text', text: 'อุ่นใจ', size: 'xs', color: '#FFFFFF', margin: 'sm', weight: 'bold', flex: 0 },
            { type: 'text', text: `แจ้งเตือนกินยา · ${periodLabel}`, size: 'xs', color: '#FFFFFFB3', margin: 'md' },
          ],
          alignItems: 'center',
        },
        {
          type: 'text',
          text: medication.name,
          weight: 'bold',
          size: 'xl',
          color: '#FFFFFF',
          margin: 'md',
          wrap: true,
        },
      ],
      backgroundColor: typeConf.accent,
      paddingAll: 'xl',
      paddingBottom: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        infoRow(typeConf.accent, 'สมาชิก', patientName, true),
        ...(medication.dosage_amount && medication.dosage_unit ? [
          infoRow(typeConf.accent, 'ขนาด', `${medication.dosage_amount} ${medication.dosage_unit}`),
        ] : []),
        ...(medication.instructions ? [
          infoRow(OONJAI.textMuted, 'คำแนะนำ', medication.instructions),
        ] : []),
      ],
      paddingAll: 'xl',
      backgroundColor: OONJAI.card,
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'กินยาแล้ว ✓', text: 'กินยาแล้ว' },
          style: 'primary',
          color: OONJAI.primary,
          height: 'sm',
          flex: 2,
        },
        {
          type: 'button',
          action: { type: 'message', label: 'ยังไม่ได้กิน', text: 'ยังไม่ได้กินยา' },
          style: 'secondary',
          height: 'sm',
          flex: 1,
          margin: 'sm',
        }
      ],
      paddingAll: 'lg',
      backgroundColor: OONJAI.card,
    },
    styles: {
      footer: { separator: true, separatorColor: OONJAI.border },
    },
  }

  return {
    contents,
    altText: `แจ้งเตือนกินยา${periodLabel} — ${patientName}: ${medication.name}`,
  }
}

// Create Flex Message for general reminder
function createReminderFlexMessage(reminder: Reminder): { contents: any, altText: string } {
  const patient = reminder.patient_profiles
  const patientName = patient?.first_name || 'สมาชิก'

  const typeConf = OONJAI.types[reminder.type] || { accent: OONJAI.primary, bg: '#F0FDF4', label: reminder.type }
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
            colorDot('#FFFFFF', '10px'),
            { type: 'text', text: 'อุ่นใจ', size: 'xs', color: '#FFFFFF', margin: 'sm', weight: 'bold', flex: 0 },
            { type: 'text', text: `แจ้งเตือน${typeConf.label}`, size: 'xs', color: '#FFFFFFB3', margin: 'md' },
          ],
          alignItems: 'center',
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: timeDisplay, size: '3xl', weight: 'bold', color: '#FFFFFF', flex: 0 },
            { type: 'text', text: 'น.', size: 'sm', color: '#FFFFFFB3', margin: 'sm', gravity: 'bottom', offsetBottom: '4px' },
          ],
          margin: 'md',
          alignItems: 'flex-end',
        },
      ],
      backgroundColor: typeConf.accent,
      paddingAll: 'xl',
      paddingBottom: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        infoRow(typeConf.accent, 'สมาชิก', patientName, true),
        ...(reminder.title ? [
          infoRow(typeConf.accent, typeConf.label, reminder.title),
        ] : []),
        ...(reminder.description ? [
          infoRow(OONJAI.textMuted, 'รายละเอียด', reminder.description),
        ] : []),
      ],
      paddingAll: 'xl',
      backgroundColor: OONJAI.card,
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: `${typeConf.label}แล้ว ✓`,
            data: `a=rc&t=${reminder.type}&r=${reminder.id}&p=${reminder.patient_id}&st=${timeDisplay}&tt=${encodeURIComponent(reminder.title || typeConf.label)}`,
            displayText: `${typeConf.label}แล้ว`,
          },
          style: 'primary',
          color: OONJAI.primary,
          height: 'sm',
          flex: 2,
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ยังไม่ได้ทำ',
            data: `a=rs&t=${reminder.type}&r=${reminder.id}&p=${reminder.patient_id}&st=${timeDisplay}&tt=${encodeURIComponent(reminder.title || typeConf.label)}`,
            displayText: `ยัง${typeConf.label}`,
          },
          style: 'secondary',
          height: 'sm',
          flex: 1,
          margin: 'sm',
        }
      ],
      paddingAll: 'lg',
      backgroundColor: OONJAI.card,
    },
    styles: {
      footer: { separator: true, separatorColor: OONJAI.border },
    },
  }

  return {
    contents,
    altText: `แจ้งเตือน${typeConf.label} — ${patientName} เวลา ${timeDisplay} น.`,
  }
}
