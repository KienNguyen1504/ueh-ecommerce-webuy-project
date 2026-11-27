# WeBuy – Hoàn thiện Frontend theo checklist (27/11/2026)

## Phạm vi triển khai

| Hạng mục | Cách triển khai | Lưu ý demo |
|---|---|---|
| Chi tiết sản phẩm | Hiển thị thông tin từ `WEBUY_PRODUCTS`: tên, ID, danh mục, mô tả, giá lẻ, giá nhóm, thành viên tối thiểu, mức tiết kiệm. Bảng thông số không tự suy diễn trường catalog còn thiếu. | Q&A và chính sách là nội dung mẫu có nhãn DEMO; không có đánh giá hay lượt mua giả. ID không tồn tại vẫn dùng thông báo hiện có và liên kết về `products.html`. |
| Gợi ý liên quan | Ưu tiên sản phẩm cùng danh mục; bổ sung theo độ gần giá nhóm; loại trừ ID hiện tại; tối đa 6 sản phẩm. | Dữ liệu lấy cả từ catalog cơ sở và sản phẩm Seller Center đã publish qua `catalog-data.js`. |
| Empty / loading / image fallback | Sử dụng trạng thái rỗng sẵn có ở catalog và wishlist; phần gợi ý có trạng thái loading, empty và fallback ảnh. | Không sinh sản phẩm để lấp danh sách. |
| Tạo / tham gia nhóm | `createGroup()` chặn một nhóm cá nhân đang mở trên cùng sản phẩm trong trình duyệt; khóa nút tạo sau khi có nhóm; phân biệt tham gia, đủ người và hết hạn. | Seed community groups không bị xem là nhóm cá nhân do user tạo. |
| Group Hub | `groups.html` đọc `webuy_demo_v2_groups` và `WEBUY_PRODUCTS`; lọc danh mục, khu vực, nhóm chỉ còn thiếu 1 người; thẻ có ảnh, giá, người tham gia, thời gian và CTA. | Dữ liệu lưu localStorage trên trình duyệt hiện tại. |
| Chia sẻ nhóm | Web Share API khi có; nếu không hỗ trợ thì mở hộp chia sẻ có copy link và QR URL. | QR dùng dịch vụ ảnh QR bên ngoài; link chỉ mở đúng trang chi tiết + group ID, trạng thái localStorage không đồng bộ giữa thiết bị. |
| Đấu giá ngược | `reverse-bidding.html` có 3 tab: người mua tạo yêu cầu; người bán gửi báo giá qua form; người mua so sánh/chọn báo giá. Mỗi yêu cầu tạo 2 báo giá mẫu, người bán có thể nhập thêm tên cửa hàng, giá, thời gian giao và ghi chú; chọn báo giá sẽ khóa yêu cầu, yêu cầu hết hạn tự khóa. | Tất cả báo giá gắn nhãn DEMO và lưu trong localStorage cùng trình duyệt; không phải chào giá từ người bán thật hay giao dịch thực. Đã bỏ khối giải thích “Quy trình MVP”. |
| Trợ lý mua chung | Widget rule engine parse ngân sách/danh mục, tra cứu `WEBUY_PRODUCTS` và nhóm từ localStorage; trả link sản phẩm kèm lý do. | Không dùng API key LLM; không cam kết tồn kho. |
| Tìm kiếm bằng ảnh MVP | Camera button, chọn JPG/PNG/WebP, preview bằng object URL tại máy; chọn danh mục dự phòng và trả tối đa 3 sản phẩm. | Chưa triển khai image embedding. Ảnh không được upload lên server. |

## File mới

- `css/advanced-features.css`
- `js/product-detail-extras.js`
- `js/groups-hub.js`
- `js/group-sharing.js`
- `js/reverse-bidding.js`
- `js/weby-assistant.js`
- `js/image-search.js`
- `js/image-fallback.js`
- `js/feature-shell.js`
- `groups.html`
- `reverse-bidding.html`

## Kiểm thử bổ sung

`tests/webuy-tests.js` thêm TC44–TC61 cho: chặn nhóm cá nhân trùng, tham gia nhóm và cập nhật giỏ, trạng thái đủ người/hết hạn, lọc Group Hub, URL chia sẻ, dữ liệu đấu giá ngược không hợp lệ, form người bán gửi báo giá, người mua chọn báo giá DEMO, matching trợ lý với truy vấn `có 300k mua balo`, tìm kiếm ảnh theo danh mục dự phòng và gợi ý liên quan.

