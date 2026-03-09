"use client";

import React, { useState, useRef, useEffect } from 'react';
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export default function InsightsPage() {
  const [messages, setMessages] = useState([
    { role: 'agent', content: 'Hello! I am your Cummins Data Insights Agent. Ask me a question about CNG or Electricity in the USA!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom when a new message is added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Send message to our new Next.js API route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();

      if (response.ok) {
        setMessages(prev => [...prev, { role: 'agent', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'error', content: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'error', content: "Failed to connect to the agent. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', maxWidth: '1000px', margin: '0 auto', background: 'white', borderRadius: '16px', border: '2px solid #e2e8f0', overflow: 'hidden' },
    header: { padding: '20px', background: '#0f172a', color: 'white', borderBottom: '1px solid #e2e8f0' },
    chatBox: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' },
    inputArea: { padding: '20px', background: 'white', borderTop: '2px solid #e2e8f0', display: 'flex', gap: '12px' },
    inputField: { flex: 1, padding: '14px 20px', borderRadius: '999px', border: '2px solid #cbd5e1', fontSize: '1rem', outline: 'none' },
    sendButton: { padding: '14px 28px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '999px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' },
    userBubble: { alignSelf: 'flex-end', background: '#3b82f6', color: 'white', padding: '12px 18px', borderRadius: '20px 20px 4px 20px', maxWidth: '75%', lineHeight: '1.5' },
    agentBubble: { alignSelf: 'flex-start', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', padding: '12px 18px', borderRadius: '20px 20px 20px 4px', maxWidth: '75%', lineHeight: '1.5', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    errorBubble: { alignSelf: 'flex-start', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '12px 18px', borderRadius: '20px 20px 20px 4px', maxWidth: '75%' },
    loadingBubble: { alignSelf: 'flex-start', color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic', padding: '8px' }
  };

  return (
    <DashboardLayout>
      <div style={{ padding: '24px' }}>
        <div style={styles.container}>
          
          <div style={styles.header}>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Data Insights Agent</h1>
          </div>

          <div style={styles.chatBox}>
            {messages.map((msg, index) => (
              <div key={index} style={
                msg.role === 'user' ? styles.userBubble : 
                msg.role === 'error' ? styles.errorBubble : 
                styles.agentBubble
              }>
                {msg.content}
              </div>
            ))}
            {loading && <div style={styles.loadingBubble}>Agent is thinking...</div>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={styles.inputArea}>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Ask me a question" 
              style={styles.inputField}
              disabled={loading}
            />
            <button type="submit" style={{...styles.sendButton, opacity: loading ? 0.7 : 1}} disabled={loading}>
              {loading ? 'Thinking...' : 'Send'}
            </button>
          </form>

        </div>
      </div>
    </DashboardLayout>
  );
}