"""T2B real lock waits; caller must supply the guarded disposable Database."""
import uuid

from important_dates_concurrency import actor, ordered_pair


def fixture(db):
    owner, member, space, source, subscription = [str(uuid.uuid4()) for _ in range(5)]
    db.sql(f"""begin;
insert into auth.users(id,email) values ('{owner}','claim-owner@example.invalid'),('{member}','claim-member@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{space}','Claim race','shared','{uuid.uuid4().hex[:8]}','{owner}');
insert into public.space_members(space_id,user_id,role) values ('{space}','{owner}','owner'),('{space}','{member}','member');
insert into public.space_modules(space_id,module_key,enabled) values ('{space}','important_dates',true);
insert into public.important_dates(id,space_id,name,repeat_kind,month,day,time_zone,reminder_kind,created_by)
values ('{source}','{space}','Race','annual',extract(month from current_date),extract(day from current_date),'UTC','all_day_same_day_08','{owner}');
alter table public.important_dates disable trigger important_dates_prepare_schedule;
update public.important_dates set reminder_schedule_changed_at='2000-01-01 00:00:00.123456Z' where id='{source}';
alter table public.important_dates enable trigger important_dates_prepare_schedule;
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth)
values ('{subscription}','{member}',gen_random_uuid(),'https://fcm.googleapis.com/{subscription}','fake','fake');
commit;""")
    due = db.sql("select quote_literal(clock_timestamp()-interval '1 second');")
    claim = f"public.claim_important_date_reminder_delivery('{source}',current_date,'{member}','{subscription}',{due},'all_day_same_day_08','2000-01-01 00:00:00.123456Z')"
    return owner, member, space, source, subscription, claim


def service(statement):
    return f'begin; set local role service_role; {statement}'


def check(delivery):
    return f"public.check_important_date_reminder_delivery('{delivery}','all_day_same_day_08','2000-01-01 00:00:00.123456Z')"


