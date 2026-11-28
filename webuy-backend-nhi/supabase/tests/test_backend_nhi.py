"""Kiểm thử phần backend của Nhi theo đúng tiêu chí "BÀN GIAO/NGHIỆM THU" trong checklist.

Chạy trên Postgres cục bộ (KHÔNG chạy trên database Supabase đang dùng chung, vì test tạo user giả):
    pip install "psycopg[binary]"
    python supabase/tests/test_backend_nhi.py "postgresql://postgres@localhost:5432/webuy_test"
Script tự tạo lại toàn bộ schema: stub Supabase -> migrations -> seed (seed chạy 2 lần).
"""
import json
import pathlib
import sys
import threading
import uuid

import psycopg
from psycopg.types.json import Jsonb

ROOT = pathlib.Path(__file__).resolve().parents[2]
DSN = sys.argv[1] if len(sys.argv) > 1 else "postgresql://postgres@localhost:5432/webuy_test"
results = []


def admin_conn():
    return psycopg.connect(DSN, autocommit=True)


def rebuild():
    with admin_conn() as c:
        c.execute("drop schema if exists public cascade; create schema public;")
        c.execute("drop schema if exists auth cascade; drop schema if exists storage cascade;")
        c.execute((ROOT / "supabase/tests/00_local_supabase_stub.sql").read_text(encoding="utf-8"))
        c.execute("grant usage on schema public to anon, authenticated, service_role")
        files = [*sorted((ROOT / "supabase/migrations").glob("*.sql")), ROOT / "supabase/seed.sql", ROOT / "supabase/seed.sql"]
        for f in files:
            c.execute(f.read_text(encoding="utf-8"))


def new_user(email, name=""):
    with admin_conn() as c:
        return c.execute("insert into auth.users (email, raw_user_meta_data) values (%s, %s) returning id",
                         (email, json.dumps({"full_name": name, "role": "admin"}))).fetchone()[0]


class Api:
    """Gọi RPC như trình duyệt: role authenticated (hoặc anon) + JWT có sub = user id."""

    def __init__(self, user_id=None):
        self.user_id = user_id

    def _setup(self, cur):
        if self.user_id:
            cur.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps({"sub": str(self.user_id), "role": "authenticated"}),))
            cur.execute("set role authenticated")
        else:
            cur.execute("select set_config('request.jwt.claims', '', false)")
            cur.execute("set role anon")

    def rpc(self, fn, **kw):
        with psycopg.connect(DSN, autocommit=True) as c, c.cursor() as cur:
            self._setup(cur)
            args = ", ".join(f"{k} => %({k})s" for k in kw)
            params = {k: (json.dumps(v) if isinstance(v, (dict, list)) and not (isinstance(v, list) and v and isinstance(v[0], uuid.UUID)) else v) for k, v in kw.items()}
            cur.execute(f"select public.{fn}({args})", params)
            return cur.fetchone()[0]

    def sql(self, query, params=None):
        with psycopg.connect(DSN, autocommit=True) as c, c.cursor() as cur:
            self._setup(cur)
            cur.execute(query, params)
            return cur.fetchall() if cur.description else None


def expect_error(status, fn, *a, **kw):
    try:
        fn(*a, **kw)
    except psycopg.Error as e:
        got = e.diag.sqlstate
        assert got == f"PT{status}", f"cần lỗi PT{status}, nhận {got}: {e.diag.message_primary} {e.diag.message_detail}"
        return e.diag.message_primary
    raise AssertionError(f"cần lỗi {status} nhưng gọi thành công")


def case(task, name):
    def wrap(fn):
        try:
            fn()
            results.append(("PASS", task, name, ""))
        except Exception as e:  # noqa: BLE001
            results.append(("FAIL", task, name, f"{type(e).__name__}: {e}"))
        return fn
    return wrap


rebuild()
anon = Api()
A = Api(new_user("a@webuy.test", "Nguyễn Văn A"))
B = Api(new_user("b@webuy.test", "Trần Thị B"))
SA = Api(new_user("seller-a@webuy.test"))
SB = Api(new_user("seller-b@webuy.test"))
SHIP = {"name": "Nguyễn Văn A", "phone": "0912345678", "address": "59C Nguyễn Đình Chiểu, Q3"}


