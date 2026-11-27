/* WeBuy | Nguon du lieu san pham dung chung (trang chu, danh sach, chi tiet, gio, yeu thich, so sanh).
 * - id dang string de tuong thich voi js/app.js (product() so sanh strict). Giu nguyen id 1-8 cu.
 * - Truong chuan: id, name, price, retail, group, category, image, description, minMembers
 *   (+ initialMembers: so thanh vien mau, badge: nhan tren the).
 * - price === retail: gia mua le; group: gia mua chung khi nhom du minMembers.
 * - category phai trung "name" cua mot muc trong WEBUY_CATEGORIES.
 * - Anh 09-24: anh san pham nhom cung cap (rieng anh 24 lay tu Unsplash), xem images/CREDITS.md.
 */
window.WEBUY_CATEGORIES = [
  {"id": "balo", "name": "Balo & túi ví", "image": "images/product-01.webp"},
  {"id": "ao-thun", "name": "Áo thun", "image": "images/product-02.webp"},
  {"id": "gia-dung", "name": "Thiết bị gia dụng", "image": "images/product-03.webp"},
  {"id": "trang-suc", "name": "Trang sức", "image": "images/product-04.webp"},
  {"id": "dien-tu", "name": "Thiết bị điện tử", "image": "images/product-17.webp"},
  {"id": "sac-dep", "name": "Sắc đẹp", "image": "images/product-21.webp"}
];

