"""Cosine similarity search over stored embeddings."""

import math
from .main import DocumentStore


class SearchEngine:
    """Top-k cosine similarity retriever with MMR re-ranking option."""

    def __init__(self, store: DocumentStore):
        self.store = store

    async def search(self, query: str, k: int = 5) -> list[dict]:
        query_emb = await self._query_to_vector(query)
        docs = await self.store.list_all()
        scored = []
        for doc in docs:
            if doc.get("embedding"):
                sim = self._cosine_similarity(query_emb, doc["embedding"])
                scored.append({"doc": doc, "score": round(sim, 4)})
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:k]

    async def _query_to_vector(self, query: str) -> list[float]:
        from .embedder import generate_embedding
        return await generate_embedding(query)

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(v * v for v in a))
        mag_b = math.sqrt(sum(v * v for v in b))
        if mag_a < 1e-9 or mag_b < 1e-9:
            return 0.0
        return dot / (mag_a * mag_b)
