// src/agents/development/DocumentationAgent.ts

import { BaseDevAgent, DevCommand, DevResult } from './BaseDevAgent';

/**
 * DocumentationAgent - สร้างและอัปเดต documentation
 *
 * Capabilities:
 * - สร้าง JSDoc comments
 * - สร้าง README.md
 * - สร้าง API documentation
 * - สร้าง architecture diagrams (Mermaid)
 * - อัปเดต existing docs
 *
 * Usage:
 * @doc src/agents/specialized/HealthAgent.ts
 * @doc src/agents/specialized/HealthAgent.ts --jsdoc
 * @doc . --readme
 * @doc . --architecture
 */
export class DocumentationAgent extends BaseDevAgent {
  constructor() {
    super({
      name: 'documentation',
      role: 'Documentation generator and maintainer',
      capabilities: [
        'jsdoc-generation',
        'readme-generation',
        'api-doc-generation',
        'diagram-generation',
        'doc-updating'
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.4,
      maxTokens: 4000
    });
  }

  async process(command: DevCommand): Promise<DevResult> {
    this.log('info', `Generating documentation for: ${command.target}`);

    try {
      const docType = command.context.options?.type || 'jsdoc';

      switch (docType) {
        case 'jsdoc':
          return await this.generateJSDoc(command);
        case 'readme':
          return await this.generateReadme(command);
        case 'api':
          return await this.generateAPIDocs(command);
        case 'architecture':
          return await this.generateArchitectureDiagram(command);
        default:
          throw new Error(`Unknown doc type: ${docType}`);
      }
    } catch (error: any) {
      this.log('error', 'Documentation generation failed', error);
      return {
        success: false,
        data: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Generate JSDoc comments for a file
   */
  private async generateJSDoc(command: DevCommand): Promise<DevResult> {
    const sourceCode = await this.readFile(command.target);

    const systemPrompt = `You are a documentation expert specializing in TypeScript and JSDoc.

**Task:** Add comprehensive JSDoc comments to the provided TypeScript code.

**Guidelines:**
1. Add JSDoc for all classes, methods, functions, and interfaces
2. Use @param for parameters with types and descriptions
3. Use @returns for return values
4. Use @throws for exceptions
5. Use @example for usage examples
6. Add clear descriptions
7. Keep descriptions concise but informative

**Format:**
\`\`\`typescript
/**
 * Brief description of what this does
 *
 * More detailed explanation if needed.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When error occurs
 * @example
 * const result = someFunction('input');
 */
\`\`\`

Output the COMPLETE code file with JSDoc comments added. Preserve all existing code.`;

    const documented = await this.callClaude(
      systemPrompt,
      `Add JSDoc comments to this TypeScript code:\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``
    );

    // เขียนกลับไปที่ไฟล์เดิม (backup ก่อน)
    const backupPath = command.target + '.backup';
    await this.writeFile(backupPath, sourceCode);
    await this.writeFile(command.target, documented);

    return {
      success: true,
      data: {
        file: command.target,
        backup: backupPath,
        documentation: documented
      },
      suggestions: [
        'Review the generated JSDoc comments',
        `Backup saved at: ${backupPath}`,
        'Delete backup if satisfied: rm ' + backupPath
      ]
    };
  }

  /**
   * Generate README.md for a directory or project
   */
  private async generateReadme(command: DevCommand): Promise<DevResult> {
    const baseDir = command.target;

    // อ่านไฟล์สำคัญ
    const packageJson = await this.readFile(`${baseDir}/package.json`).catch(() => '{}');
    const tsConfig = await this.readFile(`${baseDir}/tsconfig.json`).catch(() => '{}');

    // หาไฟล์ทั้งหมดใน project
    const files = await this.findFiles('**/*.ts', baseDir);

    const systemPrompt = `You are a technical writer creating README.md for a TypeScript project.

**Project Type:** Healthcare monitoring multi-agent system

**README Structure:**
1. Project title and description
2. Features
3. Architecture overview
4. Quick start guide
5. Installation instructions
6. Usage examples
7. API documentation (brief)
8. Configuration
9. Testing
10. Contributing
11. License

Use proper Markdown formatting, emojis for visual appeal, and code examples.`;

    const readme = await this.callClaude(
      systemPrompt,
      `Generate a comprehensive README.md for this project.

Package.json:
${packageJson}

TypeScript files:
${files.slice(0, 20).join('\n')}

Create a professional, clear, and helpful README.`
    );

    const readmePath = `${baseDir}/README.md`;
    await this.writeFile(readmePath, readme);

    return {
      success: true,
      data: {
        file: readmePath,
        content: readme
      },
      suggestions: [
        'Review and customize the README',
        'Add project-specific details',
        'Update badges and links'
      ]
    };
  }

  /**
   * Generate API documentation
   */
  private async generateAPIDocs(command: DevCommand): Promise<DevResult> {
    const sourceCode = await this.readFile(command.target);

    const systemPrompt = `You are an API documentation expert.

Generate API documentation in Markdown format covering:
1. Endpoints/methods
2. Parameters
3. Return values
4. Examples
5. Error handling

Format: Clear, structured Markdown with code examples.`;

    const apiDocs = await this.callClaude(
      systemPrompt,
      `Generate API documentation for:\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``
    );

    const docsPath = command.target.replace(/\.ts$/, '.api.md');
    await this.writeFile(docsPath, apiDocs);

    return {
      success: true,
      data: {
        file: docsPath,
        documentation: apiDocs
      }
    };
  }

  /**
   * Generate architecture diagram using Mermaid
   */
  private async generateArchitectureDiagram(command: DevCommand): Promise<DevResult> {
    const baseDir = command.target;

    // หาไฟล์ทั้งหมด
    const files = await this.findFiles('**/*.ts', baseDir);

    const systemPrompt = `You are a software architect creating architecture diagrams.

Use Mermaid syntax to create:
1. System architecture diagram
2. Component interaction diagram
3. Data flow diagram
4. Agent collaboration diagram

Output format: Markdown file with multiple Mermaid diagrams.`;

    const diagrams = await this.callClaude(
      systemPrompt,
      `Create architecture diagrams for this multi-agent system.

Files:
${files.join('\n')}

Generate Mermaid diagrams showing:
- Overall architecture
- Agent interactions
- Data flow
- External integrations`
    );

    const diagramPath = `${baseDir}/docs/ARCHITECTURE.md`;
    await this.writeFile(diagramPath, diagrams);

    return {
      success: true,
      data: {
        file: diagramPath,
        diagrams
      },
      suggestions: [
        'View diagrams in GitHub or VS Code with Mermaid extension',
        'Update diagrams as architecture evolves'
      ]
    };
  }

  /**
   * Generate comprehensive docs for entire project
   */
  async generateProjectDocs(baseDir: string): Promise<DevResult[]> {
    const results: DevResult[] = [];

    // README
    results.push(await this.generateReadme({
      id: '',
      command: 'doc',
      target: baseDir,
      context: {
        options: { type: 'readme' },
        timestamp: new Date()
      }
    }));

    // Architecture
    results.push(await this.generateArchitectureDiagram({
      id: '',
      command: 'doc',
      target: baseDir,
      context: {
        options: { type: 'architecture' },
        timestamp: new Date()
      }
    }));

    return results;
  }
}
