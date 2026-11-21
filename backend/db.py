import os
from datetime import datetime, timezone
from uuid import uuid4

from dotenv import load_dotenv
from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv()
MODE = os.getenv("APP_MODE", "demo")
if MODE not in {"demo", "live"}:
    raise RuntimeError("APP_MODE must be demo or live")
DEMO = MODE == "demo"
url = os.getenv("DEMO_DATABASE_URL", "sqlite:///./placement-demo.sqlite3") if DEMO else os.environ["DATABASE_URL"]
url = url.replace("postgresql://", "postgresql+psycopg://", 1)
if DEMO != url.startswith("sqlite:"):
    raise RuntimeError("Use SQLite for demo mode and PostgreSQL for live mode")
engine = create_engine(url, pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)

if DEMO:
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")



if not DEMO:
    @event.listens_for(engine, "do_connect")
    def resolve_neon_host(dialect, connection_record, args, params):
        import ipaddress
        import socket
        import httpx

        hostname = params.get("host", "")
        params.setdefault("connect_timeout", 8)
        if not hostname.endswith(".neon.tech") or params.get("hostaddr"):
            return
        try:
            socket.getaddrinfo(hostname, params.get("port", 5432))
            return
        except socket.gaierror:
            pass
        # Keep the hostname for TLS/SNI and authentication; hostaddr supplies routing only.
        with httpx.Client(timeout=8) as client:
            response = client.get(
                "https://cloudflare-dns.com/dns-query",
                params={"name": hostname, "type": "A"},
                headers={"Accept": "application/dns-json"},
            )
            response.raise_for_status()
        answers = response.json()
        addresses = [str(ipaddress.IPv4Address(answer["data"]))
                     for answer in answers.get("Answer", []) if answer.get("type") == 1]
        if answers.get("Status") != 0 or not addresses:
            raise RuntimeError("Neon hostname could not be resolved. Check your network connection.")
        params["hostaddr"] = ",".join(addresses)
        params["host"] = ",".join([hostname] * len(addresses))


def now():
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(100))
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    target: Mapped[dict] = mapped_column(JSON, default=dict)
    resume: Mapped[dict] = mapped_column(JSON, default=dict)


class Login(Base):
    __tablename__ = "logins"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires: Mapped[int]


class Record(Base):
    __tablename__ = "preparation_records"
    __table_args__ = (UniqueConstraint("user_id", "target_id", "kind", "key"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_id: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(24))
    key: Mapped[str] = mapped_column(String(50), default=lambda: uuid4().hex)
    created: Mapped[str] = mapped_column(String(40), default=now)
    data: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(default=1)
    __mapper_args__ = {"version_id_col": version}


class Experience(Base):
    __tablename__ = "experiences"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    company: Mapped[str] = mapped_column(String(100), index=True)
    role: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)
    sample: Mapped[bool] = mapped_column(default=False)
    content: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(default=1)
    __mapper_args__ = {"version_id_col": version}


class Chunk(Base):
    __tablename__ = "experience_chunks"
    id: Mapped[int] = mapped_column(primary_key=True)
    experience_id: Mapped[str] = mapped_column(ForeignKey("experiences.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list] = mapped_column(Vector(384).with_variant(JSON(), "sqlite"))
