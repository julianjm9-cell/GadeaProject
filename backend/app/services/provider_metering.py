"""Operational provider usage, separate from the teacher's success-only credits."""
from contextvars import ContextVar
from datetime import datetime, timezone
from decimal import Decimal
import json
import logging
import re
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models import ProviderCall

context = ContextVar('profesor_provider_meter', default=None)
logger = logging.getLogger(__name__)


def record_call(url, body, response, elapsed_ms):
    owner = context.get()
    if not owner:
        return
    match=re.search(r'/models/([^:]+)',url)
    model = str(body.get('model') or (match.group(1) if match else 'unknown'))[:120]
    provider = 'gemini' if 'googleapis.com' in url else 'groq' if 'groq.com' in url else 'other'
    sent = received = cost = None
    code = response.status_code if response is not None else 0
    if response is not None:
        try:
            value = response.json()
            usage = value.get('usage') or value.get('usageMetadata')
            if isinstance(usage,dict):
                sent=int(usage.get('prompt_tokens',usage.get('promptTokenCount',0)) or 0)
                received=int(usage.get('completion_tokens',usage.get('candidatesTokenCount',0)) or 0)+int(usage.get('thoughtsTokenCount',0) or 0)
                price=json.loads(get_settings().ai_model_prices_json).get(model)
                if isinstance(price,dict) and 'input' in price and 'output' in price:
                    cost=(Decimal(str(price['input']))*sent+Decimal(str(price['output']))*received)/1_000_000
                    if cost<0:cost=None
        except (ValueError,TypeError,KeyError,AttributeError,ArithmeticError):
            pass
    try:
        with Session(bind=owner['bind']) as db:
            db.add(ProviderCall(user_id=owner['user_id'],organization_id=owner['organization_id'],request_id=owner['request_id'],
                model=model,provider=provider,status_code=code,input_tokens=sent,output_tokens=received,estimated_usd=cost,
                duration_ms=max(0,int(elapsed_ms)),created_at=datetime.now(timezone.utc)))
            db.commit()
    except Exception:
        logger.error('provider_meter_write_failed request=%s',owner['request_id'])
