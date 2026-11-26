# Backend WeBuy — phần của Nhi

Tài liệu này mô tả 12 task backend có PIC Nhi, hạn 29/11/2026, trong sheet "CHECKLIST BACK-END". Các task ghi "Tạm hoãn" **chưa làm**.

## 1. Đã làm gì, nằm ở đâu

| Task trong checklist | File | Kiểm thử |
| --- | --- | --- |
| Đăng ký/đăng nhập & phân quyền | `supabase/migrations/…0100_nhi_foundation.sql` | 5 ca |
| API cửa hàng & quyền seller | `…0200_nhi_store_catalog.sql` | 4 ca |
| Chuyển catalog cũ lên database | `supabase/seed.sql` (sinh bởi `supabase/scripts/build-seed.mjs`) | 2 ca |
| API tìm/lọc/sắp xếp sản phẩm | `…0200` (`search_products`, `get_product`) | 5 ca |
| CRUD sản phẩm & ảnh theo seller | `…0200` + bucket Storage `store-assets` | 5 ca |
| Tồn kho & giữ hàng an toàn | `…0300_nhi_stock_cart_orders.sql` | 3 ca (có chạy đồng thời) |
| Giỏ hàng gắn tài khoản | `…0300` | 4 ca |
| Chốt giá theo lịch sử đơn/nhóm | `…0300` (`order_items`, `price_for`) | 2 ca |
| Trạng thái đơn & thanh toán demo | `…0300` + `order-payment.html`, `js/payment-demo.js` | 7 ca |
| Thông báo & log lỗi backend | `…0400_nhi_notifications.sql`, `api_error_logs`, `rate_limits` | 4 ca |
| Lớp API dùng chung ở frontend | `js/api-config.js`, `js/api-client.js` | 12 ca (adapter Supabase) |
| Giao diện Auth và vai trò | `login.html`, `js/login-page.js`, `js/auth-ui.js`, `css/auth.css` | 24 ca trình duyệt |

`…0900_nhi_grants.sql` thu hồi toàn bộ quyền mặc định của Supabase rồi chỉ cấp những gì cần.

**Kết quả kiểm thử:**
- SQL: 42/42 ca PASS trên PostgreSQL 16 (`supabase/tests/test_backend_nhi.py`).
- Trình duyệt ở chế độ mock: 24/24 ca PASS.
- Bộ test cũ của nhóm (`tests/test-runner.html`): 37/37 ca vẫn PASS.

## 2. Cách đưa lên Supabase (cho Hoa, sau khi tạo project)

1. Vào **Database → Extensions**, bật `unaccent`. Nếu muốn tự hủy đơn quá hạn mỗi phút thì bật thêm `pg_cron`.
2. Mở **SQL Editor**, chạy lần lượt 5 file trong `supabase/migrations/` theo thứ tự tên file, sau đó chạy `supabase/seed.sql`. Nếu dùng Supabase CLI thì chỉ cần `supabase db push`.
3. Lấy **Project URL** và **publishable key (anon)** ở Project Settings → API, điền vào `js/api-config.js`, rồi đổi `mode: 'supabase'`. **Không** dán secret key hay service_role key vào frontend.
4. Vào **Authentication → URL Configuration**, thêm địa chỉ GitHub Pages vào Site URL / Redirect URLs, để link xác nhận email quay về `login.html`.

Chạy lại migration hay seed nhiều lần cũng không sao: seed không tạo bản trùng và giữ nguyên ID sản phẩm 1–8.

> **Trùng việc với Hoa.** Task "Thiết kế database & migration" của Hoa có các bảng profiles, stores, products, carts, orders… Các task của Nhi cần những bảng này mới chạy được, nên Nhi đã tạo trước. Hoa nên lấy chúng làm gốc và bổ sung `buying_groups`, `group_reservations`, `coin_wallets`, `idempotency_requests`, không tạo lại từ đầu. Khi tạo `group_reservations`, gọi `public.price_for(product_id, 'group')` để lưu giá nhóm tại lúc giữ chỗ, và `public.notify(...)` để gửi thông báo nhóm.

## 3. Danh sách API

Frontend gọi qua `WeBuyAPI.*` trong `js/api-client.js`. Phía Supabase, mỗi hàm là một RPC: `supabase.rpc('<tên>', {...})`.

| WeBuyAPI | RPC | Quyền |
| --- | --- | --- |
| `products.search({q, category, priceMin, priceMax, sort, page, pageSize})` | `search_products` | ai cũng gọi được |
| `products.get(id)` | `get_product` | ai cũng gọi được |
| `products.categories()` | `list_categories` | ai cũng gọi được |
| `profile.get()` / `profile.update({name, phone, address})` | `get_my_profile` / `update_my_profile` | đã đăng nhập |
| `seller.register({name, description, phone, address})` | `register_seller` | đã đăng nhập |
| `seller.myStore()` / `seller.updateStore(...)` | `get_my_store` / `update_my_store` | seller |
| `seller.dashboard()` | `seller_dashboard` | seller |
| `seller.listProducts()` / `seller.saveProduct(...)` / `seller.setStatus(id, status)` | `seller_list_products` / `seller_save_product` / `seller_set_product_status` | seller, chỉ với sản phẩm của mình |
| `seller.uploadImage(file, 'products' \| 'logo')` | Storage `store-assets/{store_id}/…` | seller |
| `stock.hold(productId, qty, minutes)` / `stock.release(holdId)` | `hold_stock` / `release_stock_hold` | đã đăng nhập |
| `cart.get / add / setQuantity / remove / merge` | `get_cart`, `add_to_cart`, `set_cart_item_quantity`, `remove_cart_item`, `merge_cart` | đã đăng nhập |
| `orders.place(cartItemIds, shipping, requestId)` | `place_order` | đã đăng nhập |
| `orders.get / list / payDemo / cancel / refundDemo` | `get_order`, `list_my_orders`, `pay_order_demo`, `cancel_order`, `refund_order_demo` | chủ đơn |
| `notifications.list / markRead` | `get_notifications`, `mark_notifications_read` | đã đăng nhập |

