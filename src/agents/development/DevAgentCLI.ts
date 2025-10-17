#!/usr/bin/env node
// src/agents/development/DevAgentCLI.ts

import { program } from 'commander';
import { CodeReviewAgent } from './CodeReviewAgent';
import { TestGeneratorAgent } from './TestGeneratorAgent';
import { DocumentationAgent } from './DocumentationAgent';
import { DebugAgent } from './DebugAgent';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Development Agents CLI
 *
 * Usage:
 * npm run dev-agent review src/agents/specialized/HealthAgent.ts
 * npm run dev-agent test src/agents/specialized/HealthAgent.ts --integration
 * npm run dev-agent doc src/agents/specialized/HealthAgent.ts --jsdoc
 * npm run dev-agent debug src/agents/specialized/HealthAgent.ts --error "..."
 */

class DevAgentCLI {
  private reviewAgent: CodeReviewAgent;
  private testAgent: TestGeneratorAgent;
  private docAgent: DocumentationAgent;
  private debugAgent: DebugAgent;

  constructor() {
    this.reviewAgent = new CodeReviewAgent();
    this.testAgent = new TestGeneratorAgent();
    this.docAgent = new DocumentationAgent();
    this.debugAgent = new DebugAgent();
  }

  /**
   * Setup CLI commands
   */
  setupCommands() {
    program
      .name('dev-agent')
      .description('Development Multi-Agent System for Duulair Platform')
      .version('1.0.0');

    // Review command
    program
      .command('review <file>')
      .description('Review code quality and suggest improvements')
      .option('--strict', 'Strict mode (report even minor issues)')
      .option('--security', 'Focus on security issues')
      .option('--performance', 'Focus on performance issues')
      .option('--output <path>', 'Output report to file')
      .action(async (file, options) => {
        await this.handleReview(file, options);
      });

    // Review multiple files
    program
      .command('review-all <pattern>')
      .description('Review multiple files matching pattern')
      .option('--output <path>', 'Output report to file')
      .action(async (pattern, options) => {
        await this.handleReviewAll(pattern, options);
      });

    // Test generation
    program
      .command('test <file>')
      .description('Generate unit tests for a file')
      .option('--integration', 'Generate integration tests')
      .option('--mock', 'Include mock data and services')
      .action(async (file, options) => {
        await this.handleTest(file, options);
      });

    // Test generation for directory
    program
      .command('test-all <directory>')
      .description('Generate tests for all files in directory')
      .option('--pattern <pattern>', 'File pattern (default: **/*.ts)')
      .action(async (directory, options) => {
        await this.handleTestAll(directory, options);
      });

    // Documentation
    program
      .command('doc <target>')
      .description('Generate documentation')
      .option('--jsdoc', 'Add JSDoc comments to code')
      .option('--readme', 'Generate README.md')
      .option('--api', 'Generate API documentation')
      .option('--architecture', 'Generate architecture diagrams')
      .action(async (target, options) => {
        await this.handleDoc(target, options);
      });

    // Debug
    program
      .command('debug <file>')
      .description('Debug and analyze errors')
      .option('--error <message>', 'Error message to analyze')
      .option('--stack <trace>', 'Stack trace')
      .option('--performance', 'Analyze performance')
      .option('--logs', 'Analyze as log file')
      .option('--output <path>', 'Output report to file')
      .action(async (file, options) => {
        await this.handleDebug(file, options);
      });

    // Interactive mode
    program
      .command('interactive')
      .alias('i')
      .description('Start interactive mode')
      .action(async () => {
        await this.startInteractive();
      });

    program.parse(process.argv);
  }

