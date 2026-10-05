from pydantic import BaseModel
from typing import List, Optional

class MessageHistory(BaseModel):
    role: str  # "user" o "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageHistory]] = None  # Evita usar listas mutables en defaults