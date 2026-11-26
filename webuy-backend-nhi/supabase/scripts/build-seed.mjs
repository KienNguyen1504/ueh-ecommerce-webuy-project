// Sinh supabase/seed.sql từ js/catalog-data.js (nguồn sản phẩm cũ của frontend).
// Chạy lại mỗi khi nhóm duyệt thêm sản phẩm:  node supabase/scripts/build-seed.mjs
// File seed dùng ON CONFLICT nên chạy nhiều lần không tạo bản trùng và giữ nguyên ID cũ.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_STOCK = 50;
const STORE_ID = '00000000-0000-4000-8000-000000000001';

// Chạy catalog-data.js trong môi trường giả lập trình duyệt (không có sản phẩm seller trong localStorage)
const sandbox = { window: {}, localStorage: { getItem: () => null }, console };
vm.runInNewContext(readFileSync(join(root, 'js', 'catalog-data.js'), 'utf8'), sandbox);
const products = sandbox.window.WEBUY_PRODUCTS;
if (!Array.isArray(products) || !products.length) throw new Error('Không đọc được WEBUY_PRODUCTS');

const slug = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sql = value => value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`;

const ids = new Set();
for (const p of products) {
  if (ids.has(p.id)) throw new Error(`Trùng ID sản phẩm: ${p.id}`);
  ids.add(p.id);
  if (!(p.retail > 0 && p.group > 0 && p.group <= p.retail)) throw new Error(`Giá không hợp lệ ở sản phẩm ${p.id}`);
}

const categories = [...new Set(products.map(p => p.category))];
const lines = [];
lines.push('-- TỰ SINH bởi supabase/scripts/build-seed.mjs từ js/catalog-data.js. Đừng sửa tay, hãy chạy lại script.');
lines.push(`-- ${products.length} sản phẩm, ${categories.length} danh mục. Chạy nhiều lần không tạo bản trùng.`);
lines.push('begin;');
lines.push('');
lines.push('insert into public.categories (id, name, sort_order) values');
lines.push(categories.map((c, i) => `  (${sql(slug(c))}, ${sql(c)}, ${i + 1})`).join(',\n'));
lines.push('on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;');
lines.push('');
lines.push('insert into public.stores (id, owner_id, name, slug, description) values');
lines.push(`  (${sql(STORE_ID)}, null, 'WeBuy Official', 'webuy-official', 'Cửa hàng hệ thống chứa sản phẩm mẫu của WeBuy.')`);
lines.push('on conflict (id) do nothing;');
lines.push('');
lines.push('insert into public.products (id, slug, store_id, category_id, name, description, retail_price, group_price,');
lines.push('                             min_members, image_path, badge, status, stock_available, published_at) values');
lines.push(products.map(p => `  (${[
  sql(p.id), sql(`${slug(p.name)}-${p.id}`), sql(STORE_ID), sql(slug(p.category)), sql(p.name), sql(p.description || ''),
  Number(p.retail), Number(p.group), Number(p.minMembers) || 2, sql(p.image), sql(p.badge || ''),
  "'published'", DEFAULT_STOCK, 'now()'
].join(', ')})`).join(',\n'));
lines.push('on conflict (id) do update set');
lines.push('  slug = excluded.slug, category_id = excluded.category_id, name = excluded.name, description = excluded.description,');
lines.push('  retail_price = excluded.retail_price, group_price = excluded.group_price, min_members = excluded.min_members,');
lines.push('  image_path = excluded.image_path, badge = excluded.badge;');
lines.push('-- Lưu ý: khi chạy lại, seed KHÔNG ghi đè trạng thái (status) và tồn kho đang có trên database.');
lines.push('');
lines.push('commit;');

writeFileSync(join(root, 'supabase', 'seed.sql'), lines.join('\n') + '\n');
console.log(`Đã tạo supabase/seed.sql: ${products.length} sản phẩm, ${categories.length} danh mục.`);
