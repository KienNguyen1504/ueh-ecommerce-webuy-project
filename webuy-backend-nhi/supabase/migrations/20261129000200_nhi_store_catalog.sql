-- =====================================================================
-- WeBuy backend | Phần của Nhi | 02. Cửa hàng, danh mục, sản phẩm.
--
-- Checklist: "API cửa hàng & quyền seller", "Chuyển catalog cũ lên database",
--            "API tìm/lọc/sắp xếp sản phẩm", "CRUD sản phẩm & ảnh theo seller".
-- Mọi thao tác GHI đi qua hàm RPC (security definer) có kiểm tra quyền theo UID thật.
-- Trình duyệt chỉ được SELECT trực tiếp, và RLS lọc dữ liệu được phép xem.
-- =====================================================================

do $$ begin
  create type public.product_status as enum ('draft', 'published', 'hidden');
exception when duplicate_object then null; end $$;

-- So khớp tiếng Việt không dấu: "balo" tìm được "Balô", "trang suc" tìm được "Trang sức"
create or replace function public.f_unaccent(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, '')))
$$;

-- ---------------------------------------------------------------------
-- Cửa hàng: mỗi seller có 1 cửa hàng. owner_id = null là cửa hàng hệ thống (WeBuy Official, dữ liệu seed).
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,90}$'),
  description text not null default '' check (char_length(description) <= 500),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9]{9,12}$'),
  address text not null default '' check (char_length(address) <= 200),
  logo_path text check (logo_path is null or char_length(logo_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stores enable row level security;
drop trigger if exists stores_touch on public.stores;
create trigger stores_touch before update on public.stores for each row execute function public.touch_updated_at();

drop policy if exists stores_public_read on public.stores;
create policy stores_public_read on public.stores for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- Danh mục
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null unique,
  sort_order int not null default 0
);
alter table public.categories enable row level security;
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- Sản phẩm
-- id dạng text để giữ nguyên ID cũ "1".."8" mà link product-detail.html?id=... đang dùng.
-- Tồn kho chia 3 cột: available (còn bán) / held (đang giữ cho đơn chưa thanh toán) / sold (đã bán).
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,140}$'),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id text not null references public.categories (id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  retail_price int not null check (retail_price > 0 and retail_price <= 1000000000),
  group_price int not null check (group_price > 0),
  min_members int not null default 2 check (min_members between 2 and 50),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  badge text not null default '' check (char_length(badge) <= 40),
  status public.product_status not null default 'draft',
  stock_available int not null default 0 check (stock_available >= 0),
  stock_held int not null default 0 check (stock_held >= 0),
  stock_sold int not null default 0 check (stock_sold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint products_group_le_retail check (group_price <= retail_price)
);
create index if not exists products_catalog_idx on public.products (status, category_id, retail_price);
create index if not exists products_store_idx on public.products (store_id);
alter table public.products enable row level security;
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- Người mua chỉ thấy sản phẩm published. Chủ cửa hàng thấy cả draft/hidden của mình.
drop policy if exists products_read on public.products;
create policy products_read on public.products for select to anon, authenticated
  using (
    status = 'published'
    or store_id in (select s.id from public.stores s where s.owner_id = (select auth.uid()))
    or (select public.is_admin())
  );

-- Cửa hàng của người đang gọi (null nếu chưa là seller)
create or replace function public.my_store_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.stores where owner_id = auth.uid()
$$;

-- Bắt buộc là seller có cửa hàng; trả về store_id
create or replace function public.require_seller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_store uuid;
begin
  if public.my_role() not in ('seller', 'admin') then
    perform public.api_error(403, 'SELLER_ONLY', 'Chỉ người bán mới dùng được chức năng này.');
  end if;
  select id into v_store from public.stores where owner_id = v_uid;
  if v_store is null then
    perform public.api_error(403, 'STORE_REQUIRED', 'Bạn cần đăng ký cửa hàng trước.');
  end if;
  return v_store;
end $$;

-- Tạo slug từ tên: "Balo canvas Everyday" -> "balo-canvas-everyday"
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(public.f_unaccent(replace(replace(p_text, 'đ', 'd'), 'Đ', 'D')), '[^a-z0-9]+', '-', 'g'))
$$;

