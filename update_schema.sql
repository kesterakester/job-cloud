-- Add score_details column to resume_scores table if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'resume_scores' and column_name = 'score_details') then
        alter table public.resume_scores add column score_details jsonb;
    end if;
end $$;

-- Verify the column exists
select column_name, data_type 
from information_schema.columns 
where table_name = 'resume_scores';
