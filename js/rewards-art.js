/* WeBuy | Tính năng 11 - Hình vẽ cho khu vực Xu WeBuy.
 * File này CHỈ chứa hình SVG (đồng xu, nhân vật trò chơi, vịt "Điểm danh săn quà").
 * Mỗi hàm nhận kích thước (px) và trả về một chuỗi <svg>...</svg> để rewards.js chèn vào trang.
 * Toàn bộ hình là hình tự vẽ của nhóm, không dùng linh vật của sàn khác.
 */
(() => {
  'use strict';

  // Bảng màu của khu vực xu (trùng với các biến --wbr-* trong css/rewards.css)
  const ORANGE = '#FD550A';
  const GREEN = '#015D47';
  const LIME = '#E0F354';
  const CREAM = '#FFF6E5';
  const INK = '#0B2A22';

  /* Đồng xu có chữ W */
  function coin(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="${LIME}" stroke="${INK}" stroke-width="2"/>
      <path d="M7 9l2.2 6.5L12 10l2.8 5.5L17 9" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* Chồng xu, dùng cho ô Ngày 7 và màn Chúc mừng */
  function coinStack(size) {
    const height = Math.round(size * 44 / 48);
    return `<svg width="${size}" height="${height}" viewBox="0 0 48 44" aria-hidden="true">
      <ellipse cx="26" cy="36" rx="17" ry="6" fill="${LIME}" stroke="${INK}" stroke-width="2"/>
      <ellipse cx="26" cy="30" rx="17" ry="6" fill="${LIME}" stroke="${INK}" stroke-width="2"/>
      <circle cx="20" cy="18" r="15" fill="${LIME}" stroke="${INK}" stroke-width="2.4"/>
      <path d="M12.5 13.5l3.3 9.5 4.2-8 4.2 8 3.3-9.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* Dấu tích cho ngày đã điểm danh */
  function check(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="${LIME}" stroke="${INK}" stroke-width="2"/>
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* Nhân vật trong trò chơi "Gom nhóm 15 giây".
   * kind: 'cam' | 'meo' | 'vit' | 'mam' là bạn mua chung, 'le' là người mua lẻ (không nên bấm).
   */
  const BUDDY_COLORS = { cam: ORANGE, meo: LIME, vit: CREAM, mam: '#FFFFFF', le: '#A7B0AC' };

  function buddy(kind, size) {
    const height = Math.round(size * 62 / 56);
    let parts = '';

    // Bóng đổ và hai bàn chân
    parts += `<ellipse cx="28" cy="58" rx="15" ry="3" fill="${INK}" opacity="0.28"/>`;
    parts += `<ellipse cx="20" cy="52" rx="6" ry="3.5" fill="${INK}"/><ellipse cx="36" cy="52" rx="6" ry="3.5" fill="${INK}"/>`;

    // Chi tiết nằm phía sau thân: tai mèo, chỏm lông vịt, mầm cây
    if (kind === 'meo') {
      parts += `<path d="M9 20l1-15 13 7z" fill="${LIME}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
      parts += `<path d="M47 20l-1-15-13 7z" fill="${LIME}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    if (kind === 'vit') {
      parts += `<path d="M25 11c-4-8 3-11 5-6c3-5 9 0 4 7z" fill="${CREAM}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    if (kind === 'mam') {
      parts += `<path d="M28 11v-6" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
      parts += `<path d="M28 6c1-6 8-7 12-4c-2 6-8 7-12 4z" fill="${LIME}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }

    // Thân tròn
    parts += `<circle cx="28" cy="30" r="21" fill="${BUDDY_COLORS[kind] || ORANGE}" stroke="${INK}" stroke-width="3"/>`;

    if (kind === 'le') {
      // Người mua lẻ: mày cau, miệng buồn
      parts += `<path d="M15 21l9 3M41 21l-9 3" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
      parts += `<circle cx="21" cy="28" r="3" fill="${INK}"/><circle cx="35" cy="28" r="3" fill="${INK}"/>`;
      parts += `<path d="M22 39q6-5 12 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
    } else {
      // Bạn mua chung: mắt long lanh, miệng cười
      parts += `<circle cx="21" cy="27" r="3.6" fill="${INK}"/><circle cx="35" cy="27" r="3.6" fill="${INK}"/>`;
      parts += `<circle cx="22.2" cy="25.8" r="1.2" fill="#fff"/><circle cx="36.2" cy="25.8" r="1.2" fill="#fff"/>`;
      if (kind === 'vit') {
        parts += `<ellipse cx="28" cy="36" rx="9" ry="5" fill="${ORANGE}" stroke="${INK}" stroke-width="2.5"/>`;
      } else {
        parts += `<path d="M21 35q7 7 14 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
      }
      if (kind === 'meo') {
        parts += `<path d="M5 31h8M5 36l8-2M51 31h-8M51 36l-8-2" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
      }
      if (kind === 'cam' || kind === 'mam') {
        parts += `<circle cx="14" cy="34" r="3" fill="${LIME}" opacity="0.9"/><circle cx="42" cy="34" r="3" fill="${LIME}" opacity="0.9"/>`;
      }
    }

    return `<svg width="${size}" height="${height}" viewBox="0 0 56 62" aria-hidden="true">${parts}</svg>`;
  }

  /* Nút nổi: chú vịt quàng khăn giơ hộp quà, kèm chữ "ĐIỂM DANH / SĂN QUÀ" */
  function duck(size) {
    const height = Math.round(size * 184 / 170);
    const font = "'Reddit Sans', system-ui, sans-serif";
    return `<svg width="${size}" height="${height}" viewBox="0 0 170 184" aria-hidden="true">
      <circle cx="85" cy="74" r="64" fill="${LIME}" stroke="${INK}" stroke-width="4"/>
      <circle cx="85" cy="74" r="52" fill="none" stroke="${GREEN}" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
      <rect x="6" y="30" width="14" height="8" rx="2" fill="${ORANGE}" stroke="${INK}" stroke-width="2" transform="rotate(-30 13 34)"/>
      <rect x="150" y="104" width="14" height="8" rx="2" fill="${GREEN}" stroke="${INK}" stroke-width="2" transform="rotate(25 157 108)"/>
      <circle cx="14" cy="108" r="6" fill="${ORANGE}" stroke="${INK}" stroke-width="2"/>
      <circle cx="24" cy="14" r="4" fill="${GREEN}"/><circle cx="160" cy="80" r="4" fill="${ORANGE}"/>

      <ellipse cx="80" cy="106" rx="42" ry="36" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>
      <ellipse cx="40" cy="104" rx="11" ry="18" fill="${CREAM}" stroke="${INK}" stroke-width="4" transform="rotate(18 40 104)"/>
      <path d="M70 34c-6-12 4-18 9-10c4-9 14-2 7 10z" fill="${CREAM}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="76" cy="60" r="30" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>
      <circle cx="64" cy="54" r="4.8" fill="${INK}"/><circle cx="65.5" cy="52.5" r="1.6" fill="#fff"/>
      <path d="M82 55q6-7 12 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="54" cy="66" r="5" fill="${ORANGE}" opacity="0.4"/><circle cx="98" cy="66" r="5" fill="${ORANGE}" opacity="0.4"/>
      <ellipse cx="76" cy="72" rx="17" ry="9" fill="${ORANGE}" stroke="${INK}" stroke-width="3.6"/>
      <path d="M63 72q13 6 26 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M51 86q25 12 50 0l-1 11q-24 10-48 0z" fill="${GREEN}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>

      <rect x="116" y="30" width="44" height="34" rx="5" fill="${ORANGE}" stroke="${INK}" stroke-width="4"/>
      <rect x="112" y="22" width="52" height="13" rx="4" fill="${ORANGE}" stroke="${INK}" stroke-width="4"/>
      <rect x="133" y="22" width="10" height="42" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="129" cy="16" rx="9" ry="6" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="147" cy="16" rx="9" ry="6" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>
      <path d="M108 102c12-4 22-16 26-36l13 6c-4 22-15 36-32 44z" fill="${CREAM}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>

      <g transform="rotate(-4 85 140)">
        <rect x="4" y="120" width="162" height="38" rx="13" fill="${ORANGE}" stroke="${INK}" stroke-width="4"/>
        <text x="85" y="149" text-anchor="middle" textLength="142" lengthAdjust="spacingAndGlyphs" font-family="${font}" font-size="27" font-weight="800" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">ĐIỂM DANH</text>
      </g>
      <rect x="30" y="152" width="110" height="30" rx="15" fill="${GREEN}" stroke="${INK}" stroke-width="4"/>
      <text x="85" y="175" text-anchor="middle" textLength="86" lengthAdjust="spacingAndGlyphs" font-family="${font}" font-size="23" font-weight="800" fill="${LIME}">SĂN QUÀ</text>
    </svg>`;
  }

  // Cho rewards.js dùng qua biến toàn cục WeBuyArt
  window.WeBuyArt = { coin, coinStack, check, buddy, duck };
})();
