"""Real Task claim/check waits; receives only a guarded disposable Database."""
import uuid
from important_dates_concurrency import actor, ordered_pair


def fixture(db, assigned=False):
    owner, member, space, task, subscription = [str(uuid.uuid4()) for _ in range(5)]
    db.sql(f"""begin;
insert into auth.users(id,email) values ('{owner}','task-owner@example.invalid'),('{member}','task-member@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{space}','Task race','shared','{uuid.uuid4().hex[:8]}','{owner}');
insert into public.space_members(space_id,user_id,role) values ('{space}','{owner}','owner'),('{space}','{member}','member');
insert into public.tasks(id,space_id,created_by,title,due_on,reminder_kind,time_zone,assigned_to_user_id)
values('{task}','{space}','{owner}','Race',current_date,'all_day_same_day_08','UTC',{'null' if not assigned else "'"+member+"'"});
alter table public.tasks disable trigger tasks_prepare_reminder_schedule;
update public.tasks set reminder_schedule_changed_at='2000-01-01 00:00:00.123456Z' where id='{task}';
alter table public.tasks enable trigger tasks_prepare_reminder_schedule;
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth)
values('{subscription}','{member}',gen_random_uuid(),'https://fcm.googleapis.com/{subscription}','fake','fake');
commit;""")
    due = db.sql("select quote_literal(clock_timestamp()-interval '1 second');")
    claim = f"public.claim_task_reminder_delivery('{task}',current_date,'{member}','{subscription}',{due},'all_day_same_day_08','2000-01-01 00:00:00.123456Z')"
    return owner, member, space, task, subscription, claim


def service(statement): return f'begin; set local role service_role; {statement}'
def check(delivery): return f"public.check_task_reminder_delivery('{delivery}','all_day_same_day_08','2000-01-01 00:00:00.123456Z')"


