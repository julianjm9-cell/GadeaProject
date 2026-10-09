"""Periodic retention enforcement, including when the board has no visitors."""
import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from app.database.session import SessionLocal, get_db


def sweep():
    from app.api.profesor_ads import purge_expired
    with SessionLocal() as db:
        purge_expired(db)


@asynccontextmanager
async def lifespan(app):
    async def run():
        while True:
            try:
                await asyncio.to_thread(sweep)
            except Exception:
                logging.getLogger(__name__).exception("No se pudo aplicar la conservación del tablón")
            await asyncio.sleep(3600)

    task = None if get_db in app.dependency_overrides else asyncio.create_task(run())
    try:
        yield
    finally:
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
