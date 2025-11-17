// src/index.ts
import express from 'express';
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
import crypto from 'crypto';

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

// Create Flex Message for registration
function createRegistrationFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'ลงทะเบียนใช้งาน Duulair',
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
                text: 'ยินดีต้อนรับสู่ Duulair',
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
    altText: 'แพ็กเกจบริการ Duulair',
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
            text: 'วิธีใช้งาน Duulair',
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

// Initialize orchestrator (once)
let initialized = false;
async function initializeIfNeeded() {
  if (!initialized) {
    console.log('🚀 Initializing Duulair Multi-Agent System...');
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
 * GET /api/check-user
 * Check if user is registered (for first-time user detection)
 */
app.get('/api/check-user', async (req, res) => {
  try {
    const { lineUserId } = req.query;

    if (!lineUserId || typeof lineUserId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'lineUserId is required'
      });
    }

    console.log(`🔍 Checking user registration: ${lineUserId}`);

    const result = await userService.checkUserExists(lineUserId);

    res.json({
      isRegistered: result.exists,
      userId: result.profile?.id || null,
      role: result.role || null
    });
  } catch (error: any) {
    console.error('❌ Check user error:', error);
    res.status(500).json({
      success: false,
      isRegistered: false,
      error: error.message || 'Failed to check user'
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
      conditions: patient.conditions || null,
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

    // Detect group vs 1:1 context
    const isGroup = sourceType === 'group' && groupId;

    let context: any = {
      userId,
      source: 'line',
      timestamp: new Date()
    };

    // Handle group messages (TASK-002)
    if (isGroup) {
      console.log(`👥 Group message detected in group: ${groupId}`);

      // Get group context
      const groupContext = await groupWebhookService.getGroupContext(groupId);

      if (!groupContext) {
        console.log('⏭️ Group not registered, ignoring message');
        return { success: true, skipped: true, reason: 'group_not_registered' };
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
    }

    // Check if message is a command (TASK-002 Phase 4)
    if (commandHandlerService.isCommand(message.text)) {
      console.log('🎯 Command detected:', message.text);

      const commandResponse = await commandHandlerService.handleCommand(message.text, context);

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

    // Process with orchestrator
    const result = await orchestrator.process({
      id: message.id,
      content: message.text,
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

      if (flexMessageType === 'registration') {
        flexMessage = createRegistrationFlexMessage();
      } else if (flexMessageType === 'package') {
        flexMessage = createPackageFlexMessage();
      } else if (flexMessageType === 'help') {
        flexMessage = createHelpFlexMessage();
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
    const responseText = result.data?.combined?.response;
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

    const welcomeMessage: TextMessage = {
      type: 'text',
      text: 'สวัสดีค่ะ! ยินดีต้อนรับสู่ Duulair ระบบดูแลสุขภาพผู้สูงอายุ 🏥\n\nคุณสามารถบันทึกข้อมูลสุขภาพได้ทันที เช่น:\n💊 บันทึกการกินยา\n💧 บันทึกการดื่มน้ำ\n🩺 วัดความดันโลหิต\n🚶 บันทึกการเดิน\n\nเริ่มต้นได้เลยค่ะ!'
    };

    await lineClient.replyMessage(replyToken, welcomeMessage);
    console.log('✅ Welcome message sent');

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

    // Send welcome message with registration link
    const replyToken = event.replyToken;
    const welcomeMessage: TextMessage = {
      type: 'text',
      text: `สวัสดีค่ะ! 👋

ขอบคุณที่เพิ่มบอท Duulair เข้ามาในกลุ่มนะคะ

🎯 ขั้นตอนต่อไป:
1. ลงทะเบียนกลุ่มและข้อมูลผู้ป่วย
2. เริ่มบันทึกกิจกรรมดูแลสุขภาพ
3. ดูรายงานสุขภาพรายวัน/รายสัปดาห์

กรุณากดลงทะเบียนเพื่อเริ่มใช้งาน 👇
https://liff.line.me/${LIFF_ID}/group-registration.html`
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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Duulair Multi-Agent System',
    initialized
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`📡 Server running on port ${PORT}`);
    initializeIfNeeded();
  });
}

// Export for Vercel serverless
export default app;