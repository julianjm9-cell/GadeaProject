"""Idempotent user-owned AI deliveries; response and credits commit together."""
from datetime import timedelta
from functools import wraps
from hashlib import sha256
import json
import inspect
import time
from uuid import UUID, uuid4
import httpx
from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError, OperationalError
from app.models import AiRequest, User
from app.models.core import utcnow
from app.services.provider_metering import context, record_call


def busy():
    return HTTPException(503, 'Ya hay una petición de IA en curso para esta cuenta. Espera unos segundos y pulsa Reintentar. Tus datos se conservan.', headers={'Retry-After':'5'})


def lock_account(db, user):
    try:
        db.scalar(select(User.id).where(User.id == user.id).with_for_update(nowait=True))
    except OperationalError as exc:
        db.rollback()
        if getattr(exc.orig, 'sqlstate', None) == '55P03' or getattr(exc.orig, 'pgcode', None) == '55P03':
            raise busy() from exc
        raise


def reliable_ai(function):
    signature = inspect.signature(function, eval_str=True)
    @wraps(function)
    async def wrapped(*args, **kwargs):
        arguments = signature.bind(*args, **kwargs).arguments
        db, user, request = arguments['db'], arguments['user'], arguments['request']
        license_obj = arguments.get('license_obj') or arguments['_']
        raw = request.headers.get('Idempotency-Key')
        try:
            request_id = str(UUID(raw)) if raw else str(uuid4())
        except (TypeError, ValueError) as exc:
            raise HTTPException(422, 'Identificador de petición no válido.') from exc
        fingerprint = sha256(json.dumps([request.url.path,license_obj.product_code,arguments['payload']],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        lock_account(db, user)
        receipt = db.scalar(select(AiRequest).where(AiRequest.user_id == user.id, AiRequest.request_id == request_id))
        if receipt:
            if receipt.fingerprint != fingerprint:
                raise HTTPException(409, 'Esta petición pertenece a otro contenido.')
            if receipt.status == 'completed':
                return receipt.result
            stamp = receipt.updated_at
            if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=utcnow().tzinfo)
            if receipt.status == 'running' and stamp > utcnow()-timedelta(minutes=10):
                raise busy()
        else:
            receipt = AiRequest(user_id=user.id,request_id=request_id,product_code=license_obj.product_code,fingerprint=fingerprint)
            db.add(receipt)
        receipt.status='running';receipt.updated_at=utcnow()
        # Retain only recent technical receipts, never study content or backups.
        db.execute(delete(AiRequest).where(AiRequest.user_id==user.id,AiRequest.updated_at<utcnow()-timedelta(days=7)))
        try: db.commit()
        except IntegrityError as exc:
            db.rollback();raise busy() from exc
        owner={'bind':db.get_bind(),'user_id':user.id,'organization_id':user.organization_id,'request_id':request_id,
               'product_code':license_obj.product_code,'pending':[]}
        token=context.set(owner)
        try:
            result=await function(*args,**kwargs)
            receipt.status='completed';receipt.result=result;receipt.updated_at=utcnow()
            db.commit()
            return result
        except Exception:
            db.rollback()
            receipt=db.scalar(select(AiRequest).where(AiRequest.user_id==user.id,AiRequest.request_id==request_id))
            if receipt: receipt.status='failed';receipt.updated_at=utcnow();db.commit()
            raise
        finally:
            if db.in_transaction(): db.rollback()
            context.reset(token)
            owner.pop('pending')  # User locks are released before independent metering writes.
            for entry in owner.pop('calls',[]):
                meter=context.set(owner)
                try: record_call(*entry)
                finally: context.reset(meter)
    wrapped.__signature__ = signature
    return wrapped


async def provider_post(client, url, **kwargs):
    started=time.monotonic();body=kwargs.get('json') or kwargs.get('data') or {}
    try:
        response=await client.post(url,**kwargs)
    except httpx.RequestError as exc:
        record_call(str(url),body,None,(time.monotonic()-started)*1000)
        if context.get() is None:
            raise
        raise HTTPException(503,'La IA no ha podido completar la conexión. Tus datos se conservan y no se han descontado créditos. Espera unos segundos y pulsa Reintentar.',headers={'Retry-After':'5'}) from exc
    record_call(str(url),body,response,(time.monotonic()-started)*1000)
    return response
