// src/services/deepgram.service.ts
// Deepgram Speech-to-Text Service using Nova-2
import { createClient, DeepgramClient } from '@deepgram/sdk';

// Initialize Deepgram client
let deepgramClient: DeepgramClient | null = null;

function getClient(): DeepgramClient {
  if (!deepgramClient) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is not set');
    }
    deepgramClient = createClient(apiKey);
  }
  return deepgramClient;
}

// Available Deepgram models
export const DEEPGRAM_MODELS = {
  NOVA_2: 'nova-2',           // Best for Thai, 36 languages
  NOVA_2_GENERAL: 'nova-2-general',
  NOVA_3: 'nova-3',           // Newer but limited Thai support
  WHISPER_LARGE: 'whisper-large'  // Fallback option
} as const;

export interface TranscriptionOptions {
  model?: string;
  language?: string;
  punctuate?: boolean;
  smartFormat?: boolean;
  diarize?: boolean;
  utterances?: boolean;
  detectLanguage?: boolean;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  confidence?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  error?: string;
  duration?: number;
  detectedLanguage?: string;
}

/**
 * Transcribe audio buffer to text using Deepgram Nova-2
 * @param audioBuffer - Audio file buffer (M4A, OGG, WAV, MP3, etc.)
 * @param filename - Original filename with extension (used for mime type detection)
 * @param options - Transcription options
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.m4a',
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  try {
    const client = getClient();

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

    console.log(`🎤 [Deepgram] Transcribing audio: ${filename} (${audioBuffer.length} bytes, ${mimeType})`);

    // Call Deepgram API
    const { result, error } = await client.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: options.model || DEEPGRAM_MODELS.NOVA_2,
        language: options.language || 'th',  // Thai by default
        punctuate: options.punctuate ?? true,
        smart_format: options.smartFormat ?? true,
        diarize: options.diarize ?? false,
        utterances: options.utterances ?? false,
        detect_language: options.detectLanguage ?? false,
        mimetype: mimeType
      }
    );

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;

    // Extract transcription from result
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0];
    const text = transcript?.transcript || '';
    const confidence = transcript?.confidence;
    const words = transcript?.words?.map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence
    }));

    // Get detected language if available
    const detectedLanguage = result?.results?.channels?.[0]?.detected_language;

    console.log(`✅ [Deepgram] Transcription complete in ${duration}ms: "${text}" (confidence: ${confidence?.toFixed(2) || 'N/A'})`);

    return {
      success: true,
      text,
      confidence,
      words,
      duration,
      detectedLanguage
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [Deepgram] Transcription error:', error);

    return {
      success: false,
      error: error.message || 'Transcription failed',
      duration
    };
  }
}

/**
 * Transcribe audio from URL using Deepgram
 * @param audioUrl - URL of the audio file
 * @param options - Transcription options
 */
export async function transcribeUrl(
  audioUrl: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  try {
    const client = getClient();

    console.log(`🎤 [Deepgram] Transcribing from URL: ${audioUrl}`);

    const { result, error } = await client.listen.prerecorded.transcribeUrl(
      { url: audioUrl },
      {
        model: options.model || DEEPGRAM_MODELS.NOVA_2,
        language: options.language || 'th',
        punctuate: options.punctuate ?? true,
        smart_format: options.smartFormat ?? true,
        diarize: options.diarize ?? false,
        utterances: options.utterances ?? false,
        detect_language: options.detectLanguage ?? false
      }
    );

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0];
    const text = transcript?.transcript || '';
    const confidence = transcript?.confidence;

    console.log(`✅ [Deepgram] URL transcription complete in ${duration}ms: "${text}"`);

    return {
      success: true,
      text,
      confidence,
      duration
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [Deepgram] URL transcription error:', error);

    return {
      success: false,
      error: error.message || 'URL transcription failed',
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
  stream: NodeJS.ReadableStream,
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
export const deepgramService = {
  transcribeAudio,
  transcribeUrl,
  transcribeStream,
  MODELS: DEEPGRAM_MODELS
};

export default deepgramService;
