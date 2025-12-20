// src/agents/development/TestGeneratorAgent.ts

import { BaseDevAgent, DevCommand, DevResult } from './BaseDevAgent';

/**
 * TestGeneratorAgent - สร้าง unit tests อัตโนมัติ
 *
 * Capabilities:
 * - สร้าง Jest unit tests
 * - สร้าง integration tests
 * - สร้าง test cases สำหรับ edge cases
 * - สร้าง mock data
 * - คำนวณ code coverage
 *
 * Usage:
 * @test src/agents/specialized/HealthAgent.ts
 * @test src/agents/specialized/HealthAgent.ts --integration
 * @test src/services/supabase.service.ts --mock
 */
export class TestGeneratorAgent extends BaseDevAgent {
  constructor() {
    super({
      name: 'test-generator',
      role: 'Automated test generator for TypeScript code',
      capabilities: [
        'unit-test-generation',
        'integration-test-generation',
        'mock-generation',
        'edge-case-detection',
        'coverage-analysis'
      ],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
      maxTokens: 4000
    });
  }

  async process(command: DevCommand): Promise<DevResult> {
    this.log('info', `Generating tests for: ${command.target}`);

    try {
      // อ่านไฟล์ source code
      const sourceCode = await this.readFile(command.target);

      // กำหนด test type
      const testType = command.context.options?.type || 'unit';
      const withMocks = command.context.options?.mock || false;

      // สร้าง system prompt
      const systemPrompt = this.createTestPrompt(testType, withMocks);

      // เรียก Claude
      const tests = await this.callClaude(
        systemPrompt,
        `Generate comprehensive tests for this TypeScript code:\n\n\`\`\`typescript\n${sourceCode}\n\`\`\``
      );

      // สร้าง test file path
      const testFilePath = this.getTestFilePath(command.target);

      // เขียน test file
      await this.writeFile(testFilePath, tests);

      return {
        success: true,
        data: {
          sourceFile: command.target,
          testFile: testFilePath,
          testType,
          tests
        },
        suggestions: [
          'Run tests with: npm test',
          'Check coverage with: npm run test:coverage',
          'Review generated tests and adjust as needed'
        ]
      };
    } catch (error: any) {
      this.log('error', 'Test generation failed', error);
      return {
        success: false,
        data: null,
        errors: [error.message]
      };
    }
  }

  private createTestPrompt(testType: string, withMocks: boolean): string {
    let prompt = `You are an expert test engineer specializing in TypeScript and Jest.
Generate comprehensive, high-quality tests following these guidelines:

**Test Framework:** Jest
**Language:** TypeScript
**Style:** AAA pattern (Arrange, Act, Assert)

**Requirements:**
1. Import all necessary dependencies
2. Use describe() for test suites
3. Use it() or test() for individual tests
4. Test happy paths and edge cases
5. Use meaningful test descriptions
6. Add comments explaining complex test logic
7. Mock external dependencies properly
8. Aim for >80% code coverage

**Test Structure:**
\`\`\`typescript
import { ClassName } from './file';

describe('ClassName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Arrange
      const input = ...;

      // Act
      const result = method(input);

      // Assert
      expect(result).toBe(...);
    });
  });
});
\`\`\``;

    if (testType === 'integration') {
      prompt += `\n\n**Integration Tests:**
- Test full workflows
- Test database operations (use test database)
- Test API endpoints
- Test agent collaborations
- Clean up after tests`;
    }

    if (withMocks) {
      prompt += `\n\n**Mocking:**
- Mock external services (Supabase, Claude API, LINE)
- Use jest.fn() for function mocks
- Use jest.mock() for module mocks
- Provide realistic mock data
- Document what is being mocked and why

Example:
\`\`\`typescript
jest.mock('../services/supabase.service');
const mockSupabase = new SupabaseService() as jest.Mocked<SupabaseService>;
mockSupabase.getPatient.mockResolvedValue({ id: '123', name: 'Test' });
\`\`\``;
    }

    prompt += `\n\nOutput ONLY the complete test file code. No explanations.`;

    return prompt;
  }

  private getTestFilePath(sourceFilePath: string): string {
    // แปลง src/agents/specialized/HealthAgent.ts
    // เป็น src/agents/specialized/HealthAgent.test.ts
    return sourceFilePath.replace(/\.(ts|js)$/, '.test.$1');
  }

  /**
   * Generate tests for multiple files
   */
  async generateForDirectory(directory: string, pattern: string = '**/*.ts'): Promise<DevResult[]> {
    const files = await this.findFiles(pattern, directory);
    const results: DevResult[] = [];

    // กรอง test files ออก
    const sourceFiles = files.filter(f => !f.includes('.test.') && !f.includes('.spec.'));

    for (const file of sourceFiles) {
      const result = await this.process({
        id: '',
        command: 'test',
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
   * Generate mock data for testing
   */
  async generateMockData(dataType: string): Promise<any> {
    const systemPrompt = `Generate realistic mock data for testing a Thai elderly healthcare system.
Data type: ${dataType}

Output format: TypeScript object or array.`;

    const mockData = await this.callClaude(
      systemPrompt,
      `Generate 5 examples of ${dataType} with realistic Thai data.`
    );

    try {
      // พยายาม parse เป็น JSON
      const jsonMatch = mockData.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return mockData;
    } catch {
      return mockData;
    }
  }

  /**
   * Generate test report
   */
  generateReport(results: DevResult[]): string {
    let report = '# 🧪 Test Generation Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `**Files Processed:** ${results.length}\n\n`;

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    report += `## Summary\n\n`;
    report += `- ✅ Successful: ${successful}\n`;
    report += `- ❌ Failed: ${failed}\n\n`;

    report += `## Generated Test Files\n\n`;

    results.forEach((result, index) => {
      if (result.success) {
        report += `${index + 1}. **${result.data.testFile}**\n`;
        report += `   - Source: ${result.data.sourceFile}\n`;
        report += `   - Type: ${result.data.testType}\n\n`;
      }
    });

    report += `## Next Steps\n\n`;
    report += `1. Review generated tests\n`;
    report += `2. Run tests: \`npm test\`\n`;
    report += `3. Check coverage: \`npm run test:coverage\`\n`;
    report += `4. Adjust tests as needed\n`;

    return report;
  }
}
