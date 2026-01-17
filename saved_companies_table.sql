-- Create saved_companies table
create table if not exists saved_companies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  company_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, company_name)
);

-- Policy to allow users to insert their own saved companies
alter table saved_companies enable row level security;

create policy "Users can view their own saved companies"
on saved_companies for select
using (auth.uid() = user_id);

create policy "Users can insert their own saved companies"
on saved_companies for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own saved companies"
on saved_companies for delete
using (auth.uid() = user_id);
