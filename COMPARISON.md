# 🎭 Cantonese Agent vs 喂喂機

Comparison of the two Cantonese voice AI projects

---

## 📊 Overview

| Aspect | 喂喂機 (WeiWei) | Cantonese Agent |
|--------|----------------|-----------------|
| **Purpose** | Restaurant reservation automation | General conversational AI |
| **Conversation Type** | Task-oriented | Open-ended |
| **Primary Use** | Business automation | Personal assistant |
| **Port** | 3000 | 3001 |

---

## 🎯 Key Differences

### 喂喂機 (WeiWei) - Restaurant Agent

**Focus:** Collect specific information for reservations

**Features:**
- ✅ Slot filling (name, party size, date, time)
- ✅ Structured conversation flow
- ✅ Completion detection
- ✅ Business-focused prompts
- ✅ Reservation data tracking

**Best For:**
- Restaurants
- Appointment booking
- Structured data collection
- Business automation

**Example Conversation:**
```
AI: 喂，你好！呢度係XX餐廳，請問有咩可以幫到你？
User: 有冇今晚七點兩位？
AI: 有呀～請問貴姓？
User: 陳先生
AI: 好嘅陳先生，今晚七點兩位，收到！
✅ Reservation complete
```

---

### Cantonese Agent - General AI

**Focus:** Natural, ChatGPT-like conversation

**Features:**
- ✅ Open-ended conversation
- ✅ Full interruption support
- ✅ Context memory (20 messages)
- ✅ Natural dialogue flow
- ✅ No task restrictions

**Best For:**
- Personal use
- Language practice
- General questions
- Casual chatting
- Learning Cantonese

**Example Conversation:**
```
AI: 你好！我係你嘅AI助手，可以用廣東話同你傾偈。有咩可以幫到你？
User: 今日天氣點呀？
AI: 我睇唔到天氣喎，不過你可以問我其他嘢！
User: 咁講個笑話俾我聽啦
AI: 好呀！點解雞仔過馬路？因為佢想去對面囉！哈哈😄
User: [interrupts mid-sentence] 唔好講笑話喇
AI: [stops immediately] 好嘅！有咩我可以幫到你？
```

---

## 🔧 Technical Differences

### Architecture

**喂喂機:**
```
User speaks → STT → Slot Extraction (regex) → LLM → TTS → Response
                      ↓
                Reservation tracking
```

**Cantonese Agent:**
```
User speaks → STT (streaming) → LLM (streaming) → TTS (streaming) → Response
    ↓                                                                    ↑
Voice activity detection → Interruption → Stop playback ───────────────┘
```

### Interruption Handling

**喂喂機:**
- Basic silence detection
- Waits for user to finish speaking
- No mid-response interruption

**Cantonese Agent:**
- Real-time VAD (Voice Activity Detection)
- Detects when user starts speaking
- Immediately stops AI playback
- Seamless interruption support

### Slot Filling

**喂喂機:**
```javascript
// Fast regex-based extraction
slots = {
  name: '陳先生',
  partySize: '兩位',
  date: '今晚',
  time: '七點'
}
```

**Cantonese Agent:**
```javascript
// No slot filling - just conversation history
messages = [
  { role: 'user', content: '...' },
  { role: 'assistant', content: '...' }
]
```

---

## 💰 Cost Comparison

### Per Conversation (estimated)

**喂喂機:**
- STT: ~$0.001 (1 min avg)
- LLM: ~$0.0001 (short responses)
- TTS: ~$0.001 (cached often)
- **Total: ~$0.002 per reservation**

**Cantonese Agent:**
- STT: ~$0.003 (3 min avg, longer conversations)
- LLM: ~$0.001 (more tokens)
- TTS: ~$0.002 (longer responses)
- **Total: ~$0.006 per conversation**

---

## 🎨 Customization

### 喂喂機 - Customize for Your Business

