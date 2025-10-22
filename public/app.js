// Client-side app with interruption support
let ws = null;
let audioContext = null;
let mediaRecorder = null;
let audioQueue = [];
let isPlaying = false;
let currentAudio = null;
let isAISpeaking = false; // Track if AI is in speaking mode
let vadEnabled = false; // Only enable VAD after echo cancellation stabilizes
let audioStartTime = 0; // Track when audio started
let recentAudioLevels = []; // Track recent audio levels for echo detection
let audioUnlocked = false; // Track if iOS audio is unlocked
let audioPool = []; // Pool of pre-created audio elements for iOS
let preloadedAudio = null; // Pre-created audio element for iOS

// Audio buffering for STT initialization
let sttReady = false; // Track if STT is ready to receive audio
let audioBuffer = []; // Buffer audio chunks until STT is ready
const MAX_BUFFER_SIZE = 50; // Max chunks to buffer (~1 second at 16kHz)
let allowAudioStreaming = false; // Don't stream audio until greeting finishes

const connectBtn = document.getElementById('connectBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const conversation = document.getElementById('conversation');
const waveform = document.getElementById('waveform');
const mobileHint = document.getElementById('mobileHint');
const debugLog = document.getElementById('debugLog');

// Debug logging (visible on mobile)
function debugMsg(msg) {
  console.log(msg);
  if (debugLog && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    debugLog.style.display = 'block';
    const line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
    debugLog.appendChild(line);
    debugLog.scrollTop = debugLog.scrollHeight;
    // Keep last 10 lines
    while (debugLog.children.length > 10) {
      debugLog.removeChild(debugLog.firstChild);
    }
  }
}

// Show mobile hint if on mobile device
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  if (mobileHint) mobileHint.style.display = 'block';
  debugMsg('📱 Mobile device detected');
}

// Connect to WebSocket
connectBtn.addEventListener('click', () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    setStatus('connected', '已連接');
    connectBtn.disabled = true;
    startBtn.disabled = false;
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleServerMessage(data);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    setStatus('disconnected', '連接錯誤');
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    setStatus('disconnected', '連接已斷開');
    connectBtn.disabled = false;
    startBtn.disabled = true;
    stopBtn.disabled = true;
  };
});

