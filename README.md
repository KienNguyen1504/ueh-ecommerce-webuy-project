# WeBuy – Website thương mại điện tử mua chung (HTML, CSS, JavaScript)

**Môn học:** Phát triển ứng dụng WEB/TMĐT – UEH  
**Phạm vi:** Frontend WeBuy cho người mua và người bán. Bản tích hợp tại thư mục này cập nhật theo sheet `CHECKLIST FRONT-END`, dòng 24–33.

## Demo nhóm mua trên hai điện thoại cùng Wi-Fi

Trên máy tính có Python 3.9 trở lên, chạy `python serve_lan.py`. Hai điện thoại và máy tính cùng kết nối Wi-Fi. Mở địa chỉ `http://<IP Wi-Fi của máy tính>:5517/` mà chương trình in ra. Giữ máy tính và chương trình chạy trong suốt buổi demo.

1. Để demo với đúng hai máy, chọn áo thun cotton Essential (`product-detail.html?id=2`, nhóm cần hai người). Máy A mở sản phẩm, chọn **Tạo nhóm** rồi **Chia sẻ cho bạn bè**. Nếu trình duyệt chưa hỗ trợ chia sẻ qua ứng dụng trên HTTP, chọn **Sao chép** rồi gửi liên kết.
2. Máy B mở link, chọn **Tham gia nhóm** rồi **Chat nhóm**. Máy A thấy tiến độ mới và tin nhắn sau khoảng 1–2 giây. Muốn hiện tên riêng khi gửi, lưu tên trong **Hồ sơ** trên từng máy.
3. Tải lại trang hoặc mở lại từ **Hồ sơ** để đọc lịch sử. Máy chủ dùng SQLite trong `.webuy-lan/groups.sqlite3` và nhận diện mỗi trình duyệt bằng cookie. Một nhóm có thể tham gia tới khi đủ người hoặc hết hạn.

Kiểm thử API bằng `python -B tests/test_lan_sync.py`. Ba ca kiểm tra quyền vào chat, tin nhắn gửi lại, tranh suất cuối, lưu lịch sử và hết hạn trên cơ sở dữ liệu tạm.

Nếu điện thoại chưa mở được trang, kiểm tra hai máy có cùng Wi-Fi, mạng cho phép các thiết bị kết nối với nhau và Windows cho phép cổng TCP 5517 trên mạng riêng. Đơn, Xu và thông tin nhận hàng vẫn lưu riêng trên từng máy. Live Server hoặc `python -m http.server` chạy bản tĩnh để kiểm thử demo cũ.

## Chạy bản bàn giao

Mở thư mục chứa `index.html` bằng Live Server hoặc chạy `python -m http.server 8000` trong thư mục này rồi vào `http://localhost:8000`. Người mua bắt đầu tại [trang chủ](index.html). Người bán vào [Seller Center](seller-center.html). Cùng một địa chỉ và trình duyệt sẽ giữ hồ sơ, nhóm mua, đơn và ví Xu qua các lần tải lại.

