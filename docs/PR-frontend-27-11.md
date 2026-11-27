# PR: Hoàn thiện Front-end theo checklist (27/11/2026)

Nhánh đề xuất: `feature/frontend-checklist`. Không thay đổi logic giỏ hàng, nhóm mua, Xu WeBuy và Seller Center;
các tính năng mới tách thành file riêng và chỉ dùng lại các thuộc tính `data-*` mà `js/app.js` đã xử lý.

## 1. Việc đã làm theo checklist

| # | Task | Đã làm | File |
|---|------|--------|------|
| 1 | Chốt Visual System | Kiểm kê header, banner, card, modal, footer, Seller Center; gom token màu (#0D6B47, #D9FF4F, #FF6B00), font Reddit Sans, cỡ chữ, khoảng cách, bo góc, bóng, nút, icon, chuyển động vào **một** file. `styles.css`, `webuy-theme.css`, `seller-center.css`, `rewards.css` bỏ khai báo màu riêng, mã màu ghi cứng đổi sang biến. Trang style guide minh họa 10 component. | `css/tokens.css`, `style-guide.html` |
| 2 | Cấu trúc lại trang chủ | Thứ tự: header → hero/CTA → danh mục (6 + Tất cả) → nhóm sắp đủ người → sản phẩm nổi bật → cách mua chung (3 bước) → tin cậy/footer. Bỏ khối trùng ý (banner theo mùa, 2 thẻ khuyến mãi, nhóm mẫu tĩnh, timeline 5 bước, giới thiệu ngắn, ô nhận tin). Hai CTA: **Xem nhóm** / **Khám phá sản phẩm**. | `index.html`, `css/home.css`, `js/home.js` |
| 3 | Mở rộng dữ liệu | 24 sản phẩm / 6 danh mục (thêm **Thiết bị điện tử**, **Sắc đẹp**), giữ id 1–8, đủ trường id/name/price/retail/group/category/image/description/minMembers; kiểm tra id trùng khi nạp. Ảnh mới cắt vuông 600×600, WebP. Trang chủ, danh sách, chi tiết, giỏ, yêu thích, so sánh cùng đọc `WEBUY_PRODUCTS`. | `js/catalog-data.js`, `images/`, `js/app.js` |
| 4 | Hero 3D | Cảnh SVG/CSS `perspective` nhiều lớp `translateZ`: 2 người mua, túi mua sắm, thẻ giá, thẻ nhóm mua, 5 đồng xu bay; bóng đổ và vùng sáng chạy theo con trỏ; dao động nhẹ khi không có con trỏ (cảm ứng). Không dùng WebGL, không phải ảnh tĩnh. Tạm dừng khi hero khuất hoặc tab ẩn. | `index.html`, `css/home.css`, `js/home.js` |
| 5 | Hiệu ứng 3D khi cuộn | "Nhóm sắp đủ người" và "3 bước mua chung": thẻ xếp lớp 3D (ảnh, vòng tiến độ, nhãn, số bước tách lớp theo trục Z), parallax theo cuộn, IntersectionObserver chỉ tính khi khối đang hiện; đường nối 3 bước tự vẽ khi cuộn, đồ họa vector phản hồi khi rê chuột/focus. Mobile cường độ 0,45; `prefers-reduced-motion` tắt hẳn. | `css/home.css`, `js/home.js` |
| 6 | Micro-interaction | Bộ class dùng lại: `.fx-tilt` (nghiêng 3D theo con trỏ, focus bàn phím nhấc thẻ như hover), `.fx-press`, `.fx-icon`, `.fx-skeleton` (khung chờ ảnh), `.fx-pop`. Chỉ áp cho thẻ sản phẩm, ô danh mục, nút chính. Chỉ dùng transform/opacity nên không đổi bố cục, không chặn click. | `css/fx.css`, `js/fx.js` |
| 7 | Responsive & tối ưu motion | Kiểm tra 360/390/768/1366 px (và header ở 1024–1600 px); ảnh lazy-load + `decoding=async`; nén ảnh; 1 thẻ tilt tại một thời điểm; fallback tĩnh khi không hỗ trợ 3D. | `screenshots/responsive/2026-11-27/` |
| 8 | Toàn bộ danh mục & filter | Khu **Toàn bộ danh mục** (`products.html#tat-ca-danh-muc`, vào từ menu **Danh mục** và hero); lọc danh mục + tìm tên + khoảng giá nhóm + sắp xếp cùng lúc; số kết quả, chip điều kiện đang áp dụng (bỏ từng cái), nút **Đặt lại**, trạng thái rỗng; mọi điều kiện nằm trên URL. | `products.html`, `js/catalog-render.js`, `js/app.js` |
| 9 | Yêu thích | Tim trên thẻ (trang chủ, danh sách) và trang chi tiết; lối tắt tim + số lượng trên header; mục **Yêu thích của tôi** trong Hồ sơ; lưu mảng ID không trùng ở `localStorage` (`webuy_demo_v2_wishlist`); sản phẩm đã ẩn hiện "không còn hiển thị" + nút xóa/dọn. | `js/wishlist.js`, `profile.html` |
| 10 | So sánh sản phẩm | Tối đa 3 sản phẩm cùng/khác danh mục; khay cố định cuối màn hình; bảng giá lẻ, giá nhóm (đánh dấu thấp nhất), tiết kiệm, số thành viên tối thiểu, mô tả ngắn, nút Xóa mục/Đóng, link xem chi tiết; Esc/ngoài vùng để đóng, giữ focus trong hộp thoại; mobile cuộn ngang, cột tiêu chí cố định, có dòng "Vuốt ngang". | `js/compare.js`, `css/features.css` |

## 2. Vấn đề responsive đã phát hiện và chỉnh

| Màn hình | Vấn đề | Cách chỉnh |
|----------|--------|-----------|
| 1366 px | Thêm mục "Danh mục" + nút tim làm cụm nút header tràn 27 px | Thu khoảng cách menu/nút, ô tìm co giãn (`css/features.css`) |
| 1024–1179 px | Header 1 hàng tràn 29–105 px | Chuyển header 2 hàng như bản tablet |
| 390 / 360 px | Menu 5 mục bị xuống dòng ("Kênh người bán" rơi xuống hàng 2) | Menu 1 hàng, vuốt ngang, mờ mép phải để gợi ý |
| 390 / 360 px | Nút "Khám phá sản phẩm" ở hero gãy 2 dòng | Hai CTA xếp dọc, rộng 100% |
| 390 / 360 px | Thẻ danh mục / nhóm cuộn ngang dính sát mép màn hình | `scroll-padding-inline` 16 px |
| 390 px | Bảng so sánh nằm dưới nút nổi "Điểm danh săn quà" | Hộp thoại so sánh `z-index` 110 (token `--z-modal`) |
| Mọi màn hình | Khay so sánh che nút Xu và thông báo | Đẩy nút Xu / toast lên khi khay hiện, thêm `padding-bottom` cho trang |
| 1366 px | Đường nối 3 bước đè lên thẻ | Đặt đường nối phía trên thẻ, nút tròn là phần tử HTML canh theo cột |
| Mọi màn hình | Ảnh nặng: `value-*.png` 4K (5,2 MB), `product-05/08` (2,8 MB), `TP.HCM.jpeg` 0,8 MB | Đổi sang WebP 1400 px / 800 px, ảnh thành phố 640 px: thư mục `images/` 9,7 MB → 1,2 MB |

Kết quả đo tràn ngang (`scrollWidth` so với độ rộng màn hình) cho 9 trang (gồm style guide) × 4 khổ: không trang nào tràn; số liệu 4 trang chính
lưu ở `screenshots/responsive/2026-11-27/kiem-tra-tran-ngang.json`.

## 3. Kiểm thử

- `tests/test-runner.html` → **Chạy tất cả**: **43/43 PASS** (30 test cũ của nhóm + 7 test Xu WeBuy + 6 test mới TC38–TC43
  cho danh mục, bộ lọc, yêu thích, so sánh). TC03, TC04, TC09, TC28 cập nhật theo dữ liệu 24 sản phẩm và trang chủ mới.
- Kiểm thử thao tác thật bằng trình duyệt tự động: 42/42 đạt (lọc kết hợp + tải lại, chip điều kiện, Đặt lại, trạng thái rỗng,
  thêm/bỏ tim không trùng, sản phẩm đã ẩn, giới hạn 3 sản phẩm so sánh, dữ liệu bảng so sánh, Esc đóng bảng, bảng cuộn ngang trên 390 px).
- Bàn phím: Tab đi qua menu, nút tim, 2 CTA hero, ô danh mục, thẻ sản phẩm, thẻ 3 bước; mọi phần tử nhận focus đều có viền/vòng sáng.
- `prefers-reduced-motion: reduce`: cảnh hero đứng yên, thẻ khi cuộn ở trạng thái cuối, tilt = 0°.
- Không có lỗi JavaScript trên console ở 9 trang × 4 khổ màn hình.

## 4. Ghi chú

- Ảnh sản phẩm 9–23 do nhóm cung cấp. Ảnh son gửi kèm có watermark Shutterstock (ảnh chưa có bản quyền) nên thay bằng ảnh
  miễn phí trên Unsplash (`images/CREDITS.md`); nhóm có ảnh khác thì thay file `images/product-24.webp`.
- Thư mục `webuy-backend-nhi/` (bản backend) giữ nguyên; khi gộp bản backend cần thêm các file mới ở mục 1 vào các trang tương ứng.
- Nội dung trang Giới thiệu, giỏ hàng, thanh toán, Seller Center không đổi (chỉ nhận token màu/font chung và mục menu Danh mục).