// Start conversation
startBtn.addEventListener('click', async () => {
  try {
    // Reset STT state
    sttReady = false;
    audioBuffer = [];
    allowAudioStreaming = false; // Don't stream until greeting finishes
    console.log('[STT] Waiting for STT ready signal...');
    
    // iOS Audio Context Fix: Resume audio context on user gesture
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    }
    
    // Resume audio context (iOS requirement)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log('[Audio] AudioContext resumed for iOS');
    }
    
    // iOS Audio Unlock: Create audio elements during user gesture
    if (!audioUnlocked) {
      try {
        debugMsg('🔓 Unlocking iOS audio...');
        
        // Method 1: Play silent audio to unlock
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4S/5VEkAAAAAAD/+xDEAAP8AAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxA8DwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
        silentAudio.volume = 0.01;
        await silentAudio.play();
        
        // Method 2: Pre-create audio element pool (iOS allows these to play)
        for (let i = 0; i < 3; i++) {
          const audio = new Audio();
          audio.volume = 1.0;
          audioPool.push(audio);
        }
        
        audioUnlocked = true;
        debugMsg('✅ iOS audio unlocked');
        console.log('[Audio] iOS audio unlocked, created ' + audioPool.length + ' audio elements');
      } catch (e) {
        debugMsg('⚠️ Audio unlock failed: ' + e.message);
        console.warn('[Audio] Failed to unlock:', e);
      }
    }
    
    // Request microphone with aggressive echo cancellation
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,      // Remove speaker echo
        noiseSuppression: true,       // Remove background noise
        autoGainControl: true,        // Normalize volume
        // Advanced: More aggressive echo cancellation
        echoCancellationType: 'system' // Use system-level AEC if available
      }
    });

    // Setup audio processing
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    let lastAudioLevel = 0;
    let isSpeakingLocally = false;
    
    // Detect mobile device for adjusted VAD settings
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('[Device] Mobile detected:', isMobile);
    
    // Voice Activity Detection (VAD) Thresholds
    // Adjust these if interruption is too sensitive or not sensitive enough:
    // - SPEECH_THRESHOLD: Lower = more sensitive (detects quieter speech)
    //   Default: 0.01 (works for normal speaking volume)
    //   If you need to shout: try 0.005 or 0.003
    //   If it triggers too easily: try 0.02 or 0.03
    // - SILENCE_THRESHOLD: Should be lower than SPEECH_THRESHOLD
    // 
    // NOTE: Increased to 0.04 to prevent AI's echo from triggering interruption
    // Echo cancellation reduces AI voice but doesn't eliminate it completely
    const SPEECH_THRESHOLD = 0.04; // Higher to avoid echo false positives
    const SILENCE_THRESHOLD = 0.008; // Scaled up proportionally
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate audio level for visualization
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += Math.abs(inputData[i]);
      }
      const level = sum / inputData.length;
      lastAudioLevel = level;
      
      // Update waveform visualization
      updateWaveform(level);
      
      // Track recent audio levels for echo detection
      recentAudioLevels.push(level);
      if (recentAudioLevels.length > 10) {
        recentAudioLevels.shift(); // Keep last 10 samples (~200ms)
      }
      
      // Client-side VAD for interruption detection
      // ONLY check for user speech when AI is speaking AND vadEnabled
      // vadEnabled is delayed to let echo cancellation stabilize (prevents false interrupts)
      if (isAISpeaking && vadEnabled) {
        // AI is speaking - check if user wants to interrupt
        if (!isSpeakingLocally && level > SPEECH_THRESHOLD) {
          // Detected audio above threshold - but is it real speech or echo?
          const timeSinceAudioStart = Date.now() - audioStartTime;
          const avgRecentLevel = recentAudioLevels.reduce((a, b) => a + b, 0) / recentAudioLevels.length;
          const isSuddenSpike = level > avgRecentLevel * 3; // More than 3x recent average
          const isEarlyInAudio = timeSinceAudioStart < 1000; // First second of audio
          
          // If it's a sudden spike in the first second, it's likely echo - ignore it
          if (isSuddenSpike && isEarlyInAudio) {
            console.log('[VAD Client] ⚠️ Ignoring spike - likely echo (level: ' + level.toFixed(4) + ', time: ' + timeSinceAudioStart + 'ms)');
          } else {
            // Real user speech - interrupt AI!
            isSpeakingLocally = true;
            console.log('[VAD Client] 🎤 Speech detected while AI speaking (level: ' + level.toFixed(4) + ')');
            console.log('[VAD Client] ⚡ Interrupting AI!');
            setStatus('listening', '✋ 打斷緊...');
            stopAudioPlayback();
          }
        } else if (isSpeakingLocally && level < SILENCE_THRESHOLD) {
          // User stopped speaking
          isSpeakingLocally = false;
          console.log('[VAD Client] 🔇 Silence detected');
        }
      } else {
        // AI is NOT speaking OR VAD not enabled - reset local speaking flag
        // (Server-side VAD will handle turn-taking)
        if (isSpeakingLocally && level < SILENCE_THRESHOLD) {
          isSpeakingLocally = false;
        }
      }
      
      // Debug: Show audio level in console occasionally (every ~1 second)
      if (Math.random() < 0.02) {
        console.log('[Audio Level] ' + level.toFixed(4) + ' (threshold: ' + SPEECH_THRESHOLD + ')');
      }

      // Convert and send audio
      const pcm16 = convertFloat32ToInt16(inputData);
      const base64Audio = arrayBufferToBase64(pcm16.buffer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        // Don't send audio until greeting finishes playing
        if (!allowAudioStreaming) {
          if (Math.random() < 0.01) {
            console.log('[Audio] Waiting for greeting to finish before streaming...');
          }
          return;
        }
        
        if (!sttReady) {
          // STT not ready yet - buffer audio chunks
          audioBuffer.push(base64Audio);
          
          // Prevent buffer overflow (keep last N chunks)
          if (audioBuffer.length > MAX_BUFFER_SIZE) {
            audioBuffer.shift(); // Remove oldest chunk
          }
          
          // Log buffering status occasionally
          if (Math.random() < 0.01) {
            console.log('[STT] Buffering audio... (' + audioBuffer.length + ' chunks)');
          }
        } else {
          // STT ready - send audio in real-time
          ws.send(JSON.stringify({
            type: 'audio',
            audio: base64Audio
          }));
        }
      }
    };

    // Start session
    ws.send(JSON.stringify({ type: 'start' }));
    
    setStatus('listening', '聆聽中...');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    waveform.style.display = 'flex';

  } catch (error) {
    console.error('Error starting:', error);
    alert('無法存取麥克風。請確保已授權麥克風權限。');
  }
});

