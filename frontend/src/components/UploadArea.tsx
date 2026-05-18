"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UploadArea({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [filename, setFilename] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setFilename(file.name);
    setIsUploading(true);
    setUploadStatus('uploading');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/documents/upload', {
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
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <UploadCloud className="w-5 h-5 text-accent-blue" />
        Document Ingestion
      </h2>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-accent-blue bg-[rgba(59,130,246,0.1)]' : 'border-glass-border hover:border-accent-purple/50'}
        `}
      >
        <input {...getInputProps()} />
        
        {uploadStatus === 'idle' && (
          <div className="flex flex-col items-center text-gray-400">
            <UploadCloud className="w-10 h-10 mb-3 text-gray-500" />
            <p className="font-medium text-gray-300">Drag & drop enterprise documents here</p>
            <p className="text-sm mt-1">Supports PDF (max 50MB)</p>
          </div>
        )}

        {uploadStatus === 'uploading' && (
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

        {uploadStatus === 'success' && (
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
  );
}
