// src/services/groq.service.ts
// Groq Speech-to-Text Service using Whisper
import Groq from 'groq-sdk';
import { Readable } from 'stream';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Available Whisper models
export const GROQ_WHISPER_MODELS = {
  TURBO: 'whisper-large-v3-turbo',  // Fast, $0.04/hr, 12% WER
  LARGE: 'whisper-large-v3'          // Accurate, $0.111/hr, 10.3% WER
} as const;

export interface TranscriptionOptions {
  model?: string;
  language?: string;
  prompt?: string;
  temperature?: number;
  responseFormat?: 'json' | 'text' | 'verbose_json';
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  duration?: number;
}

/**
 * Transcribe audio buffer to text using Groq Whisper
 * @param audioBuffer - Audio file buffer (M4A, OGG, WAV, MP3, etc.)
 * @param filename - Original filename with extension
 * @param options - Transcription options
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.m4a',
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  try {
    // Determine MIME type from filename
    const ext = filename.split('.').pop()?.toLowerCase() || 'm4a';
    const mimeTypes: Record<string, string> = {
      'm4a': 'audio/mp4',
      'mp3': 'audio/mpeg',
      'mp4': 'audio/mp4',
      'mpeg': 'audio/mpeg',
      'mpga': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
      'flac': 'audio/flac'
    };
    const mimeType = mimeTypes[ext] || 'audio/mp4';

    // Create a File-like object from Buffer
    // Groq SDK expects a File or Uploadable
    const file = new File([audioBuffer], filename, { type: mimeType });

    console.log(`🎤 Transcribing audio: ${filename} (${audioBuffer.length} bytes, ${mimeType})`);

    // Call Groq Whisper API
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: options.model || GROQ_WHISPER_MODELS.TURBO,
      language: options.language || 'th',  // Thai by default
      temperature: options.temperature ?? 0,
      prompt: options.prompt || 'บันทึกสุขภาพ ยา ความดัน น้ำหนัก กินยา ดื่มน้ำ ออกกำลังกาย'
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Transcription complete in ${duration}ms: "${transcription.text}"`);

    return {
      success: true,
      text: transcription.text,
      duration
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ Transcription error:', error);

    return {
      success: false,
      error: error.message || 'Transcription failed',
      duration
    };
  }
}

/**
 * Transcribe audio from a readable stream
 * @param stream - Audio stream
 * @param filename - Filename for the audio
 * @param options - Transcription options
 */
export async function transcribeStream(
  stream: Readable,
  filename: string = 'audio.m4a',
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  // Collect stream into buffer
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }

  const audioBuffer = Buffer.concat(chunks);
  return transcribeAudio(audioBuffer, filename, options);
}

// Export service object for consistency with other services
export const groqService = {
  transcribeAudio,
  transcribeStream,
  MODELS: GROQ_WHISPER_MODELS
};

export default groqService;
