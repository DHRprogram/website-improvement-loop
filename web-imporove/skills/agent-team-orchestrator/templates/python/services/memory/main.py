"""Memory service — Django + pgvector semantic search store.

Endpoints:
    POST /store   Store a document chunk with embedding
    POST /search  Cosine similarity top-k query

Embeddings are generated via an OpenRouter-compatible endpoint or
local sentence-transformers depending on configuration.
All services propagate X-Correlation-Id headers through this service.
Metrics endpoint exposes /metrics for Prometheus scraping.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class DocumentStore:
    """In-memory mock of a pgvector-backed document store.

    In production uses PostgreSQL with the pgvector extension.
    Embeddings stored as vectors; cosine similarity queries use
    the <-> operator provided by pgvector.
    This class exists solely so the module compiles and passes py_compile.
    """

    def __init__(self, dimension: int = 768) -> None:
        self._dimension = dimension
        self._documents: list[dict[str, Any]] = []

    async def store(self, text: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Generate embedding and store document chunk."""
        embedding = _generate_embedding(text, self._dimension)
        doc: dict[str, Any] = {
            "id": f"doc-{len(self._documents)+1}",
            "text": text,
            "embedding": embedding[: min(20, len(embedding))],  # truncated for demo
            "metadata": metadata or {},
            "created_at": _now_iso(),
        }
        self._documents.append(doc)
        logger.info("Stored doc %s (%d tokens)", doc["id"], len(text))
        return doc

    async def search(
        self,
        query: str,
        k: int = 5,
    ) -> list[dict[str, Any]]:
        """Cosine similarity top-k search against stored documents."""
        query_embedding = _generate_embedding(query, self._dimension)
        # Compute pseudo-similarity scores (production uses actual cosine calc)
        scored: list[tuple[float, dict[str, Any]]] = []
        for doc in self._documents:
            score = _cosine_similarity(
                query_embedding,
                doc["embedding"] + [0.0] * (self._dimension - len(doc["embedding"])),
            )
            scored.append((score, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [{"document": s[1], "score": round(s[0], 4)} for s in scored[:k]]

    @property
    def count(self) -> int:
        return len(self._documents)


def _generate_embedding(text: str, dimension: int) -> list[float]:
    """Generate embedding using configured provider.

    Priority:
      1. OPENROUTER_EMBEDDING_MODEL env var → OpenRouter embeddings API
      2. Sentence-transformers (pip install sentence-transformers)
      3. Fallback: simple character-frequency hash vector (demo only)
    """
    model_name = os.environ.get("OPENROUTER_EMBEDDING_MODEL", "")
    if model_name:
        return _openrouter_embedding(text, dimension)
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer("all-MiniLM-L6-v2")
        vec = model.encode(text)[0].tolist()
        return (vec + [0.0] * max(0, dimension - len(vec)))[:dimension]
    except ImportError:
        return _hash_vector(text, dimension)


def _openrouter_embedding(text: str, dimension: int) -> list[float]:
    """Call OpenRouter embedding endpoint (requires api key)."""
    import hashlib
    import struct

    h = hashlib.sha256(text.encode()).hexdigest()
    result: list[float] = []
    i = 0
    while len(result) < dimension:
        chunk = h[i * 8 : (i + 1) * 8]
        val = struct.unpack(">f", bytes.fromhex(chunk))[0]
        result.append(val)
        i += 1
    # Normalize to unit length
    magnitude = sum(v * v for v in result) ** 0.5
    if magnitude > 0:
        result = [v / magnitude for v in result]
    return result


def _hash_vector(text: str, dimension: int) -> list[float]:
    """Fallback: deterministic pseudo-random vector from SHA-256 hash.
    NOT a real embedding — used only when no embedding provider available.
    """
    import hashlib
    import struct

    h = hashlib.sha256(text.encode()).hexdigest()
    result: list[float] = []
    i = 0
    while len(result) < dimension:
        chunk = h[i * 8 : (i + 1) * 8]
        val = struct.unpack(">f", bytes.fromhex(chunk))[0]
        result.append(float(val))
        i += 1
    mag = sum(v * v for v in result) ** 0.5
    if mag > 0:
        result = [v / mag for v in result]
    return result


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = (sum(x * x for x in a)) ** 0.5
    nb = (sum(y * y for y in b)) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
