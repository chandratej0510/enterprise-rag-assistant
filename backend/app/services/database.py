import sqlite3
import os
import logging

logger = logging.getLogger(__name__)

# Target database file location: backend/data/rag.db
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "rag.db")

class DatabaseService:
    def __init__(self):
        # Ensure data folder exists
        os.makedirs(DB_DIR, exist_ok=True)
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Create documents table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    status TEXT NOT NULL,
                    pages INTEGER NOT NULL,
                    chunks INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create chunks table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    page INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    faiss_id INTEGER,
                    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
                )
            """)
            
            conn.commit()
            logger.info("Database initialized successfully at: %s", DB_PATH)

    def add_document(self, doc_id: str, filename: str, status: str, pages: int, chunks: int):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO documents (id, filename, status, pages, chunks) VALUES (?, ?, ?, ?, ?)",
                (doc_id, filename, status, pages, chunks)
            )
            conn.commit()

    def add_chunks(self, chunks: list, faiss_start_id: int):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for i, chunk in enumerate(chunks):
                faiss_id = faiss_start_id + i
                cursor.execute(
                    "INSERT INTO chunks (id, document_id, content, page, source, faiss_id) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        chunk["id"], 
                        chunk["metadata"].get("document_id"), 
                        chunk["content"], 
                        chunk["metadata"].get("page", 0), 
                        chunk["metadata"].get("source", "Unknown"), 
                        faiss_id
                    )
                )
            conn.commit()

    def list_documents(self):
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, filename, status, pages, chunks FROM documents ORDER BY created_at DESC")
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error("Error listing documents: %s", e)
            return []

    def get_document(self, doc_id: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, filename, status, pages, chunks FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def get_document_chunks(self, doc_id: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, document_id, content, page, source, faiss_id FROM chunks WHERE document_id = ? ORDER BY page ASC, faiss_id ASC", (doc_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_all_chunks(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, document_id, content, page, source, faiss_id FROM chunks ORDER BY faiss_id ASC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

db_service = DatabaseService()
