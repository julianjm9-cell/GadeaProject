"""Read-only operational signals. No prompts, credentials, pupil names or responses."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import shutil
from sqlalchemy import func, select
from app.config import get_settings
from app.models import AppSetting, ProviderCall, ProfesorGenerationJob
from app.models.core import utcnow
from app.services.profesor_state_history import BACKUP_ZONE, SCHEDULE_KEY


def heartbeat(db, name):
    key='operations_'+name+'_heartbeat'
    row=db.get(AppSetting,key)
    if row is None:
        db.add(AppSetting(key=key,value=utcnow().isoformat()))
    else:
        row.value=utcnow().isoformat()
    db.commit()


def signals(db, *, at=None):
    now=at or utcnow();settings=get_settings();alerts=[]
    def alert(code,message,critical=False):alerts.append({'code':code,'message':message,'severity':'critical' if critical else 'warning'})
    workers={}
    for name in ('worker','backups'):
        row=db.get(AppSetting,'operations_'+name+'_heartbeat')
        try:
            stamp=datetime.fromisoformat(row.value);stamp=stamp.replace(tzinfo=timezone.utc) if stamp.tzinfo is None else stamp
            age=max(0,int((now-stamp).total_seconds()))
        except (AttributeError,ValueError):age=None
        workers[name]={'last_seen_at':row.value if row else None,'age_seconds':age}
        if age is None or age>1200:alert(name+'_heartbeat','No hay una señal reciente del proceso de '+('copias' if name=='backups' else 'trabajos')+'. Revisa el contenedor ocr-worker.',True)
    schedule=db.get(AppSetting,SCHEDULE_KEY)
    today=now.astimezone(BACKUP_ZONE)
    if (not schedule or schedule.value<today.date().isoformat()) and today.hour>=1:
        alert('daily_backup_late','La copia diaria está retrasada. Revisa el proceso y ensaya la recuperación.',True)
    disk=shutil.disk_usage('/app/data/documents' if __import__('pathlib').Path('/app/data/documents').exists() else '.')
    free_pct=disk.free/disk.total*100
    if free_pct<10:alert('disk_space','Espacio libre inferior al 10 %. Revisa documentos y copias antes de retirar ninguna.',free_pct<5)
    failed=db.scalar(select(func.count()).select_from(ProfesorGenerationJob).where(ProfesorGenerationJob.status=='failed',ProfesorGenerationJob.updated_at>=now-timedelta(minutes=15))) or 0
    if failed>=5:alert('generation_failures','Hay cinco o más generaciones fallidas en los últimos quince minutos.')
    month=now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    cost=db.scalar(select(func.sum(ProviderCall.estimated_usd)).where(ProviderCall.created_at>=month)) or Decimal(0)
    unknown=db.scalar(select(func.count()).select_from(ProviderCall).where(ProviderCall.created_at>=month,ProviderCall.estimated_usd.is_(None))) or 0
    total=db.scalar(select(func.count()).select_from(ProviderCall).where(ProviderCall.created_at>=month)) or 0
    if unknown:alert('unpriced_provider_calls','Hay llamadas sin coste estimable. Configura tarifas por modelo y contrasta la factura del proveedor; no se cuentan como coste cero.')
    if settings.ai_monthly_budget_usd and cost>=Decimal(str(settings.ai_monthly_budget_usd)):
        alert('ai_budget','El coste estimado registrado alcanza el umbral mensual configurado.',True)
    if not settings.smtp_host or not settings.smtp_from:alert('account_mail','Falta correo saliente. Las altas por correo y la recuperación están desactivadas; las cuentas existentes y Google siguen disponibles.')
    return {'checked_at':now.isoformat(),'ok':not any(row['severity']=='critical' for row in alerts),'alerts':alerts,
        'workers':workers,'backup_schedule_day':schedule.value if schedule else None,
        'disk':{'free_bytes':disk.free,'free_percent':round(free_pct,1)},
        'ai':{'period':'month_utc','calls':total,'estimated_usd':float(cost),'unpriced_calls':unknown,'budget_usd':settings.ai_monthly_budget_usd},
        'new_teacher_plan':settings.profesor_signup_plan}