# ---------------------------------------------------------------- 1. Đăng ký/đăng nhập & phân quyền
@case("Auth & phân quyền", "Tài khoản mới luôn là buyer dù metadata gửi role=admin")
def _():
    assert A.rpc("get_my_profile")["role"] == "buyer"


@case("Auth & phân quyền", "A không xem được profile của B, không tự nâng role")
def _():
    rows = A.sql("select id from public.profiles")
    assert len(rows) == 1 and rows[0][0] == A.user_id, rows
    try:
        A.sql("update public.profiles set role = 'admin' where id = %s", (A.user_id,))
        raise AssertionError("sửa được role")
    except psycopg.errors.InsufficientPrivilege:
        pass
    assert A.rpc("get_my_profile")["role"] == "buyer"


@case("Auth & phân quyền", "Cập nhật hồ sơ của mình, số điện thoại sai bị từ chối")
def _():
    p = A.rpc("update_my_profile", p_name="Nguyễn Văn A", p_phone="0912 345 678", p_address="Q3, TP.HCM")
    assert p["phone"] == "0912345678"
    expect_error(400, A.rpc, "update_my_profile", p_name="A", p_phone="12ab", p_address="")


@case("Auth & phân quyền", "Chưa đăng nhập không đặt hàng / không thêm giỏ / không vào API seller (401)")
def _():
    # Khách (role anon) không có quyền gọi các RPC này; Supabase trả HTTP 401 cho lỗi 42501 của anon
    for fn, kw in (("add_to_cart", {"p_product_id": "1"}), ("seller_dashboard", {}), ("get_cart", {}),
                   ("place_order", {"p_cart_item_ids": [uuid.uuid4()], "p_shipping": SHIP, "p_client_request_id": uuid.uuid4()})):
        try:
            anon.rpc(fn, **kw)
            raise AssertionError(f"anon gọi được {fn}")
        except psycopg.errors.InsufficientPrivilege:
            pass
    # Kể cả khi có quyền gọi (role authenticated) mà JWT không có user, hàm vẫn tự chặn bằng 401
    expect_error(401, Api(None).sql, "set role authenticated; select public.get_cart()")


@case("Auth & phân quyền", "Buyer gọi API seller bị 403")
def _():
    expect_error(403, A.rpc, "seller_list_products")


# ---------------------------------------------------------------- 2. Cửa hàng & quyền seller
@case("Cửa hàng & seller", "Đăng ký seller tạo cửa hàng gắn UID, role thành seller, đăng ký lần 2 bị 409")
def _():
    s = SA.rpc("register_seller", p_name="Shop Balo An", p_description="Balo đi học", p_phone="0901234567", p_address="HCM")
    assert SA.rpc("get_my_profile")["role"] == "seller" and SA.rpc("get_my_store")["id"] == s["id"]
    expect_error(409, SA.rpc, "register_seller", p_name="Shop thứ hai")
    SB.rpc("register_seller", p_name="Tiệm Trang Sức B")


@case("Cửa hàng & seller", "Dashboard đếm bằng dữ liệu thật")
def _():
    d = SA.rpc("seller_dashboard")
    assert d["products"]["total"] == 0, d


@case("Cửa hàng & seller", "Logo: chỉ nhận đường dẫn trong thư mục cửa hàng mình, đúng đuôi ảnh")
def _():
    store = SA.rpc("get_my_store")["id"]
    other = SB.rpc("get_my_store")["id"]
    SA.rpc("update_my_store", p_name="Shop Balo An", p_description="", p_phone="", p_address="", p_logo_path=f"{store}/logo/logo.png")
    expect_error(400, SA.rpc, "update_my_store", p_name="Shop Balo An", p_description="", p_phone="", p_address="", p_logo_path=f"{other}/logo/x.png")
    expect_error(400, SA.rpc, "update_my_store", p_name="Shop Balo An", p_description="", p_phone="", p_address="", p_logo_path=f"{store}/logo/virus.exe")


