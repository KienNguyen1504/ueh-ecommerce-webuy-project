# WeBuy – Website thương mại điện tử mua chung (HTML, CSS, JavaScript)

**Môn học:** Phát triển ứng dụng WEB/TMĐT – UEH  
**Phạm vi:** Bài tập nhóm Buổi 3 – tích hợp JavaScript trên giao diện WeBuy.

## 1. Giới thiệu và mục tiêu

WeBuy là website thương mại điện tử mô phỏng mô hình **mua chung theo nhóm**. Dự án hướng đến việc giúp người dùng xem sản phẩm, so sánh giá mua lẻ và giá mua chung, tìm kiếm/lọc sản phẩm, xem thông tin chi tiết và thao tác với giỏ hàng. Mục tiêu học tập của Buổi 3 là chuyển giao diện HTML/CSS ở các buổi trước thành website có tương tác JavaScript, sử dụng nguồn dữ liệu chung và phối hợp mã nguồn trên GitHub.

**Lưu ý:** Đây là bản **frontend demo**, không phải website bán hàng vận hành thực tế.

## 2. Thành viên và phân công nhiệm vụ

| Thành viên | Phần việc được phân công trong Buổi 3 |
| --- | --- |
| **Nhi** | Bước 1: phân công, chuẩn bị và thống nhất cấu trúc dự án; Bước 8: rà soát GitHub, tổng hợp README và báo cáo. |
| **Hoa** | Bước 2: chuẩn hóa dữ liệu và hiển thị danh sách sản phẩm bằng JavaScript. |
| **Hưng** | Bước 3: tìm kiếm, lọc và sắp xếp sản phẩm. |
| **Kiên** | Bước 4: tích hợp trang chi tiết sản phẩm; hỗ trợ quản lý repository và tích hợp mã nguồn. |
| **Phương** | Bước 5: xây dựng chức năng giỏ hàng. |
| **Thắng** | Bước 6: lưu trữ và khôi phục dữ liệu trên trình duyệt. |
| **Tuệ** | Bước 7: xây dựng tình huống kiểm thử, kiểm tra các chức năng sau tích hợp. |

*Bảng thể hiện nhiệm vụ được giao, không thay thế minh chứng commit hoặc kết quả kiểm thử của từng thành viên.*

## 3. Công nghệ sử dụng

- **HTML5:** cấu trúc các trang và biểu mẫu.
- **CSS3:** giao diện, bố cục và hiển thị trên các kích thước màn hình.
- **JavaScript thuần (Vanilla JS):** dữ liệu sản phẩm, tìm kiếm/lọc/sắp xếp, điều hướng chi tiết, giỏ hàng và logic mua chung demo.
- **`localStorage`:** lưu trạng thái giỏ hàng, nhóm mua, hồ sơ và đơn hàng demo trong cùng trình duyệt.
- **Git/GitHub:** quản lý phiên bản và phối hợp làm bài nhóm; **Visual Studio Code + Live Server:** hỗ trợ chạy thử tại máy.

Dự án hiện không sử dụng framework frontend, backend hoặc cơ sở dữ liệu máy chủ.

## 4. Cấu trúc thư mục

```text
ueh-ecommerce-webuy-project/
├── index.html                 # Trang chủ
├── products.html              # Danh sách, tìm kiếm, lọc, sắp xếp
├── product-detail.html        # Chi tiết sản phẩm và mua chung demo
├── cart.html                  # Giỏ hàng
├── checkout.html              # Xác nhận đơn hàng demo
├── profile.html               # Hồ sơ và lịch sử đơn demo
├── about.html                 # Giới thiệu WeBuy
├── header.html                # Thành phần giao diện header
├── footer.html                # Thành phần giao diện footer
├── css/                       # CSS giao diện (styles.css, home.css, app.css...)
├── js/
│   ├── catalog-data.js        # Dữ liệu dùng chung của 8 sản phẩm
│   └── app.js                 # Xử lý các tính năng JavaScript
├── images/                    # Hình ảnh sản phẩm/giao diện
├── screenshots/responsive/    # Minh chứng giao diện responsive
├── CHECKLIST.md               # Checklist thiết kế từ Buổi 2
└── README.md                  # Tài liệu hướng dẫn dự án
```