window.WEBUY_PRODUCTS = [
  {
    "id": "1",
    "name": "Balo canvas Everyday",
    "price": 299000,
    "category": "Balo & túi ví",
    "image": "images/product-01.webp",
    "description": "Balo vải canvas phong cách tối giản, phù hợp mang sách vở và vật dụng hằng ngày.",
    "retail": 299000,
    "group": 249000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Được quan tâm"
  },
  {
    "id": "2",
    "name": "Áo thun cotton Essential",
    "price": 189000,
    "category": "Áo thun",
    "image": "images/product-02.webp",
    "description": "Áo thun cotton dáng cơ bản, dễ phối đồ và phù hợp nhiều hoạt động thường ngày.",
    "retail": 189000,
    "group": 149000,
    "minMembers": 2,
    "initialMembers": 1,
    "badge": "Mới"
  },
  {
    "id": "3",
    "name": "Đèn bàn Minimal Light",
    "price": 429000,
    "category": "Thiết bị gia dụng",
    "image": "images/product-03.webp",
    "description": "Đèn bàn thiết kế gọn gàng, phù hợp góc học tập và làm việc.",
    "retail": 429000,
    "group": 349000,
    "minMembers": 4,
    "initialMembers": 3,
    "badge": "Đề xuất"
  },
  {
    "id": "4",
    "name": "Dây chuyền hoa nhỏ Grace",
    "price": 329000,
    "category": "Trang sức",
    "image": "images/product-04.webp",
    "description": "Dây chuyền họa tiết hoa nhỏ, phong cách thanh lịch, dễ kết hợp trang phục.",
    "retail": 329000,
    "group": 269000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Nổi bật"
  },
  {
    "id": "5",
    "name": "Túi đeo chéo Urban Mini",
    "price": 379000,
    "category": "Balo & túi ví",
    "image": "images/product-05.webp",
    "description": "Túi đeo chéo kích thước nhỏ gọn, thích hợp đựng đồ dùng cá nhân khi di chuyển.",
    "retail": 379000,
    "group": 315000,
    "minMembers": 3,
    "initialMembers": 1,
    "badge": "Được yêu thích"
  },
  {
    "id": "6",
    "name": "Bình giữ nhiệt Sage 500ml",
    "price": 259000,
    "category": "Thiết bị gia dụng",
    "image": "images/product-06.webp",
    "description": "Bình giữ nhiệt dung tích 500 ml, thuận tiện mang nước khi học tập hoặc làm việc.",
    "retail": 259000,
    "group": 209000,
    "minMembers": 2,
    "initialMembers": 1,
    "badge": "Tiện dụng"
  },
  {
    "id": "7",
    "name": "Tai nghe chụp tai Cozy Sound",
    "price": 699000,
    "category": "Thiết bị gia dụng",
    "image": "images/product-07.webp",
    "description": "Tai nghe dạng chụp tai với thiết kế thoải mái, thích hợp nghe nhạc và học tập.",
    "retail": 699000,
    "group": 579000,
    "minMembers": 4,
    "initialMembers": 2,
    "badge": "Đề xuất"
  },
  {
    "id": "8",
    "name": "Vòng tay bạc tinh tế Luna",
    "price": 299000,
    "category": "Trang sức",
    "image": "images/product-08.webp",
    "description": "Vòng tay phong cách tối giản, có thể kết hợp cùng trang phục hằng ngày.",
    "retail": 299000,
    "group": 245000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Nổi bật"
  },
  {
    "id": "9",
    "name": "Ví nữ ngắn Simple & Classic",
    "price": 259000,
    "category": "Balo & túi ví",
    "image": "images/product-09.webp",
    "description": "Ví ngắn gập ba màu vàng champagne, vân da nhẹ, nhiều ngăn đựng thẻ và tiền, gọn trong túi xách.",
    "retail": 259000,
    "group": 209000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Mới"
  },
  {
    "id": "10",
    "name": "Balo trơn Daily màu kem",
    "price": 349000,
    "category": "Balo & túi ví",
    "image": "images/product-10.webp",
    "description": "Balo dáng tối giản màu kem, ngăn chính rộng vừa laptop 14 inch, quai đeo êm vai khi đi học.",
    "retail": 349000,
    "group": 289000,
    "minMembers": 3,
    "initialMembers": 1,
    "badge": "Được quan tâm"
  },
  {
    "id": "11",
    "name": "Áo thun oversize phối tay raglan",
    "price": 199000,
    "category": "Áo thun",
    "image": "images/product-11.webp",
    "description": "Áo thun form rộng màu kem phối tay màu be, vải cotton dày dặn, có tag trang trí ở gấu áo.",
    "retail": 199000,
    "group": 159000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Đề xuất"
  },
  {
    "id": "12",
    "name": "Áo thun in họa tiết Star màu rêu",
    "price": 219000,
    "category": "Áo thun",
    "image": "images/product-12.webp",
    "description": "Áo thun xanh rêu in họa tiết ngôi sao đỏ phong cách vintage, form suông dễ mặc.",
    "retail": 219000,
    "group": 179000,
    "minMembers": 2,
    "initialMembers": 1,
    "badge": "Mới"
  },
  {
    "id": "13",
    "name": "Áo thun đen in hình Metallica",
    "price": 249000,
    "category": "Áo thun",
    "image": "images/product-13.webp",
    "description": "Áo thun đen in hình ban nhạc Metallica, cổ tròn, cotton mềm, hợp phong cách đường phố.",
    "retail": 249000,
    "group": 199000,
    "minMembers": 3,
    "initialMembers": 1,
    "badge": "Được yêu thích"
  },
  {
    "id": "14",
    "name": "Quạt đứng 5 cánh màu trắng",
    "price": 590000,
    "category": "Thiết bị gia dụng",
    "image": "images/product-14.webp",
    "description": "Quạt đứng 5 cánh, chỉnh được độ cao và 3 tốc độ gió, chạy êm, hợp phòng ngủ và góc học tập.",
    "retail": 590000,
    "group": 499000,
    "minMembers": 4,
    "initialMembers": 3,
    "badge": "Tiết kiệm"
  },
  {
    "id": "15",
    "name": "Bông tai bạc hoa trà",
    "price": 289000,
    "category": "Trang sức",
    "image": "images/product-15.webp",
    "description": "Bông tai bạc tạo hình hoa trà nhiều lớp, đính đá nhỏ lấp lánh, kiểu dáng thanh lịch.",
    "retail": 289000,
    "group": 239000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Nổi bật"
  },
  {
    "id": "16",
    "name": "Nhẫn đôi bạc trơn Infinity",
    "price": 459000,
    "category": "Trang sức",
    "image": "images/product-16.webp",
    "description": "Cặp nhẫn bạc trơn bản tròn, bề mặt đánh bóng, phù hợp làm quà tặng cho hai người.",
    "retail": 459000,
    "group": 389000,
    "minMembers": 2,
    "initialMembers": 1,
    "badge": "Quà tặng"
  },
  {
    "id": "17",
    "name": "Tai nghe không dây JBL hộp sạc màn hình",
    "price": 3990000,
    "category": "Thiết bị điện tử",
    "image": "images/product-17.webp",
    "description": "Tai nghe true wireless JBL chống ồn, hộp sạc có màn hình cảm ứng để chỉnh nhạc và âm lượng.",
    "retail": 3990000,
    "group": 3490000,
    "minMembers": 4,
    "initialMembers": 3,
    "badge": "Đề xuất"
  },
  {
    "id": "18",
    "name": "Loa bluetooth mini Momoko",
    "price": 159000,
    "category": "Thiết bị điện tử",
    "image": "images/product-18.webp",
    "description": "Loa bluetooth nhỏ bằng lòng bàn tay, âm thanh rõ, pin dùng khoảng 4–5 giờ, dễ mang theo.",
    "retail": 159000,
    "group": 119000,
    "minMembers": 4,
    "initialMembers": 2,
    "badge": "Tiết kiệm"
  },
  {
    "id": "19",
    "name": "Loa bluetooth Heavy Bass đèn LED",
    "price": 390000,
    "category": "Thiết bị điện tử",
    "image": "images/product-19.webp",
    "description": "Loa bluetooth bass mạnh, đèn LED RGB đổi màu theo nhạc, có quai xách khi đi dã ngoại.",
    "retail": 390000,
    "group": 329000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Được quan tâm"
  },
  {
    "id": "20",
    "name": "Bàn phím bluetooth mỏng màu trắng",
    "price": 590000,
    "category": "Thiết bị điện tử",
    "image": "images/product-20.webp",
    "description": "Bàn phím không dây mỏng nhẹ, phím bấm êm, kết nối bluetooth với laptop, máy tính bảng và điện thoại.",
    "retail": 590000,
    "group": 499000,
    "minMembers": 3,
    "initialMembers": 1,
    "badge": "Mới"
  },
  {
    "id": "21",
    "name": "Kem chống nắng Sunplay Skin Aqua Tone Up",
    "price": 145000,
    "category": "Sắc đẹp",
    "image": "images/product-21.webp",
    "description": "Tinh chất chống nắng nâng tông SPF50+ PA++++, kết cấu mỏng nhẹ, dùng hằng ngày dưới lớp trang điểm. Tuýp 50 g.",
    "retail": 145000,
    "group": 115000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Nổi bật"
  },
  {
    "id": "22",
    "name": "Miếng dán mụn Derma Angel ban ngày (12 miếng)",
    "price": 49000,
    "category": "Sắc đẹp",
    "image": "images/product-22.webp",
    "description": "Miếng dán mụn trong suốt dùng ban ngày, mỏng gần như vô hình, có thể trang điểm đè lên.",
    "retail": 49000,
    "group": 35000,
    "minMembers": 5,
    "initialMembers": 3,
    "badge": "Tiết kiệm"
  },
  {
    "id": "23",
    "name": "Kem che khuyết điểm Make Up For Ever Ultra HD",
    "price": 690000,
    "category": "Sắc đẹp",
    "image": "images/product-23.webp",
    "description": "Kem che khuyết điểm dạng lỏng, che phủ tốt, hoàn thiện tự nhiên cho quầng thâm và vết đỏ.",
    "retail": 690000,
    "group": 590000,
    "minMembers": 3,
    "initialMembers": 2,
    "badge": "Đề xuất"
  },
  {
    "id": "24",
    "name": "Son thỏi lì Rosy Nude",
    "price": 199000,
    "category": "Sắc đẹp",
    "image": "images/product-24.webp",
    "description": "Son thỏi chất lì mềm môi, sắc hồng đất tự nhiên, vỏ son màu nâu trầm sang trọng.",
    "retail": 199000,
    "group": 159000,
    "minMembers": 3,
    "initialMembers": 1,
    "badge": "Mới"
  }
];

