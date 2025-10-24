// Real-time Cantonese Voice Agent Server with Interruption Support
import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createStreamingSTT, detectVoiceActivity } from './services/stt-streaming.js';
import { generateStreamingResponse } from './services/llm-streaming.js';
import { synthesizeSpeechBase64, synthesizeStreaming, warmupCache } from './services/tts-streaming.js';
import { createSession, getSession, deleteSession } from './services/conversation.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Cantonese Voice Agent'
  });
});

const server = app.listen(PORT, async () => {
  console.log(`\n🎙️ Cantonese Voice Agent running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
  
  console.log('⚡ Warming up TTS cache...');
  await warmupCache();
  console.log('✅ Ready!\n');
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  console.log(`\n[WebSocket] 🔌 New connection: ${sessionId}`);

  let conversation = null;
  let sttManager = null;
  let isAISpeaking = false;
  let currentAudioQueue = [];
  let isProcessing = false;
  let currentResponseId = null; // Track response ID to cancel properly
  let selectedModel = 'openai/gpt-4o-mini'; // Default model
  let isMobile = false; // Track if client is mobile for optimizations

  // State management
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'start':
          // Store selected model if provided
          if (data.model) {
            selectedModel = data.model;
            console.log(`[Session ${sessionId}] 🤖 Selected model: ${selectedModel}`);
            
            // Send confirmation to client
            ws.send(JSON.stringify({
              type: 'model_confirmed',
              model: selectedModel
            }));
          }
          
          // Store mobile flag for optimizations
          if (data.isMobile !== undefined) {
            isMobile = data.isMobile;
            console.log(`[Session ${sessionId}] 📱 Mobile device: ${isMobile}`);
          }
          
          handleStart();
          break;

        case 'audio':
          handleAudio(data);
          break;

        case 'user_speaking':
          handleUserSpeaking();
          break;

        case 'stop':
          handleStop();
          break;

        case 'reset':
          handleReset();
          break;

        case 'ai_finished_speaking':
          // Client finished playing audio
          isAISpeaking = false;
          console.log('[Audio] AI finished speaking');
          break;

        case 'user_finished_speaking':
          // User muted after speaking - signal end of turn
          console.log('[Mute] User finished speaking (muted)');
          // The STT will automatically finalize the transcription with the next silence
          // No additional action needed - the transcript will be processed normally
          break;

        default:
          console.log(`[WebSocket] Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('[WebSocket] Error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  // Start conversation
  function handleStart() {
    console.log(`[Session ${sessionId}] 🚀 Starting conversation`);
    
    conversation = createSession(sessionId);
    
    // Send greeting
    const greeting = '你好！我係你嘅AI助手，可以用廣東話同你傾偈。有咩可以幫到你？';
    conversation.addMessage('assistant', greeting);
    
    synthesizeSpeechBase64(greeting, isMobile).then(audio => {
      // Mark AI as speaking (for greeting)
      isAISpeaking = true;
      
      console.log(`[Greeting] Sending audio: ${audio.length} chars (base64)`);
      
      ws.send(JSON.stringify({
        type: 'ai_response',
        text: greeting,
        audio: audio
      }));

      // Initialize STT
      initializeSTT();
      
      ws.send(JSON.stringify({
        type: 'ready',
        message: 'Ready to listen'
      }));
    }).catch(error => {
      console.error('[Start] Error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to start'
      }));
    });
  }

  // Initialize Speech-to-Text with interruption detection
  function initializeSTT() {
    // Clean up old stream if exists (only on first init or error recovery)
    if (sttManager && sttManager.stream) {
      try {
        // Don't end the stream if it's still healthy - just reset state
        if (!sttManager.stream.destroyed && sttManager.stream.writable) {
          console.log('[STT] Stream still healthy, just resetting state...');
          sttManager.reset();
          
          // Notify client that STT is ready
          ws.send(JSON.stringify({
            type: 'stt_ready',
            message: 'STT stream ready to receive audio'
          }));
          return; // Keep existing stream
        }
        
        // Stream is dead, clean it up
        console.log('[STT] Stream unhealthy, recreating...');
        sttManager.stream.end();
        sttManager.reset();
      } catch (e) {
        console.warn('[STT] Cleanup error:', e.message);
      }
    }

    console.log('[STT] Creating new stream...');
    sttManager = createStreamingSTT(
      // onTranscript
      (transcript, isFinal, confidence) => {
        ws.send(JSON.stringify({
          type: 'transcript',
          text: transcript,
          isFinal: isFinal,
          confidence: confidence
        }));

        // Process final transcript
        if (isFinal && confidence > 0.5 && transcript.trim()) {
          processUserMessage(transcript);
        }
      },
      // onSpeechStart
      () => {
        console.log(`[VAD] 🎤 User started speaking (isAISpeaking=${isAISpeaking}, isProcessing=${isProcessing})`);
        
        // INTERRUPTION: Stop AI if it's speaking OR processing
        if (isAISpeaking || isProcessing) {
          console.log('[Interruption] ✋ User interrupted - stopping AI (clearing processing lock)');
          isAISpeaking = false;
          isProcessing = false; // CRITICAL: Clear processing lock to allow new message!
          currentResponseId = null; // Cancel current response
          currentAudioQueue = [];
          
          ws.send(JSON.stringify({
            type: 'stop_playback',
            reason: 'interrupted'
          }));
          console.log('[Interruption] stop_playback message sent to client');
        }

        ws.send(JSON.stringify({
          type: 'user_speech_start'
        }));
      },
      // onSpeechEnd
      (transcript) => {
        console.log('[VAD] 🔇 User stopped speaking');
        ws.send(JSON.stringify({
          type: 'user_speech_end',
          finalText: transcript
        }));
      },
      // onError
      (error) => {
        console.error('[STT] Error:', error);
        // Try to reinitialize on error
        setTimeout(() => {
          if (conversation) {
            console.log('[STT] Reinitializing after error...');
            initializeSTT();
          }
        }, 1000);
        
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Speech recognition error'
        }));
      }
    );
    
    // Notify client that STT is ready to receive audio
    // Small delay to ensure stream is fully initialized
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'stt_ready',
        message: 'STT stream ready to receive audio'
      }));
      console.log('[STT] ✅ Stream created and ready');
    }, 100); // 100ms delay for stream initialization
  }

  // Handle incoming audio
  function handleAudio(data) {
    if (!sttManager || !conversation) {
      console.warn('[Audio] No active STT or conversation');
      return;
    }

    // Check if stream is still writable before writing
    if (!sttManager.stream || sttManager.stream.destroyed) {
      console.warn('[Audio] STT stream destroyed, reinitializing...');
      initializeSTT();
      return;
    }

    try {
      const audioBuffer = Buffer.from(data.audio, 'base64');
      sttManager.stream.write(audioBuffer);
    } catch (error) {
      console.error('[Audio] Error writing to stream:', error.message);
      // Stream might be destroyed, reinitialize it
      initializeSTT();
    }
  }

  // User manually indicated they're speaking (for interruption)
  function handleUserSpeaking() {
    if (isAISpeaking) {
      console.log('[Interruption] ✋ Manual interruption');
      isAISpeaking = false;
      currentAudioQueue = [];
      
      ws.send(JSON.stringify({
        type: 'stop_playback',
        reason: 'interrupted'
      }));
    }
  }

  // Process user message
  async function processUserMessage(transcript) {
    if (isProcessing || !conversation || !transcript.trim()) {
      if (isProcessing) {
        console.log(`[Process] ⏳ Blocked - already processing (transcript: "${transcript}")`);
      }
      return;
    }

    isProcessing = true;
    const responseId = Date.now(); // Unique ID for this response
    currentResponseId = responseId;
    const startTime = Date.now();
    console.log(`\n[Session ${sessionId}] 💬 Processing: "${transcript}" [Response #${responseId}]`);

    try {
      // Add user message
      conversation.addMessage('user', transcript);

      // Generate streaming response with sentence-by-sentence TTS
      let fullResponse = '';
      let sentenceBuffer = '';
      let sentenceCount = 0;

      await generateStreamingResponse(
        conversation.getHistory(),
        // onChunk - accumulate and detect sentences
        (chunk, currentFull) => {
          sentenceBuffer += chunk;
          
          // Show thinking progress
          ws.send(JSON.stringify({
            type: 'ai_thinking',
            chunk: chunk,
            current: currentFull
          }));

          // Check for natural break points (aggressive splitting for faster playback)
          // Match: sentence endings, newlines, or commas followed by space
          const sentenceMatch = sentenceBuffer.match(/^(.*?[。！？\.\!\?]+|.*?\n|.*?，\s)/);
          if (sentenceMatch) {
            const sentence = sentenceMatch[1].trim();
            sentenceBuffer = sentenceBuffer.slice(sentenceMatch[0].length);
            
            // Only send if meaningful content (not just whitespace or too short)
            if (sentence && sentence.length > 3) {
              sentenceCount++;
              const thisSentenceNum = sentenceCount; // Capture for closure
              console.log(`[TTS] Chunk ${thisSentenceNum}: "${sentence}"`);
              
              // Synthesize and send immediately
              synthesizeSpeechBase64(sentence, isMobile).then(audio => {
                // Check if this response was cancelled
                if (currentResponseId !== responseId) {
                  console.log(`[TTS] Chunk ${thisSentenceNum} discarded (interrupted)`);
                  return;
                }
                
                // Mark AI as speaking on first chunk
                if (thisSentenceNum === 1) {
                  isAISpeaking = true;
                }
                
                ws.send(JSON.stringify({
                  type: 'ai_audio_chunk',
                  text: sentence,
                  audio: audio,
                  isFirst: thisSentenceNum === 1
                }));
                console.log(`[TTS] ✅ Sent chunk ${thisSentenceNum}`);
              }).catch(err => {
                console.error('[TTS] Error:', err.message);
              });
            }
          }
        },
        // onComplete
        (complete) => {
          fullResponse = complete;
          
          // Synthesize any remaining text
          if (sentenceBuffer.trim()) {
            sentenceCount++;
            const finalSentenceNum = sentenceCount;
            const finalText = sentenceBuffer.trim();
            console.log(`[TTS] Final chunk: "${finalText}"`);
            synthesizeSpeechBase64(finalText, isMobile).then(audio => {
              // Check if this response was cancelled
              if (currentResponseId !== responseId) {
                console.log(`[TTS] Final chunk discarded (interrupted)`);
                return;
              }
              
              // Mark AI as speaking if this is the first (and only) chunk
              if (finalSentenceNum === 1) {
                isAISpeaking = true;
              }
              
              ws.send(JSON.stringify({
                type: 'ai_audio_chunk',
                text: finalText,
                audio: audio,
                isFirst: finalSentenceNum === 1,
                isFinal: true
              }));
              console.log(`[TTS] ✅ Sent final chunk`);
            }).catch(err => {
              console.error('[TTS] Error:', err.message);
            });
          }
        },
        selectedModel, // Pass the selected model
        isMobile // Pass mobile flag for optimizations
      );

      // Add to conversation history
      conversation.addMessage('assistant', fullResponse);

      const duration = Date.now() - startTime;
      console.log(`⏱️ LLM response time: ${duration}ms`);
      console.log(`[AI Response] "${fullResponse}"`);

      // Notify that response is complete (text-wise)
      ws.send(JSON.stringify({
        type: 'ai_response_complete',
        text: fullResponse
      }));

    } catch (error) {
      console.error('[Process] ❌ Error processing message:');
      console.error('[Process] Error message:', error.message);
      console.error('[Process] Error stack:', error.stack);
      console.error('[Process] Selected model:', selectedModel);
      console.error('[Process] Full error:', error);
      
      ws.send(JSON.stringify({
        type: 'error',
        message: '唔好意思，系統出咗啲問題...',
        details: error.message // Send error details to client for debugging
      }));
    } finally {
      isProcessing = false;
    }
  }

  // Stop conversation
  function handleStop() {
    console.log(`[Session ${sessionId}] ⏹️ Stopping`);
    
    if (sttManager) {
      sttManager.stream.end();
      sttManager.reset();
      sttManager = null;
    }

    isAISpeaking = false;
    currentAudioQueue = [];

    if (conversation) {
      console.log(`[Session ${sessionId}] Summary:`, conversation.getSummary());
    }

    ws.send(JSON.stringify({
      type: 'stopped'
    }));
  }

  // Reset conversation
  function handleReset() {
    handleStop();
    if (conversation) {
      conversation.clear();
    }
    ws.send(JSON.stringify({
      type: 'reset',
      message: 'Conversation reset'
    }));
  }

  // Cleanup on disconnect
  ws.on('close', () => {
    console.log(`[WebSocket] 🔌 Disconnected: ${sessionId}`);
    handleStop();
    if (conversation) {
      deleteSession(sessionId);
    }
  });

  ws.on('error', (error) => {
    console.error(`[WebSocket] Error for ${sessionId}:`, error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down...');
  server.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  server.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});

