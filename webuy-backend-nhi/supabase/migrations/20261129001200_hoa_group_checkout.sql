-- group_ref có thể là mã demo cũ. Chỉ mã UUID chuẩn mới trỏ tới nhóm mua trên server.
create or replace function public.buying_group_id(p_ref text)
returns uuid
language sql immutable strict
set search_path = ''
as $$
  select case when p_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_ref::uuid end
$$;

create or replace function public.require_group_checkout_slot(p_user uuid, p_product text, p_group_ref text, p_now timestamptz)
returns public.group_reservations
language plpgsql stable
set search_path = ''
as $$
declare
  v_group public.buying_groups;
  v_slot public.group_reservations;
begin
  select * into v_group from public.buying_groups where id = public.buying_group_id(p_group_ref) and product_id = p_product;
  if not found then perform public.api_error(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm cho sản phẩm này.'); end if;
  select * into v_slot from public.group_reservations where group_id = v_group.id and user_id = p_user
   order by created_at desc, id desc limit 1;
  if not found then perform public.api_error(403, 'RESERVATION_REQUIRED', 'Bạn chưa giữ suất trong nhóm này.'); end if;
  if v_slot.status = 'ORDERED' then
    perform public.api_error(409, 'RESERVATION_ALREADY_ORDERED', 'Suất này đã được đặt đơn.');
  end if;
  if v_group.ends_at <= p_now or v_slot.status = 'EXPIRED' then
    perform public.api_error(409, 'RESERVATION_EXPIRED', 'Suất mua chung đã hết hạn.');
  end if;
  if v_group.locked_at is null or v_group.status <> 'FULL' or v_slot.status <> 'CONFIRMED' then
    perform public.api_error(409, 'GROUP_NOT_READY', 'Nhóm hoặc suất của bạn chưa đủ điều kiện đặt đơn.');
  end if;
  return v_slot;
end $$;

create or replace function public.get_cart()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_cart uuid := public.my_cart_id();
  v_now timestamptz := clock_timestamp();
begin
  return (
    with lines as (
      select ci.*, p.name, p.image_path, p.status, p.stock_available, p.retail_price, p.group_price,
        case when ci.kind = 'group' then r.unit_price_snapshot else p.retail_price end as unit_price,
        p.status = 'published' and case when ci.kind = 'group' then coalesce(
          ci.quantity = 1 and g.status = 'FULL' and g.locked_at is not null and g.ends_at > v_now
            and r.status = 'CONFIRMED', false)
          else p.stock_available >= ci.quantity end as available
      from public.cart_items ci
      join public.products p on p.id = ci.product_id
      left join public.buying_groups g on ci.kind = 'group' and g.id = public.buying_group_id(ci.group_ref) and g.product_id = p.id
      left join lateral (
        select gr.status, gr.unit_price_snapshot from public.group_reservations gr
         where gr.group_id = g.id and gr.user_id = v_uid order by gr.created_at desc, gr.id desc limit 1
      ) r on true
      where ci.cart_id = v_cart
    )
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'productId', l.product_id, 'name', l.name, 'image', l.image_path,
        'kind', l.kind, 'groupId', l.group_ref, 'quantity', l.quantity,
        'unitPrice', l.unit_price, 'retail', l.retail_price,
        'group', case when l.kind = 'group' then l.unit_price else l.group_price end,
        'lineTotal', l.unit_price * l.quantity, 'available', l.available,
        'stockAvailable', l.stock_available, 'addedAt', l.added_at
      ) order by l.added_at), '[]'::jsonb),
      'count', coalesce(sum(l.quantity), 0),
      'subtotal', coalesce(sum(l.unit_price * l.quantity)
        filter (where l.status = 'published' and (l.kind = 'retail' or l.available)), 0)
    ) from lines l
  );
end $$;

