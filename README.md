# Enterprise RAG Assistant

A scalable, production-grade Retrieval-Augmented Generation (RAG) platform.

## Features

- **Document Ingestion**: PDF parsing, intelligent chunking, and text vectorization.
- **Advanced Semantic Search**: FAISS vector indexing with MiniLM-L6-v2 embeddings.
- **Cross-Encoder Reranking**: Re-evaluates initially retrieved context for superior precision using ms-marco-MiniLM-L-6-v2.
- **Retrieval Transparency**: UI panels demonstrating live chunk scores, citations, and pipeline latency.
- **Enterprise-Grade UI**: Built with Next.js, Framer Motion, and Tailwind CSS.
- **Microservices Backend**: FastAPI, modular routing, LangChain integrations.

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory and add your OpenAI API Key:
```env
OPENAI_API_KEY=your_api_key_here
```

Run the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Architecture

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, Framer Motion
- **Backend**: FastAPI, Python 3.12
- **AI Stack**: LangChain, Sentence Transformers (Cross-Encoder & Bi-Encoder), FAISS Vector Store, OpenAI.
