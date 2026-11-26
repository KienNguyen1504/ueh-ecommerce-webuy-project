/* WeBuy | Cấu hình kết nối backend (dùng chung cho mọi trang).
 *
 * mode:
 *   'mock'     -> chạy giả lập ngay trên trình duyệt (localStorage), không cần internet. Dùng khi chưa có Supabase.
 *   'supabase' -> gọi backend thật. Cần điền supabaseUrl và supabaseKey bên dưới.
 *
 * supabaseKey là khóa "publishable" (anon key) — được phép để trong code frontend.
 * TUYỆT ĐỐI KHÔNG dán "secret key" / "service_role key" vào file này.
 *
 * Muốn thử nhanh chế độ khác mà không sửa file: mở Console và gõ
 *   localStorage.setItem('webuy_api_mode', 'supabase'); location.reload();
 *   localStorage.removeItem('webuy_api_mode'); location.reload();   // quay về theo file này
 */
window.WEBUY_API_CONFIG = {
  mode: 'mock',
  supabaseUrl: '',      // VD: 'https://abcdxyz.supabase.co'  (Hoa lấy ở Project Settings > API)
  supabaseKey: '',      // VD: 'sb_publishable_...' hoặc anon key
  storageBucket: 'store-assets',
  supabaseJsUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
};
