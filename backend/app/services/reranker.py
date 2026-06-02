import os
import json
import logging
from typing import List, Dict, Any
from openai import OpenAI

logger = logging.getLogger(__name__)

class RerankerService:
    def __init__(self):
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "dummy_key"))

    def rerank(self, query: str, retrieved_docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not retrieved_docs:
            return []
            
        try:
            # Prepare prompt for LLM-based reranking
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
                model="gpt-4o-mini",
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
                
            # Create a lookup map for scores
            score_map = {}
            for item in ranks:
                if isinstance(item, dict) and "index" in item and "score" in item:
                    score_map[int(item["index"])] = float(item["score"])
            
            # Update scores and sort
            for idx, doc in enumerate(retrieved_docs):
                new_score = score_map.get(idx, 0.0)
                doc["rerank_score"] = new_score
                doc["score"] = new_score
                
            return sorted(retrieved_docs, key=lambda x: x["rerank_score"], reverse=True)
            
        except Exception as e:
            logger.error("Error in LLM reranking: %s. Falling back to keyword overlap.", e)
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
