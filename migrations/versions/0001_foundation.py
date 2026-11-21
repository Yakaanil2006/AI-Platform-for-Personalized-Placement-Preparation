"""Create the accounts, preparation and experience tables."""

from alembic import op
from pgvector.sqlalchemy import Vector
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    if op.get_context().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "users",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("email", sa.String(254), unique=True, nullable=False),
        sa.Column("password", sa.Text(), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("profile", sa.JSON(), nullable=False),
        sa.Column("target", sa.JSON(), nullable=False),
        sa.Column("resume", sa.JSON(), nullable=False),
    )
    op.create_table(
        "logins",
        sa.Column("token", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires", sa.Integer(), nullable=False),
    )
    op.create_index("ix_logins_user_id", "logins", ["user_id"])
    op.create_table(
        "preparation_records",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_id", sa.String(32), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("key", sa.String(50), nullable=False),
        sa.Column("created", sa.String(40), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.UniqueConstraint("user_id", "target_id", "kind", "key"),
    )
    op.create_index("ix_preparation_records_user_id", "preparation_records", ["user_id"])
    op.create_table(
        "experiences",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("author_id", sa.String(32), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("company", sa.String(100), nullable=False),
        sa.Column("role", sa.String(100), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("sample", sa.Boolean(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )
    for column in ("company", "role", "status"):
        op.create_index(f"ix_experiences_{column}", "experiences", [column])
    op.create_table(
        "experience_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("experience_id", sa.String(32), sa.ForeignKey("experiences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(384).with_variant(sa.JSON(), "sqlite"), nullable=False),
    )
    op.create_index("ix_experience_chunks_experience_id", "experience_chunks", ["experience_id"])


def downgrade():
    for table in ("experience_chunks", "experiences", "preparation_records", "logins", "users"):
        op.drop_table(table)
