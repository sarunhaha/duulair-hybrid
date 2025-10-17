// src/agents/development/BaseDevAgent.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Schema สำหรับคำสั่งที่ส่งมาให้ Development Agent
 */
export const DevCommandSchema = z.object({
  id: z.string().default(() => uuidv4()),
  command: z.string(), // เช่น "review", "test", "doc", "debug"
  target: z.string(), // file path หรือ code snippet
  context: z.object({
    files: z.array(z.string()).optional(), // ไฟล์ที่เกี่ยวข้อง
    options: z.record(z.any()).optional(), // options เพิ่มเติม
    userId: z.string().optional(),
    timestamp: z.date().default(() => new Date())
  }),
  metadata: z.record(z.any()).optional()
});

export type DevCommand = z.infer<typeof DevCommandSchema>;

/**
 * Schema สำหรับผลลัพธ์จาก Development Agent
 */
export const DevResultSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  suggestions: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export type DevResult = z.infer<typeof DevResultSchema>;

/**
 * Base class สำหรับ Development Agents
 * ใช้สำหรับช่วยงานพัฒนา platform
 */
export abstract class BaseDevAgent {
  protected client: Anthropic;
  protected name: string;
  protected role: string;
  protected capabilities: string[];
  protected model: string;
  protected temperature: number;
  protected maxTokens: number;

  constructor(config: {
    name: string;
    role: string;
    capabilities: string[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    this.name = config.name;
    this.role = config.role;
    this.capabilities = config.capabilities;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.temperature = config.temperature || 0.3; // ต่ำกว่าปกติ เพื่อความแม่นยำ
    this.maxTokens = config.maxTokens || 4000;

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * ประมวลผลคำสั่งจาก developer
   */
  abstract process(command: DevCommand): Promise<DevResult>;

  /**
   * เรียกใช้ Claude API
   */
  protected async callClaude(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature || this.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      return '';
    } catch (error) {
      this.log('error', 'Failed to call Claude API', error);
      throw error;
    }
  }

  /**
   * Logging
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`;

    if (level === 'error') {
      console.error(logMessage, data || '');
    } else if (level === 'warn') {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
  }

  /**
   * อ่านไฟล์
   */
  protected async readFile(filePath: string): Promise<string> {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      this.log('error', `Failed to read file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * เขียนไฟล์
   */
  protected async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // สร้าง directory ถ้ายังไม่มี
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content, 'utf-8');
      this.log('info', `File written successfully: ${filePath}`);
    } catch (error) {
      this.log('error', `Failed to write file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * หา files ที่ match pattern
   */
  protected async findFiles(pattern: string, baseDir: string = '.'): Promise<string[]> {
    try {
      const { glob } = await import('glob');
      return await glob(pattern, { cwd: baseDir });
    } catch (error) {
      this.log('error', `Failed to find files with pattern: ${pattern}`, error);
      return [];
    }
  }

  /**
   * Parse code เป็น AST (ถ้าต้องการ)
   */
  protected async parseCode(code: string, language: 'typescript' | 'javascript'): Promise<any> {
    // TODO: Implement AST parsing if needed
    // สามารถใช้ @typescript-eslint/parser หรือ @babel/parser
    return null;
  }

  /**
   * Format code
   */
  protected async formatCode(code: string, language: string = 'typescript'): Promise<string> {
    try {
      // ในอนาคตอาจใช้ prettier
      return code;
    } catch (error) {
      this.log('error', 'Failed to format code', error);
      return code;
    }
  }

  /**
   * Get agent info
   */
  getInfo() {
    return {
      name: this.name,
      role: this.role,
      capabilities: this.capabilities,
      model: this.model
    };
  }
}
