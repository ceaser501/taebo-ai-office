-- 태보 사무실 상태·결과물 저장소. Supabase SQL Editor 에서 한 번 실행한다.
create table if not exists public.office_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
-- 정책을 만들지 않는다: 공개 키로는 읽고 쓸 수 없고, 서버의 비밀 키만 쓸 수 있다.
alter table public.office_state enable row level security;

-- 결과물 파일(PPT 등) 버킷 — 비공개
insert into storage.buckets (id, name, public)
values ('office-files', 'office-files', false)
on conflict (id) do nothing;
