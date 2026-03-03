// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Client, WebhookEvent, TextMessage, FlexMessage, validateSignature } from '@line/bot-sdk';
import axios from 'axios';
import { OrchestratorAgent } from './agents';
import registrationRoutes from './routes/registration.routes';
import groupRoutes from './routes/group.routes';
import reportRoutes from './routes/report.routes';
import dashboardRoutes from './routes/dashboard.routes';
import healthRoutes from './routes/health.routes';
import medicationRoutes from './routes/medication.routes';
import reminderRoutes from './routes/reminder.routes';
import preferencesRoutes from './routes/preferences.routes';
import trendsRoutes from './routes/trends.routes';
import { groupWebhookService } from './services/group-webhook.service';
import { commandHandlerService } from './services/command-handler.service';
import { userService } from './services/user.service';
import { groupService } from './services/group.service';
import { supabaseService, supabase } from './services/supabase.service';
import { schedulerService } from './services/scheduler.service';
import crypto from 'crypto';
import multer from 'multer';
import { openRouterService, AI_CONFIG } from './services/openrouter.service';
// Note: Health extraction now handled by UnifiedNLUAgent (AI_CONFIG model)
import { deepgramService } from './services/deepgram.service';
import { voiceConfirmationService } from './services/voice-confirmation.service';
import { compressImageForAPI } from './utils/image.utils';

dotenv.config();

// LINE Bot configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const lineClient = new Client(lineConfig);
const LIFF_ID = process.env.LIFF_ID || '';

/**
 * Show LINE loading animation (typing indicator)
 * Displays "..." animation in chat while AI is processing
 * Only works in 1:1 chats, automatically dismissed when bot replies
 */
async function showLoadingAnimation(chatId: string, loadingSeconds: number = 10): Promise<void> {
  try {
    await axios.post('https://api.line.me/v2/bot/chat/loading/start', {
      chatId,
      loadingSeconds
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });
  } catch (e) {
    // Non-critical - don't block message processing if loading animation fails
    console.log('⏳ Loading animation not shown (non-critical)');
  }
}

const app = express();
const orchestrator = new OrchestratorAgent();

// Multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Quick Reply for Health Menu
function createHealthMenuQuickReply() {
  return {
    items: [
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '💊 ยา',
          text: 'บันทึกยา'
        }
      },
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '🩺 ความดัน',
          text: 'วัดความดัน'
        }
      },
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '💧 น้ำ',
          text: 'ดื่มน้ำ'
        }
      },
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '🚶 ออกกำลังกาย',
          text: 'ออกกำลังกาย'
        }
      },
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '🍚 อาหาร',
          text: 'บันทึกอาหาร'
        }
      }
    ]
  };
}

// Quick Reply for Patient Selection
function createPatientSelectionQuickReply(patients: any[], originalMessage: string) {
  const items = patients.map((patient) => {
    // Build label with max 20 chars limit
    let label = patient.nickname || patient.name.split(' ')[0]; // Use nickname or first name
    if (label.length > 15) {
      label = label.substring(0, 15);
    }
    label += ` ${patient.age}ปี`;

    return {
      type: 'action' as const,
      action: {
        type: 'message' as const,
        label: label,
        text: `PATIENT:${patient.id}:${originalMessage}`
      }
    };
  });

  return { items };
}

// Quick Reply for View Report
function createViewReportQuickReply() {
  return {
    items: [
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '📅 รายงานวันนี้',
          text: 'รายงานวันนี้'
        }
      },
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '📊 รายงานสัปดาห์',
          text: 'รายงานสัปดาห์นี้'
        }
      },
      {
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: '📈 รายงานเดือน',
          text: 'รายงานเดือนนี้'
        }
      }
    ]
  };
}

/**
 * Extract patient name from Quick Reply activity messages
 * Patterns: "กินยาแล้ว สมหวัง", "ดื่มน้ำแล้ว สมหวัง", etc.
 * Returns { patientName, activityMessage } or null if no patient name found
 */
function extractPatientNameFromMessage(message: string): { patientName: string, activityMessage: string } | null {
  // Activity patterns that may have patient name at the end
  const activityPatterns = [
    /^(กินยาแล้ว)\s+(.+)$/,
    /^(ดื่มน้ำแล้ว)\s+(.+)$/,
    /^(ออกกำลังกายแล้ว)\s+(.+)$/,
    /^(กินข้าวแล้ว)\s+(.+)$/,
    /^(บันทึกแล้ว)\s+(.+)$/,
    /^(ความดัน)\s+([^\d/]+)$/, // "ความดัน สมหวัง" but not "ความดัน 120/80"
  ];

  for (const pattern of activityPatterns) {
    const match = message.match(pattern);
    if (match) {
      const activityMessage = match[1];
      const patientName = match[2].trim();

      // Skip if patientName looks like a blood pressure value
      if (/^\d+\/\d+$/.test(patientName)) {
        continue;
      }

      return { patientName, activityMessage };
    }
  }

  return null;
}

/**
 * Find patient ID by name in a group's patients
 * Returns patientId if found, null otherwise
 */
async function findPatientByNameInGroup(groupId: string, patientName: string): Promise<string | null> {
  try {
    const { supabase } = await import('./services/supabase.service');

    // Get all patients in this group
    const { data: groupPatients, error } = await supabase
      .from('group_patients')
      .select(`
        patient_id,
        patient_profiles (
          id,
          first_name,
          last_name,
          nickname
        )
      `)
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (error || !groupPatients) {
      console.log('❌ Failed to get group patients:', error);
      return null;
    }

    // Find matching patient by first_name, nickname, or last_name
    const normalizedSearch = patientName.toLowerCase().trim();

    for (const gp of groupPatients) {
      const patient = (gp as any).patient_profiles;
      if (!patient) continue;

      const firstName = (patient.first_name || '').toLowerCase();
      const lastName = (patient.last_name || '').toLowerCase();
      const nickname = (patient.nickname || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();

      if (
        firstName === normalizedSearch ||
        lastName === normalizedSearch ||
        nickname === normalizedSearch ||
        fullName === normalizedSearch
      ) {
        console.log(`✅ Found patient by name "${patientName}":`, patient.id);
        return patient.id;
      }
    }

    console.log(`❌ No patient found with name "${patientName}" in group ${groupId}`);
    return null;
  } catch (error) {
    console.error('❌ Error finding patient by name:', error);
    return null;
  }
}

// ============================================
// OONJAI DESIGN SYSTEM — Shared Theme Constants
// Matches send-reminders & LIFF app theme
// ============================================
const OJ = {
  primary: '#0FA968',
  text: '#3B4C63',
  textMuted: '#7B8DA0',
  card: '#FFFFFF',
  border: '#E2E8F0',
  bg: '#F5F7FA',
  danger: '#EF4444',
};

function ojDot(color: string, size = '10px') {
  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    contents: [] as any[],
    width: size,
    height: size,
    backgroundColor: color,
    cornerRadius: '50px',
    flex: 0,
  };
}

function onjaiHeader(title: string, subtitle?: string) {
  const brandingRow = {
    type: 'box' as const,
    layout: 'horizontal' as const,
    contents: [
      ojDot('#FFFFFF'),
      { type: 'text' as const, text: 'อุ่นใจ', size: 'xs' as const, color: '#FFFFFF', margin: 'sm' as const, weight: 'bold' as const, flex: 0 },
      ...(subtitle ? [{ type: 'text' as const, text: subtitle, size: 'xs' as const, color: '#FFFFFFB3', margin: 'md' as const }] : []),
    ],
    alignItems: 'center' as const,
  };

  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    contents: [
      brandingRow,
      {
        type: 'text' as const,
        text: title,
        weight: 'bold' as const,
        size: 'xl' as const,
        color: '#FFFFFF',
        margin: 'md' as const,
      },
    ],
    backgroundColor: OJ.primary,
    paddingAll: 'xl' as const,
    paddingBottom: 'lg' as const,
  };
}

// Create Flex Message for registration
function createRegistrationFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'ลงทะเบียนใช้งาน OONJAI',
    contents: {
      type: 'bubble',
      header: onjaiHeader('ลงทะเบียนใช้งาน', 'ผู้ช่วยดูแลสุขภาพส่วนตัวของคุณ'),
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่ OONJAI',
            size: 'md',
            color: OJ.text,
            wrap: true
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'text',
                text: 'เลือกบทบาทของคุณ:',
                size: 'sm',
                color: OJ.text,
                weight: 'bold'
              },
              {
                type: 'text',
                text: '• สมาชิก - บันทึกข้อมูลสุขภาพตัวเอง',
                size: 'xs',
                color: OJ.textMuted,
                margin: 'sm',
                wrap: true
              },
              {
                type: 'text',
                text: '• ผู้ดูแล - ติดตามดูแลคนในครอบครัว',
                size: 'xs',
                color: OJ.textMuted,
                margin: 'xs',
                wrap: true
              }
            ]
          }
        ],
        paddingAll: 'xl'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: OJ.primary,
            action: {
              type: 'uri',
              label: 'เริ่มลงทะเบียน',
              uri: `https://liff.line.me/${LIFF_ID}`
            }
          }
        ]
      }
    }
  };
}

// Flex Message for PDPA Consent Gate
function createConsentFlexMessage(lineUserId?: string): FlexMessage {
  const consentUrl = lineUserId
    ? `https://app.oonj.ai/liff/consent.html?uid=${lineUserId}`
    : `https://app.oonj.ai/liff/consent.html`;

  return {
    type: 'flex',
    altText: 'กรุณายอมรับข้อกำหนดก่อนเริ่มใช้งาน',
    contents: {
      type: 'bubble',
      header: onjaiHeader('ก่อนเริ่มใช้ oonjai', 'ข้อกำหนดและความเป็นส่วนตัว'),
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'oonjai เก็บและใช้ข้อมูลสุขภาพของคุณเพื่อบันทึก ติดตาม และแจ้งเตือน',
            size: 'sm',
            color: OJ.text,
            wrap: true
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'กรุณาอ่านและยอมรับข้อกำหนดเพื่อเริ่มใช้งาน',
            size: 'xs',
            color: OJ.textMuted,
            margin: 'lg',
            wrap: true
          }
        ],
        paddingAll: 'xl'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: OJ.primary,
            action: {
              type: 'uri',
              label: 'อ่านและยอมรับ',
              uri: consentUrl
            }
          }
        ]
      }
    }
  };
}

// Flex Message for Package Info
function createPackageFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'แพ็กเกจบริการ OONJAI',
    contents: {
      type: 'bubble',
      header: onjaiHeader('แพ็กเกจบริการ'),
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'Free Plan (ฟรี)',
            weight: 'bold',
            size: 'lg',
            color: OJ.primary
          },
          {
            type: 'text',
            text: '• บันทึกข้อมูลสุขภาพ\n• รายงานประจำวัน\n• เชื่อมต่อผู้ดูแล 1 คน',
            wrap: true,
            size: 'sm',
            color: OJ.textMuted,
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'Premium Plan (เร็วๆ นี้)',
            weight: 'bold',
            size: 'lg',
            color: '#FF9800',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '• ทุกอย่างใน Free\n• แจ้งเตือนอัจฉริยะ\n• วิเคราะห์ข้อมูลขั้นสูง\n• เชื่อมต่อผู้ดูแลไม่จำกัด',
            wrap: true,
            size: 'sm',
            color: OJ.textMuted,
            margin: 'md'
          }
        ],
        paddingAll: 'xl'
      }
    }
  };
}

