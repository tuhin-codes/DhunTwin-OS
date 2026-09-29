from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Machine(Base):
    __tablename__ = "machines"

    id = Column(String, primary_key=True, index=True) # e.g. "CNC-MOTOR-104"
    name = Column(String, nullable=False)
    machine_type = Column(String, nullable=False)
    location = Column(String, nullable=False)
    status = Column(String, nullable=False, default="OPERATIONAL") # OPERATIONAL, WARNING, MAINTENANCE
    specifications = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    incidents = relationship("Incident", back_populates="machine", cascade="all, delete-orphan")
