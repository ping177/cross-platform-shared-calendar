begin;

revoke all privileges
on table public.reminder_deliveries
from service_role;

grant select, update
on table public.reminder_deliveries
to service_role;

commit;
