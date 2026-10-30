# WeBuy — Bản nâng cấp giao diện tương tác (HTML/CSS/JavaScript)

Bản nâng cấp dựa trên **WeBuy Redesign** gốc, giữ các thành phần nhận diện và bố cục: xanh lá, trắng/kem, banner trang chủ, bốn danh mục, tám sản phẩm và trang giới thiệu. Không dùng WordPress, WooCommerce hay framework.

## Cách chạy

1. Giải nén file ZIP.
2. Mở thư mục **`webuy-redesign`** trong Visual Studio Code.
3. Cài extension **Live Server** (Ritwick Dey) nếu chưa có, nhấp phải `index.html` → **Open with Live Server**.
4. Sử dụng thanh điều hướng và thử các luồng bên dưới. Có thể thử mở file HTML trực tiếp, nhưng nên dùng Live Server để trình duyệt lưu dữ liệu `localStorage` ổn định.

## Tính năng mới

1. **Danh mục được liên kết và lọc**: từ 4 danh mục trên trang chủ → `products.html?category=...`, hiển thị đúng sản phẩm; nút **Tất cả** và tìm kiếm từ khóa hoạt động.
2. **Chi tiết riêng cho 8 sản phẩm**: `product-detail.html?id=1` đến `id=8` hiển thị đúng tên, ảnh, giá lẻ/giá nhóm, số thành viên cần đạt.
3. **Thêm vào giỏ hàng**: có nút trên thẻ sản phẩm và trang chi tiết, chọn số lượng mua lẻ.
4. **Mua lẻ**: thêm hàng vào giỏ và chuyển tới `cart.html`; tại đó chỉnh số lượng, xóa, xem tạm tính và chuyển tới trang xác nhận demo.
5. **Tham gia nhóm**: chọn nhóm đang mở, thêm 1 thành viên của trình duyệt vào nhóm, cập nhật tiến độ, lưu một mục mua chung trong giỏ. Mỗi thành viên chỉ được tính một lần trên cùng một nhóm.
6. **Tạo nhóm**: tạo nhóm riêng trong 24 giờ với số thành viên mục tiêu của sản phẩm, người tạo được tính là thành viên đầu tiên. Nhóm hiển thị ở hồ sơ người dùng.
7. **Điều kiện giá nhóm**: nhóm **chưa đủ** thành viên không thể chuyển sang xác nhận đơn; chỉ nhóm đủ thành viên mới được tính là sản phẩm sẵn sàng xác nhận. Nhóm hết hạn mà chưa đủ người không thể nhận thành viên mới.
8. **Avatar & hồ sơ**: avatar góc trên phải, trang `profile.html` cho phép thay tên hiển thị và lưu thông tin thử nghiệm, xem nhóm đã tham gia và đơn hàng demo.
9. **Giỏ hàng cạnh avatar**: biểu tượng giỏ có bộ đếm số lượng, liên kết tất cả các trang.
10. **Xác nhận đơn demo**: `checkout.html` kiểm tra tên/số điện thoại/địa chỉ, lưu đơn thử nghiệm, hiển thị trong hồ sơ.

## Cấu trúc file

- `index.html` — trang chủ, liên kết danh mục, sản phẩm nổi bật.
- `products.html` — danh sách tám sản phẩm, tìm kiếm và lọc theo danh mục.
- `product-detail.html` — hiển thị chi tiết sản phẩm theo `?id=...`, nút mua lẻ / mua chung / thêm giỏ.
- `cart.html` — giỏ hàng, trạng thái đơn mua chung và tạm tính.
- `checkout.html` — xác nhận đơn thử nghiệm (không thanh toán thật).
- `profile.html` — avatar, thông tin người dùng, nhóm mua và lịch sử đơn demo.
- `about.html` — giới thiệu cũ được giữ nguyên.
- `css/styles.css`, `css/home.css` — CSS gốc; `css/app.css` — CSS bổ sung cho tính năng mới.
- `js/catalog-data.js` — dữ liệu mẫu cho tám sản phẩm.
- `js/app.js` — xử lý lọc, giỏ hàng, nhóm mua, hồ sơ và xác nhận đơn demo.
- `images/` — hình ảnh gốc được giữ nguyên.
- `screenshots/` — thư mục dành cho ảnh chụp, không đóng gói ảnh chụp cũ để giảm dung lượng ZIP.

## Lưu ý quan trọng về phạm vi

Đây là **frontend prototype** dùng **`localStorage` trên thiết bị/trình duyệt đang mở**. Chưa có backend, cơ sở dữ liệu dùng chung, đăng nhập/xác thực thật, cơ chế ghép nhóm giữa hai người dùng ở các thiết bị khác nhau, xử lý thanh toán, giữ hàng, giao hàng hay thông báo tự động. Bộ đếm người tham gia ban đầu là **dữ liệu minh họa**. Liên kết mời nhóm không thực sự đồng bộ giữa hai thiết bị; để triển khai thực tế phải kết nối API và cơ sở dữ liệu.

Không nhập thông tin nhạy cảm hoặc dùng bản này để giao dịch thật. Giá và thông tin sản phẩm là dữ liệu demo cho đồ án.

## Thử nhanh

1. Trang chủ → chọn **Áo thun** → danh sách chỉ còn áo thun → chọn **Tất cả** → hiện đủ tám sản phẩm.
2. Trang sản phẩm → **Thêm vào giỏ** → biểu tượng giỏ góc trên phải tăng số → vào giỏ → chỉnh số lượng.
3. Vào chi tiết Balo → **Tham gia nhóm** → tiến độ nhóm đạt 3/3 → vào giỏ thấy mục mua chung ở trạng thái sẵn sàng.
4. Vào chi tiết Đèn bàn → **Tạo nhóm** → trong nhóm riêng bấm **+ Mô phỏng 1 thành viên mới (demo)** để thử quy tắc đủ thành viên → xem nhóm trong **Hồ sơ**.
5. Mua lẻ một sản phẩm → **Xác nhận đơn hàng** → điền tên, điện thoại, địa chỉ → **Lưu đơn hàng demo** → xem đơn trong **Hồ sơ**.
6. Sửa tên hiển thị trong **Hồ sơ** → nút avatar trên header đổi chữ viết tắt.

