import time
from fastapi import APIRouter, HTTPException
from app.models import ChatRequest, ChatResponse, RetrievedContext
from app.services.vector_store import vector_store_service
from app.services.reranker import reranker_service
from app.services.generation import generation_service

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    start_time = time.time()
    
    # 1. Retrieve initial chunks
    retrieved_docs = vector_store_service.search(request.query, top_k=request.top_k * 2) # Get more for reranking
    
    # 2. Rerank
    if request.use_reranker and retrieved_docs:
        retrieved_docs = reranker_service.rerank(request.query, retrieved_docs)
        
    # Take top_k after reranking
    final_docs = retrieved_docs[:request.top_k]
    
    # 3. Generate Answer
    answer = await generation_service.generate_response(request.query, final_docs)
    
    end_time = time.time()
    latency_ms = (end_time - start_time) * 1000
    
    context = [
        RetrievedContext(
            chunk_id=doc["chunk_id"],
            content=doc["content"],
            score=doc["score"],
            metadata=doc["metadata"]
        ) for doc in final_docs
    ]
    
    return ChatResponse(
        answer=answer,
        context=context,
        latency_ms=latency_ms
    )
