// src/index.ts
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { Client, WebhookEvent, TextMessage, FlexMessage, validateSignature } from '@line/bot-sdk';
import { OrchestratorAgent } from './agents';
import registrationRoutes from './routes/registration.routes';
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

    console.log(`📨 Message from ${userId}: ${message.text}`);

    // Process with orchestrator
    const result = await orchestrator.process({
      id: message.id,
      content: message.text,
      context: {
        userId,
        source: 'line',
        timestamp: new Date()
      }
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

    console.log(`👋 New follower: ${userId}`);

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