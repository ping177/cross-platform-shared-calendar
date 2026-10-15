"""Observed two-session lock orderings, only in a caller-owned disposable DB."""
import uuid
from important_dates_concurrency import actor, ordered_pair

def fixture(db):
    a,b,s,e,sub=[str(uuid.uuid4()) for _ in range(5)]
    db.sql(f"""begin;
insert into auth.users(id,email) values ('{a}','race-a@collab.invalid'),('{b}','race-b@collab.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{s}','Race','shared','{uuid.uuid4().hex}','{a}');
insert into public.space_members(space_id,user_id,role) values ('{s}','{a}','owner'),('{s}','{b}','member');
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,reminder_kind,time_zone)
 values ('{e}','{s}','{a}','personal','{a}','Race','2030-01-01','timed_at_start','UTC');
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth)
 values ('{sub}','{a}',gen_random_uuid(),'https://fcm.googleapis.com/{sub}','fake','fake');
commit;""")
    version=db.sql(f"select quote_literal(updated_at) from public.events where id='{e}';")
    marker=db.sql(f"select quote_literal(reminder_schedule_changed_at) from public.events where id='{e}';")
    save=f"select public.save_event_edit('{e}',{version},'personal','{b}','{{\"title\":\"Changed\"}}');"
    return a,b,s,e,sub,version,marker,save

def run(db):
    a,b,s,e,sub,version,marker,save=fixture(db)
    ordered_pair(db,actor(a,save),actor(b,save),error='Event was modified concurrently')
    assert db.sql(f"select title from public.events where id='{e}';")=='Changed'
    a,b,s,e,sub,version,marker,save=fixture(db)
    ordered_pair(db,actor(b,f"select public.leave_shared_space('{s}');"),actor(b,save),
                 error='Not permitted to manage this event')
    assert db.sql(f"select title from public.events where id='{e}';")=='Race'
    a,b,s,e,sub,version,marker,save=fixture(db)
    ordered_pair(db,actor(a,f"select public.remove_space_member('{s}','{b}');"),actor(a,save),
                 error='Invalid Event audience')
    a,b,s,e,sub,version,marker,save=fixture(db)
    claim=f"select public.claim_reminder_delivery('{e}','{a}','{sub}',clock_timestamp(),{marker});"
    output=ordered_pair(db,actor(b,save),'begin; set local role service_role; '+claim)
    assert output.strip()=='',output
    a,b,s,e,sub,version,marker,save=fixture(db)
    delivery=db.sql('begin; set local role service_role; '+f"select public.claim_reminder_delivery('{e}','{a}','{sub}',clock_timestamp(),{marker}); commit;")
    assert uuid.UUID(delivery)
    check=f"select public.check_event_reminder_delivery('{delivery}','{e}',{marker});"
    output=ordered_pair(db,actor(b,save),'begin; set local role service_role; '+check)
    assert output.strip()=='f',output
    for first in ['split','save']:
        a,b,s,e,sub,version,marker,save=fixture(db)
        db.sql(f"update public.events set recurrence_rule='{{\"version\":1,\"frequency\":\"daily\",\"interval\":1,\"time_zone\":\"UTC\"}}' where id='{e}';")
        version=db.sql(f"select quote_literal(updated_at) from public.events where id='{e}';")
        split=f"select public.split_recurring_event('{e}','2030-01-02','Child',null,'2030-01-02T01:00:00Z',null,false,'{{\"version\":1,\"frequency\":\"daily\",\"interval\":1,\"time_zone\":\"UTC\"}}',{version});"
        save=f"select public.save_event_edit('{e}',{version},'personal','{b}','{{}}');"
        holder,waiter=(split,save) if first=='split' else (save,split)
        ordered_pair(db,actor(a,holder),actor(b,waiter),error='Event was modified concurrently')
    return 7
