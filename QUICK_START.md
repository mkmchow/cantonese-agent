# 🚀 Quick Start Guide

Get your Cantonese Voice Agent running in minutes!

---

## 📋 Prerequisites

- Node.js 18+
- Google Cloud account (for STT)
- AWS account (for Polly TTS)
- OpenRouter API key

---

## ⚡ Setup (5 minutes)

### 1. Install Dependencies
```bash
cd "C:\Users\marti\Documents\Passion Projects\Cantonese Agent"
npm install
```

### 2. Configure Environment

Copy `env-template.txt` to `.env`:
```bash
copy env-template.txt .env
```

Edit `.env` and add your API keys:
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=openai/gpt-4o-mini

GOOGLE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-east-1

PORT=3001
```

### 3. Add Google Credentials

Place your `google-credentials.json` file in the project root.

### 4. Start Server
```bash
npm start
```

You should see:
```
🎙️ Cantonese Voice Agent running on http://localhost:3001
⚡ Warming up TTS cache...
✅ Ready!
```

### 5. Open Browser

Go to: http://localhost:3001

---

## 🎙️ How to Use

### First Time Setup

1. Click **「連接」** (Connect)
2. Click **「開始對話」** (Start Conversation)
3. Allow microphone access when prompted
4. Wait for AI greeting in Cantonese
5. **Start speaking in Cantonese!**

### Natural Conversation

Just talk like you're chatting with a friend:
- "你好呀！"
- "今日天氣點呀？"
- "講個笑話俾我聽啦"
- "教我講廣東話"
- "你識唔識煮嘢食？"

### Voice Interruption 🔥

**The cool part:** You can interrupt the AI anytime!

- While AI is speaking, just start talking
- AI will stop immediately
- Your new input takes priority
- Feels like a real conversation!

---

## 💡 Features

### ✅ Real-time Conversation
- Sub-second response times
- Streaming LLM responses
- Instant audio playback

### ✅ Natural Interruption
- Speak while AI is talking
- AI stops immediately
- No awkward pauses

### ✅ Context Memory
- Remembers conversation history
- Natural follow-up questions
- Last 20 messages kept in memory

### ✅ Visual Feedback
- Status indicator shows what's happening
- Waveform shows you're being heard
- Real-time transcription display

---

## 🎯 Difference from 喂喂機

| Feature | 喂喂機 | Cantonese Agent |
|---------|--------|-----------------|
| **Purpose** | Restaurant reservations | General conversation |
| **Slot Filling** | Yes (name, time, etc) | No |
| **Conversation** | Task-specific | Open-ended |
| **Interruption** | Basic | Full support |
| **Use Case** | Business automation | Personal assistant |

---

## 🔧 Troubleshooting

### "無法存取麥克風"
- Check browser permissions (click 🔒 in address bar)
- Make sure no other app is using the microphone
- Try refreshing and allowing access again

### No Audio Playback
- Check your speakers/headphones
- Make sure browser isn't muted
- Try clicking on the page first (autoplay restriction)

### STT Not Working
- Make sure Google credentials file exists
- Check Speech-to-Text API is enabled
- Verify you're speaking Cantonese

### Connection Errors
- Make sure server is running (`npm start`)
- Check port 3001 isn't blocked
- Try restarting the server

---

## 🎨 Customization

### Change AI Personality

**Easy way:** Edit `config/system-prompt.js`:

```javascript
export const SYSTEM_PROMPT = `你係一個[YOUR DESCRIPTION]...`;
```

**Pre-made personalities included:**
- 🤓 Professional Teacher (teaches Cantonese)
- 🎭 Funny Comedian (tells jokes)
- 🧘 Wise Mentor (life advice)
- 🍜 Food Expert (Hong Kong cuisine)

Just uncomment the one you want and comment out the default!

**See `config/README.md` for detailed guide.**

### Adjust Response Length

In `services/llm-streaming.js`:
```javascript
max_tokens: 150, // Change this number
```

- Shorter (50-100): Quick, snappy responses
- Longer (150-300): More detailed answers

### Change Voice

In `services/tts-streaming.js`:
```javascript
VoiceId: 'Hiujin', // Try other Polly voices
```

---

## 📊 Performance

Expected performance:
- **Response latency:** 1-1.5 seconds
- **Interruption detection:** <100ms
- **STT latency:** Real-time streaming
- **TTS latency:** ~300ms per sentence

---

## 🎉 You're Ready!

Now just:
1. Open http://localhost:3001
2. Click「連接」→「開始對話」
3. Talk in Cantonese
4. Enjoy natural conversation! 🇭🇰

---

**Tips:**
- 💬 Speak naturally - like chatting with a friend
- ✋ Interrupt freely - it's designed for it!
- 🎯 Ask anything - general conversation, not task-specific
- 🔄 Click「重新開始」to reset conversation

Have fun! 🎙️