- [Checklist 10 dòng cuối](docs/Checklist-frontend.csv)
- [Kịch bản demo 5 phút](#kịch-bản-demo-5-phút)
- [Bộ kiểm thử trình duyệt](tests/test-runner.html)

## 1. Giới thiệu và mục tiêu

WeBuy là website thương mại điện tử mô phỏng mô hình **mua chung theo nhóm**. Dự án hướng đến việc giúp người dùng xem sản phẩm, so sánh giá mua lẻ và giá mua chung, tìm kiếm/lọc sản phẩm, xem thông tin chi tiết và thao tác với giỏ hàng. Mục tiêu học tập của Buổi 3 là chuyển giao diện HTML/CSS ở các buổi trước thành website có tương tác JavaScript, sử dụng nguồn dữ liệu chung và phối hợp mã nguồn trên GitHub.

**Lưu ý:** Đây là bản **frontend demo**, không phải website bán hàng vận hành thực tế.

## 2. Phân công Buổi 3 và phạm vi bàn giao hiện tại

| Thành viên | Phần việc được phân công trong Buổi 3 |
| --- | --- |
| **Nhi** | Bước 1: phân công, chuẩn bị và thống nhất cấu trúc dự án; Bước 8: rà soát GitHub, tổng hợp README và báo cáo. |
| **Hoa** | Bước 2: chuẩn hóa dữ liệu và hiển thị danh sách sản phẩm bằng JavaScript. |
| **Hưng** | Bước 3: tìm kiếm, lọc và sắp xếp sản phẩm. |
| **Kiên** | Bước 4: tích hợp trang chi tiết sản phẩm; hỗ trợ quản lý repository và tích hợp mã nguồn. |
| **Phương** | Bước 5: xây dựng chức năng giỏ hàng. |
| **Thắng** | Bước 6: lưu trữ và khôi phục dữ liệu trên trình duyệt. |
| **Tuệ** | Bước 7: xây dựng tình huống kiểm thử, kiểm tra các chức năng sau tích hợp. |

Bảng trên lưu phân công lịch sử của Buổi 3. Sheet hiện tại để trống cột PIC ở dòng 24–33. Bản bàn giao ghi từng hạng mục, trạng thái và ca kiểm thử trong checklist đính kèm.

## 3. Công nghệ sử dụng

- **HTML5:** cấu trúc các trang và biểu mẫu.
- **CSS3:** giao diện, bố cục và hiển thị trên các kích thước màn hình.
- **JavaScript thuần (Vanilla JS):** dữ liệu sản phẩm, tìm kiếm/lọc/sắp xếp, điều hướng chi tiết, giỏ hàng và logic mua chung demo.
- **`localStorage`:** lưu trạng thái giỏ hàng, nhóm mua, hồ sơ và đơn hàng demo trong cùng trình duyệt.
- **Git/GitHub:** quản lý phiên bản và phối hợp làm bài nhóm; **Visual Studio Code + Live Server:** hỗ trợ chạy thử tại máy.

Frontend ở thư mục gốc chạy bằng HTML/CSS/JavaScript và localStorage. Thư mục `webuy-backend-nhi/` chứa phần tích hợp backend riêng.

## 4. Tính năng Frontend mở rộng (27/11/2026)

- **Chi tiết sản phẩm:** chuẩn hóa nội dung theo `WEBUY_PRODUCTS`, hiển thị giá/điều kiện nhóm, thông tin chưa có dữ liệu được ghi rõ; Q&A và chính sách mẫu có nhãn DEMO, không tạo đánh giá khách hàng hoặc lượt mua giả.
- **Gợi ý liên quan:** 4–6 sản phẩm lấy từ catalog, ưu tiên cùng danh mục rồi đến giá nhóm gần; không lặp sản phẩm hiện tại và có trạng thái rỗng/fallback ảnh.
- **Nhóm mua:** chặn tạo trùng nhóm cá nhân đang mở cho cùng sản phẩm; thêm Group Hub tại `groups.html`, lọc danh mục/khu vực/nhóm còn thiếu một người; chia sẻ bằng Web Share, copy link và QR URL.
- **Đấu giá ngược:** `reverse-bidding.html` có ba bước riêng: Người mua tạo yêu cầu; Người bán gửi báo giá bằng form (tên cửa hàng, giá chào, thời gian giao, ghi chú); Người mua so sánh và chọn báo giá. Mỗi yêu cầu khởi tạo 2 báo giá mẫu DEMO; người bán có thể bổ sung báo giá DEMO trên cùng trình duyệt. Chọn báo giá sẽ khóa yêu cầu; yêu cầu hết hạn tự khóa.
- **Trợ lý mua chung:** widget rule-engine tìm trên `WEBUY_PRODUCTS` và trạng thái nhóm localStorage; không sử dụng API key LLM và không tự khẳng định tồn kho.
- **Tìm kiếm hình ảnh MVP:** nút camera mở preview cục bộ; chế độ hiện tại dùng bộ chọn danh mục dự phòng và hiển thị tối đa ba gợi ý tương tự, không tải ảnh lên server.

**Lưu trữ:** bản Wi-Fi lưu nhóm mua và tin nhắn trên máy chủ. Bản tĩnh lưu nhóm trên trình duyệt. Đấu giá ngược dùng localStorage ở cả hai chế độ. Báo giá và Q&A có nhãn DEMO, không phải chào giá hoặc đánh giá thật. Tìm kiếm ảnh hiện dùng danh mục dự phòng, chưa chạy embedding client-side.

### Đơn nhóm, ví Xu và cửa hàng

- Ở trang chi tiết, chọn thời gian chốt rồi tạo nhóm. Các nhóm đã tham gia có nút **Chia sẻ cho bạn bè** và **Chat nhóm** trong chi tiết, Giỏ hàng và Hồ sơ. Link mời mang mã sản phẩm và mã nhóm. Trình duyệt hỗ trợ Web Share sẽ mở danh sách ứng dụng của thiết bị. Hộp dự phòng cho sao chép và quét QR. QR dùng dịch vụ ảnh bên ngoài.
- Chat hiển thị tên người gửi, thời gian và tiến độ nhóm. Bản Wi-Fi đồng bộ giữa thiết bị qua máy chủ. Bản tĩnh giữ lịch sử riêng trong trình duyệt.
- Ví thưởng cộng tổng 140 xu trong chuỗi bảy ngày. Hai mini game tính lượt riêng và thưởng từ 5 đến 30 xu. Checkout tính trước mức giảm tối đa 10% và lưu cùng đơn. Hủy đơn ở Hồ sơ hoàn xu một lần theo mã đơn.
- Chuông thông báo hiển thị nhắc điểm danh, thay đổi số dư và sự kiện nhóm của người dùng. Có trạng thái đã đọc, chưa đọc và xóa. Group Hub dùng khu vực đã chọn trên header.
- Cửa hàng có đường dẫn từ Dashboard và chi tiết sản phẩm đã đăng. Thông tin người mua và người bán lấy từ dữ liệu demo trong cùng trình duyệt. [Chính sách](policy.html) và [FAQ](faq.html) có ở chân trang.

### Kịch bản demo 5 phút

| Thời gian | Người trình bày thao tác | Màn hình cần thấy |
| --- | --- | --- |
| 0:00–0:45 | Chọn khu vực ở trang chủ, mở Xu và nhận điểm danh. | Header hiện khu vực và số dư. Với ví mới, ngày đầu nhận 10 xu. |
| 0:45–1:45 | Mở Balo canvas Everyday, chọn hạn chốt 6 giờ và tạo nhóm. Chọn chia sẻ, sau đó vào chat gửi một tin. | Liên kết chứa mã nhóm. Chat hiện tin vừa gửi và thời hạn. |
| 1:45–2:30 | Trên Wi-Fi, các máy khác tham gia bằng link cho tới khi đủ người. Ở bản tĩnh, dùng nút mô phỏng. Mở chuông rồi sang Giỏ hàng. | Nhóm đạt 3/3. Giỏ cho xác nhận giá nhóm 249.000đ. |
| 2:30–3:20 | Bật Dùng Xu, nhập thông tin nhận hàng, xác nhận rồi mở Hồ sơ. | Đơn một balo dùng 10 xu còn 248.000đ. Hủy đơn để thấy 10 xu trở về ví. |
| 3:20–5:00 | Vào Kênh người bán, đăng ký cửa hàng demo. Đăng một sản phẩm có ảnh rồi mở trang cửa hàng. Ẩn sản phẩm và tải lại trang cửa hàng. | Dashboard cập nhật số sản phẩm đang hiển thị. Người mua thấy sản phẩm sau khi đăng và không còn thấy sau khi ẩn. |

## 5. Cấu trúc thư mục

```text
ueh-ecommerce-webuy-project/
├── index.html                 # Trang chủ
├── products.html              # Danh sách, tìm kiếm, lọc, sắp xếp
├── groups.html                # Group Hub – nhóm mua đang mở
├── reverse-bidding.html       # MVP đấu giá ngược (báo giá DEMO)
├── product-detail.html        # Chi tiết sản phẩm, Q&A DEMO, gợi ý liên quan và mua chung
├── cart.html                  # Giỏ hàng
├── checkout.html              # Xác nhận đơn hàng demo
├── profile.html               # Hồ sơ và lịch sử đơn demo
├── about.html                 # Giới thiệu WeBuy
├── header.html                # Thành phần giao diện header
├── footer.html                # Thành phần giao diện footer
├── style-guide.html           # Style guide: token + 10 component minh họa
├── css/
│   ├── tokens.css             # Token dùng chung (màu, chữ, khoảng cách, bóng, chuyển động) – nạp đầu tiên
│   ├── fx.css                 # Micro-interaction dùng lại (.fx-tilt, .fx-press, .fx-icon, .fx-skeleton)
│   ├── features.css           # Danh mục & bộ lọc, Yêu thích, So sánh
│   └── styles.css, app.css, webuy-theme.css, home.css...
├── js/
│   ├── catalog-data.js        # Dữ liệu dùng chung: catalog và sản phẩm người bán
│   ├── catalog-render.js      # Khu "Toàn bộ danh mục" + thẻ sản phẩm (products.html)
│   ├── home.js                # Trang chủ: hero 3D, nhóm sắp đủ người, hiệu ứng cuộn 3D
│   ├── fx.js                  # Tilt 3D theo con trỏ, skeleton ảnh
│   ├── wishlist.js            # Yêu thích (localStorage, mục trong Hồ sơ)
│   ├── compare.js             # So sánh tối đa 3 sản phẩm
│   ├── groups-hub.js           # Group Hub – lọc nhóm mua
│   ├── group-sharing.js        # Chia sẻ nhóm: Web Share, copy, QR
│   ├── reverse-bidding.js     # MVP đấu giá ngược (báo giá DEMO)
│   ├── product-detail-extras.js # Q&A DEMO, thông tin và gợi ý liên quan
│   ├── weby-assistant.js     # Trợ lý mua chung theo rule engine
│   ├── image-search.js        # Tìm hình ảnh MVP theo danh mục dự phòng
│   ├── image-fallback.js      # Fallback ảnh lỗi
│   ├── feature-shell.js       # Bổ sung link điều hướng tính năng
│   └── app.js                 # Giỏ hàng, nhóm mua, lọc và điều phối giao diện
├── images/                    # Hình ảnh sản phẩm/giao diện
├── docs/PR-frontend-27-11.md  # Ghi chú PR: việc đã làm, lỗi responsive đã chỉnh, kết quả kiểm thử
├── screenshots/responsive/    # Minh chứng responsive (bản 27/11: 360/390/768/1366 px)
├── CHECKLIST.md               # Checklist thiết kế từ Buổi 2
└── README.md                  # Tài liệu hướng dẫn dự án
```

## 6. Chức năng có mã nguồn triển khai

Qua rà soát tệp trong repository, **có mã nguồn** cho các chức năng sau (việc chạy đúng trên trình duyệt cần đối chiếu với mục 7):

1. **Danh sách sản phẩm:** lấy dữ liệu từ `js/catalog-data.js`, gồm 24 sản phẩm thuộc 6 danh mục (Balo & túi ví, Áo thun, Thiết bị gia dụng, Trang sức, Thiết bị điện tử, Sắc đẹp).
2. **Tìm kiếm, lọc, sắp xếp:** khu "Toàn bộ danh mục" (vào từ menu **Sản phẩm** hoặc nút **Khám phá sản phẩm** ở trang chủ); tìm theo tên, lọc danh mục, khoảng **giá mua chung** và sắp xếp dùng đồng thời; hiện số kết quả, các điều kiện đang áp dụng, nút **Đặt lại** và trạng thái rỗng; bộ lọc nằm trên URL nên tải lại trang không mất.
3. **Chi tiết sản phẩm:** thay đổi nội dung theo tham số `id` trên URL, hiển thị thông tin và lựa chọn mua.
4. **Giỏ hàng:** thêm sản phẩm, thay đổi số lượng, xóa sản phẩm, xem tạm tính và trạng thái mục mua chung.
5. **Lưu dữ liệu:** sử dụng `localStorage` để giữ dữ liệu demo khi chuyển trang hoặc tải lại trang trên cùng trình duyệt.
6. **Mua chung mô phỏng:** tham gia/tạo nhóm, cập nhật tiến độ nhóm và kiểm tra điều kiện đủ thành viên.
7. **Hồ sơ và xác nhận đơn demo:** nhập thông tin, lưu đơn thử nghiệm trong trình duyệt, xem lịch sử demo.
8. **Yêu thích:** nút tim trên thẻ sản phẩm và trang chi tiết; mục **Yêu thích của tôi** trong Hồ sơ; lưu danh sách ID không trùng trong `localStorage`, sản phẩm đã ẩn được đánh dấu và xóa được.
9. **So sánh sản phẩm:** chọn tối đa 3 sản phẩm (cùng hoặc khác danh mục); khay so sánh cuối màn hình và bảng so sánh giá lẻ, giá nhóm, số thành viên tối thiểu, mô tả ngắn; trên mobile bảng cuộn ngang có hướng dẫn.
10. **Giao diện:** token dùng chung (`css/tokens.css`) và `style-guide.html`; hero 3D (SVG/CSS perspective) chuyển động theo con trỏ; thẻ xếp lớp 3D và parallax khi cuộn; micro-interaction dùng lại; tự giảm/tắt hiệu ứng trên mobile và khi bật "giảm chuyển động".

**Chưa triển khai thực tế:** đăng nhập/xác thực, cơ sở dữ liệu dùng chung giữa nhiều thiết bị, thanh toán trực tuyến, xử lý đơn/giao hàng và ghép nhóm người dùng thật. Các số lượng thành viên nhóm khởi tạo là dữ liệu mô phỏng.

## Chạy bằng Live Server

1. Mở repository: <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project>.
2. Chọn **Code → Download ZIP** rồi giải nén; hoặc dùng lệnh:

   ```bash
   git clone https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project.git
   ```

3. Mở thư mục dự án trong **Visual Studio Code**.
4. Cài extension **Live Server** (nếu chưa có); nhấp phải `index.html` và chọn **Open with Live Server**.
5. Từ trang chủ, mở **Danh sách sản phẩm**, **Chi tiết sản phẩm**, **Giỏ hàng** và thử các thao tác JavaScript.

Không cần cài đặt Node.js, cơ sở dữ liệu hay chạy lệnh `npm install` cho phiên bản này. Nên dùng Live Server để kiểm tra tính năng lưu dữ liệu trong trình duyệt.

## 7. Các tình huống kiểm tra thủ công

| Mã | Thao tác kiểm thử | Kết quả mong đợi |
| --- | --- | --- |
| TC01 | Mở `index.html` và chuyển giữa các trang qua menu. | Liên kết điều hướng đúng, không xuất hiện trang lỗi. |
| TC02 | Mở `products.html`. | Hiển thị đủ 24 sản phẩm với tên, ảnh và giá tương ứng. |
| TC03 | Nhập tên sản phẩm có trong danh sách; sau đó nhập `xyz999`. | Kết quả được lọc đúng; từ khóa không tồn tại có trạng thái không tìm thấy phù hợp. |
| TC04 | Chọn danh mục **Balo & túi ví**, sắp xếp giá mua lẻ tăng dần. | Balo 299.000đ đứng trước túi đeo chéo 379.000đ. |
| TC05 | Lọc theo khoảng giá mua chung rồi đặt lại bộ lọc. | Sản phẩm nằm trong khoảng giá được hiển thị; đặt lại khôi phục danh sách. |
| TC06 | Chọn một sản phẩm từ danh sách. | Trang chi tiết hiển thị đúng sản phẩm theo `?id=...`. |
| TC07 | Thêm sản phẩm vào giỏ, đổi số lượng và xóa sản phẩm. | Số lượng và tạm tính thay đổi phù hợp; sản phẩm được xóa khỏi giỏ. |
| TC08 | Thêm sản phẩm, tải lại trang hoặc chuyển trang rồi trở lại giỏ. | Dữ liệu giỏ hàng demo vẫn được lưu trên cùng trình duyệt. |
| TC09 | Thử tạo/tham gia nhóm và điều kiện đủ thành viên. | Tiến độ nhóm thay đổi theo thao tác demo; nhóm chưa đủ người không được xác nhận với giá nhóm. |
| TC10 | Xác nhận một đơn mua lẻ demo và mở trang hồ sơ. | Đơn demo được lưu và hiển thị trong lịch sử; không phát sinh thanh toán thật. |
| TC11 | Menu **Sản phẩm** → khu Toàn bộ danh mục → chọn "Thiết bị điện tử", tìm "loa", sắp xếp giá nhóm giảm dần, tải lại trang. | Còn đúng các sản phẩm phù hợp; bộ lọc giữ nguyên sau khi tải lại; **Đặt lại** trả về đủ 24 sản phẩm. |
| TC12 | Bấm tim trên một thẻ → mở **Hồ sơ › Yêu thích của tôi** → tải lại → bấm **Xóa**. | Sản phẩm xuất hiện trong Hồ sơ, còn sau khi tải lại và xóa được; không thêm trùng. |
| TC13 | Chọn **So sánh** 4 sản phẩm → **So sánh ngay**. | Chỉ giữ 3 sản phẩm, báo vượt giới hạn; bảng đúng giá lẻ, giá nhóm, số thành viên tối thiểu. |
| TC14 | Mở trang chủ, rê chuột trên hero, cuộn xuống phần "Nhóm sắp đủ người" và "3 bước". | Cảnh 3D nghiêng theo con trỏ; thẻ xếp lớp tách lớp khi cuộn; chữ và nút luôn đọc được. |

**Kết quả trên Chrome:** 81/81 ca tự động đạt. Bảng trên là các tình huống thủ công để trình bày. Chạy lại toàn bộ bằng `tests/test-runner.html?auto=1`. Có thể đối chiếu ảnh trong `screenshots/responsive/2026-11-27/`.

## 8. Vấn đề kỹ thuật và hướng xử lý

| Vấn đề cần xử lý | Cách xử lý thể hiện trong mã nguồn / giới hạn hiện tại |
| --- | --- |
| Dữ liệu sản phẩm cần thống nhất giữa danh sách, chi tiết và giỏ hàng. | Tập trung 24 sản phẩm và 6 danh mục trong `js/catalog-data.js` để mọi trang (trang chủ, danh sách, chi tiết, giỏ, yêu thích, so sánh) dùng chung. |
| Cần phân biệt **giá mua lẻ** và **giá mua chung** khi lọc/sắp xếp/tính tiền. | Dữ liệu sử dụng các trường `price`/`retail` và `group`; có logic sắp xếp theo từng loại giá. |
| Giỏ hàng dễ mất dữ liệu khi chuyển trang hoặc tải lại. | Triển khai đọc/ghi `localStorage`, đồng thời kiểm tra định dạng dữ liệu khi khôi phục. |
| Mô hình mua chung cần nhiều người dùng và cơ sở dữ liệu dùng chung. | Phiên bản hiện tại chỉ **mô phỏng trong trình duyệt**; đây là giới hạn chưa khắc phục ở cấp độ hệ thống thực. |

*Các dòng trên được tổng hợp từ thiết kế và mã nguồn. Nhóm cần bổ sung lỗi thực tế, người xử lý và minh chứng sửa lỗi từ quá trình kiểm thử nếu có.*

## 9. Quản lý GitHub và liên kết dự án

- **Repository chính:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project>
- **Nhánh tích hợp của repository:** `main`. Thư mục bàn giao là bản giải nén, chưa có commit hoặc PR cho các chỉnh sửa này. Đã kiểm thử source ở localhost. Chưa xác nhận bản này trên GitHub Pages.
- **Lịch sử cập nhật:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project/commits/main/>
- **Pull requests:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project/pulls>
- **Issues:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project/issues>

**Quy trình nhóm cần đối chiếu với minh chứng GitHub:** Phân công → phát triển theo nhiệm vụ → commit/push → rà soát thay đổi → tích hợp lên `main` → kiểm thử lại. Không bắt buộc mỗi người phải có branch riêng, nhưng cần chứng minh phần việc đã đóng góp bằng commit, PR hoặc bảng phân công và tệp kết quả tương ứng.

## 10. Công cụ AI đã sử dụng hỗ trợ

- **ChatGPT:** hỗ trợ rà soát yêu cầu Bước 8, hệ thống hóa nội dung README và đề xuất tình huống kiểm thử dựa trên mã nguồn, tài liệu đang có.
- **Phạm vi kiểm soát:** Codex hỗ trợ sửa trực tiếp frontend và chạy bộ kiểm thử trong Chrome, gồm các luồng nhóm mua, checkout Xu và Seller Center.
- **Thông tin cần bổ sung nếu áp dụng:** các thành viên cập nhật thêm những phần code, giao diện hoặc testcase có dùng AI và cách tự kiểm tra/chỉnh sửa; không mặc định toàn bộ mã nguồn do AI tạo ra.

---

**Nguồn:** Nhóm tác giả. Tài liệu tổng hợp từ repository công khai và bảng phân công Buổi 3; những kết quả chưa được chạy kiểm thử trực tiếp được ghi rõ để nhóm xác minh.

## 11. Bổ sung Front-end (checklist 27/11/2026)

| Hạng mục | Kết quả | File chính |
| --- | --- | --- |
| Chốt Visual System | 1 file token dùng chung + trang style guide 10 component | `css/tokens.css`, `style-guide.html` |
| Cấu trúc lại trang chủ | Header → hero/CTA → danh mục → nhóm sắp đủ người → sản phẩm nổi bật → cách mua chung → tin cậy/footer | `index.html`, `css/home.css` |
| Mở rộng dữ liệu | 24 sản phẩm / 6 danh mục, giữ id 1–8, ảnh WebP tối ưu | `js/catalog-data.js`, `images/` |
| Hero 3D | Cảnh SVG/CSS perspective (người mua, túi, thẻ giá, đồng xu) theo con trỏ + vòng lặp nhẹ | `index.html`, `js/home.js` |
| 3D khi cuộn | Thẻ xếp lớp 3D, parallax, IntersectionObserver; mobile giảm, `prefers-reduced-motion` tắt | `js/home.js`, `css/home.css` |
| Micro-interaction | `.fx-tilt`, `.fx-press`, `.fx-icon`, `.fx-skeleton`, `.fx-pop` | `css/fx.css`, `js/fx.js` |
| Responsive & tối ưu | Kiểm tra 360/390/768/1366 px, không tràn ngang, ảnh 9,8 MB → 1,4 MB | `screenshots/responsive/2026-11-27/` |
| Danh mục & filter | Khu toàn bộ danh mục, lọc kết hợp, số kết quả, Đặt lại, trạng thái rỗng, giữ trên URL | `products.html`, `js/catalog-render.js` |
| Yêu thích | Tim trên thẻ + chi tiết, mục trong Hồ sơ, localStorage | `js/wishlist.js` |
| So sánh | Tối đa 3 sản phẩm, bảng so sánh, mobile cuộn ngang | `js/compare.js` |

Chi tiết phần mở rộng: `docs/FRONTEND-ENHANCEMENTS-27-11.md`; nhật ký kiểm tra trước đó: `docs/PR-frontend-27-11.md`. Bộ kiểm thử phiên bản đầu có 61 case, mở `tests/test-runner.html` bằng Live Server → **Chạy kiểm thử**. TC57–TC58 kiểm tra trang đấu giá ngược và tự khóa khi hết hạn; TC59–TC61 kiểm tra form người bán, lưu báo giá và luồng người mua chọn báo giá. Kết quả bản bàn giao ở bảng checklist một sheet phía trên.

