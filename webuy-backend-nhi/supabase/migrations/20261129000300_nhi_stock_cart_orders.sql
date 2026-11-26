-- =====================================================================
-- WeBuy backend | Phần của Nhi | 03. Tồn kho, giỏ hàng, đơn hàng.
--
-- Checklist: "Tồn kho & giữ hàng an toàn", "Giỏ hàng gắn tài khoản",
--            "Chốt giá theo lịch sử đơn/nhóm", "Trạng thái đơn & thanh toán demo".
-- Ghi chú: place_order ở đây chỉ tạo đơn từ giỏ để có dữ liệu cho trạng thái đơn và
-- snapshot giá. Phần trừ Xu khi thanh toán thuộc task "Checkout phía server" (đang tạm hoãn).
-- =====================================================================

do $$ begin
  create type public.purchase_kind as enum ('retail', 'group');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.hold_status as enum ('HELD', 'RELEASED', 'CONSUMED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_status as enum ('DRAFT', 'PENDING', 'PAID_DEMO', 'CANCELLED', 'REFUNDED_DEMO');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Giá áp dụng cho 1 sản phẩm theo hình thức mua, luôn lấy từ database.
-- Hoa có thể gọi hàm này khi tạo group_reservations để lưu snapshot giá nhóm.
-- ---------------------------------------------------------------------
create or replace function public.price_for(p_product_id text, p_kind public.purchase_kind)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_kind = 'group' then group_price else retail_price end
    from public.products where id = p_product_id
$$;

-- =====================================================================
-- TỒN KHO
-- Quy tắc: available = còn bán được; held = đang giữ cho đơn chưa thanh toán; sold = đã bán.
--   Giữ hàng:      available -= n, held += n     (chỉ khi available >= n, làm trong 1 câu UPDATE)
--   Thanh toán:    held -= n,      sold += n
--   Hủy/hết hạn:   held -= n,      available += n
-- Câu UPDATE có điều kiện "stock_available >= n" nên 2 người tranh 1 sản phẩm cuối cùng
-- thì chỉ 1 người thành công: Postgres khóa dòng, người thứ 2 đọc lại số mới (0) và bị từ chối.
-- =====================================================================
create table if not exists public.stock_holds (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id text,
  quantity int not null check (quantity between 1 and 99),
  status public.hold_status not null default 'HELD',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists stock_holds_expiring_idx on public.stock_holds (expires_at) where status = 'HELD';
create index if not exists stock_holds_order_idx on public.stock_holds (order_id);
alter table public.stock_holds enable row level security;
drop policy if exists stock_holds_own on public.stock_holds;
create policy stock_holds_own on public.stock_holds for select to authenticated using (user_id = (select auth.uid()));

-- Trừ tồn kho có điều kiện. Dùng nội bộ (không cấp quyền gọi trực tiếp cho trình duyệt).
create or replace function public.take_stock(p_product_id text, p_quantity int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  update public.products
     set stock_available = stock_available - p_quantity,
         stock_held = stock_held + p_quantity
   where id = p_product_id
     and status = 'published'
     and stock_available >= p_quantity;
  if found then return; end if;

  select name into v_name from public.products where id = p_product_id and status = 'published';
  if v_name is null then
    perform public.api_error(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng bán.');
  end if;
  perform public.api_error(409, 'OUT_OF_STOCK', 'Sản phẩm "' || v_name || '" không còn đủ hàng.');
end $$;

-- Đóng 1 lượt giữ hàng: RELEASED (trả về kho) hoặc CONSUMED (đã bán)
create or replace function public.close_hold(p_hold_id uuid, p_result public.hold_status)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_hold public.stock_holds;
begin
  update public.stock_holds
     set status = p_result, closed_at = now()
   where id = p_hold_id and status = 'HELD'
  returning * into v_hold;
  if v_hold.id is null then return false; end if; -- đã đóng trước đó: không trả kho 2 lần

  if p_result = 'CONSUMED' then
    update public.products set stock_held = stock_held - v_hold.quantity, stock_sold = stock_sold + v_hold.quantity
     where id = v_hold.product_id;
  else
    update public.products set stock_held = stock_held - v_hold.quantity, stock_available = stock_available + v_hold.quantity
     where id = v_hold.product_id;
  end if;
  return true;
end $$;

-- Giữ hàng không gắn đơn (VD: giữ chỗ khi tham gia nhóm). Mặc định giữ 10 phút.
create or replace function public.hold_stock(p_product_id text, p_quantity int, p_minutes int default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_hold public.stock_holds;
begin
  perform public.enforce_rate_limit('hold_stock', 30, 60);
  if p_quantity is null or p_quantity not between 1 and 20 then
    perform public.api_error(400, 'INVALID_QUANTITY', 'Số lượng giữ từ 1 đến 20.');
  end if;
  if p_minutes is null or p_minutes not between 1 and 60 then
    perform public.api_error(400, 'INVALID_HOLD_TIME', 'Thời gian giữ từ 1 đến 60 phút.');
  end if;

  perform public.release_expired_holds();
  perform public.take_stock(p_product_id, p_quantity);

  insert into public.stock_holds (product_id, user_id, quantity, expires_at)
  values (p_product_id, v_uid, p_quantity, now() + make_interval(mins => p_minutes))
  returning * into v_hold;

  return jsonb_build_object('id', v_hold.id, 'productId', v_hold.product_id, 'quantity', v_hold.quantity,
                            'status', v_hold.status, 'expiresAt', v_hold.expires_at);
end $$;

create or replace function public.release_stock_hold(p_hold_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_hold public.stock_holds;
begin
  select * into v_hold from public.stock_holds where id = p_hold_id for update;
  if v_hold.id is null or v_hold.user_id <> v_uid then
    perform public.api_error(404, 'HOLD_NOT_FOUND', 'Không tìm thấy lượt giữ hàng.');
  end if;
  if v_hold.order_id is not null then
    perform public.api_error(409, 'HOLD_BELONGS_TO_ORDER', 'Lượt giữ này thuộc một đơn hàng, hãy hủy đơn thay vì hủy giữ.');
  end if;
  return jsonb_build_object('released', public.close_hold(p_hold_id, 'RELEASED'));
end $$;

-- =====================================================================
-- ĐƠN HÀNG
-- =====================================================================
create table if not exists public.orders (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.order_status not null default 'PENDING',
  subtotal int not null check (subtotal >= 0),
  discount int not null default 0 check (discount >= 0),
  total int not null check (total >= 0),
  shipping jsonb not null default '{}'::jsonb,
  client_request_id uuid not null,
  payment_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  -- Cùng một lần bấm "Xác nhận" (cùng request id) gửi nhiều lần vẫn chỉ ra 1 đơn
  constraint orders_request_unique unique (user_id, client_request_id)
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
alter table public.orders enable row level security;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

drop policy if exists orders_own on public.orders;
create policy orders_own on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Snapshot giá: lưu giá lẻ, giá nhóm và đơn giá tại lúc đặt. Seller đổi giá sau đó không ảnh hưởng đơn cũ.
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id),
  kind public.purchase_kind not null,
  group_ref text,
  quantity int not null check (quantity between 1 and 99),
  product_name text not null,
  product_image text,
  retail_price_snapshot int not null,
  group_price_snapshot int not null,
  unit_price int not null check (unit_price > 0),
  line_total int not null check (line_total = unit_price * quantity)
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
alter table public.order_items enable row level security;
drop policy if exists order_items_own on public.order_items;
create policy order_items_own on public.order_items for select to authenticated
  using (order_id in (select o.id from public.orders o where o.user_id = (select auth.uid())) or (select public.is_admin()));

-- Không ai được sửa giá đã chốt trong order_items, kể cả qua hàm nội bộ
create or replace function public.order_items_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'order_items là dữ liệu đã chốt, không được sửa';
end $$;
drop trigger if exists order_items_no_update on public.order_items;
create trigger order_items_no_update before update on public.order_items
  for each row execute function public.order_items_immutable();

-- Chỉ cho phép đổi trạng thái theo đúng sơ đồ:
--   DRAFT -> PENDING | CANCELLED
--   PENDING -> PAID_DEMO | CANCELLED
--   PAID_DEMO -> REFUNDED_DEMO
--   CANCELLED, REFUNDED_DEMO: trạng thái cuối
create or replace function public.order_status_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  if not (
       (old.status = 'DRAFT' and new.status in ('PENDING', 'CANCELLED'))
    or (old.status = 'PENDING' and new.status in ('PAID_DEMO', 'CANCELLED'))
    or (old.status = 'PAID_DEMO' and new.status = 'REFUNDED_DEMO')
  ) then
    perform public.api_error(409, 'INVALID_STATUS_CHANGE',
      'Không thể chuyển đơn từ ' || old.status || ' sang ' || new.status || '.');
  end if;
  return new;
end $$;
drop trigger if exists orders_status_guard on public.orders;
create trigger orders_status_guard before update of status on public.orders
  for each row execute function public.order_status_guard();

create or replace function public.order_json(p_order_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'subtotal', o.subtotal,
    'discount', o.discount,
    'total', o.total,
    'shipping', o.shipping,
    'createdAt', o.created_at,
    'paymentExpiresAt', o.payment_expires_at,
    'paidAt', o.paid_at,
    'cancelledAt', o.cancelled_at,
    'refundedAt', o.refunded_at,
    'cancelReason', o.cancel_reason,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                'productId', i.product_id, 'name', i.product_name, 'image', i.product_image,
                'kind', i.kind, 'groupId', i.group_ref, 'quantity', i.quantity,
                'unitPrice', i.unit_price, 'retailPrice', i.retail_price_snapshot,
                'groupPrice', i.group_price_snapshot, 'lineTotal', i.line_total) order by i.id)
              from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o where o.id = p_order_id
$$;

-- Hết hạn giữ hàng: trả hàng về kho và hủy đơn PENDING quá hạn thanh toán.
-- Gọi định kỳ (pg_cron mỗi phút, xem cuối file) và gọi kèm trước mỗi lần giữ hàng/đặt hàng.
create or replace function public.release_expired_holds()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold record;
  v_count int := 0;
begin
  for v_hold in
    select id from public.stock_holds
     where status = 'HELD' and expires_at < now()
     order by expires_at
     limit 500
     for update skip locked
  loop
    if public.close_hold(v_hold.id, 'RELEASED') then v_count := v_count + 1; end if;
  end loop;

  update public.orders
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'Hết hạn thanh toán'
   where status = 'PENDING' and payment_expires_at < now();

  return v_count;
end $$;

-- =====================================================================
-- GIỎ HÀNG GẮN TÀI KHOẢN
-- Cùng sản phẩm + cùng hình thức mua (+ cùng nhóm) chỉ có 1 dòng, thêm nữa thì cộng số lượng.
-- Giá KHÔNG lưu trong giỏ: lúc nào đọc giỏ cũng tính lại từ bảng products.
-- =====================================================================
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.carts enable row level security;
drop policy if exists carts_own on public.carts;
create policy carts_own on public.carts for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  kind public.purchase_kind not null default 'retail',
  group_ref text check (group_ref is null or char_length(group_ref) <= 80),
  quantity int not null check (quantity between 1 and 99),
  added_at timestamptz not null default now(),
  constraint cart_items_group_needs_ref check (kind = 'retail' or group_ref is not null),
  constraint cart_items_one_line unique nulls not distinct (cart_id, product_id, kind, group_ref)
);
alter table public.cart_items enable row level security;
drop policy if exists cart_items_own on public.cart_items;
create policy cart_items_own on public.cart_items for select to authenticated
  using (cart_id in (select c.id from public.carts c where c.user_id = (select auth.uid())));

create or replace function public.my_cart_id()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_id uuid;
begin
  insert into public.carts (user_id) values (v_uid)
  on conflict (user_id) do update set updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.get_cart()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_cart uuid := public.my_cart_id();
begin
  return (
    with lines as (
      select ci.id, ci.product_id, ci.kind, ci.group_ref, ci.quantity, ci.added_at,
             p.name, p.image_path, p.status, p.stock_available, p.retail_price, p.group_price,
             case when ci.kind = 'group' then p.group_price else p.retail_price end as unit_price
        from public.cart_items ci
        join public.products p on p.id = ci.product_id
       where ci.cart_id = v_cart
    )
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(jsonb_build_object(
          'id', l.id, 'productId', l.product_id, 'name', l.name, 'image', l.image_path,
          'kind', l.kind, 'groupId', l.group_ref, 'quantity', l.quantity,
          'unitPrice', l.unit_price, 'retail', l.retail_price, 'group', l.group_price,
          'lineTotal', l.unit_price * l.quantity,
          'available', l.status = 'published' and l.stock_available >= l.quantity,
          'stockAvailable', l.stock_available,
          'addedAt', l.added_at) order by l.added_at), '[]'::jsonb),
      'count', coalesce(sum(l.quantity), 0),
      'subtotal', coalesce(sum(l.unit_price * l.quantity) filter (where l.status = 'published'), 0)
    )
    from lines l
  );
end $$;

create or replace function public.add_to_cart(p_product_id text, p_kind public.purchase_kind default 'retail', p_quantity int default 1, p_group_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_cart uuid := public.my_cart_id();
begin
  if p_quantity is null or p_quantity not between 1 and 99 then
    perform public.api_error(400, 'INVALID_QUANTITY', 'Số lượng từ 1 đến 99.');
  end if;
  if p_kind = 'group' and nullif(btrim(coalesce(p_group_ref, '')), '') is null then
    perform public.api_error(400, 'GROUP_REQUIRED', 'Mua chung cần chọn nhóm.');
  end if;
  if p_kind = 'retail' then p_group_ref := null; end if;
  if not exists (select 1 from public.products where id = p_product_id and status = 'published') then
    perform public.api_error(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng bán.');
  end if;
  if (select count(*) from public.cart_items where cart_id = v_cart) >= 50 then
    perform public.api_error(409, 'CART_FULL', 'Giỏ hàng tối đa 50 dòng sản phẩm.');
  end if;

  insert into public.cart_items as ci (cart_id, product_id, kind, group_ref, quantity)
  values (v_cart, p_product_id, p_kind, p_group_ref, p_quantity)
  on conflict (cart_id, product_id, kind, group_ref)
  do update set quantity = least(99, ci.quantity + excluded.quantity);

  return public.get_cart();
end $$;

create or replace function public.set_cart_item_quantity(p_item_id uuid, p_quantity int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_cart uuid := public.my_cart_id();
begin
  if p_quantity is null or p_quantity not between 0 and 99 then
    perform public.api_error(400, 'INVALID_QUANTITY', 'Số lượng từ 0 đến 99.');
  end if;
  if p_quantity = 0 then
    delete from public.cart_items where id = p_item_id and cart_id = v_cart;
  else
    update public.cart_items set quantity = p_quantity where id = p_item_id and cart_id = v_cart;
  end if;
  if not found then perform public.api_error(404, 'CART_ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.'); end if;
  return public.get_cart();
end $$;

create or replace function public.remove_cart_item(p_item_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.set_cart_item_quantity(p_item_id, 0)
$$;

-- Gộp giỏ localStorage khi đăng nhập.
-- p_items: [{ "productId": "1", "kind": "retail", "quantity": 2, "groupId": null }, ...]
-- Quy tắc tránh nhân đôi: nếu dòng đã có trên server thì lấy số lượng LỚN HƠN (không cộng),
-- nên đăng nhập/gộp lại nhiều lần vẫn ra cùng kết quả. Dòng sai hoặc sản phẩm ngừng bán bị bỏ qua.
create or replace function public.merge_cart(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart uuid := public.my_cart_id();
  v_item jsonb;
  v_kind public.purchase_kind;
  v_qty int;
  v_group text;
  v_skipped int := 0;
  v_result jsonb;
begin
  perform public.enforce_rate_limit('merge_cart', 20, 60);
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    perform public.api_error(400, 'INVALID_ITEMS', 'Dữ liệu giỏ hàng không hợp lệ.');
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 50 then
    perform public.api_error(400, 'TOO_MANY_ITEMS', 'Giỏ hàng tối đa 50 dòng.');
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      v_kind := coalesce(nullif(v_item ->> 'kind', ''), 'retail')::public.purchase_kind;
      v_qty := least(99, greatest(1, (v_item ->> 'quantity')::int));
      v_group := case when v_kind = 'group' then nullif(btrim(coalesce(v_item ->> 'groupId', '')), '') end;
      if v_kind = 'group' and v_group is null then raise exception 'thiếu nhóm'; end if;
      if not exists (select 1 from public.products where id = v_item ->> 'productId' and status = 'published') then
        raise exception 'sản phẩm không bán';
      end if;

      insert into public.cart_items as ci (cart_id, product_id, kind, group_ref, quantity)
      values (v_cart, v_item ->> 'productId', v_kind, v_group, v_qty)
      on conflict (cart_id, product_id, kind, group_ref)
      do update set quantity = greatest(ci.quantity, excluded.quantity);
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  v_result := public.get_cart();
  return v_result || jsonb_build_object('skipped', v_skipped);
end $$;

-- =====================================================================
-- ĐẶT HÀNG TỪ GIỎ (tính lại mọi thứ từ database, không nhận giá/tổng tiền từ trình duyệt)
-- p_shipping: { "name": "...", "phone": "...", "address": "..." }
-- p_client_request_id: frontend tạo 1 UUID cho mỗi lần bấm "Xác nhận" và gửi lại đúng UUID đó khi retry.
-- =====================================================================
create or replace function public.place_order(p_cart_item_ids uuid[], p_shipping jsonb, p_client_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_cart uuid;
  v_existing text;
  v_order_id text;
  v_line record;
  v_subtotal int := 0;
  v_count int := 0;
  v_name text := btrim(coalesce(p_shipping ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p_shipping ->> 'phone', ''), '[\s.-]', '', 'g');
  v_address text := btrim(coalesce(p_shipping ->> 'address', ''));
  v_expires timestamptz := now() + interval '15 minutes';
begin
  if p_client_request_id is null then
    perform public.api_error(400, 'REQUEST_ID_REQUIRED', 'Thiếu mã yêu cầu đặt hàng.');
  end if;

  -- Gửi lại cùng request id: trả về đơn đã tạo, không tạo đơn thứ 2
  select id into v_existing from public.orders where user_id = v_uid and client_request_id = p_client_request_id;
  if v_existing is not null then return public.order_json(v_existing) || jsonb_build_object('replayed', true); end if;

  perform public.enforce_rate_limit('place_order', 10, 60);
  -- Khóa theo user để 2 tab bấm cùng lúc với cùng request id không chạy song song
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_client_request_id::text, 0));
  select id into v_existing from public.orders where user_id = v_uid and client_request_id = p_client_request_id;
  if v_existing is not null then return public.order_json(v_existing) || jsonb_build_object('replayed', true); end if;

  if char_length(v_name) not between 2 and 80 then perform public.api_error(400, 'INVALID_NAME', 'Vui lòng nhập họ tên người nhận.'); end if;
  if v_phone !~ '^\+?[0-9]{9,12}$' then perform public.api_error(400, 'INVALID_PHONE', 'Số điện thoại người nhận không hợp lệ.'); end if;
  if char_length(v_address) not between 5 and 200 then perform public.api_error(400, 'INVALID_ADDRESS', 'Vui lòng nhập địa chỉ nhận hàng.'); end if;
  if p_cart_item_ids is null or cardinality(p_cart_item_ids) = 0 then
    perform public.api_error(400, 'EMPTY_ORDER', 'Hãy chọn ít nhất 1 sản phẩm.');
  end if;

  perform public.release_expired_holds();
  v_cart := public.my_cart_id();

  -- Mọi id gửi lên phải là dòng trong giỏ của chính người này
  if (select count(*) from public.cart_items where cart_id = v_cart and id = any (p_cart_item_ids))
     <> (select count(distinct x) from unnest(p_cart_item_ids) as x) then
    perform public.api_error(400, 'INVALID_CART_ITEMS', 'Có sản phẩm không nằm trong giỏ hàng của bạn.');
  end if;

  v_order_id := 'WB' || to_char(now(), 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.orders (id, user_id, status, subtotal, total, shipping, client_request_id, payment_expires_at)
  values (v_order_id, v_uid, 'PENDING', 0, 0,
          jsonb_build_object('name', v_name, 'phone', v_phone, 'address', v_address),
          p_client_request_id, v_expires);

  for v_line in
    select ci.id, ci.product_id, ci.kind, ci.group_ref, ci.quantity
      from public.cart_items ci
     where ci.cart_id = v_cart and ci.id = any (p_cart_item_ids)
     order by ci.product_id
     for update
  loop
    perform public.take_stock(v_line.product_id, v_line.quantity); -- lỗi 409 ở đây sẽ hủy toàn bộ giao dịch

    insert into public.stock_holds (product_id, user_id, order_id, quantity, expires_at)
    values (v_line.product_id, v_uid, v_order_id, v_line.quantity, v_expires);

    insert into public.order_items (order_id, product_id, kind, group_ref, quantity, product_name, product_image,
                                    retail_price_snapshot, group_price_snapshot, unit_price, line_total)
    select v_order_id, p.id, v_line.kind, v_line.group_ref, v_line.quantity, p.name, p.image_path,
           p.retail_price, p.group_price,
           case when v_line.kind = 'group' then p.group_price else p.retail_price end,
           (case when v_line.kind = 'group' then p.group_price else p.retail_price end) * v_line.quantity
      from public.products p where p.id = v_line.product_id;

    v_subtotal := v_subtotal + public.price_for(v_line.product_id, v_line.kind) * v_line.quantity;
    v_count := v_count + 1;
  end loop;

  update public.orders set subtotal = v_subtotal, total = v_subtotal where id = v_order_id;
  delete from public.cart_items where cart_id = v_cart and id = any (p_cart_item_ids);

  return public.order_json(v_order_id);
end $$;

-- Thanh toán MÔ PHỎNG: không có tiền thật. Gọi lại khi đơn đã PAID_DEMO thì trả về đơn như cũ.
create or replace function public.pay_order_demo(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_order public.orders;
  v_hold record;
begin
  perform public.release_expired_holds();
  select * into v_order from public.orders where id = p_order_id and user_id = v_uid for update;
  if v_order.id is null then perform public.api_error(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.'); end if;
  if v_order.status = 'PAID_DEMO' then return public.order_json(p_order_id); end if;
  if v_order.status <> 'PENDING' then
    perform public.api_error(409, 'ORDER_NOT_PAYABLE', 'Đơn ở trạng thái ' || v_order.status || ' nên không thể thanh toán.');
  end if;

  for v_hold in select id from public.stock_holds where order_id = p_order_id and status = 'HELD' loop
    perform public.close_hold(v_hold.id, 'CONSUMED');
  end loop;
  update public.orders set status = 'PAID_DEMO', paid_at = now() where id = p_order_id;
  return public.order_json(p_order_id);
end $$;

create or replace function public.cancel_order(p_order_id text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_order public.orders;
  v_hold record;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = v_uid for update;
  if v_order.id is null then perform public.api_error(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.'); end if;
  if v_order.status = 'CANCELLED' then return public.order_json(p_order_id); end if;
  if v_order.status not in ('DRAFT', 'PENDING') then
    perform public.api_error(409, 'ORDER_NOT_CANCELLABLE', 'Đơn đã thanh toán, hãy dùng hoàn tiền mô phỏng.');
  end if;

  for v_hold in select id from public.stock_holds where order_id = p_order_id and status = 'HELD' loop
    perform public.close_hold(v_hold.id, 'RELEASED');
  end loop;
  update public.orders
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Người mua hủy'), 200)
   where id = p_order_id;
  return public.order_json(p_order_id);
end $$;

-- Hoàn tiền MÔ PHỎNG cho đơn đã PAID_DEMO: trả hàng về kho
create or replace function public.refund_order_demo(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_order public.orders;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id and (user_id = v_uid or public.is_admin()) for update;
  if v_order.id is null then perform public.api_error(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.'); end if;
  if v_order.status = 'REFUNDED_DEMO' then return public.order_json(p_order_id); end if;
  if v_order.status <> 'PAID_DEMO' then
    perform public.api_error(409, 'ORDER_NOT_REFUNDABLE', 'Chỉ hoàn tiền được đơn đã thanh toán mô phỏng.');
  end if;

  for v_item in select product_id, sum(quantity)::int as q from public.order_items where order_id = p_order_id group by product_id loop
    update public.products set stock_sold = greatest(0, stock_sold - v_item.q), stock_available = stock_available + v_item.q
     where id = v_item.product_id;
  end loop;
  update public.orders set status = 'REFUNDED_DEMO', refunded_at = now() where id = p_order_id;
  return public.order_json(p_order_id);
end $$;

create or replace function public.get_order(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_user();
begin
  perform public.release_expired_holds();
  if not exists (select 1 from public.orders where id = p_order_id and (user_id = v_uid or public.is_admin())) then
    perform public.api_error(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  end if;
  return public.order_json(p_order_id);
end $$;

create or replace function public.list_my_orders(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_user();
begin
  perform public.release_expired_holds();
  return coalesce((
    select jsonb_agg(public.order_json(o.id) order by o.created_at desc)
      from (select id, created_at from public.orders where user_id = v_uid
             order by created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 100)) o
  ), '[]'::jsonb);
end $$;

-- Tự giải phóng hàng hết hạn mỗi phút nếu Supabase đã bật pg_cron (Database > Extensions > pg_cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'webuy-release-expired-holds';
    perform cron.schedule('webuy-release-expired-holds', '* * * * *', 'select public.release_expired_holds()');
  end if;
end $$;
