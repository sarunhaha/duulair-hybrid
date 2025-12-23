// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Client, WebhookEvent, TextMessage, FlexMessage, validateSignature } from '@line/bot-sdk';
import { OrchestratorAgent } from './agents';
import registrationRoutes from './routes/registration.routes';
import groupRoutes from './routes/group.routes';
import reportRoutes from './routes/report.routes';
import { groupWebhookService } from './services/group-webhook.service';
import { commandHandlerService } from './services/command-handler.service';
import { userService } from './services/user.service';
import { groupService } from './services/group.service';
import { supabaseService } from './services/supabase.service';
import { schedulerService } from './services/scheduler.service';
import crypto from 'crypto';
import multer from 'multer';
import { openRouterService, OPENROUTER_MODELS } from './services/openrouter.service';
import { runHealthExtractionPipeline, hasHealthData } from './lib/ai';
import { groqService } from './services/groq.service';
import { voiceConfirmationService } from './services/voice-confirmation.service';

dotenv.config();

// LINE Bot configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const lineClient = new Client(lineConfig);
const LIFF_ID = process.env.LIFF_ID || '';

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

// Create Flex Message for registration
function createRegistrationFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'ลงทะเบียนใช้งาน OONJAI',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ลงทะเบียนใช้งาน',
            weight: 'bold',
            size: 'xl',
            color: '#4CAF50'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'text',
                text: 'ยินดีต้อนรับสู่ OONJAI',
                size: 'md',
                color: '#555555',
                wrap: true
              },
              {
                type: 'text',
                text: 'ระบบดูแลสุขภาพผู้สูงอายุ',
                size: 'sm',
                color: '#999999',
                margin: 'md',
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
                    color: '#555555',
                    weight: 'bold'
                  },
                  {
                    type: 'text',
                    text: '• ผู้ป่วย - บันทึกข้อมูลสุขภาพตัวเอง',
                    size: 'xs',
                    color: '#666666',
                    margin: 'sm',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: '• ผู้ดูแล - ติดตามดูแลคนในครอบครัว',
                    size: 'xs',
                    color: '#666666',
                    margin: 'xs',
                    wrap: true
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
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#4CAF50',
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

// Flex Message for Package Info
function createPackageFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'แพ็กเกจบริการ OONJAI',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'แพ็กเกจบริการ',
            weight: 'bold',
            size: 'xl',
            color: '#4CAF50'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✨ Free Plan (ฟรี)',
            weight: 'bold',
            size: 'lg',
            color: '#4CAF50'
          },
          {
            type: 'text',
            text: '• บันทึกข้อมูลสุขภาพ\n• รายงานประจำวัน\n• เชื่อมต่อผู้ดูแล 1 คน',
            wrap: true,
            size: 'sm',
            color: '#666666',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '🌟 Premium Plan (เร็วๆ นี้)',
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
            color: '#666666',
            margin: 'md'
          }
        ]
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
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'วิธีใช้งาน OONJAI',
            weight: 'bold',
            size: 'xl',
            color: '#4CAF50'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📝 การเริ่มต้น',
            weight: 'bold',
            size: 'md'
          },
          {
            type: 'text',
            text: '1. ลงทะเบียน (ผู้ป่วย/ผู้ดูแล)\n2. กรอกข้อมูลสุขภาพ\n3. เริ่มบันทึกข้อมูล',
            wrap: true,
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '💊 การบันทึกข้อมูล',
            weight: 'bold',
            size: 'md',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '• พิมพ์ "กินยาแล้ว"\n• พิมพ์ "วัดความดัน 120/80"\n• พิมพ์ "ดื่มน้ำ 500 ml"\n• พิมพ์ "เดินแล้ว 30 นาที"',
            wrap: true,
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '🆘 กรณีฉุกเฉิน',
            weight: 'bold',
            size: 'md',
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'พิมพ์ "ฉุกเฉิน" ระบบจะแจ้งผู้ดูแลทันที',
            wrap: true,
            size: 'sm',
            color: '#F44336',
            margin: 'sm'
          }
        ]
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
            color: '#4CAF50'
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
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📊 รายงานการดูแล',
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF'
          },
          {
            type: 'text',
            text: 'สรุปกิจกรรมด้านสุขภาพ',
            size: 'sm',
            color: '#FFFFFF',
            margin: 'sm'
          }
        ],
        backgroundColor: '#7EE081',
        paddingAll: 'lg'
      },
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
            color: '#666666'
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
                text: '📊 รายงานจะประกอบด้วย:',
                size: 'sm',
                weight: 'bold',
                color: '#333333'
              },
              {
                type: 'text',
                text: '• 💊 การรับประทานยา',
                size: 'sm',
                color: '#666666',
                margin: 'sm'
              },
              {
                type: 'text',
                text: '• ❤️ การตรวจวัดสัญญาณชีพ',
                size: 'sm',
                color: '#666666'
              },
              {
                type: 'text',
                text: '• 💧 การดื่มน้ำ',
                size: 'sm',
                color: '#666666'
              },
              {
                type: 'text',
                text: '• 🏃 การออกกำลังกาย',
                size: 'sm',
                color: '#666666'
              },
              {
                type: 'text',
                text: '• 🍽️ การรับประทานอาหาร',
                size: 'sm',
                color: '#666666'
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
              label: '📅 รายงานวันนี้',
              text: 'รายงานวันนี้'
            },
            style: 'primary',
            color: '#7EE081',
            height: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📆 รายงานสัปดาห์นี้',
              text: 'รายงานสัปดาห์'
            },
            style: 'primary',
            color: '#62A87C',
            height: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '🗓️ รายงานเดือนนี้',
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

