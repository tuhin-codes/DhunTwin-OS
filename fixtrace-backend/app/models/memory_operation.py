from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from app.database import Base

class MemoryOperation(Base):
    __tablename__ = "memory_operations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    operation_type = Column(String, nullable=False, index=True) # "RECALL" or "RETAIN"
    incident_id = Column(String, nullable=True, index=True)
    machine_id = Column(String, nullable=True, index=True)
    bank_id = Column(String, nullable=False, default="fixtrace-demo-01")
    
    # Query & Result metadata (for RECALL)
    query = Column(Text, nullable=True)
    prior_experience_found = Column(Boolean, default=False)
    memories_count = Column(Integer, default=0)
    best_match_score = Column(Float, nullable=True)
    
    # Extracted guidance fields
    failed_actions = Column(Text, nullable=True) # JSON list or semicolon-separated
    successful_action = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    lesson_learned = Column(Text, nullable=True)
    
    # Retain metadata (for RETAIN)
    retained_id = Column(String, nullable=True)
    content_snippet = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