@case("Cửa hàng & seller", "Storage: seller A không upload được vào thư mục của B, sai đuôi bị chặn")
def _():
    store = SA.rpc("get_my_store")["id"]
    other = SB.rpc("get_my_store")["id"]
    SA.sql("insert into storage.objects (bucket_id, name) values ('store-assets', %s)", (f"{store}/products/a.webp",))
    for bad in (f"{other}/products/a.webp", f"{store}/products/a.svg"):
        try:
            SA.sql("insert into storage.objects (bucket_id, name) values ('store-assets', %s)", (bad,))
            raise AssertionError(f"upload được {bad}")
        except psycopg.errors.InsufficientPrivilege:
            pass
    with admin_conn() as c:
        b = c.execute("select file_size_limit, allowed_mime_types from storage.buckets where id = 'store-assets'").fetchone()
    assert b[0] == 2097152 and set(b[1]) == {"image/jpeg", "image/png", "image/webp"}, b


# ---------------------------------------------------------------- 3. Chuyển catalog lên database
@case("Catalog lên database", "Seed chạy 2 lần vẫn 8 sản phẩm, giữ ID cũ 1..8, published")
def _():
    rows = anon.sql("select id from public.products order by id::int")
    assert [r[0] for r in rows] == [str(i) for i in range(1, 9)], rows
    p = anon.rpc("get_product", p_id="1")
    assert p["name"] == "Balo canvas Everyday" and p["retail"] == 299000 and p["group"] == 249000 and p["image"] == "images/product-01.webp", p


@case("Catalog lên database", "Sản phẩm ẩn không xuất hiện trong catalog người mua")
def _():
    with admin_conn() as c:
        c.execute("update public.products set status = 'hidden' where id = '8'")
    try:
        assert all(i["id"] != "8" for i in anon.rpc("search_products", p_page_size=48)["items"])
        expect_error(404, anon.rpc, "get_product", p_id="8")
        assert anon.sql("select count(*) from public.products where id = '8'")[0][0] == 0
    finally:
        with admin_conn() as c:
            c.execute("update public.products set status = 'published' where id = '8'")


# ---------------------------------------------------------------- 4. Tìm/lọc/sắp xếp
@case("API tìm/lọc/sắp xếp", "Tìm 'Balo' (và 'balo' không dấu) ra 2 sản phẩm balo")
def _():
    r = anon.rpc("search_products", p_q="Balo")
    assert r["total"] == 2 and {i["id"] for i in r["items"]} == {"1", "5"}, r
    assert anon.rpc("search_products", p_q="BALÔ")["total"] == 2


@case("API tìm/lọc/sắp xếp", "Lọc Trang sức theo tên hoặc id danh mục")
def _():
    for cat in ("Trang sức", "trang suc", "trang-suc"):
        r = anon.rpc("search_products", p_category=cat)
        assert r["total"] == 2 and all(i["category"] == "Trang sức" for i in r["items"]), (cat, r)


@case("API tìm/lọc/sắp xếp", "Sắp xếp giá tăng/giảm, lọc khoảng giá")
def _():
    asc = [i["retail"] for i in anon.rpc("search_products", p_sort="price_asc", p_page_size=48)["items"]]
    desc = [i["retail"] for i in anon.rpc("search_products", p_sort="price_desc", p_page_size=48)["items"]]
    assert asc == sorted(asc) and desc == sorted(desc, reverse=True) and len(asc) == 8
    r = anon.rpc("search_products", p_price_min=250000, p_price_max=330000)
    assert all(250000 <= i["retail"] <= 330000 for i in r["items"]) and r["total"] == 4, r


@case("API tìm/lọc/sắp xếp", "Phân trang đúng, trả tổng số kết quả")
def _():
    p1 = anon.rpc("search_products", p_sort="price_asc", p_page=1, p_page_size=3)
    p3 = anon.rpc("search_products", p_sort="price_asc", p_page=3, p_page_size=3)
    assert p1["total"] == 8 and p1["totalPages"] == 3 and len(p1["items"]) == 3 and len(p3["items"]) == 2


@case("API tìm/lọc/sắp xếp", "ID 999 trả 404; tham số sai trả 400")
def _():
    expect_error(404, anon.rpc, "get_product", p_id="999")
    expect_error(400, anon.rpc, "search_products", p_sort="drop table")
    expect_error(400, anon.rpc, "search_products", p_page_size=1000)
    expect_error(400, anon.rpc, "search_products", p_price_min=500000, p_price_max=100000)
    expect_error(400, anon.rpc, "search_products", p_category="Xe hơi")


