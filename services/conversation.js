// Conversation memory manager
export class ConversationManager {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.messages = [];
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  /**
   * Add a message to conversation history
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  addMessage(role, content) {
    this.messages.push({
      role,
      content,
      timestamp: Date.now()
    });
    this.lastActivity = Date.now();
    
    // Keep only last 20 messages to save context
    if (this.messages.length > 20) {
      this.messages = this.messages.slice(-20);
    }

    console.log(`[Conversation] ${role}: "${content}"`);
  }

  /**
   * Get conversation history for LLM
   * @returns {Array} - Array of {role, content}
   */
  getHistory() {
    return this.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.messages = [];
    console.log(`[Conversation] Cleared history`);
  }

  /**
   * Get conversation summary
   */
  getSummary() {
    return {
      sessionId: this.sessionId,
      messageCount: this.messages.length,
      duration: Date.now() - this.createdAt,
      lastActivity: this.lastActivity
    };
  }
}

// Session storage
const sessions = new Map();

/**
 * Create new conversation session
 */
export function createSession(sessionId) {
  const conversation = new ConversationManager(sessionId);
  sessions.set(sessionId, conversation);
  console.log(`[Session] Created: ${sessionId}`);
  return conversation;
}

/**
 * Get existing session
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Delete session
 */
export function deleteSession(sessionId) {
  const deleted = sessions.delete(sessionId);
  if (deleted) {
    console.log(`[Session] Deleted: ${sessionId}`);
  }
  return deleted;
}

/**
 * Clean up old sessions (>1 hour inactive)
 */
export function cleanupOldSessions() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [sessionId, conversation] of sessions.entries()) {
    if (now - conversation.lastActivity > oneHour) {
      deleteSession(sessionId);
    }
  }
}

// Cleanup every 30 minutes
setInterval(cleanupOldSessions, 30 * 60 * 1000);

