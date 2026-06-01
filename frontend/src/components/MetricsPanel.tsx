"use client";

import React, { useEffect, useState } from 'react';
import { Activity, Database, Layers, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MetricsPanel({ refreshTrigger }: { refreshTrigger: number }) {
  const [stats, setStats] = useState({
    documents: 0,
    total_chunks_processed: 0,
    vector_store: { total_vectors: 0, dimension: 384, model: "all-MiniLM-L6-v2" }
  });

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${API_URL}/api/documents/stats`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      })
      .then(data => setStats(data))
      .catch(console.error);
  }, [refreshTrigger]);

  const metrics = [
    { label: "Active Documents", value: stats.documents ?? 0, icon: FileText, color: "text-blue-400" },
    { label: "Total Vectors", value: stats.vector_store?.total_vectors ?? 0, icon: Database, color: "text-purple-400" },
    { label: "Chunks Processed", value: stats.total_chunks_processed ?? 0, icon: Layers, color: "text-green-400" },
    { label: "Embedding Dim", value: stats.vector_store?.dimension ?? 0, icon: Activity, color: "text-orange-400" }
  ];

  return (
    <div className="glass-card rounded-xl p-6 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-accent-purple" />
        System Telemetry
      </h2>
      <div className="grid grid-cols-2 gap-4 flex-1">
        {metrics.map((metric, i) => (
          <motion.div 
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-black/20 rounded-lg p-4 border border-white/5 flex flex-col justify-center"
          >
            <div className="flex items-center gap-2 mb-2">
              <metric.icon className={`w-4 h-4 ${metric.color}`} />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{metric.label}</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {metric.value.toLocaleString()}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
