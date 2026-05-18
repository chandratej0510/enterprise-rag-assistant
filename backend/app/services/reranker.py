from typing import List, Dict, Any
from sentence_transformers import CrossEncoder

class RerankerService:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name, max_length=512)

    def rerank(self, query: str, retrieved_docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not retrieved_docs:
            return []
            
        pairs = [[query, doc["content"]] for doc in retrieved_docs]
        scores = self.model.predict(pairs)
        
        # Update scores and sort
        for i, doc in enumerate(retrieved_docs):
            doc["rerank_score"] = float(scores[i])
            # We swap the score to be the rerank score so the frontend can display it easily
            # High score in cross-encoder = more relevant
            doc["score"] = doc["rerank_score"] 
            
        # Sort by rerank score descending
        reranked_docs = sorted(retrieved_docs, key=lambda x: x["rerank_score"], reverse=True)
        return reranked_docs

reranker_service = RerankerService()
