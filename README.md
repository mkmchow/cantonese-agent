# 🥡 喂喂機 (WeiWei) - Cantonese AI Voice Agent

Real-time Cantonese voice conversation AI agent. Talk naturally in Cantonese with full-duplex audio, interruption support, and low latency.

[![Deploy to Fly.io](https://img.shields.io/badge/Deploy%20to-Fly.io-blueviolet)](https://fly.io)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

## ✨ Features

- 🎤 **Real-time Speech Recognition** - Google Cloud Speech-to-Text (Cantonese)
- 🗣️ **Natural Voice Synthesis** - AWS Polly Cantonese TTS
- 🤖 **Smart AI Responses** - OpenRouter LLM (GPT-4o-mini)
- ⚡ **Low Latency** - Streaming audio, sentence-by-sentence TTS
- 🔄 **Full-Duplex Conversation** - Interrupt the AI anytime (like ChatGPT Voice)
- 📱 **Mobile Friendly** - Responsive UI with sticky controls
- 🎯 **Cantonese-Optimized** - Hong Kong phrases, tone words, natural speech

## 🏗️ Architecture

```
Browser (Microphone) 
    ↓ WebSocket (16kHz PCM audio)
Node.js Server
    ↓ Streaming
Google STT (yue-Hant-HK)
    ↓ Transcript
OpenRouter LLM (gpt-4o-mini)
    ↓ Response
AWS Polly (yue-CN, Hiujin voice)
    ↓ MP3 audio
Browser (Playback)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Google Cloud account (Speech-to-Text API)
- AWS account (Polly)
- OpenRouter API key

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/mkmchow/cantonese-agent.git
cd cantonese-agent
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp env-template.txt .env
# Edit .env with your API keys
```

4. **Add Google credentials**
```bash
# Download google-credentials.json from Google Cloud Console
# Place in project root
```

5. **Start the server**
```bash
npm start
```

6. **Open in browser**
```
http://localhost:3001
```

## 🌍 Deploy to Fly.io (Hong Kong)

### Prerequisites
```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Or on Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

### Deployment Steps

1. **Login to Fly.io**
```bash
fly auth login
```

2. **Launch the app**
```bash
fly launch
# Choose Hong Kong region (hkg)
# Select "Yes" to deploy now
```

3. **Set environment variables**
```bash
# Google Cloud
fly secrets set GOOGLE_PROJECT_ID=your-project-id

# AWS Polly
fly secrets set AWS_ACCESS_KEY_ID=your-access-key
fly secrets set AWS_SECRET_ACCESS_KEY=your-secret-key
fly secrets set AWS_REGION=ap-east-1

# OpenRouter
fly secrets set OPENROUTER_API_KEY=your-openrouter-key
fly secrets set OPENROUTER_MODEL=openai/gpt-4o-mini
fly secrets set YOUR_SITE_URL=https://weiweiji.fly.dev
```

4. **Set Google credentials as secret file**
```bash
cat google-credentials.json | fly secrets set GOOGLE_CREDENTIALS_JSON=-
```

5. **Update server.js to read credentials from env** (if not already done)

6. **Deploy**
```bash
fly deploy
```

7. **Open your app**
```bash
fly open
```

Your app is now live at `https://weiweiji.fly.dev` (or your custom domain)!

## 📁 Project Structure

```
cantonese-agent/
├── server.js              # Main WebSocket server
├── services/
│   ├── stt-streaming.js   # Google Speech-to-Text
│   ├── llm-streaming.js   # OpenRouter LLM
│   ├── tts-streaming.js   # AWS Polly TTS
│   └── conversation.js    # Session management
├── public/
│   ├── index.html         # Web UI
│   └── app.js             # Client-side logic
├── config/
│   └── system-prompt.js   # AI personality/behavior
├── Dockerfile             # Docker configuration
├── fly.toml               # Fly.io configuration
└── package.json           # Dependencies

```

## ⚙️ Configuration

### Customize AI Personality

Edit `config/system-prompt.js` to change the AI's behavior:

```javascript
export const SYSTEM_PROMPT = `你係一個友善、樂於助人嘅AI助手...`;
```

Pre-made personalities available:
- 🤓 Professional Teacher
- 🎭 Funny Comedian
- 🧘 Wise Mentor
- 🍜 Hong Kong Food Expert

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `GOOGLE_PROJECT_ID` | GCP project ID | `my-project-123` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `xxx` |
| `AWS_REGION` | AWS region (HK: ap-east-1) | `ap-east-1` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-...` |
| `OPENROUTER_MODEL` | LLM model | `openai/gpt-4o-mini` |

## 🎯 Performance Optimizations

- ✅ **Streaming LLM** - First token in ~300ms
- ✅ **Sentence-by-sentence TTS** - Audio starts before full response
- ✅ **TTS caching** - Common phrases pre-generated
- ✅ **Latest_long model** - Better STT accuracy
- ✅ **Audio buffering** - Zero audio loss on cold start
- ✅ **Client-side VAD** - Instant interruption detection

**Typical latency:** User stops speaking → AI starts speaking in ~800ms

## 🐛 Troubleshooting

### STT not recognizing Cantonese
- Check `languageCode: 'yue-Hant-HK'` in `services/stt-streaming.js`
- Verify Google Cloud STT API is enabled
- Check microphone permissions in browser

### Interruption not working
- Ensure browser supports WebSocket
- Check audio threshold settings in `public/app.js`
- Try using headphones (reduces echo)

### Audio not playing
- Check AWS Polly permissions
- Verify voice ID is `Hiujin` for Cantonese
- Check browser console for errors

## 📊 Cost Estimate (Monthly)

**Fly.io (Hong Kong):**
- 1 VM (512MB): ~$3.50/month
- Bandwidth (20GB): Free

**APIs (light usage, ~100 conversations/month):**
- Google STT: ~$2
- AWS Polly: ~$1
- OpenRouter (gpt-4o-mini): ~$2

**Total: ~$8-10/month** for personal use

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📝 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- Google Cloud Speech-to-Text (Cantonese recognition)
- AWS Polly (Hiujin voice)
- OpenRouter (LLM API)
- Fly.io (Hong Kong hosting)

---

**Built with ❤️ for the Cantonese-speaking community** 🇭🇰

