-- Dùng sau khi đã khóa dòng nhóm. Mọi thao tác trên suất lấy khóa theo cùng thứ tự.
create or replace function public.sync_buying_group(p_group public.buying_groups, p_now timestamptz)
returns public.buying_groups
language plpgsql
set search_path = ''
as $$
declare
  v_group public.buying_groups := p_group;
  v_status text;
  v_locked_at timestamptz := p_group.locked_at;
  v_occupied int;
  v_confirmed int;
  v_slot record;
  v_user uuid;
  v_link text := 'product-detail.html?id=' || p_group.product_id || '&group=' || p_group.id;
begin
  if v_group.status not in ('OPEN','FULL') then return v_group; end if;

  for v_slot in
    update public.group_reservations r set status = 'EXPIRED', closed_at = p_now
     where r.group_id = v_group.id and r.status in ('HOLD','CONFIRMED')
       and (p_now >= v_group.ends_at or (v_locked_at is null and p_now >= r.hold_expires_at))
     returning r.id, r.user_id
  loop
    perform public.notify(v_slot.user_id, 'group-slot:' || v_slot.id || ':expired', 'group',
      case when p_now >= v_group.ends_at then 'Nhóm mua đã hết hạn' else 'Suất mua chung đã hết hạn' end,
      '', v_link);
  end loop;

  if p_now >= v_group.ends_at then
    v_status := 'EXPIRED';
  else
    select count(*), count(*) filter (where status = 'CONFIRMED')
      into v_occupied, v_confirmed from public.group_reservations
     where group_id = v_group.id and status in ('HOLD','CONFIRMED','ORDERED');
    v_status := case when v_occupied = v_group.capacity then 'FULL' else 'OPEN' end;
    if v_locked_at is null and v_confirmed = v_group.capacity then
      v_locked_at := p_now;
      for v_user in
        select user_id from public.group_reservations where group_id = v_group.id and status = 'CONFIRMED'
      loop
        perform public.notify(v_user, 'group:' || v_group.id || ':locked', 'group',
          'Nhóm đã chốt, bạn có thể đặt đơn', '', v_link);
      end loop;
    end if;
  end if;

  if (v_status, v_locked_at) is distinct from (v_group.status, v_group.locked_at) then
    update public.buying_groups set status = v_status, locked_at = v_locked_at,
      closed_at = case when v_status = 'EXPIRED' then p_now end
     where id = v_group.id returning * into v_group;
  end if;
  return v_group;
end $$;

-- Tóm tắt luôn dùng thời gian server, kể cả khi chỉ có lượt đọc và chưa chạy job.
create or replace function public.buying_group_snapshot(p_group public.buying_groups, p_now timestamptz)
returns jsonb
language sql stable
set search_path = ''
as $$
  with slots as (
    select r.*,
      case when r.status in ('HOLD','CONFIRMED')
                and (p_now >= p_group.ends_at or (p_group.locked_at is null and p_now >= r.hold_expires_at))
           then 'EXPIRED' else r.status end as effective_status
      from public.group_reservations r where r.group_id = p_group.id
  ), tally as (
    select count(*) filter (where effective_status in ('HOLD','CONFIRMED','ORDERED')) as occupied,
           count(*) filter (where effective_status in ('CONFIRMED','ORDERED')) as ready
      from slots
  )
  select jsonb_build_object(
    'group', jsonb_build_object(
      'id', p_group.id, 'productId', p_group.product_id, 'regionCode', p_group.region_code,
      'capacity', p_group.capacity, 'occupied', tally.occupied, 'confirmedCount', tally.ready,
      'status', case
        when p_group.status not in ('OPEN','FULL') then p_group.status
        when p_now >= p_group.ends_at then 'EXPIRED'
        when tally.occupied = p_group.capacity then 'FULL' else 'OPEN' end,
      'endsAt', p_group.ends_at, 'lockedAt', p_group.locked_at,
      'canCancel', coalesce(p_group.creator_id = auth.uid() and p_group.locked_at is null
                         and p_group.status in ('OPEN','FULL') and p_now < p_group.ends_at, false)
    ),
    'myReservation', (
      select jsonb_build_object(
        'id', s.id, 'status', s.effective_status, 'unitPriceSnapshot', s.unit_price_snapshot,
        'expiresAt', case when p_group.locked_at is not null then p_group.ends_at else s.hold_expires_at end,
        'orderId', s.order_id
      )
      from slots s where s.user_id = auth.uid()
      order by s.created_at desc, s.id desc limit 1
    ),
    'serverNow', p_now
  ) from tally
