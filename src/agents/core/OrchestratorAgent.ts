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
      const routingPlan = await this.createRoutingPlan(intent, confidence, message);

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

      // Step 2.7: Handle switch patient command
      let switchResult = null;
      if (routingPlan.requiresSwitchPatient && message.context.groupId) {
        switchResult = await this.handleSwitchPatient(message);
      }

      // Step 2.8: Get patient list if needed
      let patientsList = null;
      if (routingPlan.requiresListPatients && message.context.groupId) {
        patientsList = await this.getGroupPatientsList(message.context.groupId);
      }

      // Step 2.9: Handle detected patient switch (Phase 3 - Natural Language)
      if (routingPlan.requiresPatientSwitch && routingPlan.detectedPatientId && message.context.groupId) {
        console.log(`🔄 Switching to detected patient: ${routingPlan.detectedPatientId}`);

        const { groupService } = await import('../../services/group.service');
        const switchResult = await groupService.switchActivePatient(
          message.context.groupId,
          routingPlan.detectedPatientId
        );

        if (switchResult.success) {
          console.log(`✅ Switched to patient: ${switchResult.patientName}`);
          // Update message context with detected patient
          message.context.patientId = routingPlan.detectedPatientId;
        } else {
          this.log('error', 'Failed to switch to detected patient', switchResult);
        }
      }

      // Step 2.10: Handle set default patient (Phase 4)
      let setDefaultResult = null;
      if (routingPlan.requiresSetDefault && message.context.groupId) {
        setDefaultResult = await this.handleSetDefaultPatient(message);
      }

      // Step 2.11: Handle remove default patient (Phase 4)
      let removeDefaultResult = null;
      if (routingPlan.requiresRemoveDefault && message.context.groupId) {
        removeDefaultResult = await this.handleRemoveDefaultPatient(message);
      }

      // Step 3: Execute routing plan
      const results = await this.executeRoutingPlan(routingPlan, {
        ...message,
        metadata: {
          ...message.metadata,
          intent,
          confidence,
          patientData,
          groupHelpText,
          switchResult,
          patientsList,
          patientSelectionData: routingPlan.patientSelectionData,
          setDefaultResult,
          removeDefaultResult
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
          flexMessageType: routingPlan.flexMessageType,
          patientSelectionData: routingPlan.patientSelectionData
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

  private async createRoutingPlan(intent: string, confidence: number, message: Message) {
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
      requiresPatientSelection?: boolean;
      patientSelectionData?: { patients: any[]; originalMessage: string; originalIntent: string };
      requiresPatientSwitch?: boolean;
      detectedPatientId?: string;
      requiresSwitchPatient?: boolean;
      requiresListPatients?: boolean;
      requiresSetDefault?: boolean;
      requiresRemoveDefault?: boolean;
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
          // Check if group context
          if (message.context.source === 'group' && message.context.groupId) {
            const patientsList = await this.getGroupPatientsList(message.context.groupId);

            if (patientsList && patientsList.patients && patientsList.patients.length > 1) {
              // Phase 3: Try to detect patient name in message (Natural Language)
              const detectedPatient = this.detectPatientInMessage(message.content, patientsList.patients);

              if (detectedPatient) {
                // Found patient name in message → switch to that patient
                console.log(`🎯 Phase 3: Detected patient in message: ${detectedPatient.name}`);
                plan.agents = ['health'];
                plan.requiresPatientSwitch = true;
                plan.detectedPatientId = detectedPatient.id;
                break;
              }

              // Phase 4: Check if caregiver has default patient (Smart Default)
              const { groupService } = await import('../../services/group.service');
              const defaultPatientData = await groupService.getCaregiverDefaultPatient(
                message.context.groupId,
                message.context.actorLineUserId || ''
              );

              if (defaultPatientData.hasDefault && defaultPatientData.patientId) {
                // Found default patient → use it
                console.log(`💡 Phase 4: Using default patient: ${defaultPatientData.patientName}`);
                plan.agents = ['health'];
                plan.requiresPatientSwitch = true;
                plan.detectedPatientId = defaultPatientData.patientId;
                break;
              }

              // Phase 2: No patient name detected & no default → show Quick Reply selection
              console.log(`📋 Phase 2: Showing Quick Reply for patient selection`);
              plan.agents = ['dialog'];
              plan.requiresQuickReply = true;
              plan.quickReplyType = 'select_patient';
              plan.requiresPatientSelection = true;
              plan.patientSelectionData = {
                patients: patientsList.patients,
                originalMessage: message.content,
                originalIntent: intent
              };
              break;
            }
          }

          // Single patient or 1:1 chat - proceed to health agent
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
        case 'switch_patient':
          plan.agents = ['dialog'];
          plan.requiresSwitchPatient = true;
          break;
        case 'list_patients':
          plan.agents = ['dialog'];
          plan.requiresListPatients = true;
          break;
        case 'set_default_patient':
          plan.agents = ['dialog'];
          plan.requiresSetDefault = true;
          break;
        case 'remove_default_patient':
          plan.agents = ['dialog'];
          plan.requiresRemoveDefault = true;
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

  private async handleSwitchPatient(message: Message): Promise<any> {
    try {
      const groupId = message.context.groupId;
      if (!groupId) {
        return { success: false, message: 'ไม่พบกลุ่ม' };
      }

      // Extract patient name/index from message
      // Example: "/switch ก้อย" or "/switch 1"
      const text = message.content.replace(/^\/switch\s*/i, '').replace(/^switch\s*/i, '').trim();

      if (!text) {
        // No patient specified - return list for selection
        const patients = await this.supabase.getClient()
          .from('group_patients')
          .select('*, patient_profiles(*)')
          .eq('group_id', groupId)
          .eq('is_active', true)
          .order('added_at', { ascending: true });

        if (patients.data && patients.data.length > 0) {
          return {
            success: false,
            requiresSelection: true,
            patients: patients.data.map((gp: any, idx: number) => ({
              index: idx + 1,
              id: gp.patient_id,
              name: `${gp.patient_profiles.first_name} ${gp.patient_profiles.last_name}`
            })),
            message: 'กรุณาระบุผู้ป่วยที่ต้องการเปลี่ยน'
          };
        }
        return { success: false, message: 'ไม่พบผู้ป่วยในกลุ่ม' };
      }

      // Get all patients in group
      const { data: groupPatients } = await this.supabase.getClient()
        .from('group_patients')
        .select('*, patient_profiles(*)')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('added_at', { ascending: true });

      if (!groupPatients || groupPatients.length === 0) {
        return { success: false, message: 'ไม่พบผู้ป่วยในกลุ่ม' };
      }

      // Find patient by name or index
      let targetPatient = null;
      if (/^\d+$/.test(text)) {
        // Number index (1-based)
        const index = parseInt(text) - 1;
        if (index >= 0 && index < groupPatients.length) {
          targetPatient = groupPatients[index];
        }
      } else {
        // Name search
        targetPatient = groupPatients.find((gp: any) => {
          const fullName = `${gp.patient_profiles.first_name} ${gp.patient_profiles.last_name}`;
          const firstName = gp.patient_profiles.first_name;
          const nickname = gp.patient_profiles.nickname;
          return fullName.includes(text) || firstName.includes(text) || (nickname && nickname.includes(text));
        });
      }

      if (!targetPatient) {
        return {
          success: false,
          message: `ไม่พบผู้ป่วยชื่อ "${text}"`,
          availablePatients: groupPatients.map((gp: any, idx: number) => ({
            index: idx + 1,
            name: `${gp.patient_profiles.first_name} ${gp.patient_profiles.last_name}`
          }))
        };
      }

      // Import groupService
      const { groupService } = await import('../../services/group.service');

      // Switch active patient
      const result = await groupService.switchActivePatient(groupId, targetPatient.patient_id);

      return result;
    } catch (error) {
      this.log('error', 'Failed to switch patient', error);
      return { success: false, message: 'เกิดข้อผิดพลาด' };
    }
  }

  private async getGroupPatientsList(groupId: string): Promise<any> {
    try {
      const { data: groupPatients } = await this.supabase.getClient()
        .from('group_patients')
        .select('*, patient_profiles(*)')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('added_at', { ascending: true });

      if (!groupPatients || groupPatients.length === 0) {
        return { patients: [], message: 'ไม่มีผู้ป่วยในกลุ่ม' };
      }

      // Get active patient ID
      const { data: group } = await this.supabase.getClient()
        .from('groups')
        .select('active_patient_id')
        .eq('id', groupId)
        .single();

      const activePatientId = group?.active_patient_id;

      return {
        patients: groupPatients.map((gp: any, idx: number) => ({
          index: idx + 1,
          id: gp.patient_id,
          name: `${gp.patient_profiles.first_name} ${gp.patient_profiles.last_name}`,
          nickname: gp.patient_profiles.nickname,
          age: Math.floor((Date.now() - new Date(gp.patient_profiles.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
          isActive: gp.patient_id === activePatientId
        })),
        total: groupPatients.length
      };
    } catch (error) {
      this.log('error', 'Failed to get patients list', error);
      return { patients: [], message: 'เกิดข้อผิดพลาด' };
    }
  }

  /**
   * Phase 4: Handle set default patient
   */
  private async handleSetDefaultPatient(message: Message): Promise<any> {
    try {
      const groupId = message.context.groupId;
      const caregiverLineUserId = message.context.actorLineUserId;

      if (!groupId || !caregiverLineUserId) {
        return { success: false, message: 'ไม่พบข้อมูลกลุ่มหรือผู้ใช้' };
      }

      // Extract patient name/index from message
      // Example: "/setdefault ก้อย" or "ตั้งผู้ป่วยหลัก ก้อย"
      const text = message.content
        .replace(/^\/setdefault\s*/i, '')
        .replace(/^setdefault\s*/i, '')
        .replace(/ตั้ง.*ผู้ป่วย.*หลัก\s*/i, '')
        .replace(/ตั้ง.*ค่า.*ผู้ป่วย\s*/i, '')
        .trim();

      if (!text) {
        // No patient specified - return list for selection
        const patientsList = await this.getGroupPatientsList(groupId);

        if (patientsList.patients && patientsList.patients.length > 0) {
          return {
            success: false,
            requiresSelection: true,
            patients: patientsList.patients,
            message: 'กรุณาเลือกผู้ป่วยที่ต้องการตั้งเป็นหลัก',
            action: 'set_default'
          };
        }
        return { success: false, message: 'ไม่พบผู้ป่วยในกลุ่ม' };
      }

      // Get all patients in group
      const patientsList = await this.getGroupPatientsList(groupId);

      if (!patientsList.patients || patientsList.patients.length === 0) {
        return { success: false, message: 'ไม่พบผู้ป่วยในกลุ่ม' };
      }

      // Find patient by name or index
      let targetPatient = null;
      if (/^\d+$/.test(text)) {
        // Number index (1-based)
        const index = parseInt(text) - 1;
        if (index >= 0 && index < patientsList.patients.length) {
          targetPatient = patientsList.patients[index];
        }
      } else {
        // Name search
        targetPatient = patientsList.patients.find((p: any) => {
          const lowerText = text.toLowerCase();
          return p.name.toLowerCase().includes(lowerText) ||
                 (p.nickname && p.nickname.toLowerCase().includes(lowerText));
        });
      }

      if (!targetPatient) {
        return {
          success: false,
          message: `ไม่พบผู้ป่วยชื่อ "${text}"`,
          availablePatients: patientsList.patients
        };
      }

      // Set default patient
      const { groupService } = await import('../../services/group.service');
      const result = await groupService.setDefaultPatient({
        groupId,
        caregiverLineUserId,
        patientId: targetPatient.id
      });

      return {
        ...result,
        patientName: targetPatient.name
      };
    } catch (error) {
      this.log('error', 'Failed to set default patient', error);
      return { success: false, message: 'เกิดข้อผิดพลาด' };
    }
  }

  /**
   * Phase 4: Handle remove default patient
   */
  private async handleRemoveDefaultPatient(message: Message): Promise<any> {
    try {
      const groupId = message.context.groupId;
      const caregiverLineUserId = message.context.actorLineUserId;

      if (!groupId || !caregiverLineUserId) {
        return { success: false, message: 'ไม่พบข้อมูลกลุ่มหรือผู้ใช้' };
      }

      // Remove default patient
      const { groupService } = await import('../../services/group.service');
      const result = await groupService.removeDefaultPatient(groupId, caregiverLineUserId);

      return result;
    } catch (error) {
      this.log('error', 'Failed to remove default patient', error);
      return { success: false, message: 'เกิดข้อผิดพลาด' };
    }
  }

  /**
   * Phase 3: Detect patient name in message (Natural Language)
   * Example: "ยายก้อยกินยาแล้ว" → detects "ก้อย"
   */
  private detectPatientInMessage(messageContent: string, patients: any[]): { id: string; name: string } | null {
    const normalizedMessage = messageContent.toLowerCase();

    for (const patient of patients) {
      const firstName = patient.name.split(' ')[0].toLowerCase();
      const lastName = patient.name.split(' ')[1]?.toLowerCase() || '';
      const nickname = patient.nickname?.toLowerCase() || '';
      const fullName = patient.name.toLowerCase();

      // Check if message contains any patient identifier
      const patterns = [
        nickname,              // ก้อย
        firstName,             // สมศรี
        lastName,              // ใจดี
        fullName,              // สมศรี ใจดี
        `ยาย${nickname}`,      // ยายก้อย
        `คุณยาย${nickname}`,   // คุณยายก้อย
        `ปู่${nickname}`,      // ปู่วิชัย
        `คุณปู่${nickname}`,   // คุณปู่วิชัย
        `ตา${nickname}`,       // ตาวิชัย
        `คุณตา${nickname}`,    // คุณตาวิชัย
        `ย่า${nickname}`,      // ย่าก้อย
        `คุณ${firstName}`,     // คุณสมศรี
        `${firstName}${lastName}` // สมศรีใจดี (no space)
      ].filter(Boolean); // Remove empty strings

      for (const pattern of patterns) {
        if (pattern && normalizedMessage.includes(pattern)) {
          console.log(`🎯 Pattern matched: "${pattern}" for patient: ${patient.name}`);
          return {
            id: patient.id,
            name: patient.name
          };
        }
      }
    }

    return null;
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

👥 **กลุ่มที่มีหลายผู้ป่วย**:
• "ยายก้อยกินยาแล้ว" - ระบุชื่อในข้อความ (AI จะเลือกให้อัตโนมัติ)
• "/switch ก้อย" - เปลี่ยนไปดูแลผู้ป่วยคนอื่น
• "/switch 1" - เปลี่ยนด้วยตัวเลข
• "ผู้ป่วยทั้งหมด" - ดูรายชื่อผู้ป่วยในกลุ่ม

⚙️ **ตั้งค่าผู้ป่วยหลัก** (Smart Default):
• "/setdefault ก้อย" - ตั้งผู้ป่วยหลักของคุณ (บันทึกไวขึ้น)
• "/setdefault 1" - ตั้งด้วยตัวเลข
• "/removedefault" - ลบการตั้งค่า

💡 **หมายเหตุ:**
• ต้อง @mention บอท (@oonjai) ก่อนทุกครั้ง
• พูดแบบไหนก็ได้ บอทจะเข้าใจ 😊
• ตั้งผู้ป่วยหลัก = ไม่ต้องระบุชื่อทุกครั้ง`;
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