-- TỰ SINH bởi supabase/scripts/build-seed.mjs từ js/catalog-data.js. Đừng sửa tay, hãy chạy lại script.
-- 8 sản phẩm, 4 danh mục. Chạy nhiều lần không tạo bản trùng.
begin;

insert into public.categories (id, name, sort_order) values
  ('balo-tui-vi', 'Balo & túi ví', 1),
  ('ao-thun', 'Áo thun', 2),
  ('thiet-bi-gia-dung', 'Thiết bị gia dụng', 3),
  ('trang-suc', 'Trang sức', 4)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.stores (id, owner_id, name, slug, description) values
  ('00000000-0000-4000-8000-000000000001', null, 'WeBuy Official', 'webuy-official', 'Cửa hàng hệ thống chứa sản phẩm mẫu của WeBuy.')
on conflict (id) do nothing;

insert into public.products (id, slug, store_id, category_id, name, description, retail_price, group_price,
                             min_members, image_path, badge, status, stock_available, published_at) values
  ('1', 'balo-canvas-everyday-1', '00000000-0000-4000-8000-000000000001', 'balo-tui-vi', 'Balo canvas Everyday', 'Balo vải canvas phong cách tối giản, phù hợp mang sách vở và vật dụng hằng ngày.', 299000, 249000, 3, 'images/product-01.webp', 'Được quan tâm', 'published', 50, now()),
  ('2', 'ao-thun-cotton-essential-2', '00000000-0000-4000-8000-000000000001', 'ao-thun', 'Áo thun cotton Essential', 'Áo thun cotton dáng cơ bản, dễ phối đồ và phù hợp nhiều hoạt động thường ngày.', 189000, 149000, 2, 'images/product-02.webp', 'Mới', 'published', 50, now()),
  ('3', 'den-ban-minimal-light-3', '00000000-0000-4000-8000-000000000001', 'thiet-bi-gia-dung', 'Đèn bàn Minimal Light', 'Đèn bàn thiết kế gọn gàng, phù hợp góc học tập và làm việc.', 429000, 349000, 4, 'images/product-03.webp', 'Đề xuất', 'published', 50, now()),
  ('4', 'day-chuyen-hoa-nho-grace-4', '00000000-0000-4000-8000-000000000001', 'trang-suc', 'Dây chuyền hoa nhỏ Grace', 'Dây chuyền họa tiết hoa nhỏ, phong cách thanh lịch, dễ kết hợp trang phục.', 329000, 269000, 3, 'images/product-04.webp', 'Nổi bật', 'published', 50, now()),
  ('5', 'tui-deo-cheo-urban-mini-5', '00000000-0000-4000-8000-000000000001', 'balo-tui-vi', 'Túi đeo chéo Urban Mini', 'Túi đeo chéo kích thước nhỏ gọn, thích hợp đựng đồ dùng cá nhân khi di chuyển.', 379000, 315000, 3, 'images/product-05.webp', 'Được yêu thích', 'published', 50, now()),
  ('6', 'binh-giu-nhiet-sage-500ml-6', '00000000-0000-4000-8000-000000000001', 'thiet-bi-gia-dung', 'Bình giữ nhiệt Sage 500ml', 'Bình giữ nhiệt dung tích 500 ml, thuận tiện mang nước khi học tập hoặc làm việc.', 259000, 209000, 2, 'images/product-06.webp', 'Tiện dụng', 'published', 50, now()),
  ('7', 'tai-nghe-chup-tai-cozy-sound-7', '00000000-0000-4000-8000-000000000001', 'thiet-bi-gia-dung', 'Tai nghe chụp tai Cozy Sound', 'Tai nghe dạng chụp tai với thiết kế thoải mái, thích hợp nghe nhạc và học tập.', 699000, 579000, 4, 'images/product-07.webp', 'Đề xuất', 'published', 50, now()),
  ('8', 'vong-tay-bac-tinh-te-luna-8', '00000000-0000-4000-8000-000000000001', 'trang-suc', 'Vòng tay bạc tinh tế Luna', 'Vòng tay phong cách tối giản, có thể kết hợp cùng trang phục hằng ngày.', 299000, 245000, 3, 'images/product-08.webp', 'Nổi bật', 'published', 50, now())
on conflict (id) do update set
  slug = excluded.slug, category_id = excluded.category_id, name = excluded.name, description = excluded.description,
  retail_price = excluded.retail_price, group_price = excluded.group_price, min_members = excluded.min_members,
  image_path = excluded.image_path, badge = excluded.badge;
-- Lưu ý: khi chạy lại, seed KHÔNG ghi đè trạng thái (status) và tồn kho đang có trên database.

commit;