// Stop conversation
stopBtn.addEventListener('click', () => {
  if (ws) {
    ws.send(JSON.stringify({ type: 'stop' }));
  }
  stopAudioPlayback();
  
  // Stop audio context
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  // Reset STT state
  sttReady = false;
  audioBuffer = [];
  allowAudioStreaming = false;
  audioUnlocked = false; // Reset iOS audio unlock
  audioPool = []; // Clear audio pool
  
  setStatus('connected', '已停止');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  waveform.style.display = 'none';
});

// Handle server messages
function handleServerMessage(data) {
  console.log('Server message:', data);

  switch (data.type) {
    case 'ready':
      console.log('Agent ready');
      break;
    
    case 'stt_ready':
      // STT is ready to receive audio - flush buffered audio
      console.log('[STT] ✅ STT ready - flushing ' + audioBuffer.length + ' buffered chunks');
      sttReady = true;
      
      // Flush buffered audio chunks
      while (audioBuffer.length > 0) {
        const bufferedChunk = audioBuffer.shift();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'audio',
            audio: bufferedChunk
          }));
        }
      }
      console.log('[STT] ✅ Buffer flushed, now streaming in real-time');
      break;

    case 'ai_response':
      // Initial greeting (full response at once)
      debugMsg('📥 Got greeting: ' + data.text.substring(0, 20));
      addMessage('ai', data.text);
      queueAudio(data.audio, true);
      
      // IMPORTANT: Mark as AI speaking to prevent echo detection during greeting
      isAISpeaking = true;
      console.log('[Greeting] AI speaking - VAD disabled until greeting finishes');
      break;

    case 'transcript':
      // User speech transcription
      if (data.isFinal) {
        addMessage('user', data.text);
      } else {
        updateInterimTranscript(data.text);
      }
      break;

    case 'user_speech_start':
      setStatus('listening', '🎤 你講緊嘢...');
      break;

    case 'user_speech_end':
      setStatus('thinking', '諗緊...');
      break;

    case 'ai_thinking':
      // Show AI thinking (streaming text)
      updateAIThinking(data.current);
      break;

    case 'ai_audio_chunk':
      // Streaming audio chunk
      debugMsg('📥 Audio chunk: ' + data.text.substring(0, 15));
      console.log('[Chunk] Received:', data.text);
      
      // Clear thinking message when first audio arrives
      if (data.isFirst && thinkingMsg) {
        thinkingMsg.remove();
        thinkingMsg = null;
      }
      
      // Add message on first chunk
      if (data.isFirst) {
        addMessage('ai', data.text);
      } else {
        // Append to last AI message
        appendToLastAIMessage(data.text);
      }
      
      // Queue audio for playback
      queueAudio(data.audio, data.isFirst);
      break;

    case 'ai_response_complete':
      setStatus('listening', '聆聽中...');
      break;

    case 'stop_playback':
      // Interruption - stop current playback
      console.log('[Interruption] ✋ Received stop_playback, stopping audio now (isPlaying=' + isPlaying + ')');
      stopAudioPlayback();
      
      // Clear any AI thinking message
      if (thinkingMsg) {
        thinkingMsg.remove();
        thinkingMsg = null;
      }
      
      setStatus('listening', '🎤 你講緊嘢...');
      console.log('[Interruption] ✅ Interruption complete, ready for new input');
      break;

    case 'error':
      console.error('Error:', data.message);
      addMessage('system', `錯誤：${data.message}`);
      break;

    case 'stopped':
      console.log('Conversation stopped');
      break;

    case 'reset':
      console.log('Session reset');
      break;
  }
}