$$;

create or replace function public.list_buying_groups(p_product_id text, p_region_code text default null)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('serverNow', statement_timestamp(), 'items',
    coalesce(jsonb_agg(public.buying_group_snapshot(s.group_row, statement_timestamp())
      order by s.is_active desc, s.created_at desc), '[]'::jsonb))
  from (
    select g as group_row, g.created_at,
      g.status in ('OPEN','FULL') and g.ends_at > statement_timestamp() as is_active
    from public.buying_groups g join public.products p on p.id = g.product_id
     where p.id = p_product_id and p.status = 'published'
       and (p_region_code is null or g.region_code = p_region_code)
       and ((g.status in ('OPEN','FULL') and g.ends_at > statement_timestamp()) or exists (
         select 1 from public.group_reservations r where r.group_id = g.id and r.user_id = auth.uid()
       ))
     order by is_active desc, g.created_at desc limit 50
  ) s
$$;

create or replace function public.get_buying_group(p_group_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_group public.buying_groups;
begin
  select g.* into v_group from public.buying_groups g join public.products p on p.id = g.product_id
   where g.id = p_group_id and p.status = 'published';
  if not found then perform public.api_error(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm mua.'); end if;
  return public.buying_group_snapshot(v_group, statement_timestamp());
end $$;

create or replace function public.create_buying_group_slot(p_group public.buying_groups, p_user_id uuid, p_now timestamptz)
returns void
language sql
set search_path = ''
as $$
  insert into public.group_reservations (group_id, user_id, unit_price_snapshot, created_at, hold_expires_at)
  values (p_group.id, p_user_id, public.price_for(p_group.product_id, 'group'), p_now,
          least(p_now + interval '10 minutes', p_group.ends_at))
$$;

create or replace function public.create_buying_group_internal(
  p_user_id uuid, p_product_id text, p_region_code text, p_duration_hours int
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_group public.buying_groups;
  v_capacity int;
  v_now timestamptz;
begin
  if p_region_code is null or p_region_code not in (
    'all','tq','lc','tn','pt','bn','hy','hp','nb','qt','dn','qng','gl','kh','db','hn','ht',
    'ls','lch','na','qn','sl','th','cb','hue','ld','dl','hcm','dna','tni','ct','vl','dt','cm','ag'
  ) then
    perform public.api_error(400, 'INVALID_REGION', 'Khu vực không hợp lệ.');
  end if;
  select min_members into v_capacity from public.products where id = p_product_id and status = 'published';
  if not found then perform public.api_error(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không còn bán.'); end if;

  perform pg_advisory_xact_lock(hashtextextended('buying-group:' || p_product_id || ':' || p_region_code, 0));
  select * into v_group from public.buying_groups
   where product_id = p_product_id and region_code = p_region_code and status in ('OPEN','FULL') for update;
  v_now := clock_timestamp();
  if found then
    v_group := public.sync_buying_group(v_group, v_now);
    if v_group.status in ('OPEN','FULL') then
      perform public.api_error(409, 'GROUP_ALREADY_OPEN', 'Sản phẩm đã có nhóm đang hoạt động ở khu vực này.');
    end if;
  end if;

  insert into public.buying_groups (product_id, creator_id, region_code, capacity, created_at, ends_at)
  values (p_product_id, p_user_id, p_region_code, v_capacity, v_now, v_now + make_interval(hours => p_duration_hours))
  returning * into v_group;
  perform public.create_buying_group_slot(v_group, p_user_id, v_now);
  return public.buying_group_snapshot(v_group, v_now);
end $$;

create or replace function public.join_buying_group_internal(p_user_id uuid, p_group_id uuid, out status int, out body jsonb)
language plpgsql
set search_path = ''
as $$
declare
  v_group public.buying_groups;
  v_now timestamptz;
begin
  select g.* into v_group from public.buying_groups g join public.products p on p.id = g.product_id
   where g.id = p_group_id and p.status = 'published' for update of g;
  if not found then perform public.api_error(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm mua.'); end if;
  v_now := clock_timestamp();
  v_group := public.sync_buying_group(v_group, v_now);
  if v_group.status = 'EXPIRED' then perform public.api_error(409, 'GROUP_EXPIRED', 'Nhóm đã hết hạn.'); end if;
  if v_group.status not in ('OPEN','FULL') then perform public.api_error(409, 'GROUP_CLOSED', 'Nhóm đã đóng.'); end if;
  if exists (select 1 from public.group_reservations r where r.group_id = v_group.id and r.user_id = p_user_id
             and r.status in ('HOLD','CONFIRMED','ORDERED')) then
    status := 200;
  else
    if v_group.status = 'FULL' then perform public.api_error(409, 'FULL', 'Nhóm đã đầy.'); end if;
    perform public.create_buying_group_slot(v_group, p_user_id, v_now);
    v_group := public.sync_buying_group(v_group, v_now);
    status := 201;
  end if;
  body := public.buying_group_snapshot(v_group, v_now);
end $$;

-- Nhận header PostgREST và tham số JSON cho SDK/browser. Nếu gửi cả hai, chúng phải trùng nhau.
create or replace function public.buying_group_request_key(p_request_key uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_header text := nullif(current_setting('request.headers', true), '')::jsonb ->> 'idempotency-key';
  v_key uuid;
begin
  if v_header is not null then
    if v_header !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public.api_error(400, 'INVALID_IDEMPOTENCY_KEY', 'Mã yêu cầu phải là UUID.');
    end if;
    v_key := v_header::uuid;
    if p_request_key is not null and p_request_key <> v_key then
      perform public.api_error(400, 'INVALID_IDEMPOTENCY_KEY', 'Hai mã yêu cầu không khớp.');
    end if;
  end if;
  if coalesce(v_key, p_request_key) is null then
    perform public.api_error(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Thiếu mã yêu cầu.');
  end if;
  return coalesce(v_key, p_request_key);
end $$;

create or replace function public.run_buying_group_request(p_operation text, p_request_key uuid, p_payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_key uuid := public.buying_group_request_key(p_request_key);
  v_request public.idempotency_requests;
  v_status int;
  v_body jsonb;
  v_error_code text;
  v_message text;
  v_detail text;
begin
  insert into public.idempotency_requests (user_id, operation, request_key, request_payload)
  values (v_user, p_operation, v_key, p_payload)
  on conflict (user_id, operation, request_key) do nothing;
  select * into v_request from public.idempotency_requests
   where user_id = v_user and operation = p_operation and request_key = v_key for update;
  if v_request.request_payload <> p_payload then
    perform public.api_error(409, 'IDEMPOTENCY_KEY_REUSED', 'Mã yêu cầu đã dùng cho nội dung khác.');
  end if;
  if v_request.response_status is not null then
    perform set_config('response.status', v_request.response_status::text, true);
    return v_request.response_body;
  end if;

  -- Chỉ commit lỗi nghiệp vụ sau khi khối lồng đã rollback mọi thay đổi của thao tác.
  begin
    if p_operation = 'create' then
      if jsonb_typeof(p_payload -> 'durationHours') is distinct from 'number'
         or (p_payload -> 'durationHours') not in ('1','6','12','24','48','72','168') then
        perform public.api_error(400, 'INVALID_DURATION', 'Hạn nhóm phải là số giờ hợp lệ.');
      end if;
      v_body := public.create_buying_group_internal(v_user, p_payload ->> 'productId', p_payload ->> 'regionCode',
                                                    (p_payload -> 'durationHours')::int);
      v_status := 201;
    else
      select j.status, j.body into v_status, v_body
        from public.join_buying_group_internal(v_user, (p_payload ->> 'groupId')::uuid) j;
    end if;
  exception when sqlstate 'PT400' or sqlstate 'PT404' or sqlstate 'PT409' then
    get stacked diagnostics v_error_code = returned_sqlstate, v_message = message_text, v_detail = pg_exception_detail;
    v_status := substring(v_error_code from 3)::int;
    v_body := jsonb_build_object('code', v_error_code, 'message', v_message, 'details', v_detail, 'hint', null);
  end;

  update public.idempotency_requests set response_status = v_status, response_body = v_body
   where user_id = v_user and operation = p_operation and request_key = v_key;
  perform set_config('response.status', v_status::text, true);
  return v_body;
end $$;

-- Giữ nguyên kiểu JSON tới bước xác thực, kể cả khi client gửi chuỗi trông giống số.
drop function if exists public.create_buying_group(text, text, int, uuid);
create or replace function public.create_buying_group(
  p_product_id text, p_region_code text, p_duration_hours jsonb default null, p_request_key uuid default null
)
returns jsonb
language sql security definer
set search_path = ''
as $$
  select public.run_buying_group_request('create', p_request_key, jsonb_build_object(
    'productId', btrim(p_product_id), 'regionCode', lower(btrim(p_region_code)), 'durationHours', p_duration_hours))
$$;

create or replace function public.join_buying_group(p_group_id uuid, p_request_key uuid default null)
returns jsonb
language sql security definer
set search_path = ''
as $$
  select public.run_buying_group_request('join', p_request_key, jsonb_build_object('groupId', p_group_id))
$$;

create or replace function public.change_group_reservation(p_reservation_id uuid, p_confirm boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_group public.buying_groups;
  v_slot public.group_reservations;
  v_now timestamptz;
begin
  select * into v_slot from public.group_reservations where id = p_reservation_id and user_id = v_user;
  if not found then perform public.api_error(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy suất mua của bạn.'); end if;
  select * into v_group from public.buying_groups where id = v_slot.group_id for update;
  v_now := clock_timestamp();
  v_group := public.sync_buying_group(v_group, v_now);
  select * into v_slot from public.group_reservations where id = p_reservation_id;
  if (p_confirm and v_slot.status = 'CONFIRMED') or (not p_confirm and v_slot.status = 'CANCELLED') then
    return public.buying_group_snapshot(v_group, v_now);
  end if;
  if v_slot.status = 'EXPIRED' then
    perform public.api_error(409, 'RESERVATION_EXPIRED', 'Suất đã hết hạn.');
  end if;
  if v_group.locked_at is not null or v_group.status not in ('OPEN','FULL') or v_slot.status not in ('HOLD','CONFIRMED') then
    perform public.api_error(409, 'RESERVATION_NOT_EDITABLE', 'Suất không thể thay đổi ở trạng thái hiện tại.');
  end if;
  if p_confirm then
    update public.group_reservations set status = 'CONFIRMED', confirmed_at = v_now where id = v_slot.id;
  else
    update public.group_reservations set status = 'CANCELLED', closed_at = v_now where id = v_slot.id;
  end if;
  v_group := public.sync_buying_group(v_group, v_now);
  return public.buying_group_snapshot(v_group, v_now);
end $$;

create or replace function public.confirm_group_reservation(p_reservation_id uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select public.change_group_reservation(p_reservation_id, true) $$;

create or replace function public.cancel_group_reservation(p_reservation_id uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select public.change_group_reservation(p_reservation_id, false) $$;

create or replace function public.cancel_buying_group(p_group_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_group public.buying_groups;
  v_member uuid;
  v_now timestamptz;
begin
  select * into v_group from public.buying_groups where id = p_group_id for update;
  if not found then perform public.api_error(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm mua.'); end if;
  if v_group.creator_id <> v_user then
    perform public.api_error(403, 'NOT_GROUP_CREATOR', 'Chỉ người tạo mới được hủy nhóm.');
  end if;
  v_now := clock_timestamp();
  v_group := public.sync_buying_group(v_group, v_now);
  if v_group.status = 'CANCELLED' then return public.buying_group_snapshot(v_group, v_now); end if;
  if v_group.locked_at is not null or v_group.status not in ('OPEN','FULL') then
    perform public.api_error(409, 'GROUP_NOT_CANCELLABLE', 'Nhóm không thể hủy ở trạng thái hiện tại.');
  end if;
  update public.buying_groups set status = 'CANCELLED', closed_at = v_now
   where id = v_group.id returning * into v_group;
  for v_member in
    update public.group_reservations set status = 'CANCELLED', closed_at = v_now
     where group_id = v_group.id and status in ('HOLD','CONFIRMED') returning user_id
  loop
    perform public.notify(v_member, 'group:' || v_group.id || ':cancelled', 'group', 'Nhóm mua đã bị hủy');
  end loop;
  return public.buying_group_snapshot(v_group, v_now);
end $$;

create or replace function public.expire_buying_groups(p_limit int default 100)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group public.buying_groups;
  v_now timestamptz;
  v_groups int := 0;
  v_slots int := 0;
begin
  for v_group in
    select * from public.buying_groups g where g.status in ('OPEN','FULL') and (
      g.ends_at <= statement_timestamp() or (g.locked_at is null and exists (
        select 1 from public.group_reservations r where r.group_id = g.id and r.status in ('HOLD','CONFIRMED')
          and r.hold_expires_at <= statement_timestamp()
      ))
    ) order by g.id limit least(500, greatest(1, coalesce(p_limit, 100))) for update skip locked
  loop
    v_now := clock_timestamp();
    v_group := public.sync_buying_group(v_group, v_now);
    v_groups := v_groups + (v_group.status = 'EXPIRED')::int;
    v_slots := v_slots + (select count(*) from public.group_reservations
      where group_id = v_group.id and closed_at = v_now and status = 'EXPIRED');
  end loop;
  return jsonb_build_object('expiredGroups', v_groups, 'expiredReservations', v_slots);
end $$;

create or replace function public.health()
returns jsonb language sql stable set search_path = ''
as $$ select jsonb_build_object('status', 'ok') $$;

revoke all on function public.sync_buying_group(public.buying_groups, timestamptz),
  public.buying_group_snapshot(public.buying_groups, timestamptz),
  public.create_buying_group_slot(public.buying_groups, uuid, timestamptz),
  public.create_buying_group_internal(uuid, text, text, int), public.join_buying_group_internal(uuid, uuid),
  public.buying_group_request_key(uuid), public.run_buying_group_request(text, uuid, jsonb),
  public.change_group_reservation(uuid, boolean), public.expire_buying_groups(int), public.health(),
  public.list_buying_groups(text, text), public.get_buying_group(uuid), public.create_buying_group(text, text, jsonb, uuid),
  public.join_buying_group(uuid, uuid), public.confirm_group_reservation(uuid), public.cancel_group_reservation(uuid),
  public.cancel_buying_group(uuid) from public, anon, authenticated;
grant execute on function public.health(), public.list_buying_groups(text, text), public.get_buying_group(uuid)
  to anon, authenticated;
grant execute on function public.create_buying_group(text, text, jsonb, uuid), public.join_buying_group(uuid, uuid),
  public.confirm_group_reservation(uuid), public.cancel_group_reservation(uuid), public.cancel_buying_group(uuid)
  to authenticated;
grant execute on function public.expire_buying_groups(int) to service_role;
