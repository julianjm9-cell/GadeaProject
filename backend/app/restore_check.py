"""Read-only checks against a temporary restored database, not production."""
import json
import os
import re
import zlib
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import make_url
from app.config import get_settings


def verify_restore(connection):
    inspector=inspect(connection)
    counts={}
    for table in ('users','licenses','client_states','documents','profesor_state_snapshots'):
        if not inspector.has_table(table):
            raise RuntimeError('Falta una tabla necesaria: '+table)
        counts[table]=connection.execute(text(f'SELECT COUNT(*) FROM {table}')).scalar_one()
    for data, in connection.execute(text('SELECT data FROM client_states')):
        data=json.loads(data) if isinstance(data,str) else data
        if not isinstance(data,dict):raise RuntimeError('Hay un escritorio ilegible.')
    for payload, in connection.execute(text('SELECT payload_zlib FROM profesor_state_snapshots')):
        if not isinstance(json.loads(zlib.decompress(payload)),dict):raise RuntimeError('Hay una copia ilegible.')
    if connection.execute(text('SELECT COUNT(*) FROM licenses l LEFT JOIN users u ON u.id=l.user_id WHERE l.user_id IS NOT NULL AND u.id IS NULL')).scalar_one():
        raise RuntimeError('Hay licencias sin cuenta vinculada.')
    print('OK contenido restaurado legible: '+json.dumps(counts,sort_keys=True))


if __name__=='__main__':
    name=os.environ.get('RESTORE_CHECK_DATABASE','')
    if not re.fullmatch(r'restore_check_[0-9]+_[0-9]+',name):
        raise SystemExit('Solo se permite comprobar una base temporal restore_check_.')
    engine=create_engine(make_url(get_settings().database_url).set(database=name))
    with engine.connect() as connection:
        verify_restore(connection)
