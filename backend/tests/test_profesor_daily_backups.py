import importlib.util
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from test_access_control import client, seed_user
from test_profesor_state_history import setup, save, content, URL
from app.models import AppSetting, AuditLog, ClientState, ProfesorStateSnapshot
from app.services import profesor_state_history as history
from app.state_preservation_check import fingerprints, verify


@pytest.mark.parametrize('now,expected,hours', [
    (datetime(2026,3,28,23,tzinfo=timezone.utc), datetime(2026,3,29,22,tzinfo=timezone.utc), 23),
    (datetime(2026,10,24,22,tzinfo=timezone.utc), datetime(2026,10,25,23,tzinfo=timezone.utc), 25),
])
def test_next_midnight_follows_madrid_daylight_saving(now,expected,hours):
    assert history.next_midnight(now) == expected
    assert (expected-now).total_seconds() == hours*3600


def test_immediate_saves_do_not_create_full_copies_and_first_run_is_midnight(client):
    web,factory,user_id=setup(client)
    assert save(web,content()).status_code == 200
    assert history.run_daily_backups(factory,now=datetime(2026,1,1,12,tzinfo=timezone.utc)) == 0
    for i in range(55):
        assert save(web,content(str(i))).status_code == 200
    assert web.get(URL).json()['students'][0]['notes'] == '54'
    with factory() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(ProfesorStateSnapshot)) == 0
        receipts=list(db.scalars(sa.select(AuditLog).where(AuditLog.action=='profesor_state_saved')))
        assert len(receipts) == history.RECEIPT_LIMIT
        assert all('Nombre de prueba' not in str(r.log_metadata) for r in receipts)
    assert history.run_daily_backups(factory,now=datetime(2026,1,1,22,59,59,tzinfo=timezone.utc)) == 0
    assert history.run_daily_backups(factory,now=datetime(2026,1,1,23,tzinfo=timezone.utc)) == 1
    assert history.run_daily_backups(factory,now=datetime(2026,1,1,23,1,tzinfo=timezone.utc)) == 0
    with factory() as db:
        snapshot=db.scalar(sa.select(ProfesorStateSnapshot))
        assert snapshot.backup_day == date(2026,1,2)
        assert snapshot.reason == 'daily'
        assert history.unpack(snapshot)['students'][0]['notes'] == '54'


def test_each_day_has_one_copy_even_when_content_is_unchanged_and_only_five_remain(client):
    web,factory,user_id=setup(client)
    save(web,content())
    history.run_daily_backups(factory,now=datetime(2026,1,1,12,tzinfo=timezone.utc))
    for day in range(1,8):
        assert history.run_daily_backups(factory,now=datetime(2026,1,day,23,tzinfo=timezone.utc)) == 1
    with factory() as db:
        snapshots=list(db.scalars(sa.select(ProfesorStateSnapshot).order_by(ProfesorStateSnapshot.backup_day)))
        assert len(snapshots) == 5
        assert [s.backup_day.day for s in snapshots] == [4,5,6,7,8]
        assert {s.revision for s in snapshots} == {1}
    listed=web.get('/api/profesor/state-history?app=profesor_particular').json()
    assert listed['limit'] == 5 and listed['schedule'] == 'daily' and listed['time_zone']=='Europe/Madrid'
    assert len(listed['versions']) == 5


def test_restoring_oldest_of_five_keeps_the_current_work_recoverable(client):
    from test_profesor_state_history import backup
    web,factory,user_id=setup(client)
    for day in range(1,6):
        save(web,content(str(day)));backup(factory,user_id,day)
    save(web,content('Trabajo más reciente'))
    url='/api/profesor/state-history?app=profesor_particular'
    oldest=web.get(url).json()['versions'][-1]
    restored=web.post(f'/api/profesor/state-history/{oldest["id"]}/restore?app=profesor_particular',json={},headers={'If-Match':web.get(URL).headers['etag']})
    assert restored.status_code==200
    assert restored.json()['state']['students'][0]['notes']=='1'
    versions=web.get(url).json()['versions']
    assert len(versions)==5
    previous=next(v for v in versions if v['revision']==6)
    undone=web.post(f'/api/profesor/state-history/{previous["id"]}/restore?app=profesor_particular',json={},headers={'If-Match':restored.headers['etag']})
    assert undone.status_code==200
    assert undone.json()['state']['students'][0]['notes']=='Trabajo más reciente'
    assert len(web.get(url).json()['versions'])==5