def run_concurrency(db):
    count = 0
    for phase in ['claim','pre-send']:
        for transition in ['disable','leave','remove','source-delete','space-delete','due','due-remove','preset','timezone','complete','reopen','assignee-aba','subscription-disable','cosmetic']:
            owner, member, space, task, subscription, claim = fixture(db, transition in ['leave','remove'])
            delivery = db.sql(service(f'select {claim}; commit;')) if phase == 'pre-send' else None
            change = {
                'disable': actor(owner, f"select public.set_space_module_enabled('{space}','tasks',false);"),
                'leave': actor(member, f"select public.leave_shared_space('{space}');"),
                'remove': actor(owner, f"select public.remove_space_member('{space}','{member}');"),
                'space-delete': actor(owner, f"select public.delete_shared_space('{space}');"),
                'source-delete': actor(owner, f"delete from public.tasks where id='{task}';"),
                'due': actor(owner, f"update public.tasks set due_on=current_date+1 where id='{task}';"),
                'due-remove': actor(owner, f"update public.tasks set due_on=null where id='{task}';"),
                'preset': actor(owner, f"update public.tasks set reminder_kind=null where id='{task}';"),
                'timezone': actor(owner, f"update public.tasks set time_zone='Asia/Shanghai' where id='{task}';"),
                'complete': actor(owner, f"update public.tasks set status='completed' where id='{task}';"),
                'reopen': actor(owner, f"update public.tasks set status='completed' where id='{task}'; update public.tasks set status='open' where id='{task}';"),
                'assignee-aba': actor(owner, f"update public.tasks set assigned_to_user_id='{member}' where id='{task}'; update public.tasks set assigned_to_user_id='{owner}' where id='{task}'; update public.tasks set assigned_to_user_id=null where id='{task}';"),
                'subscription-disable': f"begin; select pg_advisory_xact_lock(hashtext('{space}')); update public.push_subscriptions set disabled_at=clock_timestamp() where id='{subscription}';",
                'cosmetic': actor(owner, f"update public.tasks set title='Renamed' where id='{task}';"),
            }[transition]
            statement = f"select coalesce({claim}::text,'REJECTED');" if phase == 'claim' else f'select {check(delivery)};'
            # Direct Task UPDATE/DELETE holds the Task row, not a Space advisory lock.
            wait = 'advisory' if transition in ['disable','leave','remove','space-delete','subscription-disable'] else 'transactionid'
            result = ordered_pair(db, change, service(statement), wait_event=wait).splitlines()[-1]
            assert (result != 'REJECTED' if phase == 'claim' else result == 't') == (transition == 'cosmetic'), (phase, transition, result)
            if transition in ['leave','remove']:
                assert db.sql(f"select assigned_to_user_id is null and reminder_schedule_changed_at>'2000-01-01' from public.tasks where id='{task}';") == 't'
            count += 1
            print(f'PASS {phase} committed {transition}')
        owner, member, space, task, subscription, claim = fixture(db)
        result = ordered_pair(db, service(f'select {claim};'), service(f"select coalesce({claim}::text,'REJECTED');")).splitlines()[-1]
        assert result == 'REJECTED'
        assert db.sql(f"select count(*) from public.reminder_deliveries where task_id='{task}';") == '1'
        count += 1
    # No stale clock survives a row wait. Check also waits on its actual ledger row.
    for phase in ['claim','pre-send']:
        for boundary in ['advisory','space','task'] + (['ledger'] if phase == 'pre-send' else []):
            owner, member, space, task, subscription, claim = fixture(db)
            delivery = db.sql(service(f'select {claim}; commit;')) if phase == 'pre-send' else None
            db.sql(f"update public.push_subscriptions set expiration_time=clock_timestamp()+interval '1 second' where id='{subscription}';")
            holder = {
                'advisory': f"begin; select pg_advisory_xact_lock(hashtext('{space}'));",
                'space': f"begin; select 1 from public.spaces where id='{space}' for update;",
                'task': f"begin; update public.tasks set title='Cosmetic lock' where id='{task}';",
                'ledger': f"begin; update public.reminder_deliveries set updated_at=clock_timestamp() where id='{delivery}';",
            }[boundary]
            statement = f"select coalesce({claim}::text,'REJECTED');" if phase == 'claim' else f'select {check(delivery)};'
            result = ordered_pair(db, holder, service(statement), wait_event='advisory' if boundary == 'advisory' else 'transactionid',
                after_wait=lambda: db.sql(f"select pg_sleep(greatest(0,extract(epoch from expiration_time-clock_timestamp()))+0.02) from public.push_subscriptions where id='{subscription}';")).splitlines()[-1]
            assert result == ('REJECTED' if phase == 'claim' else 'f'), (phase,boundary,result)
            count += 1
    for phase in ['claim','pre-send']:
        owner, member, space, task, subscription, _ = fixture(db)
        due = db.sql("select quote_literal(clock_timestamp()-interval '10 minutes'+interval '1 second');")
        claim = f"public.claim_task_reminder_delivery('{task}',current_date,'{member}','{subscription}',{due},'all_day_same_day_08','2000-01-01 00:00:00.123456Z')"
        delivery = db.sql(service(f'select {claim}; commit;')) if phase == 'pre-send' else None
        statement = f"select coalesce({claim}::text,'REJECTED');" if phase == 'claim' else f'select {check(delivery)};'
        result = ordered_pair(db, f"begin; select pg_advisory_xact_lock(hashtext('{space}'));",service(statement),
            after_wait=lambda: db.sql(f"select pg_sleep(greatest(0,extract(epoch from {due}::timestamptz+interval '10 minutes'-clock_timestamp()))+0.02);")).splitlines()[-1]
        assert result == ('REJECTED' if phase == 'claim' else 'f'), (phase,result)
        count += 1
    owner, member, space, task, subscription, claim = fixture(db)
    delivery = db.sql(service(f'select {claim}; commit;'))
    result = ordered_pair(db, f"begin; update public.reminder_deliveries set status='failed',result_code='unexpected_task_error' where id='{delivery}';",
        service(f'select {check(delivery)};'),wait_event='transactionid').splitlines()[-1]
    assert result == 'f'; count += 1
    return count
