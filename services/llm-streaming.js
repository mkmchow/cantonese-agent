// Streaming LLM for natural Cantonese conversation
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../config/system-prompt.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.YOUR_SITE_URL || 'http://localhost:3001',
    'X-Title': 'Cantonese Voice Agent'
  }
});

/**
 * Generate streaming response for natural conversation
 * @param {Array} conversationHistory - Message history
 * @param {Function} onChunk - Callback for each chunk (text)
 * @param {Function} onComplete - Callback when done (fullText)
 * @param {string} model - Model to use (optional, defaults to gpt-4o-mini)
 * @returns {Promise<string>} - Complete response
 */
export async function generateStreamingResponse(conversationHistory, onChunk, onComplete, model = null) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory
    ];

    const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    const startTime = Date.now();
    console.log(`[LLM] Generating streaming response with ${selectedModel}...`);

    const stream = await openai.chat.completions.create({
      model: selectedModel,
      messages: messages,
      temperature: 0.8, // More creative for natural conversation
      max_tokens: 150, // Longer for general conversation
      presence_penalty: 0.4,
      frequency_penalty: 0.4,
      stream: true
    });

    let fullResponse = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        chunkCount++;
        
        // Send chunk to callback
        if (onChunk) {
          onChunk(content, fullResponse);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[LLM] ✅ Generated in ${duration}ms (${chunkCount} chunks): "${fullResponse.trim()}"`);

    if (onComplete) {
      onComplete(fullResponse.trim());
    }

    return fullResponse.trim();

  } catch (error) {
    console.error('[LLM] Error:', error.message);
    throw error;
  }
}

/**
 * Fast non-streaming response (for quick replies)
 * @param {Array} conversationHistory
 * @returns {Promise<string>}
 */
export async function generateQuickResponse(conversationHistory) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory
  ];

  const response = await openai.chat.completions.create({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    messages: messages,
    temperature: 0.8,
    max_tokens: 100,
    stream: false
  });

  return response.choices[0].message.content.trim();
}

