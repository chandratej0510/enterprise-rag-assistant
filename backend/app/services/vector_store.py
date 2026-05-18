import os
import numpy as np
import faiss
from typing import List, Dict, Any, Tuple
from sentence_transformers import SentenceTransformer

class VectorStoreService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        # Initialize an L2 distance FAISS index
        self.index = faiss.IndexFlatL2(self.dimension)
        self.chunk_metadata: List[Dict[str, Any]] = []
        self.chunk_contents: List[str] = []
        self.chunk_ids: List[str] = []

    def add_chunks(self, chunks: List[Dict[str, Any]]):
        if not chunks:
            return
            
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        
        # FAISS expects float32
        embeddings = np.array(embeddings).astype("float32")
        self.index.add(embeddings)
        
        for chunk in chunks:
            self.chunk_contents.append(chunk["content"])
            self.chunk_metadata.append(chunk["metadata"])
            self.chunk_ids.append(chunk["id"])

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if self.index.ntotal == 0:
            return []
            
        query_embedding = self.model.encode([query], convert_to_numpy=True).astype("float32")
        distances, indices = self.index.search(query_embedding, top_k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(self.chunk_contents):
                # Similarity score approximation (inverting L2 distance for simple score)
                # In L2, smaller distance = more similar
                results.append({
                    "chunk_id": self.chunk_ids[idx],
                    "content": self.chunk_contents[idx],
                    "score": float(dist), 
                    "metadata": self.chunk_metadata[idx]
                })
        return results

    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_vectors": self.index.ntotal,
            "dimension": self.dimension,
            "model": "all-MiniLM-L6-v2"
        }

vector_store_service = VectorStoreService()
