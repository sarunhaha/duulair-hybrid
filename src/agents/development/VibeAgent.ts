// src/agents/development/VibeAgent.ts

import { BaseDevAgent, DevCommand, DevResult } from './BaseDevAgent';
import { ProjectManagerAgent } from './ProjectManagerAgent';
import { DeveloperAgent } from './DeveloperAgent';
import { CodeReviewAgent } from './CodeReviewAgent';
import { TestGeneratorAgent } from './TestGeneratorAgent';
import { DocumentationAgent } from './DocumentationAgent';

/**
 * VibeAgent - Auto workflow orchestrator
 *
 * ทำงานแบบ auto ไม่ต้องสั่งทีละขั้นตอน
 * เหมาะสำหรับ "vibe coding" - เขียนโค้ดแบบ flow
 *
 * Workflow:
 * 1. 📋 PM วางแผน
 * 2. 🧑‍💻 Developer implement
 * 3. 🧪 Generate tests
 * 4. 🔍 Review code
 * 5. 📚 Add docs
 * 6. ✅ Summary
 *
 * Usage:
 * @vibe "Add blood sugar tracking"
 * @vibe "Create email notification service"
 * @vibe "Fix undefined vitals bug" --file src/agents/specialized/HealthAgent.ts
 */
export class VibeAgent extends BaseDevAgent {
  private pmAgent: ProjectManagerAgent;
  private devAgent: DeveloperAgent;
  private reviewAgent: CodeReviewAgent;
  private testAgent: TestGeneratorAgent;
  private docAgent: DocumentationAgent;