-- ---------------------------------------------------------------------
-- Ảnh lưu ở Supabase Storage, bucket "store-assets".
-- Đường dẫn bắt buộc bắt đầu bằng id cửa hàng: {store_id}/logo/... hoặc {store_id}/products/...
-- Giới hạn 2 MB, chỉ nhận JPEG/PNG/WebP. Chỉ chủ cửa hàng ghi được vào thư mục của mình.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-assets', 'store-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists store_assets_public_read on storage.objects;
create policy store_assets_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'store-assets');

drop policy if exists store_assets_owner_insert on storage.objects;
create policy store_assets_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = (select public.my_store_id())::text
    and lower(name) ~ '\.(jpe?g|png|webp)$'
  );

drop policy if exists store_assets_owner_update on storage.objects;
create policy store_assets_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select public.my_store_id())::text)
  with check (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select public.my_store_id())::text);

drop policy if exists store_assets_owner_delete on storage.objects;
create policy store_assets_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select public.my_store_id())::text);

-- Kiểm tra đường dẫn ảnh do seller gửi lên: phải nằm trong thư mục cửa hàng của chính họ
create or replace function public.check_store_image_path(p_store uuid, p_path text, p_folder text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_path is null or btrim(p_path) = '' then return null; end if;
  if p_path !~ ('^' || p_store::text || '/' || p_folder || '/[A-Za-z0-9._-]{1,120}\.(jpe?g|png|webp)$') then
    perform public.api_error(400, 'INVALID_IMAGE_PATH', 'Ảnh phải là JPG, PNG hoặc WebP và được tải lên thư mục của cửa hàng bạn.');
  end if;
  return p_path;
end $$;

-- ---------------------------------------------------------------------
-- Định dạng 1 sản phẩm thành JSON cho frontend (tên trường giống catalog-data.js cũ)
-- ---------------------------------------------------------------------
create or replace function public.product_json(p public.products)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'name', p.name,
    'description', p.description,
    'price', p.retail_price,
    'retail', p.retail_price,
    'group', p.group_price,
    'minMembers', p.min_members,
    'category', c.name,
    'categoryId', p.category_id,
    'image', p.image_path,
    'badge', p.badge,
    'status', p.status,
    'stock', jsonb_build_object('available', p.stock_available, 'held', p.stock_held, 'sold', p.stock_sold),
    'inStock', p.stock_available > 0,
    'store', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug),
    'updatedAt', p.updated_at
  )
  from public.categories c, public.stores s
  where c.id = p.category_id and s.id = p.store_id
$$;