## 5. Chức năng có mã nguồn triển khai

Qua rà soát tệp trong repository, **có mã nguồn** cho các chức năng sau (việc chạy đúng trên trình duyệt cần đối chiếu với mục 7):

1. **Danh sách sản phẩm:** lấy dữ liệu từ `js/catalog-data.js`, gồm 8 sản phẩm thuộc 4 danh mục.
2. **Tìm kiếm, lọc, sắp xếp:** tìm theo tên; lọc theo danh mục và khoảng **giá mua chung**; sắp xếp tăng/giảm theo **giá mua lẻ** hoặc **giá mua chung**.
3. **Chi tiết sản phẩm:** thay đổi nội dung theo tham số `id` trên URL, hiển thị thông tin và lựa chọn mua.
4. **Giỏ hàng:** thêm sản phẩm, thay đổi số lượng, xóa sản phẩm, xem tạm tính và trạng thái mục mua chung.
5. **Lưu dữ liệu:** sử dụng `localStorage` để giữ dữ liệu demo khi chuyển trang hoặc tải lại trang trên cùng trình duyệt.
6. **Mua chung mô phỏng:** tham gia/tạo nhóm, cập nhật tiến độ nhóm và kiểm tra điều kiện đủ thành viên.
7. **Hồ sơ và xác nhận đơn demo:** nhập thông tin, lưu đơn thử nghiệm trong trình duyệt, xem lịch sử demo.

**Chưa triển khai thực tế:** đăng nhập/xác thực, cơ sở dữ liệu dùng chung giữa nhiều thiết bị, thanh toán trực tuyến, xử lý đơn/giao hàng và ghép nhóm người dùng thật. Các số lượng thành viên nhóm khởi tạo là dữ liệu mô phỏng.

## 6. Hướng dẫn chạy website

1. Mở repository: <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project>.
2. Chọn **Code → Download ZIP** rồi giải nén; hoặc dùng lệnh:

   ```bash
   git clone https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project.git
   ```

3. Mở thư mục dự án trong **Visual Studio Code**.
4. Cài extension **Live Server** (nếu chưa có); nhấp phải `index.html` và chọn **Open with Live Server**.
5. Từ trang chủ, mở **Danh sách sản phẩm**, **Chi tiết sản phẩm**, **Giỏ hàng** và thử các thao tác JavaScript.

Không cần cài đặt Node.js, cơ sở dữ liệu hay chạy lệnh `npm install` cho phiên bản này. Nên dùng Live Server để kiểm tra tính năng lưu dữ liệu trong trình duyệt.

## 7. Hướng dẫn kiểm thử các chức năng chính

| Mã | Thao tác kiểm thử | Kết quả mong đợi |
| --- | --- | --- |
| TC01 | Mở `index.html` và chuyển giữa các trang qua menu. | Liên kết điều hướng đúng, không xuất hiện trang lỗi. |
| TC02 | Mở `products.html`. | Hiển thị đủ 8 sản phẩm với tên, ảnh và giá tương ứng. |
| TC03 | Nhập tên sản phẩm có trong danh sách; sau đó nhập `xyz999`. | Kết quả được lọc đúng; từ khóa không tồn tại có trạng thái không tìm thấy phù hợp. |
| TC04 | Chọn danh mục **Balo & túi ví**, sắp xếp giá mua lẻ tăng dần. | Balo 299.000đ đứng trước túi đeo chéo 379.000đ. |
| TC05 | Lọc theo khoảng giá mua chung rồi đặt lại bộ lọc. | Sản phẩm nằm trong khoảng giá được hiển thị; đặt lại khôi phục danh sách. |
| TC06 | Chọn một sản phẩm từ danh sách. | Trang chi tiết hiển thị đúng sản phẩm theo `?id=...`. |
| TC07 | Thêm sản phẩm vào giỏ, đổi số lượng và xóa sản phẩm. | Số lượng và tạm tính thay đổi phù hợp; sản phẩm được xóa khỏi giỏ. |
| TC08 | Thêm sản phẩm, tải lại trang hoặc chuyển trang rồi trở lại giỏ. | Dữ liệu giỏ hàng demo vẫn được lưu trên cùng trình duyệt. |
| TC09 | Thử tạo/tham gia nhóm và điều kiện đủ thành viên. | Tiến độ nhóm thay đổi theo thao tác demo; nhóm chưa đủ người không được xác nhận với giá nhóm. |
| TC10 | Xác nhận một đơn mua lẻ demo và mở trang hồ sơ. | Đơn demo được lưu và hiển thị trong lịch sử; không phát sinh thanh toán thật. |

