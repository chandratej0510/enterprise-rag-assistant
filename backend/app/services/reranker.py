import os
import json
import logging
from typing import List, Dict, Any
from openai import OpenAI

logger = logging.getLogger(__name__)

# Dynamic lazy import check for sentence-transformers to support local model execution
try:
    from sentence_transformers import CrossEncoder
    HAS_LOCAL_RERANKER = True
except ImportError:
    HAS_LOCAL_RERANKER = False

class RerankerService:
    def __init__(self):
        # Configure reranking provider. Supported options: "local", "openai"
        self.provider = os.getenv("RAG_RERANKER_PROVIDER", "openai").lower()
        
        if self.provider == "local" and not HAS_LOCAL_RERANKER:
            logger.warning("RAG_RERANKER_PROVIDER is set to 'local', but sentence-transformers is not installed. Falling back to 'openai'.")
            self.provider = "openai"
            
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "dummy_key"))
        self.model_name = os.getenv("RAG_RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2" if self.provider == "local" else "gpt-4o-mini")
        
        # Load local cross-encoder model if using local provider
        self.local_model = None
        if self.provider == "local":
            try:
                logger.info("Initializing local CrossEncoder model ('%s')...", self.model_name)
                self.local_model = CrossEncoder(self.model_name, max_length=512)
            except Exception as e:
                logger.error("Failed to load local CrossEncoder: %s. Falling back to OpenAI.", e)
                self.provider = "openai"
                self.model_name = "gpt-4o-mini"

    def rerank(self, query: str, retrieved_docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not retrieved_docs:
            return []
            
        if self.provider == "local" and self.local_model:
            try:
                pairs = [[query, doc["content"]] for doc in retrieved_docs]
                scores = self.local_model.predict(pairs)
                for i, doc in enumerate(retrieved_docs):
                    doc["rerank_score"] = float(scores[i])
                    doc["score"] = doc["rerank_score"]
                return sorted(retrieved_docs, key=lambda x: x["rerank_score"], reverse=True)
            except Exception as e:
                logger.error("Local CrossEncoder reranking failed: %s. Falling back to keyword overlap.", e)
                return self.fallback_rerank(query, retrieved_docs)
        else:
            # Cloud LLM-based reranker using gpt-4o-mini
            try:
                chunks_data = [{"index": idx, "content": doc["content"][:300]} for idx, doc in enumerate(retrieved_docs)]
                prompt = f"""
                You are a legal document reranking assistant.
                Given the user's query: "{query}"

                Rank the following legal document chunks from most relevant to least relevant. Return a JSON list of dictionaries containing:
                - "index": the 0-based index of the chunk in the provided list
                - "score": a relevance score between 0.0 (not relevant) and 1.0 (extremely relevant)

                Chunks to rank:
                {json.dumps(chunks_data)}

                Return ONLY the JSON response, matching this schema:
                [
                  {{"index": 0, "score": 0.95}},
                  ...
                ]
                """
                response = self.openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": "You are a professional legal clerk helper. Output only valid JSON lists."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    response_format={"type": "json_object"}
                )
                content = response.choices[0].message.content.strip()
                data = json.loads(content)
                
                ranks = []
                if isinstance(data, dict):
                    for val in data.values():
                        if isinstance(val, list):
                            ranks = val
                            break
                else:
                    ranks = data
                    
                score_map = {}
                for item in ranks:
                    if isinstance(item, dict) and "index" in item and "score" in item:
                        score_map[int(item["index"])] = float(item["score"])
                        
                for idx, doc in enumerate(retrieved_docs):
                    new_score = score_map.get(idx, 0.0)
                    doc["rerank_score"] = new_score
                    doc["score"] = new_score
                    
                return sorted(retrieved_docs, key=lambda x: x["rerank_score"], reverse=True)
            except Exception as e:
                logger.error("OpenAI LLM reranking failed: %s. Falling back to keyword overlap.", e)
                return self.fallback_rerank(query, retrieved_docs)

    def fallback_rerank(self, query: str, retrieved_docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        query_tokens = set(query.lower().split())
        for doc in retrieved_docs:
            doc_tokens = set(doc["content"].lower().split())
            overlap = len(query_tokens.intersection(doc_tokens))
            doc["rerank_score"] = float(overlap) / (len(query_tokens) + 1)
            doc["score"] = doc["rerank_score"]
        return sorted(retrieved_docs, key=lambda x: x["rerank_score"], reverse=True)

reranker_service = RerankerService()