# ---------------------------------------------------------------- 5. CRUD sản phẩm theo seller
NEW = {}


@case("CRUD sản phẩm seller", "Seller đăng sản phẩm; draft không hiện ở catalog, published thì hiện")
def _():
    store = SA.rpc("get_my_store")["id"]
    p = SA.rpc("seller_save_product", p_id=None, p_name="Balo laptop Kestrel", p_category="Balo & túi ví", p_description="Chống sốc",
               p_retail_price=420000, p_group_price=359000, p_min_members=3, p_stock=10,
               p_image_path=f"{store}/products/kestrel.webp", p_status="draft")
    NEW["id"] = p["id"]
    assert anon.rpc("search_products", p_q="Kestrel")["total"] == 0
    SA.rpc("seller_set_product_status", p_id=p["id"], p_status="published")
    assert anon.rpc("search_products", p_q="Kestrel")["total"] == 1
    assert SA.rpc("seller_dashboard")["products"]["published"] == 1


@case("CRUD sản phẩm seller", "Giá mua chung > giá lẻ bị từ chối")
def _():
    expect_error(400, SA.rpc, "seller_save_product", p_id=None, p_name="Lỗi giá", p_category="Áo thun", p_description="",
                 p_retail_price=100000, p_group_price=120000, p_min_members=2, p_stock=1, p_image_path=None, p_status="draft")


@case("CRUD sản phẩm seller", "Seller B không sửa/ẩn được sản phẩm của seller A; không sửa sản phẩm hệ thống")
def _():
    expect_error(403, SB.rpc, "seller_set_product_status", p_id=NEW["id"], p_status="hidden")
    expect_error(403, SB.rpc, "seller_save_product", p_id=NEW["id"], p_name="Hack", p_category="Áo thun", p_description="",
                 p_retail_price=1000, p_group_price=1000, p_min_members=2, p_stock=1, p_image_path=None, p_status="published")
    expect_error(403, SA.rpc, "seller_set_product_status", p_id="1", p_status="hidden")
    assert anon.rpc("get_product", p_id=NEW["id"])["name"] == "Balo laptop Kestrel"


@case("CRUD sản phẩm seller", "Ảnh sai định dạng hoặc thư mục người khác bị từ chối")
def _():
    other = SB.rpc("get_my_store")["id"]
    for path in (f"{other}/products/x.webp", "https://evil.example/x.webp", "x.gif"):
        expect_error(400, SA.rpc, "seller_save_product", p_id=NEW["id"], p_name="Balo laptop Kestrel", p_category="balo-tui-vi",
                     p_description="", p_retail_price=420000, p_group_price=359000, p_min_members=3, p_stock=10,
                     p_image_path=path, p_status="published")


@case("CRUD sản phẩm seller", "Ẩn sản phẩm thì biến mất khỏi catalog, bật lại thì hiện")
def _():
    SA.rpc("seller_set_product_status", p_id=NEW["id"], p_status="hidden")
    assert anon.rpc("search_products", p_q="Kestrel")["total"] == 0
    assert any(p["id"] == NEW["id"] for p in SA.rpc("seller_list_products"))
    SA.rpc("seller_set_product_status", p_id=NEW["id"], p_status="published")


