"use client";

import React, { useState } from 'react';
import { ArrowLeftRight, FileText, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

type Document = {
  id: string;
  filename: string;
};

type ComparisonItem = {
  parameter: string;
  doc_1_val: string;
  doc_2_val: string;
  analysis: string;
};

type ComparisonData = {
  doc_1_name: string;
  doc_2_name: string;
  parameters: ComparisonItem[];
  summary: string;
};

type DocumentComparisonProps = {
  documents: Document[];
};

export default function DocumentComparison({ documents }: DocumentComparisonProps) {
  const [doc1Id, setDoc1Id] = useState<string>('');
  const [doc2Id, setDoc2Id] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);

  const handleCompare = async () => {
    if (!doc1Id || !doc2Id) return;
    if (doc1Id === doc2Id) {
      setError("Please select two different documents to compare.");
      return;
    }

    setLoading(true);
    setError(null);
    setComparison(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/documents/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id_1: doc1Id,
          doc_id_2: doc2Id
        })
      });

      if (!res.ok) throw new Error("Comparison failed. Check api key settings.");
      const data = await res.json();
      setComparison(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to complete comparison");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 flex flex-col min-h-[500px] space-y-6">
      {/* Pickers */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold font-mono text-gray-400 mb-2 uppercase tracking-wider">Document A</label>
          <select
            value={doc1Id}
            onChange={(e) => setDoc1Id(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-accent-purple"
          >
            <option value="">-- Choose Contract A --</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.filename}</option>
            ))}
          </select>
        </div>

        <div className="p-2 bg-white/5 border border-white/10 rounded-full shrink-0 mt-4 md:mt-0">
          <ArrowLeftRight className="w-4 h-4 text-gray-400" />
        </div>

        <div className="flex-1 w-full">
          <label className="block text-xs font-bold font-mono text-gray-400 mb-2 uppercase tracking-wider">Document B</label>
          <select
            value={doc2Id}
            onChange={(e) => setDoc2Id(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-accent-purple"
          >
            <option value="">-- Choose Contract B --</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.filename}</option>
            ))}
          </select>
        </div>

        <button
          disabled={loading || !doc1Id || !doc2Id}
          onClick={handleCompare}
          className="w-full md:w-auto self-end px-6 py-2.5 bg-accent-purple text-white text-sm font-semibold rounded-lg hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-mono tracking-wider uppercase cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-1.5 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Comparing
            </span>
          ) : (
            "Compare"
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12">
          <Loader2 className="w-10 h-10 animate-spin text-accent-purple mb-4" />
          <h3 className="font-semibold text-gray-300">Comparing Contracts...</h3>
          <p className="text-sm mt-1 text-gray-500 max-w-sm text-center">
            Retrieving relevant legal clauses from both documents and performing variance analysis...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !comparison && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-12 border border-dashed border-white/5 rounded-xl bg-black/10">
          <ArrowLeftRight className="w-12 h-12 mb-4 text-gray-600 animate-pulse" />
          <h3 className="text-base font-semibold text-gray-400">Clause Matrix Engine</h3>
          <p className="text-xs text-gray-500 max-w-xs text-center mt-1">
            Select two different PDF documents above and click Compare to evaluate differences in liability limits, notices, and governing laws.
          </p>
        </div>
      )}

      {/* Comparison Results */}
      {!loading && comparison && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6 flex-1"
        >
          {/* Executive Summary */}
          <div className="p-4 bg-accent-purple/5 border border-accent-purple/20 rounded-xl">
            <h3 className="text-xs font-bold font-mono text-accent-purple mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Executive Variance Summary
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed font-sans">{comparison.summary}</p>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/20 custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/40 text-xs font-bold font-mono text-gray-400 uppercase tracking-wider">
                  <th className="p-4 w-[180px]">Legal Parameter</th>
                  <th className="p-4 max-w-[250px] truncate">Document A: {comparison.doc_1_name}</th>
                  <th className="p-4 max-w-[250px] truncate">Document B: {comparison.doc_2_name}</th>
                  <th className="p-4">Variance Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparison.parameters.map((item, i) => (
                  <tr key={i} className="hover:bg-white/[0.01] align-top transition-colors">
                    <td className="p-4 font-mono text-xs font-bold text-accent-purple">{item.parameter}</td>
                    <td className="p-4 text-xs text-gray-300 font-serif leading-relaxed max-w-[250px] break-words">{item.doc_1_val}</td>
                    <td className="p-4 text-xs text-gray-300 font-serif leading-relaxed max-w-[250px] break-words">{item.doc_2_val}</td>
                    <td className="p-4 text-xs text-orange-400 font-sans leading-relaxed">{item.analysis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