def test_partial_failure_resumes_without_duplicate_days_and_offline_days_are_not_invented(client,monkeypatch):
    web,factory,user_id=setup(client)
    save(web,content())
    _,other=seed_user(factory,email='second@example.com',product_codes=('PROFESOR_PARTICULAR',))
    with factory() as db:
        from app.models import User
        user=db.get(User,UUID(other))
        db.add(ClientState(user_id=user.id,organization_id=user.organization_id,data={'__apps':{'profesor_particular':content('Otra')}}))
        db.commit()
    history.run_daily_backups(factory,now=datetime(2026,1,1,12,tzinfo=timezone.utc))
    original=history.checkpoint
    calls=0
    def fail_second(*args,**kwargs):
        nonlocal calls
        calls+=1
        if calls==2:raise RuntimeError('Simulated temporary failure')
        return original(*args,**kwargs)
    monkeypatch.setattr(history,'checkpoint',fail_second)
    with pytest.raises(RuntimeError):history.run_daily_backups(factory,now=datetime(2026,1,4,10,tzinfo=timezone.utc))
    with factory() as db:
        assert db.get(AppSetting,history.SCHEDULE_KEY).value == '2026-01-01'
        assert db.scalar(sa.select(sa.func.count()).select_from(ProfesorStateSnapshot)) == 1
    monkeypatch.setattr(history,'checkpoint',original)
    assert history.run_daily_backups(factory,now=datetime(2026,1,4,10,1,tzinfo=timezone.utc)) == 2
    with factory() as db:
        snapshots=list(db.scalars(sa.select(ProfesorStateSnapshot)))
        assert len(snapshots)==2 and {s.backup_day for s in snapshots} == {date(2026,1,4)}
        assert db.get(AppSetting,history.SCHEDULE_KEY).value == '2026-01-04'


def test_deployment_rejects_a_missing_receipt_in_a_concurrent_save_chain(client):
    web,factory,user_id=setup(client)
    save(web,content())
    with factory.kw['bind'].connect() as conn:before=fingerprints(conn)
    save(web,content('Dos'));save(web,content('Tres'))
    with factory.kw['bind'].connect() as conn:verify(before,fingerprints(conn),conn)
    with factory() as db:
        for receipt in db.scalars(sa.select(AuditLog).where(AuditLog.action=='profesor_state_saved')):
            if receipt.log_metadata['revision']==2:db.delete(receipt)
        db.commit()
    with factory.kw['bind'].connect() as conn:
        with pytest.raises(RuntimeError):verify(before,fingerprints(conn),conn)


def test_daily_migration_trims_old_history_without_changing_saved_data_and_is_idempotent(client):
    web,factory,user_id=setup(client)
    save(web,content())
    with factory() as db:
        state=db.scalar(sa.select(ClientState));before=deepcopy(state.data);org_id=state.organization_id
    path=Path(__file__).parents[1]/'alembic/versions/0021_daily_teacher_backups.py'
    spec=importlib.util.spec_from_file_location('daily_history_migration',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    with factory.kw['bind'].begin() as conn:
        ops=Operations(MigrationContext.configure(conn))
        with ops.batch_alter_table('profesor_state_snapshots') as batch:
            batch.drop_constraint('uq_profesor_snapshot_day',type_='unique')
            batch.drop_column('backup_day')
            batch.create_unique_constraint('uq_profesor_snapshot_revision',['user_id','revision'])
        legacy=sa.Table('profesor_state_snapshots',sa.MetaData(),autoload_with=conn)
        for i in range(8):
            conn.execute(legacy.insert().values(id=uuid4().hex,user_id=UUID(user_id).hex,organization_id=org_id.hex,
                revision=i+1,reason='save',counts={'students':1},payload_zlib=b'legacy',
                created_at=datetime(2026,1,1,tzinfo=timezone.utc)+timedelta(minutes=i)))
        module.op=ops;module.upgrade();module.upgrade()
        assert conn.execute(sa.select(ClientState.data)).scalar_one() == before
        assert conn.execute(sa.select(sa.func.count()).select_from(ProfesorStateSnapshot)).scalar_one()==5
        assert set(conn.execute(sa.select(ProfesorStateSnapshot.revision)).scalars()) == {4,5,6,7,8}
        assert 'uq_profesor_snapshot_revision' not in {c['name'] for c in sa.inspect(conn).get_unique_constraints('profesor_state_snapshots')}
    history.trim_backup_history(factory)
    # Same revision can be backed up on successive nights after migrating.
    with factory() as db:
        row=db.scalar(sa.select(ClientState))
        history.checkpoint(db,row,'daily',backup_day=date(2026,2,1),now=datetime(2026,2,1,tzinfo=timezone.utc))
        history.checkpoint(db,row,'daily',backup_day=date(2026,2,2),now=datetime(2026,2,2,tzinfo=timezone.utc))
        db.commit()
        assert db.scalar(sa.select(sa.func.count()).select_from(ProfesorStateSnapshot))==5
