import os
import numpy as np
import faiss
import logging
from typing import List, Dict, Any, Tuple
from rank_bm25 import BM25Okapi
from openai import OpenAI

from app.services.database import db_service

logger = logging.getLogger(__name__)

# Dynamic lazy import check for sentence-transformers to support local model execution
try:
    from sentence_transformers import SentenceTransformer
    HAS_LOCAL_EMBEDDINGS = True
except ImportError:
    HAS_LOCAL_EMBEDDINGS = False

INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
INDEX_PATH = os.path.join(INDEX_DIR, "faiss.index")

class VectorStoreService:
    def __init__(self):
        # Configure embedding provider. Supported options: "local", "openai"
        self.provider = os.getenv("RAG_EMBEDDING_PROVIDER", "openai").lower()
        
        if self.provider == "local" and not HAS_LOCAL_EMBEDDINGS:
            logger.warning("RAG_EMBEDDING_PROVIDER is set to 'local', but sentence-transformers is not installed. Falling back to 'openai'.")
            self.provider = "openai"
            
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "dummy_key"))
        self.model_name = os.getenv("RAG_EMBEDDING_MODEL", "text-embedding-3-small" if self.provider == "openai" else "all-MiniLM-L6-v2")
        
        # Load local model or set target dimensions
        self.local_model = None
        if self.provider == "local":
            try:
                logger.info("Initializing local SentenceTransformer model ('%s')...", self.model_name)
                self.local_model = SentenceTransformer(self.model_name)
                self.dimension = self.local_model.get_sentence_embedding_dimension()
            except Exception as e:
                logger.error("Failed to load local SentenceTransformer: %s. Falling back to OpenAI.", e)
                self.provider = "openai"
                self.model_name = "text-embedding-3-small"
                self.dimension = 1536
        else:
            self.dimension = 1536  # Dimension for text-embedding-3-small
            
        # Ensure data folder exists
        os.makedirs(INDEX_DIR, exist_ok=True)
        
        # Initialize or load FAISS index
        if os.path.exists(INDEX_PATH):
            try:
                self.index = faiss.read_index(INDEX_PATH)
                logger.info("Loaded FAISS index from disk. Total vectors: %d", self.index.ntotal)
                
                # Sync runtime provider/dimension with the loaded index's dimension
                if self.index.d != self.dimension:
                    logger.warning("Loaded index dimension (%d) does not match configured dimension (%d). Reconfiguring provider...", self.index.d, self.dimension)
                    self.dimension = self.index.d
                    if self.dimension == 384:
                        self.provider = "local"
                        self.model_name = "all-MiniLM-L6-v2"
                        if HAS_LOCAL_EMBEDDINGS and not self.local_model:
                            self.local_model = SentenceTransformer(self.model_name)
                    else:
                        self.provider = "openai"
                        self.model_name = "text-embedding-3-small"
            except Exception as e:
                logger.error("Error loading FAISS index: %s. Creating new flat L2 index.", e)
                self.index = faiss.IndexFlatL2(self.dimension)
        else:
            self.index = faiss.IndexFlatL2(self.dimension)
            logger.info("Initialized new FAISS flat L2 index of dimension %d.", self.dimension)

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
                # Rebuild BM25 index
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

    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        if self.provider == "local" and self.local_model:
            try:
                embeddings = self.local_model.encode(texts, convert_to_numpy=True)
                return np.array(embeddings).astype("float32")
            except Exception as e:
                logger.error("Local embedding generation failed: %s. Falling back to zero vectors.", e)
                return np.zeros((len(texts), self.dimension), dtype=np.float32)
        else:
            # Cloud API embedding
            try:
                response = self.openai_client.embeddings.create(
                    input=texts,
                    model=self.model_name
                )
                embeddings = [data.embedding for data in response.data]
                return np.array(embeddings).astype("float32")
            except Exception as e:
                logger.error("OpenAI embedding generation failed: %s. Using fallback zero vectors.", e)
                return np.zeros((len(texts), self.dimension), dtype=np.float32)

    def add_chunks(self, chunks: List[Dict[str, Any]]):
        if not chunks:
            return
            
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.get_embeddings(texts)
        
        faiss_start_id = self.index.ntotal
        self.index.add(embeddings)
        self.save_index()
        db_service.add_chunks(chunks, faiss_start_id)
        self.load_chunks_from_db()

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if self.index.ntotal == 0 or not self.bm25_chunks:
            return []
            
        # 1. Dense Semantic Search (FAISS)
        query_embedding = self.get_embeddings([query])
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
            ranked_indices = np.argsort(bm25_scores)[::-1]
            lexical_search_k = min(len(self.bm25_chunks), top_k * 3)
            for idx in ranked_indices[:lexical_search_k]:
                if bm25_scores[idx] > 0:
                    lexical_ranked.append(self.bm25_chunks[idx]["id"])
                    
        # 3. Reciprocal Rank Fusion (RRF)
        k = 60
        rrf_scores = {}
        
        for rank, chunk_id in enumerate(dense_ranked):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (k + (rank + 1))
            
        for rank, chunk_id in enumerate(lexical_ranked):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (k + (rank + 1))
            
        sorted_candidates = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        top_candidates = sorted_candidates[:top_k]
        
        chunks_map = {c["id"]: c for c in self.bm25_chunks}
        results = []
        
        for chunk_id, score in top_candidates:
            chunk = chunks_map.get(chunk_id)
            if chunk:
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
            "provider": self.provider,
            "model": self.model_name,
            "lexical_index_size": len(self.bm25_chunks)
        }

vector_store_service = VectorStoreService()
