import os
import uuid
from typing import List, Dict, Any
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

class IngestionService:
    def __init__(self):
        self.upload_dir = "uploads"
        os.makedirs(self.upload_dir, exist_ok=True)
        # Default configuration
        self.chunk_size = 500
        self.chunk_overlap = 50

    def process_pdf(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Parses a PDF, chunks it, and returns the chunks with metadata.
        """
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        # Add source filename to metadata
        for doc in docs:
            doc.metadata["source"] = filename
            
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            is_separator_regex=False,
        )
        
        chunks = text_splitter.split_documents(docs)
        
        processed_chunks = []
        for i, chunk in enumerate(chunks):
            processed_chunks.append({
                "id": str(uuid.uuid4()),
                "content": chunk.page_content,
                "metadata": chunk.metadata
            })
            
        return {
            "document_id": str(uuid.uuid4()),
            "filename": filename,
            "pages": len(docs),
            "total_chunks": len(chunks),
            "chunks": processed_chunks
        }

ingestion_service = IngestionService()
