// src/agents/development/DebugAgent.ts

import { BaseDevAgent, DevCommand, DevResult } from './BaseDevAgent';

/**
 * DebugAgent - ช่วยหาและแก้ไข bugs
 *
 * Capabilities:
 * - วิเคราะห์ error messages
 * - หาสาเหตุของ bugs
 * - แนะนำวิธีแก้ไข
 * - สร้าง debug logs
 * - Trace execution flow
 *
 * Usage:
 * @debug src/agents/specialized/HealthAgent.ts --error "TypeError: Cannot read property 'map' of undefined"
 * @debug src/services/supabase.service.ts --issue "Connection timeout"
 * @debug . --analyze-logs
 */
export class DebugAgent extends BaseDevAgent {
  constructor() {
    super({
      name: 'debug',
      role: 'Bug hunter and debugging assistant',
      capabilities: [
        'error-analysis',
        'bug-detection',
        'fix-suggestion',
        'log-analysis',
        'execution-tracing'
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.2, // ความแม่นยำสูง
      maxTokens: 4000
    });
  }

  async process(command: DevCommand): Promise<DevResult> {
    this.log('info', `Debugging: ${command.target}`);

    try {
      const debugType = command.context.options?.type || 'error';

      switch (debugType) {
        case 'error':
          return await this.analyzeError(command);
        case 'performance':
          return await this.analyzePerformance(command);
        case 'logs':
          return await this.analyzeLogs(command);
        default:
          return await this.analyzeCode(command);
      }
    } catch (error: any) {
      this.log('error', 'Debugging failed', error);
      return {
        success: false,
        data: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Analyze error and suggest fixes
   */
  private async analyzeError(command: DevCommand): Promise<DevResult> {
    const sourceCode = await this.readFile(command.target);
    const errorMessage = command.context.options?.error || '';
    const stackTrace = command.context.options?.stack || '';

    const systemPrompt = `You are an expert debugger specializing in TypeScript and Node.js.

**Task:** Analyze the error and provide:
1. Root cause analysis
2. Affected code location (line numbers)
3. Step-by-step fix
4. Prevention tips

**Output Format (JSON):**
{
  "rootCause": "...",
  "affectedLines": [10, 20, 30],
  "analysis": "...",
  "fix": {
    "description": "...",
    "steps": ["1. ...", "2. ...", "3. ..."],
    "code": "// Fixed code here"
  },
  "prevention": ["..."]
}`;

    const analysis = await this.callClaude(
      systemPrompt,
      `Analyze this error:

**Error Message:**
${errorMessage}

**Stack Trace:**
${stackTrace}

**Source Code:**
\`\`\`typescript
${sourceCode}
\`\`\`

Provide root cause analysis and fix.`
    );

    const result = this.parseDebugResult(analysis);

    return {
      success: true,
      data: {
        file: command.target,
        error: errorMessage,
        analysis: result
      },
      suggestions: result.prevention || [],
      warnings: result.warnings || []
    };
  }

  /**
   * Analyze performance issues
   */
  private async analyzePerformance(command: DevCommand): Promise<DevResult> {
    const sourceCode = await this.readFile(command.target);

    const systemPrompt = `You are a performance optimization expert.

Analyze the code for:
1. Time complexity (Big O)
2. Space complexity
3. Bottlenecks
4. Optimization opportunities

Output format (JSON):
{
  "score": 0-100,
  "issues": [
    {
      "line": 0,
      "issue": "...",
      "impact": "high|medium|low",
      "suggestion": "..."
    }
  ],
  "optimizations": ["..."]
}`;

    const analysis = await this.callClaude(
      systemPrompt,
      `Analyze performance of this code:\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``
    );

    const result = this.parseDebugResult(analysis);

    return {
      success: true,
      data: {
        file: command.target,
        analysis: result
      },
      suggestions: result.optimizations || []
    };
  }

  /**
   * Analyze log files
   */
  private async analyzeLogs(command: DevCommand): Promise<DevResult> {
    const logs = await this.readFile(command.target);

    const systemPrompt = `You are a log analysis expert.

Analyze the logs and identify:
1. Error patterns
2. Warning patterns
3. Performance issues
4. Security concerns
5. Anomalies

Output format (JSON):
{
  "summary": "...",
  "errors": [{"timestamp": "...", "message": "...", "count": 0}],
  "warnings": [...],
  "patterns": [...],
  "recommendations": [...]
}`;

    const analysis = await this.callClaude(
      systemPrompt,
      `Analyze these logs:\n\n${logs}`
    );

    const result = this.parseDebugResult(analysis);

    return {
      success: true,
      data: {
        file: command.target,
        analysis: result
      },
      warnings: result.warnings || [],
      errors: result.errors || [],
      suggestions: result.recommendations || []
    };
  }

  /**
   * General code analysis
   */
  private async analyzeCode(command: DevCommand): Promise<DevResult> {
    const sourceCode = await this.readFile(command.target);

    const systemPrompt = `You are a code analyst looking for potential bugs.

Analyze for:
1. Logic errors
2. Type errors
3. Null/undefined issues
4. Race conditions
5. Edge cases not handled

Output potential issues with line numbers and severity.`;

    const analysis = await this.callClaude(
      systemPrompt,
      `Find potential bugs in this code:\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``
    );

    return {
      success: true,
      data: {
        file: command.target,
        analysis
      }
    };
  }

  /**
   * Generate debug logs
   */
  async generateDebugLogs(filePath: string): Promise<string> {
    const sourceCode = await this.readFile(filePath);

    const systemPrompt = `Add comprehensive debug logging to this code.

Add console.log or logger statements at:
1. Function entry/exit
2. Before/after critical operations
3. Error conditions
4. State changes

Use structured logging format.`;

    const codeWithLogs = await this.callClaude(
      systemPrompt,
      `Add debug logs to:\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``
    );

    return codeWithLogs;
  }

  /**
   * Trace execution flow
   */
  async traceFlow(filePath: string, functionName: string): Promise<string> {
    const sourceCode = await this.readFile(filePath);

    const systemPrompt = `Trace the execution flow of function: ${functionName}

Create a step-by-step execution trace showing:
1. Input parameters
2. Each operation
3. Conditional branches
4. Function calls
5. Return value

Use Mermaid flowchart syntax.`;

    const flowTrace = await this.callClaude(
      systemPrompt,
      `Trace execution flow:\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``
    );

    return flowTrace;
  }

  private parseDebugResult(result: string): any {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { analysis: result };
    } catch {
      return { analysis: result };
    }
  }

  /**
   * Generate debug report
   */
  generateReport(result: DevResult): string {
    let report = '# 🐛 Debug Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**File:** ${result.data.file}\n\n`;

    if (result.data.error) {
      report += `## Error\n\n`;
      report += `\`\`\`\n${result.data.error}\n\`\`\`\n\n`;
    }

    if (result.data.analysis) {
      const analysis = result.data.analysis;

      if (analysis.rootCause) {
        report += `## Root Cause\n\n${analysis.rootCause}\n\n`;
      }

      if (analysis.fix) {
        report += `## Fix\n\n`;
        report += `${analysis.fix.description}\n\n`;
        report += `### Steps\n\n`;
        analysis.fix.steps?.forEach((step: string, i: number) => {
          report += `${i + 1}. ${step}\n`;
        });
        report += `\n`;

        if (analysis.fix.code) {
          report += `### Code\n\n\`\`\`typescript\n${analysis.fix.code}\n\`\`\`\n\n`;
        }
      }
    }

    if (result.suggestions && result.suggestions.length > 0) {
      report += `## Prevention Tips\n\n`;
      result.suggestions.forEach((tip: string) => {
        report += `- ${tip}\n`;
      });
    }

    return report;
  }
}
