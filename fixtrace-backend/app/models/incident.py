from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True) # e.g. "INC-2026-001"
    machine_id = Column(String, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True)
    symptoms = Column(Text, nullable=False)
    operating_conditions = Column(Text, nullable=False)
    severity = Column(String, nullable=False, default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String, nullable=False, default="OPEN") # OPEN, IN_PROGRESS, RESOLVED
    technician_name = Column(String, nullable=False)
    root_cause = Column(Text, nullable=True)
    resolution_summary = Column(Text, nullable=True)
    lesson_learned = Column(Text, nullable=True)
    hindsight_retained_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    machine = relationship("Machine", back_populates="incidents")
    attempts = relationship(
        "Attempt",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="Attempt.attempt_number"
    )
