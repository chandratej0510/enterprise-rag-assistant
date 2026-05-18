import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

from app.models import DocumentInfo
from app.services.ingestion import ingestion_service
from app.services.vector_store import vector_store_service

router = APIRouter(prefix="/api/documents", tags=["documents"])

# In-memory document store for demo purposes
documents_db = []

@router.post("/upload", response_model=DocumentInfo)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    file_path = os.path.join(ingestion_service.upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Process PDF and chunk
        result = ingestion_service.process_pdf(file_path, file.filename)
        
        # Add to vector store
        vector_store_service.add_chunks(result["chunks"])
        
        doc_info = DocumentInfo(
            id=result["document_id"],
            filename=result["filename"],
            status="Processed",
            pages=result["pages"],
            chunks=result["total_chunks"]
        )
        documents_db.append(doc_info)
        return doc_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[DocumentInfo])
async def list_documents():
    return documents_db

@router.get("/stats")
async def get_system_stats():
    return {
        "documents": len(documents_db),
        "vector_store": vector_store_service.get_stats(),
        "total_chunks_processed": sum(doc.chunks for doc in documents_db)
    }
