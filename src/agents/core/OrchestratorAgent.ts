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

      // Step 2.5: Fetch patient data if needed
      let patientData = null;
      if (routingPlan.requiresPatientData && message.context.patientId) {
        patientData = await this.fetchPatientDataForQuery(message.context.patientId, intent);
      }

      // Step 2.6: Generate group help if needed
      let groupHelpText = null;
      if (routingPlan.requiresGroupHelp) {
        groupHelpText = this.generateGroupHelpText();
      }

      // Step 3: Execute routing plan
      const results = await this.executeRoutingPlan(routingPlan, {
        ...message,
        metadata: {
          ...message.metadata,
          intent,
          confidence,
          patientData,
          groupHelpText
        }
      });

      // Step 4: Aggregate results
      const aggregatedResponse = this.aggregateResponses(results);

      // Step 5: Check for alerts (only if alert agent wasn't already called)
      if (!routingPlan.agents.includes('alert')) {
        await this.checkAlerts(message, aggregatedResponse);
      }

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
      requiresPatientData?: boolean;
      requiresGroupHelp?: boolean;
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
        case 'report_menu':
          // Show report menu as Flex Card
          plan.agents = [];
          plan.requiresFlexMessage = true;
          plan.flexMessageType = 'report_menu';
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
        // Patient info queries (for group)
        case 'patient_info':
        case 'patient_name':
        case 'patient_age':
        case 'patient_conditions':
        case 'patient_medications':
        case 'patient_allergies':
          plan.agents = ['dialog'];
          plan.requiresPatientData = true;
          break;
        case 'group_help':
          plan.agents = ['dialog'];
          plan.requiresGroupHelp = true;
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

    // Track priority responses
    let alertResponse: string | null = null;
    let healthResponse: string | null = null;

    // Merge successful responses - prioritize: alert > health > dialog
    for (const response of aggregated.results) {
      if (response.data) {
        // Store agent-specific responses
        if (response.agentName === 'alert' && response.data.response) {
          alertResponse = response.data.response;
        } else if (response.agentName === 'health' && response.data.response) {
          healthResponse = response.data.response;
        }

        Object.assign(aggregated.combined, response.data);
      }
    }

    // Apply priority: alert > health > dialog
    if (alertResponse) {
      aggregated.combined.response = alertResponse;
    } else if (healthResponse) {
      aggregated.combined.response = healthResponse;
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

  private async fetchPatientDataForQuery(patientId: string, intent: string) {
    try {
      // Fetch patient profile
      const { data: patient, error } = await this.supabase.getClient()
        .from('patient_profiles')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error || !patient) return null;

      // Fetch medications if needed
      let medications = [];
      if (intent === 'patient_medications' || intent === 'patient_info') {
        const medsResult = await this.supabase.getPatientMedications(patientId);
        medications = medsResult || [];
      }

      // Calculate age
      const birthDate = new Date(patient.birth_date);
      const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      return {
        name: `${patient.first_name} ${patient.last_name}`,
        nickname: patient.nickname,
        age,
        birthDate: patient.birth_date,
        gender: patient.gender,
        bloodType: patient.blood_type,
        chronicDiseases: patient.chronic_diseases || [],
        drugAllergies: patient.drug_allergies || [],
        foodAllergies: patient.food_allergies || [],
        medications,
        emergencyContact: {
          name: patient.emergency_contact_name,
          phone: patient.emergency_contact_phone,
          relation: patient.emergency_contact_relation
        }
      };
    } catch (error) {
      this.log('error', 'Failed to fetch patient data', error);
      return null;
    }
  }

  private generateGroupHelpText(): string {
    return `📋 สิ่งที่สามารถถาม/ทำได้ในกลุ่ม:

🔍 **ถามข้อมูลผู้ป่วย** (พูดยังไงก็ได้):
• "ชื่ออะไร" / "เขาชื่ออะไร" / "ผู้ป่วยชื่ออะไร"
• "อายุเท่าไหร่" / "อายุ" / "กี่ขวบ"
• "เป็นโรคอะไร" / "มีโรค" / "ป่วยเป็นอะไร"
• "กินยาอะไร" / "ยาอะไรบ้าง" / "ทานยา"
• "แพ้อะไร" / "มีแพ้" / "ภูมิแพ้"
• "ข้อมูลทั้งหมด" / "ดูข้อมูล"

📝 **บันทึกกิจกรรม** (พูดง่ายๆ):
• "กินยาแล้ว" / "ทานยา" / "ยาเสร็จ"
• "วัด 120/80" / "ความดัน 120/80" / "วัดแล้ว"
• "ดื่มน้ำ 500ml" / "ดื่ม 2 แก้ว" / "ดื่มแล้ว"
• "ออกกำลัง 30 นาที" / "เดินแล้ว" / "วิ่งเสร็จ"

📊 **ดูรายงาน**:
• "รายงาน" / "สรุป" / "ดูรายงาน"
• "ข้อมูลวันนี้" / "สรุปสัปดาห์"

🆘 **ฉุกเฉิน**:
• "ฉุกเฉิน" / "ช่วยด้วย" / "ไม่สบาย"

💡 **หมายเหตุ:**
• ต้อง @mention บอท (@oonjai) ก่อนทุกครั้ง
• พูดแบบไหนก็ได้ บอทจะเข้าใจ 😊`;
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