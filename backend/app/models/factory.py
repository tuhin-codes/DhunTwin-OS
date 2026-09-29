from pydantic import BaseModel

from app.models.machine import Machine


class Department(BaseModel):
    id: str
    name: str
    machines: list[Machine]


class Factory(BaseModel):
    id: str
    name: str
    departments: list[Department]