  constructor() {
    super({
      name: 'vibe',
      role: 'Auto workflow orchestrator for seamless development',
      capabilities: [
        'auto-planning',
        'auto-implementation',
        'auto-testing',
        'auto-review',
        'auto-documentation',
        'full-workflow-orchestration'
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.4,
      maxTokens: 8000
    });

    this.pmAgent = new ProjectManagerAgent();
    this.devAgent = new DeveloperAgent();
    this.reviewAgent = new CodeReviewAgent();
    this.testAgent = new TestGeneratorAgent();
    this.docAgent = new DocumentationAgent();
  }

  async process(command: DevCommand): Promise<DevResult> {
    const feature = command.target;
    const skipSteps = command.context.options?.skip || [];
    const targetFile = command.context.options?.file;

    console.log('\n🎵 Vibe Mode Activated! 🎵\n');
    console.log(`Feature: ${feature}\n`);
    console.log('═══════════════════════════════════════\n');

    const workflow: any = {
      feature,
      steps: [],
      startTime: Date.now(),
      success: true
    };

    try {
      // Step 1: Plan (unless skipped)
      if (!skipSteps.includes('plan')) {
        workflow.steps.push(await this.stepPlan(feature));
      }

      // Step 2: Implement
      workflow.steps.push(await this.stepImplement(feature, targetFile));

      // Step 3: Generate Tests (unless skipped)
      if (!skipSteps.includes('test')) {
        const implementedFile = workflow.steps[workflow.steps.length - 1]?.file;
        if (implementedFile) {
          workflow.steps.push(await this.stepTest(implementedFile));
        }
      }

      // Step 4: Review (unless skipped)
      if (!skipSteps.includes('review')) {
        const implementedFile = workflow.steps.find((s: any) => s.name === 'implement')?.file;
        if (implementedFile) {
          workflow.steps.push(await this.stepReview(implementedFile));
        }
      }

      // Step 5: Document (unless skipped)
      if (!skipSteps.includes('doc')) {
        const implementedFile = workflow.steps.find((s: any) => s.name === 'implement')?.file;
        if (implementedFile) {
          workflow.steps.push(await this.stepDocument(implementedFile));
        }
      }

      // Final Summary
      workflow.endTime = Date.now();
      workflow.duration = Math.round((workflow.endTime - workflow.startTime) / 1000);

      const summary = this.generateSummary(workflow);

      return {
        success: true,
        data: {
          workflow,
          summary
        },
        suggestions: this.generateSuggestions(workflow)
      };

    } catch (error: any) {
      this.log('error', 'Vibe workflow failed', error);
      workflow.success = false;
      workflow.error = error.message;

      return {
        success: false,
        data: { workflow },
        errors: [error.message]
      };
    }
  }

  /**
   * Step 1: Plan with PM
   */
  private async stepPlan(feature: string): Promise<any> {
    console.log('📋 Step 1/5: Planning...');
    const startTime = Date.now();

    try {
      const result = await this.pmAgent.process({
        id: '',
        command: 'pm',
        target: feature,
        context: {
          options: { action: 'plan' },
          timestamp: new Date()
        }
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Plan created (${Math.round(duration / 1000)}s)`);
        console.log(`   Tasks: ${result.data.plan?.phases?.length || 0} phases\n`);
      } else {
        console.log(`⚠️  Plan skipped (${Math.round(duration / 1000)}s)\n`);
      }

      return {
        name: 'plan',
        success: result.success,
        duration,
        data: result.data
      };
    } catch (error: any) {
      console.log(`⚠️  Plan failed: ${error.message}\n`);
      return {
        name: 'plan',
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Step 2: Implement with Developer
   */
  private async stepImplement(feature: string, targetFile?: string): Promise<any> {
    console.log('🧑‍💻 Step 2/5: Implementing...');
    const startTime = Date.now();

    try {
      const result = await this.devAgent.process({
        id: '',
        command: 'dev',
        target: feature,
        context: {
          options: {
            type: 'implement',
            file: targetFile
          },
          timestamp: new Date()
        }
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Implementation complete (${Math.round(duration / 1000)}s)`);
        console.log(`   File: ${result.data.file || 'N/A'}\n`);
      } else {
        console.log(`❌ Implementation failed (${Math.round(duration / 1000)}s)\n`);
      }

      return {
        name: 'implement',
        success: result.success,
        duration,
        file: result.data.file,
        backup: result.data.backup,
        data: result.data
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`❌ Implementation failed: ${error.message}\n`);
      return {
        name: 'implement',
        success: false,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Step 3: Generate Tests
   */
  private async stepTest(file: string): Promise<any> {
    console.log('🧪 Step 3/5: Generating tests...');
    const startTime = Date.now();

    try {
      const result = await this.testAgent.process({
        id: '',
        command: 'test',
        target: file,
        context: {
          options: { type: 'unit', mock: true },
          timestamp: new Date()
        }
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Tests generated (${Math.round(duration / 1000)}s)`);
        console.log(`   Test file: ${result.data.testFile || 'N/A'}\n`);
      } else {
        console.log(`⚠️  Test generation skipped (${Math.round(duration / 1000)}s)\n`);
      }

      return {
        name: 'test',
        success: result.success,
        duration,
        testFile: result.data.testFile,
        data: result.data
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`⚠️  Test generation failed: ${error.message}\n`);
      return {
        name: 'test',
        success: false,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Step 4: Review Code
   */
  private async stepReview(file: string): Promise<any> {
    console.log('🔍 Step 4/5: Reviewing code...');
    const startTime = Date.now();

    try {
      const result = await this.reviewAgent.process({
        id: '',
        command: 'review',
        target: file,
        context: {
          options: { type: 'general', strict: false },
          timestamp: new Date()
        }
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        const score = result.data.analysis?.score || 0;
        const issues = result.data.analysis?.issues?.length || 0;
        console.log(`✅ Review complete (${Math.round(duration / 1000)}s)`);
        console.log(`   Score: ${score}/100, Issues: ${issues}\n`);
      } else {
        console.log(`⚠️  Review skipped (${Math.round(duration / 1000)}s)\n`);
      }

      return {
        name: 'review',
        success: result.success,
        duration,
        score: result.data.analysis?.score,
        issues: result.data.analysis?.issues?.length || 0,
        data: result.data
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`⚠️  Review failed: ${error.message}\n`);
      return {
        name: 'review',
        success: false,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Step 5: Add Documentation
   */
  private async stepDocument(file: string): Promise<any> {
    console.log('📚 Step 5/5: Adding documentation...');
    const startTime = Date.now();

    try {
      const result = await this.docAgent.process({
        id: '',
        command: 'doc',
        target: file,
        context: {
          options: { type: 'jsdoc' },
          timestamp: new Date()
        }
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Documentation added (${Math.round(duration / 1000)}s)\n`);
      } else {
        console.log(`⚠️  Documentation skipped (${Math.round(duration / 1000)}s)\n`);
      }

      return {
        name: 'document',
        success: result.success,
        duration,
        data: result.data
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`⚠️  Documentation failed: ${error.message}\n`);
      return {
        name: 'document',
        success: false,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Generate final summary
   */
  private generateSummary(workflow: any): string {
    let summary = '\n';
    summary += '═══════════════════════════════════════\n';
    summary += '🎉 Vibe Session Complete!\n';
    summary += '═══════════════════════════════════════\n\n';

    summary += `Feature: ${workflow.feature}\n`;
    summary += `Duration: ${workflow.duration}s\n`;
    summary += `Success: ${workflow.success ? '✅' : '❌'}\n\n`;

    summary += 'Steps:\n';
    workflow.steps.forEach((step: any) => {
      const status = step.success ? '✅' : '⚠️';
      summary += `  ${status} ${step.name} (${Math.round(step.duration / 1000)}s)\n`;
    });

    const implementStep = workflow.steps.find((s: any) => s.name === 'implement');
    if (implementStep?.file) {
      summary += `\nFiles:\n`;
      summary += `  📄 ${implementStep.file}\n`;
      if (implementStep.backup) {
        summary += `  💾 ${implementStep.backup}\n`;
      }

      const testStep = workflow.steps.find((s: any) => s.name === 'test');
      if (testStep?.testFile) {
        summary += `  🧪 ${testStep.testFile}\n`;
      }
    }

    const reviewStep = workflow.steps.find((s: any) => s.name === 'review');
    if (reviewStep?.score) {
      summary += `\nCode Quality:\n`;
      summary += `  📊 Score: ${reviewStep.score}/100\n`;
      summary += `  ⚠️  Issues: ${reviewStep.issues}\n`;
    }

    return summary;
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(workflow: any): string[] {
    const suggestions: string[] = [];

    const implementStep = workflow.steps.find((s: any) => s.name === 'implement');
    if (implementStep?.file) {
      suggestions.push('Review generated code: git diff');
      suggestions.push(`Run tests: npm test`);
    }

    const reviewStep = workflow.steps.find((s: any) => s.name === 'review');
    if (reviewStep?.score && reviewStep.score < 80) {
      suggestions.push(`Code score is ${reviewStep.score}/100 - consider improvements`);
    }

    if (implementStep?.backup) {
      suggestions.push(`Backup created: rm ${implementStep.backup} if satisfied`);
    }

    suggestions.push('Commit when ready: git add . && git commit');

    return suggestions;
  }

  /**
   * Quick vibe - minimal workflow
   */
  async quickVibe(feature: string, targetFile?: string): Promise<DevResult> {
    return this.process({
      id: '',
      command: 'vibe',
      target: feature,
      context: {
        options: {
          file: targetFile,
          skip: ['doc'] // Skip documentation in quick mode
        },
        timestamp: new Date()
      }
    });
  }

  /**
   * Full vibe - complete workflow
   */
  async fullVibe(feature: string, targetFile?: string): Promise<DevResult> {
    return this.process({
      id: '',
      command: 'vibe',
      target: feature,
      context: {
        options: {
          file: targetFile,
          skip: [] // Nothing skipped
        },
        timestamp: new Date()
      }
    });
  }
}
