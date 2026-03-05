// src/agents/core/OrchestratorAgent.ts
import { BaseAgent, Message, Response, Config } from './BaseAgent';
import { AI_CONFIG, AGENT_MODELS } from '../../services/openrouter.service';
import { IntentAgent } from '../specialized/IntentAgent';
import { HealthAgent } from '../specialized/HealthAgent';
import { ReportAgent } from '../specialized/ReportAgent';
import { AlertAgent } from '../specialized/AlertAgent';
import { DialogAgent } from '../specialized/DialogAgent';
import { ProfileEditAgent } from '../specialized/ProfileEditAgent';
import { UnifiedNLUAgent } from './UnifiedNLUAgent';
import { executeAction } from '../../lib/actions/action-router';
import { NLUResult, NLUContext } from '../../types/nlu.types';
import { v4 as uuidv4 } from 'uuid';

// Enable/disable natural conversation mode (Claude-first NLU)
const USE_NATURAL_CONVERSATION_MODE = true;

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
      ...AGENT_MODELS.orchestrator,
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
        { name: 'dialog', class: DialogAgent },
        { name: 'profile_edit', class: ProfileEditAgent },
        { name: 'unified_nlu', class: UnifiedNLUAgent }
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

    // Use natural conversation mode if enabled
    if (USE_NATURAL_CONVERSATION_MODE) {
      return this.processWithNaturalConversation(message, startTime);
    }

    // Legacy mode: Use IntentAgent + routing
    return this.processWithIntentRouting(message, startTime);
  }

  /**
   * Natural Conversation Mode - Claude-first NLU
   * Single Claude call for understanding + extraction + response
   */
  private async processWithNaturalConversation(message: Message, startTime: number): Promise<Response> {
    try {
      // Fetch patient data for context
      const isGroupChat = message.context.source === 'group' || !!message.context.groupId;
      let patientData = null;

      if (message.context.patientId) {
        patientData = await this.fetchPatientDataForQuery(message.context.patientId, '');
      }

      // Check onboarding status for new users (1:1 chat only)
      let onboardingContext: { completed: boolean; step: string } | null = null;
      if (!isGroupChat && message.context.userId) {
        onboardingContext = await this.getOnboardingStatus(message.context.userId);
        console.log(`🔍 [Onboarding] userId=${message.context.userId}, context=${JSON.stringify(onboardingContext)}`);
      }

      // Fallback: fetch patient profile by userId if patientId is not available (onboarding users)
      if (!patientData && !isGroupChat && message.context.userId) {
        try {
          const { data } = await this.supabase.getClient()
            .from('patient_profiles')
            .select('id, nickname, first_name, last_name, birth_date, medical_condition, chronic_diseases')
            .eq('user_id', message.context.userId)
            .single();
          if (data) {
            patientData = {
              profile: data,
              name: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.nickname,
              nickname: data.nickname
            };
          }
        } catch (e) {
          this.log('debug', 'No patient profile found by userId for onboarding', e);
        }
      }

      // Fetch recent conversation history for AI context (all users)
      let conversationHistory: Array<{role: string; content: string}> | undefined;
      if (!isGroupChat) {
        try {
          if (message.context.patientId) {
            const logs = await this.supabase.getConversationLogs(message.context.patientId, 10);
            conversationHistory = logs.reverse().map((l: any) => ({ role: l.role, content: l.text }));
          } else if (message.context.userId) {
            // Fetch by user_id for users without patientId yet
            const { data: logs } = await this.supabase.getClient()
              .from('conversation_logs')
              .select('role, text')
              .eq('user_id', message.context.userId)
              .order('timestamp', { ascending: false })
              .limit(10);
            if (logs) {
              conversationHistory = logs.reverse().map((l: any) => ({ role: l.role, content: l.text }));
            }
          }
        } catch (e) {
          this.log('debug', 'Could not fetch conversation history', e);
        }
      }

      // Build NLU context
      const nluContext: NLUContext = {
        userId: message.context.userId || '',
        patientId: message.context.patientId,
        groupId: message.context.groupId,
        isGroupChat,
        originalMessage: message.content,
        onboardingCompleted: onboardingContext?.completed ?? true,
        onboardingStep: (onboardingContext?.step as any) ?? 'complete',
        patientData: patientData ? {
          profile: patientData,
          medications: patientData.medications,
          reminders: patientData.reminders,
          recentActivities: patientData.recentActivities
        } : undefined,
        conversationHistory: message.metadata?.conversationHistory
      };

      // Save conversation log (user message)
      let conversationLogId: string | undefined;
      if (message.context.patientId || message.context.userId) {
        try {
          conversationLogId = await this.supabase.saveConversationLog({
            patientId: message.context.patientId,
            userId: message.context.userId,
            groupId: message.context.groupId,
            role: 'user',
            text: message.content,
            source: isGroupChat ? 'group' : '1:1'
          } as any);
        } catch (logError) {
          this.log('debug', 'Could not save conversation log', logError);
        }
      }

      // Process through UnifiedNLU
      const nluResponse = await this.agents.unified_nlu.process({
        ...message,
        metadata: {
          ...message.metadata,
          patientData: nluContext.patientData,
          conversationHistory: conversationHistory || nluContext.conversationHistory,
          onboardingContext: onboardingContext
        }
      });

      if (!nluResponse.success || !nluResponse.data) {
        throw new Error('NLU processing failed');
      }

      const nluResult: NLUResult = nluResponse.data;
      this.log('info', `NLU: ${nluResult.intent}/${nluResult.subIntent} (${(nluResult.confidence * 100).toFixed(0)}%)`);

      // Debug: warn if health_log intent but no healthData extracted
      if (nluResult.intent === 'health_log' && !nluResult.healthData && !(nluResult as any).healthDataArray) {
        console.warn(`⚠️ [NLU] health_log intent detected but NO healthData extracted!`, {
          message: message.content.substring(0, 100),
          subIntent: nluResult.subIntent,
          action: nluResult.action?.type,
          entities: nluResult.entities
        });
      } else if (nluResult.intent === 'health_log') {
        console.log(`✅ [NLU] health_log with data:`, {
          type: nluResult.healthData?.type,
          hasArray: !!(nluResult as any).healthDataArray,
          subIntent: nluResult.subIntent
        });
      }

      // Special case: emergency - also notify alert agent
      if (nluResult.intent === 'emergency') {
        await this.checkAlerts(message, { combined: { emergency: true } });
      }

      // Special case: onboarding - handle onboarding flow
      if (nluResult.intent === 'onboarding' && onboardingContext && !onboardingContext.completed) {
        return this.handleOnboardingResponse(message, nluResult, onboardingContext, startTime);
      }

      // Guard: if NLU returns onboarding but user already completed → treat as greeting
      // Keep NLU's natural response — just redirect the intent so onboarding flow doesn't trigger
      if (nluResult.intent === 'onboarding' && (!onboardingContext || onboardingContext.completed)) {
        this.log('info', `Onboarding already completed, redirecting to greeting`);
        nluResult.intent = 'greeting';
        nluResult.subIntent = 'general';
        // Let NLU's response pass through — don't override it
      }

      // Auto-complete stuck onboarding: if onboarding is not completed but user is already
      // using the app normally (intent is not onboarding), mark it as complete so they don't
      // get stuck in onboarding mode forever
      if (onboardingContext && !onboardingContext.completed && nluResult.intent !== 'onboarding' && message.context.userId) {
        this.log('info', `Auto-completing stuck onboarding for user (intent: ${nluResult.intent}, step: ${onboardingContext.step})`);
        await this.updateOnboardingStep(message.context.userId, 'complete', true);
      }

      // Special case: health_log_menu - show health logging menu
      if (this.isHealthLogMenuRequest(message.content)) {
        return this.handleHealthLogMenuRequest(message, startTime);
      }

      // Special case: report_menu - show report menu (Rich Menu trigger)
      if (this.isReportMenuRequest(message.content)) {
        return this.handleReportQuery(message, nluResult, patientData, startTime);
      }

      // Special case: report - delegate to ReportAgent for Flex Message
      if (nluResult.intent === 'query' && nluResult.subIntent === 'report') {
        return this.handleReportQuery(message, nluResult, patientData, startTime);
      }

      // Execute database action if needed
      let actionResult = null;
      if (UnifiedNLUAgent.requiresAction(nluResult)) {
        actionResult = await executeAction(nluResult, nluContext);

        if (!actionResult.success && actionResult.errors?.length) {
          this.log('warn', 'Action execution failed', actionResult.errors);
        }
      }

      // Build final response
      let finalResponse = nluResult.response;

      // Append alerts if any
      if (actionResult?.alerts?.length) {
        finalResponse += '\n\n' + actionResult.alerts.join('\n');
      }

      // Update conversation log with NLU result
      if (conversationLogId) {
        try {
          await this.supabase.updateConversationLog(conversationLogId, {
            intent: nluResult.intent,
            aiExtractedData: nluResult.healthData || (nluResult as any).healthDataArray,
            aiConfidence: nluResult.confidence,
            aiModel: AI_CONFIG.model
          } as any);
        } catch (updateError) {
          this.log('debug', 'Could not update conversation log', updateError);
        }
      }

      // Save bot response to conversation_logs for future context
      if (finalResponse && (message.context.patientId || message.context.userId)) {
        try {
          await this.supabase.saveConversationLog({
            patientId: message.context.patientId,
            userId: message.context.userId,
            groupId: message.context.groupId,
            role: 'assistant',
            text: finalResponse,
            intent: nluResult.intent,
            aiConfidence: nluResult.confidence,
            aiModel: AI_CONFIG.model,
            source: isGroupChat ? 'group' : '1:1'
          } as any);
        } catch (botLogError) {
          this.log('debug', 'Could not save bot response log', botLogError);
        }
      }

      // Save processing log
      await this.saveProcessingLog(message, {
        combined: {
          response: finalResponse,
          intent: nluResult.intent,
          subIntent: nluResult.subIntent
        }
      });

      return {
        success: true,
        data: {
          response: finalResponse,
          intent: nluResult.intent,
          subIntent: nluResult.subIntent,
          confidence: nluResult.confidence,
          healthData: nluResult.healthData,
          actionResult,
          nluResult
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime,
        metadata: {
          intent: nluResult.intent,
          confidence: nluResult.confidence,
          mode: 'natural_conversation',
          hasHealthData: !!nluResult.healthData,
          savedRecords: actionResult?.savedRecords || 0
        }
      };

    } catch (error) {
      this.log('error', 'Natural conversation processing failed, falling back to legacy mode', error);
      // Fallback to legacy routing
      return this.processWithIntentRouting(message, startTime);
    }
  }

  /**
   * Handle report queries - delegate to ReportAgent for proper Flex Messages
   */
  private async handleReportQuery(
    message: Message,
    nluResult: NLUResult,
    patientData: any,
    startTime: number
  ): Promise<Response> {
    // Determine report type from message
    const msgLower = message.content.toLowerCase();
    let reportType = 'daily';
    if (msgLower.includes('สัปดาห์') || msgLower.includes('weekly') || msgLower.includes('7 วัน')) {
      reportType = 'weekly';
    } else if (msgLower.includes('เดือน') || msgLower.includes('monthly') || msgLower.includes('30 วัน')) {
      reportType = 'monthly';
    } else if (msgLower.includes('เมนู') || msgLower.match(/^ดู?รายงาน$/) || msgLower.match(/^รายงานสุขภาพ$/)) {
      // Just "ดูรายงาน" or "รายงาน" or "รายงานสุขภาพ" - show menu
      const reportResponse = await this.agents.report.process({
        ...message,
        metadata: { ...message.metadata, intent: 'report_menu', patientData }
      });
      return {
        success: true,
        data: reportResponse.data,
        agentName: this.config.name,
        processingTime: Date.now() - startTime,
        metadata: {
          intent: 'report_menu',
          flexMessageType: 'report_menu',
          mode: 'natural_conversation'
        }
      };
    }

    // Get actual report
    const reportResponse = await this.agents.report.process({
      ...message,
      metadata: {
        ...message.metadata,
        intent: 'report',
        reportType,
        patientData
      }
    });

    // Check if ReportAgent returned a flex message (e.g., report menu when no patientId)
    const flexMessageType = reportResponse.data?.flexMessageType;

    return {
      success: true,
      data: {
        response: reportResponse.data?.response || reportResponse.data?.reportText,
        flexMessage: reportResponse.data?.flexMessage,
        report: reportResponse.data?.report,
        reportType
      },
      agentName: this.config.name,
      processingTime: Date.now() - startTime,
      metadata: {
        intent: flexMessageType ? 'report_menu' : 'report',
        flexMessageType: flexMessageType,
        reportType,
        mode: 'natural_conversation'
      }
    };
  }

  /**
   * Check if message is a health log menu request
   */
  private isHealthLogMenuRequest(content: string): boolean {
    const msgLower = content.toLowerCase().trim();
    // Match "บันทึกสุขภาพ" or similar phrases
    const healthLogMenuPatterns = [
      /^บันทึกสุขภาพ$/,
      /^บันทึก สุขภาพ$/,
      /^เมนูบันทึกสุขภาพ$/,
      /^เมนู บันทึกสุขภาพ$/,
      /^บันทึกกิจกรรมสุขภาพ$/
    ];
    return healthLogMenuPatterns.some(pattern => pattern.test(msgLower));
  }

  /**
   * Check if message is a report menu request
   */
  private isReportMenuRequest(content: string): boolean {
    const msgLower = content.toLowerCase().trim();
    // Match "รายงานสุขภาพ", "ดูรายงาน", "รายงาน" - Rich Menu triggers
    const reportMenuPatterns = [
      /^รายงานสุขภาพ$/,
      /^รายงาน สุขภาพ$/,
      /^ดูรายงาน$/,
      /^ดู รายงาน$/,
      /^รายงาน$/
    ];
    return reportMenuPatterns.some(pattern => pattern.test(msgLower));
  }

  /**
   * Handle health log menu request - return Flex Message menu
   */
  private handleHealthLogMenuRequest(message: Message, startTime: number): Response {
    this.log('info', 'Handling health log menu request');
    return {
      success: true,
      data: {
        response: 'เลือกสิ่งที่ต้องการบันทึก หรือพิมพ์บอกได้เลยค่ะ',
        intent: 'health_log_menu'
      },
      agentName: this.config.name,
      processingTime: Date.now() - startTime,
      metadata: {
        intent: 'health_log_menu',
        flexMessageType: 'health_log_menu',
        mode: 'natural_conversation'
      }
    };
  }

  /**
   * Legacy Mode - IntentAgent + Routing Plan
   */
  private async processWithIntentRouting(message: Message, startTime: number): Promise<Response> {
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
      // Always fetch for group chat (so bot knows about patient context)
      // Or when specifically required by routing plan
      let patientData = null;
      const isGroupChat = message.context.source === 'group' || message.context.groupId;
      if (message.context.patientId && (routingPlan.requiresPatientData || isGroupChat)) {
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
          removeDefaultResult,
          reportType: (routingPlan as any).reportType // Pass reportType to ReportAgent
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

    // Special case: report_menu should work even with low confidence
    if (intent === 'report_menu') {
      plan.agents = ['report'];
      plan.requiresFlexMessage = true;
      plan.flexMessageType = 'report_menu';
      return plan;
    }

    // Special case: health_log_menu should work even with low confidence
    if (intent === 'health_log_menu') {
      plan.agents = ['dialog'];
      plan.requiresFlexMessage = true;
      plan.flexMessageType = 'health_log_menu';
      return plan;
    }

    // Special case: report intent should work with any confidence
    // and pass reportType based on message content
    if (intent === 'report') {
      // Determine report type from message
      const msgLower = message.content.toLowerCase();
      let reportType = 'daily'; // default
      if (msgLower.includes('สัปดาห์') || msgLower.includes('weekly') || msgLower.includes('7 วัน')) {
        reportType = 'weekly';
      } else if (msgLower.includes('เดือน') || msgLower.includes('monthly') || msgLower.includes('30 วัน')) {
        reportType = 'monthly';
      }

      plan.agents = ['report'];
      plan.requiresPatientData = true;
      // Store reportType to pass to ReportAgent
      (plan as any).reportType = reportType;
      return plan;
    }

    // ========================================
    // Profile/Medication/Reminder Edit Intents
    // Route to profile_edit agent (works with any confidence)
    // ========================================
    const profileEditIntents = [
      'edit_profile', 'edit_name', 'edit_weight', 'edit_height',
      'edit_phone', 'edit_address', 'edit_blood_type',
      'edit_medical_condition', 'edit_allergies', 'edit_emergency_contact'
    ];

    const medicationEditIntents = ['add_medication', 'edit_medication', 'delete_medication'];
    const reminderEditIntents = ['add_reminder', 'edit_reminder', 'delete_reminder'];

    if (profileEditIntents.includes(intent) ||
        medicationEditIntents.includes(intent) ||
        reminderEditIntents.includes(intent)) {
      plan.agents = ['profile_edit'];
      plan.requiresPatientData = true;
      return plan;
    }

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
        // Note: 'report' is handled before confidence check (line 263-278)
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
    let reportResponse: string | null = null;

    // Merge successful responses - prioritize: alert > health > report > dialog
    for (const response of aggregated.results) {
      if (response.data) {
        // Store agent-specific responses
        if (response.agentName === 'alert' && response.data.response) {
          alertResponse = response.data.response;
        } else if (response.agentName === 'health' && response.data.response) {
          healthResponse = response.data.response;
        } else if (response.agentName === 'report') {
          // ReportAgent returns reportText or responseMessage
          reportResponse = response.data.reportText || response.data.responseMessage || null;
        }

        Object.assign(aggregated.combined, response.data);
      }
    }

    // Apply priority: alert > health > report > dialog
    if (alertResponse) {
      aggregated.combined.response = alertResponse;
    } else if (healthResponse) {
      aggregated.combined.response = healthResponse;
    } else if (reportResponse) {
      aggregated.combined.response = reportResponse;
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

      // Always fetch medications (useful for context)
      const medsResult = await this.supabase.getPatientMedications(patientId);
      const medications = medsResult || [];

      // Fetch active reminders
      let reminders: any[] = [];
      try {
        const { data: reminderData } = await this.supabase.getClient()
          .from('reminders')
          .select('*')
          .eq('patient_id', patientId)
          .eq('is_active', true)
          .order('custom_time', { ascending: true });
        reminders = reminderData || [];
      } catch (e) {
        this.log('warn', 'Could not fetch reminders', e);
      }

      // Fetch recent health data from ALL tables (last 7 days)
      let recentActivities: any[] = [];
      try {
        const lookback = new Date();
        lookback.setDate(lookback.getDate() - 7);
        const since = lookback.toISOString();
        const client = this.supabase.getClient();

        // Query all health tables in parallel
        const [activityRes, vitalsRes, moodRes, sleepRes, exerciseRes, symptomRes, labRes, medLogRes] = await Promise.all([
          client.from('activity_logs').select('*').eq('patient_id', patientId)
            .gte('timestamp', since).order('timestamp', { ascending: false }).limit(20),
          client.from('vitals_logs').select('*').eq('patient_id', patientId)
            .gte('measured_at', since).order('measured_at', { ascending: false }).limit(10),
          client.from('mood_logs').select('*').eq('patient_id', patientId)
            .gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          client.from('sleep_logs').select('*').eq('patient_id', patientId)
            .gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          client.from('exercise_logs').select('*').eq('patient_id', patientId)
            .gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          client.from('symptoms').select('*').eq('patient_id', patientId)
            .gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          client.from('lab_results').select('*').eq('patient_id', patientId)
            .gte('lab_date', since.split('T')[0]).order('lab_date', { ascending: false }).limit(20),
          // Also query medication_logs as fallback (reminder postback may not dual-write to activity_logs)
          client.from('medication_logs').select('*').eq('patient_id', patientId)
            .gte('taken_at', since).order('taken_at', { ascending: false }).limit(20),
        ]);

        recentActivities = activityRes.data || [];

        // Add medication_logs entries that are NOT already in activity_logs (dedup by medication_log_id)
        const existingMedLogIds = new Set(
          recentActivities
            .filter(a => a.metadata?.medication_log_id)
            .map(a => a.metadata.medication_log_id)
        );
        for (const ml of (medLogRes.data || [])) {
          if (!existingMedLogIds.has(ml.id)) {
            recentActivities.push({
              task_type: 'medication',
              value: ml.medication_name || 'ยา',
              timestamp: ml.taken_at || ml.created_at,
              created_at: ml.created_at,
              _source: 'medication_logs',
              metadata: { status: ml.status, from_reminder: true }
            });
          }
        }

        // Normalize dedicated table rows into a unified format
        for (const v of (vitalsRes.data || [])) {
          const parts: string[] = [];
          if (v.bp_systolic && v.bp_diastolic) parts.push(`BP ${v.bp_systolic}/${v.bp_diastolic}`);
          if (v.heart_rate) parts.push(`HR ${v.heart_rate}`);
          if (v.weight) parts.push(`${v.weight} kg`);
          if (v.temperature) parts.push(`${v.temperature}°C`);
          if (v.glucose) parts.push(`glucose ${v.glucose}`);
          if (v.spo2) parts.push(`SpO2 ${v.spo2}%`);
          recentActivities.push({
            task_type: 'vitals', value: parts.join(', '),
            created_at: v.measured_at || v.created_at, _source: 'vitals_logs'
          });
        }
        for (const m of (moodRes.data || [])) {
          recentActivities.push({
            task_type: 'mood', value: `${m.mood}${m.stress_level ? ` stress:${m.stress_level}` : ''}`,
            created_at: m.timestamp || m.created_at, _source: 'mood_logs'
          });
        }
        for (const s of (sleepRes.data || [])) {
          recentActivities.push({
            task_type: 'sleep', value: `${s.sleep_hours || '?'} ชม.${s.sleep_quality ? ` (${s.sleep_quality})` : ''}`,
            created_at: s.created_at, _source: 'sleep_logs'
          });
        }
        for (const ex of (exerciseRes.data || [])) {
          recentActivities.push({
            task_type: 'exercise', value: `${ex.exercise_type || 'ออกกำลังกาย'}${ex.duration_minutes ? ` ${ex.duration_minutes} นาที` : ''}`,
            created_at: ex.created_at, _source: 'exercise_logs'
          });
        }
        for (const sym of (symptomRes.data || [])) {
          recentActivities.push({
            task_type: 'symptom', value: `${sym.symptom_name}${sym.severity_1to5 ? ` (${sym.severity_1to5}/5)` : ''}`,
            created_at: sym.created_at, _source: 'symptoms'
          });
        }
        for (const lr of (labRes.data || [])) {
          const statusLabel = lr.status === 'high' ? '↑สูง' : lr.status === 'low' ? '↓ต่ำ' : '';
          recentActivities.push({
            task_type: 'lab', value: `${lr.test_name}: ${lr.value}${lr.unit ? ' ' + lr.unit : ''}${statusLabel ? ' ' + statusLabel : ''}`,
            created_at: lr.lab_date ? `${lr.lab_date}T00:00:00` : lr.created_at, _source: 'lab_results'
          });
        }

        // Sort all combined activities by date descending and limit
        recentActivities.sort((a, b) =>
          new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime()
        );
        recentActivities = recentActivities.slice(0, 30);
      } catch (e) {
        this.log('warn', 'Could not fetch recent activities', e);
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
        reminders,
        recentActivities,
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
            message: 'กรุณาระบุสมาชิกที่ต้องการเปลี่ยน'
          };
        }
        return { success: false, message: 'ไม่พบสมาชิกในกลุ่ม' };
      }

      // Get all patients in group
      const { data: groupPatients } = await this.supabase.getClient()
        .from('group_patients')
        .select('*, patient_profiles(*)')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('added_at', { ascending: true });

      if (!groupPatients || groupPatients.length === 0) {
        return { success: false, message: 'ไม่พบสมาชิกในกลุ่ม' };
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
          message: `ไม่พบสมาชิกชื่อ "${text}"`,
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
        return { patients: [], message: 'ไม่มีสมาชิกในกลุ่ม' };
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
      // Example: "/setdefault ก้อย" or "ตั้งสมาชิกหลัก ก้อย"
      const text = message.content
        .replace(/^\/setdefault\s*/i, '')
        .replace(/^setdefault\s*/i, '')
        .replace(/ตั้ง.*สมาชิก.*หลัก\s*/i, '')
        .replace(/ตั้ง.*ค่า.*สมาชิก\s*/i, '')
        .trim();

      if (!text) {
        // No patient specified - return list for selection
        const patientsList = await this.getGroupPatientsList(groupId);

        if (patientsList.patients && patientsList.patients.length > 0) {
          return {
            success: false,
            requiresSelection: true,
            patients: patientsList.patients,
            message: 'กรุณาเลือกสมาชิกที่ต้องการตั้งเป็นหลัก',
            action: 'set_default'
          };
        }
        return { success: false, message: 'ไม่พบสมาชิกในกลุ่ม' };
      }

      // Get all patients in group
      const patientsList = await this.getGroupPatientsList(groupId);

      if (!patientsList.patients || patientsList.patients.length === 0) {
        return { success: false, message: 'ไม่พบสมาชิกในกลุ่ม' };
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
          message: `ไม่พบสมาชิกชื่อ "${text}"`,
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

🔍 **ถามข้อมูลสมาชิก** (พูดยังไงก็ได้):
• "ชื่ออะไร" / "เขาชื่ออะไร" / "สมาชิกชื่ออะไร"
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

👥 **กลุ่มที่มีหลายสมาชิก**:
• "ยายก้อยกินยาแล้ว" - ระบุชื่อในข้อความ (AI จะเลือกให้อัตโนมัติ)
• "/switch ก้อย" - เปลี่ยนไปดูแลสมาชิกคนอื่น
• "/switch 1" - เปลี่ยนด้วยตัวเลข
• "สมาชิกทั้งหมด" - ดูรายชื่อสมาชิกในกลุ่ม

⚙️ **ตั้งค่าสมาชิกหลัก** (Smart Default):
• "/setdefault ก้อย" - ตั้งสมาชิกหลักของคุณ (บันทึกไวขึ้น)
• "/setdefault 1" - ตั้งด้วยตัวเลข
• "/removedefault" - ลบการตั้งค่า

💡 **หมายเหตุ:**
• พิมพ์คุยได้เลย ไม่ต้อง @mention 😊
• พูดแบบไหนก็ได้ บอทจะเข้าใจ
• ตั้งสมาชิกหลัก = ไม่ต้องระบุชื่อทุกครั้ง`;
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

  // ========================================
  // Onboarding Flow Methods
  // ========================================

  /**
   * Get onboarding status for a user
   */
  private async getOnboardingStatus(userId: string): Promise<{ completed: boolean; step: string } | null> {
    try {
      const { data: user, error } = await this.supabase.getClient()
        .from('users')
        .select('onboarding_completed, onboarding_step')
        .eq('id', userId)
        .single();

      if (error || !user) {
        // User not found - assume new user, start onboarding
        return { completed: false, step: 'welcome' };
      }

      return {
        completed: user.onboarding_completed ?? false,
        step: user.onboarding_step ?? 'welcome'
      };
    } catch (error) {
      this.log('error', 'Failed to get onboarding status', error);
      // Default to completed to prevent blocking
      return { completed: true, step: 'complete' };
    }
  }

  /**
   * Handle onboarding response and update state
   */
  private async handleOnboardingResponse(
    message: Message,
    nluResult: NLUResult,
    onboardingContext: { completed: boolean; step: string },
    startTime: number
  ): Promise<Response> {
    try {
      const userId = message.context.userId;
      const patientId = message.context.patientId;

      // Determine next step based on current step and subIntent
      const currentStep = onboardingContext.step;
      let nextStep = currentStep;
      let shouldComplete = false;

      // Process based on subIntent
      switch (nluResult.subIntent) {
        case 'provide_name':
        case 'provide_nickname':
          nextStep = 'ask_birthdate';
          // Save name to patient_profiles if we have patientId
          if (patientId && nluResult.action?.data) {
            await this.saveOnboardingData(patientId, nluResult.action.data);
          }
          break;
        case 'provide_birthdate':
          nextStep = 'ask_conditions';
          if (patientId && nluResult.action?.data) {
            await this.saveOnboardingData(patientId, nluResult.action.data);
          }
          break;
        case 'provide_conditions':
          nextStep = 'complete';
          shouldComplete = true;
          if (patientId && nluResult.action?.data) {
            await this.saveOnboardingData(patientId, nluResult.action.data);
          }
          break;
        case 'skip':
          // User wants to skip - move to next step or complete
          if (currentStep === 'ask_name') {
            nextStep = 'ask_birthdate';
          } else if (currentStep === 'ask_birthdate') {
            nextStep = 'ask_conditions';
          } else {
            nextStep = 'complete';
            shouldComplete = true;
          }
          break;
        case 'start':
          nextStep = 'ask_name';
          break;
        case 'complete':
          nextStep = 'complete';
          shouldComplete = true;
          break;
        default:
          // Unknown subIntent during onboarding — if step was ask_conditions, assume completion
          if (currentStep === 'ask_conditions') {
            nextStep = 'complete';
            shouldComplete = true;
          }
          break;
      }

      // Update onboarding step in database
      if (userId) {
        await this.updateOnboardingStep(userId, nextStep, shouldComplete);
        this.log('info', `Onboarding update: userId=${userId}, step=${nextStep}, completed=${shouldComplete}, subIntent=${nluResult.subIntent}`);
      } else {
        this.log('warn', `Cannot update onboarding: userId is missing`);
      }

      return {
        success: true,
        data: {
          response: nluResult.response,
          intent: 'onboarding',
          subIntent: nluResult.subIntent,
          onboardingStep: nextStep,
          onboardingCompleted: shouldComplete
        },
        agentName: this.config.name,
        processingTime: Date.now() - startTime,
        metadata: {
          intent: 'onboarding',
          mode: 'onboarding_flow',
          onboardingStep: nextStep,
          onboardingCompleted: shouldComplete
        }
      };
    } catch (error) {
      this.log('error', 'Failed to handle onboarding response', error);
      return {
        success: false,
        error: 'Onboarding processing failed',
        agentName: this.config.name,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Update onboarding step in users table
   */
  private async updateOnboardingStep(userId: string, step: string, completed: boolean): Promise<void> {
    try {
      this.log('info', `Updating onboarding: userId=${userId}, step=${step}, completed=${completed}`);
      const { data, error, count } = await this.supabase.getClient()
        .from('users')
        .update({
          onboarding_step: step,
          onboarding_completed: completed,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('id, onboarding_step, onboarding_completed');

      if (error) {
        this.log('error', `DB error updating onboarding: ${error.message} (code: ${error.code})`, error);
        return;
      }

      if (!data || data.length === 0) {
        this.log('warn', `updateOnboardingStep matched 0 rows! userId=${userId} may not exist in users table`);
        return;
      }

      this.log('info', `Onboarding updated OK: ${JSON.stringify(data[0])}`);
    } catch (error) {
      this.log('error', 'Failed to update onboarding step', error);
    }
  }

  /**
   * Save onboarding data to patient_profiles
   */
  private async saveOnboardingData(patientId: string, data: Record<string, any>): Promise<void> {
    try {
      // Map NLU data to database fields
      const updateData: Record<string, any> = {};

      if (data.nickname) updateData.nickname = data.nickname;
      if (data.firstName) updateData.first_name = data.firstName;
      if (data.lastName) updateData.last_name = data.lastName;
      if (data.birth_date) updateData.birth_date = data.birth_date;
      if (data.medical_condition) updateData.medical_condition = data.medical_condition;
      if (data.chronic_diseases) updateData.chronic_diseases = data.chronic_diseases;

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();

        await this.supabase.getClient()
          .from('patient_profiles')
          .update(updateData)
          .eq('id', patientId);

        this.log('info', 'Saved onboarding data', updateData);
      }
    } catch (error) {
      this.log('error', 'Failed to save onboarding data', error);
    }
  }
}