def run_concurrency(db):
    count = 0
    for phase in ['claim','pre-send']:
        for transition in ['disable','leave','remove','source-delete','space-delete','schedule','preset-off','subscription-disable','subscription-delete','cosmetic']:
            owner, member, space, source, subscription, claim = fixture(db)
            delivery = db.sql(service(f'select {claim}; commit;')) if phase == 'pre-send' else None
            mutations = {
                'disable': actor(owner, f"select public.set_space_module_enabled('{space}','important_dates',false);"),
                'leave': actor(member, f"select public.leave_shared_space('{space}');"),
                'remove': actor(owner, f"select public.remove_space_member('{space}','{member}');"),
                'source-delete': actor(owner, f"select public.delete_important_date('{source}');"),
                'space-delete': actor(owner, f"select public.delete_shared_space('{space}');"),
                'schedule': actor(owner, f"select public.update_important_date('{source}','Race',null,'annual',1,1,null,'all_day_previous_day_20');"),
                'preset-off': actor(owner, f"select public.update_important_date('{source}','Race',null,'annual',1,1,null,null);"),
                'cosmetic': actor(owner, f"select public.update_important_date('{source}','Renamed','⭐','annual',extract(month from current_date)::int,extract(day from current_date)::int,null,'all_day_same_day_08');"),
                # Subscription mutations don't own a Space lock. A separate holder
                # barrier ensures they commit while this claim/check is waiting.
                'subscription-disable': f"begin; select pg_advisory_xact_lock(hashtext('{space}')); update public.push_subscriptions set disabled_at=clock_timestamp() where id='{subscription}';",
                'subscription-delete': f"begin; select pg_advisory_xact_lock(hashtext('{space}')); delete from public.push_subscriptions where id='{subscription}';",
            }
            statement = f"select coalesce({claim}::text,'REJECTED');" if phase == 'claim' else f'select {check(delivery)};'
            result = ordered_pair(db, mutations[transition], service(statement)).splitlines()[-1]
            accepted = transition == 'cosmetic'
            assert (result != 'REJECTED' if phase == 'claim' else result == 't') == accepted, (phase, transition, result)
            assert db.sql(f"select count(*) from public.reminder_deliveries where important_date_id='{source}';") == ('1' if phase == 'pre-send' or accepted else '0')
            count += 1
            print(f'PASS {phase} post-lock {transition}: {"accepted" if accepted else "rejected"}')

    # Actual elapsed clock crosses expiry after either advisory, Space or source wait.
    for phase in ['claim','pre-send']:
        for boundary in ['advisory','space','source'] + (['ledger'] if phase == 'pre-send' else []):
            owner, member, space, source, subscription, claim = fixture(db)
            delivery = db.sql(service(f'select {claim}; commit;')) if phase == 'pre-send' else None
            db.sql(f"update public.push_subscriptions set expiration_time=clock_timestamp()+interval '3 seconds' where id='{subscription}';")
            holder = {
                'advisory': f"begin; select pg_advisory_xact_lock(hashtext('{space}'));",
                'space': f"begin; select 1 from public.spaces where id='{space}' for update;",
                'source': f"begin; update public.important_dates set name='Cosmetic row lock' where id='{source}';",
                'ledger': f"begin; update public.reminder_deliveries set updated_at=clock_timestamp() where id='{delivery}';",
            }[boundary]
            statement = f"select coalesce({claim}::text,'REJECTED');" if phase == 'claim' else f'select {check(delivery)};'
            sleep_until_expired = lambda: db.sql(f"select pg_sleep(greatest(0,extract(epoch from expiration_time-clock_timestamp()))+0.02) from public.push_subscriptions where id='{subscription}';")
            result = ordered_pair(db, holder, service(statement), wait_event='advisory' if boundary == 'advisory' else 'transactionid', after_wait=sleep_until_expired).splitlines()[-1]
            assert result == ('REJECTED' if phase == 'claim' else 'f'), (phase, boundary, result)
            count += 1
            print(f'PASS {phase} expiry uses clock after {boundary} wait')

    for phase in ['claim','pre-send']:
        owner, member, space, source, subscription, _ = fixture(db)
        due = db.sql("select quote_literal(clock_timestamp()-interval '10 minutes'+interval '3 seconds');")
        claim = f"public.claim_important_date_reminder_delivery('{source}',current_date,'{member}','{subscription}',{due},'all_day_same_day_08','2000-01-01 00:00:00.123456Z')"
        delivery = db.sql(service(f'select {claim}; commit;')) if phase == 'pre-send' else None
        statement = f"select coalesce({claim}::text,'REJECTED');" if phase == 'claim' else f'select {check(delivery)};'
        result = ordered_pair(db, f"begin; select pg_advisory_xact_lock(hashtext('{space}'));", service(statement),
            after_wait=lambda: db.sql(f"select pg_sleep(greatest(0,extract(epoch from {due}::timestamptz+interval '10 minutes'-clock_timestamp()))+0.02);")).splitlines()[-1]
        assert result == ('REJECTED' if phase == 'claim' else 'f'), (phase, result)
        count += 1
        print(f'PASS {phase} grace expires while lock is held')

    owner, member, space, source, subscription, claim = fixture(db)
    result = ordered_pair(db, service(f'select {claim};'), service(f"select coalesce({claim}::text,'REJECTED');")).splitlines()[-1]
    assert result == 'REJECTED'
    assert db.sql(f"select count(*) from public.reminder_deliveries where important_date_id='{source}';") == '1'
    count += 1
    print('PASS concurrent identical claims create exactly one durable row')

    owner, member, space, source, subscription, claim = fixture(db)
    delivery = db.sql(service(f'select {claim}; commit;'))
    result = ordered_pair(db, f"begin; update public.reminder_deliveries set status='failed',result_code='unexpected_task_error' where id='{delivery}';",
        service(f'select {check(delivery)};'), wait_event='transactionid').splitlines()[-1]
    assert result == 'f'
    count += 1
    print('PASS pre-send rechecks claimed status after ledger row wait')

    owner, member, space, source, subscription, _ = fixture(db)
    due = db.sql("select quote_literal(clock_timestamp()+interval '3 seconds');")
    claim = f"public.claim_important_date_reminder_delivery('{source}',current_date,'{member}','{subscription}',{due},'all_day_same_day_08','2000-01-01 00:00:00.123456Z')"
    result = ordered_pair(db, f"begin; select pg_advisory_xact_lock(hashtext('{space}'));", service(f"select coalesce({claim}::text,'REJECTED');"),
        after_wait=lambda: db.sql(f"select pg_sleep(greatest(0,extract(epoch from {due}::timestamptz-clock_timestamp()))+0.02);")).splitlines()[-1]
    assert result != 'REJECTED', result
    count += 1
    print('PASS claim accepts due that becomes current during lock wait')
    return count
