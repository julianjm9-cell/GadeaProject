"""Hostinger: docker compose exec -T backend python -m app.operation_check."""
import json
from app.database.session import SessionLocal
from app.services.operation_health import signals


if __name__=='__main__':
    with SessionLocal() as db:
        result=signals(db)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['ok'] else 2)
