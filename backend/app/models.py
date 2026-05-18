from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class DocumentInfo(BaseModel):
    id: str
    filename: str
    status: str
    pages: int
    chunks: int

class ChunkPreview(BaseModel):
    id: str
    content: str
    metadata: Dict[str, Any]

class QueryRequest(BaseModel):
    query: str
    top_k: int = 5
    rerank: bool = True

class RetrievedContext(BaseModel):
    chunk_id: str
    content: str
    score: float
    metadata: Dict[str, Any]

class ChatRequest(BaseModel):
    query: str
    top_k: int = 5
    use_reranker: bool = True

class ChatResponse(BaseModel):
    answer: str
    context: List[RetrievedContext]
    latency_ms: float
