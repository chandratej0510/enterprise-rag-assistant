"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context?: any[];
  latency?: number;
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedContext, setExpandedContext] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.content, top_k: 3, use_reranker: true }),
      });
      
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.answer,
        context: data.context,
        latency: data.latency_ms
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'System error: Could not complete retrieval pipeline.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl border border-glass-border flex flex-col h-[600px] overflow-hidden">
      <div className="p-4 border-b border-glass-border bg-black/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-accent-blue" />
          <h2 className="font-semibold">Semantic Retrieval Engine</h2>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-full border border-accent-blue/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> FAISS Indexed
          </span>
          <span className="text-xs bg-accent-purple/10 text-accent-purple px-2 py-1 rounded-full border border-accent-purple/20 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Cross-Encoder Ready
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center border border-white/5">
              <Bot className="w-8 h-8 text-white/50" />
            </div>
            <p>System initialized. Ready for semantic queries.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-accent-blue" />
              </div>
            )}
            
            <div className={`max-w-[80%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-accent-blue text-white rounded-tr-sm' 
                  : 'bg-black/40 border border-white/10 text-gray-200 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>

              {/* Retrieval Transparency Panel */}
              {msg.context && msg.context.length > 0 && (
                <div className="w-full mt-2">
                  <button 
                    onClick={() => setExpandedContext(expandedContext === msg.id ? null : msg.id)}
                    className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {expandedContext === msg.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    View Retrieval Pipeline ({msg.context.length} chunks)
                    {msg.latency && <span className="ml-auto opacity-50">{msg.latency.toFixed(0)}ms</span>}
                  </button>
                  
                  <AnimatePresence>
                    {expandedContext === msg.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-3 space-y-2"
                      >
                        {msg.context.map((ctx: any, i: number) => (
                          <div key={i} className="bg-black/30 border border-white/5 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-accent-purple font-mono">
                                [Citation {i+1}] {ctx.metadata?.source} (p.{ctx.metadata?.page})
                              </span>
                              <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-mono">
                                Score: {ctx.score.toFixed(3)}
                              </span>
                            </div>
                            <p className="text-gray-400 line-clamp-3 hover:line-clamp-none transition-all">{ctx.content}</p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 justify-start">
             <div className="w-8 h-8 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-gray-400 flex items-center gap-2">
              <span className="animate-pulse">Running semantic search...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/20 border-t border-glass-border">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Query the knowledge base..."
            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/50 transition-colors"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-accent-blue text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Loader2 here just in case
import { Loader2 } from 'lucide-react';
