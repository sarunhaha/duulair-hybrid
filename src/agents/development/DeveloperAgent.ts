// src/agents/development/DeveloperAgent.ts

import { BaseDevAgent, DevCommand, DevResult } from './BaseDevAgent';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * DeveloperAgent - นักพัฒนา AI ที่ช่วยเขียนโค้ดจริงๆ
 *
 * Capabilities:
 * - Implement new features/functions
 * - Create new files with complete implementation
 * - Modify existing files
 * - Refactor code
 * - Fix bugs with actual code changes
 * - Add new endpoints/services/agents
 *
 * Usage:
 * @dev "Add blood sugar tracking to HealthAgent"
 * @dev "Create NotificationService for sending emails"
 * @dev "Implement medication reminder scheduler"
 * @dev --file src/agents/specialized/HealthAgent.ts "Add OCR for BP monitor images"
 */
export class DeveloperAgent extends BaseDevAgent {
  constructor() {
    super({
      name: 'developer',
      role: 'AI developer that implements features and writes code',
      capabilities: [
        'feature-implementation',
        'code-generation',
        'file-creation',
        'code-modification',
        'refactoring',
        'bug-fixing'
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.4, // Balance creativity with accuracy
      maxTokens: 8000 // Need more tokens for code generation
    });
  }

  async process(command: DevCommand): Promise<DevResult> {
    this.log('info', `Implementing: ${command.target}`);

    try {
      const taskType = command.context.options?.type || 'implement';

      switch (taskType) {
        case 'implement':
          return await this.implementFeature(command);
        case 'create':
          return await this.createNewFile(command);
        case 'modify':
          return await this.modifyExistingFile(command);
        case 'refactor':
          return await this.refactorCode(command);
        case 'fix':
          return await this.fixBug(command);
        default:
          return await this.implementFeature(command);
      }
    } catch (error: any) {
      this.log('error', 'Implementation failed', error);
      return {
        success: false,
        data: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Implement a new feature
   */
  private async implementFeature(command: DevCommand): Promise<DevResult> {
    const description = command.target;
    const targetFile = command.context.options?.file;

    this.log('info', `Implementing feature: ${description}`);

    // ถ้าระบุไฟล์ = แก้ไขไฟล์เดิม
    if (targetFile) {
      return await this.addFeatureToFile(targetFile, description);
    }

    // ถ้าไม่ระบุ = วิเคราะห์ว่าควรสร้างไฟล์ใหม่หรือแก้ไขไฟล์ไหน
    return await this.analyzeAndImplement(description);
  }

  /**
   * Add feature to existing file
   */
  private async addFeatureToFile(filePath: string, feature: string): Promise<DevResult> {
    const existingCode = await this.readFile(filePath);

    const systemPrompt = `You are an expert TypeScript developer working on the OONJAI (อุ่นใจ) healthcare platform.

**Task:** Add the following feature to the existing code:
"${feature}"

**Requirements:**
1. Maintain existing code structure
2. Follow TypeScript best practices
3. Add proper type definitions
4. Include error handling
5. Add JSDoc comments
6. Match existing code style
7. Don't break existing functionality

**Output:** The COMPLETE updated file with the new feature integrated.`;

    const implementation = await this.callClaude(
      systemPrompt,
      `Existing code:\n\n\`\`\`typescript\n${existingCode}\n\`\`\`\n\nAdd the feature: "${feature}"`
    );

    // Extract code from markdown if needed
    const code = this.extractCode(implementation);

    // Backup original file
    const backupPath = `${filePath}.backup`;
    await this.writeFile(backupPath, existingCode);

    // Write new code
    await this.writeFile(filePath, code);

    return {
      success: true,
      data: {
        file: filePath,
        feature,
        backup: backupPath,
        implementation: code
      },
      suggestions: [
        'Review the changes carefully',
        'Run tests to verify functionality',
        `Backup saved at: ${backupPath}`,
        'Delete backup if satisfied: rm ' + backupPath
      ]
    };
  }

  /**
   * Create a new file with implementation
   */
  private async createNewFile(command: DevCommand): Promise<DevResult> {
    const description = command.target;
    const fileName = command.context.options?.name || this.generateFileName(description);
    const fileType = command.context.options?.fileType || 'service';

    this.log('info', `Creating new ${fileType}: ${fileName}`);

    const systemPrompt = this.getCreationPrompt(fileType);

    const implementation = await this.callClaude(
      systemPrompt,
      `Create a ${fileType} for: "${description}"\n\nFile name: ${fileName}`
    );

    const code = this.extractCode(implementation);
    const filePath = this.getFilePath(fileName, fileType);

    await this.writeFile(filePath, code);

    return {
      success: true,
      data: {
        file: filePath,
        type: fileType,
        description,
        implementation: code
      },
      suggestions: [
        'Review the generated code',
        'Generate tests: npm run test:gen ' + filePath,
        'Add to git: git add ' + filePath
      ]
    };
  }

  /**
   * Modify existing file
   */
  private async modifyExistingFile(command: DevCommand): Promise<DevResult> {
    const filePath = command.target;
    const modification = command.context.options?.modification || '';

    const existingCode = await this.readFile(filePath);

    const systemPrompt = `You are an expert TypeScript developer.

**Task:** Make the following modification to the code:
"${modification}"

**Requirements:**
1. Preserve all existing functionality
2. Make minimal changes
3. Add proper error handling
4. Update JSDoc if needed
5. Follow existing code style

**Output:** The COMPLETE updated file.`;

    const modifiedCode = await this.callClaude(
      systemPrompt,
      `Existing code:\n\n\`\`\`typescript\n${existingCode}\n\`\`\`\n\nModify: "${modification}"`
    );

    const code = this.extractCode(modifiedCode);

    // Backup
    const backupPath = `${filePath}.backup`;
    await this.writeFile(backupPath, existingCode);

    // Write
    await this.writeFile(filePath, code);

    return {
      success: true,
      data: {
        file: filePath,
        modification,
        backup: backupPath
      },
      suggestions: [
        'Review changes',
        'Run tests',
        `Backup: ${backupPath}`
      ]
    };
  }

  /**
   * Refactor code
   */
  private async refactorCode(command: DevCommand): Promise<DevResult> {
    const filePath = command.target;
    const refactorType = command.context.options?.refactorType || 'improve';

    const existingCode = await this.readFile(filePath);

    const systemPrompt = `You are an expert at code refactoring.

**Refactor Type:** ${refactorType}
${this.getRefactorGuidelines(refactorType)}

**Requirements:**
1. Preserve exact functionality
2. Improve code quality
3. Maintain type safety
4. Update JSDoc
5. Add unit tests suggestions

**Output:** The COMPLETE refactored file.`;

    const refactoredCode = await this.callClaude(
      systemPrompt,
      `Refactor this code:\n\n\`\`\`typescript\n${existingCode}\n\`\`\``
    );

    const code = this.extractCode(refactoredCode);

    // Backup
    const backupPath = `${filePath}.backup`;
    await this.writeFile(backupPath, existingCode);

    // Write
    await this.writeFile(filePath, code);

    return {
      success: true,
      data: {
        file: filePath,
        refactorType,
        backup: backupPath
      },
      suggestions: [
        'Review refactored code carefully',
        'Run all tests to ensure functionality preserved',
        'Check git diff to see changes'
      ]
    };
  }

  /**
   * Fix bug with actual code
   */
  private async fixBug(command: DevCommand): Promise<DevResult> {
    const filePath = command.target;
    const bugDescription = command.context.options?.bug || '';
    const errorMessage = command.context.options?.error || '';

    const existingCode = await this.readFile(filePath);

    const systemPrompt = `You are an expert debugger and developer.

**Bug:** ${bugDescription}
**Error:** ${errorMessage}

**Task:** Fix the bug in the code.

**Requirements:**
1. Identify root cause
2. Implement fix
3. Add validation to prevent recurrence
4. Add error handling
5. Add JSDoc explaining the fix
6. Suggest tests for the fix

**Output:** The COMPLETE fixed file.`;

    const fixedCode = await this.callClaude(
      systemPrompt,
      `Fix the bug in this code:\n\n\`\`\`typescript\n${existingCode}\n\`\`\``
    );

    const code = this.extractCode(fixedCode);

    // Backup
    const backupPath = `${filePath}.backup`;
    await this.writeFile(backupPath, existingCode);

    // Write
    await this.writeFile(filePath, code);

    return {
      success: true,
      data: {
        file: filePath,
        bug: bugDescription,
        backup: backupPath
      },
      suggestions: [
        'Review the fix',
        'Run tests to verify',
        'Generate tests for this fix: npm run test:gen ' + filePath
      ]
    };
  }

  /**
   * Analyze and decide how to implement
   */
  private async analyzeAndImplement(description: string): Promise<DevResult> {
    const systemPrompt = `You are a senior software architect.

**Task:** Analyze this feature request and decide:
1. Should we create a new file or modify existing?
2. What file(s) are affected?
3. What type of component (agent, service, controller)?

**Feature:** "${description}"

**Output JSON:**
{
  "action": "create" | "modify",
  "fileType": "agent" | "service" | "controller" | "utility",
  "targetFiles": ["path/to/file.ts"],
  "reasoning": "explanation"
}`;

    const analysis = await this.callClaude(systemPrompt, description);
    const plan = this.parseJSON(analysis);

    if (plan.action === 'create') {
      return await this.createNewFile({
        id: '',
        command: 'dev',
        target: description,
        context: {
          options: { type: 'create', fileType: plan.fileType },
          timestamp: new Date()
        }
      });
    } else {
      // Modify existing file
      return await this.addFeatureToFile(plan.targetFiles[0], description);
    }
  }

  /**
   * Helper: Extract code from markdown
   */
  private extractCode(response: string): string {
    // Try to extract from markdown code block
    const codeBlockMatch = response.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If no code block, assume entire response is code
    return response.trim();
  }

  /**
   * Helper: Generate file name from description
   */
  private generateFileName(description: string): string {
    // Simple heuristic
    const words = description.toLowerCase().split(' ');
    const name = words
      .filter(w => !['a', 'an', 'the', 'for', 'to', 'add', 'create'].includes(w))
      .slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    return name || 'NewFeature';
  }

  /**
   * Helper: Get file path based on type
   */
  private getFilePath(fileName: string, fileType: string): string {
    const baseDir = process.cwd();
    const typeMap: Record<string, string> = {
      'agent': 'src/agents/specialized',
      'service': 'src/services',
      'controller': 'src/controllers',
      'utility': 'src/utils'
    };

    const dir = typeMap[fileType] || 'src';
    return path.join(baseDir, dir, `${fileName}.ts`);
  }

  /**
   * Helper: Get creation prompt based on type
   */
  private getCreationPrompt(fileType: string): string {
    const basePrompt = `You are an expert TypeScript developer for the OONJAI (อุ่นใจ) healthcare platform.

**Project Context:**
- Healthcare monitoring system
- Multi-agent architecture
- TypeScript + Node.js
- Supabase for database
- LINE for messaging
- Claude AI for agents

**Code Style:**
- Use TypeScript strict mode
- Add comprehensive JSDoc
- Include error handling
- Use async/await
- Follow existing patterns in the codebase
`;

    const typePrompts: Record<string, string> = {
      'agent': `${basePrompt}
**Task:** Create a new specialized agent.

**Requirements:**
1. Extend BaseAgent class
2. Implement process() method
3. Use Zod for validation
4. Add proper types
5. Include examples in JSDoc

**Template:**
\`\`\`typescript
import { BaseAgent } from '../core/BaseAgent';

export class YourAgent extends BaseAgent {
  constructor() {
    super({
      name: 'your-agent',
      role: '...',
      capabilities: [...],
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
      maxTokens: 1000
    });
  }

  async process(message: Message): Promise<AgentResult> {
    // Implementation
  }
}
\`\`\``,
      'service': `${basePrompt}
**Task:** Create a new service class.

**Requirements:**
1. Export a class with clear methods
2. Add error handling
3. Use async/await
4. Add JSDoc for all public methods
5. Include usage examples`,
      'controller': `${basePrompt}
**Task:** Create a new Express controller.

**Requirements:**
1. Export router
2. Add request validation
3. Include error handling
4. Add JSDoc
5. Follow REST conventions`,
      'utility': `${basePrompt}
**Task:** Create a utility module.

**Requirements:**
1. Pure functions preferred
2. Strong typing
3. Comprehensive JSDoc
4. Include unit test examples`
    };

    return typePrompts[fileType] || basePrompt;
  }

  /**
   * Helper: Get refactor guidelines
   */
  private getRefactorGuidelines(refactorType: string): string {
    const guidelines: Record<string, string> = {
      'improve': `
- Simplify complex logic
- Extract reusable functions
- Improve naming
- Remove duplication
- Add helpful comments`,
      'performance': `
- Optimize algorithms
- Reduce memory usage
- Cache expensive operations
- Use efficient data structures
- Minimize API calls`,
      'readability': `
- Clear variable names
- Extract magic numbers
- Add explanatory comments
- Simplify nested logic
- Consistent formatting`,
      'modular': `
- Extract functions
- Separate concerns
- Create reusable utilities
- Reduce coupling
- Improve cohesion`
    };

    return guidelines[refactorType] || guidelines['improve'];
  }

  /**
   * Helper: Parse JSON from response
   */
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
