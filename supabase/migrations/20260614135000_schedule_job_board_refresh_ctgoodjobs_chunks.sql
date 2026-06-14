create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job record;
  source_job record;
  command_sql text;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname like 'rt_refresh_job_board_cache_daily_0800_hkt%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  for source_job in
    select *
    from (
      values
        ('tencent', '腾讯招聘', 0),
        ('meituan', '美团招聘', 1),
        ('lagou', '拉勾招聘', 2),
        ('jobrapido_cn', 'Jobrapido 中国', 3),
        ('talent_cn', 'Talent 中国', 4)
    ) as source_jobs(id, label, minute_offset)
    union all
    select
      format('ctgoodjobs_%s_%s', category_index, chunk_index) as id,
      format('CTgoodjobs %s.%s', category_index + 1, chunk_index + 1) as label,
      5 + category_index * 8 + chunk_index as minute_offset
    from generate_series(0, 4) as category_index
    cross join generate_series(0, 7) as chunk_index
    union all
    select *
    from (
      values
        ('hkslash', 'HKSlash', 45),
        ('joblum_hk', 'Joblum Hong Kong', 46),
        ('recruit_hk', 'Recruit.com.hk', 47),
        ('jobrapido_hk', 'Jobrapido Hong Kong', 48),
        ('talent_hk', 'Talent Hong Kong', 49),
        ('greenhouse', 'Greenhouse', 50),
        ('talent_na', 'Talent North America', 51),
        ('remotive', 'Remotive', 52),
        ('jobicy', 'Jobicy', 53),
        ('remoteok', 'Remote OK', 54)
    ) as source_jobs(id, label, minute_offset)
  loop
    command_sql := format(
      $command$
        select net.http_post(
          url := 'https://bpynqhujzvadyakypfju.supabase.co/functions/v1/refresh-job-board-cache',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-job-refresh-secret', coalesce(
              (select decrypted_secret from vault.decrypted_secrets where name = 'rt_job_refresh_secret' limit 1),
              ''
            )
          ),
          body := jsonb_build_object(
            'trigger', 'pg_cron',
            'schedule', 'daily_0800_hkt_by_source',
            'source', %L
          ),
          timeout_milliseconds := 300000
        );
      $command$,
      source_job.id
    );

    perform cron.schedule(
      format('rt_refresh_job_board_cache_daily_0800_hkt_%s', source_job.id),
      format('%s 0 * * *', source_job.minute_offset),
      command_sql
    );
  end loop;
end $$;
