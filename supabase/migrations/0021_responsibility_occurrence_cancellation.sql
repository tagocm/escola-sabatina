alter table public.class_responsibility_occurrences
add column if not exists is_cancelled boolean not null default false;

create index if not exists idx_class_responsibility_occurrences_cancelled
on public.class_responsibility_occurrences (class_id, scheduled_date, is_cancelled);
