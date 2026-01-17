-- Create applied_jobs table
create table if not exists applied_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  job_id uuid references jobs(id) on delete set null,
  applied_at timestamp with time zone default timezone('utc'::text, now()) not null,
  job_title text,
  company_name text,
  job_url text,
  location text,
  unique(user_id, job_id)
);

-- Enable RLS
alter table applied_jobs enable row level security;

-- Policies
create policy "Users can view their own applied jobs"
on applied_jobs for select
using (auth.uid() = user_id);

create policy "Users can insert their own applied jobs"
on applied_jobs for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own applied jobs"
on applied_jobs for delete
using (auth.uid() = user_id);

-- Update existing records if any (optional, assuming new table mostly)
-- If table already has data, we might want to backfill, but for now we assume fresh structure or manual migration.