// Flex Message for Help/FAQ
function createHelpFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'ช่วยเหลือ - วิธีใช้งาน',
    contents: {
      type: 'bubble',
      header: onjaiHeader('วิธีใช้งาน', 'คู่มือการใช้งาน OONJAI'),
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'การเริ่มต้น',
            weight: 'bold',
            size: 'md',
            color: OJ.text
          },
          {
            type: 'text',
            text: '1. ลงทะเบียน (สมาชิก/ผู้ดูแล)\n2. กรอกข้อมูลสุขภาพ\n3. เริ่มบันทึกข้อมูล',
            wrap: true,
            size: 'sm',
            color: OJ.textMuted,
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'การบันทึกข้อมูล',
            weight: 'bold',
            size: 'md',
            color: OJ.text,
            margin: 'lg'
          },
          {
            type: 'text',
            text: '• พิมพ์ "กินยาแล้ว"\n• พิมพ์ "วัดความดัน 120/80"\n• พิมพ์ "ดื่มน้ำ 500 ml"\n• พิมพ์ "เดินแล้ว 30 นาที"',
            wrap: true,
            size: 'sm',
            color: OJ.textMuted,
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'กรณีฉุกเฉิน',
            weight: 'bold',
            size: 'md',
            color: OJ.text,
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'พิมพ์ "ฉุกเฉิน" ระบบจะแจ้งผู้ดูแลทันที',
            wrap: true,
            size: 'sm',
            color: OJ.danger,
            margin: 'sm'
          }
        ],
        paddingAll: 'xl'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'เริ่มลงทะเบียน',
              text: 'ลงทะเบียน'
            },
            style: 'primary',
            color: OJ.primary
          }
        ]
      }
    }
  };
}

// Flex Message for Report Menu
function createReportMenuFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: '📊 ดูรายงานการดูแล',
    contents: {
      type: 'bubble',
      header: onjaiHeader('รายงานการดูแล', 'สรุปกิจกรรมด้านสุขภาพ'),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'เลือกช่วงเวลาที่ต้องการดูรายงาน',
            wrap: true,
            size: 'sm',
            color: OJ.textMuted
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: 'รายงานจะประกอบด้วย:',
                size: 'sm',
                weight: 'bold',
                color: OJ.text
              },
              {
                type: 'text',
                text: '• การรับประทานยา',
                size: 'sm',
                color: OJ.textMuted,
                margin: 'sm'
              },
              {
                type: 'text',
                text: '• การตรวจวัดสัญญาณชีพ',
                size: 'sm',
                color: OJ.textMuted
              },
              {
                type: 'text',
                text: '• การดื่มน้ำ',
                size: 'sm',
                color: OJ.textMuted
              },
              {
                type: 'text',
                text: '• การออกกำลังกาย',
                size: 'sm',
                color: OJ.textMuted
              },
              {
                type: 'text',
                text: '• การรับประทานอาหาร',
                size: 'sm',
                color: OJ.textMuted
              }
            ]
          }
        ],
        paddingAll: 'lg'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'รายงานวันนี้',
              text: 'รายงานวันนี้'
            },
            style: 'primary',
            color: OJ.primary,
            height: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'รายงานสัปดาห์นี้',
              text: 'รายงานสัปดาห์'
            },
            style: 'primary',
            color: OJ.primary,
            height: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'รายงานเดือนนี้',
              text: 'รายงานเดือน'
            },
            style: 'secondary',
            height: 'sm'
          }
        ],
        paddingAll: 'lg'
      }
    }
  };
}

// Flex Message for Medication Response (ตอบกลับเมื่อบันทึกยา)
function createMedicationResponseFlexMessage(
  responseText: string,
  medicationName?: string,
  taken: boolean = true,
  patientName?: string
): FlexMessage {
  const status = taken ? 'taken' : 'not_taken';
  const config = {
    taken: {
      emoji: '✅',
      title: 'บันทึกเรียบร้อย',
      color: '#22C55E', // Green
      bgColor: '#DCFCE7',
      statusText: 'กินยาแล้ว'
    },
    not_taken: {
      emoji: '⏰',
      title: 'รับทราบ',
      color: '#F59E0B', // Amber
      bgColor: '#FEF3C7',
      statusText: 'ยังไม่ได้กินยา'
    }
  };
  const c = config[status];

  // Build optional content boxes
  const optionalContents: any[] = [];

  if (medicationName) {
    optionalContents.push({
      type: 'box' as const,
      layout: 'horizontal' as const,
      contents: [
        { type: 'text' as const, text: '💊', flex: 0 },
        { type: 'text' as const, text: medicationName, color: OJ.text, margin: 'sm' as const, wrap: true }
      ]
    });
  }

  if (patientName) {
    optionalContents.push({
      type: 'box' as const,
      layout: 'horizontal' as const,
      contents: [
        { type: 'text' as const, text: '👤', flex: 0 },
        { type: 'text' as const, text: patientName, color: OJ.text, margin: 'sm' as const }
      ]
    });
  }

  // Build footer buttons
  const footerButtons: any[] = taken
    ? []
    : [{
        type: 'button' as const,
        action: { type: 'message' as const, label: '✅ กินยาแล้ว', text: 'กินยาแล้ว' },
        style: 'primary' as const,
        color: OJ.primary,
        height: 'sm' as const
      }];

  footerButtons.push({
    type: 'button' as const,
    action: { type: 'message' as const, label: '📋 ดูรายการยา', text: 'ดูรายการยา' },
    style: 'secondary' as const,
    height: 'sm' as const
  });

  return {
    type: 'flex',
    altText: `💊 ${c.statusText}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: c.color,
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              ojDot('#FFFFFF'),
              { type: 'text', text: 'อุ่นใจ', size: 'xs', color: '#FFFFFF', margin: 'sm', weight: 'bold', flex: 0 },
              { type: 'text', text: c.statusText, size: 'xs', color: '#FFFFFFB3', margin: 'md' },
            ],
            alignItems: 'center',
          },
          {
            type: 'text',
            text: c.title,
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
            margin: 'md'
          }
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: [
          // Status badge
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: c.bgColor,
            cornerRadius: 'lg',
            paddingAll: 'md',
            contents: [
              { type: 'text', text: c.emoji, flex: 0 },
              { type: 'text', text: c.statusText, weight: 'bold', color: c.color, margin: 'sm' }
            ],
            justifyContent: 'center'
          },
          // Optional: Medication name & Patient name
          ...optionalContents,
          // Time
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              ojDot(OJ.textMuted, '8px'),
              { type: 'text', text: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.', color: OJ.textMuted, margin: 'sm', size: 'sm' }
            ],
            alignItems: 'center'
          },
          // Response text from AI
          { type: 'text', text: responseText, wrap: true, color: OJ.text, margin: 'lg', size: 'sm' }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: footerButtons
      }
    }
  };
}

// Flex Message for Health Logging Menu (บันทึกสุขภาพ)
function createHealthLogMenuFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: '🩺 บันทึกสุขภาพวันนี้',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: onjaiHeader('บันทึกสุขภาพวันนี้', 'เลือกสิ่งที่ต้องการบันทึก'),
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: [
          // Row 1: Medication & Vitals
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FEF3C7',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'กินยา',
                  text: 'กินยาแล้ว'
                },
                contents: [
                  {
                    type: 'text',
                    text: '💊',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'กินยา',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#DBEAFE',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'ความดัน',
                  text: 'บันทึกความดัน'
                },
                contents: [
                  {
                    type: 'text',
                    text: '💉',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'ความดัน',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              }
            ]
          },
          // Row 2: Water & Exercise
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#D1FAE5',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'ดื่มน้ำ',
                  text: 'ดื่มน้ำ 1 แก้ว'
                },
                contents: [
                  {
                    type: 'text',
                    text: '💧',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'ดื่มน้ำ',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FCE7F3',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'ออกกำลังกาย',
                  text: 'ออกกำลังกายแล้ว'
                },
                contents: [
                  {
                    type: 'text',
                    text: '🏃',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'ออกกำลังกาย',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              }
            ]
          },
          // Row 3: Sleep & Symptom
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#E0E7FF',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'การนอน',
                  text: 'บันทึกการนอน'
                },
                contents: [
                  {
                    type: 'text',
                    text: '😴',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'การนอน',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FEE2E2',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'อาการป่วย',
                  text: 'บันทึกอาการ'
                },
                contents: [
                  {
                    type: 'text',
                    text: '🤒',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'อาการป่วย',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              }
            ]
          },
          // Row 4: Mood & Custom
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FEF9C3',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'อารมณ์',
                  text: 'บันทึกอารมณ์'
                },
                contents: [
                  {
                    type: 'text',
                    text: '😊',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'อารมณ์',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#F3F4F6',
                cornerRadius: 'lg',
                paddingAll: 'lg',
                flex: 1,
                action: {
                  type: 'message',
                  label: 'พิมพ์เอง',
                  text: 'บันทึกอื่นๆ'
                },
                contents: [
                  {
                    type: 'text',
                    text: '✏️',
                    size: 'xxl',
                    align: 'center'
                  },
                  {
                    type: 'text',
                    text: 'พิมพ์เอง',
                    size: 'sm',
                    align: 'center',
                    weight: 'bold',
                    margin: 'sm'
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: 'หรือพิมพ์ตรงๆ ได้เลย เช่น "ความดัน 120/80"',
            size: 'xs',
            color: OJ.textMuted,
            align: 'center',
            wrap: true
          }
        ]
      }
    }
  };
}

// Initialize orchestrator (once)
let initialized = false;
async function initializeIfNeeded() {
  if (!initialized) {
    console.log('🚀 Initializing OONJAI Multi-Agent System...');
    initialized = await orchestrator.initialize();
    if (initialized) {
      console.log('✅ All agents ready!');
    } else {
      console.error('❌ Failed to initialize agents');
    }
  }
  return initialized;
}

// Serve static files (development only - Vercel uses @vercel/static)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

// CORS middleware for LIFF pages (loaded from liff.line.me)
app.use(cors({
  origin: [
    'https://liff.line.me',
    /\.line\.me$/,
    /localhost/,
    /app\.oonj\.ai$/,
    /oonj\.ai$/,
    /duulair\.vercel\.app$/,
    /duulair-hybrid\.vercel\.app$/
  ],
  credentials: true
}));

// Use express.json() with verify to capture raw body
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Registration API routes
app.use('/api/registration', registrationRoutes);

// Quick API endpoints for simplified onboarding
/**
 * GET /api/check-user/:lineUserId
 * Check if user is registered (for first-time user detection)
 */
app.get('/api/check-user/:lineUserId', async (req, res) => {
  try {
    const { lineUserId } = req.params;

    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        error: 'lineUserId is required'
      });
    }

    console.log(`🔍 Checking user registration: ${lineUserId}`);

    const result = await userService.checkUserExists(lineUserId);

    // Return format expected by patient-profile.html
    res.json({
      exists: result.exists,
      role: result.role || null,
      profile: result.profile ? {
        profile_id: result.profile.id,
        ...result.profile
      } : null
    });
  } catch (error: any) {
    console.error('❌ Check user error:', error);
    res.status(500).json({
      success: false,
      exists: false,
      error: error.message || 'Failed to check user'
    });
  }
});

/**
 * GET /api/patients (TEST ONLY)
 * List all patients for testing
 */
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await userService.listPatients();

    res.json({
      success: true,
      patients: patients || []
    });
  } catch (error: any) {
    console.error('Error listing patients:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/patient/:patientId
 * Get patient profile by ID (bypasses RLS using service role)
 */
app.get('/api/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'patientId is required'
      });
    }

    console.log(`📋 Getting patient profile: ${patientId}`);

    const profile = await userService.getPatientProfile(patientId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error: any) {
    console.error('❌ Get patient error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get patient'
    });
  }
});

/**
 * PUT /api/patient/:patientId
 * Update patient profile by ID
 */
app.put('/api/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const updateData = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'patientId is required'
      });
    }

    console.log(`📝 Updating patient profile: ${patientId}`, updateData);

    const updatedProfile = await userService.updatePatientProfile(patientId, updateData);

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      profile: updatedProfile
    });
  } catch (error: any) {
    console.error('❌ Update patient error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update patient'
    });
  }
});

/**
 * GET /api/debug-env
 * Debug endpoint to check Supabase connection
 */
app.get('/api/debug-env', async (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'NOT SET';
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_KEY;

    // Get first 20 chars of URL to identify which project
    const urlPreview = supabaseUrl.substring(0, 50);

    res.json({
      supabaseUrl: urlPreview,
      hasServiceKey: hasServiceKey,
      nodeEnv: process.env.NODE_ENV || 'development'
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/quick-register
 * Quick registration for caregiver + patient (simplified onboarding)
 */
app.post('/api/quick-register', async (req, res) => {
  try {
    const {
      lineUserId,
      displayName,
      pictureUrl,
      statusMessage,
      contextType,
      groupId,
      caregiver,
      patient
    } = req.body;

    // Validate required fields
    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        error: 'lineUserId is required'
      });
    }

    if (!caregiver || !caregiver.firstName || !caregiver.lastName) {
      return res.status(400).json({
        success: false,
        error: 'Caregiver first name and last name are required'
      });
    }

    if (!caregiver.relationship) {
      return res.status(400).json({
        success: false,
        error: 'Relationship is required'
      });
    }

    if (!patient || !patient.firstName || !patient.lastName || !patient.birthDate) {
      return res.status(400).json({
        success: false,
        error: 'Patient first name, last name, and birth date are required'
      });
    }

    console.log(`📝 Quick registration for ${lineUserId}: ${caregiver.firstName} ${caregiver.lastName}`);

    // Check if user already exists
    const existingUser = await userService.checkUserExists(lineUserId);
    if (existingUser.exists) {
      return res.status(400).json({
        success: false,
        error: 'User already registered'
      });
    }

    // Register caregiver
    const caregiverResult = await userService.registerCaregiver(
      lineUserId,
      displayName,
      pictureUrl,
      {
        firstName: caregiver.firstName,
        lastName: caregiver.lastName,
        phoneNumber: caregiver.phoneNumber || null,
        relationship: caregiver.relationship
      }
    );

    if (!caregiverResult.success) {
      throw new Error('Failed to register caregiver');
    }

    console.log(`✅ Caregiver registered: ${caregiverResult.profile.id}`);

    // Create patient profile (without LINE account)
    const patientResult = await userService.createPatientProfile({
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
      conditions: patient.medicalCondition || null,
      groupId: contextType === 'group' ? groupId : null
    });

    if (!patientResult.success || !patientResult.patientId) {
      console.error('❌ Patient profile creation failed:', {
        success: patientResult.success,
        patientId: patientResult.patientId,
        error: patientResult.error
      });
      throw new Error(patientResult.error || 'Failed to create patient profile');
    }

    console.log(`✅ Patient profile created: ${patientResult.patientId}`);

    // Link caregiver to patient with relationship
    const linkResult = await userService.linkCaregiverToPatient(
      caregiverResult.profile.id,
      patientResult.patientId,
      caregiver.relationship
    );

    console.log(`✅ Linked caregiver to patient with relationship: ${caregiver.relationship}`);

    res.json({
      success: true,
      caregiverId: caregiverResult.profile.id,
      patientId: patientResult.patientId,
      message: 'Registration successful'
    });
  } catch (error: any) {
    console.error('❌ Quick registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed'
    });
  }
});

/**
 * POST /api/ocr/vitals
 * OCR blood pressure from image (LIFF upload)
 */
app.post('/api/ocr/vitals', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded'
      });
    }

    console.log(`📷 OCR vitals request - file size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    // Compress image if needed (API limit is 5MB)
    const compressed = await compressImageForAPI(req.file.buffer, req.file.mimetype);
    const base64Image = compressed.base64;
    const mimeType = compressed.mimeType;

    if (compressed.wasCompressed) {
      console.log(`🖼️ Image compressed: ${(compressed.originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressed.compressedSize / 1024 / 1024).toFixed(2)} MB`);
    }

    // Use Claude Vision via OpenRouter to read blood pressure from image
    const visionPrompt = `กรุณาอ่านค่าความดันโลหิตจากรูปภาพนี้

หากเป็นเครื่องวัดความดันที่มีตัวเลขชัดเจน ให้อ่านค่า systolic (ตัวบน) และ diastolic (ตัวล่าง) และชีพจร (pulse) ถ้ามี

ตอบกลับมาในรูปแบบ JSON เท่านั้น:
{
  "systolic": number,
  "diastolic": number,
  "pulse": number or null,
  "error": null
}

หากอ่านไม่ได้หรือไม่ใช่รูปเครื่องวัดความดัน ให้ตอบ:
{
  "error": "ไม่สามารถอ่านค่าความดันจากรูปภาพนี้ได้"
}`;

    const visionResult = await openRouterService.analyzeBase64Image(
      base64Image,
      mimeType,
      visionPrompt,
      { model: AI_CONFIG.model }
    );
    console.log('📷 Vision result:', visionResult);

    try {
      const parsed = JSON.parse(visionResult);

      if (parsed.error) {
        return res.json({
          success: false,
          error: parsed.error
        });
      }

      if (!parsed.systolic || !parsed.diastolic) {
        return res.json({
          success: false,
          error: 'ไม่สามารถอ่านค่าความดันจากรูปภาพนี้ได้'
        });
      }

      // Return the extracted values
      res.json({
        success: true,
        data: {
          systolic: parsed.systolic,
          diastolic: parsed.diastolic,
          pulse: parsed.pulse || null
        }
      });

    } catch (parseError) {
      console.error('Failed to parse vision result:', parseError);
      res.json({
        success: false,
        error: 'ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง'
      });
    }

  } catch (error: any) {
    console.error('❌ OCR vitals error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'OCR processing failed'
    });
  }
});

