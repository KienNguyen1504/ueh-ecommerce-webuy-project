-- =====================================================================
-- WeBuy backend | Phần của Nhi | 04. Thông báo theo sự kiện thật.
--
-- Checklist: "Thông báo & log lỗi backend" (phần thông báo).
-- Mỗi sự kiện có event_id duy nhất cho từng người, nên 1 sự kiện chỉ sinh đúng 1 thông báo
-- dù trigger/callback chạy lại bao nhiêu lần.
-- =====================================================================

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id text not null check (char_length(event_id) <= 160),
  type text not null check (type in ('order', 'group', 'coin', 'seller', 'system')),
  title text not null check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 400),
  link text check (link is null or link ~ '^[a-z0-9-]+\.html([?#][A-Za-z0-9=&#_.-]*)?$'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_event_unique unique (user_id, event_id)
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));

-- Hàm dùng chung để tạo thông báo. Hoa dùng cho nhóm mua (type 'group'),
-- task Ví Xu sau này dùng cho 'coin'. Trả về false nếu event_id đã có (không gửi trùng).
create or replace function public.notify(p_user_id uuid, p_event_id text, p_type text, p_title text, p_body text default '', p_link text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, event_id, type, title, body, link)
  values (p_user_id, p_event_id, p_type, p_title, coalesce(p_body, ''), p_link)
  on conflict (user_id, event_id) do nothing;
  return found;
end $$;

-- Đơn hàng đổi trạng thái -> thông báo cho người mua; đơn mới -> báo cho người bán có sản phẩm trong đơn
create or replace function public.notify_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_seller record;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;

  v_title := case new.status
    when 'PENDING' then 'Đã tạo đơn ' || new.id
    when 'PAID_DEMO' then 'Đơn ' || new.id || ' đã thanh toán (mô phỏng)'
    when 'CANCELLED' then 'Đơn ' || new.id || ' đã bị hủy'
    when 'REFUNDED_DEMO' then 'Đơn ' || new.id || ' đã hoàn tiền (mô phỏng)'
    else 'Đơn ' || new.id || ' cập nhật trạng thái'
  end;
  v_body := case new.status
    when 'PENDING' then 'Hoàn tất thanh toán mô phỏng trong 15 phút để giữ hàng.'
    when 'CANCELLED' then coalesce(new.cancel_reason, '')
    else ''
  end;

  perform public.notify(new.user_id, 'order:' || new.id || ':' || new.status, 'order', v_title, v_body,
                        'order-payment.html?id=' || new.id);

  if new.status = 'PAID_DEMO' then
    for v_seller in
      select distinct s.owner_id
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        join public.stores s on s.id = p.store_id
       where oi.order_id = new.id and s.owner_id is not null
    loop
      perform public.notify(v_seller.owner_id, 'seller-order:' || new.id || ':PAID_DEMO', 'seller',
                            'Có đơn mới đã thanh toán (mô phỏng)', 'Đơn ' || new.id, 'seller-center.html');
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists orders_notify on public.orders;
create trigger orders_notify after insert or update of status on public.orders
  for each row execute function public.notify_order_event();

-- Người mua lần đầu thành seller -> thông báo chào mừng
create or replace function public.notify_store_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null then
    perform public.notify(new.owner_id, 'store-created:' || new.id, 'seller', 'Cửa hàng ' || new.name || ' đã sẵn sàng',
                          'Bạn có thể đăng sản phẩm đầu tiên trong Seller Center.', 'seller-center.html');
  end if;
  return new;
end $$;
drop trigger if exists stores_notify on public.stores;
create trigger stores_notify after insert on public.stores for each row execute function public.notify_store_created();

create or replace function public.get_notifications(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'unread', (select count(*) from public.notifications where user_id = v_uid and read_at is null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'type', n.type, 'title', n.title, 'body', n.body, 'link', n.link,
               'createdAt', n.created_at, 'read', n.read_at is not null) order by n.created_at desc, n.id desc)
        from (select * from public.notifications where user_id = v_uid
               order by created_at desc, id desc limit least(greatest(coalesce(p_limit, 20), 1), 100)) n
    ), '[]'::jsonb)
  );
end $$;

-- p_ids = null: đánh dấu tất cả là đã đọc
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_user();
begin
  update public.notifications set read_at = now()
   where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
  return public.get_notifications(20);
end $$;
