import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings

class KnowledgeService:
    def __init__(self):
        # 1. Setup Vector DB (Persistent)
        self.db_dir = "knowledge_db"
        self.embedding_function = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
        self.vector_store = Chroma(
            persist_directory=self.db_dir, 
            embedding_function=self.embedding_function
        )
        print("📚 Knowledge Base Loaded.")

    def ingest_pdf(self, file_path):
        print(f"📖 Reading {file_path}...")
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        # Split into chunks (paragraphs)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(docs)
        
        # Save to Vector DB
        self.vector_store.add_documents(chunks)
        print(f"✅ Indexed {len(chunks)} knowledge chunks.")
        return len(chunks)

    def search_knowledge(self, query):
        print(f"🔍 Searching library for: {query}")
        # Retrieve top 3 most relevant chunks
        results = self.vector_store.similarity_search(query, k=3)
        
        context_text = ""
        for doc in results:
            source = os.path.basename(doc.metadata.get("source", "Unknown"))
            page = doc.metadata.get("page", 0)
            context_text += f"\n[SOURCE: {source}, Page {page}]: {doc.page_content}\n"
            
        return context_text

knowledge_service = KnowledgeService()