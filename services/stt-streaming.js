// Streaming Speech-to-Text for Cantonese with Voice Activity Detection
import speech from '@google-cloud/speech';

// Initialize Speech client with credentials
// For local dev: uses google-credentials.json via GOOGLE_APPLICATION_CREDENTIALS
// For Fly.io: uses GOOGLE_CREDENTIALS_JSON environment variable
let speechClient;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  // Production (Fly.io) - credentials from environment variable
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  speechClient = new speech.SpeechClient({
    credentials: credentials,
    projectId: credentials.project_id
  });
  console.log('[STT] Using credentials from GOOGLE_CREDENTIALS_JSON env variable');
} else {
  // Local development - credentials from file
  speechClient = new speech.SpeechClient();
  console.log('[STT] Using credentials from google-credentials.json file');
}

/**
 * Create streaming STT with interruption detection
 * @param {Function} onTranscript - Callback(text, isFinal, confidence)
 * @param {Function} onSpeechStart - Callback when user starts speaking
 * @param {Function} onSpeechEnd - Callback when user stops speaking
 * @param {Function} onError - Error callback
 */
export function createStreamingSTT(onTranscript, onSpeechStart, onSpeechEnd, onError) {
  let isUserSpeaking = false;
  let speechStartTimer = null;
  let speechEndTimer = null;

  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'yue-Hant-HK', // Cantonese
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: false,
      model: 'latest_long', // Better model for conversational speech
      // Enable single utterance to detect when user stops
      singleUtterance: false,
      interimResults: true, // Get results as user speaks
      // Boost common conversational phrases with higher boost
      speechContexts: [{
        phrases: [
          // Common greetings & responses
          '你好', '喂', '早晨', '午安', '晚安', '拜拜',
          '係咩', '點解', '唔該', '多謝', '唔好意思',
          '明白', '知道', '好嘅', '冇問題', '係啊', '唔係',
          '幫我', '想問', '可唔可以', '點樣', '邊度', '幾時',
          // Hong Kong specific
          '中環', '尖沙咀', '旺角', '銅鑼灣', '港鐵', '巴士',
          '茶餐廳', '飲茶', '點心', '外賣', '睇戲', '行街',
          // Common actions
          '講嘢', '聽日', '琴日', '而家', '之後', '跟住',
          '一陣', '等等', '即係', '咁樣', '嗰度', '呢度'
        ],
        boost: 30 // Increased from 15 to 30 for better recognition
      }]
    },
    interimResults: true
  };

  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', (error) => {
      console.error('[STT] Error:', error);
      if (onError) onError(error);
    })
    .on('data', (data) => {
      if (data.results[0] && data.results[0].alternatives[0]) {
        const result = data.results[0];
        const transcript = result.alternatives[0].transcript;
        const isFinal = result.isFinal;
        const confidence = result.alternatives[0].confidence || 0;

        // Detect speech start
        if (!isUserSpeaking && transcript.trim()) {
          isUserSpeaking = true;
          if (onSpeechStart) {
            console.log('[VAD] 🎤 User started speaking');
            onSpeechStart();
          }
        }

        // Send transcript
        if (onTranscript) {
          onTranscript(transcript, isFinal, confidence);
        }

        // Detect speech end (on final result)
        if (isFinal && isUserSpeaking) {
          // Clear any existing timer
          if (speechEndTimer) {
            clearTimeout(speechEndTimer);
          }
          
          // Wait a bit to see if user continues speaking
          speechEndTimer = setTimeout(() => {
            if (isUserSpeaking) {
              isUserSpeaking = false;
              if (onSpeechEnd) {
                console.log('[VAD] 🔇 User stopped speaking');
                onSpeechEnd(transcript);
              }
            }
          }, 500); // 500ms silence = end of speech
        }
      }
    });

  return {
    stream: recognizeStream,
    reset: () => {
      isUserSpeaking = false;
      if (speechStartTimer) clearTimeout(speechStartTimer);
      if (speechEndTimer) clearTimeout(speechEndTimer);
      console.log('[STT] Reset state (keeping stream alive)');
    },
    clearState: () => {
      // Clear state without affecting the stream - used for interruptions
      isUserSpeaking = false;
      if (speechStartTimer) clearTimeout(speechStartTimer);
      if (speechEndTimer) clearTimeout(speechEndTimer);
      console.log('[STT] Cleared state for new input');
    }
  };
}

/**
 * Simple energy-based voice activity detection
 * @param {Int16Array} audioBuffer - Audio samples
 * @param {number} threshold - Energy threshold
 * @returns {boolean} - True if voice detected
 */
export function detectVoiceActivity(audioBuffer, threshold = 500) {
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += Math.abs(audioBuffer[i]);
  }
  const avgEnergy = sum / audioBuffer.length;
  return avgEnergy > threshold;
}

