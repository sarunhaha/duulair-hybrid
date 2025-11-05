// src/agents/core/OrchestratorAgent.ts
import { BaseAgent, Message, Response, Config } from './BaseAgent';
import { IntentAgent } from '../specialized/IntentAgent';
import { HealthAgent } from '../specialized/HealthAgent';
import { ReportAgent } from '../specialized/ReportAgent';
import { AlertAgent } from '../specialized/AlertAgent';
import { DialogAgent } from '../specialized/DialogAgent';
import { v4 as uuidv4 } from 'uuid';

interface AgentRegistry {
  [key: string]: BaseAgent;
}

export class OrchestratorAgent extends BaseAgent {
  private agents: AgentRegistry = {};
  private agentSpecs: Map<string, any> = new Map();

  constructor() {
    super({
      name: 'orchestrator',
      role: 'Main coordinator for all agents',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.5,
      maxTokens: 2000,
      capabilities: ['routing', 'coordination', 'monitoring']
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'Initializing Orchestrator Agent');

    try {
      // Load agent specifications
      await this.loadAgentSpecs();

      // Initialize all agents based on specs
      const agentConfigs = [
        { name: 'intent', class: IntentAgent },
        { name: 'health', class: HealthAgent },
        { name: 'report', class: ReportAgent },
        { name: 'alert', class: AlertAgent },
        { name: 'dialog', class: DialogAgent }
      ];

      for (const { name, class: AgentClass } of agentConfigs) {
        const spec = this.agentSpecs.get(name);
        const agent = new AgentClass(spec?.config || {});
        
        if (await agent.initialize()) {
          this.agents[name] = agent;
          this.setupAgentListeners(agent);
          this.log('info', `Agent ${name} initialized successfully`);
        } else {
          throw new Error(`Failed to initialize ${name} agent`);
        }
      }

      // Load previous state
      await this.loadState();

      return true;
    } catch (error) {
      this.log('error', 'Orchestrator initialization failed', error);
      return false;
    }
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();
    this.log('info', 'Processing message', { messageId: message.id });

    try {
      // Step 1: Intent Classification
      const intentResponse = await this.agents.intent.process(message);
      
      if (!intentResponse.success) {
        throw new Error('Intent classification failed');
      }

      const intent = intentResponse.data.intent;
      const confidence = intentResponse.data.confidence;

      // Step 2: Route to appropriate agent(s)
      const routingPlan = this.createRoutingPlan(intent, confidence);
      
      // Step 3: Execute routing plan
      const results = await this.executeRoutingPlan(routingPlan, {
        ...message,
        metadata: {
          ...message.metadata,
          intent,
          confidence
        }
      });

      // Step 4: Aggregate results
      const aggregatedResponse = this.aggregateResponses(results);

      // Step 5: Check for alerts
      await this.checkAlerts(message, aggregatedResponse);

      // Step 6: Save to database
      await this.saveProcessingLog(message, aggregatedResponse);

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: aggregatedResponse,
        agentName: this.config.name,
        processingTime,
        metadata: {
          intent,
          confidence,
          agentsInvolved: routingPlan.agents,
          quickReplyType: routingPlan.quickReplyType,
          flexMessageType: routingPlan.flexMessageType
        }
      };

    } catch (error) {
      this.log('error', 'Message processing failed', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  getCapabilities(): string[] {
    const capabilities = ['orchestration'];
    
    // Aggregate all agent capabilities
    for (const agent of Object.values(this.agents)) {
      capabilities.push(...agent.getCapabilities());
    }
    
    return [...new Set(capabilities)];
  }

  private async loadAgentSpecs() {
    // Load specs from database or use defaults
    try {
      const specs = await this.supabase.getAgentSpecs();

      for (const spec of specs) {
        this.agentSpecs.set(spec.name, spec);
      }

      this.log('info', `Loaded ${specs.length} agent specs from database`);
    } catch (error) {
      // If database is not ready, use default empty specs
      this.log('warn', 'Could not load agent specs from database, using defaults', error);
    }
  }

  private createRoutingPlan(intent: string, confidence: number) {
    const plan: {
      agents: string[];
      parallel: boolean;
      fallback: string;
      requiresFlexMessage?: boolean;
      flexMessageType?: string;
      requiresQuickReply?: boolean;
      quickReplyType?: string;
    } = {
      agents: [] as string[],
      parallel: false,
      fallback: 'dialog'
    };

    // High confidence routing
    if (confidence > 0.8) {
      switch(intent) {
        case 'medication':
        case 'vitals':
        case 'water':
        case 'walk':
        case 'food':
          plan.agents = ['health'];
          break;
        case 'emergency':
          plan.agents = ['alert', 'health'];
          plan.parallel = true;
          break;
        case 'report':
          plan.agents = ['report'];
          break;
        case 'registration':
          // Return special marker for registration
          plan.agents = ['dialog'];
          plan.requiresFlexMessage = true;
          plan.flexMessageType = 'registration';
          break;
        case 'health_menu':
          plan.agents = ['dialog'];
          plan.requiresQuickReply = true;
          plan.quickReplyType = 'health_menu';
          break;
        case 'view_report':
          plan.agents = ['dialog'];
          plan.requiresQuickReply = true;
          plan.quickReplyType = 'view_report';
          break;
        case 'package':
          plan.agents = ['dialog'];
          plan.requiresFlexMessage = true;
          plan.flexMessageType = 'package';
          break;
        case 'help':
          plan.agents = ['dialog'];
          plan.requiresFlexMessage = true;
          plan.flexMessageType = 'help';
          break;
        default:
          plan.agents = ['dialog'];
      }
    } else {
      // Low confidence - use multiple agents
      plan.agents = ['health', 'dialog'];
      plan.parallel = true;
    }

    return plan;
  }

  private async executeRoutingPlan(plan: any, message: Message): Promise<Response[]> {
    const results: Response[] = [];

    if (plan.parallel) {
      // Execute in parallel
      const promises = plan.agents.map((agentName: string) => 
        this.agents[agentName]?.process(message)
      );
      
      const responses = await Promise.allSettled(promises);
      
      for (const response of responses) {
        if (response.status === 'fulfilled' && response.value) {
          results.push(response.value);
        }
      }
    } else {
      // Execute sequentially
      for (const agentName of plan.agents) {
        const agent = this.agents[agentName];
        if (agent) {
          const response = await agent.process(message);
          results.push(response);
          
          // Stop if successful
          if (response.success) {
            break;
          }
        }
      }
    }

    return results;
  }

  private aggregateResponses(responses: Response[]): any {
    // Combine responses from multiple agents
    const aggregated = {
      results: responses.filter(r => r.success),
      errors: responses.filter(r => !r.success),
      combined: {} as any
    };

    // Merge successful responses
    for (const response of aggregated.results) {
      if (response.data) {
        Object.assign(aggregated.combined, response.data);
      }
    }

    return aggregated;
  }

  private async checkAlerts(message: Message, response: any) {
    const shouldAlert = 
      response.combined?.requiresAlert ||
      response.combined?.emergency ||
      message.content.includes('ฉุกเฉิน');

    if (shouldAlert && this.agents.alert) {
      await this.agents.alert.process({
        ...message,
        metadata: {
          ...message.metadata,
          alertType: 'critical',
          originalResponse: response
        }
      });
    }
  }

  private async saveProcessingLog(message: Message, response: any) {
    try {
      const logData: any = {
        patient_id: message.context.patientId,
        message_id: message.id,
        intent: response.combined?.intent,
        processing_result: response,
        timestamp: new Date()
      };

      // Add group context and actor info (TASK-002)
      if (message.context.source === 'group') {
        logData.group_id = message.context.groupId || null;
        logData.actor_line_user_id = message.context.actorLineUserId || null;
        logData.actor_display_name = message.context.actorDisplayName || null;
        logData.source = 'group';
      } else {
        logData.source = '1:1';
      }

      await this.supabase.saveActivityLog(logData);
    } catch (error) {
      // Log to console if database is not available
      this.log('debug', 'Could not save to database, logging to console', {
        message_id: message.id,
        intent: response.combined?.intent
      });
    }
  }

  private setupAgentListeners(agent: BaseAgent) {
    // Listen to agent events
    agent.on('log', (log) => {
      this.log('debug', `[${agent.constructor.name}] ${log.message}`, log.data);
    });

    agent.on('agent:communicate', async (data) => {
      // Handle inter-agent communication
      const targetAgent = this.agents[data.target];
      if (targetAgent) {
        await targetAgent.process(data.message);
      }
    });

    agent.on('agent:delegate', async (data) => {
      // Handle task delegation
      await this.process({
        id: uuidv4(),
        content: data.task,
        context: {
          source: 'system',
          timestamp: new Date()
        },
        metadata: data.data
      });
    });
  }
}