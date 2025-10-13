// src/index.ts
import express from 'express';
import dotenv from 'dotenv';
import { OrchestratorAgent } from './agents';

dotenv.config();

const app = express();
const orchestrator = new OrchestratorAgent();

app.use(express.json());

// Initialize
async function start() {
  console.log('🚀 Starting Duulair Multi-Agent System...');
  
  const initialized = await orchestrator.initialize();
  
  if (!initialized) {
    console.error('❌ Failed to initialize agents');
    process.exit(1);
  }
  
  console.log('✅ All agents ready!');
  
  // API Endpoints
  app.post('/webhook', async (req, res) => {
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
  });

  // Test endpoint
  app.post('/test', async (req, res) => {
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
  });

  app.listen(process.env.PORT || 3000, () => {
    console.log(`📡 Server running on port ${process.env.PORT || 3000}`);
  });
}

start().catch(console.error);