-- =====================================================================
-- WeBuy backend | Phần của Nhi | 01. Nền tảng: lỗi API, giới hạn tốc độ,
-- log lỗi, hồ sơ người dùng và phân quyền buyer/seller/admin.
--
-- Checklist: "Đăng ký/đăng nhập & phân quyền", "Thông báo & log lỗi backend" (phần log + rate limit).
-- Chạy trên Supabase: SQL Editor hoặc `supabase db push`. Chạy lại nhiều lần không lỗi.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Kiểu dữ liệu dùng chung
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('buyer', 'seller', 'admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- api_error: báo lỗi có mã HTTP rõ ràng.
-- Supabase (PostgREST) đọc SQLSTATE dạng 'PTxxx' và trả đúng HTTP xxx,
-- nên frontend nhận 400/401/403/404/409/429 thay vì 500 chung chung.
--   message = mã lỗi ngắn để code xử lý (VD: OUT_OF_STOCK)
--   detail  = câu tiếng Việt để hiển thị cho người dùng
-- ---------------------------------------------------------------------
create or replace function public.api_error(p_status int, p_code text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'PT' || p_status::text,
    message = p_code,
    detail = p_message;
end $$;

-- Bắt buộc đăng nhập, trả về UID thật lấy từ JWT (không tin dữ liệu gửi lên từ trình duyệt)
create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform public.api_error(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập để thực hiện thao tác này.');
  end if;
  return v_uid;
end $$;

-- ---------------------------------------------------------------------
-- Giới hạn tốc độ cho endpoint nhạy cảm (đăng ký seller, đặt hàng, giữ hàng, ghi log...)
-- Đếm số lần gọi của mỗi user cho mỗi hành động trong một khung thời gian.
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, action, window_start)
);
alter table public.rate_limits enable row level security; -- không có policy: trình duyệt không đọc/ghi được

create or replace function public.enforce_rate_limit(p_action text, p_max int, p_window_seconds int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_hits int;
begin
  if v_uid is null then return; end if; -- khách chưa đăng nhập đã bị chặn bởi require_user()
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (user_id, action, window_start, hits)
  values (v_uid, p_action, v_window, 1)
  on conflict (user_id, action, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  if v_hits > p_max then
    perform public.api_error(429, 'RATE_LIMITED', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.');
  end if;

  -- Dọn dữ liệu cũ hơn 1 ngày của chính user này
  delete from public.rate_limits where user_id = v_uid and window_start < now() - interval '1 day';
end $$;

-- ---------------------------------------------------------------------
-- Log lỗi request từ frontend. Không lưu mật khẩu/token: các khóa có tên
-- chứa password/token/secret/key/authorization bị thay bằng "[đã ẩn]".
-- ---------------------------------------------------------------------
create table if not exists public.api_error_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  endpoint text not null,
  status int,
  code text,
  message text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists api_error_logs_created_idx on public.api_error_logs (created_at desc);
alter table public.api_error_logs enable row level security; -- chỉ admin/service role đọc (xem policy bên dưới)

create or replace function public.redact_secrets(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(p_value)
    when 'object' then coalesce((
      select jsonb_object_agg(
        k,
        case when k ~* '(pass|token|secret|key|authorization|cookie|otp)' then to_jsonb('[đã ẩn]'::text)
             else public.redact_secrets(v) end)
      from jsonb_each(p_value) as e(k, v)), '{}'::jsonb)
    when 'array' then coalesce((select jsonb_agg(public.redact_secrets(v)) from jsonb_array_elements(p_value) as a(v)), '[]'::jsonb)
    when 'string' then to_jsonb(left(p_value #>> '{}', 500))
    else p_value
  end
$$;

create or replace function public.log_client_error(p_endpoint text, p_status int, p_code text, p_message text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('log_client_error', 30, 60);
  insert into public.api_error_logs (user_id, endpoint, status, code, message, context)
  values (
    auth.uid(),
    left(coalesce(p_endpoint, 'unknown'), 120),
    p_status,
    left(p_code, 60),
    left(p_message, 500),
    public.redact_secrets(coalesce(p_context, '{}'::jsonb))
  );
end $$;

-- ---------------------------------------------------------------------
-- Hồ sơ người dùng. Mỗi tài khoản Supabase Auth có đúng 1 dòng profile.
-- Cột role KHÔNG cho trình duyệt sửa (chỉ được sửa tên, SĐT, địa chỉ).
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9]{9,12}$'),
  address text not null default '' check (char_length(address) <= 200),
  role public.app_role not null default 'buyer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Vai trò của người đang gọi, đọc từ database (không đọc từ field role do browser gửi)
create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists api_error_logs_admin_read on public.api_error_logs;
create policy api_error_logs_admin_read on public.api_error_logs
  for select to authenticated
  using ((select public.is_admin()));

-- Tự tạo profile khi có tài khoản mới đăng ký. Role luôn bắt đầu là buyer,
-- kể cả khi trình duyệt cố gửi role = admin trong metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tạo profile cho tài khoản đã tồn tại trước khi chạy migration này
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- RPC: lấy và cập nhật hồ sơ của chính mình
create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'email', u.email,
    'name', p.full_name,
    'phone', p.phone,
    'address', p.address,
    'role', p.role,
    'storeId', (select s.id from public.stores s where s.owner_id = p.id)
  )
  into v_result
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_uid;

  if v_result is null then
    perform public.api_error(404, 'PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ của tài khoản này.');
  end if;
  return v_result;
end $$;

create or replace function public.update_my_profile(p_name text, p_phone text, p_address text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_user();
begin
  p_name := btrim(coalesce(p_name, ''));
  p_phone := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
  p_address := btrim(coalesce(p_address, ''));

  if char_length(p_name) > 80 then perform public.api_error(400, 'INVALID_NAME', 'Họ tên tối đa 80 ký tự.'); end if;
  if p_phone <> '' and p_phone !~ '^\+?[0-9]{9,12}$' then perform public.api_error(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ.'); end if;
  if char_length(p_address) > 200 then perform public.api_error(400, 'INVALID_ADDRESS', 'Địa chỉ tối đa 200 ký tự.'); end if;

  update public.profiles
     set full_name = p_name, phone = p_phone, address = p_address
   where id = v_uid;
  return public.get_my_profile();
end $$;
