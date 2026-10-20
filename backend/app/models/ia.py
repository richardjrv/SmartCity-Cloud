from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class MessageHistory(BaseModel):
    role: Literal["user", "assistant", "model"]
    content: str = Field(min_length=1, max_length=2000)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: Optional[List[MessageHistory]] = Field(default=None, max_length=24)
