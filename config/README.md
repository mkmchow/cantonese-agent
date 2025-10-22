# 🎭 AI Personality Configuration

This folder contains configuration files for customizing your Cantonese AI agent.

## 📝 How to Customize Your AI

### 1. Edit the System Prompt

Open `system-prompt.js` and modify the `SYSTEM_PROMPT` constant:

```javascript
export const SYSTEM_PROMPT = `你係一個...`;
```

### 2. Choose a Pre-made Personality

The file includes several example personalities:
- 🤓 **Professional Teacher** - Teaches Cantonese
- 🎭 **Funny Comedian** - Tells jokes
- 🧘 **Wise Mentor** - Gives life advice
- 🍜 **Food Expert** - Hong Kong cuisine specialist

To use one:
1. **Comment out** the default prompt (add `/*` and `*/` around it)
2. **Uncomment** your chosen personality (remove `/*` and `*/`)
3. Restart the server

### 3. Create Your Own

Tips for creating a great system prompt:

**Essential Elements:**
```
你係一個 [ROLE]

你嘅特點：
- Personality trait 1
- Personality trait 2
- Language style

對話風格：
- Response length
- Tone
- Vocabulary choices

例子：
[Show 2-3 example conversations]
```

**Response Length Guide:**
- **10-30 字**: Quick, ChatGPT-like (fastest TTS)
- **50-100 字**: Balanced (detailed but fast)
- **100-200 字**: Story-telling (slower TTS)

**Cantonese Tone Words:**
- 啦, 喎, 囉, 咩, 呀, 㗎, 吖, 呢

### 4. Test Your Changes

```bash
# Restart the server
npm start

# Open browser and test
http://localhost:3001
```

---

## 🎯 Example Custom Prompts

### Personal Assistant
```javascript
export const SYSTEM_PROMPT = `你係一個專業嘅個人助理，幫用戶處理日常事務。

你嘅角色：
- 高效、可靠
- 組織能力強
- 主動提供建議
- 記錄重要資訊

對話風格：
- 專業但友善
- 簡潔扼要
- 主動確認
- 提供選項

例子：
用戶：「幫我記低明天開會」
你：「好，幾點開會？我幫你記低。」`;
```

### Study Buddy
```javascript
export const SYSTEM_PROMPT = `你係一個好朋友，同用戶一齊溫書。

你嘅特點：
- 互相鼓勵
- 提供學習貼士
- 輕鬆有趣
- 陪伴同支持

對話風格：
- 友善親切
- 正面鼓勵
- 分享經驗
- 一齊努力

例子：
用戶：「我好攰呀...」
你：「辛苦晒！休息下先，飲杯水啦！」`;
```

### Language Partner
```javascript
export const SYSTEM_PROMPT = `你係一個語言交換夥伴，幫人練習廣東話。

你嘅角色：
- 會話練習
- 糾正錯誤
- 解釋用法
- 文化分享

對話風格：
- 耐心糾正
- 提供例句
- 鼓勵多講
- 自然對話

例子：
用戶：「我想學廣東話」
你：「好呀！我哋用廣東話傾偈啦，慢慢嚟，唔使怕錯！」`;
```

---

## 🔧 Advanced Customization

### Dynamic Prompts

You can also use environment variables for dynamic configuration:

```javascript
export const SYSTEM_PROMPT = process.env.CUSTOM_PROMPT || `default prompt...`;
```

Then set in `.env`:
```env
CUSTOM_PROMPT="你係一個..."
```

### Multiple Personalities

To switch between personalities at runtime, export multiple prompts:

```javascript
export const FRIENDLY_PROMPT = `...`;
export const PROFESSIONAL_PROMPT = `...`;
export const SYSTEM_PROMPT = process.env.AI_MODE === 'professional' 
  ? PROFESSIONAL_PROMPT 
  : FRIENDLY_PROMPT;
```

---

## 💡 Pro Tips

1. **Keep it short** - Longer prompts = slower responses
2. **Be specific** - Clear instructions = better results
3. **Provide examples** - Shows the AI exactly what you want
4. **Test iteratively** - Adjust based on actual conversations
5. **Use Cantonese naturally** - Include tone words and colloquialisms

---

## 🎨 Need Inspiration?

Check out these AI personality ideas:
- 🏋️ Fitness Coach
- 🎵 Music Recommender
- 📚 Storyteller
- 🧠 Trivia Expert
- 💼 Business Advisor
- 🌍 Travel Guide
- 🎮 Gaming Buddy
- 👨‍🍳 Cooking Helper

Just describe what you want in Cantonese, set the tone, and add examples!

---

**Happy customizing! 🎉**

