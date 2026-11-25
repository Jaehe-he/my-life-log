-- 마이라이프 데이터베이스 설정
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 을 누르세요.
-- 여러 번 실행해도 안전합니다 (이미 있는 표와 기록은 그대로 둡니다).

do $$
declare
  t text;
  base text := 'id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now()';
  defs text[][] := array[
    ['transactions',        'date date, type text, amount numeric, category text, method text, memo text, recurring_id uuid, account_id uuid'],
    ['budgets',             'category text, amount numeric'],
    ['recurring',           'name text, type text, amount numeric, category text, method text, day int, start_month text, active boolean default true, memo text, account_id uuid'],
    ['accounts',            'name text, kind text, category text, balance numeric, memo text, bank text, account_no text, start_date date, term_months int, monthly_amount numeric, rate numeric, prior_rounds int'],
    ['net_worth_snapshots', 'month text, assets numeric, debts numeric'],
    ['investments',         'name text, kind text, invested numeric, current_value numeric, memo text'],
    ['diary',               'date date, mood int, good text, bad text, thanks text, content text, photos jsonb'],
    ['notes',               'title text, content text, tag text, pinned boolean default false'],
    ['books',               'title text, author text, publisher text, cover text, isbn text, total_pages int, current_page int default 0, status text, rating int, started date, finished date, review text'],
    ['book_quotes',         'book_id uuid, page int, text text'],
    ['reading_logs',        'book_id uuid, date date, pages int'],
    ['study_subjects',      'name text, start_date date, end_date date, goal text, done boolean default false'],
    ['study_materials',     'subject_id uuid, name text, kind text, total_units int, done_units int default 0'],
    ['study_logs',          'subject_id uuid, material_id uuid, date date, minutes int, memo text'],
    ['hobbies',             'name text'],
    ['hobby_logs',          'hobby_id uuid, date date, minutes int, memo text, photos jsonb'],
    ['media',               'title text, kind text, rating int, date date, comment text'],
    ['weights',             'date date, kg numeric'],
    ['workouts',            'date date, kind text, minutes int, memo text'],
    ['sleeps',              'date date, bed_time text, wake_time text'],
    ['meals',               'date date, meal text, content text'],
    ['waters',              'date date, ml int'],
    ['events',              'title text, date date, start_time text, end_time text, memo text, google_id text'],
    ['todos',               'title text, due date, done boolean default false, done_at date, goal_id uuid, memo text'],
    ['habits',              'name text, goal_id uuid, active boolean default true'],
    ['habit_checks',        'habit_id uuid, date date'],
    ['goals',               'title text, deadline date, memo text, done boolean default false'],
    ['settings',            'key text, value jsonb']
  ];
begin
  for i in 1 .. array_length(defs, 1) loop
    t := defs[i][1];
    execute format('create table if not exists public.%I (%s, %s)', t, base, defs[i][2]);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    -- 본인이 쓴 기록만 읽고 쓸 수 있게 잠급니다
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- 사진 저장소: 비공개, 본인 폴더(사용자 id)만 접근
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists photos_own on storage.objects;
create policy photos_own on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
