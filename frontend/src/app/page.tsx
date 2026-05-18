"use client";

import React, { useState } from 'react';
import UploadArea from '@/components/UploadArea';
import MetricsPanel from '@/components/MetricsPanel';
import ChatInterface from '@/components/ChatInterface';
import ArchitectureGraph from '@/components/ArchitectureGraph';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    // Trigger metrics refresh
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-accent-blue rounded-full block"></span>
              RAG Pipeline Architecture
            </h2>
            <ArchitectureGraph />
          </section>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UploadArea onUploadComplete={handleUploadComplete} />
            <MetricsPanel refreshTrigger={refreshTrigger} />
          </div>
        </div>

        <div className="lg:col-span-1">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
