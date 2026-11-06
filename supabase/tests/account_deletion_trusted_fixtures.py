"""Synthetic business fixtures only; every user is created by the real Auth API."""
from account_deletion_cross_service import uid


def seed(g,owner,member):
    a,b=owner['id'],member['id']
    for user in [owner,member]:
        assert g.rpc(user['jwt'],'ensure_personal_space')['status']==200
    personal=g.sql(f"select id from public.spaces where kind='personal' and created_by='{b}'")
    shared=g.data(g.rpc(owner['jwt'],'create_space_with_invite',{'space_name':'Keep Shared'}))
    assert g.rpc(member['jwt'],'join_space_by_invite_code',{'code':shared['invite_code']})['status']==200
    shared=shared['id']
    ids={key:uid() for key in ['root','child','private_root','private_child','shared_event','other_personal',
        'task','private_task','list','section','item','private_list','private_section','private_item','date','private_date','round','private_round','push',
        'delivery_keep','delivery_target','delivery_deleted','delivery_private_task','delivery_private_date']}
    ids.update(personal=personal,shared=shared,owner=a,target=b)
    i=ids
    recurrence='{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}'
    g.sql(f"""begin;
insert into public.space_modules(space_id,module_key,enabled)
select s,k,true from unnest(array['{personal}'::uuid,'{shared}'::uuid])s cross join unnest(array['review','lists','important_dates'])k
on conflict(space_id,module_key) do update set enabled=true;
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,time_zone,recurrence_rule,series_id,parent_event_id) values
 ('{i['root']}','{shared}','{a}','personal','{b}','Delete target owner root','2030-01-01 10:00Z','UTC','{recurrence}','{i['root']}',null),
 ('{i['child']}','{shared}','{b}','personal','{b}','Delete target split','2030-01-02 10:00Z','UTC','{recurrence}','{i['root']}','{i['root']}'),
 ('{i['private_root']}','{personal}','{b}','personal','{b}','Private recurring','2030-01-01 10:00Z','UTC','{recurrence}','{i['private_root']}',null),
 ('{i['private_child']}','{personal}','{b}','personal','{b}','Private split','2030-01-02 10:00Z','UTC','{recurrence}','{i['private_root']}','{i['private_root']}'),
 ('{i['shared_event']}','{shared}','{b}','shared',null,'Keep exact Shared Event','2030-01-01',null,null,null,null),
 ('{i['other_personal']}','{shared}','{b}','personal','{a}','Keep other owner Event','2030-01-01',null,null,null,null);
insert into public.event_occurrence_exceptions(event_id,occurrence_date,exception_type) values
 ('{i['root']}','2030-01-03','deleted'),('{i['private_root']}','2030-01-03','deleted');
insert into public.tasks(id,space_id,created_by,title,assigned_to_user_id) values
 ('{i['task']}','{shared}','{b}','Keep exact Shared Task','{b}'),('{i['private_task']}','{personal}','{b}','Private Task',null);
insert into public.lists(id,space_id,name,created_by) values
 ('{i['list']}','{shared}','Keep Shared List','{b}'),('{i['private_list']}','{personal}','Private List','{b}');
insert into public.list_sections(id,list_id,name,sort_order,created_by) values
 ('{i['section']}','{i['list']}','Keep Section',1024,'{b}'),('{i['private_section']}','{i['private_list']}','Private Section',1024,'{b}');
insert into public.list_items(id,list_id,space_id,section_id,content,sort_order,created_by) values
 ('{i['item']}','{i['list']}','{shared}','{i['section']}','Keep Item',1024,'{b}'),
 ('{i['private_item']}','{i['private_list']}','{personal}','{i['private_section']}','Private Item',1024,'{b}');
insert into public.important_dates(id,space_id,name,repeat_kind,month,day,time_zone,created_by) values
 ('{i['date']}','{shared}','Keep Date','annual',1,1,'UTC','{b}'),('{i['private_date']}','{personal}','Private Date','annual',1,1,'UTC','{b}');
insert into public.review_rounds(id,space_id,round_no,review_date,created_by) values
 ('{i['round']}','{shared}',1,'2030-01-01','{b}'),('{i['private_round']}','{personal}',1,'2030-01-01','{b}');
insert into public.review_entries(review_id,user_id,focus,next_plan) values
 ('{i['round']}','{a}','Keep A body','Keep A plan'),('{i['round']}','{b}','Keep B body','Keep B plan'),
 ('{i['private_round']}','{b}','Private body','Private plan');
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth) values
 ('{i['push']}','{b}','{uid()}','https://fcm.googleapis.com/{uid()}','fixture','fixture');
insert into public.reminder_deliveries(id,event_id,recipient_user_id,subscription_id,due_at,status) values
 ('{i['delivery_keep']}','{i['shared_event']}','{a}','{uid()}',now(),'claimed'),
 ('{i['delivery_target']}','{i['shared_event']}','{b}','{i['push']}',now(),'claimed'),
 ('{i['delivery_deleted']}','{i['root']}','{a}','{uid()}',now(),'claimed');
insert into public.reminder_deliveries(id,task_id,important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status) values
 ('{i['delivery_private_task']}','{i['private_task']}',null,'{a}','{uid()}','2030-01-01',now(),'claimed'),
 ('{i['delivery_private_date']}',null,'{i['private_date']}','{a}','{uid()}','2030-01-01',now(),'claimed');
commit;""")
    return ids


def retained(g,i):
    result={}
    for table,condition in [
        ('spaces',f"id='{i['shared']}'"),('events',f"id in ('{i['shared_event']}','{i['other_personal']}')"),
        ('tasks',f"id='{i['task']}'"),('lists',f"id='{i['list']}'"),('list_sections',f"id='{i['section']}'"),
        ('list_items',f"id='{i['item']}'"),('important_dates',f"id='{i['date']}'"),
        ('review_rounds',f"id='{i['round']}'"),('review_entries',f"review_id='{i['round']}'"),
        ('reminder_deliveries',f"id='{i['delivery_keep']}'")]:
        # Lifecycle is allowed to rotate invite code and clear assignment/touch
        # its timestamp/reminder marker. Every other ID/body/link/revision must remain exact.
        expression="to_jsonb(t)-'invite_code'" if table=='spaces' else "to_jsonb(t)-'assigned_to_user_id'-'updated_at'-'reminder_schedule_changed_at'" if table=='tasks' else 'to_jsonb(t)'
        result[table]=g.sql(f"select coalesce(jsonb_agg({expression} order by to_jsonb(t)::text),'[]') from public.{table} t where {condition}")
    return result


def fingerprints(g):
    return {t:g.sql(f"select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.{t} t")
            for t in ['profiles','spaces','space_members','space_modules','events','event_occurrence_exceptions','tasks',
                      'lists','list_sections','list_items','important_dates','review_rounds','review_entries','push_subscriptions','reminder_deliveries']}
