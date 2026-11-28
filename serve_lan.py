"""WeBuy Wi-Fi demo. Run with Python 3.9+; no external dependencies."""
import argparse
import hashlib
import json
import mimetypes
import re
import secrets
import socket
import sqlite3
import sys
import time
from contextlib import closing
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parent
COOKIE = "webuy_lan_device"
HOURS = {1, 6, 12, 24, 48, 72, 168}
REGIONS = "hcm hn hcm dn hcm dna hn dn hn hcm dn hcm hn hcm dn hn hcm hn dna dn hcm hn hcm dn".split()
catalog_source = (ROOT / "js/catalog-data.js").read_text(encoding="utf-8")
CATALOG = {p["id"]: p for p in json.JSONDecoder().raw_decode(
    catalog_source.split("window.WEBUY_PRODUCTS = ", 1)[1])[0]}


def now_ms():
    return time.time_ns() // 1_000_000


def pack(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def connect(filename):
    db = sqlite3.connect(filename, timeout=8)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db


def initialize(filename):
    with closing(connect(filename)) as db, db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
          CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY, product TEXT NOT NULL, need INTEGER NOT NULL,
            region TEXT NOT NULL, created INTEGER NOT NULL, deadline INTEGER NOT NULL,
            creator TEXT, seed_count INTEGER NOT NULL DEFAULT 0,
            request_id TEXT, UNIQUE(creator,request_id));
          CREATE TABLE IF NOT EXISTS members (
            room TEXT REFERENCES rooms(id), device TEXT NOT NULL, PRIMARY KEY(room,device));
          CREATE TABLE IF NOT EXISTS messages (
            seq INTEGER PRIMARY KEY, room TEXT REFERENCES rooms(id), device TEXT NOT NULL,
            request_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, time INTEGER NOT NULL,
            UNIQUE(room,device,request_id));
          CREATE INDEX IF NOT EXISTS message_thread ON messages(room,seq);
          CREATE TABLE IF NOT EXISTS shared_products (id TEXT PRIMARY KEY, data TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS revision (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER NOT NULL);
          INSERT OR IGNORE INTO revision VALUES(1,1);
        """)
        start = now_ms()
        for i, p in enumerate(CATALOG.values()):
            db.execute("""INSERT OR IGNORE INTO rooms(id,product,need,region,created,deadline,seed_count)
                          VALUES(?,?,?,?,?,?,?)""",
                       ("demo-" + p["id"], p["id"], p["minMembers"], REGIONS[i % len(REGIONS)],
                        start, start + (18,12,20,9,16,14,17,11)[i % 8]*3600000, p.get("initialMembers", 0)))


class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def field(data, key, limit, pattern=None):
    value = data.get(key)
    if not isinstance(value, str) or not (0 < len(value.strip()) <= limit):
        raise Problem(400, "Thông tin không hợp lệ: " + key)
    value = value.strip()
    if pattern and not re.fullmatch(pattern, value):
        raise Problem(400, "Thông tin không hợp lệ: " + key)
    return value


def snapshot(db, device):
    rows = db.execute("""SELECT r.*, count(m.device) AS joined_count,
                      max(CASE WHEN m.device=? THEN 1 ELSE 0 END) AS mine
                      FROM rooms r LEFT JOIN members m ON m.room=r.id GROUP BY r.id
                      ORDER BY r.created,r.id""", (device,))
    groups = [dict(id=r["id"], productId=r["product"], need=r["need"], regionCode=r["region"],
                   createdAt=r["created"], endsAt=r["deadline"], isDemo=r["creator"] is None,
                   createdBy=device if r["creator"] == device else None, members=[device] if r["mine"] else [],
                   demoCount=r["seed_count"] + r["joined_count"] - r["mine"]) for r in rows]
    return dict(uid=device, groups=groups,
                products=[json.loads(r[0]) for r in db.execute("SELECT data FROM shared_products")],
                revision=db.execute("SELECT value FROM revision").fetchone()[0])


def product_for(db, data):
    pid = field(data, "productId", 80, r"[\w-]+")
    if pid in CATALOG:
        return CATALOG[pid]
    stored = db.execute("SELECT data FROM shared_products WHERE id=?", (pid,)).fetchone()
    if stored:
        return json.loads(stored[0])
    # A locally published seller item needs a public snapshot for the invited device.
    p = data.get("product")
    if not isinstance(p, dict) or not pid.startswith("seller-") or p.get("id") != pid:
        raise Problem(404, "Không tìm thấy sản phẩm.")
    for key in ("retail", "group", "minMembers"):
        if type(p.get(key)) is not int or not (1 <= p[key] <= 10**11):
            raise Problem(400, "Giá hoặc số thành viên chưa hợp lệ.")
    if p["group"] > p["retail"] or not 2 <= p["minMembers"] <= 1000:
        raise Problem(400, "Điều kiện mua chung chưa hợp lệ.")
    img = field(p, "image", 2_000_000)
    if not (re.fullmatch(r"data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+", img) or
            urlsplit(img).scheme in {"https","http"} or re.fullmatch(r"images/[\w./-]+", img)):
        raise Problem(400, "Ảnh sản phẩm không hợp lệ.")
    item = dict(id=pid, name=field(p,"name",120), description=field(p,"description",2000),
                category=field(p,"category",100), image=img, price=p["retail"], retail=p["retail"],
                group=p["group"], minMembers=p["minMembers"], initialMembers=0, badge="Từ người bán")
    db.execute("INSERT INTO shared_products VALUES(?,?)", (pid,pack(item)))
    return item


def mutate_group(db, device, room_id, action, data):
    if action == "create":
        request_id = field(data,"requestId",100,r"[\w-]+")
        existing = db.execute("SELECT id FROM rooms WHERE creator=? AND request_id=?", (device,request_id)).fetchone()
        if existing:
            return existing[0]
        p = product_for(db,data)
        existing = db.execute("""SELECT r.id FROM rooms r JOIN members m ON r.id=m.room WHERE m.device=?
             AND r.product=? AND r.creator IS NOT NULL AND r.deadline>?
             AND (SELECT count(*) FROM members WHERE room=r.id)<r.need LIMIT 1""",
                              (device,p["id"],now_ms())).fetchone()
        if existing:
            return existing[0]
        hours = data.get("hours")
        if type(hours) is not int or hours not in HOURS:
            raise Problem(400,"Hạn chốt nhóm không hợp lệ.")
        region = field(data,"region",12,r"[a-z]+")
        room_id = "lan-" + secrets.token_hex(10)
        start = now_ms()
        db.execute("""INSERT INTO rooms(id,product,need,region,created,deadline,creator,request_id)
                      VALUES(?,?,?,?,?,?,?,?)""",
                   (room_id,p["id"],p["minMembers"],region,start,start+hours*3600000,device,request_id))
        db.execute("INSERT INTO members VALUES(?,?)",(room_id,device))
    else:
        room = db.execute("SELECT * FROM rooms WHERE id=?", (room_id,)).fetchone()
        if not room:
            raise Problem(404,"Nhóm này không còn trên máy chủ.")
        joined = db.execute("SELECT 1 FROM members WHERE room=? AND device=?", (room_id,device)).fetchone()
        if action == "join":
            if joined:
                return room_id
            count = db.execute("SELECT count(*) FROM members WHERE room=?", (room_id,)).fetchone()[0]
            if now_ms() >= room["deadline"] or count + room["seed_count"] >= room["need"]:
                raise Problem(409,"Nhóm đã đủ người hoặc hết hạn.")
            db.execute("INSERT INTO members VALUES(?,?)",(room_id,device))
        elif action == "leave":
            if not joined:
                return room_id
            db.execute("DELETE FROM members WHERE room=? AND device=?", (room_id,device))
    db.execute("UPDATE revision SET value=value+1 WHERE id=1")
    return room_id


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, status, body=b"", content="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type",content)
        self.send_header("Content-Length",str(len(body)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Referrer-Policy","same-origin")
        if getattr(self,"new_token",None):
            self.send_header("Set-Cookie",f"{COOKIE}={self.new_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000")
        self.end_headers()
        self.wfile.write(body)

    def device(self, create=False):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie",""))
        except ValueError:
            pass
        token = cookie[COOKIE].value if COOKIE in cookie else ""
        if not re.fullmatch(r"[a-f0-9]{64}",token):
            if not create:
                raise Problem(401,"Hãy tải lại trang để nhận phiên trên thiết bị này.")
            token = self.new_token = secrets.token_hex(32)
        return hashlib.sha256(token.encode()).hexdigest()[:32]

    def read_body(self):
        if self.headers.get_content_type() != "application/json":
            raise Problem(415,"Cần dữ liệu JSON.")
        size = int(self.headers.get("Content-Length",0))
        if not 0 < size <= 2_100_000:
            raise Problem(413,"Nội dung quá lớn hoặc trống.")
        data = json.loads(self.rfile.read(size))
        if not isinstance(data,dict):
            raise Problem(400,"Nội dung không hợp lệ.")
        return data

    def dispatch(self, write):
        url = urlsplit(self.path)
        path = unquote(url.path)
        if not path.startswith("/api/"):
            if write:
                raise Problem(405,"Thao tác không hợp lệ.")
            return self.static(path)
        device = self.device()
        if write and (self.headers.get("Origin") != "http://" + self.headers.get("Host","")):
            raise Problem(403,"Mở trang WeBuy từ địa chỉ Wi-Fi của máy chủ.")
        data = self.read_body() if write else {}
        with closing(connect(self.server.database)) as db, db:
            db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            if path == "/api/groups" and not write:
                rev = db.execute("SELECT value FROM revision").fetchone()[0]
                if parse_qs(url.query).get("since") == [str(rev)]:
                    return self.reply(204)
                value = snapshot(db,device)
            else:
                route = re.fullmatch(r"/api/groups/([\w-]+)/(join|leave|messages)",path)
                if write and (path == "/api/groups" or route and route[2] != "messages"):
                    rid = mutate_group(db,device,route[1] if route else None,route[2] if route else "create",data)
                    value = dict(id=rid, state=snapshot(db,device))
                elif route and route[2] == "messages":
                    rid = route[1]
                    if not db.execute("SELECT 1 FROM members WHERE room=? AND device=?",(rid,device)).fetchone():
                        raise Problem(403,"Hãy tham gia nhóm để mở chat.")
                    if write:
                        db.execute("""INSERT INTO messages(room,device,request_id,name,text,time) VALUES(?,?,?,?,?,?)
                                   ON CONFLICT(room,device,request_id) DO NOTHING""",
                                   (rid,device,field(data,"requestId",100,r"[\w-]+"),field(data,"name",80),
                                    field(data,"text",1000),now_ms()))
                        value = {"sent":True}
                    else:
                        after = max(0,int(parse_qs(url.query).get("after",["0"])[0]))
                        value = [dict(r) for r in db.execute("""SELECT seq,device AS uid,name,text,time FROM messages
                                      WHERE room=? AND seq>? ORDER BY seq LIMIT 100""",(rid,after))]
                else:
                    raise Problem(404,"Không tìm thấy đường dẫn.")
            db.commit()
            self.reply(200,pack(value).encode())

    def static(self, path):
        filename = path.lstrip("/") or "index.html"
        file = (ROOT / filename).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():
            raise Problem(404,"Không tìm thấy trang.")
        rel = file.relative_to(ROOT)
        page = len(rel.parts) == 1 and file.suffix == ".html"
        public_client = rel.parts in {
            ("webuy-backend-nhi", "js", "api-config.js"),
            ("webuy-backend-nhi", "js", "api-client.js"),
        }
        if not page and not public_client and (rel.parts[0] not in {"js","css","images"} or file.suffix.lower() not in
                         {".js",".css",".svg",".png",".webp",".jpg",".jpeg",".ico",".woff2"}):
            raise Problem(404,"Không tìm thấy tài nguyên.")
        content = file.read_bytes()
        if page:
            user = self.device(create=True)
            with closing(connect(self.server.database)) as db, db:
                db.execute("BEGIN")
                state = snapshot(db,user)
            if self.headers.get("Host","").split(":")[0] in {"localhost","127.0.0.1"}:
                state["shareOrigin"] = self.server.share_origin
            boot = pack(state).replace("<","\\u003c")
            tag = '<script id="lan-state" type="application/json">' + boot + '</script><script src="/js/lan-client.js"></script>'
            content = content.replace(b"</head>",tag.encode()+b"</head>",1)
        self.reply(200,content,("text/html; charset=utf-8" if page else mimetypes.guess_type(file.name)[0] or "application/octet-stream"))

    def handle_request(self, write):
        try:
            self.dispatch(write)
        except Problem as e:
            self.reply(e.status,pack({"error":e.message}).encode())
        except (ValueError,OverflowError):
            self.reply(400,pack({"error":"Dữ liệu không hợp lệ."}).encode())
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):
            pass
        except sqlite3.Error as e:
            print("SQLite:",e,file=sys.stderr)
            self.reply(503,pack({"error":"Chưa truy cập được dữ liệu. Hãy thử lại."}).encode())

    def do_GET(self):
        self.handle_request(False)

    def do_POST(self):
        self.handle_request(True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host",default="0.0.0.0")
    parser.add_argument("--port",type=int,default=5517)
    parser.add_argument("--database",type=Path,default=ROOT/".webuy-lan"/"groups.sqlite3")
    args = parser.parse_args()
    args.database.parent.mkdir(parents=True,exist_ok=True)
    initialize(args.database)
    with ThreadingHTTPServer((args.host,args.port),Handler) as server:
        server.database = args.database
        host = socket.gethostbyname(socket.gethostname()) if args.host == "0.0.0.0" else args.host
        server.share_origin = f"http://{host}:{server.server_port}"
        print(f"WeBuy Wi-Fi: http://{host}:{server.server_port}/",flush=True)
        server.serve_forever()
