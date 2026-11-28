"""Integration tests on an empty, dedicated local PostgreSQL database named webuy_hoa_test."""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
import unittest
from uuid import UUID, uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.types.json import Jsonb

SUPABASE = Path(__file__).resolve().parents[1]
DSN = os.environ.get("WEBUY_HOA_TEST_DSN", "postgresql://postgres@127.0.0.1/webuy_hoa_test")
SHIPPING = {"name": "Nguyễn Văn A", "phone": "0912345678", "address": "59C Nguyễn Đình Chiểu, Q3"}


def admin():
    return psycopg.connect(DSN, autocommit=True)


def request(user, function, *args, headers=None):
    """Use real DB permissions and the transaction status GUC used by PostgREST."""
    try:
        with psycopg.connect(DSN) as conn:
            conn.execute("select set_config('request.jwt.claims', %s, true), set_config('request.headers', %s, true)",
                         (json.dumps({"sub": str(user)}) if user else "{}", json.dumps(headers or {})))
            conn.execute("set local role " + ("authenticated" if user else "anon"))
            query = sql.SQL("select public.{}({})").format(sql.Identifier(function),
                                                         sql.SQL(", ").join(sql.Placeholder() for _ in args))
            body = conn.execute(query, args).fetchone()[0]
            status = conn.execute("select nullif(current_setting('response.status', true), '')").fetchone()[0]
            return int(status or 200), body
    except psycopg.Error as error:
        if (error.sqlstate or "").startswith("PT"):
            return int(error.sqlstate[2:]), {"message": error.diag.message_primary, "details": error.diag.message_detail}
        raise


def parallel(calls):
    gate = Barrier(len(calls))

    def run(call):
        gate.wait(timeout=15)
        return call()

    with ThreadPoolExecutor(max_workers=len(calls)) as pool:
        return list(pool.map(run, calls))


def product_fixture(capacity=2):
    product = "test-" + uuid4().hex[:12]
    with admin() as conn:
        conn.execute("""
            insert into products (id, slug, store_id, category_id, name, retail_price, group_price,
                                  min_members, status, stock_available)
            select %s, %s, store_id, category_id, 'Sản phẩm kiểm thử', 189000, 149000, %s, 'published', 10
            from products where id = '2'
        """, (product, product, capacity))
    return product


def stock(product):
    with admin() as conn:
        return conn.execute("""
            select stock_available, stock_held, stock_sold,
                   (select count(*) from stock_holds where product_id = products.id)
            from products where id = %s
        """, (product,)).fetchone()


class GroupIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config = conninfo_to_dict(DSN)
        host = config.get("host", "")
        hostaddr = config.get("hostaddr")
        if (config.get("dbname") != "webuy_hoa_test"
                or (host not in ("localhost", "127.0.0.1", "::1") and not host.startswith("/"))
                or (hostaddr and hostaddr not in ("127.0.0.1", "::1"))):
            raise ValueError("Cần PostgreSQL local với database thử riêng tên webuy_hoa_test.")
        with admin() as conn:
            if conn.execute("select to_regclass('public.products')").fetchone()[0]:
                raise ValueError("Cần tạo database webuy_hoa_test rỗng trước khi chạy.")
            conn.execute((SUPABASE / "tests/00_local_supabase_stub.sql").read_text(encoding="utf-8"))
            conn.execute("grant usage on schema public to anon, authenticated, service_role")
            migrations = sorted((SUPABASE / "migrations").glob("*.sql"))
            for migration in migrations:
                if migration.name.endswith("_hoa_group_schema.sql"):
                    conn.execute((SUPABASE / "seed.sql").read_text(encoding="utf-8"))
                conn.execute(migration.read_text(encoding="utf-8"))
            cls.users = [row[0] for row in conn.execute("""
                insert into auth.users (email)
                select 'hoa-' || i || '@webuy.test' from generate_series(1, 25) as i returning id
            """)]

    def create(self, product, owner=None):
        status, body = request(owner or self.users[0], "create_buying_group", product, "hn", Jsonb(1), uuid4())
        self.assertEqual(status, 201, body)
        return UUID(body["group"]["id"]), UUID(body["myReservation"]["id"])

    def join(self, user, group, key=None):
        status, body = request(user, "join_buying_group", group, key or uuid4())
        self.assertEqual(status, 201, body)
        return UUID(body["myReservation"]["id"])

    def confirm(self, user, slot):
        status, body = request(user, "confirm_group_reservation", slot)
        self.assertEqual(status, 200, body)
        return body

    def lock(self, product):
        group, owner_slot = self.create(product)
        joiner_slot = self.join(self.users[1], group)
        self.confirm(self.users[0], owner_slot)
        result = self.confirm(self.users[1], joiner_slot)
        self.assertIsNotNone(result["group"]["lockedAt"])
        return group, owner_slot, joiner_slot

    def assert_error(self, expected, result):
        self.assertEqual((result[0], result[1]["message"]), expected, result)

    def backdate_hold(self, slot):
        with admin() as conn:
            conn.execute("""
                update group_reservations set created_at = now() - interval '11 minutes',
                  hold_expires_at = now() - interval '1 minute' where id = %s
            """, (slot,))

    def add_group_cart(self, user, product, group):
        status, body = request(user, "add_to_cart", product, "group", 1, str(group))
        self.assertEqual(status, 200, body)
        return next(item for item in body["items"] if item["groupId"] == str(group))

    def place(self, user, line_id, key=None):
        return request(user, "place_order", [UUID(line_id)], Jsonb(SHIPPING), key or uuid4())

    def legacy_cart_line(self, user, product, group, quantity=1):
        request(user, "get_cart")
        with admin() as conn:
            return str(conn.execute("""
                insert into cart_items (cart_id, product_id, kind, group_ref, quantity)
                select id, %s, 'group', %s, %s from carts where user_id = %s returning id
            """, (product, str(group), quantity, user)).fetchone()[0])

    def test_concurrent_create_has_one_group_and_one_slot(self):
        product = product_fixture()
        results = parallel([
            lambda user=user: request(user, "create_buying_group", product, "hn", Jsonb(1), uuid4())
            for user in self.users[:2]
        ])
        self.assertEqual(sorted(status for status, _ in results), [201, 409])
        self.assert_error((409, "GROUP_ALREADY_OPEN"), next(result for result in results if result[0] == 409))
        with admin() as conn:
            self.assertEqual(conn.execute("""
                select count(distinct g.id), count(r.id) from buying_groups g
                left join group_reservations r on r.group_id = g.id where g.product_id = %s
            """, (product,)).fetchone(), (1, 1))
        self.assertEqual(stock(product), (10, 0, 0, 0))

    def test_create_validates_duration_before_cast_and_insert(self):
        product = product_fixture()
        user = self.users[0]
        for value in ("abc", "1", {}, [], True, None, 1.5, 999999999999):
            with self.subTest(duration=value):
                result = request(user, "create_buying_group", product, "hn", Jsonb(value), uuid4())
                self.assert_error((400, "INVALID_DURATION"), result)
        self.assert_error((400, "INVALID_DURATION"), request(
            user, "create_buying_group", product, "hn", headers={"idempotency-key": str(uuid4())}
        ))
        with admin() as conn:
            self.assertEqual(conn.execute("select count(*) from buying_groups where product_id = %s", (product,)).fetchone()[0], 0)
            self.assertEqual(conn.execute("""
                select count(*) from group_reservations r join buying_groups g on r.group_id = g.id
                 where g.product_id = %s
            """, (product,)).fetchone()[0], 0)
        status, result = request(user, "create_buying_group", product, "hn", Jsonb(6), uuid4())
        self.assertEqual((status, result["group"]["occupied"], result["myReservation"]["status"]), (201, 1, "HOLD"))
        self.assertEqual(stock(product), (10, 0, 0, 0))

    def test_order_key_replay_matches_normalized_items_and_shipping(self):
        user = self.users[0]
        products = [product_fixture() for _ in range(3)]
        for product in products:
            _, cart = request(user, "add_to_cart", product, "retail", 1)
        ids = [next(UUID(item["id"]) for item in cart["items"] if item["productId"] == product) for product in products]
        key = uuid4()
        status, order = request(user, "place_order", ids[:2], Jsonb(SHIPPING), key)
        self.assertEqual(status, 200, order)
        cart_ids = {item["id"] for item in request(user, "get_cart")[1]["items"]}
        self.assertTrue(cart_ids.isdisjoint(map(str, ids[:2])))

        normalized = {**SHIPPING, "name": " " + SHIPPING["name"] + " ", "phone": "091.234-5678",
                      "address": SHIPPING["address"] + " "}
        status, replay = request(user, "place_order", [ids[1], ids[0], ids[1]], Jsonb(normalized), key)
        self.assertEqual((status, replay["id"], replay["replayed"]), (200, order["id"], True))
        self.assert_error((409, "IDEMPOTENCY_KEY_REUSED"), request(user, "place_order", [ids[2]], Jsonb(SHIPPING), key))
        self.assert_error((409, "IDEMPOTENCY_KEY_REUSED"), request(
            user, "place_order", ids[:2], Jsonb({**SHIPPING, "address": "Địa chỉ khác"}), key
        ))
        self.assertEqual([stock(product) for product in products], [(9, 1, 0, 1), (9, 1, 0, 1), (10, 0, 0, 0)])
        self.assertEqual({item["id"] for item in request(user, "get_cart")[1]["items"]}, cart_ids)

    def test_order_key_conflict_in_concurrent_requests(self):
        user = self.users[1]
        products = [product_fixture(), product_fixture()]
        for product in products:
            _, cart = request(user, "add_to_cart", product, "retail", 1)
        ids = [next(UUID(item["id"]) for item in cart["items"] if item["productId"] == product) for product in products]
        key = uuid4()
        results = parallel([
            lambda item_id=item_id: request(user, "place_order", [item_id], Jsonb(SHIPPING), key) for item_id in ids
        ])
        self.assertEqual(sorted(status for status, _ in results), [200, 409])
        self.assert_error((409, "IDEMPOTENCY_KEY_REUSED"), next(result for result in results if result[0] == 409))
        self.assertEqual(sorted(stock(product) for product in products), [(9, 1, 0, 1), (10, 0, 0, 0)])
        winner = results.index(next(result for result in results if result[0] == 200))
        status, replay = request(user, "place_order", [ids[winner]], Jsonb(SHIPPING), key)
        self.assertEqual((status, replay["id"]), (200, results[winner][1]["id"]))

    def test_legacy_order_replays_using_saved_shipping(self):
        user, key, old_item = self.users[2], uuid4(), uuid4()
        order_id = "LEGACY-" + uuid4().hex
        with admin() as conn:
            conn.execute("""
                insert into orders (id, user_id, status, subtotal, total, shipping, client_request_id)
                values (%s, %s, 'PENDING', 0, 0, %s, %s)
            """, (order_id, user, Jsonb(SHIPPING), key))
        status, replay = request(user, "place_order", [old_item], Jsonb(SHIPPING), key)
        self.assertEqual((status, replay["id"], replay["replayed"]), (200, order_id, True))
        self.assert_error((409, "IDEMPOTENCY_KEY_REUSED"), request(
            user, "place_order", [old_item], Jsonb({**SHIPPING, "name": "Người nhận khác"}), key
        ))
        with admin() as conn:
            self.assertEqual(conn.execute("select count(*) from orders where user_id = %s and client_request_id = %s",
                                          (user, key)).fetchone()[0], 1)
            self.assertEqual(conn.execute("select count(*) from stock_holds where order_id = %s", (order_id,)).fetchone()[0], 0)

    def test_20_accounts_compete_for_last_slot_at_4_of_5(self):
        product = product_fixture(5)
        group, _ = self.create(product)
        for user in self.users[1:4]:
            self.join(user, group)
        keys = {user: uuid4() for user in self.users[4:24]}
        results = parallel([lambda user=user: request(user, "join_buying_group", group, keys[user]) for user in keys])
        self.assertEqual([status for status, _ in results].count(201), 1)
        for result in results:
            if result[0] != 201:
                self.assert_error((409, "FULL"), result)
        snapshot = request(None, "get_buying_group", group)[1]
        self.assertEqual((snapshot["group"]["occupied"], snapshot["group"]["status"]), (5, "FULL"))
        self.assertIsNone(snapshot["group"]["lockedAt"])
        self.assertIsNone(snapshot["myReservation"])
        with admin() as conn:
            self.assertEqual(conn.execute("select count(*) from group_reservations where group_id = %s", (group,)).fetchone()[0], 5)
        self.assertEqual(stock(product), (10, 0, 0, 0))

    def test_same_key_replay_header_and_two_tabs(self):
        product = product_fixture(4)
        owner, buyer = self.users[:2]
        key = uuid4()
        first = request(owner, "create_buying_group", product, "HN", Jsonb(1), headers={"idempotency-key": str(key)})
        self.assertEqual(first[0], 201)
        self.assertEqual(request(owner, "create_buying_group", product, "hn", Jsonb(1), key), first)
        self.assert_error((409, "IDEMPOTENCY_KEY_REUSED"), request(owner, "create_buying_group", product, "dn", Jsonb(1), key))
        self.assert_error((400, "IDEMPOTENCY_KEY_REQUIRED"), request(buyer, "create_buying_group", product, "hn", Jsonb(1)))
        group = UUID(first[1]["group"]["id"])
        join_key = uuid4()
        repeats = parallel([lambda: request(buyer, "join_buying_group", group, join_key)] * 5)
        self.assertEqual(repeats[0][0], 201)
        self.assertTrue(all(result == repeats[0] for result in repeats))
        other = self.users[2]
        results = parallel([lambda: request(other, "join_buying_group", group, uuid4())] * 2)
        self.assertEqual(sorted(status for status, _ in results), [200, 201])
        self.assertEqual(results[0][1]["myReservation"]["id"], results[1][1]["myReservation"]["id"])

    def test_full_error_replays_after_slot_released(self):
        group, _ = self.create(product_fixture())
        slot = self.join(self.users[1], group)
        key = uuid4()
        result = request(self.users[2], "join_buying_group", group, key)
        self.assert_error((409, "FULL"), result)
        request(self.users[1], "cancel_group_reservation", slot)
        self.assertEqual(request(self.users[2], "join_buying_group", group, key), result)
        self.join(self.users[2], group)

    def test_hold_expiry_reopens_group_and_new_attempt_has_new_id(self):
        product = product_fixture()
        group, _ = self.create(product)
        user = self.users[1]
        old = self.join(user, group)
        self.confirm(user, old)
        self.backdate_hold(old)
        pending = request(user, "get_buying_group", group)[1]
        self.assertEqual((pending["group"]["status"], pending["group"]["occupied"], pending["myReservation"]["status"]),
                         ("OPEN", 1, "EXPIRED"))
        self.assert_error((409, "RESERVATION_EXPIRED"), request(user, "confirm_group_reservation", old))
        self.assertNotEqual(self.join(user, group), old)
        self.assertEqual(stock(product), (10, 0, 0, 0))

    def test_cancellation_checks_owner_and_releases_once(self):
        product = product_fixture()
        group, _ = self.create(product)
        slot = self.join(self.users[1], group)
        self.assert_error((404, "RESERVATION_NOT_FOUND"), request(self.users[0], "cancel_group_reservation", slot))
        self.assert_error((403, "NOT_GROUP_CREATOR"), request(self.users[1], "cancel_buying_group", group))
        for _ in range(2):
            status, result = request(self.users[1], "cancel_group_reservation", slot)
            self.assertEqual((status, result["group"]["occupied"]), (200, 1))
        status, result = request(self.users[0], "cancel_buying_group", group)
        self.assertEqual((status, result["group"]["status"], result["group"]["occupied"]), (200, "CANCELLED", 0))
        self.assert_error((409, "GROUP_CLOSED"), request(self.users[2], "join_buying_group", group, uuid4()))
        self.assertEqual(stock(product), (10, 0, 0, 0))

    def test_locked_group_survives_hold_ttl_and_uses_each_slot_price(self):
        product = product_fixture()
        group, owner_slot = self.create(product)
        with admin() as conn:
            conn.execute("update products set group_price = 159000 where id = %s", (product,))
        joiner_slot = self.join(self.users[1], group)
        self.assertIsNone(self.confirm(self.users[0], owner_slot)["group"]["lockedAt"])
        result = self.confirm(self.users[1], joiner_slot)
        self.assertIsNotNone(result["group"]["lockedAt"])
        self.assertFalse(result["group"]["canCancel"])
        self.backdate_hold(owner_slot)
        self.assert_error((409, "GROUP_NOT_CANCELLABLE"), request(self.users[0], "cancel_buying_group", group))
        self.assert_error((409, "RESERVATION_NOT_EDITABLE"), request(self.users[0], "cancel_group_reservation", owner_slot))
        self.assertEqual(stock(product), (10, 0, 0, 0))
        for user, price in zip(self.users[:2], (149000, 159000)):
            line = self.add_group_cart(user, product, group)
            self.assertEqual((line["unitPrice"], line["lineTotal"], line["quantity"]), (price, price, 1))
            self.assertEqual(self.add_group_cart(user, product, group)["id"], line["id"])
            key = uuid4()
            status, order = self.place(user, line["id"], key)
            self.assertEqual(status, 200, order)
            self.assertEqual((order["status"], order["total"], order["items"][0]["unitPrice"], order["items"][0]["lineTotal"]),
                             ("PENDING", price, price, price))
            self.assertEqual(self.place(user, line["id"], key)[1]["id"], order["id"])
            self.assert_error((409, "RESERVATION_ALREADY_ORDERED"),
                              request(user, "add_to_cart", product, "group", 1, str(group)))
        summary = request(None, "get_buying_group", group)[1]["group"]
        self.assertEqual(summary["status"], "COMPLETED")
        self.assertEqual(stock(product), (8, 2, 0, 2))

    def test_group_order_denies_wrong_owner_product_quantity_and_unlocked_state(self):
        product = product_fixture()
        group, _ = self.create(product)
        first, second, outsider = self.users[:3]
        line = self.legacy_cart_line(first, product, group)
        self.assert_error((409, "GROUP_NOT_READY"), self.place(first, line))
        self.confirm(first, UUID(request(first, "get_buying_group", group)[1]["myReservation"]["id"]))
        self.confirm(second, self.join(second, group))
        outsider_line = self.legacy_cart_line(outsider, product, group)
        self.assert_error((403, "RESERVATION_REQUIRED"), self.place(outsider, outsider_line))
        other_product = product_fixture()
        mismatch = self.legacy_cart_line(first, other_product, group)
        self.assert_error((404, "GROUP_NOT_FOUND"), self.place(first, mismatch))
        too_many = self.legacy_cart_line(second, product, group, 2)
        self.assert_error((400, "INVALID_GROUP_QUANTITY"), self.place(second, too_many))
        self.assertEqual(stock(product), (10, 0, 0, 0))
        self.assertEqual(stock(other_product), (10, 0, 0, 0))

    def test_out_of_stock_rolls_back_order_and_reservation(self):
        product = product_fixture()
        group, slot, _ = self.lock(product)
        user = self.users[0]
        line = self.add_group_cart(user, product, group)
        with admin() as conn:
            conn.execute("update products set stock_available = 0 where id = %s", (product,))
            orders_before = conn.execute("select count(*) from orders where user_id = %s", (user,)).fetchone()[0]
        self.assert_error((409, "OUT_OF_STOCK"), self.place(user, line["id"]))
        with admin() as conn:
            self.assertEqual(conn.execute("select count(*) from orders where user_id = %s", (user,)).fetchone()[0], orders_before)
            self.assertEqual(conn.execute("select status, order_id from group_reservations where id = %s", (slot,)).fetchone(),
                             ("CONFIRMED", None))
        self.assertEqual(stock(product), (0, 0, 0, 0))
        self.assertTrue(any(item["id"] == line["id"] for item in request(user, "get_cart")[1]["items"]))

    def test_group_deadline_invalidates_unused_slot_and_preserves_existing_order(self):
        product = product_fixture()
        group, _, joiner_slot = self.lock(product)
        first, second = self.users[:2]
        line = self.add_group_cart(first, product, group)
        order = self.place(first, line["id"])[1]
        unused = self.add_group_cart(second, product, group)
        with admin() as conn:
            conn.execute("""
                update buying_groups set created_at = now() - interval '2 hours',
                  locked_at = now() - interval '1 hour', ends_at = now() - interval '1 minute' where id = %s
            """, (group,))
            before = stock(product)
            conn.execute("select expire_buying_groups()")
            self.assertEqual(conn.execute("select status from group_reservations where id = %s", (joiner_slot,)).fetchone()[0], "EXPIRED")
            self.assertEqual(conn.execute("select expire_buying_groups()").fetchone()[0],
                             {"expiredGroups": 0, "expiredReservations": 0})
        self.assert_error((409, "RESERVATION_EXPIRED"), self.place(second, unused["id"]))
        self.assert_error((409, "GROUP_EXPIRED"), request(self.users[2], "join_buying_group", group, uuid4()))
        self.assertEqual(request(first, "get_order", order["id"])[1]["status"], "PENDING")
        self.assertEqual(stock(product), before)

    def test_summary_and_rls_across_sessions(self):
        product = product_fixture()
        group, owner_slot = self.create(product)
        owner, visitor = self.users[:2]
        with admin() as conn:
            conn.execute("insert into coin_wallets (user_id) values (%s), (%s)", (owner, visitor))
            conn.execute("insert into coin_ledger (user_id, event_ref, delta) values (%s, 'fixture', 1), (%s, 'fixture', 1)",
                         (owner, visitor))
            conn.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps({"sub": str(visitor)}),))
            conn.execute("set role authenticated")
            self.assertEqual(conn.execute("select count(*) from group_reservations where id = %s", (owner_slot,)).fetchone()[0], 0)
            self.assertEqual(conn.execute("select user_id from coin_wallets").fetchall(), [(visitor,)])
            self.assertEqual(conn.execute("select user_id from coin_ledger").fetchall(), [(visitor,)])
            for query in ("select * from idempotency_requests", "delete from group_reservations", "select expire_buying_groups()"):
                with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                    conn.execute(query)
        self.assertIsNone(request(visitor, "list_buying_groups", product)[1]["items"][0]["myReservation"])
        self.join(visitor, group)
        for user in (owner, visitor, None):
            result = request(user, "list_buying_groups", product)[1]["items"][0]
            self.assertEqual((result["group"]["occupied"], result["group"]["status"]), (2, "FULL"))
        self.assertIsNone(request(None, "get_buying_group", group)[1]["myReservation"])

    def test_retail_order_keeps_existing_price_and_stock(self):
        product = product_fixture()
        user = self.users[0]
        _, cart = request(user, "add_to_cart", product, "retail", 2)
        line = next(item for item in cart["items"] if item["productId"] == product)
        status, order = self.place(user, line["id"])
        self.assertEqual((status, order["total"], order["items"][0]["quantity"]), (200, 378000, 2))
        self.assertEqual(stock(product), (8, 2, 0, 1))


if __name__ == "__main__":
    unittest.main(verbosity=2)
