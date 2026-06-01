"use client";

import React, { useState, useEffect } from 'react';
import { X, Cloud, ArrowLeftRight, Check, Loader2, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ExternalFile = {
  id: string;
  filename: string;
  source: string;
  size: string;
  pages: number;
};

type ConnectorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
};

export default function ConnectorModal({ isOpen, onClose, onImportComplete }: ConnectorModalProps) {
  const [activeTab, setActiveTab] = useState<'drive' | 'sharepoint'>('drive');
  const [files, setFiles] = useState<ExternalFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchExternalFiles = async () => {
      setLoadingFiles(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_URL}/api/documents/external-files`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data || []);
        }
      } catch (err) {
        console.error("Error fetching external files:", err);
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchExternalFiles();
  }, [isOpen]);

  const handleImport = async (fileId: string) => {
    setImportingId(fileId);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/documents/import-external`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
      });

      if (!res.ok) throw new Error('Import failed');

      setImportedIds(prev => [...prev, fileId]);
      onImportComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setImportingId(null);
    }
  };

  const filteredFiles = files.filter(f => 
    activeTab === 'drive' ? f.source === 'Google Drive' : f.source === 'SharePoint'
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-accent-blue" />
                <h3 className="font-semibold text-white">Import Cloud Documents</h3>
              </div>
              <button 
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider selector tabs */}
            <div className="flex border-b border-white/5 bg-zinc-900/50 p-2 gap-2">
              <button
                onClick={() => setActiveTab('drive')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'drive'
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Cloud className="w-4 h-4 text-green-400" />
                Google Drive
              </button>
              <button
                onClick={() => setActiveTab('sharepoint')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'sharepoint'
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Cloud className="w-4 h-4 text-blue-400" />
                SharePoint
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {loadingFiles ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-2" />
                  <p className="text-sm">Connecting to secure file directory...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-gray-500">
                  <p>No documents found in this directory.</p>
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const isImporting = importingId === file.id;
                  const isImported = importedIds.includes(file.id);

                  return (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between p-4 bg-zinc-900/60 border border-white/5 rounded-xl hover:border-white/10 hover:bg-zinc-900 transition-all"
                    >
                      <div className="overflow-hidden mr-3">
                        <p className="text-sm font-medium text-white truncate">{file.filename}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{file.size} • {file.pages} page(s)</p>
                      </div>
                      
                      <button
                        disabled={isImporting || isImported}
                        onClick={() => handleImport(file.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                          isImported
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-accent-blue text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting
                          </>
                        ) : isImported ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Ingested
                          </>
                        ) : (
                          <>
                            <Database className="w-3.5 h-3.5" /> Sync
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
