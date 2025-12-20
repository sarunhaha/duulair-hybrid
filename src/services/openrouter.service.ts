/**
 * OpenRouter Service
 * Unified API for accessing Claude and other AI models via OpenRouter
 *
 * @see https://openrouter.ai/docs/quickstart
 */

import dotenv from 'dotenv';
dotenv.config();

// ============================================
// Types
// ============================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop?: string | string[];
  stream?: boolean;
  response_format?: { type: 'text' | 'json_object' };
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: {
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

// ============================================
// Available Models
// ============================================

export const OPENROUTER_MODELS = {
  // Claude 4.5 Series (Latest)
  CLAUDE_SONNET_4_5: 'anthropic/claude-sonnet-4.5',
  CLAUDE_OPUS_4_5: 'anthropic/claude-opus-4.5',

  // Claude 3.5 Series
  CLAUDE_3_5_SONNET: 'anthropic/claude-3.5-sonnet',
  CLAUDE_3_5_HAIKU: 'anthropic/claude-3.5-haiku',

  // Claude 3 Series (Legacy)
  CLAUDE_3_OPUS: 'anthropic/claude-3-opus',
  CLAUDE_3_SONNET: 'anthropic/claude-3-sonnet',
  CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku',

  // Other providers (for future use)
  GPT_4O: 'openai/gpt-4o',
  GPT_4O_MINI: 'openai/gpt-4o-mini',
  GEMINI_PRO: 'google/gemini-pro-1.5',
} as const;

export type OpenRouterModel = typeof OPENROUTER_MODELS[keyof typeof OPENROUTER_MODELS];

// ============================================
// Default Configuration
// ============================================

const DEFAULT_MODEL = OPENROUTER_MODELS.CLAUDE_SONNET_4_5;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ============================================
// OpenRouter Service Class
// ============================================

export class OpenRouterService {
  private apiKey: string;
  private defaultModel: string;
  private siteUrl: string;
  private siteName: string;

  constructor(options?: {
    apiKey?: string;
    defaultModel?: string;
    siteUrl?: string;
    siteName?: string;
  }) {
    this.apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.defaultModel = options?.defaultModel || DEFAULT_MODEL;
    this.siteUrl = options?.siteUrl || 'https://oonjai.app';
    this.siteName = options?.siteName || 'OONJAI Health Assistant';

    if (!this.apiKey) {
      console.warn('OpenRouter API key not set. Set OPENROUTER_API_KEY environment variable.');
    }
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const {
      model = this.defaultModel,
      messages,
      temperature = DEFAULT_TEMPERATURE,
      max_tokens = DEFAULT_MAX_TOKENS,
      top_p,
      top_k,
      stop,
      stream = false,
      response_format,
      tools,
      tool_choice,
    } = options;

    const body: Record<string, any> = {
      model,
      messages,
      temperature,
      max_tokens,
      stream,
    };

    // Add optional parameters
    if (top_p !== undefined) body.top_p = top_p;
    if (top_k !== undefined) body.top_k = top_k;
    if (stop) body.stop = stop;
    if (response_format) body.response_format = response_format;
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json() as OpenRouterError;
        throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json() as ChatCompletionResponse;
      return data;

    } catch (error: any) {
      console.error('OpenRouter API call failed:', error);
      throw error;
    }
  }

  /**
   * Simple text completion (convenience method)
   */
  async complete(
    prompt: string,
    options?: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      max_tokens?: number;
      jsonMode?: boolean;
    }
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.createChatCompletion({
      model: options?.model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.max_tokens,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Vision/Image analysis
   */
  async analyzeImage(
    imageUrl: string,
    prompt: string,
    options?: {
      model?: string;
      systemPrompt?: string;
      detail?: 'auto' | 'low' | 'high';
    }
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: options?.detail || 'auto',
          },
        },
        {
          type: 'text',
          text: prompt,
        },
      ],
    });

    const response = await this.createChatCompletion({
      model: options?.model || this.defaultModel,
      messages,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Analyze base64 image
   */
  async analyzeBase64Image(
    base64Data: string,
    mimeType: string,
    prompt: string,
    options?: {
      model?: string;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const imageUrl = `data:${mimeType};base64,${base64Data}`;
    return this.analyzeImage(imageUrl, prompt, options);
  }

  /**
   * Get current model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Set default model
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}

// ============================================
// Singleton Export
// ============================================

export const openRouterService = new OpenRouterService();

// Default export
export default openRouterService;
