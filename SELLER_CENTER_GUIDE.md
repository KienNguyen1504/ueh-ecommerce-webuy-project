# WeBuy Seller Center — Hướng dẫn tích hợp (Tuệ + Nhi)

## 1. Phạm vi thay đổi

Đã **bổ sung** giao diện, JS và CSS riêng cho Kênh người bán. Các trang mua hàng, 8 sản phẩm mặc định, giỏ hàng, checkout, profile, trang chủ, giao diện giới thiệu và chức năng Xu WeBuy vẫn nằm trong dự án.

- **Thêm mới:** `seller-center.html`, `js/seller-center.js`, `css/seller-center.css`, `css/seller-entry.css` và tài liệu này.
- **Bổ sung 1 liên kết menu + 1 file CSS:** `index.html`, `products.html`, `product-detail.html`, `cart.html`, `checkout.html`, `profile.html`, `about.html`; bổ sung liên kết tại `header.html`.
- **Bổ sung phần dữ liệu người bán ở cuối:** `js/catalog-data.js` (không xóa 8 sản phẩm mặc định).
- **Điều chỉnh rất nhỏ trong:** `js/app.js` để nhóm mới dùng `groupDurationHours` nếu sản phẩm có thiết lập; sản phẩm cũ mặc định vẫn 24 giờ; không tạo nhóm demo giả định cho sản phẩm người bán; và hiển thị tiến độ của nhóm mua thật trong bản demo cho sản phẩm người bán.

**Không thay thế các file khác của nhóm.** Nếu repository đã có commit mới sau thời điểm gửi ZIP, nên chép từng thay đổi vào code mới nhất / tạo branch và kiểm tra diff trước khi merge, không ghi đè bừa cả repository.

## 2. Chạy thử

1. Giải nén ZIP hoàn chỉnh, mở đúng thư mục `ueh-ecommerce-webuy-project-main` bằng VS Code.
2. Dùng **Live Server** mở `index.html`. Không cần `npm install`, backend hoặc database.
3. Trên thanh điều hướng, nhấn **Kênh người bán**; hoặc mở `seller-center.html` trên cùng địa chỉ Live Server.
4. Đăng ký cửa hàng. Thử submit khi thiếu trường bắt buộc để kiểm tra lỗi bên dưới.
5. Chọn **Đăng sản phẩm mới**, nhập tên, danh mục, ảnh/URL, mô tả, giá lẻ, giá nhóm, số thành viên, thời hạn. Xem trước, lưu nháp hoặc đăng.
6. Nhấn **↗ Kênh người mua** và mở `products.html`: sản phẩm vừa đăng xuất hiện cùng 8 sản phẩm có sẵn. Thử trang chi tiết, giỏ hàng.
7. Quay lại Kênh người bán → **Quản lý sản phẩm** → **Chỉnh sửa** hoặc **Ẩn**. Tải lại trang sản phẩm phía người mua để quan sát thay đổi.
8. Tại trang chi tiết sản phẩm đã đăng, bấm **Tạo nhóm**. Trở lại Kênh người bán → **Quản lý nhóm mua** và nhấn **Làm mới dữ liệu** để xem tiến độ nhóm. Có thể mô phỏng thêm thành viên từ trang chi tiết theo tính năng đã có.

## 3. Các chức năng đã triển khai

| Yêu cầu | Trạng thái trong frontend demo |
|---|---|
| Mục Kênh người bán trên website | Có, trong menu chính của mọi trang mua hàng |
| Đăng ký/đổi vai trò | Có, tạo hồ sơ và chuyển giữa hai trang trong cùng trình duyệt |
| Dashboard riêng | Có, 4 thẻ thống kê dựa trên dữ liệu localStorage và danh sách gần đây |
| Đăng sản phẩm | Có, tên/danh mục/ảnh/mô tả/hai mức giá/số thành viên/thời hạn |
| Kiểm tra dữ liệu | Có, thông báo tại trường sai, giữ thông tin khi lỗi |
| Xem trước và lưu nháp | Có |
| Xem, sửa, ẩn/hiện | Có, không xóa bản ghi |
| Nhóm mua liên quan | Có, đọc nhóm được tạo qua `js/app.js` ở Kênh người mua |
| Chung dữ liệu sản phẩm | Có, qua `js/catalog-data.js` và khóa localStorage của sản phẩm người bán |

