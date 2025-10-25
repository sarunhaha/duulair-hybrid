// src/index.ts
import express from 'express';
import dotenv from 'dotenv';
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
                flex: 0,
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
            height: 'sm',
            color: '#4CAF50',
            action: {
              type: 'uri',
              label: 'เริ่มลงทะเบียน',
              uri: `https://liff.line.me/${LIFF_ID}`
            }
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [],
            margin: 'sm'
          }
        ],
        flex: 0
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
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
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

    // Check if this is a registration intent
    const intent = result.metadata?.intent;

    if (intent === 'registration') {
      // Send Flex Message for registration
      const flexMessage = createRegistrationFlexMessage();
      await lineClient.replyMessage(replyToken, flexMessage);
      console.log('✅ Flex Message sent for registration');
    } else {
      // Send normal text reply
      const responseText = result.data?.combined?.response;
      if (result.success && responseText) {
        const replyMessage: TextMessage = {
          type: 'text',
          text: responseText
        };

        await lineClient.replyMessage(replyToken, replyMessage);
        console.log('✅ Reply sent to LINE:', responseText);
      } else {
        console.log('⚠️ No response to send:', { success: result.success, hasResponse: !!responseText });
      }
    }

    return result;
  } catch (error) {
    console.error('Error handling text message:', error);
    throw error;
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
    throw error;
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