/* Kết nối sản phẩm Seller Center với Kênh người mua */
try {
  const sellerProducts = JSON.parse(
    localStorage.getItem('webuy_seller_v1_products') || '[]'
  );

  if (Array.isArray(sellerProducts)) {
    const publishedProducts = sellerProducts
      .filter(p => p.status === 'published')
      .map(p => ({
        ...p,
        id: String(p.id),
        price: Number(p.retail),
        retail: Number(p.retail),
        group: Number(p.group),
        minMembers: Number(p.minMembers),
        initialMembers: 0,
        badge: 'Từ người bán'
      }));

    window.WEBUY_PRODUCTS.push(...publishedProducts);
  }
} catch (error) {
  console.warn('Không thể tải sản phẩm người bán:', error);
}

/* Bảo đảm mỗi id chỉ có một sản phẩm và đủ trường chuẩn (mục lỗi bị bỏ qua, không làm hỏng trang). */
(() => {
  const seen = new Set();
  const required = ['id', 'name', 'price', 'retail', 'group', 'category', 'image', 'minMembers'];
  window.WEBUY_PRODUCTS = window.WEBUY_PRODUCTS.filter(p => {
    if (!p || required.some(k => p[k] === undefined || p[k] === null || p[k] === '')) return false;
    const id = String(p.id);
    if (seen.has(id)) { console.warn('WeBuy: bỏ sản phẩm trùng id', id); return false; }
    seen.add(id);
    return true;
  });
})();

/* Bảo đảm mỗi id chỉ có một sản phẩm và đủ trường chuẩn (mục lỗi bị bỏ qua, không làm hỏng trang). */
(() => {
  const seen = new Set();
  const required = ['id', 'name', 'price', 'retail', 'group', 'category', 'image', 'minMembers'];
  window.WEBUY_PRODUCTS = window.WEBUY_PRODUCTS.filter(p => {
    if (!p || required.some(k => p[k] === undefined || p[k] === null || p[k] === '')) return false;
    const id = String(p.id);
    if (seen.has(id)) { console.warn('WeBuy: bỏ sản phẩm trùng id', id); return false; }
    seen.add(id);
    return true;
  });
})();

window.WeBuyLan?.addProducts(window.WEBUY_PRODUCTS);
