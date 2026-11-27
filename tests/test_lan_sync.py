"""Run with python -B tests/test_lan_sync.py. Uses an isolated temporary database."""
import http.cookiejar
import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import serve_lan as app


class Phone:
    def __init__(self, base):
        self.base = base
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}),
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        with self.http.open(base + "/product-detail.html?id=2") as r:
            assert b'id="lan-state"' in r.read()

    def api(self, path="", body=None):
        req = urllib.request.Request(self.base + "/api/groups" + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type":"application/json","Origin":self.base})
        with self.http.open(req) as r:
            return json.load(r)


class SyncTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.database = Path(temp.name)/"test.db"
        app.initialize(self.database)
        self.server = app.ThreadingHTTPServer(("127.0.0.1",0),app.Handler)
        self.server.database = self.database
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        self.server.share_origin = self.base
        thread = threading.Thread(target=self.server.serve_forever,daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.a,self.b,self.c = [Phone(self.base) for _ in range(3)]
        self.create = {"requestId":"first","region":"hn","hours":6,"productId":"2"}
        self.room = "/"+self.a.api(body=self.create)["id"]

    def test_invite_membership_and_messages(self):
        self.assertEqual("/"+self.a.api(body=self.create)["id"],self.room)
        room = next(g for g in self.b.api()["groups"] if g["id"]==self.room[1:])
        self.assertEqual((room["members"],room["demoCount"]),([],1))
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.b.api(self.room+"/messages")
        self.assertEqual(error.exception.code,403)
        self.b.api(self.room+"/join",{})
        self.b.api(self.room+"/join",{})
        msg = {"requestId":"m1","name":"Minh","text":"Chốt đơn nhé!"}
        self.b.api(self.room+"/messages",msg)
        self.b.api(self.room+"/messages",msg)
        data = self.a.api(self.room+"/messages")
        self.assertEqual([m["text"] for m in data],["Chốt đơn nhé!"])
        self.assertEqual(self.a.api(self.room+"/messages?after="+str(data[0]["seq"])),[])
        self.a.api(self.room+"/messages",{**msg,"name":"An","text":"Đồng ý."})
        self.assertEqual(len(self.b.api(self.room+"/messages")),2)
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.c.api(self.room+"/join",{})
        self.assertEqual(error.exception.code,409)
        self.b.api(self.room+"/leave",{})
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.b.api(self.room+"/messages",msg)
        self.assertEqual(error.exception.code,403)
        app.initialize(self.database)
        self.assertEqual(len(self.a.api(self.room+"/messages")),2)

    def test_concurrent_last_place(self):
        def join(phone):
            try:
                phone.api(self.room+"/join",{})
                return 200
            except urllib.error.HTTPError as error:
                return error.code
        with ThreadPoolExecutor(2) as pool:
            self.assertEqual(sorted(pool.map(join,[self.b,self.c])),[200,409])

    def test_expiry(self):
        with closing(app.connect(self.database)) as db, db:
            db.execute("UPDATE rooms SET deadline=0 WHERE id=?",(self.room[1:],))
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.b.api(self.room+"/join",{})
        self.assertEqual(error.exception.code,409)


if __name__ == "__main__":
    unittest.main()
