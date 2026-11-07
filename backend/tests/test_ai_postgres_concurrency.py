"""Real row locks: a second AI request must not freeze the first or the server."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
import threading
from uuid import uuid4
import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.database.session import Base, get_db
from app.main import app
from app.config import get_settings
from test_access_control import seed_user, login


@pytest.mark.skipif(not os.getenv('AUDIT_POSTGRES_URL'),reason='Requires isolated PostgreSQL service')
def test_busy_account_returns_promptly_and_first_delivery_completes(monkeypatch):
    url=os.environ['AUDIT_POSTGRES_URL'];schema='audit_'+uuid4().hex
    root=create_engine(url)
    with root.begin() as connection:connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
    engine=create_engine(url,connect_args={'options':f'-csearch_path={schema}'})
    factory=sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    def database():
        with factory() as db:yield db
    app.dependency_overrides[get_db]=database
    monkeypatch.setattr(get_settings(),'groq_api_key','gsk-test')
    monkeypatch.setattr(get_settings(),'jwt_secret','isolated-concurrency-test-secret-over-32-bytes')
    started,release=threading.Event(),threading.Event()
    async def post(self,url,**kwargs):
        started.set()
        for _ in range(200):
            if release.is_set():break
            await asyncio.sleep(.025)
        return httpx.Response(200,json={'choices':[{'message':{'content':'Respuesta'}}]})
    monkeypatch.setattr(httpx.AsyncClient,'post',post)
    try:
        seed_user(factory,product_codes=('CAMBRIDGE',))
        with TestClient(app) as web,ThreadPoolExecutor(max_workers=2) as pool:
            login(web)
            payload={'messages':[{'role':'user','content':'Test'}]}
            first=pool.submit(web.post,'/api/chat?app=cambridge',json=payload,headers={'Idempotency-Key':str(uuid4())})
            assert started.wait(5)
            second=pool.submit(web.post,'/api/chat?app=cambridge',json=payload,headers={'Idempotency-Key':str(uuid4())})
            try:assert second.result(timeout=3).status_code==503
            finally:release.set()
            assert first.result(timeout=5).status_code==200
    finally:
        release.set();app.dependency_overrides.clear();engine.dispose()
        with root.begin() as connection:connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        root.dispose()
