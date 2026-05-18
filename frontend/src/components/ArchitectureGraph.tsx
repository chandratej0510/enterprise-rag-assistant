"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Database, FileText, Search, Cpu, MessageSquare } from 'lucide-react';

export default function ArchitectureGraph() {
  const nodes = [
    { id: 'ingest', label: 'PDF Ingestion', icon: FileText, x: 0, y: 50 },
    { id: 'embed', label: 'Embedding (MiniLM)', icon: Cpu, x: 25, y: 50 },
    { id: 'store', label: 'FAISS Vector DB', icon: Database, x: 50, y: 20 },
    { id: 'retrieve', label: 'Semantic Search', icon: Search, x: 50, y: 80 },
    { id: 'rerank', label: 'Cross-Encoder', icon: Cpu, x: 75, y: 50 },
    { id: 'generate', label: 'LLM Response', icon: MessageSquare, x: 100, y: 50 },
  ];

  return (
    <div className="glass-card rounded-xl p-6 overflow-hidden relative min-h-[250px] flex items-center justify-center">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }} />
      
      <div className="w-full max-w-3xl relative h-[150px]">
        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
          <motion.path 
            d="M 0 75 L 25% 75" 
            stroke="rgba(59,130,246,0.5)" strokeWidth="2" fill="none"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.path 
            d="M 25% 75 L 50% 30" 
            stroke="rgba(59,130,246,0.5)" strokeWidth="2" fill="none"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.5, repeat: Infinity }}
          />
          <motion.path 
            d="M 50% 30 L 50% 120" 
            stroke="rgba(139,92,246,0.5)" strokeWidth="2" strokeDasharray="4 4" fill="none"
          />
          <motion.path 
            d="M 50% 120 L 75% 75" 
            stroke="rgba(139,92,246,0.5)" strokeWidth="2" fill="none"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 1, repeat: Infinity }}
          />
           <motion.path 
            d="M 75% 75 L 100% 75" 
            stroke="rgba(16,185,129,0.5)" strokeWidth="2" fill="none"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 1.5, repeat: Infinity }}
          />
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <motion.div
            key={node.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -ml-12 -mt-10 w-24 flex flex-col items-center justify-center z-10"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md mb-2">
              <node.icon className="w-6 h-6 text-gray-300" />
            </div>
            <span className="text-[10px] text-center font-mono text-gray-400 whitespace-nowrap bg-black/40 px-2 py-1 rounded border border-white/5">{node.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
