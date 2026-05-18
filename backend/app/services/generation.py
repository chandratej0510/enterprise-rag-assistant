import os
from typing import List, Dict, Any
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "dummy_key_for_now"))

class GenerationService:
    async def generate_response(self, query: str, context_docs: List[Dict[str, Any]]) -> str:
        if not context_docs:
            return "I could not find any relevant information in the uploaded documents to answer your question."
            
        context_texts = []
        for i, doc in enumerate(context_docs):
            source = doc['metadata'].get('source', 'Unknown source')
            page = doc['metadata'].get('page', 'Unknown page')
            context_texts.append(f"[Citation {i+1} - {source} (Page {page})]:\n{doc['content']}")
            
        context_block = "\n\n".join(context_texts)
        
        system_prompt = (
            "You are an enterprise AI assistant specialized in reading retrieved documents and answering questions factually. "
            "You must ONLY use the provided context to answer the user's question. "
            "If the answer is not contained in the context, you must state that you cannot answer based on the provided documents. "
            "Always include inline citations referencing the context block provided (e.g., [Citation 1]). "
            "Do not hallucinate external information."
        )
        
        user_prompt = f"Context Information:\n{context_block}\n\nQuestion: {query}"
        
        try:
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1
            )
            return response.choices[0].message.content
        except Exception as e:
            # If the dummy key is used or API fails, fallback to a mocked response for demo purposes
            return f"Mocked Response: Based on the provided documents, I can see information about your query. \n\nCitations:\n{context_block[:200]}...\n\n(Note: OpenAI API key may not be configured properly. Error: {str(e)})"

generation_service = GenerationService()
