from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(String, primary_key=True, index=True) # e.g. "ATT-UUID"
    incident_id = Column(String, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)
    action_taken = Column(String, nullable=False)
    result = Column(String, nullable=False) # 'FAILED' or 'SUCCESSFUL'
    observed_notes = Column(Text, nullable=False)
    performed_by = Column(String, nullable=False)
    telemetry_before = Column(Text, nullable=True)
    telemetry_after = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    incident = relationship("Incident", back_populates="attempts")
