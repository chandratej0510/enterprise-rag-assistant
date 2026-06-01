"use client";

import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FileText, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

type Chunk = {
  id: string;
  document_id: string;
  content: string;
  page: number;
  source: string;
};

type DocumentReaderProps = {
  documentId: string | null;
  filename: string | null;
  highlightedText: string | null;
  onClose: () => void;
};

export default function DocumentReader({ documentId, filename, highlightedText, onClose }: DocumentReaderProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const chunkRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (!documentId) return;

    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_URL}/api/documents/${documentId}`);
        if (!res.ok) throw new Error('Failed to load document text');
        const data = await res.json();
        setChunks(data.chunks || []);
        
        // Find if there is a highlighted text, and set current page to that page
        if (highlightedText && data.chunks) {
          const matchedChunk = data.chunks.find((c: Chunk) => 
            c.content.includes(highlightedText) || highlightedText.includes(c.content)
          );
          if (matchedChunk) {
            setCurrentPage(matchedChunk.page);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error loading document');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  // Scroll to highlighted chunk when chunks load or highlightedText changes
  useEffect(() => {
    if (!highlightedText || chunks.length === 0) return;

    const matchedChunk = chunks.find((c: Chunk) => 
      c.content.includes(highlightedText) || highlightedText.includes(c.content)
    );

    if (matchedChunk) {
      setCurrentPage(matchedChunk.page);
      
      // Delay slightly to allow rendering
      setTimeout(() => {
        const element = chunkRefs.current[matchedChunk.id];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightedText, chunks]);

  if (!documentId) {
    return (
      <div className="glass-card rounded-xl p-8 flex flex-col items-center justify-center text-center h-[500px]">
        <BookOpen className="w-12 h-12 text-gray-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-300">No Document Selected</h3>
        <p className="text-sm text-gray-500 max-w-sm mt-1">
          Select a document from the Ingestion panel or click a chat citation to open it here.
        </p>
      </div>
    );
  }

  // Group chunks by page for pagination
  const pages: { [key: number]: Chunk[] } = {};
  chunks.forEach(chunk => {
    if (!pages[chunk.page]) pages[chunk.page] = [];
    pages[chunk.page].push(chunk);
  });

  const pageNumbers = Object.keys(pages).map(Number).sort((a, b) => a - b);
  const activePageChunks = pages[currentPage] || [];

  return (
    <div className="glass-card rounded-xl border border-glass-border flex flex-col h-[500px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-glass-border bg-black/20 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden mr-4">
          <FileText className="w-5 h-5 text-accent-blue shrink-0" />
          <h2 className="font-semibold truncate text-sm md:text-base">{filename || "Document Viewer"}</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-black/40 custom-scrollbar flex justify-center">
        {isLoading && (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mb-4"></div>
            <p>Loading document content...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center text-red-400 max-w-md text-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="font-medium">Error loading document</p>
            <p className="text-sm opacity-80 mt-1">{error}</p>
          </div>
        )}

        {!isLoading && !error && chunks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-gray-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>No content found in this document.</p>
          </div>
        )}

        {!isLoading && !error && chunks.length > 0 && (
          <div className="w-full max-w-2xl bg-zinc-950 border border-white/5 shadow-2xl rounded-lg p-6 md:p-8 flex flex-col space-y-4 min-h-[400px]">
            <div className="flex justify-between items-center text-xs text-zinc-500 border-b border-white/5 pb-2 mb-2 font-mono">
              <span>DOCUMENT SOURCE: {filename}</span>
              <span>PAGE: {currentPage + 1} OF {pageNumbers.length}</span>
            </div>

            <div className="space-y-4 text-zinc-300 leading-relaxed text-sm md:text-base font-serif">
              {activePageChunks.map((chunk) => {
                const isHighlighted = highlightedText && 
                  (chunk.content.includes(highlightedText) || highlightedText.includes(chunk.content));

                return (
                  <div
                    key={chunk.id}
                    ref={el => { chunkRefs.current[chunk.id] = el; }}
                    className={`p-2 rounded-md transition-all duration-300 ${
                      isHighlighted 
                        ? 'bg-accent-purple/10 border-l-2 border-accent-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.15)] font-medium' 
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {chunk.content}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      {pageNumbers.length > 1 && (
        <div className="p-3 border-t border-glass-border bg-black/20 flex items-center justify-between text-xs text-gray-400">
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          
          <span className="font-mono">
            Page {currentPage + 1} / {pageNumbers.length}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(pageNumbers.length - 1, prev + 1))}
            disabled={currentPage === pageNumbers.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