-- ---------------------------------------------------------------------
-- GET /products  ->  rpc('search_products', {...})
-- q, category (id hoặc tên), priceMin, priceMax (theo giá mua lẻ), sort, page, pageSize.
-- Trả { items, total, page, pageSize, totalPages }.
-- ---------------------------------------------------------------------
create or replace function public.search_products(
  p_q text default null,
  p_category text default null,
  p_price_min int default null,
  p_price_max int default null,
  p_sort text default 'newest',
  p_page int default 1,
  p_page_size int default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_cat text := nullif(btrim(coalesce(p_category, '')), '');
  v_cat_id text;
  v_total int;
  v_items jsonb;
begin
  p_sort := coalesce(nullif(p_sort, ''), 'newest');
  p_page := coalesce(p_page, 1);
  p_page_size := coalesce(p_page_size, 12);

  if v_q is not null and char_length(v_q) > 100 then perform public.api_error(400, 'INVALID_QUERY', 'Từ khóa tối đa 100 ký tự.'); end if;
  if p_sort not in ('newest', 'price_asc', 'price_desc', 'name_asc', 'popular') then
    perform public.api_error(400, 'INVALID_SORT', 'Kiểu sắp xếp không hợp lệ.');
  end if;
  if p_page < 1 or p_page > 1000 then perform public.api_error(400, 'INVALID_PAGE', 'Số trang không hợp lệ.'); end if;
  if p_page_size < 1 or p_page_size > 48 then perform public.api_error(400, 'INVALID_PAGE_SIZE', 'Mỗi trang có từ 1 đến 48 sản phẩm.'); end if;
  if p_price_min is not null and p_price_min < 0 then perform public.api_error(400, 'INVALID_PRICE', 'Giá thấp nhất không được âm.'); end if;
  if p_price_max is not null and p_price_max < 0 then perform public.api_error(400, 'INVALID_PRICE', 'Giá cao nhất không được âm.'); end if;
  if p_price_min is not null and p_price_max is not null and p_price_min > p_price_max then
    perform public.api_error(400, 'INVALID_PRICE_RANGE', 'Giá thấp nhất phải nhỏ hơn hoặc bằng giá cao nhất.');
  end if;

  if v_cat is not null then
    select id into v_cat_id from public.categories
     where id = v_cat or public.f_unaccent(name) = public.f_unaccent(v_cat);
    if v_cat_id is null then perform public.api_error(400, 'INVALID_CATEGORY', 'Danh mục không tồn tại.'); end if;
  end if;

  with matched as (
    select p.*
      from public.products p
      join public.categories c on c.id = p.category_id
     where p.status = 'published'
       and (v_cat_id is null or p.category_id = v_cat_id)
       and (p_price_min is null or p.retail_price >= p_price_min)
       and (p_price_max is null or p.retail_price <= p_price_max)
       and (v_q is null
            or public.f_unaccent(p.name) like '%' || public.f_unaccent(v_q) || '%'
            or public.f_unaccent(c.name) like '%' || public.f_unaccent(v_q) || '%'
            or public.f_unaccent(p.description) like '%' || public.f_unaccent(v_q) || '%')
  ),
  counted as (select count(*)::int as n from matched),
  paged as (
    select m.* from matched m
     order by
       case when p_sort = 'price_asc' then m.retail_price end asc,
       case when p_sort = 'price_desc' then m.retail_price end desc,
       case when p_sort = 'name_asc' then m.name end asc,
       case when p_sort = 'popular' then m.stock_sold end desc,
       m.published_at desc nulls last,
       m.id asc
     limit p_page_size offset (p_page - 1) * p_page_size
  )
  select (select n from counted),
         coalesce((select jsonb_agg(public.product_json(pg.*)) from paged pg), '[]'::jsonb)
    into v_total, v_items;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size,
    'totalPages', greatest(1, ceil(v_total::numeric / p_page_size)::int)
  );
end $$;

-- GET /products/:id  ->  rpc('get_product', { p_id }). Không có hoặc chưa published -> 404.
create or replace function public.get_product(p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_row public.products;
begin
  select * into v_row from public.products p
   where p.id = p_id
     and (p.status = 'published'
          or p.store_id = public.my_store_id()
          or public.is_admin());
  if v_row.id is null then
    perform public.api_error(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  end if;
  return public.product_json(v_row);
end $$;

create or replace function public.list_categories()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'name', c.name,
           'count', (select count(*) from public.products p where p.category_id = c.id and p.status = 'published'))
         order by c.sort_order, c.name), '[]'::jsonb)
    from public.categories c
$$;

-- ---------------------------------------------------------------------
-- Đăng ký seller: tạo cửa hàng gắn với UID thật và nâng role buyer -> seller
-- ---------------------------------------------------------------------
create or replace function public.store_json(s public.stores)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
    'phone', s.phone, 'address', s.address, 'logo', s.logo_path, 'createdAt', s.created_at)
$$;