**Mã lỗi:** hàm SQL báo lỗi bằng SQLSTATE `PT<mã HTTP>`, nên Supabase trả đúng mã HTTP đó.

| HTTP | Ý nghĩa | Ví dụ mã lỗi |
| --- | --- | --- |
| 400 | Dữ liệu sai | `INVALID_SORT`, `GROUP_PRICE_TOO_HIGH`, `INVALID_CART_ITEMS` |
| 401 | Chưa đăng nhập | `AUTH_REQUIRED` |
| 403 | Không có quyền | `SELLER_ONLY`, `NOT_PRODUCT_OWNER` |
| 404 | Không tìm thấy | `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND` |
| 409 | Xung đột | `OUT_OF_STOCK`, `ALREADY_SELLER`, `INVALID_STATUS_CHANGE` |
| 429 | Thao tác quá nhanh | `RATE_LIMITED` |

`message` là mã lỗi để code xử lý, `details` là câu tiếng Việt để hiện cho người dùng. `WeBuyAPI.ui.errorMessage(err)` trả sẵn câu tiếng Việt đó.

## 4. Quy tắc nghiệp vụ đã chốt trong code

- **Vai trò:** tài khoản mới luôn là `buyer`. Đăng ký cửa hàng thì thành `seller`. `admin` chỉ đặt được bằng SQL phía server. Trình duyệt không sửa được cột `role`.
- **Tồn kho:** `available` → giữ hàng → `held` → thanh toán → `sold`. Hủy hoặc hết hạn thì trả từ `held` về `available`. Mỗi lần trừ kho là một câu `UPDATE … WHERE stock_available >= n`, nên khi nhiều người cùng tranh hàng, tồn kho không bao giờ âm.
- **Đơn hàng:** chỉ được chuyển trạng thái theo sơ đồ sau. Các bước khác bị chặn bằng trigger:
  - `DRAFT` → `PENDING` hoặc `CANCELLED`
  - `PENDING` → `PAID_DEMO` hoặc `CANCELLED`
  - `PAID_DEMO` → `REFUNDED_DEMO`

  Đơn `PENDING` giữ hàng 15 phút, quá hạn thì tự hủy và trả hàng về kho.
- **Chống tạo đơn trùng:** mỗi lần bấm "Xác nhận", frontend tạo một `requestId` (`WeBuyAPI.newRequestId()`). Gửi lại cùng `requestId` thì nhận về đúng đơn đã tạo.
- **Giá:** giỏ hàng không lưu giá. `order_items` lưu đơn giá, giá lẻ và giá nhóm tại lúc đặt, và không ai sửa được sau đó.
- **Gộp giỏ khi đăng nhập:** dòng trùng thì lấy số lượng **lớn hơn**, không cộng dồn, nên gộp nhiều lần vẫn ra cùng kết quả.
- **Ảnh:** chỉ nhận JPG, PNG, WebP, tối đa 2 MB. Mỗi cửa hàng chỉ ghi được vào thư mục `{store_id}/` của mình.

## 5. Còn lại / lưu ý

- **Task đang tạm hoãn, chưa làm:** Checkout phía server (phần trừ Xu), Ví Xu & ledger, Hoàn Xu, Điểm danh chống gian lận, Trang sản phẩm dùng API, Nối cart/checkout/xu/seller. Vì vậy các trang mua hàng và Seller Center **vẫn đọc localStorage như cũ**. Mới có đăng nhập, menu tài khoản, chặn Seller Center khi chưa đăng nhập, hồ sơ, danh sách đơn và trang thanh toán mô phỏng là đi qua API.
- **`place_order` đã có:** để có đơn cho phần trạng thái đơn và snapshot giá, Nhi đã làm `place_order` bản cơ bản (tính lại giá từ database, chưa trừ Xu).
- **Giới hạn tốc độ:** chỉ đếm những lần gọi thành công, vì lần gọi bị lỗi sẽ rollback luôn bộ đếm. Lớp chặn spam ở tầng mạng là rate limit có sẵn của Supabase (Auth, API Gateway).
- **Chế độ mock:** dữ liệu nằm trong localStorage của một máy, nên **không** đồng bộ giữa hai trình duyệt. Các tiêu chí "máy 2 vẫn thấy" chỉ đạt khi bật `mode: 'supabase'`.

## 6. Tự chạy kiểm thử

```bash
# SQL (cần PostgreSQL cục bộ, KHÔNG chạy vào database Supabase dùng chung)
pip install "psycopg[binary]"
createdb webuy_test
python supabase/tests/test_backend_nhi.py "postgresql://postgres@localhost:5432/webuy_test"

# Sinh lại seed khi thêm sản phẩm vào js/catalog-data.js
node supabase/scripts/build-seed.mjs
```