// Add message to conversation
function addMessage(role, text) {
  // Clear placeholder
  if (conversation.children.length === 1 && conversation.children[0].style.textAlign === 'center') {
    conversation.innerHTML = '';
  }

  // Remove interim message if exists
  const interimMsg = conversation.querySelector('.message.interim');
  if (interimMsg) {
    interimMsg.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  messageDiv.dataset.text = text; // For deduplication
  
  const labelMap = {
    user: '你',
    ai: 'AI',
    system: '系統'
  };

  messageDiv.innerHTML = `
    <div class="message-label">${labelMap[role] || role}</div>
    <div class="message-text">${text}</div>
  `;
  
  conversation.appendChild(messageDiv);
  conversation.scrollTop = conversation.scrollHeight;
}

// Add message only if not duplicate
function addMessageIfNew(role, text) {
  const lastMsg = conversation.querySelector(`.message.${role}:last-child`);
  if (!lastMsg || lastMsg.dataset.text !== text) {
    addMessage(role, text);
  }
}

// Append text to last AI message
function appendToLastAIMessage(text) {
  const lastAIMsg = conversation.querySelector('.message.ai:last-child');
  if (lastAIMsg && !lastAIMsg.classList.contains('interim')) {
    const textDiv = lastAIMsg.querySelector('.message-text');
    if (textDiv) {
      textDiv.textContent += text;
      lastAIMsg.dataset.text += text;
    }
  }
  conversation.scrollTop = conversation.scrollHeight;
}

// Update interim transcript
function updateInterimTranscript(text) {
  let interimMsg = conversation.querySelector('.message.interim');
  
  if (!interimMsg) {
    if (conversation.children.length === 1 && conversation.children[0].style.textAlign === 'center') {
      conversation.innerHTML = '';
    }

    interimMsg = document.createElement('div');
    interimMsg.className = 'message interim';
    interimMsg.innerHTML = `
      <div class="message-label">你 (講緊...)</div>
      <div class="message-text">${text}</div>
    `;
    conversation.appendChild(interimMsg);
  } else {
    interimMsg.querySelector('.message-text').textContent = text;
  }
  
  conversation.scrollTop = conversation.scrollHeight;
}

// Update AI thinking message
let thinkingMsg = null;
function updateAIThinking(text) {
  if (!thinkingMsg) {
    if (conversation.children.length === 1 && conversation.children[0].style.textAlign === 'center') {
      conversation.innerHTML = '';
    }

    thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'message ai';
    thinkingMsg.style.opacity = '0.7';
    thinkingMsg.innerHTML = `
      <div class="message-label">AI (諗緊...)</div>
      <div class="message-text">${text}</div>
    `;
    conversation.appendChild(thinkingMsg);
  } else {
    thinkingMsg.querySelector('.message-text').textContent = text;
  }
  
  conversation.scrollTop = conversation.scrollHeight;
}

// Queue audio chunk for playback
function queueAudio(base64Audio, isFirst = false) {
  debugMsg('🎵 Queue audio: ' + (base64Audio ? base64Audio.substring(0, 20) + '...' : 'NULL'));
  console.log('[Queue] Adding audio chunk (queue size: ' + audioQueue.length + ', isFirst: ' + isFirst + ')');
  console.log('[Queue] Audio data length:', base64Audio ? base64Audio.length : 0);
  
  if (!base64Audio || base64Audio.length === 0) {
    debugMsg('❌ Empty audio data!');
    return;
  }
  
  audioQueue.push(base64Audio);
  
  // Start playing if this is the first chunk or nothing is playing
  if (isFirst || !isPlaying) {
    isAISpeaking = true;
    debugMsg('▶️ Start playback');
    console.log('[Queue] Starting playback (isPlaying: ' + isPlaying + ', isAISpeaking: ' + isAISpeaking + ')');
    playNextInQueue();
  }
}

// Play next audio in queue
function playNextInQueue() {
  // Check if interrupted
  if (!isAISpeaking || audioQueue.length === 0) {
    console.log('[Queue] Empty or stopped');
    isPlaying = false;
    isAISpeaking = false;
    vadEnabled = false; // Disable VAD when finished
    recentAudioLevels = []; // Reset audio levels
    audioStartTime = 0; // Reset start time
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ai_finished_speaking' }));
    }
    return;
  }

  const base64Audio = audioQueue.shift();
  debugMsg('🔊 Playing chunk (' + audioQueue.length + ' left)');
  console.log('[Audio] 🔊 Playing chunk (remaining: ' + audioQueue.length + ')');
  
  // Use pre-created audio element from pool (iOS requirement)
  // iOS only allows Audio elements created during user gesture to play
  let audio;
  if (audioPool.length > 0) {
    audio = audioPool.shift();
    debugMsg('✓ Using pooled audio element');
    console.log('[Audio] Using pre-created audio element from pool');
  } else {
    audio = new Audio();
    debugMsg('⚠️ Creating new audio (pool empty)');
    console.log('[Audio] Pool empty, creating new audio element');
  }
  currentAudio = audio;
  
  // Set source AFTER adding event listeners (iOS requirement)
  audio.onplay = () => {
    isPlaying = true;
    audioStartTime = Date.now(); // Track when this audio chunk started
    recentAudioLevels = []; // Reset recent levels for this new audio chunk
    setStatus('speaking', 'AI講緊嘢...');
    debugMsg('✅ Audio playing');
    console.log('[Audio] ▶️ Playing (started at: ' + audioStartTime + ')');
    
    // Enable VAD after delay to let echo cancellation stabilize
    // Mobile needs longer delay due to weaker echo cancellation
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const vadDelay = isMobile ? 1000 : 300; // 1s for mobile, 300ms for desktop
    
    setTimeout(() => {
      if (isAISpeaking && isPlaying) {
        vadEnabled = true;
        console.log('[VAD] ✅ Enabled after ' + vadDelay + 'ms (mobile: ' + isMobile + ')');
      }
    }, vadDelay);
  };
  
  audio.oncanplay = () => {
    debugMsg('✓ Audio can play');
  };
  
  audio.onloadstart = () => {
    debugMsg('⏳ Audio loading...');
  };
  
  audio.onloadeddata = () => {
    debugMsg('✓ Audio data loaded');
  };
  
  audio.onstalled = () => {
    debugMsg('⚠️ Audio stalled');
  };
  
  // Set source using Blob URL (iOS requirement - data URIs often fail)
  try {
    debugMsg('Setting src (base64 len: ' + base64Audio.length + ')');
    
    // Validate base64
    if (!base64Audio || base64Audio.length < 100) {
      debugMsg('❌ Invalid audio data');
      throw new Error('Audio data too short or empty');
    }
    
    // Convert base64 to Blob
    const binaryString = atob(base64Audio);
    debugMsg('✓ Base64 decoded (' + binaryString.length + ' bytes)');
    
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    debugMsg('✓ Created byte array');
    
    // Try multiple MIME types for iOS compatibility
    const blob = new Blob([bytes.buffer], { type: 'audio/mp3' });
    debugMsg('✓ Created blob (' + blob.size + ' bytes, type: ' + blob.type + ')');
    
    const blobUrl = URL.createObjectURL(blob);
    debugMsg('✓ Created blob URL: ' + blobUrl.substring(0, 30) + '...');
    
    // Store blob URL for cleanup
    audio.dataset.blobUrl = blobUrl;
    
    audio.src = blobUrl;
    debugMsg('✓ Set audio.src');
    
    audio.load(); // Explicitly load on iOS
    debugMsg('✓ Called audio.load()');
  } catch (e) {
    debugMsg('❌ Error: ' + e.message);
    console.error('[Audio] Error creating blob:', e);
  }

  audio.onended = () => {
    console.log('[Audio] ⏹️ Chunk ended');
    isPlaying = false;
    
    // Clean up blob URL
    if (audio.dataset.blobUrl) {
      URL.revokeObjectURL(audio.dataset.blobUrl);
      delete audio.dataset.blobUrl;
    }
    
    // Return audio element to pool for reuse
    audio.src = '';
    audio.load();
    audioPool.push(audio);
    debugMsg('♻️ Returned to pool (' + audioPool.length + ')');
    
    currentAudio = null;
    thinkingMsg = null;
    
    // If queue is empty, greeting/response is finished - allow audio streaming
    if (audioQueue.length === 0) {
      allowAudioStreaming = true;
      console.log('[Audio] ✅ Audio finished - microphone streaming enabled');
    }
    
    // Play next in queue after a tiny delay
    setTimeout(() => {
      playNextInQueue();
    }, 50); // 50ms gap between chunks
  };

  audio.onerror = (e) => {
    const errorCode = e.target.error ? e.target.error.code : 'unknown';
    const errorMsg = e.target.error ? e.target.error.message : 'unknown';
    debugMsg('❌ Audio error: code=' + errorCode + ', msg=' + errorMsg);
    console.error('[Audio] ❌ Error:', e);
    console.error('[Audio] Error code:', errorCode);
    console.error('[Audio] Error message:', errorMsg);
    console.error('[Audio] Audio src length:', audio.src ? audio.src.length : 0);
    isPlaying = false;
    
    // Clean up blob URL
    if (audio.dataset.blobUrl) {
      URL.revokeObjectURL(audio.dataset.blobUrl);
      delete audio.dataset.blobUrl;
    }
    
    // Return to pool even on error
    audio.src = '';
    audio.load();
    audioPool.push(audio);
    
    currentAudio = null;
    
    // Enable streaming even if audio fails
    allowAudioStreaming = true;
    console.log('[Audio] ⚠️ Audio error - microphone streaming enabled');
    
    // Try next in queue
    setTimeout(() => playNextInQueue(), 100);
  };

  // Try to play
  audio.play().catch(e => {
    debugMsg('❌ Play failed: ' + e.message);
    console.error('[Audio] ❌ Play failed:', e);
    console.error('[Audio] Error details:', e.name, e.message);
    
    // Clean up blob URL
    if (audio.dataset.blobUrl) {
      URL.revokeObjectURL(audio.dataset.blobUrl);
      delete audio.dataset.blobUrl;
    }
    
    // Return to pool even on play failure
    audio.src = '';
    audio.load();
    audioPool.push(audio);
    
    // Enable streaming if play fails
    allowAudioStreaming = true;
    isPlaying = false;
    currentAudio = null;
    
    // Try next in queue
    setTimeout(() => playNextInQueue(), 100);
  });
}

