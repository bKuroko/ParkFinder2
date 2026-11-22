"""Idempotent additive migration for account approval and role fields."""

from sqlalchemy import Engine, text


def migrate_account_fields(engine: Engine) -> None:
    """Add and backfill account fields in an existing PostgreSQL database."""
    with engine.begin() as connection:
        for table in ("facilities", "admin_users", "parking_lot_submissions"):
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))
        connection.execute(text("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(30)"))
        connection.execute(text("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20)"))
        connection.execute(text("""
            UPDATE admin_users
            SET role = CASE
                WHEN facility_id IS NULL
                 AND NOT EXISTS (
                     SELECT 1 FROM admin_facility_assignments a
                     WHERE a.admin_id = admin_users.id
                 ) THEN 'super_admin'
                ELSE 'facility_admin'
            END
            WHERE role IS NULL
        """))
        connection.execute(text("UPDATE admin_users SET approval_status = 'approved' WHERE approval_status IS NULL"))
