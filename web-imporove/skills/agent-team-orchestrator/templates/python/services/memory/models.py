"""Memory service database models."""

from pydantic import BaseModel
import uuid


class StoredDocument(BaseModel):
    id: str = ""
    text: str
    embedding: list[float] | None = None
    metadata: dict = {}
    created_at: str = ""
    source: str = "unknown"

    def __init__(self, **data):
        super().__init__(**data)
        if not self.id:
            self.id = str(uuid.uuid4())[:12]
        if not self.created_at:
            self.created_at = __import__("datetime").datetime.utcnow().isoformat()
