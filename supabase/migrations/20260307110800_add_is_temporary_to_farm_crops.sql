alter table public.farm_crops
add column if not exists is_temporary boolean not null default false;

update public.farm_crops
set is_temporary = false
where is_temporary is distinct from false;