// Stop audio playback (for interruption)
function stopAudioPlayback() {
  console.log('[Audio] ⏸️ STOPPING ALL AUDIO (queue: ' + audioQueue.length + ', playing: ' + isPlaying + ')');
  
  // Set flags FIRST to prevent new audio from playing
  isAISpeaking = false;
  isPlaying = false;
  vadEnabled = false; // Disable VAD when stopping
  audioQueue = []; // Clear entire queue
  recentAudioLevels = []; // Reset audio levels
  audioStartTime = 0; // Reset start time
  
  // AGGRESSIVELY stop current audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      
      // Clean up blob URL
      if (currentAudio.dataset.blobUrl) {
        URL.revokeObjectURL(currentAudio.dataset.blobUrl);
        delete currentAudio.dataset.blobUrl;
      }
      
      currentAudio.src = ''; // Clear source to force stop
      currentAudio.load(); // Force reload to completely stop
      console.log('[Audio] ✋ Current audio forcefully stopped');
    } catch (e) {
      console.error('[Audio] Error stopping:', e);
    }
    currentAudio = null;
  }
  
  // Clear any AI thinking message
  if (thinkingMsg) {
    try {
      thinkingMsg.remove();
    } catch (e) {}
    thinkingMsg = null;
  }
  
  // Notify server that AI stopped speaking (interrupted)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ai_finished_speaking' }));
  }
  
  console.log('[Audio] ✅ All audio stopped, queue cleared');
}

// Update waveform visualization
function updateWaveform(level) {
  const bars = waveform.querySelectorAll('.wave-bar');
  const normalizedLevel = Math.min(level * 100, 1);
  
  bars.forEach((bar, i) => {
    const height = 20 + (normalizedLevel * 40 * Math.sin(i * 0.5 + Date.now() * 0.01));
    bar.style.height = `${height}px`;
  });
}

// Set status
function setStatus(status, text) {
  statusIndicator.className = 'status-indicator ' + status;
  statusText.textContent = text;
}

// Audio conversion utilities
function convertFloat32ToInt16(buffer) {
  const int16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Space bar for push-to-talk (future feature)
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    console.log('Push-to-talk (not yet implemented)');
  }
});

