-- =====================================================================
-- WeBuy backend | Phần của Nhi | 09. Quyền truy cập.
-- Supabase mặc định cho anon/authenticated mọi quyền trên bảng và hàm mới tạo.
-- File này thu hồi hết, rồi chỉ cấp đúng những gì trình duyệt cần.
-- Chạy file này SAU CÙNG (tên file đã đánh số để đứng cuối).
-- =====================================================================

-- 1) Bảng: trình duyệt chỉ ĐỌC (RLS lọc dòng), mọi thao tác ghi phải qua RPC
revoke all on table
  public.profiles, public.stores, public.categories, public.products, public.stock_holds,
  public.carts, public.cart_items, public.orders, public.order_items, public.notifications,
  public.api_error_logs, public.rate_limits
from anon, authenticated;

grant select on public.categories, public.stores, public.products to anon, authenticated;
grant select on public.profiles, public.stock_holds, public.carts, public.cart_items,
               public.orders, public.order_items, public.notifications, public.api_error_logs
  to authenticated;

-- 2) Hàm: thu hồi toàn bộ, rồi cấp quyền gọi cho các RPC công khai
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'api_error', 'require_user', 'enforce_rate_limit', 'redact_secrets', 'log_client_error',
         'touch_updated_at', 'my_role', 'is_admin', 'handle_new_user', 'get_my_profile', 'update_my_profile',
         'f_unaccent', 'my_store_id', 'require_seller', 'slugify', 'check_store_image_path', 'product_json',
         'search_products', 'get_product', 'list_categories', 'store_json', 'register_seller', 'get_my_store',
         'update_my_store', 'seller_dashboard', 'seller_list_products', 'seller_save_product',
         'seller_set_product_status', 'price_for', 'take_stock', 'close_hold', 'hold_stock', 'release_stock_hold',
         'order_items_immutable', 'order_status_guard', 'order_json', 'release_expired_holds', 'my_cart_id',
         'get_cart', 'add_to_cart', 'set_cart_item_quantity', 'remove_cart_item', 'merge_cart', 'place_order',
         'pay_order_demo', 'cancel_order', 'refund_order_demo', 'get_order', 'list_my_orders', 'notify',
         'notify_order_event', 'notify_store_created', 'get_notifications', 'mark_notifications_read')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Hàm hỗ trợ mà policy RLS / storage policy cần gọi
grant execute on function public.is_admin(), public.my_role(), public.my_store_id() to anon, authenticated;

-- Khách chưa đăng nhập: xem catalog
grant execute on function
  public.search_products(text, text, int, int, text, int, int),
  public.get_product(text),
  public.list_categories(),
  public.log_client_error(text, int, text, text, jsonb)
to anon, authenticated;

-- Người đã đăng nhập
grant execute on function
  public.get_my_profile(),
  public.update_my_profile(text, text, text),
  public.register_seller(text, text, text, text),
  public.get_my_store(),
  public.update_my_store(text, text, text, text, text),
  public.seller_dashboard(),
  public.seller_list_products(),
  public.seller_save_product(text, text, text, text, int, int, int, int, text, public.product_status),
  public.seller_set_product_status(text, public.product_status),
  public.hold_stock(text, int, int),
  public.release_stock_hold(uuid),
  public.get_cart(),
  public.add_to_cart(text, public.purchase_kind, int, text),
  public.set_cart_item_quantity(uuid, int),
  public.remove_cart_item(uuid),
  public.merge_cart(jsonb),
  public.place_order(uuid[], jsonb, uuid),
  public.pay_order_demo(text),
  public.cancel_order(text, text),
  public.refund_order_demo(text),
  public.get_order(text),
  public.list_my_orders(int),
  public.get_notifications(int),
  public.mark_notifications_read(bigint[])
to authenticated;

-- Backend của Hoa (Edge Function chạy bằng service_role) được dùng các hàm nội bộ
grant execute on function public.price_for(text, public.purchase_kind), public.notify(uuid, text, text, text, text, text),
  public.release_expired_holds()
to service_role;
