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
 * @param {boolean} isMobile - Whether client is mobile (for optimization)
 * @returns {Promise<string>} - Complete response
 */
export async function generateStreamingResponse(conversationHistory, onChunk, onComplete, model = null, isMobile = false) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory
    ];

    const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    
    // Mobile optimization: Shorter responses for faster delivery
    // Desktop: 150 tokens (~2-3 sentences)
    // Mobile: 100 tokens (~1-2 sentences) for 33% faster response
    const maxTokens = isMobile ? 100 : 150;
    
    const startTime = Date.now();
    console.log(`[LLM] Generating streaming response with ${selectedModel} (max_tokens: ${maxTokens}, mobile: ${isMobile})...`);

    const stream = await openai.chat.completions.create({
      model: selectedModel,
      messages: messages,
      temperature: 0.8, // More creative for natural conversation
      max_tokens: maxTokens,
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
    console.error('[LLM] ❌ Error generating response:');
    console.error('[LLM] Model:', model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini');
    console.error('[LLM] Error message:', error.message);
    console.error('[LLM] Error response:', error.response?.data || 'No response data');
    console.error('[LLM] Full error:', error);
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

