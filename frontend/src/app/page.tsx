"use client";

import React, { useState, useEffect } from 'react';
import UploadArea from '@/components/UploadArea';
import MetricsPanel from '@/components/MetricsPanel';
import ChatInterface from '@/components/ChatInterface';
import ArchitectureGraph from '@/components/ArchitectureGraph';
import DocumentReader from '@/components/DocumentReader';
import DocumentComparison from '@/components/DocumentComparison';
import { Network, BookOpen, ArrowLeftRight, Shield } from 'lucide-react';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Shared Viewer States
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'reader' | 'compare'>('graph');
  
  // RBAC State
  const [userRole, setUserRole] = useState<'admin' | 'analyst' | 'viewer'>('admin');

  const fetchDocuments = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/documents/`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data || []);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [refreshTrigger]);

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectDocument = (id: string, filename: string) => {
    setActiveDocumentId(id);
    setActiveFilename(filename);
    setHighlightedText(null); // Clear previous citation highlights when viewing new document
    setActiveTab('reader');
  };

  const handleCitationClick = (filename: string, text: string) => {
    const doc = documents.find(d => d.filename === filename);
    if (doc) {
      setActiveDocumentId(doc.id);
      setActiveFilename(doc.filename);
      setHighlightedText(text);
      setActiveTab('reader');
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Top Header Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Enterprise Legal RAG Suite</h1>
          <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mt-1">SaaS Compliance Platform Demo</p>
        </div>
        
        <div className="flex items-center gap-3 bg-black/20 p-2 border border-white/5 rounded-xl self-start sm:self-center">
          <span className="text-xs font-mono font-bold text-gray-500 uppercase ml-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent-blue" /> Access Level:
          </span>
          <select
            value={userRole}
            onChange={(e: any) => setUserRole(e.target.value)}
            className="bg-zinc-950 border border-white/10 text-xs font-mono font-bold text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-accent-blue cursor-pointer"
          >
            <option value="admin">⚖️ Legal Counsel (Admin)</option>
            <option value="analyst">🔍 Contract Analyst (Editor)</option>
            <option value="viewer">💼 Intern (Viewer Only)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Area (Graph or Document Reader, Ingestion & Metrics) */}
        <div className="lg:col-span-2 space-y-6">
          <section className="flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-glass-border mb-4 overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setActiveTab('graph')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'graph'
                    ? 'border-accent-blue text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Network className="w-4 h-4" />
                Pipeline Architecture
              </button>
              <button
                onClick={() => setActiveTab('reader')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'reader'
                    ? 'border-accent-purple text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Legal Document Reader
                {activeFilename && <span className="text-xs bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded ml-1 truncate max-w-[120px]">{activeFilename}</span>}
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'compare'
                    ? 'border-orange-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                Clause Comparison Matrix
              </button>
            </div>

            {/* Tab Panels */}
            <div>
              {activeTab === 'graph' && <ArchitectureGraph />}
              {activeTab === 'reader' && (
                <DocumentReader
                  documentId={activeDocumentId}
                  filename={activeFilename}
                  highlightedText={highlightedText}
                  onClose={() => {
                    setActiveTab('graph');
                    setActiveDocumentId(null);
                    setActiveFilename(null);
                    setHighlightedText(null);
                  }}
                />
              )}
              {activeTab === 'compare' && (
                <DocumentComparison documents={documents} />
              )}
            </div>
          </section>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UploadArea 
              onUploadComplete={handleUploadComplete} 
              documents={documents}
              activeDocumentId={activeDocumentId}
              onSelectDocument={handleSelectDocument}
              userRole={userRole}
            />
            <MetricsPanel refreshTrigger={refreshTrigger} />
          </div>
        </div>

        {/* Right Area (Chat Interface) */}
        <div className="lg:col-span-1">
          <ChatInterface onCitationClick={handleCitationClick} />
        </div>
      </div>
    </div>
  );
}
