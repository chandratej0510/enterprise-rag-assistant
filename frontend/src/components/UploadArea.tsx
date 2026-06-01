"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, CheckCircle, Loader2, Cloud, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import ConnectorModal from './ConnectorModal';

type UploadAreaProps = {
  onUploadComplete: () => void;
  documents: any[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string, filename: string) => void;
  userRole: 'admin' | 'analyst' | 'viewer';
};

export default function UploadArea({ onUploadComplete, documents, activeDocumentId, onSelectDocument, userRole }: UploadAreaProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [filename, setFilename] = useState<string | null>(null);
  const [isConnectorOpen, setIsConnectorOpen] = useState(false);

  const isViewer = userRole === 'viewer';

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || isViewer) return;
    
    const file = acceptedFiles[0];
    setFilename(file.name);
    setIsUploading(true);
    setUploadStatus('uploading');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      setUploadStatus('success');
      onUploadComplete();
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        if (uploadStatus === 'success') {
          setUploadStatus('idle');
          setFilename(null);
        }
      }, 3000);
    }
  }, [onUploadComplete, isViewer]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: isViewer
  });

  return (
    <div className="glass-card rounded-xl p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-accent-blue" />
            Document Ingestion
          </h2>
          <button
            disabled={isViewer}
            onClick={() => setIsConnectorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border border-white/10 hover:border-accent-blue/30 text-xs font-semibold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-accent-blue" />
            Import Cloud Docs
          </button>
        </div>

        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
            ${isViewer ? 'border-zinc-800 bg-black/10 cursor-not-allowed opacity-50' : 'cursor-pointer'}
            ${isDragActive && !isViewer ? 'border-accent-blue bg-[rgba(59,130,246,0.1)]' : 'border-glass-border hover:border-accent-purple/50'}
          `}
        >
          <input {...getInputProps()} />
          
          {isViewer && (
            <div className="flex flex-col items-center text-gray-500">
              <Lock className="w-10 h-10 mb-3 text-gray-600 animate-pulse" />
              <p className="font-medium text-gray-400">Ingestion Locked</p>
              <p className="text-xs mt-1">Intern role does not have upload permissions.</p>
            </div>
          )}

          {!isViewer && uploadStatus === 'idle' && (
            <div className="flex flex-col items-center text-gray-400">
              <UploadCloud className="w-10 h-10 mb-3 text-gray-500" />
              <p className="font-medium text-gray-300">Drag & drop enterprise documents here</p>
              <p className="text-sm mt-1">Supports PDF (max 50MB)</p>
            </div>
          )}

          {!isViewer && uploadStatus === 'uploading' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col items-center"
            >
              <Loader2 className="w-10 h-10 mb-3 text-accent-blue animate-spin" />
              <p className="font-medium text-accent-blue">Ingesting & Vectorizing...</p>
              <p className="text-sm mt-1 text-gray-400">{filename}</p>
            </motion.div>
          )}

          {!isViewer && uploadStatus === 'success' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="flex flex-col items-center text-green-400"
            >
              <CheckCircle className="w-10 h-10 mb-3" />
              <p className="font-medium">Ingestion Complete</p>
              <p className="text-sm mt-1 opacity-80">{filename} successfully indexed.</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Ingested Documents List */}
      {documents.length > 0 && (
        <div className="mt-6 border-t border-glass-border pt-4">
          <h3 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <File className="w-4 h-4 text-accent-purple" />
            Ingested Legal Documents ({documents.length})
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
            {documents.map((doc) => {
              const isActive = activeDocumentId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id, doc.filename)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-sm cursor-pointer transition-all ${
                    isActive
                      ? 'bg-accent-purple/10 border-accent-purple/50 text-white shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                      : 'bg-black/20 border-white/5 text-gray-300 hover:border-white/10 hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <File className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent-purple' : 'text-gray-500'}`} />
                    <span className="truncate font-medium">{doc.filename}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-gray-500 font-mono">
                      {doc.pages} p. / {doc.chunks} ch.
                    </span>
                    <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-mono font-bold scale-90">
                      Ready
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connector Modal */}
      <ConnectorModal 
        isOpen={isConnectorOpen} 
        onClose={() => setIsConnectorOpen(false)} 
        onImportComplete={onUploadComplete} 
      />
    </div>
  );
}
