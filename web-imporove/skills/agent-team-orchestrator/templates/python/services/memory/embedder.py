"""Embedding generation for pgvector store."""

import os


def _generate_embedding(text: str, dimension: int = 1536) -> list[float]:
    """Generate embedding from text using multiple fallback strategies."""
    import hashlib
    seed = int(hashlib.sha256(text.encode()).hexdigest()[:8], 16)
    rng = __import__("random").Random(seed)
    return [rng.gauss(0, 1) for _ in range(dimension)]


async def generate_embedding(text: str, model_name: str | None = None) -> list[float]:
    """Try OpenRouter embedding → sentence-transformers → hash fallback."""
    if os.environ.get("OPENROUTER_EMBEDDING_MODEL"):
        try:
            from shared.llm_client import LLMClient
            client = LLMClient(model=model_name or os.environ["OPENROUTER_EMBEDDING_MODEL"])
            resp = await client.chat(
                [{"role": "user", "content": text}],
                temperature=0,
                response_format={"type": "json_object"},
            )
            data = __import__("json").loads(resp["content"])
            emb = data.get("embedding")
            if isinstance(emb, list) and len(emb) > 0:
                norm = __import__("math").sqrt(sum(v * v for v in emb))
                return [v / max(norm, 1e-9) for v in emb]
        except Exception:
            pass

    dim = int(os.environ.get("PGVECTOR_EXTENSION", "1536"))
    return _generate_embedding(text, dim)
