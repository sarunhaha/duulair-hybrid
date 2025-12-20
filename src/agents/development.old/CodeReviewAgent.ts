// src/agents/development/CodeReviewAgent.ts

import { BaseDevAgent, DevCommand, DevResult } from './BaseDevAgent';

/**
 * CodeReviewAgent - ตรวจสอบคุณภาพโค้ด
 *
 * Capabilities:
 * - ตรวจสอบ code quality
 * - หา code smells
 * - แนะนำ best practices
 * - ตรวจสอบ security issues
 * - ตรวจสอบ performance issues
 *
 * Usage:
 * @review src/agents/specialized/HealthAgent.ts
 * @review src/agents/specialized/HealthAgent.ts --strict
 * @review src/agents/specialized/*.ts --security
 */
export class CodeReviewAgent extends BaseDevAgent {
  constructor() {
    super({
      name: 'code-review',
      role: 'Code quality reviewer and best practices advisor',
      capabilities: [
        'code-quality-check',
        'security-audit',
        'performance-analysis',
        'best-practices',
        'code-smell-detection'
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.2, // ความแม่นยำสูง
      maxTokens: 4000
    });
  }

  async process(command: DevCommand): Promise<DevResult> {
    this.log('info', `Processing code review for: ${command.target}`);

    try {
      // อ่านไฟล์
      const code = await this.readFile(command.target);

      // กำหนด review type
      const reviewType = command.context.options?.type || 'general';
      const strict = command.context.options?.strict || false;

      // สร้าง system prompt
      const systemPrompt = this.createReviewPrompt(reviewType, strict);

      // เรียก Claude
      const review = await this.callClaude(
        systemPrompt,
        `Please review this TypeScript code:\n\n\`\`\`typescript\n${code}\n\`\`\``
      );

      // Parse ผลลัพธ์
      const result = this.parseReviewResult(review);

      return {
        success: true,
        data: {
          file: command.target,
          reviewType,
          analysis: result
        },
        suggestions: result.suggestions || [],
        warnings: result.warnings || [],
        errors: result.errors || []
      };
    } catch (error: any) {
      this.log('error', 'Code review failed', error);
      return {
        success: false,
        data: null,
        errors: [error.message]
      };
    }
  }

  private createReviewPrompt(reviewType: string, strict: boolean): string {
    const basePrompt = `You are an expert TypeScript code reviewer for a healthcare monitoring system.
Your role is to review code for quality, security, and best practices.

Focus areas:
1. Code Quality: Readability, maintainability, organization
2. TypeScript Best Practices: Type safety, proper typing, interfaces
3. Security: Input validation, data sanitization, secrets management
4. Performance: Algorithmic efficiency, memory usage
5. Error Handling: Proper try-catch, error messages
6. Testing: Testability, edge cases coverage

Output format (JSON):
{
  "score": 0-100,
  "summary": "Brief overview",
  "strengths": ["..."],
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "category": "security|performance|quality|style",
      "line": 0,
      "description": "...",
      "suggestion": "..."
    }
  ],
  "suggestions": ["..."],
  "warnings": ["..."],
  "errors": ["..."]
}`;

    if (reviewType === 'security') {
      return basePrompt + `\n\nFocus HEAVILY on security issues:
- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication/authorization issues
- Secrets in code
- Input validation
- Data encryption`;
    }

    if (reviewType === 'performance') {
      return basePrompt + `\n\nFocus HEAVILY on performance:
- Algorithm complexity (Big O)
- Database query optimization
- Memory leaks
- Unnecessary computations
- Caching opportunities`;
    }

    if (strict) {
      return basePrompt + `\n\nBe VERY STRICT. Report even minor issues.`;
    }

    return basePrompt;
  }

  private parseReviewResult(review: string): any {
    try {
      // พยายาม parse JSON
      const jsonMatch = review.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // ถ้าไม่ใช่ JSON ให้สร้างผลลัพธ์แบบ simple
      return {
        score: 0,
        summary: review,
        strengths: [],
        issues: [],
        suggestions: [],
        warnings: [],
        errors: []
      };
    } catch (error) {
      this.log('warn', 'Failed to parse review result as JSON', error);
      return {
        score: 0,
        summary: review,
        strengths: [],
        issues: [],
        suggestions: [review],
        warnings: [],
        errors: []
      };
    }
  }

  /**
   * Review multiple files
   */
  async reviewMultiple(files: string[]): Promise<DevResult[]> {
    const results: DevResult[] = [];

    for (const file of files) {
      const result = await this.process({
        id: '',
        command: 'review',
        target: file,
        context: {
          timestamp: new Date()
        }
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Generate review report
   */
  generateReport(results: DevResult[]): string {
    let report = '# 📋 Code Review Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `**Files Reviewed:** ${results.length}\n\n`;

    let totalScore = 0;
    let totalIssues = 0;

    results.forEach((result, index) => {
      if (result.success) {
        const data = result.data;
        const score = data.analysis.score || 0;
        totalScore += score;

        report += `## ${index + 1}. ${data.file}\n\n`;
        report += `**Score:** ${score}/100\n\n`;
        report += `**Summary:** ${data.analysis.summary}\n\n`;

        if (data.analysis.issues && data.analysis.issues.length > 0) {
          totalIssues += data.analysis.issues.length;
          report += `### Issues (${data.analysis.issues.length})\n\n`;

          data.analysis.issues.forEach((issue: any) => {
            const emoji = this.getSeverityEmoji(issue.severity);
            report += `${emoji} **${issue.severity.toUpperCase()}** - Line ${issue.line}\n`;
            report += `- **Category:** ${issue.category}\n`;
            report += `- **Issue:** ${issue.description}\n`;
            report += `- **Fix:** ${issue.suggestion}\n\n`;
          });
        }

        if (result.suggestions && result.suggestions.length > 0) {
          report += `### Suggestions\n\n`;
          result.suggestions.forEach((suggestion: string) => {
            report += `- ${suggestion}\n`;
          });
          report += '\n';
        }
      }
    });

    const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;
    report += `---\n\n`;
    report += `## Summary\n\n`;
    report += `- **Average Score:** ${avgScore}/100\n`;
    report += `- **Total Issues:** ${totalIssues}\n`;
    report += `- **Status:** ${avgScore >= 80 ? '✅ Excellent' : avgScore >= 60 ? '⚠️ Needs Improvement' : '❌ Critical'}\n`;

    return report;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
}
