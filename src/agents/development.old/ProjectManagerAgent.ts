// src/agents/development/ProjectManagerAgent.ts

import { BaseDevAgent, DevCommand, DevResult } from './BaseDevAgent';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * ProjectManagerAgent - AI Project Manager ที่ช่วยวางแผนและบริหารโปรเจค
 *
 * Capabilities:
 * - Plan features and sprints
 * - Break down large tasks into smaller steps
 * - Estimate time and effort
 * - Track project progress
 * - Assign priorities
 * - Generate roadmaps
 * - Create sprint plans
 * - Monitor milestones
 *
 * Usage:
 * @pm plan "Add medication tracking feature"
 * @pm sprint "Create 2-week sprint plan"
 * @pm progress
 * @pm roadmap --output ROADMAP.md
 * @pm estimate "Build notification system"
 */
export class ProjectManagerAgent extends BaseDevAgent {
  private projectRoot: string;
  private tasksFile: string;

  constructor() {
    super({
      name: 'project-manager',
      role: 'AI Project Manager for planning, tracking, and orchestrating development',
      capabilities: [
        'feature-planning',
        'task-breakdown',
        'time-estimation',
        'progress-tracking',
        'priority-assignment',
        'roadmap-generation',
        'sprint-planning',
        'milestone-tracking'
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.5,
      maxTokens: 8000
    });

    this.projectRoot = process.cwd();
    this.tasksFile = path.join(this.projectRoot, '.oonjai', 'tasks.json');
  }

  async process(command: DevCommand): Promise<DevResult> {
    this.log('info', `PM command: ${command.command}`);

    try {
      const action = command.context.options?.action || 'plan';

      switch (action) {
        case 'plan':
          return await this.planFeature(command);
        case 'sprint':
          return await this.createSprintPlan(command);
        case 'progress':
          return await this.trackProgress(command);
        case 'roadmap':
          return await this.generateRoadmap(command);
        case 'estimate':
          return await this.estimateTask(command);
        case 'breakdown':
          return await this.breakdownTask(command);
        case 'prioritize':
          return await this.prioritizeTasks(command);
        default:
          return await this.planFeature(command);
      }
    } catch (error: any) {
      this.log('error', 'PM command failed', error);
      return {
        success: false,
        data: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Plan a feature with detailed breakdown
   */
  private async planFeature(command: DevCommand): Promise<DevResult> {
    const featureDescription = command.target;

    this.log('info', `Planning feature: ${featureDescription}`);

    // อ่านโครงสร้าง project
    const projectStructure = await this.analyzeProjectStructure();

    const systemPrompt = `You are an expert Project Manager for a TypeScript healthcare platform.

**Project Context:**
- Healthcare monitoring multi-agent system
- TypeScript + Node.js stack
- Supabase database
- LINE messaging
- Claude AI agents

**Current Project Structure:**
${projectStructure}

**Task:** Create a detailed implementation plan for this feature:
"${featureDescription}"

**Output JSON Format:**
{
  "feature": "Feature name",
  "description": "Detailed description",
  "priority": "high|medium|low",
  "estimatedHours": 0,
  "phases": [
    {
      "name": "Phase 1: Setup",
      "tasks": [
        {
          "id": "T1",
          "title": "Task title",
          "description": "What to do",
          "file": "path/to/file.ts",
          "estimatedMinutes": 30,
          "dependencies": [],
          "status": "pending"
        }
      ]
    }
  ],
  "filesAffected": ["path/to/file.ts"],
  "newFiles": ["path/to/new/file.ts"],
  "risks": ["Risk 1", "Risk 2"],
  "testingStrategy": "How to test this feature"
}`;

    const planResponse = await this.callClaude(systemPrompt, featureDescription);
    const plan = this.parseJSON(planResponse);

    // Save plan to tasks file
    await this.savePlan(plan);

    // Generate markdown summary
    const summary = this.generatePlanSummary(plan);

    // Save as markdown file
    const planFileName = this.generatePlanFileName(plan.feature);
    const planFilePath = path.join(this.projectRoot, 'docs', 'plans', planFileName);
    await this.writeFile(planFilePath, summary);

    return {
      success: true,
      data: {
        feature: plan.feature,
        plan,
        summary,
        planFile: planFilePath
      },
      suggestions: [
        `Plan saved to: ${planFilePath}`,
        'Review the plan carefully',
        'Adjust estimates if needed',
        'Auto-implement: npm run vibe "' + plan.feature + '"',
        'Manual: npm run dev-agent dev --implement "' + plan.phases[0].tasks[0].title + '"',
        'Track progress: npm run pm progress'
      ]
    };
  }

  /**
   * Create sprint plan
   */
  private async createSprintPlan(command: DevCommand): Promise<DevResult> {
    const duration = command.context.options?.duration || '2 weeks';
    const focus = command.target || 'Next sprint';

    this.log('info', `Creating sprint plan: ${duration}`);

    // Read existing tasks
    const existingTasks = await this.loadTasks();

    const systemPrompt = `You are a Scrum Master creating a sprint plan.

**Sprint Duration:** ${duration}
**Focus:** ${focus}

**Existing Tasks:**
${JSON.stringify(existingTasks, null, 2)}

**Task:** Create a sprint plan with:
1. Sprint goal
2. Selected tasks (realistic for timeframe)
3. Daily breakdown
4. Success criteria

**Output JSON Format:**
{
  "sprintNumber": 1,
  "duration": "${duration}",
  "goal": "Sprint goal",
  "startDate": "2024-01-16",
  "endDate": "2024-01-30",
  "tasks": [
    {
      "taskId": "T1",
      "title": "Task title",
      "assignedDay": "Day 1",
      "estimatedHours": 4
    }
  ],
  "dailyPlan": {
    "Day 1": ["T1", "T2"],
    "Day 2": ["T3"]
  },
  "successCriteria": ["Criteria 1", "Criteria 2"]
}`;

    const sprintResponse = await this.callClaude(systemPrompt, 'Create sprint plan');
    const sprint = this.parseJSON(sprintResponse);

    // Save sprint
    await this.saveSprint(sprint);

    const summary = this.generateSprintSummary(sprint);

    return {
      success: true,
      data: {
        sprint,
        summary
      },
      suggestions: [
        'Review daily plan',
        'Adjust if needed',
        'Start sprint: npm run pm start-sprint'
      ]
    };
  }

  /**
   * Track project progress
   */
  private async trackProgress(command: DevCommand): Promise<DevResult> {
    this.log('info', 'Tracking project progress');

    // Load all tasks
    const tasks = await this.loadTasks();

    // Calculate metrics
    const metrics = this.calculateMetrics(tasks);

    // Generate progress report
    const report = this.generateProgressReport(metrics, tasks);

    return {
      success: true,
      data: {
        metrics,
        tasks,
        report
      },
      suggestions: [
        'Review bottlenecks',
        'Update task statuses',
        'Celebrate completed tasks! 🎉'
      ]
    };
  }

  /**
   * Generate project roadmap
   */
  private async generateRoadmap(command: DevCommand): Promise<DevResult> {
    const timeframe = command.context.options?.timeframe || '3 months';

    this.log('info', `Generating roadmap: ${timeframe}`);

    // Analyze current state
    const currentState = await this.analyzeCurrentState();

    const systemPrompt = `You are a Product Manager creating a product roadmap.

**Timeframe:** ${timeframe}
**Current State:**
${currentState}

**Task:** Create a realistic roadmap with:
1. Phases/Milestones
2. Features per phase
3. Timeline
4. Dependencies
5. Success metrics

**Output Markdown format** (not JSON)`;

    const roadmap = await this.callClaude(systemPrompt, 'Generate roadmap');

    const outputPath = command.context.options?.output || 'ROADMAP_GENERATED.md';
    await this.writeFile(outputPath, roadmap);

    return {
      success: true,
      data: {
        roadmap,
        file: outputPath
      },
      suggestions: [
        `Roadmap saved to: ${outputPath}`,
        'Review and adjust timeline',
        'Share with team'
      ]
    };
  }

  /**
   * Estimate task complexity and time
   */
  private async estimateTask(command: DevCommand): Promise<DevResult> {
    const taskDescription = command.target;

    this.log('info', `Estimating: ${taskDescription}`);

    const systemPrompt = `You are an experienced developer estimating task complexity.

**Task:** "${taskDescription}"

**Consider:**
1. Code complexity
2. Testing requirements
3. Documentation needs
4. Integration points
5. Unknowns/risks

**Output JSON:**
{
  "task": "Task name",
  "complexity": "low|medium|high|very-high",
  "estimatedHours": 0,
  "breakdown": {
    "development": 0,
    "testing": 0,
    "documentation": 0,
    "review": 0
  },
  "risks": ["Risk 1"],
  "assumptions": ["Assumption 1"],
  "confidence": "high|medium|low"
}`;

    const estimateResponse = await this.callClaude(systemPrompt, taskDescription);
    const estimate = this.parseJSON(estimateResponse);

    return {
      success: true,
      data: estimate,
      suggestions: [
        `Estimated: ${estimate.estimatedHours} hours`,
        `Complexity: ${estimate.complexity}`,
        'Consider risks before starting'
      ]
    };
  }

  /**
   * Break down large task into smaller subtasks
   */
  private async breakdownTask(command: DevCommand): Promise<DevResult> {
    const taskDescription = command.target;

    const systemPrompt = `You are a senior developer breaking down a large task.

**Large Task:** "${taskDescription}"

**Break down into:**
1. Small, actionable subtasks (< 2 hours each)
2. Clear dependencies
3. Logical order
4. Specific deliverables

**Output JSON:**
{
  "task": "Main task",
  "subtasks": [
    {
      "id": "ST1",
      "title": "Subtask title",
      "description": "What to do",
      "estimatedMinutes": 60,
      "dependencies": [],
      "deliverable": "What you get"
    }
  ],
  "totalEstimatedHours": 0
}`;

    const breakdownResponse = await this.callClaude(systemPrompt, taskDescription);
    const breakdown = this.parseJSON(breakdownResponse);

    return {
      success: true,
      data: breakdown,
      suggestions: [
        `Broken into ${breakdown.subtasks.length} subtasks`,
        'Review dependencies',
        'Start with first subtask'
      ]
    };
  }

  /**
   * Prioritize tasks
   */
  private async prioritizeTasks(command: DevCommand): Promise<DevResult> {
    const tasks = await this.loadTasks();

    const systemPrompt = `You are a Product Manager prioritizing tasks.

**Tasks:**
${JSON.stringify(tasks, null, 2)}

**Prioritize based on:**
1. Business value
2. User impact
3. Technical dependencies
4. Risk reduction
5. Effort vs. impact

**Output JSON:**
{
  "prioritized": [
    {
      "taskId": "T1",
      "priority": "P0|P1|P2|P3",
      "reasoning": "Why this priority"
    }
  ]
}`;

    const priorityResponse = await this.callClaude(systemPrompt, 'Prioritize tasks');
    const priorities = this.parseJSON(priorityResponse);

    return {
      success: true,
      data: priorities,
      suggestions: [
        'Review priorities',
        'Focus on P0/P1 first',
        'Update task board'
      ]
    };
  }

  // ==================== Helper Methods ====================

  private async analyzeProjectStructure(): Promise<string> {
    try {
      const { glob } = await import('glob');
      const files = await glob('src/**/*.ts');
      return files.slice(0, 20).join('\n');
    } catch {
      return 'Project structure analysis unavailable';
    }
  }

  private async analyzeCurrentState(): Promise<string> {
    const tasks = await this.loadTasks();
    const readme = await this.readFile('README.md').catch(() => 'No README');
    return `Tasks: ${tasks.length}\n\nREADME:\n${readme.slice(0, 500)}`;
  }

  private async loadTasks(): Promise<any[]> {
    try {
      const content = await fs.readFile(this.tasksFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async savePlan(plan: any): Promise<void> {
    await fs.mkdir(path.dirname(this.tasksFile), { recursive: true });

    const tasks = await this.loadTasks();
    tasks.push(plan);

    await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
  }

  private async saveSprint(sprint: any): Promise<void> {
    const sprintsFile = path.join(this.projectRoot, '.oonjai', 'sprints.json');
    await fs.mkdir(path.dirname(sprintsFile), { recursive: true });

    let sprints = [];
    try {
      const content = await fs.readFile(sprintsFile, 'utf-8');
      sprints = JSON.parse(content);
    } catch {}

    sprints.push(sprint);
    await fs.writeFile(sprintsFile, JSON.stringify(sprints, null, 2));
  }

  private calculateMetrics(tasks: any[]): any {
    const total = tasks.length;
    const completed = tasks.filter((t: any) => t.status === 'completed').length;
    const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
    const pending = tasks.filter((t: any) => t.status === 'pending').length;

    return {
      total,
      completed,
      inProgress,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  private generatePlanSummary(plan: any): string {
    let summary = `# 📋 Feature Plan: ${plan.feature}\n\n`;
    summary += `**Priority:** ${plan.priority}\n`;
    summary += `**Estimated Time:** ${plan.estimatedHours} hours\n`;
    summary += `**Created:** ${new Date().toISOString()}\n\n`;

    summary += `## Description\n${plan.description}\n\n`;

    summary += `## Implementation Phases\n\n`;
    plan.phases?.forEach((phase: any, i: number) => {
      summary += `### ${i + 1}. ${phase.name}\n\n`;
      phase.tasks?.forEach((task: any) => {
        const status = task.status || 'pending';
        const statusIcon = status === 'completed' ? '✅' : status === 'in_progress' ? '🔄' : '⏳';
        summary += `- ${statusIcon} **${task.id}:** ${task.title}\n`;
        summary += `  - **Estimate:** ${task.estimatedMinutes}min\n`;
        summary += `  - **File:** \`${task.file}\`\n`;
        if (task.description) {
          summary += `  - **Details:** ${task.description}\n`;
        }
        if (task.dependencies?.length > 0) {
          summary += `  - **Depends on:** ${task.dependencies.join(', ')}\n`;
        }
        summary += '\n';
      });
    });

    if (plan.filesAffected?.length > 0) {
      summary += `## Files Affected\n\n`;
      plan.filesAffected.forEach((file: string) => {
        summary += `- \`${file}\`\n`;
      });
      summary += '\n';
    }

    if (plan.newFiles?.length > 0) {
      summary += `## New Files to Create\n\n`;
      plan.newFiles.forEach((file: string) => {
        summary += `- \`${file}\`\n`;
      });
      summary += '\n';
    }

    if (plan.risks?.length > 0) {
      summary += `## Risks\n\n`;
      plan.risks.forEach((risk: string) => summary += `- ⚠️ ${risk}\n`);
      summary += '\n';
    }

    if (plan.testingStrategy) {
      summary += `## Testing Strategy\n\n${plan.testingStrategy}\n\n`;
    }

    summary += `## Next Steps\n\n`;
    summary += `1. Review this plan\n`;
    summary += `2. Adjust estimates if needed\n`;
    summary += `3. Auto-implement all tasks:\n`;
    summary += `   \`\`\`bash\n`;
    summary += `   npm run vibe "${plan.feature}"\n`;
    summary += `   \`\`\`\n`;
    summary += `4. Or implement manually task by task\n`;
    summary += `5. Track progress: \`npm run pm progress\`\n\n`;

    summary += `---\n`;
    summary += `*Generated by ProjectManagerAgent*\n`;

    return summary;
  }

  private generatePlanFileName(featureName: string): string {
    // สร้างชื่อไฟล์จาก feature name
    // "Add blood sugar tracking" -> "add-blood-sugar-tracking.md"
    const slug = featureName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${timestamp}-${slug}.md`;
  }

  private generateSprintSummary(sprint: any): string {
    let summary = `# 🏃 Sprint ${sprint.sprintNumber} Plan\n\n`;
    summary += `**Goal:** ${sprint.goal}\n`;
    summary += `**Duration:** ${sprint.startDate} to ${sprint.endDate}\n\n`;

    summary += `## Tasks (${sprint.tasks.length})\n\n`;
    sprint.tasks?.forEach((task: any) => {
      summary += `- **${task.assignedDay}:** ${task.title} (${task.estimatedHours}h)\n`;
    });

    return summary;
  }

  private generateProgressReport(metrics: any, tasks: any[]): string {
    let report = `# 📊 Project Progress Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `## Metrics\n\n`;
    report += `- Total Tasks: ${metrics.total}\n`;
    report += `- ✅ Completed: ${metrics.completed}\n`;
    report += `- 🔄 In Progress: ${metrics.inProgress}\n`;
    report += `- ⏳ Pending: ${metrics.pending}\n`;
    report += `- 📈 Completion Rate: ${metrics.completionRate}%\n\n`;

    return report;
  }

  private parseJSON(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch {
      return {};
    }
  }
}
