"""Isolated real-API fixture; never reads the deployment database or credentials."""
import json
import socket
import os
from pathlib import Path
sock=socket.socket();sock.bind(("127.0.0.1",0))
url="http://127.0.0.1:"+str(sock.getsockname()[1])
os.environ["PUBLIC_BASE_URL"]=url
os.environ["CORS_ORIGINS"]=url
from app.database.session import Base, SessionLocal, engine
from app.main import app
from app.api import private_apps
private_apps.IMAGE_ROOT = Path(os.environ["EDUCAME_PRIVATE_IMAGE_DIR"])
from app.models import Organization, User
from app.security.passwords import hash_password
import uvicorn
Base.metadata.create_all(engine)
with SessionLocal() as db:
    org=Organization(name="Ensayo de apps privadas",status="active");db.add(org);db.flush()
    db.add(User(organization_id=org.id,email="organizador@example.invalid",full_name="Organizador de ensayo",role="superadmin",is_active=True,password_hash=hash_password("ensayo-temporal-123")))
    db.commit()
print(json.dumps({"url":url}),flush=True)
uvicorn.Server(uvicorn.Config(app,log_level="error",proxy_headers=False)).run(sockets=[sock])
