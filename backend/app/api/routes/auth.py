from fastapi import APIRouter, Depends, HTTPException, status
import re

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.api.deps import get_current_admin
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.schemas import AdminProfile, AdminRegistrationCreate, LoginRequest, Token


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    admin = db.scalar(select(models.AdminUser).where(models.AdminUser.email == payload.email.lower()))
    if not admin or admin.is_deleted or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if admin.approval_status == "pending":
        raise HTTPException(status_code=403, detail="Your account is waiting for super-admin approval")
    if admin.approval_status == "rejected":
        raise HTTPException(status_code=403, detail="Your registration was not approved")
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account is inactive")
    return Token(access_token=create_access_token(str(admin.id)))


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: AdminRegistrationCreate, db: Session = Depends(get_db)) -> dict[str, str | int]:
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password must be no more than 72 UTF-8 bytes")
    if len(full_name) < 2:
        raise HTTPException(status_code=422, detail="Name must contain at least 2 characters")
    existing = db.scalar(select(models.AdminUser).where(func.lower(models.AdminUser.email) == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    admin = models.AdminUser(
        email=email,
        full_name=full_name,
        hashed_password=get_password_hash(payload.password),
        is_active=False,
        account_role="facility_admin",
        account_approval_status="pending",
    )
    db.add(admin)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
    db.refresh(admin)
    return {
        "id": admin.id,
        "email": admin.email,
        "full_name": admin.full_name,
        "approval_status": "pending",
        "message": "Registration submitted. You can sign in after super-admin approval.",
    }


@router.get("/me", response_model=AdminProfile)
def read_me(current_admin: models.AdminUser = Depends(get_current_admin)) -> models.AdminUser:
    return current_admin