**Change restaurant name:**
```javascript
// config/prompts.js
const INITIAL_GREETING = `喂，你好！呢度係[你餐廳名]，請問有咩可以幫到你？`;
```

**Add more slots:**
```javascript
// services/session.js
this.slots = {
  name: null,
  partySize: null,
  date: null,
  time: null,
  specialRequests: null, // NEW!
  phoneNumber: null      // NEW!
};
```

### Cantonese Agent - Change Personality

**Make it funny:**
```javascript
// services/llm-streaming.js
const SYSTEM_PROMPT = `你係一個幽默風趣嘅AI助手，
鐘意講笑話同埋用有趣嘅方式回答問題...`;
```

**Make it a teacher:**
```javascript
const SYSTEM_PROMPT = `你係一個專業嘅廣東話老師，
幫學生學好正宗廣東話...`;
```

---

## 🚀 Performance

### Speed Comparison

**喂喂機:**
- Slot extraction: <1ms (regex)
- LLM response: 600-800ms
- TTS (cached): 0ms
- TTS (uncached): 300ms
- **Total: 0.6-1.2 seconds**

**Cantonese Agent:**
- No slot extraction
- LLM streaming: 600-1000ms (feels faster!)
- TTS streaming: 300-500ms (plays while generating)
- **Total: 1-1.5 seconds (perceived faster due to streaming)**

### Interruption Speed

**喂喂機:**
- Not optimized for interruption
- User must wait for AI to finish

**Cantonese Agent:**
- Interruption detection: <100ms
- Playback stop: Immediate
- New input processing: Instant

---

## 🎯 When to Use Which?

### Use 喂喂機 When:
- ✅ You need to collect specific information
- ✅ Running a business (restaurant, salon, etc.)
- ✅ Want to automate phone bookings
- ✅ Need structured data output
- ✅ Task completion is important

### Use Cantonese Agent When:
- ✅ You want natural conversation
- ✅ No specific task to complete
- ✅ Practicing Cantonese
- ✅ General Q&A
- ✅ ChatGPT-like experience needed

---

## 🔄 Can They Work Together?

**Yes!** You could:

1. **Start with Cantonese Agent** for natural greeting
2. **Switch to 喂喂機 mode** when user wants to book
3. **Return to Cantonese Agent** after booking complete

Example combined flow:
```javascript
// Detect intent
if (userMessage.includes('訂枱') || userMessage.includes('預約')) {
  switchToReservationMode(); // Use 喂喂機 logic
} else {
  continueConversation(); // Use Cantonese Agent logic
}
```

---

## 📈 Scaling Considerations

### 喂喂機 (Business Use)
- Add database (Supabase)
- Add SMS confirmations
- Add phone integration (Twilio)
- Add admin dashboard
- Handle concurrent calls

### Cantonese Agent (Personal Use)
- Fine-tune for specific use cases
- Add more context memory
- Integrate with other services
- Add multimodal support (images, etc.)
- Deploy for public access

---

## 🎓 Learning Path

If you're new to Cantonese voice AI:

1. **Start with Cantonese Agent**
   - Learn the basics
   - Understand the flow
   - Test with general conversation

2. **Then try 喂喂機**
   - See how slot filling works
   - Understand business logic
   - Test structured conversations

3. **Combine concepts**
   - Build your own custom agent
   - Mix general + task-specific
   - Create your perfect assistant!

---

## 💡 Pro Tips

### For 喂喂機:
- Pre-cache common responses for instant playback
- Use regex for speed, LLM for complex extractions
- Keep confirmation messages short
- Test with real customers

### For Cantonese Agent:
- Adjust personality to your preference
- Use interruption naturally
- Keep context window reasonable
- Stream everything for best UX

---

## 🎉 Conclusion

Both projects serve different purposes:

- **喂喂機** = Task automation, business efficiency
- **Cantonese Agent** = Natural conversation, personal use

Choose based on your needs, or combine both! 🚀

---

Built with ❤️ for Cantonese speakers 🇭🇰

