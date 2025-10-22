// Streaming TTS for low-latency Cantonese audio
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

const pollyClient = new PollyClient({
  region: process.env.AWS_REGION || 'ap-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// In-memory cache for common phrases
const audioCache = new Map();

/**
 * Synthesize Cantonese speech (with caching)
 * @param {string} text - Text to synthesize
 * @returns {Promise<Buffer>} - Audio buffer (MP3)
 */
export async function synthesizeSpeech(text) {
  // Check cache first
  if (audioCache.has(text)) {
    console.log(`[TTS] 💾 Cache hit: "${text}"`);
    return audioCache.get(text);
  }

  try {
    console.log(`[TTS] 🔊 Synthesizing: "${text}"`);
    const startTime = Date.now();

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: 'Hiujin', // Cantonese female voice
      Engine: 'neural',
      LanguageCode: 'yue-CN',
      SampleRate: '16000'
    });

    const response = await pollyClient.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    const duration = Date.now() - startTime;
    console.log(`[TTS] ✅ Generated ${audioBuffer.length} bytes in ${duration}ms`);

    // Cache if short (likely to repeat)
    if (text.length <= 30) {
      audioCache.set(text, audioBuffer);
    }

    return audioBuffer;

  } catch (error) {
    console.error('[TTS] Error:', error.message);
    throw error;
  }
}

/**
 * Synthesize and return as base64
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function synthesizeSpeechBase64(text) {
  const buffer = await synthesizeSpeech(text);
  return buffer.toString('base64');
}

/**
 * Split text into sentences for streaming playback
 * @param {string} text - Full text
 * @returns {Array<string>} - Array of sentences
 */
export function splitIntoSentences(text) {
  // Split on Cantonese sentence endings
  const sentences = text
    .split(/([。！？\.\!\?]+)/)
    .reduce((acc, part, i) => {
      if (i % 2 === 0) {
        acc.push(part);
      } else {
        acc[acc.length - 1] += part;
      }
      return acc;
    }, [])
    .filter(s => s.trim().length > 0);

  return sentences.length > 0 ? sentences : [text];
}

/**
 * Synthesize text in chunks for faster playback start
 * @param {string} text - Full text
 * @param {Function} onChunk - Callback(audioBase64, sentenceText)
 * @returns {Promise<void>}
 */
export async function synthesizeStreaming(text, onChunk) {
  const sentences = splitIntoSentences(text);
  console.log(`[TTS Streaming] Processing ${sentences.length} sentences`);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (sentence) {
      const audioBase64 = await synthesizeSpeechBase64(sentence);
      if (onChunk) {
        onChunk(audioBase64, sentence, i);
      }
    }
  }

  console.log('[TTS Streaming] ✅ All chunks sent');
}

/**
 * Pre-cache common Cantonese phrases
 */
export async function warmupCache() {
  const commonPhrases = [
    '你好！',
    '有咩可以幫到你？',
    '明白晒！',
    '好嘅！',
    '冇問題！',
    '唔該！',
    '多謝！',
    '係呀。',
    '唔係喎。',
    '等陣。'
  ];

  console.log('[TTS Cache] Warming up...');
  for (const phrase of commonPhrases) {
    try {
      await synthesizeSpeech(phrase);
    } catch (error) {
      console.error(`[TTS Cache] Failed to cache "${phrase}":`, error.message);
    }
  }
  console.log(`[TTS Cache] ✅ Cached ${audioCache.size} phrases`);
}

/**
 * Clear cache
 */
export function clearCache() {
  audioCache.clear();
  console.log('[TTS Cache] Cleared');
}

