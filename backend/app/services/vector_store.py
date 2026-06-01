import os
import numpy as np
import faiss
import logging
from typing import List, Dict, Any, Tuple
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

from app.services.database import db_service

logger = logging.getLogger(__name__)

INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
INDEX_PATH = os.path.join(INDEX_DIR, "faiss.index")

class VectorStoreService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        
        # Ensure data folder exists
        os.makedirs(INDEX_DIR, exist_ok=True)
        
        # Initialize or load FAISS L2 index
        if os.path.exists(INDEX_PATH):
            try:
                self.index = faiss.read_index(INDEX_PATH)
                logger.info("Loaded FAISS index from disk. Total vectors: %d", self.index.ntotal)
            except Exception as e:
                logger.error("Error loading FAISS index: %s. Creating new flat L2 index.", e)
                self.index = faiss.IndexFlatL2(self.dimension)
        else:
            self.index = faiss.IndexFlatL2(self.dimension)
            logger.info("Initialized new FAISS flat L2 index.")

        # Initialize BM25 search structures
        self.bm25_chunks: List[Dict[str, Any]] = []
        self.bm25 = None
        
        # Load existing chunks from DB to populate BM25
        self.load_chunks_from_db()

    def load_chunks_from_db(self):
        try:
            chunks = db_service.get_all_chunks()
            if chunks:
                self.bm25_chunks = []
                for chunk in chunks:
                    self.bm25_chunks.append({
                        "id": chunk["id"],
                        "content": chunk["content"],
                        "metadata": {
                            "document_id": chunk["document_id"],
                            "page": chunk["page"],
                            "source": chunk["source"]
                        }
                    })
                # Rebuild BM25
                tokenized_corpus = [c["content"].lower().split(" ") for c in self.bm25_chunks]
                self.bm25 = BM25Okapi(tokenized_corpus)
                logger.info("Loaded %d chunks from SQLite database into BM25 index.", len(self.bm25_chunks))
        except Exception as e:
            logger.error("Error loading chunks from DB: %s", e)

    def save_index(self):
        try:
            faiss.write_index(self.index, INDEX_PATH)
            logger.info("FAISS index saved successfully to disk.")
        except Exception as e:
            logger.error("Failed to save FAISS index: %s", e)

    def add_chunks(self, chunks: List[Dict[str, Any]]):
        if not chunks:
            return
            
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        
        # FAISS expects float32
        embeddings = np.array(embeddings).astype("float32")
        faiss_start_id = self.index.ntotal
        self.index.add(embeddings)
        
        # Save index to disk
        self.save_index()
        
        # Save to SQLite
        db_service.add_chunks(chunks, faiss_start_id)
        
        # Reload BM25 to sync
        self.load_chunks_from_db()

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if self.index.ntotal == 0 or not self.bm25_chunks:
            return []
            
        # 1. Dense Semantic Search (FAISS)
        query_embedding = self.model.encode([query], convert_to_numpy=True).astype("float32")
        # Search for more than top_k to get enough candidates for fusion
        dense_search_k = min(self.index.ntotal, top_k * 3)
        distances, indices = self.index.search(query_embedding, dense_search_k)
        
        dense_ranked = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(self.bm25_chunks):
                dense_ranked.append(self.bm25_chunks[idx]["id"])
                
        # 2. Lexical Search (BM25)
        lexical_ranked = []
        if self.bm25:
            tokenized_query = query.lower().split(" ")
            bm25_scores = self.bm25.get_scores(tokenized_query)
            # Sort by score descending
            ranked_indices = np.argsort(bm25_scores)[::-1]
            # Take top_k * 3 candidates
            lexical_search_k = min(len(self.bm25_chunks), top_k * 3)
            for idx in ranked_indices[:lexical_search_k]:
                if bm25_scores[idx] > 0: # Only keep positive keyword matches
                    lexical_ranked.append(self.bm25_chunks[idx]["id"])
                    
        # 3. Reciprocal Rank Fusion (RRF)
        # Combine dense and lexical results
        k = 60 # Constant parameter for RRF
        rrf_scores = {}
        
        for rank, chunk_id in enumerate(dense_ranked):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (k + (rank + 1))
            
        for rank, chunk_id in enumerate(lexical_ranked):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (k + (rank + 1))
            
        # Sort by RRF score descending
        sorted_candidates = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        top_candidates = sorted_candidates[:top_k]
        
        # Reconstruct results list
        chunks_map = {c["id"]: c for c in self.bm25_chunks}
        results = []
        
        for chunk_id, score in top_candidates:
            chunk = chunks_map.get(chunk_id)
            if chunk:
                # Approximate distance score representation for frontend
                # Using RRF score directly as the retrieval score
                results.append({
                    "chunk_id": chunk["id"],
                    "content": chunk["content"],
                    "score": float(score),
                    "metadata": chunk["metadata"]
                })
        return results

    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_vectors": self.index.ntotal,
            "dimension": self.dimension,
            "model": "all-MiniLM-L6-v2",
            "lexical_index_size": len(self.bm25_chunks)
        }

vector_store_service = VectorStoreService()
