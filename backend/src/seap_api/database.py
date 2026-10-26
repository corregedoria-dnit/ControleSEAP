from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from seap_api.config import get_settings


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def build_engine() -> Engine | None:
    url = get_settings().database_url
    if not url:
        return None
    return create_engine(
        _normalize_database_url(url),
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"connect_timeout": 5},
    )


_engine = build_engine()
_SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False) if _engine else None


def get_db() -> Iterator[Session]:
    if _SessionLocal is None:
        raise RuntimeError("DATABASE_URL não configurada.")
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database() -> bool:
    if _engine is None:
        return False
    try:
        with _engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
