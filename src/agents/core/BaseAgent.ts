// src/agents/core/BaseAgent.ts
import { Anthropic } from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../services/supabase.service';

// Schema definitions using Zod
const ConfigSchema = z.object({
  name: z.string(),
  role: z.string(),
  model: z.string().default('claude-3-haiku-20240307'),
  temperature: z.number().default(0.7),
  maxTokens: z.number().default(1000),
  capabilities: z.array(z.string()).optional()
});

const MessageSchema = z.object({
  id: z.string().default(() => uuidv4()),
  content: z.string(),
  context: z.object({
    userId: z.string().optional(),
    patientId: z.string().optional(),
    sessionId: z.string().optional(),
    timestamp: z.date().default(() => new Date()),
    source: z.enum(['line', 'api', 'n8n', 'system'])
  }),
  metadata: z.record(z.any()).optional()
});

const ResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  agentName: z.string(),
  processingTime: z.number(),
  metadata: z.record(z.any()).optional()
});

export type Config = z.infer<typeof ConfigSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Response = z.infer<typeof ResponseSchema>;

// Trait interfaces
interface Observable {
  getMetrics(): Promise<any>;
  getHealth(): Promise<any>;
  getLogs(limit?: number): Promise<any[]>;
}

interface Stateful {
  saveState(): Promise<void>;
  loadState(): Promise<void>;
  clearState(): Promise<void>;
}

interface Collaborative {
  communicate(targetAgent: string, message: Message): Promise<Response>;
  delegate(task: string, data: any): Promise<Response>;
  coordinate(agents: string[], task: string): Promise<Response[]>;
}

// Base Agent Class
export abstract class BaseAgent extends EventEmitter implements Observable, Stateful, Collaborative {
  protected config: Config;
  protected anthropic: Anthropic;
  protected supabase: SupabaseService;
  protected state: Map<string, any>;
  protected metrics: {
    processed: number;
    errors: number;
    avgProcessingTime: number;
  };
  private logs: any[];

  constructor(config: Config) {
    super();
    this.config = ConfigSchema.parse(config);
    this.state = new Map();
    this.logs = [];
    this.metrics = {
      processed: 0,
      errors: 0,
      avgProcessingTime: 0
    };

    // Initialize services
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
    
    this.supabase = new SupabaseService();
  }

  // Abstract methods that must be implemented
  abstract initialize(): Promise<boolean>;
  abstract process(message: Message): Promise<Response>;
  abstract getCapabilities(): string[];

  // Observable trait implementation
  async getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  async getHealth() {
    return {
      status: 'healthy',
      agent: this.config.name,
      timestamp: new Date()
    };
  }

  async getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  // Stateful trait implementation
  async saveState() {
    const stateData = {
      agentName: this.config.name,
      state: Object.fromEntries(this.state),
      metrics: this.metrics,
      timestamp: new Date()
    };
    
    await this.supabase.saveAgentState(this.config.name, stateData);
  }

  async loadState() {
    const stateData = await this.supabase.loadAgentState(this.config.name);
    if (stateData) {
      this.state = new Map(Object.entries(stateData.state));
      this.metrics = stateData.metrics;
    }
  }

  async clearState() {
    this.state.clear();
    this.metrics = {
      processed: 0,
      errors: 0,
      avgProcessingTime: 0
    };
  }

  // Collaborative trait implementation
  async communicate(targetAgent: string, message: Message): Promise<Response> {
    // Inter-agent communication via event bus or direct call
    this.emit('agent:communicate', { target: targetAgent, message });
    return {
      success: true,
      agentName: this.config.name,
      processingTime: 0,
      data: { sent: true }
    };
  }

  async delegate(task: string, data: any): Promise<Response> {
    // Delegate task to another agent
    this.emit('agent:delegate', { task, data });
    return {
      success: true,
      agentName: this.config.name,
      processingTime: 0,
      data: { delegated: true }
    };
  }

  async coordinate(agents: string[], task: string): Promise<Response[]> {
    // Coordinate multiple agents
    const responses = [];
    for (const agent of agents) {
      const response = await this.communicate(agent, {
        id: uuidv4(),
        content: task,
        context: {
          source: 'system',
          timestamp: new Date()
        }
      });
      responses.push(response);
    }
    return responses;
  }

  // Helper methods
  protected async askClaude(prompt: string, system?: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: system,
        messages: [{ role: 'user', content: prompt }]
      });

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);

      if (response.content[0].type === 'text') {
        return response.content[0].text;
      }
      return '';
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      throw error;
    }
  }

  protected log(level: string, message: string, data?: any) {
    const logEntry = {
      timestamp: new Date(),
      level,
      agent: this.config.name,
      message,
      data
    };
    
    this.logs.push(logEntry);
    console.log(JSON.stringify(logEntry));
    
    // Emit log event
    this.emit('log', logEntry);
    
    // Save to Supabase if error or critical
    if (level === 'error' || level === 'critical') {
      this.supabase.logError(logEntry);
    }
  }

  private updateMetrics(success: boolean, processingTime: number) {
    if (success) {
      this.metrics.processed++;
    } else {
      this.metrics.errors++;
    }
    
    // Calculate rolling average
    const total = this.metrics.processed + this.metrics.errors;
    this.metrics.avgProcessingTime = 
      (this.metrics.avgProcessingTime * (total - 1) + processingTime) / total;
  }
}