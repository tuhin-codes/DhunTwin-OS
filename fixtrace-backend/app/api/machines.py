from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.machine import Machine
from app.schemas.machine import MachineCreate, MachineResponse, MachineUpdate

router = APIRouter(prefix="/machines", tags=["Machines"])

@router.get("", response_model=List[MachineResponse])
def list_machines(db: Session = Depends(get_db)):
    """Retrieve all monitored machines."""
    return db.query(Machine).order_by(Machine.id).all()

@router.post("", response_model=MachineResponse, status_code=status.HTTP_201_CREATED)
def create_machine(payload: MachineCreate, db: Session = Depends(get_db)):
    """Register a new industrial machine."""
    existing = db.query(Machine).filter(Machine.id == payload.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Machine with ID '{payload.id}' already exists."
        )

    machine = Machine(
        id=payload.id,
        name=payload.name,
        machine_type=payload.machine_type,
        location=payload.location,
        status=payload.status,
        specifications=payload.specifications
    )
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine

@router.get("/{machine_id}", response_model=MachineResponse)
def get_machine(machine_id: str, db: Session = Depends(get_db)):
    """Retrieve a specific machine by ID."""
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine '{machine_id}' not found."
        )
    return machine

@router.patch("/{machine_id}", response_model=MachineResponse)
def update_machine(machine_id: str, payload: MachineUpdate, db: Session = Depends(get_db)):
    """Update machine parameters or status."""
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine '{machine_id}' not found."
        )
    
    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(machine, field, value)

    db.commit()
    db.refresh(machine)
    return machine
