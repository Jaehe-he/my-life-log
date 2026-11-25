-- 권한 추가 (schema.sql 을 이미 실행한 프로젝트용). SQL Editor 에 붙여 넣고 Run 을 누르세요.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
grant select on public.settings to anon;