// Flex Message for Health Logging Menu (บันทึกสุขภาพ)
function createHealthLogMenuFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: '🩺 บันทึกสุขภาพวันนี้',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#E74C3C',
        paddingAll: 'xl',
        contents: [
          {
            type: 'text',
            text: '🩺 บันทึกสุขภาพวันนี้',
            weight: 'bold',
            size: 'xl',
            color: '#ffffff'
          },
          {
            type: 'text',
            text: 'เลือกสิ่งที่ต้องการบันทึก หรือพิมพ์บอกได้เลย',
            size: 'sm',
            color: '#ffffff',
            margin: 'sm',
            wrap: true
          }
        ]
      },
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
            text: '💡 หรือพิมพ์ตรงๆ ได้เลย เช่น "ความดัน 120/80"',
            size: 'xs',
            color: '#9CA3AF',
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

    console.log(`📷 OCR vitals request - file size: ${req.file.size} bytes`);

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

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
      { model: OPENROUTER_MODELS.CLAUDE_SONNET_4_5 }
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
      userId,
      source: 'line',
      timestamp: new Date()
    };

    // For 1:1 chat, try to get patientId from caregiver's linked_patient_id
    if (!isGroup) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_KEY || ''
        );
        const { data: caregiver } = await supabase
          .from('caregivers')
          .select('linked_patient_id')
          .eq('line_user_id', userId)
          .single();

        if (caregiver?.linked_patient_id) {
          context.patientId = caregiver.linked_patient_id;
          console.log(`👤 1:1 chat - found linked patient: ${context.patientId}`);
        }
      } catch (err) {
        console.log('ℹ️ Could not fetch caregiver info for 1:1 chat');
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
    // Skip extraction pipeline for menu requests - go directly to orchestrator
    const menuPatterns = [
      /^บันทึกสุขภาพ$/i,
      /^รายงานสุขภาพ$/i,
      /^ดูรายงาน$/i,
      /^รายงาน$/i
    ];
    const isMenuRequest = menuPatterns.some(pattern => pattern.test(originalMessage.trim()));

    if (isMenuRequest) {
      console.log('📋 Menu request detected, skipping extraction pipeline');
      // Fall through to orchestrator
    }

    // ============================================
    // Phase 4: AI Health Extraction Pipeline
    // ============================================
    // Try to extract health data from message first
    // If extraction succeeds with health data, use extraction response
    // Otherwise, fall back to orchestrator for general dialog

    if (context.patientId && !isMenuRequest) {
      try {
        console.log('🧠 Running health extraction pipeline...');

        const extractionResult = await runHealthExtractionPipeline(originalMessage, {
          patientId: context.patientId,
          groupId: context.groupId,
          lineUserId: context.actorLineUserId || userId,
          displayName: context.actorDisplayName
        });

        if (extractionResult.success && extractionResult.hasHealthData) {
          console.log('✅ Health data extracted:', {
            hasHealthData: extractionResult.hasHealthData,
            alerts: extractionResult.alerts,
            savedRecords: extractionResult.processorResult?.savedRecords?.length || 0
          });

          // Build response message
          let responseText = extractionResult.responseMessage || 'บันทึกข้อมูลสุขภาพแล้วค่ะ';

          // Add alerts if any
          if (extractionResult.alerts && extractionResult.alerts.length > 0) {
            responseText += `\n\n⚠️ ${extractionResult.alerts.join('\n')}`;
          }

          // Add followup question if any
          if (extractionResult.followupQuestion) {
            responseText += `\n\n${extractionResult.followupQuestion}`;
          }

          const replyMessage: TextMessage = {
            type: 'text',
            text: responseText
          };

          try {
            await lineClient.replyMessage(replyToken, replyMessage);
            console.log('✅ Extraction response sent:', responseText.substring(0, 50) + '...');
            return {
              success: true,
              extractionHandled: true,
              conversationLogId: extractionResult.conversationLogId
            };
          } catch (sendError) {
            console.error('❌ Failed to send extraction response:', sendError);
            // Continue to orchestrator as fallback
          }
        } else {
          console.log('ℹ️ No health data extracted, falling back to orchestrator');
        }
      } catch (extractionError) {
        console.error('❌ Extraction pipeline error:', extractionError);
        // Continue to orchestrator as fallback
      }
    }

    // ============================================
    // Process with orchestrator (fallback)
    // ============================================
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
          text = result.data.response || '👥 กลุ่มนี้มีหลายผู้ป่วย กรุณาเลือกผู้ป่วยที่ต้องการบันทึก:';
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
        // Check if user is already registered before showing registration flex
        // In group: if groupContext exists, user is already a member
        // In 1:1: check if user exists in caregivers table
        const isInGroup = context.source === 'group' && context.groupId;
        let isAlreadyRegistered = false;

        if (isInGroup) {
          // If we're in a registered group, user is already a member
          isAlreadyRegistered = !!context.patientId;
        } else {
          // 1:1 chat - check if user is registered caregiver
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_KEY || ''
          );
          const { data: caregiver } = await supabase
            .from('caregivers')
            .select('id')
            .eq('line_user_id', userId)
            .single();
          isAlreadyRegistered = !!caregiver;
        }

        if (isAlreadyRegistered) {
          // User is already registered - send confirmation message instead
          const alreadyRegisteredMessage: TextMessage = {
            type: 'text',
            text: `✅ คุณลงทะเบียนแล้วค่ะ!\n\n${isInGroup ? 'สามารถใช้งานในกลุ่มนี้ได้เลย พิมพ์ "วิธีใช้" เพื่อดูคำสั่งทั้งหมดค่ะ' : 'กดเมนูด้านล่างเพื่อใช้งานได้เลยค่ะ'}`
          };
          try {
            await lineClient.replyMessage(replyToken, alreadyRegisteredMessage);
            console.log('✅ Already registered message sent');
            return result;
          } catch (sendError) {
            console.error('❌ Failed to send already registered message:', sendError);
          }
        } else {
          flexMessage = createRegistrationFlexMessage();
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

    // Check user registration
    const userCheck = await userService.checkUserExists(userId);
    if (!userCheck.exists || userCheck.role !== 'caregiver') {
      const replyMessage: TextMessage = {
        type: 'text',
        text: 'กรุณาลงทะเบียนก่อนใช้งานค่ะ'
      };
      await lineClient.replyMessage(replyToken, replyMessage);
      return { success: true, skipped: true, reason: 'not_registered' };
    }

    // Get patient ID (snake_case from user.service.ts)
    let patientId = (userCheck.profile as any)?.linked_patient_id;
    if (!patientId) {
      const replyMessage: TextMessage = {
        type: 'text',
        text: 'ไม่พบข้อมูลผู้ป่วยที่เชื่อมต่อ กรุณาลงทะเบียนผู้ป่วยก่อนค่ะ'
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
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg'; // LINE images are usually JPEG

    console.log(`📷 Image size: ${imageBuffer.length} bytes`);

    // Use Claude Vision via OpenRouter to read blood pressure from image
    const ocrPrompt = `อ่านค่าความดันโลหิตจากรูปนี้

ถ้าเห็นค่าความดัน ให้ตอบในรูปแบบ JSON:
{"systolic": 120, "diastolic": 80, "pulse": 70}

ถ้าไม่เห็นค่าความดัน หรือรูปไม่ใช่เครื่องวัดความดัน ให้ตอบ:
{"error": "ไม่พบค่าความดันในรูป"}

ตอบเฉพาะ JSON เท่านั้น`;

    const visionResult = await openRouterService.analyzeBase64Image(
      base64Image,
      mimeType,
      ocrPrompt,
      { model: OPENROUTER_MODELS.CLAUDE_SONNET_4_5 }
    );
    console.log('📷 Vision result:', visionResult);

    let responseText = '';

    try {
      const parsed = JSON.parse(visionResult);

      if (parsed.error) {
        responseText = `❌ ${parsed.error}\n\nกรุณาส่งรูปเครื่องวัดความดันที่เห็นตัวเลขชัดเจนค่ะ`;
      } else if (parsed.systolic && parsed.diastolic) {
        // Save to database
        const logData: any = {
          patient_id: patientId,
          task_type: 'vitals',
          value: `${parsed.systolic}/${parsed.diastolic}`,
          metadata: {
            systolic: parsed.systolic,
            diastolic: parsed.diastolic,
            pulse: parsed.pulse || null,
            source: 'image_ocr',
            valid: true
          },
          timestamp: new Date(),
          source: isGroupContext ? 'group' : '1:1',
          group_id: groupId,
          actor_line_user_id: userId
        };

        await supabaseService.saveActivityLog(logData);

        responseText = `✅ บันทึกความดัน ${parsed.systolic}/${parsed.diastolic} เรียบร้อยแล้วค่ะ`;

        if (parsed.pulse) {
          responseText += `\nชีพจร: ${parsed.pulse} ครั้ง/นาที`;
        }

        // Check for alerts
        if (parsed.systolic > 140 || parsed.diastolic > 90) {
          responseText += '\n\n⚠️ ความดันสูงกว่าปกติ กรุณาติดตามอาการและปรึกษาแพทย์';
        } else if (parsed.systolic < 90 || parsed.diastolic < 60) {
          responseText += '\n\n⚠️ ความดันต่ำกว่าปกติ กรุณาติดตามอาการ';
        }
      } else {
        responseText = '❌ ไม่สามารถอ่านค่าความดันจากรูปได้\n\nกรุณาส่งรูปที่เห็นตัวเลขชัดเจนค่ะ';
      }
    } catch (e) {
      responseText = '❌ ไม่สามารถอ่านค่าความดันจากรูปได้\n\nกรุณาส่งรูปเครื่องวัดความดันที่เห็นตัวเลขชัดเจนค่ะ';
    }

    const replyMessage: TextMessage = {
      type: 'text',
      text: responseText
    };
    await lineClient.replyMessage(replyToken, replyMessage);

    return { success: true, type: 'image_ocr' };

  } catch (error) {
    console.error('Error handling image message:', error);
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

    // Skip redelivery events
    if (isRedelivery) {
      console.log('⏭️ Skipping redelivery event for audio');
      return { success: true, skipped: true, reason: 'redelivery' };
    }

    // Check user registration
    const userCheck = await userService.checkUserExists(userId);
    if (!userCheck.exists || userCheck.role !== 'caregiver') {
      const replyMessage: TextMessage = {
        type: 'text',
        text: 'กรุณาลงทะเบียนก่อนใช้งานค่ะ พิมพ์ "ลงทะเบียน" เพื่อเริ่มต้น'
      };
      await lineClient.replyMessage(replyToken, replyMessage);
      return { success: true, skipped: true, reason: 'not_registered' };
    }

    // Get patient ID (snake_case from user.service.ts)
    let patientId = (userCheck.profile as any)?.linked_patient_id;

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
        text: 'ไม่พบข้อมูลผู้ป่วยที่เชื่อมต่อ กรุณาลงทะเบียนผู้ป่วยก่อนค่ะ'
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

    // Transcribe audio using Groq Whisper
    console.log('🧠 Transcribing with Groq Whisper...');
    const transcriptionResult = await groqService.transcribeAudio(
      audioBuffer,
      'audio.m4a',  // LINE audio is typically M4A
      {
        language: 'th',
        prompt: 'บันทึกสุขภาพ ยา ความดัน น้ำหนัก กินยา ดื่มน้ำ ออกกำลังกาย เตือน แจ้งเตือน'
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
    let context: any = {
      userId,
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

    // Try health extraction first (like handleTextMessage does)
    let responseText = '';
    let handled = false;

    if (patientId) {
      try {
        console.log('🧠 Running health extraction on transcribed text...');
        const extractionResult = await runHealthExtractionPipeline(transcribedText, {
          patientId,
          groupId: context.groupId,
          lineUserId: context.actorLineUserId || userId,
          displayName: context.actorDisplayName
        });

        if (extractionResult.success && extractionResult.hasHealthData) {
          responseText = `🎤 ได้ยินว่า: "${transcribedText}"\n\n`;
          responseText += extractionResult.responseMessage || 'บันทึกข้อมูลสุขภาพแล้วค่ะ';

          if (extractionResult.alerts && extractionResult.alerts.length > 0) {
            responseText += `\n\n⚠️ ${extractionResult.alerts.join('\n')}`;
          }

          handled = true;
        }
      } catch (extractionError) {
        console.error('❌ Extraction error for voice:', extractionError);
      }
    }

    // If not handled by extraction, use orchestrator
    if (!handled) {
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
      // Already registered - send welcome back message
      console.log('✅ User already registered, sending welcome back message');
      const welcomeBackMessage: TextMessage = {
        type: 'text',
        text: `สวัสดีค่ะ! ยินดีต้อนรับกลับมานะคะ 👋\n\nคุณลงทะเบียนเป็น${checkResult.role === 'caregiver' ? 'ผู้ดูแล' : 'ผู้ป่วย'}แล้ว\nสามารถใช้งานได้ทันทีผ่านเมนูด้านล่างเลยค่ะ ✨`
      };
      await lineClient.replyMessage(replyToken, welcomeBackMessage);
      return { success: true, alreadyRegistered: true };
    }

    // ✅ New user - send registration link
    console.log('📝 New user - sending registration link');
    const registrationUrl = `https://liff.line.me/${LIFF_ID}/registration.html`;

    const welcomeMessage: FlexMessage = {
      type: 'flex',
      altText: 'ยินดีต้อนรับสู่ OONJAI - กรุณาลงทะเบียน',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '👋 สวัสดีค่ะ!',
              weight: 'bold',
              size: 'xl',
              color: '#2E7D32'
            },
            {
              type: 'text',
              text: 'ยินดีต้อนรับสู่ OONJAI',
              size: 'lg',
              color: '#424242',
              margin: 'md'
            },
            {
              type: 'text',
              text: 'ระบบดูแลสุขภาพผู้สูงอายุ',
              size: 'sm',
              color: '#757575',
              wrap: true
            },
            {
              type: 'separator',
              margin: 'xl'
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'xl',
              spacing: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '📋 กรุณาลงทะเบียนก่อนใช้งาน',
                  color: '#424242',
                  size: 'md',
                  weight: 'bold'
                },
                {
                  type: 'text',
                  text: 'กรอกข้อมูลเพียง 1 ครั้ง:\n• ข้อมูลผู้ดูแล (คุณ)\n• ข้อมูลผู้ป่วย (ผู้ที่คุณดูแล)',
                  color: '#757575',
                  size: 'sm',
                  wrap: true,
                  margin: 'md'
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              color: '#4CAF50',
              action: {
                type: 'uri',
                label: '📝 ลงทะเบียนเลย',
                uri: registrationUrl
              }
            },
            {
              type: 'box',
              layout: 'baseline',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: '⏱️ ใช้เวลาไม่ถึง 2 นาที',
                  color: '#999999',
                  size: 'xs',
                  flex: 0
                }
              ]
            }
          ]
        }
      }
    };

    await lineClient.replyMessage(replyToken, welcomeMessage);
    console.log('✅ Registration link sent');

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
→ พิมพ์อะไรก็ได้เพื่อเชื่อมต่อกลุ่มกับผู้ป่วยของคุณ

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
• ชื่อผู้ป่วยอะไร
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

    // Parse postback data
    const params = new URLSearchParams(postbackData);
    const action = params.get('action');

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
          patientId: pending.patient_id,
          source: pending.context?.isGroupContext ? 'group' : 'voice',
          timestamp: new Date(),
          isVoiceCommand: true,
          confirmedVoice: true
        };

        if (pending.context?.groupId) {
          context.groupId = pending.context.groupId;
        }

        // Try health extraction first
        let responseText = '';
        let handled = false;

        if (pending.patient_id) {
          try {
            const extractionResult = await runHealthExtractionPipeline(pending.transcribed_text, {
              patientId: pending.patient_id,
              groupId: context.groupId,
              lineUserId: userId,
              displayName: undefined
            });

            if (extractionResult.success && extractionResult.hasHealthData) {
              responseText = extractionResult.responseMessage || 'บันทึกข้อมูลสุขภาพแล้วค่ะ';
              if (extractionResult.alerts && extractionResult.alerts.length > 0) {
                responseText += `\n\n⚠️ ${extractionResult.alerts.join('\n')}`;
              }
              handled = true;
            }
          } catch (extractionError) {
            console.error('❌ Extraction error:', extractionError);
          }
        }

        // If not handled by extraction, use orchestrator
        if (!handled) {
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