Chạy kiểm thử tại `tests/test-runner.html` bằng Live Server và bấm **Chạy kiểm thử**. Có thể mở `tests/test-runner.html?auto=1` để tự chạy toàn bộ suite.

## Kiểm tra sau tích hợp

- `node --check` đã chạy thành công cho các JavaScript mới/chỉnh sửa: `app.js`, `product-detail-extras.js`, `group-sharing.js`, `groups-hub.js`, `reverse-bidding.js`, `weby-assistant.js`, `image-search.js`, `feature-shell.js`, `image-fallback.js` và `tests/webuy-tests.js`.
- Đã rà soát tham chiếu CSS/JS nội bộ và ID trùng trong các trang HTML; không phát hiện tệp được tham chiếu bị thiếu hoặc ID HTML trùng.
- Bộ test hiện có 61 test case (TC01–TC61). TC44–TC61 là phần test được bổ sung cho checklist Frontend này. TC57 xác nhận khối “Quy trình MVP” đã được gỡ; TC58 xác nhận yêu cầu quá hạn; TC59–TC61 kiểm tra form người bán, lưu báo giá và người mua chọn phương án. Cần mở `tests/test-runner.html` bằng Live Server và bấm **Chạy kiểm thử** trong trình duyệt để lấy kết quả tương tác thực tế trước khi báo cáo PASS/FAIL.
- Môi trường đóng gói hiện tại không khởi chạy được Chromium headless, vì vậy không ghi nhận kết quả chạy trình duyệt cho TC44–TC58 trong lần bàn giao này.

## Giới hạn cần giữ minh bạch khi demo

- Nhóm mua, trạng thái tham gia, chia sẻ và yêu cầu/báo giá đấu giá ngược đang dùng `localStorage`; dữ liệu không đồng bộ giữa các trình duyệt/thiết bị. Form người bán là luồng mô phỏng trên cùng trình duyệt, không phải tài khoản/portal người bán có backend.
- Báo giá đảo chiều, Q&A và chính sách mẫu có nhãn DEMO; không phải báo giá người bán thật, đánh giá khách hàng thật hoặc điều khoản giao dịch có hiệu lực.
- Trợ lý mua chung là rule engine tra catalog và dữ liệu nhóm cục bộ; không phải chatbot AI và không xác minh tồn kho.
- Tìm kiếm ảnh ở phiên bản này dùng preview cục bộ và lựa chọn danh mục dự phòng, chưa dùng mô hình embedding. Ảnh không được tải lên máy chủ.

## Kết quả kiểm thử sau khi tích hợp dòng 24–33

Chrome chạy `tests/test-runner.html?auto=1` trên localhost cho kết quả **81/81 đạt**. TC62–73 kiểm tra 12 câu hỏi cho trợ lý. TC74–81 kiểm tra ví Xu, gửi xác nhận và hủy đơn hai lần, thông báo, chia sẻ và chat, đồng bộ khu vực, ảnh không hợp lệ, luồng người bán và thứ tự popup.

Bộ test đã sửa bộ chọn lớp ảnh người mua trong hero và phép so sánh mã sản phẩm đầy đủ ở phần gợi ý. Luồng đấu giá kiểm tra hai báo giá mẫu rồi chọn ở tab so sánh. Luồng chia sẻ kiểm tra riêng Web Share và giao diện QR/sao chép.

Ngoài bộ test, hai tab cùng hồ sơ trình duyệt đã gửi và nhận tin hai chiều. Một nhóm khác có lịch sử riêng. Ở 390 px, bộ lọc khu vực vẫn dùng được khi ảnh tải chậm rồi lỗi. Đường dẫn và tài nguyên nội bộ trên các trang HTML ở thư mục gốc được kiểm tra qua trình duyệt. QR từ dịch vụ ngoài và việc gửi tin thực tế trong ứng dụng của điện thoại chưa được kiểm chứng.

[Checklist bàn giao](Checklist-frontend.csv) · [Kịch bản demo 5 phút](../README.md#kịch-bản-demo-5-phút) · [Ảnh chat 390 px](../screenshots/responsive/2026-11-27/chat-390.png)
