create table if not exists processing_recipes (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null,
  recipe_name text not null,
  output_crop_name text not null,
  output_unit text not null default 'kg',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists processing_recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references processing_recipes(id) on delete cascade,
  input_crop_name text not null,
  input_unit text not null default 'kg',
  input_per_output numeric not null check (input_per_output > 0),
  created_at timestamptz not null default now()
);

create table if not exists processing_runs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null,
  recipe_id uuid not null references processing_recipes(id),
  run_date date not null,
  input_qty numeric not null check (input_qty > 0),
  expected_output_qty numeric not null check (expected_output_qty > 0),
  actual_output_qty numeric not null check (actual_output_qty > 0),
  output_crop_name text not null,
  output_unit text not null,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_processing_recipes_farm_id on processing_recipes(farm_id);
create index if not exists idx_processing_runs_farm_id on processing_runs(farm_id);
create index if not exists idx_processing_runs_run_date on processing_runs(run_date desc);