create or replace function public.add_to_cart(
  p_product_id text, p_kind public.purchase_kind default 'retail', p_quantity int default 1, p_group_ref text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_cart uuid := public.my_cart_id();
begin
  if p_quantity is null or p_quantity not between 1 and 99 then
    perform public.api_error(400, 'INVALID_QUANTITY', 'Số lượng từ 1 đến 99.');
  end if;
  if not exists (select 1 from public.products where id = p_product_id and status = 'published') then
    perform public.api_error(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng bán.');
  end if;
  if p_kind = 'group' then
    if nullif(btrim(p_group_ref), '') is null then
      perform public.api_error(400, 'GROUP_REQUIRED', 'Mua chung cần chọn nhóm.');
    end if;
    if p_quantity <> 1 then perform public.api_error(400, 'INVALID_GROUP_QUANTITY', 'Mỗi suất mua chung mua một sản phẩm.'); end if;
    perform public.require_group_checkout_slot(v_uid, p_product_id, p_group_ref, clock_timestamp());
  else
    p_group_ref := null;
  end if;
  if (select count(*) from public.cart_items where cart_id = v_cart) >= 50
     and not (p_kind = 'group' and exists (
       select 1 from public.cart_items where cart_id = v_cart and product_id = p_product_id
         and kind = p_kind and group_ref = p_group_ref
     )) then
    perform public.api_error(409, 'CART_FULL', 'Giỏ hàng tối đa 50 dòng sản phẩm.');
  end if;
  insert into public.cart_items as ci (cart_id, product_id, kind, group_ref, quantity)
  values (v_cart, p_product_id, p_kind, p_group_ref, p_quantity)
  on conflict (cart_id, product_id, kind, group_ref)
  do update set quantity = case when ci.kind = 'group' then 1 else least(99, ci.quantity + excluded.quantity) end;
  return public.get_cart();
end $$;

create or replace function public.set_cart_item_quantity(p_item_id uuid, p_quantity int)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_cart uuid := public.my_cart_id();
begin
  if p_quantity is null or p_quantity not between 0 and 99 then
    perform public.api_error(400, 'INVALID_QUANTITY', 'Số lượng từ 0 đến 99.');
  end if;
  if p_quantity > 1 and exists (
    select 1 from public.cart_items where id = p_item_id and cart_id = v_cart and kind = 'group'
  ) then
    perform public.api_error(400, 'INVALID_GROUP_QUANTITY', 'Mỗi suất mua chung mua một sản phẩm.');
  end if;
  if p_quantity = 0 then
    delete from public.cart_items where id = p_item_id and cart_id = v_cart;
  else
    update public.cart_items set quantity = p_quantity where id = p_item_id and cart_id = v_cart;
  end if;
  if not found then perform public.api_error(404, 'CART_ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.'); end if;
  return public.get_cart();
end $$;

-- Giỏ demo được gộp như cũ cho dòng mua lẻ. Mua chung đi qua add_to_cart sau khi nhóm chốt.
create or replace function public.merge_cart(p_items jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cart uuid := public.my_cart_id();
  v_item jsonb;
  v_kind public.purchase_kind;
  v_qty int;
  v_skipped int := 0;
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
      if v_kind = 'group' or not exists (
        select 1 from public.products where id = v_item ->> 'productId' and status = 'published'
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      v_qty := least(99, greatest(1, (v_item ->> 'quantity')::int));
      insert into public.cart_items as ci (cart_id, product_id, kind, group_ref, quantity)
      values (v_cart, v_item ->> 'productId', 'retail', null, v_qty)
      on conflict (cart_id, product_id, kind, group_ref)
      do update set quantity = greatest(ci.quantity, excluded.quantity);
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;
  return public.get_cart() || jsonb_build_object('skipped', v_skipped);
end $$;

-- Đơn tạo trước migration giữ NULL vì giỏ đã được dọn và không thể phục dựng các ID gốc.
alter table public.orders add column if not exists request_cart_item_ids uuid[];

create or replace function public.place_order(p_cart_item_ids uuid[], p_shipping jsonb, p_client_request_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_cart uuid;
  v_existing public.orders;
  v_item_ids uuid[];
  v_order_id text;
  v_line record;
  v_slot public.group_reservations;
  v_unit_price int;
  v_line_total int;
  v_subtotal int := 0;
  v_name text := btrim(coalesce(p_shipping ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p_shipping ->> 'phone', ''), '[\s.-]', '', 'g');
  v_address text := btrim(coalesce(p_shipping ->> 'address', ''));
  v_shipping jsonb := jsonb_build_object('name', v_name, 'phone', v_phone, 'address', v_address);
  v_expires timestamptz := now() + interval '15 minutes';
begin
  if p_client_request_id is null then
    perform public.api_error(400, 'REQUEST_ID_REQUIRED', 'Thiếu mã yêu cầu đặt hàng.');
  end if;
  -- Các dòng được chọn theo tập ID. Thứ tự và ID lặp không đổi nội dung đơn.
  v_item_ids := array(select distinct item from unnest(p_cart_item_ids) as items(item) order by item);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_client_request_id::text, 0));
  select * into v_existing from public.orders where user_id = v_uid and client_request_id = p_client_request_id;
  if found then
    if v_existing.shipping is distinct from v_shipping
       or (v_existing.request_cart_item_ids is not null and v_existing.request_cart_item_ids is distinct from v_item_ids) then
      perform public.api_error(409, 'IDEMPOTENCY_KEY_REUSED', 'Mã yêu cầu đặt đơn đã dùng cho nội dung khác.');
    end if;
    return public.order_json(v_existing.id) || jsonb_build_object('replayed', true);
  end if;
  perform public.enforce_rate_limit('place_order', 10, 60);

  if char_length(v_name) not between 2 and 80 then perform public.api_error(400, 'INVALID_NAME', 'Vui lòng nhập họ tên người nhận.'); end if;
  if v_phone !~ '^\+?[0-9]{9,12}$' then perform public.api_error(400, 'INVALID_PHONE', 'Số điện thoại người nhận không hợp lệ.'); end if;
  if char_length(v_address) not between 5 and 200 then perform public.api_error(400, 'INVALID_ADDRESS', 'Vui lòng nhập địa chỉ nhận hàng.'); end if;
  if cardinality(v_item_ids) = 0 then
    perform public.api_error(400, 'EMPTY_ORDER', 'Hãy chọn ít nhất 1 sản phẩm.');
  end if;
  v_cart := public.my_cart_id();
  if (select count(*) from public.cart_items where cart_id = v_cart and id = any (v_item_ids))
     <> cardinality(v_item_ids) then
    perform public.api_error(400, 'INVALID_CART_ITEMS', 'Có sản phẩm không nằm trong giỏ hàng của bạn.');
  end if;

  -- Khóa các nhóm theo thứ tự cố định trước khi đụng đến tồn kho. Mọi RPC suất lấy khóa nhóm trước.
  perform g.id from public.buying_groups g where g.id in (
    select public.buying_group_id(ci.group_ref) from public.cart_items ci
     where ci.cart_id = v_cart and ci.id = any (v_item_ids) and ci.kind = 'group'
  ) order by g.id for update;
  perform public.release_expired_holds();

  v_order_id := 'WB' || to_char(now(), 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.orders (id, user_id, status, subtotal, total, shipping, client_request_id,
                             request_cart_item_ids, payment_expires_at)
  values (v_order_id, v_uid, 'PENDING', 0, 0, v_shipping, p_client_request_id, v_item_ids, v_expires);

  for v_line in
    select ci.id, ci.product_id, ci.kind, ci.group_ref, ci.quantity
      from public.cart_items ci where ci.cart_id = v_cart and ci.id = any (v_item_ids)
     order by ci.product_id, ci.id for update
  loop
    if v_line.kind = 'group' then
      if v_line.quantity <> 1 then
        perform public.api_error(400, 'INVALID_GROUP_QUANTITY', 'Mỗi suất mua chung mua một sản phẩm.');
      end if;
      v_slot := public.require_group_checkout_slot(v_uid, v_line.product_id, v_line.group_ref, clock_timestamp());
    end if;
    perform public.take_stock(v_line.product_id, v_line.quantity);
    v_unit_price := case when v_line.kind = 'group' then v_slot.unit_price_snapshot
                         else public.price_for(v_line.product_id, v_line.kind) end;
    v_line_total := v_unit_price * v_line.quantity;

    insert into public.stock_holds (product_id, user_id, order_id, quantity, expires_at)
    values (v_line.product_id, v_uid, v_order_id, v_line.quantity, v_expires);
    insert into public.order_items (order_id, product_id, kind, group_ref, quantity, product_name, product_image,
                                    retail_price_snapshot, group_price_snapshot, unit_price, line_total)
    select v_order_id, p.id, v_line.kind, v_line.group_ref, v_line.quantity, p.name, p.image_path,
           p.retail_price, case when v_line.kind = 'group' then v_unit_price else p.group_price end,
           v_unit_price, v_line_total
      from public.products p where p.id = v_line.product_id;
    v_subtotal := v_subtotal + v_line_total;

    if v_line.kind = 'group' then
      update public.group_reservations set status = 'ORDERED', order_id = v_order_id, closed_at = clock_timestamp()
       where id = v_slot.id;
      update public.buying_groups g set status = 'COMPLETED', closed_at = clock_timestamp()
       where g.id = v_slot.group_id and g.capacity = (
         select count(*) from public.group_reservations where group_id = g.id and status = 'ORDERED'
       );
    end if;
  end loop;
  update public.orders set subtotal = v_subtotal, total = v_subtotal where id = v_order_id;
  delete from public.cart_items where cart_id = v_cart and id = any (v_item_ids);
  return public.order_json(v_order_id);
end $$;

revoke all on function public.buying_group_id(text),
  public.require_group_checkout_slot(uuid, text, text, timestamptz) from public, anon, authenticated;
-- CREATE OR REPLACE giữ nguyên grants của năm RPC Nhi từ migration 0900.