**Trạng thái kiểm thử:** Đây là bộ tình huống và kết quả **mong đợi**; nhóm cần chạy thực tế, ghi **Đạt/Không đạt**, kèm ảnh chụp hoặc liên kết minh chứng trước khi tuyên bố hoàn tất kiểm thử.

## 8. Vấn đề kỹ thuật và hướng xử lý

| Vấn đề cần xử lý | Cách xử lý thể hiện trong mã nguồn / giới hạn hiện tại |
| --- | --- |
| Dữ liệu sản phẩm cần thống nhất giữa danh sách, chi tiết và giỏ hàng. | Tập trung danh sách 8 sản phẩm trong `js/catalog-data.js` để các trang JavaScript sử dụng chung. |
| Cần phân biệt **giá mua lẻ** và **giá mua chung** khi lọc/sắp xếp/tính tiền. | Dữ liệu sử dụng các trường `price`/`retail` và `group`; có logic sắp xếp theo từng loại giá. |
| Giỏ hàng dễ mất dữ liệu khi chuyển trang hoặc tải lại. | Triển khai đọc/ghi `localStorage`, đồng thời kiểm tra định dạng dữ liệu khi khôi phục. |
| Mô hình mua chung cần nhiều người dùng và cơ sở dữ liệu dùng chung. | Phiên bản hiện tại chỉ **mô phỏng trong trình duyệt**; đây là giới hạn chưa khắc phục ở cấp độ hệ thống thực. |

*Các dòng trên được tổng hợp từ thiết kế và mã nguồn. Nhóm cần bổ sung lỗi thực tế, người xử lý và minh chứng sửa lỗi từ quá trình kiểm thử nếu có.*

## 9. Quản lý GitHub và liên kết dự án

- **Repository chính:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project>
- **Nhánh tích hợp:** `main`.
- **Lịch sử cập nhật:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project/commits/main/>
- **Pull requests:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project/pulls>
- **Issues:** <https://github.com/KienNguyen1504/ueh-ecommerce-webuy-project/issues>

**Quy trình nhóm cần đối chiếu với minh chứng GitHub:** Phân công → phát triển theo nhiệm vụ → commit/push → rà soát thay đổi → tích hợp lên `main` → kiểm thử lại. Không bắt buộc mỗi người phải có branch riêng, nhưng cần chứng minh phần việc đã đóng góp bằng commit, PR hoặc bảng phân công và tệp kết quả tương ứng.

## 10. Công cụ AI đã sử dụng hỗ trợ

- **ChatGPT:** hỗ trợ rà soát yêu cầu Bước 8, hệ thống hóa nội dung README và đề xuất tình huống kiểm thử dựa trên mã nguồn, tài liệu đang có.
- **Phạm vi kiểm soát:** AI chỉ hỗ trợ phân tích và biên soạn tài liệu. Nhóm tự chịu trách nhiệm kiểm tra thông tin, chạy chức năng, sửa lỗi và xác nhận kết quả thực tế.
- **Thông tin cần bổ sung nếu áp dụng:** các thành viên cập nhật thêm những phần code, giao diện hoặc testcase có dùng AI và cách tự kiểm tra/chỉnh sửa; không mặc định toàn bộ mã nguồn do AI tạo ra.

---

**Nguồn:** Nhóm tác giả. Tài liệu tổng hợp từ repository công khai và bảng phân công Buổi 3; những kết quả chưa được chạy kiểm thử trực tiếp được ghi rõ để nhóm xác minh.