# ---------------------------------------------------------------- 6. Tồn kho
@case("Tồn kho & giữ hàng", "Hai yêu cầu đồng thời tranh 1 sản phẩm cuối: chỉ 1 thành công, tồn kho không âm")
def _():
    with admin_conn() as c:
        c.execute("update public.products set stock_available = 1, stock_held = 0 where id = '3'")
    outcomes = []
    barrier = threading.Barrier(2)

    def worker(api):
        barrier.wait()
        try:
            api.rpc("hold_stock", p_product_id="3", p_quantity=1)
            outcomes.append("ok")
        except psycopg.Error as e:
            outcomes.append(e.diag.sqlstate)

    ts = [threading.Thread(target=worker, args=(x,)) for x in (A, B)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(outcomes) == ["PT409", "ok"], outcomes
    with admin_conn() as c:
        assert c.execute("select stock_available, stock_held from public.products where id = '3'").fetchone() == (0, 1)


@case("Tồn kho & giữ hàng", "10 yêu cầu đồng thời tranh 3 sản phẩm: đúng 3 thành công")
def _():
    users = [Api(new_user(f"race{i}@webuy.test")) for i in range(10)]
    with admin_conn() as c:
        c.execute("update public.products set stock_available = 3, stock_held = 0 where id = '6'")
    ok = []
    barrier = threading.Barrier(10)

    def worker(api):
        barrier.wait()
        try:
            api.rpc("hold_stock", p_product_id="6", p_quantity=1)
            ok.append(1)
        except psycopg.Error:
            pass

    ts = [threading.Thread(target=worker, args=(u,)) for u in users]
    [t.start() for t in ts]
    [t.join() for t in ts]
    with admin_conn() as c:
        assert len(ok) == 3 and c.execute("select stock_available, stock_held from public.products where id = '6'").fetchone() == (0, 3)


@case("Tồn kho & giữ hàng", "Giữ chỗ hết hạn được giải phóng; hủy giữ chỉ trả kho 1 lần")
def _():
    with admin_conn() as c:
        c.execute("update public.stock_holds set expires_at = now() - interval '1 minute' where product_id = '3'")
        released = c.execute("select public.release_expired_holds()").fetchone()[0]
        assert released == 1 and c.execute("select stock_available, stock_held from public.products where id = '3'").fetchone() == (1, 0)
    h = A.rpc("hold_stock", p_product_id="3", p_quantity=1)
    assert A.rpc("release_stock_hold", p_hold_id=h["id"])["released"] is True
    assert A.rpc("release_stock_hold", p_hold_id=h["id"])["released"] is False
    expect_error(404, B.rpc, "release_stock_hold", p_hold_id=h["id"])
    with admin_conn() as c:
        assert c.execute("select stock_available, stock_held from public.products where id = '3'").fetchone() == (1, 0)
        c.execute("update public.products set stock_available = 50 where id in ('3', '6')")


# ---------------------------------------------------------------- 7. Giỏ hàng gắn tài khoản
@case("Giỏ hàng", "Thêm cùng sản phẩm cùng hình thức thì cộng số lượng, không tạo dòng trùng")
def _():
    A.rpc("add_to_cart", p_product_id="1", p_kind="retail", p_quantity=1)
    cart = A.rpc("add_to_cart", p_product_id="1", p_kind="retail", p_quantity=2)
    assert len(cart["items"]) == 1 and cart["items"][0]["quantity"] == 3 and cart["subtotal"] == 3 * 299000, cart
    group = A.rpc("create_buying_group", p_product_id="1", p_region_code="hn", p_duration_hours=Jsonb(1), p_request_key=uuid.uuid4())
    group_id = uuid.UUID(group["group"]["id"])
    group_buyer = Api(new_user("group-member@webuy.test"))
    A.rpc("confirm_group_reservation", p_reservation_id=uuid.UUID(group["myReservation"]["id"]))
    for buyer in (B, group_buyer):
        slot = buyer.rpc("join_buying_group", p_group_id=group_id, p_request_key=uuid.uuid4())["myReservation"]
        buyer.rpc("confirm_group_reservation", p_reservation_id=uuid.UUID(slot["id"]))
    cart = A.rpc("add_to_cart", p_product_id="1", p_kind="group", p_quantity=1, p_group_ref=str(group_id))
    assert len(cart["items"]) == 2


@case("Giỏ hàng", "Giỏ theo tài khoản: 'máy 2' (kết nối khác) thấy giỏ của A; B không thấy")
def _():
    assert len(Api(A.user_id).rpc("get_cart")["items"]) == 2
    assert B.rpc("get_cart")["items"] == []
    assert B.sql("select count(*) from public.cart_items")[0][0] == 0


@case("Giỏ hàng", "Gộp giỏ localStorage: không nhân đôi khi gộp lại, bỏ dòng sai, giá lấy từ server")
def _():
    local = [{"productId": "2", "kind": "retail", "quantity": 2, "price": 1},
             {"productId": "1", "kind": "retail", "quantity": 1},
             {"productId": "999", "kind": "retail", "quantity": 1},
             {"productId": "4", "kind": "group", "quantity": 1}]
    r1 = A.rpc("merge_cart", p_items=local)
    r2 = A.rpc("merge_cart", p_items=local)
    assert r1["skipped"] == 2 and r2["items"] == r1["items"], (r1, r2)
    line2 = next(i for i in r2["items"] if i["productId"] == "2")
    assert line2["quantity"] == 2 and line2["unitPrice"] == 189000
    assert next(i for i in r2["items"] if i["productId"] == "1" and i["kind"] == "retail")["quantity"] == 3


@case("Giỏ hàng", "B không sửa được dòng giỏ của A")
def _():
    item = A.rpc("get_cart")["items"][0]["id"]
    expect_error(404, B.rpc, "set_cart_item_quantity", p_item_id=item, p_quantity=50)


# ---------------------------------------------------------------- 8 + 9. Đơn hàng, snapshot giá, trạng thái
ORDER = {}


@case("Trạng thái đơn & thanh toán demo", "Bấm Xác nhận nhiều lần (cùng request id, kể cả song song) chỉ tạo 1 đơn")
def _():
    cart = A.rpc("get_cart")
    ids = [uuid.UUID(i["id"]) for i in cart["items"] if i["productId"] == "1" and i["kind"] == "retail"]
    req = uuid.uuid4()
    out = []
    barrier = threading.Barrier(3)

    def worker():
        barrier.wait()
        try:
            out.append(A.rpc("place_order", p_cart_item_ids=ids, p_shipping=SHIP, p_client_request_id=req)["id"])
        except psycopg.Error as e:
            out.append(e.diag.sqlstate)

    ts = [threading.Thread(target=worker) for _ in range(3)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert len(set(out)) == 1 and out[0].startswith("WB"), out
    ORDER["id"] = out[0]
    assert len(A.rpc("list_my_orders")) == 1
    o = A.rpc("get_order", p_order_id=out[0])
    assert o["status"] == "PENDING" and o["total"] == 3 * 299000, o


@case("Trạng thái đơn & thanh toán demo", "Gửi item ID không thuộc giỏ mình bị từ chối 400")
def _():
    bitem = uuid.UUID(B.rpc("add_to_cart", p_product_id="2")["items"][0]["id"])
    expect_error(400, A.rpc, "place_order", p_cart_item_ids=[bitem], p_shipping=SHIP, p_client_request_id=uuid.uuid4())


@case("Chốt giá theo lịch sử", "Đổi giá 299k -> 319k sau khi có đơn: đơn cũ giữ 299k, đơn mới 319k")
def _():
    with admin_conn() as c:
        c.execute("update public.products set retail_price = 319000 where id = '1'")
    try:
        o = A.rpc("get_order", p_order_id=ORDER["id"])
        assert o["items"][0]["unitPrice"] == 299000 and o["total"] == 897000, o
        cart = A.rpc("add_to_cart", p_product_id="1", p_kind="retail", p_quantity=1)
        line = next(i for i in cart["items"] if i["productId"] == "1" and i["kind"] == "retail")
        o2 = A.rpc("place_order", p_cart_item_ids=[uuid.UUID(line["id"])], p_shipping=SHIP, p_client_request_id=uuid.uuid4())
        assert o2["items"][0]["unitPrice"] == 319000 and o2["items"][0]["retailPrice"] == 319000
        ORDER["second"] = o2["id"]
        with admin_conn() as c:
            try:
                c.execute("update public.order_items set unit_price = 1 where order_id = %s", (ORDER["id"],))
                raise AssertionError("sửa được giá đã chốt")
            except psycopg.errors.RaiseException:
                pass
    finally:
        with admin_conn() as c:
            c.execute("update public.products set retail_price = 299000 where id = '1'")


@case("Chốt giá theo lịch sử", "Dòng mua chung dùng giá đã giữ của suất, giá lẻ theo catalog lúc đặt")
def _():
    cart = A.rpc("get_cart")
    g = next(i for i in cart["items"] if i["kind"] == "group")
    o = A.rpc("place_order", p_cart_item_ids=[uuid.UUID(g["id"])], p_shipping=SHIP, p_client_request_id=uuid.uuid4())
    it = o["items"][0]
    assert it["unitPrice"] == 249000 and it["groupPrice"] == 249000 and it["retailPrice"] == 299000, it
    A.rpc("cancel_order", p_order_id=o["id"])


@case("Trạng thái đơn & thanh toán demo", "Thanh toán mô phỏng: PENDING -> PAID_DEMO, bấm lại không đổi gì, tồn kho chuyển sang đã bán")
def _():
    with admin_conn() as c:
        before = c.execute("select stock_held, stock_sold from public.products where id = '1'").fetchone()
    o = A.rpc("pay_order_demo", p_order_id=ORDER["id"])
    again = A.rpc("pay_order_demo", p_order_id=ORDER["id"])
    assert o["status"] == again["status"] == "PAID_DEMO" and o["paidAt"] == again["paidAt"]
    with admin_conn() as c:
        after = c.execute("select stock_held, stock_sold from public.products where id = '1'").fetchone()
    assert after == (before[0] - 3, before[1] + 3), (before, after)


@case("Trạng thái đơn & thanh toán demo", "Chuyển trạng thái sai sơ đồ bị chặn (409); B không xem/hủy đơn của A (404)")
def _():
    expect_error(409, A.rpc, "cancel_order", p_order_id=ORDER["id"])
    expect_error(404, B.rpc, "get_order", p_order_id=ORDER["id"])
    expect_error(404, B.rpc, "pay_order_demo", p_order_id=ORDER["id"])
    assert B.sql("select count(*) from public.orders")[0][0] == 0
    with admin_conn() as c:
        try:
            c.execute("update public.orders set status = 'PENDING' where id = %s", (ORDER["id"],))
            raise AssertionError("lùi trạng thái được")
        except psycopg.Error as e:
            assert e.diag.sqlstate == "PT409"


@case("Trạng thái đơn & thanh toán demo", "Hoàn tiền mô phỏng PAID_DEMO -> REFUNDED_DEMO trả hàng về kho")
def _():
    with admin_conn() as c:
        before = c.execute("select stock_available, stock_sold from public.products where id = '1'").fetchone()
    assert A.rpc("refund_order_demo", p_order_id=ORDER["id"])["status"] == "REFUNDED_DEMO"
    with admin_conn() as c:
        after = c.execute("select stock_available, stock_sold from public.products where id = '1'").fetchone()
    assert after == (before[0] + 3, before[1] - 3)


@case("Trạng thái đơn & thanh toán demo", "Đơn PENDING quá 15 phút tự hủy và trả hàng")
def _():
    with admin_conn() as c:
        c.execute("update public.orders set payment_expires_at = now() - interval '1 minute' where id = %s", (ORDER["second"],))
        c.execute("update public.stock_holds set expires_at = now() - interval '1 minute' where order_id = %s", (ORDER["second"],))
    o = A.rpc("get_order", p_order_id=ORDER["second"])
    assert o["status"] == "CANCELLED" and o["cancelReason"] == "Hết hạn thanh toán", o
    expect_error(409, A.rpc, "pay_order_demo", p_order_id=ORDER["second"])


@case("Trạng thái đơn & thanh toán demo", "Hết hàng giữa chừng: cả đơn rollback, không tạo đơn dở")
def _():
    with admin_conn() as c:
        c.execute("update public.products set stock_available = 0 where id = '2'")
    try:
        n = len(A.rpc("list_my_orders"))
        cart = A.rpc("get_cart")
        ids = [uuid.UUID(i["id"]) for i in cart["items"]]
        expect_error(409, A.rpc, "place_order", p_cart_item_ids=ids, p_shipping=SHIP, p_client_request_id=uuid.uuid4())
        assert len(A.rpc("list_my_orders")) == n and len(A.rpc("get_cart")["items"]) == len(ids)
    finally:
        with admin_conn() as c:
            c.execute("update public.products set stock_available = 50 where id = '2'")


# ---------------------------------------------------------------- 10. Thông báo & log lỗi
@case("Thông báo & log lỗi", "Mỗi sự kiện đúng 1 thông báo, có link đúng trang; người khác không đọc được")
def _():
    n = A.rpc("get_notifications", p_limit=50)
    events = [i["title"] for i in n["items"]]
    assert len(events) == len(set(events)), events
    paid = [i for i in n["items"] if "đã thanh toán" in i["title"]]
    assert len(paid) == 1 and paid[0]["link"] == f"order-payment.html?id={ORDER['id']}", paid
    with admin_conn() as c:
        ok = c.execute("select public.notify(%s, %s, 'order', 'x')", (A.user_id, f"order:{ORDER['id']}:PAID_DEMO")).fetchone()[0]
    assert ok is False
    assert B.sql("select count(*) from public.notifications where user_id = %s", (A.user_id,))[0][0] == 0
    assert A.rpc("mark_notifications_read")["unread"] == 0


@case("Thông báo & log lỗi", "Seller nhận thông báo khi có đơn thanh toán chứa sản phẩm của mình")
def _():
    line = B.rpc("add_to_cart", p_product_id=NEW["id"])["items"]
    pid = next(i["id"] for i in line if i["productId"] == NEW["id"])
    o = B.rpc("place_order", p_cart_item_ids=[uuid.UUID(pid)], p_shipping=SHIP, p_client_request_id=uuid.uuid4())
    B.rpc("pay_order_demo", p_order_id=o["id"])
    assert any(o["id"] in i["body"] for i in SA.rpc("get_notifications")["items"])
    assert SA.rpc("seller_dashboard")["orders"]["paidDemo"] == 1


@case("Thông báo & log lỗi", "Log lỗi không lưu mật khẩu/token; giới hạn 30 lần/phút")
def _():
    A.rpc("log_client_error", p_endpoint="place_order", p_status=500, p_code="NETWORK",
          p_message="fail", p_context={"password": "123456", "nested": {"access_token": "abc"}, "page": "checkout"})
    with admin_conn() as c:
        ctx = c.execute("select context from public.api_error_logs order by id desc limit 1").fetchone()[0]
    assert ctx["password"] == "[đã ẩn]" and ctx["nested"]["access_token"] == "[đã ẩn]" and ctx["page"] == "checkout", ctx
    for _i in range(29):
        A.rpc("log_client_error", p_endpoint="x", p_status=500, p_code="X", p_message="x")
    expect_error(429, A.rpc, "log_client_error", p_endpoint="x", p_status=500, p_code="X", p_message="x")
    assert A.sql("select count(*) from public.api_error_logs")[0][0] == 0  # người thường không đọc log


@case("Thông báo & log lỗi", "Endpoint nhạy cảm bị giới hạn tốc độ (đặt hàng > 10 lần/phút -> 429)")
def _():
    C = Api(new_user("spam@webuy.test"))
    codes = []
    for _i in range(12):
        try:
            item = C.rpc("add_to_cart", p_product_id="2")["items"][0]["id"]
            C.rpc("place_order", p_cart_item_ids=[uuid.UUID(item)], p_shipping=SHIP, p_client_request_id=uuid.uuid4())
            codes.append("ok")
        except psycopg.Error as e:
            codes.append(e.diag.sqlstate)
    assert codes == ["ok"] * 10 + ["PT429", "PT429"], codes


# ---------------------------------------------------------------- Bảo vệ bảng
@case("Bảo mật", "Trình duyệt không ghi trực tiếp vào bảng (phải qua RPC)")
def _():
    for q in ("update public.products set retail_price = 1 where id = '1'",
              "insert into public.orders (id, user_id, subtotal, total, client_request_id) values ('X', %s, 0, 0, gen_random_uuid())",
              "delete from public.cart_items"):
        try:
            A.sql(q, (A.user_id,) if "%s" in q else None)
            raise AssertionError(f"chạy được: {q}")
        except psycopg.errors.InsufficientPrivilege:
            pass


width = max(len(r[2]) for r in results)
for status, task, name, err in results:
    print(f"{status}  [{task}] {name}" + (f"\n      -> {err}" if err else ""))
fails = sum(r[0] == "FAIL" for r in results)
print(f"\n{len(results) - fails}/{len(results)} PASS")
sys.exit(1 if fails else 0)
