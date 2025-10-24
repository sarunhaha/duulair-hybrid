// src/index.ts
import express from 'express';
import dotenv from 'dotenv';
import { OrchestratorAgent } from './agents';
import registrationRoutes from './routes/registration.routes';

dotenv.config();

const app = express();
const orchestrator = new OrchestratorAgent();

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

app.use(express.json());

// Registration API routes
app.use('/api/registration', registrationRoutes);

// API Endpoints
app.post('/webhook', async (req, res) => {
  try {
    await initializeIfNeeded();

    const { events } = req.body;

    for (const event of events) {
      if (event.type === 'message') {
        const result = await orchestrator.process({
          id: event.message.id,
          content: event.message.text,
          context: {
            userId: event.source.userId,
            source: 'line',
            timestamp: new Date()
          }
        });

        console.log('Result:', result);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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