// Group API routes (TASK-002)
app.use('/api/groups', groupRoutes);

// Report API routes (Download reports - Premium feature)
app.use('/api/reports', reportRoutes);

// Dashboard API routes (LIFF app)
app.use('/api/dashboard', dashboardRoutes);

// Health API routes (LIFF app - record vitals, medications, etc.)
app.use('/api/health', healthRoutes);

// Medication CRUD routes (LIFF app - manage medications list)
app.use('/api/medications', medicationRoutes);

// Reminder CRUD routes (LIFF app - manage reminders list)
app.use('/api/reminders', reminderRoutes);

// Health category preferences routes (LIFF app - privacy toggles)
app.use('/api/preferences', preferencesRoutes);

// Trends API routes (LIFF app - charts & analytics)
app.use('/api/trends', trendsRoutes);

// LINE Webhook - with manual signature verification
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received:', JSON.stringify(req.body));

    // Verify LINE signature
    const signature = req.headers['x-line-signature'] as string;
    if (signature && lineConfig.channelSecret) {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Create HMAC signature
      const hash = crypto
        .createHmac('sha256', lineConfig.channelSecret)
        .update(rawBody)
        .digest('base64');

      if (hash !== signature) {
        console.error('❌ Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('✅ Signature verified');
    }

    // Handle verification request (LINE sends empty body or no events)
    if (!req.body.events || req.body.events.length === 0) {
      console.log('✅ Webhook verification or empty event');
      return res.json({ status: 'ok', message: 'No events to process' });
    }

    await initializeIfNeeded();

    const events: WebhookEvent[] = req.body.events;

    // Process all events
    const results = await Promise.all(
      events.map(async (event) => {
        // Handle different event types
        switch (event.type) {
          case 'message':
            if (event.message.type === 'text') {
              return handleTextMessage(event);
            } else if (event.message.type === 'image') {
              return handleImageMessage(event);
            } else if (event.message.type === 'audio') {
              return handleAudioMessage(event);
            }
            break;
          case 'follow':
            return handleFollow(event);
          case 'unfollow':
            return handleUnfollow(event);

          // Group events (TASK-002)
          case 'join':
            return handleGroupJoin(event);
          case 'leave':
            return handleGroupLeave(event);
          case 'memberJoined':
            return handleMemberJoin(event);
          case 'memberLeft':
            return handleMemberLeave(event);

          // Postback events (button clicks)
          case 'postback':
            return handlePostback(event);

          default:
            console.log('Unhandled event type:', event.type);
        }
      })
    );

    res.json({ status: 'ok', processed: results.length });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // IMPORTANT: Return 200 to prevent LINE webhook retry loop
    // Errors are already logged, no need for LINE to retry
    res.json({ status: 'error', error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Handle text message
async function handleTextMessage(event: any) {
  try {
    const replyToken = event.replyToken;
    const message = event.message;
    const userId = event.source?.userId || '';
    const groupId = event.source?.groupId;
    const sourceType = event.source?.type; // 'user' or 'group'
    const isRedelivery = event.deliveryContext?.isRedelivery || false;

    console.log(`📨 Message from ${userId} (source: ${sourceType}): ${message.text}${isRedelivery ? ' [REDELIVERY]' : ''}`);

    // Skip redelivery events - replyToken is likely expired
    if (isRedelivery) {
      console.log('⏭️ Skipping redelivery event - replyToken may be invalid');
      return { success: true, skipped: true, reason: 'redelivery' };
    }

    // Check if this is a patient selection response (PATIENT:uuid:original_message)
    let selectedPatientId: string | null = null;
    let originalMessage = message.text;
    if (message.text.startsWith('PATIENT:')) {
      const parts = message.text.split(':');
      if (parts.length >= 3) {
        selectedPatientId = parts[1];
        originalMessage = parts.slice(2).join(':'); // Re-join in case original message has ":"
        console.log(`👤 Patient selected: ${selectedPatientId}, original: ${originalMessage}`);
      }
    }

    // Detect group vs 1:1 context
    const isGroup = sourceType === 'group' && groupId;

    let context: any = {
      userId,          // Will be overridden to UUID below if user found
      lineUserId: userId, // Always keep LINE User ID for LINE API calls
      source: 'line',
      timestamp: new Date()
    };

    // For 1:1 chat, try to get patientId from user's linked patient
    // Flow: users → caregiver_profiles/patient_profiles → patient_caregivers
    if (!isGroup) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_KEY || ''
        );

        // Step 1: Get user by LINE user ID (include consent_accepted)
        const { data: user } = await supabase
          .from('users')
          .select('id, role, consent_accepted')
          .eq('line_user_id', userId)
          .single();

        if (user) {
          // ✅ Consent gate: block if not accepted
          if (!user.consent_accepted) {
            console.log('⚠️ User has not accepted consent, sending consent reminder');
            await lineClient.replyMessage(replyToken, createConsentFlexMessage(userId));
            return { success: true, blocked: true, reason: 'consent_not_accepted' };
          }

          // Override userId to UUID for consistent use across agents
          context.userId = user.id;

          // Step 2: Check user role and get linked patient
          if (user.role === 'caregiver') {
            // Get caregiver profile
            const { data: caregiverProfile } = await supabase
              .from('caregiver_profiles')
              .select('id')
              .eq('user_id', user.id)
              .single();

            if (caregiverProfile) {
              // Step 3: Get linked patient from patient_caregivers
              const { data: patientLink } = await supabase
                .from('patient_caregivers')
                .select('patient_id')
                .eq('caregiver_id', caregiverProfile.id)
                .eq('status', 'active')
                .limit(1)
                .single();

              if (patientLink?.patient_id) {
                context.patientId = patientLink.patient_id;
                console.log(`👤 1:1 chat (caregiver) - linked patient: ${context.patientId}`);
              }
            }
          } else if (user.role === 'patient') {
            // User is a patient - get their patient profile directly
            const { data: patientProfile } = await supabase
              .from('patient_profiles')
              .select('id')
              .eq('user_id', user.id)
              .single();

            if (patientProfile) {
              context.patientId = patientProfile.id;
              console.log(`👤 1:1 chat (patient) - own profile: ${context.patientId}`);
            }
          }
        } else {
          // User not in DB — auto-create patient profile from LINE profile
          console.log(`📭 User not in DB, auto-creating patient profile for ${userId}`);
          try {
            const lineProfile = await lineClient.getProfile(userId);
            const autoResult = await userService.autoCreatePatient(
              userId,
              lineProfile.displayName,
              lineProfile.pictureUrl
            );
            context.patientId = autoResult.patientId;
            console.log(`✅ Auto-created patient from LINE chat: ${autoResult.patientId} (isNew: ${autoResult.isNew})`);
          } catch (autoErr) {
            console.log('⚠️ Auto-create patient failed (non-blocking):', autoErr);
          }
        }
      } catch (err) {
        console.log('ℹ️ Could not fetch user info for 1:1 chat:', err);
      }
    }

    // Handle group messages (TASK-002)
    if (isGroup) {
      console.log(`👥 Group message detected in group: ${groupId}`);

      // Get group context first to check if registered
      let groupContext = await groupWebhookService.getGroupContext(groupId);

      // Bot responds to ALL messages in group (no mention required)
      // This provides better UX - users can chat naturally
      console.log('✅ Group message - bot will respond');

      // If group not registered, try to auto-link if sender is registered caregiver
      if (!groupContext) {
        console.log('📝 Group not registered, checking if sender is caregiver...');

        const autoLinkResult = await groupService.autoLinkGroupWithPatient(groupId, userId);

        if (autoLinkResult.success && autoLinkResult.patientId) {
          console.log('✅ Auto-linked group with patient:', autoLinkResult.patientId);

          // Update groupContext for processing the message
          groupContext = {
            patientId: autoLinkResult.patientId,
            groupId: autoLinkResult.group!.id,
            source: 'group' as const
          };

          // Update context with new group info
          context = {
            userId,
            patientId: autoLinkResult.patientId,
            groupId: autoLinkResult.group!.id,
            source: 'group',
            timestamp: new Date(),
            actorLineUserId: userId,
            actorDisplayName: 'ผู้ดูแล'
          };

          // Process message with orchestrator (will be handled below)
          // Bot will respond to the message AND the auto-link is done
          console.log('👥 Group auto-linked, continuing to process message...');
        } else {
          // Not a registered caregiver - send registration guidance
          console.log('❌ Auto-link failed:', autoLinkResult.message);

          const guidanceMessage: TextMessage = {
            type: 'text',
            text: `❌ ${autoLinkResult.message}\n\nเพิ่มเพื่อน @oonjai แล้วลงทะเบียนก่อนใช้งานในกลุ่มนะคะ`
          };

          try {
            await lineClient.replyMessage(replyToken, guidanceMessage);
          } catch (sendError) {
            console.error('❌ Failed to send guidance:', sendError);
          }

          return { success: true, skipped: true, reason: 'not_registered' };
        }
      }

      // Get actor info
      const groupMessageResult = await groupWebhookService.handleGroupMessage(event, null);

      if (!groupMessageResult.success) {
        console.log('⏭️ Failed to get group message context');
        return { success: false, error: 'Failed to get group context' };
      }

      // Update context with group info and actor
      context = {
        userId,
        patientId: groupContext.patientId,
        groupId: groupContext.groupId,
        source: 'group',
        timestamp: new Date(),
        // Actor info for activity logging
        actorLineUserId: groupMessageResult.actorInfo?.userId,
        actorDisplayName: groupMessageResult.actorInfo?.displayName
      };

      console.log('👥 Group context:', context);

      // If patient was selected via Quick Reply, switch active patient
      if (selectedPatientId && groupContext.groupId) {
        console.log(`🔄 Switching active patient to: ${selectedPatientId}`);
        const { groupService } = await import('./services/group.service');
        const switchResult = await groupService.switchActivePatient(groupContext.groupId, selectedPatientId);

        if (switchResult.success) {
          console.log(`✅ Switched to patient: ${switchResult.patientName}`);
          // Update context with new patient
          context.patientId = selectedPatientId;
        } else {
          console.log(`❌ Failed to switch patient: ${switchResult.message}`);
          // Send error and return
          const errorMessage: TextMessage = {
            type: 'text',
            text: `❌ ${switchResult.message}`
          };
          await lineClient.replyMessage(replyToken, errorMessage);
          return { success: false, error: 'Failed to switch patient' };
        }
      }

      // Check if message contains patient name from Quick Reply (e.g., "กินยาแล้ว สมหวัง")
      const extractedPatient = extractPatientNameFromMessage(originalMessage);
      if (extractedPatient && groupContext.groupId) {
        console.log(`🔍 Extracted patient name from message: "${extractedPatient.patientName}"`);

        // Find patient by name in the group
        const foundPatientId = await findPatientByNameInGroup(groupContext.groupId, extractedPatient.patientName);

        if (foundPatientId) {
          console.log(`✅ Matched patient "${extractedPatient.patientName}" to ID: ${foundPatientId}`);
          // Update context with the found patient
          context.patientId = foundPatientId;
          // Keep the full message (with patient name) for processing
          // The agents will handle it correctly
        } else {
          console.log(`⚠️ Patient "${extractedPatient.patientName}" not found in group, using default patient`);
        }
      }
    }

    // Check if message is a command (TASK-002 Phase 4)
    // Use originalMessage (in case it was from patient selection Quick Reply)
    if (commandHandlerService.isCommand(originalMessage)) {
      console.log('🎯 Command detected:', originalMessage);

      const commandResponse = await commandHandlerService.handleCommand(originalMessage, context);

      if (commandResponse) {
        try {
          await lineClient.replyMessage(replyToken, commandResponse);
          console.log('✅ Command response sent');
          return { success: true, commandHandled: true };
        } catch (sendError) {
          console.error('❌ Failed to send command response:', sendError);
        }
      }
    }

    // ============================================
    // Phase 3: Check for Menu Requests (Flex Message triggers)
    // ============================================

    const trimmedText = originalMessage.trim();

    // Skip extraction pipeline for menu requests - go directly to orchestrator
    const menuPatterns = [
      /^รายงานสุขภาพ$/i,
      /^ดูรายงาน$/i,
      /^รายงาน$/i
    ];
    const isMenuRequest = menuPatterns.some(pattern => pattern.test(trimmedText));

    if (isMenuRequest) {
      console.log('📋 Menu request detected, skipping extraction pipeline');
      // Fall through to orchestrator
    }

    // ============================================
    // Phase 4: Unified AI Processing (AI_CONFIG model)
    // ============================================
    // Show loading animation while AI processes (1:1 chat only)
    if (sourceType === 'user' && userId) {
      showLoadingAnimation(userId, 20);
    }

    // Single AI call: intent + extraction + natural response
    // All processing goes through OrchestratorAgent → UnifiedNLUAgent
    // Use originalMessage (in case it was from patient selection Quick Reply)
    const result = await orchestrator.process({
      id: message.id,
      content: originalMessage,
      context
    });

    console.log('🤖 Agent result:', result);

    const intent = result.metadata?.intent;
    const quickReplyType = result.metadata?.quickReplyType;
    const flexMessageType = result.metadata?.flexMessageType;

    // Check if needs Quick Reply
    if (quickReplyType) {
      let quickReply;
      let text = 'กรุณาเลือกรายการ:';

      if (quickReplyType === 'health_menu') {
        quickReply = createHealthMenuQuickReply();
        text = 'คุณต้องการบันทึกสุขภาพประเภทไหนคะ?';
      } else if (quickReplyType === 'view_report') {
        quickReply = createViewReportQuickReply();
        text = 'คุณต้องการดูรายงานช่วงไหนคะ?';
      } else if (quickReplyType === 'select_patient') {
        const patientSelectionData = result.metadata?.patientSelectionData;
        if (patientSelectionData) {
          quickReply = createPatientSelectionQuickReply(
            patientSelectionData.patients,
            patientSelectionData.originalMessage
          );
          text = result.data.response || '👥 กลุ่มนี้มีหลายสมาชิก กรุณาเลือกสมาชิกที่ต้องการบันทึก:';
        }
      }

      if (quickReply) {
        const replyMessage: TextMessage = {
          type: 'text',
          text,
          quickReply
        };

        try {
          await lineClient.replyMessage(replyToken, replyMessage);
          console.log('✅ Quick Reply sent:', quickReplyType);
        } catch (sendError) {
          console.error('❌ Failed to send Quick Reply:', sendError);
        }
        return result;
      }
    }

    // Check if needs Flex Message
    if (flexMessageType) {
      let flexMessage;

      // Check if ReportAgent already created the Flex Message
      // Note: flexMessage can be in result.data.flexMessage (Natural Conversation mode)
      // or result.data.combined.flexMessage (Legacy mode)
      const reportFlexMessage = result.data?.flexMessage || result.data?.combined?.flexMessage;
      if (flexMessageType === 'report_menu' && reportFlexMessage) {
        // Use Flex Message from ReportAgent
        flexMessage = {
          type: 'flex' as const,
          altText: '📊 เลือกประเภทรายงาน',
          contents: reportFlexMessage
        };
      } else if (flexMessageType === 'registration') {
        // Auto-create patient if not registered, then reply with text
        if (context.patientId) {
          // Already has patient profile
          const alreadyRegisteredMessage: TextMessage = {
            type: 'text',
            text: '✅ คุณใช้งานได้แล้วค่ะ! พิมพ์คุยกับน้องอุ่นได้เลยค่ะ 😊'
          };
          try {
            await lineClient.replyMessage(replyToken, alreadyRegisteredMessage);
            console.log('✅ Already registered message sent');
            return result;
          } catch (sendError) {
            console.error('❌ Failed to send already registered message:', sendError);
          }
        } else {
          // Auto-create patient profile
          try {
            const lineProfile = await lineClient.getProfile(context.lineUserId || userId);
            await userService.autoCreatePatient(context.lineUserId || userId, lineProfile.displayName, lineProfile.pictureUrl);
            console.log('✅ Auto-created patient from registration request');
          } catch (autoErr) {
            console.log('⚠️ Auto-create patient failed:', autoErr);
          }
          const createdMessage: TextMessage = {
            type: 'text',
            text: '✅ สร้างบัญชีให้แล้วค่ะ! พิมพ์คุยกับน้องอุ่นได้เลยค่ะ 😊'
          };
          try {
            await lineClient.replyMessage(replyToken, createdMessage);
            console.log('✅ Auto-created + welcome message sent');
            return result;
          } catch (sendError) {
            console.error('❌ Failed to send auto-created message:', sendError);
          }
        }
      } else if (flexMessageType === 'package') {
        flexMessage = createPackageFlexMessage();
      } else if (flexMessageType === 'help') {
        flexMessage = createHelpFlexMessage();
      } else if (flexMessageType === 'health_log_menu') {
        flexMessage = createHealthLogMenuFlexMessage();
      } else if (flexMessageType === 'report_menu') {
        // Fallback to old function if ReportAgent didn't provide one
        flexMessage = createReportMenuFlexMessage();
      }

      if (flexMessage) {
        try {
          await lineClient.replyMessage(replyToken, flexMessage);
          console.log('✅ Flex Message sent:', flexMessageType);
          return result;
        } catch (sendError: any) {
          // Log detailed error from LINE API
          console.error('❌ Failed to send Flex Message:', {
            error: sendError.message,
            statusCode: sendError.statusCode,
            statusMessage: sendError.statusMessage,
            responseData: sendError.originalError?.response?.data
          });

          // Fallback: Send text message instead
          const responseText = result.data?.combined?.response;
          if (responseText) {
            try {
              const fallbackMessage: TextMessage = {
                type: 'text',
                text: responseText
              };
              await lineClient.replyMessage(replyToken, fallbackMessage);
              console.log('✅ Sent fallback text message after Flex Message failure');
            } catch (fallbackError) {
              console.error('❌ Fallback text message also failed:', fallbackError);
            }
          }
          return result;
        }
      }
    }

    // Send normal text reply
    // Support both Natural Conversation mode (result.data.response) and legacy mode (result.data.combined.response)
    const responseText = result.data?.response || result.data?.combined?.response;
    if (result.success && responseText) {
      // Check if this is a medication-related intent - send Flex Message instead of text
      const healthDataType = result.metadata?.healthData?.type || result.data?.nluResult?.healthData?.type;
      const messageMatchesMedication = /กินยา|ทานยา|ยังไม่ได้กิน|ไม่ได้กินยา/i.test(originalMessage);
      const isMedicationIntent =
        (intent === 'health_log' && healthDataType === 'medication') ||
        messageMatchesMedication;

      console.log('[Medication Check]', { intent, healthDataType, messageMatchesMedication, isMedicationIntent, originalMessage: originalMessage.substring(0, 50) });

      if (isMedicationIntent) {
        // Extract medication info from result
        const medicationData = result.metadata?.healthData?.medication || result.data?.nluResult?.healthData?.medication;

        // Check if message explicitly says "not taken" - these patterns indicate NOT taking medication
        const notTakenPatterns = /ยังไม่ได้กิน|ไม่ได้กินยา|ลืมกินยา|ยังไม่ได้ทาน|ไม่ได้ทานยา/i;
        const messageIndicatesNotTaken = notTakenPatterns.test(originalMessage);

        // If message clearly indicates not taken, use that; otherwise use NLU result with true as default
        const taken = messageIndicatesNotTaken ? false : (medicationData?.taken !== false);
        const medicationName = medicationData?.medicationName;

        console.log('[Medication taken check]', { messageIndicatesNotTaken, medicationDataTaken: medicationData?.taken, finalTaken: taken });

        // Get patient name if in group context
        let patientNameForFlex: string | undefined;
        if (context.patientId) {
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.SUPABASE_URL || '',
              process.env.SUPABASE_SERVICE_KEY || ''
            );
            const { data: patient } = await supabase
              .from('patient_profiles')
              .select('first_name')
              .eq('id', context.patientId)
              .single();
            patientNameForFlex = patient?.first_name;
          } catch (err) {
            // Ignore - patient name is optional
          }
        }

        const medicationFlexMessage = createMedicationResponseFlexMessage(
          responseText,
          medicationName,
          taken,
          patientNameForFlex
        );

        try {
          await lineClient.replyMessage(replyToken, medicationFlexMessage);
          console.log('✅ Medication Flex Message sent');
          return result;
        } catch (flexError) {
          console.error('❌ Failed to send Medication Flex, falling back to text:', flexError);
          // Fall through to send text message
        }
      }

      // Send text reply (default or fallback)
      const replyMessage: TextMessage = {
        type: 'text',
        text: responseText
      };

      try {
        await lineClient.replyMessage(replyToken, replyMessage);
        console.log('✅ Reply sent to LINE:', responseText);
      } catch (sendError) {
        console.error('❌ Failed to send text reply:', sendError);
      }
    } else {
      console.log('⚠️ No response to send:', { success: result.success, hasResponse: !!responseText });
    }

    return result;
  } catch (error) {
    console.error('Error handling text message:', error);
    // DON'T throw - return success to prevent LINE webhook retry loop
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Handle image message (for OCR blood pressure reading)
async function handleImageMessage(event: any) {
  try {
    const replyToken = event.replyToken;
    const messageId = event.message.id;
    const userId = event.source?.userId || '';
    const isGroupContext = event.source?.type === 'group' || event.source?.type === 'room';
    const groupId = event.source?.groupId || event.source?.roomId || null;

    console.log(`📷 Image message received from ${userId} (group: ${isGroupContext})`);

    // Skip redelivery events - replyToken is likely expired
    const isRedelivery = event.deliveryContext?.isRedelivery || false;
    if (isRedelivery) {
      console.log('⏭️ Skipping redelivery event for image');
      return { success: true, skipped: true, reason: 'redelivery' };
    }

    // Check user registration — auto-create if not found
    let userCheck = await userService.checkUserExists(userId);
    if (!userCheck.exists) {
      try {
        const lineProfile = await lineClient.getProfile(userId);
        await userService.autoCreatePatient(userId, lineProfile.displayName, lineProfile.pictureUrl);
        userCheck = await userService.checkUserExists(userId);
        console.log(`✅ Auto-created patient from image message: ${userId}`);
      } catch (autoErr) {
        console.log('⚠️ Auto-create failed for image handler:', autoErr);
        const replyMessage: TextMessage = { type: 'text', text: 'เกิดข้อผิดพลาด กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง' };
        await lineClient.replyMessage(replyToken, replyMessage);
        return { success: true, skipped: true, reason: 'not_registered' };
      }
    }

    // Get patient ID — for patient role use profile.id, for caregiver use linked_patient_id
    let patientId = userCheck.role === 'patient'
      ? userCheck.profile?.id
      : (userCheck.profile as any)?.linked_patient_id;
    if (!patientId) {
      const replyMessage: TextMessage = {
        type: 'text',
        text: 'ไม่พบข้อมูลสมาชิกที่เชื่อมต่อ กรุณาลงทะเบียนสมาชิกก่อนค่ะ'
      };
      await lineClient.replyMessage(replyToken, replyMessage);
      return { success: true, skipped: true, reason: 'no_patient' };
    }

    // Get image content from LINE
    const stream = await lineClient.getMessageContent(messageId);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }

    const imageBuffer = Buffer.concat(chunks);
    console.log(`📷 LINE Image received - size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Compress image if needed (API limit is 5MB)
    let base64Image: string;
    let mimeType: string;

    try {
      const compressed = await compressImageForAPI(imageBuffer, 'image/jpeg');
      base64Image = compressed.base64;
      mimeType = compressed.mimeType;

      if (compressed.wasCompressed) {
        console.log(`🖼️ Image compressed: ${(compressed.originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressed.compressedSize / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (compressError: any) {
      console.error(`❌ Image compression failed:`, compressError.message);
      // Try to use original if small enough
      if (imageBuffer.length <= 4.5 * 1024 * 1024) {
        console.log(`⚠️ Using original image (compression failed but size OK)`);
        base64Image = imageBuffer.toString('base64');
        mimeType = 'image/jpeg';
      } else {
        throw new Error(`รูปภาพมีขนาดใหญ่เกินไป (${(imageBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
      }
    }

    console.log(`📷 Sending to OpenRouter Vision API...`);

    // Use Claude Vision via OpenRouter to read health data from image
    const ocrPrompt = `วิเคราะห์รูปนี้และอ่านค่าสุขภาพที่เห็น

รูปอาจเป็น:
1. เครื่องวัดความดัน (Blood Pressure Monitor) - มีค่า SYS, DIA, PULSE
2. เครื่องวัดน้ำตาล (Glucose Meter) - มีค่า mg/dL
3. เครื่องชั่งน้ำหนัก (Weight Scale) - มีค่า kg
4. เทอร์โมมิเตอร์ (Thermometer) - มีค่า °C หรือ °F
5. ซองยา/กล่องยา (Medication) - มีชื่อยา

ตอบเป็น JSON รูปแบบใดรูปแบบหนึ่ง:

ความดัน: {"type": "blood_pressure", "systolic": 120, "diastolic": 80, "pulse": 70}
น้ำตาล: {"type": "glucose", "value": 100, "unit": "mg/dL"}
น้ำหนัก: {"type": "weight", "value": 65.5, "unit": "kg"}
อุณหภูมิ: {"type": "temperature", "value": 36.5, "unit": "C"}
ยา: {"type": "medication", "name": "ชื่อยา", "dosage": "ขนาดยา"}

ถ้าไม่พบข้อมูลสุขภาพในรูป: {"type": "unknown", "description": "อธิบายสิ่งที่เห็นในรูป"}

ตอบเฉพาะ JSON เท่านั้น ไม่ต้องอธิบายเพิ่มเติม`;

    const visionResult = await openRouterService.analyzeBase64Image(
      base64Image,
      mimeType,
      ocrPrompt,
      { model: AI_CONFIG.model }
    );
    console.log('📷 Vision result:', visionResult);

    let responseText = '';
    let parsed: any = null;

    // Try multiple parsing strategies
    try {
      // Strategy 1: Direct JSON parse
      parsed = JSON.parse(visionResult);
    } catch (e1) {
      // Strategy 2: Extract JSON from text (Claude may add explanation text)
      const jsonMatch = visionResult.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.log('📷 Failed to parse extracted JSON:', jsonMatch[0]);
        }
      }

      // Strategy 3: Extract numbers from text patterns for blood pressure
      if (!parsed) {
        const sysMatch = visionResult.match(/(?:SYS|systolic|ค่าบน)[:\s]*(\d{2,3})/i);
        const diaMatch = visionResult.match(/(?:DIA|diastolic|ค่าล่าง)[:\s]*(\d{2,3})/i);
        const pulseMatch = visionResult.match(/(?:PULSE|pulse|ชีพจร)[:\s]*(\d{2,3})/i);
        const bpMatch = visionResult.match(/(\d{2,3})\s*[\/]\s*(\d{2,3})/);

        if (sysMatch && diaMatch) {
          parsed = {
            type: 'blood_pressure',
            systolic: parseInt(sysMatch[1]),
            diastolic: parseInt(diaMatch[1]),
            pulse: pulseMatch ? parseInt(pulseMatch[1]) : null
          };
        } else if (bpMatch) {
          parsed = {
            type: 'blood_pressure',
            systolic: parseInt(bpMatch[1]),
            diastolic: parseInt(bpMatch[2]),
            pulse: pulseMatch ? parseInt(pulseMatch[1]) : null
          };
        }

        // Try glucose pattern
        const glucoseMatch = visionResult.match(/(\d{2,3})\s*(?:mg\/dL|mg\/dl)/i);
        if (glucoseMatch && !parsed) {
          parsed = { type: 'glucose', value: parseInt(glucoseMatch[1]), unit: 'mg/dL' };
        }

        // Try weight pattern
        const weightMatch = visionResult.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|กก|กิโล)/i);
        if (weightMatch && !parsed) {
          parsed = { type: 'weight', value: parseFloat(weightMatch[1]), unit: 'kg' };
        }

        // Try temperature pattern
        const tempMatch = visionResult.match(/(\d{2}(?:\.\d)?)\s*(?:°?C|องศา)/i);
        if (tempMatch && !parsed) {
          parsed = { type: 'temperature', value: parseFloat(tempMatch[1]), unit: 'C' };
        }
      }
    }

    console.log('📷 Parsed result:', parsed);

    // Process based on data type
    if (!parsed || parsed.type === 'unknown') {
      const desc = parsed?.description || 'ไม่พบข้อมูลสุขภาพในรูป';
      responseText = `📷 ${desc}\n\nส่งรูปเครื่องวัดความดัน น้ำตาล น้ำหนัก หรืออุณหภูมิได้ค่ะ`;

    } else if (parsed.type === 'blood_pressure') {
      // Validate BP values
      if (parsed.systolic < 60 || parsed.systolic > 250 || parsed.diastolic < 40 || parsed.diastolic > 150) {
        responseText = `❌ ค่าความดันที่อ่านได้ (${parsed.systolic}/${parsed.diastolic}) ดูไม่ถูกต้อง\n\nกรุณาส่งรูปใหม่ค่ะ`;
      } else {
        const vitalsData: any = {
          patient_id: patientId,
          bp_systolic: parsed.systolic,
          bp_diastolic: parsed.diastolic,
          heart_rate: parsed.pulse || null,
          source: 'image',
          ai_confidence: 0.9,
          notes: `อ่านจากรูป${parsed.pulse ? ` ชีพจร ${parsed.pulse}` : ''}`,
          measured_at: new Date().toISOString()
        };
        await supabaseService.saveVitalsLog(vitalsData);

        responseText = `✅ บันทึกความดัน ${parsed.systolic}/${parsed.diastolic} mmHg`;
        if (parsed.pulse) responseText += `\n❤️ ชีพจร: ${parsed.pulse} ครั้ง/นาที`;

        if (parsed.systolic > 140 || parsed.diastolic > 90) {
          responseText += '\n\n⚠️ ความดันสูงกว่าปกติ กรุณาติดตามอาการ';
        } else if (parsed.systolic < 90 || parsed.diastolic < 60) {
          responseText += '\n\n⚠️ ความดันต่ำกว่าปกติ กรุณาติดตามอาการ';
        }
      }

    } else if (parsed.type === 'glucose') {
      // Validate glucose (normal 70-140 mg/dL)
      if (parsed.value < 20 || parsed.value > 600) {
        responseText = `❌ ค่าน้ำตาลที่อ่านได้ (${parsed.value}) ดูไม่ถูกต้อง\n\nกรุณาส่งรูปใหม่ค่ะ`;
      } else {
        const vitalsData: any = {
          patient_id: patientId,
          glucose: parsed.value,
          source: 'image',
          ai_confidence: 0.9,
          notes: 'อ่านจากรูปเครื่องวัดน้ำตาล',
          measured_at: new Date().toISOString()
        };
        await supabaseService.saveVitalsLog(vitalsData);

        responseText = `✅ บันทึกน้ำตาล ${parsed.value} mg/dL`;

        if (parsed.value > 180) {
          responseText += '\n\n⚠️ น้ำตาลสูงมาก กรุณาปรึกษาแพทย์';
        } else if (parsed.value > 140) {
          responseText += '\n\n⚠️ น้ำตาลสูงกว่าปกติ';
        } else if (parsed.value < 70) {
          responseText += '\n\n⚠️ น้ำตาลต่ำ ควรทานอาหาร/ของหวาน';
        }
      }

    } else if (parsed.type === 'weight') {
      // Validate weight (20-300 kg)
      if (parsed.value < 20 || parsed.value > 300) {
        responseText = `❌ ค่าน้ำหนักที่อ่านได้ (${parsed.value}) ดูไม่ถูกต้อง\n\nกรุณาส่งรูปใหม่ค่ะ`;
      } else {
        const vitalsData: any = {
          patient_id: patientId,
          weight: parsed.value,
          source: 'image',
          ai_confidence: 0.9,
          notes: 'อ่านจากรูปเครื่องชั่ง',
          measured_at: new Date().toISOString()
        };
        await supabaseService.saveVitalsLog(vitalsData);

        responseText = `✅ บันทึกน้ำหนัก ${parsed.value} kg เรียบร้อยแล้วค่ะ`;
      }

    } else if (parsed.type === 'temperature') {
      // Validate temperature (34-42°C)
      if (parsed.value < 34 || parsed.value > 42) {
        responseText = `❌ ค่าอุณหภูมิที่อ่านได้ (${parsed.value}°C) ดูไม่ถูกต้อง\n\nกรุณาส่งรูปใหม่ค่ะ`;
      } else {
        const vitalsData: any = {
          patient_id: patientId,
          temperature: parsed.value,
          source: 'image',
          ai_confidence: 0.9,
          notes: 'อ่านจากรูปเทอร์โมมิเตอร์',
          measured_at: new Date().toISOString()
        };
        await supabaseService.saveVitalsLog(vitalsData);

        responseText = `✅ บันทึกอุณหภูมิ ${parsed.value}°C เรียบร้อยแล้วค่ะ`;

        if (parsed.value >= 38) {
          responseText += '\n\n⚠️ มีไข้ กรุณาติดตามอาการและพักผ่อน';
        } else if (parsed.value >= 37.5) {
          responseText += '\n\n⚠️ อุณหภูมิสูงกว่าปกติเล็กน้อย';
        }
      }

    } else if (parsed.type === 'medication') {
      // Log medication info
      const logData: any = {
        patient_id: patientId,
        task_type: 'medication_info',
        value: parsed.name,
        metadata: {
          medication_name: parsed.name,
          dosage: parsed.dosage,
          source: 'image'
        },
        notes: `ยา: ${parsed.name}${parsed.dosage ? ` (${parsed.dosage})` : ''}`,
        timestamp: new Date().toISOString()
      };
      await supabaseService.saveActivityLog(logData);

      responseText = `📋 พบข้อมูลยา: ${parsed.name}`;
      if (parsed.dosage) responseText += `\n💊 ขนาด: ${parsed.dosage}`;
      responseText += '\n\nบันทึกข้อมูลยาเรียบร้อยแล้วค่ะ';

    } else {
      responseText = '❌ ไม่สามารถอ่านค่าจากรูปได้\n\nลองส่งรูปที่เห็นตัวเลขชัดเจนกว่านี้ค่ะ';
    }

    const replyMessage: TextMessage = {
      type: 'text',
      text: responseText
    };
    await lineClient.replyMessage(replyToken, replyMessage);

    return { success: true, type: 'image_ocr' };

  } catch (error: any) {
    console.error('❌ Error handling image message:', error);

    // Try to send error message to user
    try {
      const replyToken = event.replyToken;
      const errorMessage = error.message || 'Unknown error';

      // Check if it's a size-related error
      let userErrorMessage = '❌ เกิดข้อผิดพลาดในการประมวลผลรูปภาพ\n\nกรุณาลองใหม่อีกครั้งค่ะ';

      if (errorMessage.includes('exceeds') || errorMessage.includes('size') || errorMessage.includes('5 MB')) {
        userErrorMessage = '❌ รูปภาพมีขนาดใหญ่เกินไป\n\nกรุณาส่งรูปที่มีขนาดเล็กกว่านี้ค่ะ';
      } else if (errorMessage.includes('Provider returned error')) {
        userErrorMessage = '❌ ระบบไม่สามารถอ่านรูปได้ชั่วคราว\n\nกรุณาลองใหม่อีกครั้งค่ะ';
      }

      const replyMessage: TextMessage = {
        type: 'text',
        text: userErrorMessage
      };
      await lineClient.replyMessage(replyToken, replyMessage);
    } catch (replyError) {
      console.error('❌ Failed to send error reply:', replyError);
    }

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Handle audio message (voice command via Groq Whisper)
async function handleAudioMessage(event: any) {
  try {
    const replyToken = event.replyToken;
    const messageId = event.message.id;
    const userId = event.source?.userId || '';
    const isGroupContext = event.source?.type === 'group' || event.source?.type === 'room';
    const groupId = event.source?.groupId || event.source?.roomId || null;
    const isRedelivery = event.deliveryContext?.isRedelivery || false;

    console.log(`🎤 Audio message received from ${userId} (group: ${isGroupContext})`);

    // Show loading animation for voice processing (1:1 chat only)
    if (!isGroupContext && userId) {
      showLoadingAnimation(userId, 30);
    }

    // Skip redelivery events
    if (isRedelivery) {
      console.log('⏭️ Skipping redelivery event for audio');
      return { success: true, skipped: true, reason: 'redelivery' };
    }

    // Check user registration — auto-create if not found
    let userCheck = await userService.checkUserExists(userId);
    if (!userCheck.exists) {
      try {
        const lineProfile = await lineClient.getProfile(userId);
        await userService.autoCreatePatient(userId, lineProfile.displayName, lineProfile.pictureUrl);
        userCheck = await userService.checkUserExists(userId);
        console.log(`✅ Auto-created patient from audio message: ${userId}`);
      } catch (autoErr) {
        console.log('⚠️ Auto-create failed for audio handler:', autoErr);
        const replyMessage: TextMessage = { type: 'text', text: 'เกิดข้อผิดพลาด กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง' };
        await lineClient.replyMessage(replyToken, replyMessage);
        return { success: true, skipped: true, reason: 'not_registered' };
      }
    }

    // Get patient ID — for patient role use profile.id, for caregiver use linked_patient_id
    let patientId = userCheck.role === 'patient'
      ? userCheck.profile?.id
      : (userCheck.profile as any)?.linked_patient_id;

    // If in group, try to get patient from group context
    if (isGroupContext && groupId) {
      const groupContext = await groupWebhookService.getGroupContext(groupId);
      if (groupContext?.patientId) {
        patientId = groupContext.patientId;
      }
    }

    if (!patientId) {
      const replyMessage: TextMessage = {
        type: 'text',
        text: 'ไม่พบข้อมูลสมาชิกที่เชื่อมต่อ กรุณาลงทะเบียนสมาชิกก่อนค่ะ'
      };
      await lineClient.replyMessage(replyToken, replyMessage);
      return { success: true, skipped: true, reason: 'no_patient' };
    }

    // Get audio content from LINE
    console.log('📥 Downloading audio from LINE...');
    const stream = await lineClient.getMessageContent(messageId);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }

    const audioBuffer = Buffer.concat(chunks);
    console.log(`🎤 Audio size: ${audioBuffer.length} bytes`);

    // Check file size (max 25MB for free tier)
    if (audioBuffer.length > 25 * 1024 * 1024) {
      const replyMessage: TextMessage = {
        type: 'text',
        text: '❌ ไฟล์เสียงใหญ่เกินไปค่ะ กรุณาส่งเสียงที่สั้นกว่านี้ (ไม่เกิน 2 นาที)'
      };
      await lineClient.replyMessage(replyToken, replyMessage);
      return { success: true, skipped: true, reason: 'file_too_large' };
    }

    // Transcribe audio using Deepgram Nova-2
    console.log('🧠 Transcribing with Deepgram Nova-2...');
    const transcriptionResult = await deepgramService.transcribeAudio(
      audioBuffer,
      'audio.m4a',  // LINE audio is typically M4A
      {
        language: 'th',
        punctuate: true,
        smartFormat: true
      }
    );

    if (!transcriptionResult.success || !transcriptionResult.text) {
      console.error('❌ Transcription failed:', transcriptionResult.error);
      const replyMessage: TextMessage = {
        type: 'text',
        text: '❌ ไม่สามารถแปลงเสียงเป็นข้อความได้ค่ะ\n\nกรุณาลองใหม่อีกครั้ง หรือพิมพ์ข้อความแทนค่ะ'
      };
      await lineClient.replyMessage(replyToken, replyMessage);
      return { success: false, error: 'transcription_failed' };
    }

    const transcribedText = transcriptionResult.text.trim();
    console.log(`✅ Transcribed: "${transcribedText}" (${transcriptionResult.duration}ms)`);

    // If transcribed text is empty or too short
    if (transcribedText.length < 2) {
      const replyMessage: TextMessage = {
        type: 'text',
        text: '❌ ไม่สามารถเข้าใจเสียงได้ค่ะ กรุณาพูดชัดๆ อีกครั้ง หรือพิมพ์ข้อความแทน'
      };
      await lineClient.replyMessage(replyToken, replyMessage);
      return { success: true, skipped: true, reason: 'empty_transcription' };
    }

    // Save to pending confirmations and ask user to confirm
    console.log(`💾 Saving transcription for confirmation: "${transcribedText}"`);

    // Build context for later processing
    const voiceContext = {
      userId,
      patientId,
      groupId: groupId || undefined,
      isGroupContext,
      originalAudioId: messageId
    };

    // Save pending confirmation
    const saveResult = await voiceConfirmationService.savePending(userId, transcribedText, voiceContext);

    if (!saveResult.success) {
      console.error('❌ Failed to save pending confirmation:', saveResult.error);
      // Fallback: process directly without confirmation
      console.log('⚠️ Fallback: processing directly without confirmation');
    } else {
      // Send confirmation Quick Reply
      const confirmMessage: any = {
        type: 'text',
        text: `🎤 ได้ยินว่า:\n"${transcribedText}"\n\nถูกต้องไหมคะ?`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '✅ ถูกต้อง',
                data: 'action=voice_confirm&confirm=yes',
                displayText: 'ถูกต้องค่ะ'
              }
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '❌ ไม่ถูก พิมพ์ใหม่',
                data: 'action=voice_confirm&confirm=no',
                displayText: 'ไม่ถูกต้อง'
              }
            }
          ]
        }
      };

      try {
        await lineClient.replyMessage(replyToken, confirmMessage);
        console.log('✅ Sent voice confirmation request');
        return {
          success: true,
          type: 'voice_pending_confirmation',
          transcribedText,
          pendingId: saveResult.id
        };
      } catch (sendError) {
        console.error('❌ Failed to send confirmation request:', sendError);
        // Continue to process directly as fallback
      }
    }

    // Fallback: process directly (if saving or sending confirmation failed)
    // Use users.id (UUID) for userId if available, keep LINE ID as lineUserId
    let contextUserId = userId;
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');
      const { data: u } = await sb.from('users').select('id').eq('line_user_id', userId).single();
      if (u) contextUserId = u.id;
    } catch (_) { /* keep LINE ID as fallback */ }

    let context: any = {
      userId: contextUserId,
      lineUserId: userId,
      patientId,
      source: isGroupContext ? 'group' : 'voice',
      timestamp: new Date(),
      isVoiceCommand: true,
      originalAudioId: messageId
    };

    if (isGroupContext && groupId) {
      context.groupId = groupId;

      // Get actor info
      const groupMessageResult = await groupWebhookService.handleGroupMessage(event, null);
      if (groupMessageResult.success && groupMessageResult.actorInfo) {
        context.actorLineUserId = groupMessageResult.actorInfo.userId;
        context.actorDisplayName = groupMessageResult.actorInfo.displayName;
      }
    }

    // Process voice through Unified AI (AI_CONFIG model) - same as text
    let responseText = '';
    let handled = false;

    const result = await orchestrator.process({
      id: messageId,
      content: transcribedText,
      context
    });

    // Support both Natural Conversation mode (result.data.response) and legacy mode (result.data.combined.response)
    const orchestratorResponse = result.data?.response || result.data?.combined?.response;
    if (result.success && orchestratorResponse) {
      responseText = `🎤 ได้ยินว่า: "${transcribedText}"\n\n`;
      responseText += orchestratorResponse;
      handled = true;
    }

    // Send response
    if (handled && responseText) {
      const replyMessage: TextMessage = {
        type: 'text',
        text: responseText
      };

      try {
        await lineClient.replyMessage(replyToken, replyMessage);
        console.log('✅ Voice command response sent');
      } catch (sendError) {
        console.error('❌ Failed to send voice response:', sendError);
      }
    } else {
      // Fallback response
      const replyMessage: TextMessage = {
        type: 'text',
        text: `🎤 ได้ยินว่า: "${transcribedText}"\n\nแต่ไม่เข้าใจคำสั่งค่ะ ลองพูดใหม่ หรือพิมพ์ "วิธีใช้" เพื่อดูคำสั่งทั้งหมด`
      };
      await lineClient.replyMessage(replyToken, replyMessage);
    }

    return {
      success: true,
      type: 'voice_command',
      transcribedText,
      duration: transcriptionResult.duration
    };

  } catch (error) {
    console.error('Error handling audio message:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Handle follow event (user adds bot as friend)
async function handleFollow(event: any) {
  try {
    const replyToken = event.replyToken;
    const userId = event.source?.userId || '';
    const isRedelivery = event.deliveryContext?.isRedelivery || false;

    console.log(`👋 New follower: ${userId} (redelivery: ${isRedelivery})`);

    // ✅ Check if this is a redelivery event
    if (isRedelivery) {
      console.log('⚠️ Skipping redelivery event - replyToken already used');
      return { success: true, skipped: true };
    }

    // ✅ Check if user already registered
    console.log('🔍 Checking if user is registered...');
    const checkResult = await userService.checkUserExists(userId);

    if (checkResult.exists) {
      // Already registered - check consent status
      if (checkResult.consent_accepted) {
        // Consented - send welcome back message
        console.log('✅ User already registered + consented, sending welcome back message');
        const welcomeBackMessage: TextMessage = {
          type: 'text',
          text: `สวัสดีค่ะ! ยินดีต้อนรับกลับมานะคะ 👋\n\nคุณลงทะเบียนเป็น${checkResult.role === 'caregiver' ? 'ผู้ดูแล' : 'สมาชิก'}แล้ว\nสามารถใช้งานได้ทันทีผ่านเมนูด้านล่างเลยค่ะ ✨`
        };
        await lineClient.replyMessage(replyToken, welcomeBackMessage);
        return { success: true, alreadyRegistered: true };
      } else {
        // Not yet consented - reply with consent flex immediately
        console.log('⚠️ User exists but not consented, sending consent flex');
        await lineClient.replyMessage(replyToken, createConsentFlexMessage(userId));
        return { success: true, needsConsent: true };
      }
    }

    // ✅ New user - auto-create patient (consent_accepted=false)
    console.log('📝 New user - auto-creating patient profile (no consent yet)');
    try {
      const lineProfile = await lineClient.getProfile(userId);
      await userService.autoCreatePatient(userId, lineProfile.displayName, lineProfile.pictureUrl);
      console.log('✅ Auto-created patient profile for new follower');
    } catch (autoErr) {
      console.log('⚠️ Auto-create patient failed (non-blocking):', autoErr);
    }

    // Reply with consent flex immediately — greeting card comes AFTER consent
    await lineClient.replyMessage(replyToken, createConsentFlexMessage(userId));
    console.log('✅ Consent flex sent to new user');

    return { success: true };
  } catch (error) {
    console.error('Error handling follow:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Handle unfollow event
async function handleUnfollow(event: any) {
  const userId = event.source?.userId || '';
  console.log(`👋 User unfollowed: ${userId}`);
  return { success: true };
}

// ========================================
// Group Event Handlers (TASK-002)
// ========================================

async function handleGroupJoin(event: any) {
  try {
    console.log('🎉 Bot joined group event');
    const result = await groupWebhookService.handleGroupJoin(event);

    // Send welcome message - tell caregiver to start chatting if already registered
    const replyToken = event.replyToken;
    const welcomeMessage: TextMessage = {
      type: 'text',
      text: `สวัสดีค่ะ! 👋

ขอบคุณที่เพิ่มบอท OONJAI เข้ามาในกลุ่มนะคะ

✅ ถ้าคุณลงทะเบียนผ่าน LINE OA แล้ว:
→ พิมพ์อะไรก็ได้เพื่อเชื่อมต่อกลุ่มกับสมาชิกของคุณ

❌ ถ้ายังไม่ได้ลงทะเบียน:
→ เพิ่มเพื่อน @oonjai แล้วลงทะเบียนก่อนนะคะ

━━━━━━━━━━━━━━━━━━━━
📝 วิธีใช้งานในกลุ่ม
━━━━━━━━━━━━━━━━━━━━

💬 พิมพ์คุยได้เลย ไม่ต้อง @mention

ตัวอย่างคำสั่ง:
• กินยาแล้ว
• ความดัน 120/80
• ดื่มน้ำ 500ml
• เดิน 30 นาที
• ชื่อสมาชิกอะไร
• รายงานวันนี้
• ถามอะไรได้บ้าง

📷 หรือส่งรูปเครื่องวัดความดันได้เลยค่ะ`
    };

    try {
      await lineClient.replyMessage(replyToken, welcomeMessage);
      console.log('✅ Welcome message sent');
    } catch (sendError) {
      console.error('❌ Failed to send welcome message:', sendError);
    }

    return result;
  } catch (error) {
    console.error('❌ Error in handleGroupJoin:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handleGroupLeave(event: any) {
  try {
    console.log('👋 Bot left group event');
    return await groupWebhookService.handleGroupLeave(event);
  } catch (error) {
    console.error('❌ Error in handleGroupLeave:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handleMemberJoin(event: any) {
  try {
    console.log('👥 Member joined group event');
    const result = await groupWebhookService.handleMemberJoin(event);

    // Optionally send welcome message to new members
    // (Not implemented in MVP to avoid spam)

    return result;
  } catch (error) {
    console.error('❌ Error in handleMemberJoin:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handleMemberLeave(event: any) {
  try {
    console.log('👋 Member left group event');
    return await groupWebhookService.handleMemberLeave(event);
  } catch (error) {
    console.error('❌ Error in handleMemberLeave:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handlePostback(event: any) {
  try {
    const replyToken = event.replyToken;
    const userId = event.source?.userId || '';
    const postbackData = event.postback?.data || '';

    console.log('🔘 Postback event:', postbackData);

    // Parse postback data - support both short keys (a,t,r,p,st,tt) and long keys
    const params = new URLSearchParams(postbackData);
    const action = params.get('action') || params.get('a');
    // Normalize short action codes: rc=reminder_confirm, rs=reminder_skip
    const normalizedAction = action === 'rc' ? 'reminder_confirm' : action === 'rs' ? 'reminder_skip' : action;

    // Handle reminder confirmation (medication, vitals, water, etc.)
    if (normalizedAction === 'reminder_confirm') {
      const reminderType = params.get('type') || params.get('t') || 'medication';
      const reminderId = params.get('reminder_id') || params.get('r') || '';
      const patientId = params.get('patient_id') || params.get('p') || '';
      const medicationId = params.get('medication_id') || null;
      const medicationName = decodeURIComponent(params.get('medication_name') || '');
      const scheduledTime = params.get('scheduled_time') || params.get('st') || null;
      const title = decodeURIComponent(params.get('title') || params.get('tt') || '');

      console.log(`✅ Reminder confirm: type=${reminderType}, reminder=${reminderId}, patient=${patientId}, med=${medicationId}, scheduled=${scheduledTime}`);

      try {
        const now = new Date();
        console.log(`🔍 DEBUG: About to process reminder_confirm. reminderType=${reminderType}, patientId=${patientId}, title=${title}, scheduledTime=${scheduledTime}`);

        // Convert scheduledTime (e.g., "08:00") to full timestamp for today in Bangkok timezone
        let scheduledTimestamp: string | null = null;
        if (scheduledTime && scheduledTime.match(/^\d{2}:\d{2}$/)) {
          // Get today's date in Bangkok timezone
          const todayBangkok = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
          // Create full timestamp: "2026-02-07T08:00:00+07:00"
          scheduledTimestamp = `${todayBangkok}T${scheduledTime}:00+07:00`;
          console.log(`🔍 DEBUG: Converted scheduledTime ${scheduledTime} to ${scheduledTimestamp}`);
        }

        if (reminderType === 'medication') {
          // Idempotency check: skip if already logged for this medication + scheduled_time today
          const medName = medicationName || title || 'ยา';
          let alreadyLogged = false;
          if (scheduledTimestamp) {
            const { data: existing } = await supabase.from('medication_logs')
              .select('id')
              .eq('patient_id', patientId)
              .eq('medication_name', medName)
              .eq('scheduled_time', scheduledTimestamp)
              .limit(1);
            alreadyLogged = !!(existing && existing.length > 0);
          }

          if (alreadyLogged) {
            console.log(`⏭️ Medication already logged: patient=${patientId}, med=${medName}, scheduled=${scheduledTime} — skipping duplicate`);
          } else {
            console.log(`🔍 DEBUG: Inserting medication_log...`);
            const { error: medError } = await supabase.from('medication_logs').insert({
              patient_id: patientId,
              medication_id: medicationId,
              medication_name: medName,
              taken_at: now.toISOString(),
              scheduled_time: scheduledTimestamp,
              status: 'taken',
              skipped: false,
              note: `บันทึกจากการกดปุ่มแจ้งเตือน (reminder: ${reminderId}, scheduled: ${scheduledTime})`
            });

            if (medError) {
              console.error('❌ Error logging medication:', medError);
              console.error('❌ Error details:', JSON.stringify(medError, null, 2));
            } else {
              console.log(`✅ Medication logged SUCCESS: patient=${patientId}, scheduled=${scheduledTime}, taken_at=${now.toISOString()}`);
            }
          }
        } else if (reminderType === 'water') {
          // Log water intake
          const { error: waterError } = await supabase.from('water_logs').insert({
            patient_id: patientId,
            amount_ml: 250, // Default glass of water
            timestamp: now.toISOString(),
            note: `บันทึกจากการกดปุ่มแจ้งเตือน`
          });

          if (waterError) {
            console.error('❌ Error logging water:', waterError);
          }
        } else if (reminderType === 'vitals') {
          // For vitals, acknowledge + mark reminder as done, then ask for actual values
          await supabase.from('reminder_logs').update({
            status: 'acknowledged',
            acknowledged_at: now.toISOString()
          }).eq('reminder_id', reminderId).order('sent_at', { ascending: false }).limit(1);

          await supabase.from('activity_logs').insert({
            patient_id: patientId,
            task_type: 'vitals',
            value: `${title || 'วัดความดัน'} - รอบันทึกค่าจริง`,
            timestamp: now.toISOString(),
            source: '1:1'
          });

          const replyMessage: TextMessage = {
            type: 'text',
            text: '📝 รับทราบค่ะ กรุณาพิมพ์ค่าความดันที่วัดได้นะคะ\nเช่น "ความดัน 120/80" หรือ "120/80"'
          };
          await lineClient.replyMessage(replyToken, replyMessage);
          return { success: true, type: 'reminder_vitals_pending' };
        } else if (reminderType === 'glucose') {
          // For glucose, acknowledge + mark reminder as done, then ask for actual values
          await supabase.from('reminder_logs').update({
            status: 'acknowledged',
            acknowledged_at: now.toISOString()
          }).eq('reminder_id', reminderId).order('sent_at', { ascending: false }).limit(1);

          await supabase.from('activity_logs').insert({
            patient_id: patientId,
            task_type: 'glucose',
            value: `${title || 'วัดน้ำตาล'} - รอบันทึกค่าจริง`,
            timestamp: now.toISOString(),
            source: '1:1'
          });

          const replyMessage: TextMessage = {
            type: 'text',
            text: '📝 รับทราบค่ะ กรุณาพิมพ์ค่าน้ำตาลที่วัดได้นะคะ\nเช่น "น้ำตาล 120" หรือ "glucose 120"'
          };
          await lineClient.replyMessage(replyToken, replyMessage);
          return { success: true, type: 'reminder_glucose_pending' };
        }

        // Log to activity_logs for types that don't have their own dedicated table
        // medication → medication_logs (handled above, dual-write from AI processor covers activity_logs)
        // water → water_logs (handled above, dual-write from AI processor covers activity_logs)
        // vitals/glucose → already returned above with pending message
        // Other types (exercise, food, etc.) → need activity_logs entry
        if (reminderType !== 'medication' && reminderType !== 'water') {
          await supabase.from('activity_logs').insert({
            patient_id: patientId,
            task_type: reminderType,
            value: medicationName || title || reminderType,
            timestamp: now.toISOString(),
            source: '1:1',
            metadata: {
              from_reminder: true,
              reminder_id: reminderId
            }
          });
        }

        // Update reminder_logs to mark as acknowledged
        await supabase.from('reminder_logs').update({
          status: 'acknowledged',
          acknowledged_at: now.toISOString()
        }).eq('reminder_id', reminderId).order('sent_at', { ascending: false }).limit(1);

        // Send confirmation reply
        const typeEmojis: Record<string, string> = {
          medication: '💊',
          vitals: '🩺',
          water: '💧',
          exercise: '🏃',
          food: '🍽️',
          glucose: '🩸'
        };
        const emoji = typeEmojis[reminderType] || '✅';

        const replyMessage: TextMessage = {
          type: 'text',
          text: `${emoji} บันทึกแล้วค่ะ${medicationName ? ` (${medicationName})` : ''}\nเก่งมากค่ะ! 👏`
        };
        await lineClient.replyMessage(replyToken, replyMessage);

        return { success: true, type: 'reminder_confirmed', reminderType, medicationId };

      } catch (error) {
        console.error('❌ Error processing reminder confirmation:', error);
        const replyMessage: TextMessage = {
          type: 'text',
          text: '❌ เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้งค่ะ'
        };
        await lineClient.replyMessage(replyToken, replyMessage);
        return { success: false, error: 'Failed to process reminder confirmation' };
      }
    }

    // Handle reminder skip/decline
    if (normalizedAction === 'reminder_skip') {
      const reminderType = params.get('type') || params.get('t') || 'medication';
      const reminderId = params.get('reminder_id') || params.get('r') || '';
      const patientId = params.get('patient_id') || params.get('p') || '';
      const medicationId = params.get('medication_id') || null;

      console.log(`⏰ Reminder skipped: type=${reminderType}, reminder=${reminderId}, patient=${patientId}`);

      try {
        const now = new Date();

        if (reminderType === 'medication' && patientId) {
          // Log medication skipped
          const { error: medError } = await supabase.from('medication_logs').insert({
            patient_id: patientId,
            medication_id: medicationId,
            taken_at: now.toISOString(),
            status: 'skipped',
            skipped: true,
            skipped_reason: 'ผู้ใช้กดยังไม่ได้กินยา',
            note: `บันทึกจากการกดปุ่ม "ยังไม่ได้ทำ" (reminder: ${reminderId})`
          });

          if (medError) {
            console.error('❌ Error logging skipped medication:', medError);
          }
        }

        // Update reminder_logs to mark as skipped
        await supabase.from('reminder_logs').update({
          status: 'skipped',
          acknowledged_at: now.toISOString()
        }).eq('reminder_id', reminderId).order('sent_at', { ascending: false }).limit(1);

        // Send acknowledgment reply
        const replyMessage: TextMessage = {
          type: 'text',
          text: '📝 รับทราบค่ะ ถ้าทำภายหลังแล้วอย่าลืมบันทึกด้วยนะคะ 😊'
        };
        await lineClient.replyMessage(replyToken, replyMessage);

        return { success: true, type: 'reminder_skipped', reminderType };

      } catch (error) {
        console.error('❌ Error processing reminder skip:', error);
        return { success: false, error: 'Failed to process reminder skip' };
      }
    }

    // Handle voice confirmation
    if (action === 'voice_confirm') {
      const confirm = params.get('confirm');
      console.log(`🎤 Voice confirmation: ${confirm} from ${userId}`);

      if (confirm === 'yes') {
        // User confirmed - process the transcribed text
        const pending = await voiceConfirmationService.confirm(userId);

        if (!pending) {
          const replyMessage: TextMessage = {
            type: 'text',
            text: '⏱️ หมดเวลายืนยันแล้วค่ะ กรุณาส่งเสียงใหม่อีกครั้ง'
          };
          await lineClient.replyMessage(replyToken, replyMessage);
          return { success: true, expired: true };
        }

        // Process the confirmed text
        console.log(`✅ Processing confirmed text: "${pending.transcribed_text}"`);

        const context: any = {
          userId: pending.context?.userId || userId,
          lineUserId: userId,
          patientId: pending.patient_id,
          source: pending.context?.isGroupContext ? 'group' : 'voice',
          timestamp: new Date(),
          isVoiceCommand: true,
          confirmedVoice: true
        };

        if (pending.context?.groupId) {
          context.groupId = pending.context.groupId;
        }

        // Process through Unified AI (AI_CONFIG model) - same as text
        let responseText = '';
        let handled = false;

        const result = await orchestrator.process({
          id: `voice-${Date.now()}`,
          content: pending.transcribed_text,
          context
        });

        // Support both Natural Conversation mode and legacy mode
        const orchestratorResponse = result.data?.response || result.data?.combined?.response;
        if (result.success && orchestratorResponse) {
          responseText = orchestratorResponse;
          handled = true;
        }

        // Send response
        if (handled && responseText) {
          const replyMessage: TextMessage = {
            type: 'text',
            text: responseText
          };
          await lineClient.replyMessage(replyToken, replyMessage);
          console.log('✅ Voice command processed after confirmation');
        } else {
          const replyMessage: TextMessage = {
            type: 'text',
            text: 'ไม่เข้าใจคำสั่งค่ะ กรุณาลองใหม่หรือพิมพ์ข้อความแทน'
          };
          await lineClient.replyMessage(replyToken, replyMessage);
        }

        return { success: true, type: 'voice_confirmed', handled };
      } else if (confirm === 'no') {
        // User rejected - ask them to type instead
        await voiceConfirmationService.reject(userId);

        const replyMessage: TextMessage = {
          type: 'text',
          text: '📝 ได้ค่ะ กรุณาพิมพ์ข้อความที่ถูกต้องแทนนะคะ'
        };
        await lineClient.replyMessage(replyToken, replyMessage);

        return { success: true, type: 'voice_rejected' };
      }
    }

    // Delegate to group webhook service for other postbacks
    return await groupWebhookService.handlePostback(event);
  } catch (error) {
    console.error('❌ Error in handlePostback:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Test endpoint
app.post('/test', async (req, res) => {
  try {
    await initializeIfNeeded();

    const result = await orchestrator.process({
      id: 'test-' + Date.now(),
      content: req.body.message,
      context: {
        userId: 'test-user',
        patientId: 'test-patient',
        source: 'api',
        timestamp: new Date()
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test scheduler notification
app.post('/test/scheduler-notification', async (req, res) => {
  try {
    const { groupId, message } = req.body;

    if (!groupId || !message) {
      return res.status(400).json({ error: 'groupId and message are required' });
    }

    await lineClient.pushMessage(groupId, {
      type: 'text',
      text: message
    });

    res.json({ success: true, message: 'Notification sent to group' });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'OONJAI Multi-Agent System',
    initialized
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`📡 Server running on port ${PORT}`);
    initializeIfNeeded();

    // Start scheduler for reminders
    schedulerService.start();
  });
}

// Export for Vercel serverless
export default app;