create or replace function public.register_seller(p_name text, p_description text default '', p_phone text default '', p_address text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_store public.stores;
  v_slug text;
begin
  perform public.enforce_rate_limit('register_seller', 5, 3600);

  if exists (select 1 from public.stores where owner_id = v_uid) then
    perform public.api_error(409, 'ALREADY_SELLER', 'Tài khoản này đã có cửa hàng.');
  end if;

  p_name := btrim(coalesce(p_name, ''));
  p_phone := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
  if char_length(p_name) not between 2 and 80 then perform public.api_error(400, 'INVALID_STORE_NAME', 'Tên cửa hàng từ 2 đến 80 ký tự.'); end if;
  if char_length(coalesce(p_description, '')) > 500 then perform public.api_error(400, 'INVALID_DESCRIPTION', 'Mô tả tối đa 500 ký tự.'); end if;
  if p_phone <> '' and p_phone !~ '^\+?[0-9]{9,12}$' then perform public.api_error(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ.'); end if;

  v_slug := coalesce(nullif(public.slugify(p_name), ''), 'cua-hang') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.stores (owner_id, name, slug, description, phone, address)
  values (v_uid, p_name, v_slug, btrim(coalesce(p_description, '')), p_phone, left(btrim(coalesce(p_address, '')), 200))
  returning * into v_store;

  update public.profiles set role = 'seller' where id = v_uid and role = 'buyer';
  return public.store_json(v_store);
end $$;

create or replace function public.get_my_store()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_store public.stores;
begin
  perform public.require_user();
  select * into v_store from public.stores where owner_id = auth.uid();
  if v_store.id is null then return null; end if;
  return public.store_json(v_store);
end $$;

create or replace function public.update_my_store(p_name text, p_description text, p_phone text, p_address text, p_logo_path text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.require_seller();
  v_store public.stores;
begin
  p_name := btrim(coalesce(p_name, ''));
  p_phone := regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g');
  if char_length(p_name) not between 2 and 80 then perform public.api_error(400, 'INVALID_STORE_NAME', 'Tên cửa hàng từ 2 đến 80 ký tự.'); end if;
  if char_length(coalesce(p_description, '')) > 500 then perform public.api_error(400, 'INVALID_DESCRIPTION', 'Mô tả tối đa 500 ký tự.'); end if;
  if p_phone <> '' and p_phone !~ '^\+?[0-9]{9,12}$' then perform public.api_error(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ.'); end if;

  update public.stores
     set name = p_name,
         description = btrim(coalesce(p_description, '')),
         phone = p_phone,
         address = left(btrim(coalesce(p_address, '')), 200),
         logo_path = coalesce(public.check_store_image_path(v_store_id, p_logo_path, 'logo'), logo_path)
   where id = v_store_id
  returning * into v_store;
  return public.store_json(v_store);
end $$;

-- Dashboard seller: số liệu đếm bằng query thật trên database
create or replace function public.seller_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_store_id uuid := public.require_seller();
begin
  return jsonb_build_object(
    'products', jsonb_build_object(
      'total', (select count(*) from public.products where store_id = v_store_id),
      'published', (select count(*) from public.products where store_id = v_store_id and status = 'published'),
      'draft', (select count(*) from public.products where store_id = v_store_id and status = 'draft'),
      'hidden', (select count(*) from public.products where store_id = v_store_id and status = 'hidden')
    ),
    'stock', (select jsonb_build_object(
        'available', coalesce(sum(stock_available), 0),
        'held', coalesce(sum(stock_held), 0),
        'sold', coalesce(sum(stock_sold), 0))
      from public.products where store_id = v_store_id),
    'orders', (select jsonb_build_object(
        'pending', count(distinct o.id) filter (where o.status = 'PENDING'),
        'paidDemo', count(distinct o.id) filter (where o.status = 'PAID_DEMO'),
        'revenueDemo', coalesce(sum(oi.line_total) filter (where o.status = 'PAID_DEMO'), 0))
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.products p on p.id = oi.product_id
      where p.store_id = v_store_id)
  );
end $$;

-- ---------------------------------------------------------------------
-- CRUD sản phẩm của seller
-- ---------------------------------------------------------------------
create or replace function public.seller_list_products()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_store_id uuid := public.require_seller();
begin
  return coalesce((select jsonb_agg(public.product_json(p.*) order by p.updated_at desc)
                     from public.products p where p.store_id = v_store_id), '[]'::jsonb);
end $$;

-- Tạo mới (p_id = null) hoặc sửa sản phẩm của chính cửa hàng mình.
create or replace function public.seller_save_product(
  p_id text,
  p_name text,
  p_category text,
  p_description text,
  p_retail_price int,
  p_group_price int,
  p_min_members int,
  p_stock int,
  p_image_path text default null,
  p_status public.product_status default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.require_seller();
  v_cat_id text;
  v_row public.products;
  v_old public.products;
  v_held int := 0;
begin
  perform public.enforce_rate_limit('seller_save_product', 60, 60);

  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) not between 2 and 120 then perform public.api_error(400, 'INVALID_NAME', 'Tên sản phẩm từ 2 đến 120 ký tự.'); end if;
  if char_length(coalesce(p_description, '')) > 2000 then perform public.api_error(400, 'INVALID_DESCRIPTION', 'Mô tả tối đa 2000 ký tự.'); end if;
  if p_retail_price is null or p_retail_price <= 0 then perform public.api_error(400, 'INVALID_RETAIL_PRICE', 'Giá mua lẻ phải lớn hơn 0.'); end if;
  if p_group_price is null or p_group_price <= 0 then perform public.api_error(400, 'INVALID_GROUP_PRICE', 'Giá mua chung phải lớn hơn 0.'); end if;
  if p_group_price > p_retail_price then perform public.api_error(400, 'GROUP_PRICE_TOO_HIGH', 'Giá mua chung không được cao hơn giá mua lẻ.'); end if;
  if p_min_members is null or p_min_members not between 2 and 50 then perform public.api_error(400, 'INVALID_MIN_MEMBERS', 'Số người tối thiểu từ 2 đến 50.'); end if;
  if p_stock is null or p_stock < 0 or p_stock > 100000 then perform public.api_error(400, 'INVALID_STOCK', 'Tồn kho từ 0 đến 100.000.'); end if;

  select id into v_cat_id from public.categories
   where id = p_category or public.f_unaccent(name) = public.f_unaccent(p_category);
  if v_cat_id is null then perform public.api_error(400, 'INVALID_CATEGORY', 'Danh mục không tồn tại.'); end if;

  p_image_path := public.check_store_image_path(v_store_id, p_image_path, 'products');

  if p_id is null then
    insert into public.products (id, slug, store_id, category_id, name, description, retail_price, group_price,
                                 min_members, image_path, status, stock_available, published_at)
    values ('s' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 11),
            left(coalesce(nullif(public.slugify(p_name), ''), 'san-pham'), 120) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
            v_store_id, v_cat_id, p_name, btrim(coalesce(p_description, '')), p_retail_price, p_group_price,
            p_min_members, p_image_path, coalesce(p_status, 'draft'), p_stock,
            case when p_status = 'published' then now() end)
    returning * into v_row;
  else
    -- Khóa dòng và kiểm tra quyền sở hữu: seller A không sửa được sản phẩm của seller B
    select * into v_old from public.products where id = p_id for update;
    if v_old.id is null then perform public.api_error(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.'); end if;
    if v_old.store_id <> v_store_id then perform public.api_error(403, 'NOT_PRODUCT_OWNER', 'Bạn không có quyền sửa sản phẩm này.'); end if;

    -- p_stock là số còn bán được; số đang giữ / đã bán do hệ thống quản lý, seller không sửa
    update public.products
       set name = p_name,
           category_id = v_cat_id,
           description = btrim(coalesce(p_description, '')),
           retail_price = p_retail_price,
           group_price = p_group_price,
           min_members = p_min_members,
           image_path = coalesce(p_image_path, image_path),
           status = coalesce(p_status, status),
           stock_available = p_stock,
           published_at = case when p_status = 'published' and published_at is null then now() else published_at end
     where id = p_id
    returning * into v_row;
  end if;

  return public.product_json(v_row);
end $$;

create or replace function public.seller_set_product_status(p_id text, p_status public.product_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := public.require_seller();
  v_row public.products;
begin
  select * into v_row from public.products where id = p_id for update;
  if v_row.id is null then perform public.api_error(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.'); end if;
  if v_row.store_id <> v_store_id then perform public.api_error(403, 'NOT_PRODUCT_OWNER', 'Bạn không có quyền sửa sản phẩm này.'); end if;

  update public.products
     set status = p_status,
         published_at = case when p_status = 'published' and published_at is null then now() else published_at end
   where id = p_id
  returning * into v_row;
  return public.product_json(v_row);
end $$;