  /**
   * Handle review command
   */
  private async handleReview(file: string, options: any) {
    console.log(`\n🔍 Reviewing: ${file}\n`);

    try {
      const result = await this.reviewAgent.process({
        id: '',
        command: 'review',
        target: file,
        context: {
          options: {
            type: options.security ? 'security' : options.performance ? 'performance' : 'general',
            strict: options.strict || false
          },
          timestamp: new Date()
        }
      });

      if (result.success) {
        this.printReviewResult(result);

        // Save report if output specified
        if (options.output) {
          const report = this.reviewAgent.generateReport([result]);
          await fs.writeFile(options.output, report);
          console.log(`\n📄 Report saved to: ${options.output}`);
        }
      } else {
        console.error('❌ Review failed:', result.errors);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Handle review-all command
   */
  private async handleReviewAll(pattern: string, options: any) {
    console.log(`\n🔍 Reviewing files matching: ${pattern}\n`);

    try {
      const { glob } = await import('glob');
      const files = await glob(pattern);

      if (files.length === 0) {
        console.log('No files found matching pattern.');
        return;
      }

      console.log(`Found ${files.length} files to review.\n`);

      const results = await this.reviewAgent.reviewMultiple(files);
      const report = this.reviewAgent.generateReport(results);

      console.log(report);

      // Save report if output specified
      if (options.output) {
        await fs.writeFile(options.output, report);
        console.log(`\n📄 Report saved to: ${options.output}`);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Handle test command
   */
  private async handleTest(file: string, options: any) {
    console.log(`\n🧪 Generating tests for: ${file}\n`);

    try {
      const result = await this.testAgent.process({
        id: '',
        command: 'test',
        target: file,
        context: {
          options: {
            type: options.integration ? 'integration' : 'unit',
            mock: options.mock || false
          },
          timestamp: new Date()
        }
      });

      if (result.success) {
        console.log('✅ Tests generated successfully!');
        console.log(`📄 Test file: ${result.data.testFile}`);
        console.log(`\n💡 Suggestions:`);
        result.suggestions?.forEach((s: string) => console.log(`   - ${s}`));
      } else {
        console.error('❌ Test generation failed:', result.errors);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Handle test-all command
   */
  private async handleTestAll(directory: string, options: any) {
    console.log(`\n🧪 Generating tests for directory: ${directory}\n`);

    try {
      const pattern = options.pattern || '**/*.ts';
      const results = await this.testAgent.generateForDirectory(directory, pattern);
      const report = this.testAgent.generateReport(results);

      console.log(report);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Handle doc command
   */
  private async handleDoc(target: string, options: any) {
    console.log(`\n📚 Generating documentation for: ${target}\n`);

    try {
      let docType = 'jsdoc';
      if (options.readme) docType = 'readme';
      else if (options.api) docType = 'api';
      else if (options.architecture) docType = 'architecture';

      const result = await this.docAgent.process({
        id: '',
        command: 'doc',
        target,
        context: {
          options: { type: docType },
          timestamp: new Date()
        }
      });

      if (result.success) {
        console.log('✅ Documentation generated successfully!');
        console.log(`📄 Output: ${result.data.file || target}`);
        if (result.suggestions) {
          console.log(`\n💡 Suggestions:`);
          result.suggestions.forEach((s: string) => console.log(`   - ${s}`));
        }
      } else {
        console.error('❌ Documentation generation failed:', result.errors);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Handle debug command
   */
  private async handleDebug(file: string, options: any) {
    console.log(`\n🐛 Debugging: ${file}\n`);

    try {
      let debugType = 'error';
      if (options.performance) debugType = 'performance';
      else if (options.logs) debugType = 'logs';

      const result = await this.debugAgent.process({
        id: '',
        command: 'debug',
        target: file,
        context: {
          options: {
            type: debugType,
            error: options.error,
            stack: options.stack
          },
          timestamp: new Date()
        }
      });

      if (result.success) {
        const report = this.debugAgent.generateReport(result);
        console.log(report);

        // Save report if output specified
        if (options.output) {
          await fs.writeFile(options.output, report);
          console.log(`\n📄 Report saved to: ${options.output}`);
        }
      } else {
        console.error('❌ Debug failed:', result.errors);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Start interactive mode
   */
  private async startInteractive() {
    console.log('\n🤖 Development Agent Interactive Mode\n');
    console.log('Available commands:');
    console.log('  @review <file>       - Review code');
    console.log('  @test <file>         - Generate tests');
    console.log('  @doc <file>          - Generate documentation');
    console.log('  @debug <file>        - Debug code');
    console.log('  help                 - Show help');
    console.log('  exit                 - Exit interactive mode\n');

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'dev-agent> '
    });

    rl.prompt();

    rl.on('line', async (line: string) => {
      const input = line.trim();

      if (input === 'exit') {
        console.log('Goodbye! 👋');
        rl.close();
        process.exit(0);
      }

      if (input === 'help') {
        console.log('\nCommands: @review, @test, @doc, @debug, help, exit\n');
        rl.prompt();
        return;
      }

      // Parse @command syntax
      const match = input.match(/@(\w+)\s+(.+)/);
      if (match) {
        const [, command, target] = match;
        await this.executeCommand(command, target);
      } else {
        console.log('Invalid command. Type "help" for available commands.');
      }

      rl.prompt();
    });
  }

  /**
   * Execute command in interactive mode
   */
  private async executeCommand(command: string, target: string) {
    try {
      switch (command) {
        case 'review':
          await this.handleReview(target, {});
          break;
        case 'test':
          await this.handleTest(target, {});
          break;
        case 'doc':
          await this.handleDoc(target, { jsdoc: true });
          break;
        case 'debug':
          await this.handleDebug(target, {});
          break;
        default:
          console.log(`Unknown command: ${command}`);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
    }
  }

  /**
   * Print review result in a nice format
   */
  private printReviewResult(result: any) {
    const data = result.data;
    const analysis = data.analysis;

    console.log(`📊 Score: ${analysis.score}/100\n`);
    console.log(`📝 Summary: ${analysis.summary}\n`);

    if (analysis.strengths && analysis.strengths.length > 0) {
      console.log('💚 Strengths:');
      analysis.strengths.forEach((s: string) => console.log(`   ✓ ${s}`));
      console.log();
    }

    if (analysis.issues && analysis.issues.length > 0) {
      console.log(`⚠️  Issues (${analysis.issues.length}):\n`);
      analysis.issues.forEach((issue: any, i: number) => {
        const emoji = this.getSeverityEmoji(issue.severity);
        console.log(`${i + 1}. ${emoji} ${issue.severity.toUpperCase()} - Line ${issue.line}`);
        console.log(`   Category: ${issue.category}`);
        console.log(`   Issue: ${issue.description}`);
        console.log(`   Fix: ${issue.suggestion}\n`);
      });
    }

    if (result.suggestions && result.suggestions.length > 0) {
      console.log('💡 Suggestions:');
      result.suggestions.forEach((s: string) => console.log(`   - ${s}`));
      console.log();
    }
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

// Run CLI
if (require.main === module) {
  const cli = new DevAgentCLI();
  cli.setupCommands();
}

export { DevAgentCLI };
