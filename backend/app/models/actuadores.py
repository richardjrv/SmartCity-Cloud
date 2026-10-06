from pydantic import BaseModel, Field


class ConfirmarOrdenActuadorData(BaseModel):
    confirmation_token: str = Field(min_length=20, max_length=4096)