## 4. Cấu trúc dữ liệu demo

- Hồ sơ người bán: `localStorage['webuy_seller_v1_shop']`.
- Sản phẩm riêng của người bán: `localStorage['webuy_seller_v1_products']`.
- Nhóm mua của website hiện tại: `localStorage['webuy_demo_v2_groups']`.
- Giỏ hàng đang có của website: `localStorage['webuy_demo_v2_cart']` (**Kênh người bán không sửa khóa này**).
- Sản phẩm chỉ xuất hiện ở Kênh người mua khi có trạng thái `published`. Trạng thái `draft`, `hidden` vẫn lưu lại nhưng không công khai.
- Các nhóm đã tạo giữ điều kiện tại thời điểm tạo, kể cả khi người bán sửa cài đặt của sản phẩm sau đó.

## 5. Giới hạn quan trọng

Đây là **frontend demo**, không phải hệ thống người bán thực tế. Chưa có xác thực, phân quyền từ máy chủ, cơ sở dữ liệu dùng chung nhiều tài khoản/thiết bị, lưu ảnh trên server, đơn hàng thật, thanh toán hoặc thông báo push. Dữ liệu chỉ giữ được trên **cùng origin (địa chỉ website), trình duyệt và hồ sơ người dùng**. Mở một địa chỉ khác hoặc xóa dữ liệu trình duyệt sẽ không thấy cửa hàng đã đăng.

Ảnh tải lên được nén và lưu trong `localStorage`; nếu lưu quá nhiều ảnh, có thể hết dung lượng trình duyệt. Với demo, nên dùng URL ảnh HTTPS đáng tin cậy hoặc ảnh nhỏ. Dùng Live Server / GitHub Pages cùng origin để thử quy trình.

## 6. Checklist kiểm thử thủ công sau khi tích hợp

- [ ] Trang chủ / danh mục / chi tiết / giỏ hàng / hồ sơ / checkout / giới thiệu vẫn mở được.
- [ ] Menu **Kênh người bán** hiển thị ở desktop và trên điện thoại.
- [ ] Đăng ký trống: hiển thị lỗi; dữ liệu đã nhập vẫn còn.
- [ ] Email/điện thoại sai định dạng: hiển thị lỗi.
- [ ] Đăng sản phẩm thiếu ảnh/mô tả: hiển thị lỗi.
- [ ] Giá nhóm > giá lẻ hoặc minMembers < 2: bị từ chối.
- [ ] Sau khi đăng thành công, sản phẩm hiện trên trang người mua (tải lại trang).
- [ ] Chỉnh sửa giá/ảnh: trang người mua hiển thị giá/ảnh mới sau tải lại.
- [ ] Ẩn sản phẩm: không còn trong danh sách sản phẩm người mua.
- [ ] Lưu bản nháp: chỉ ở trang người bán, không công khai.
- [ ] Tạo nhóm trên trang chi tiết → Dashboard và Quản lý nhóm mua cập nhật đúng số liệu.
- [ ] Chuyển Kênh người bán/người mua không làm mất giỏ hàng cũ.

**Kiểm thử đã thực hiện khi chuẩn bị mã:** kiểm tra cú pháp tất cả JS, kiểm tra cấu trúc HTML và đường dẫn local, xác minh 8 sản phẩm gốc, thử logic bổ sung/ẩn sản phẩm trong catalog; thực thi luồng đăng ký/đăng/ẩn-hiện/nhóm qua mô phỏng DOM với Node.js. Cần chạy checklist trên trình duyệt thực trước khi nộp chính thức.
