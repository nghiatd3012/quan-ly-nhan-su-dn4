// Hiển thị Markdown cơ bản cho thẻ Chính sách & Hướng dẫn. Mọi chữ được thoát trước rồi mới thêm thẻ,
// nên kết quả của sangHtml() an toàn khi gán innerHTML (ngoại lệ duy nhất của quy tắc "chỉ dùng textContent").
// Hỗ trợ: # ## ### · đoạn, xuống dòng · **đậm** *nghiêng* · danh sách - * 1. · [chữ](url) · ![ảnh](url) · bảng | a | b |.
window.Markdown = (function () {
  var URL_NGOAC = '\\(((?:[^()\\s]|\\([^()\\s]*\\))+)\\)';
  var RE_ANH = new RegExp('!\\[([^\\]]*)\\]' + URL_NGOAC, 'g');
  var RE_LK = new RegExp('\\[([^\\]]+)\\]' + URL_NGOAC, 'g');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // URL gốc (chưa thoát); chỉ nhận http(s) hoặc đường dẫn tương đối (không có ":"), tương đối thì thêm tiền tố goc.
  // Trả về chuỗi đã thoát để đặt trong thuộc tính, hoặc null.
  function urlAnToan(u, goc) {
    if (/^https?:\/\//i.test(u)) return esc(u);
    if (u.indexOf(':') < 0) return esc((goc || '') + u.replace(/^\.?\//, ''));
    return null;
  }
  function dinhDang(s) {   // s đã thoát, không chứa thẻ
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>');
  }
  // Ảnh và liên kết được nhận diện MỘT lượt trên chữ gốc; mỗi phần (chữ, alt, url) thoát riêng rồi mới ghép thẻ,
  // nên không thẻ nào lọt vào thuộc tính của thẻ khác. Đậm/nghiêng chỉ áp dụng cho phần chữ (không chạm url).
  var RE_ANH_LK = new RegExp('(!?)\\[([^\\]]*)\\]' + URL_NGOAC, 'g');
  function noiDong(s, goc) {
    var ra = '', cuoi = 0, m;
    RE_ANH_LK.lastIndex = 0;
    while ((m = RE_ANH_LK.exec(s))) {
      ra += dinhDang(esc(s.slice(cuoi, m.index)));
      var url = urlAnToan(m[3], goc);
      if (m[1]) ra += url ? '<img src="' + url + '" alt="' + esc(m[2]) + '" loading="lazy">' : esc(m[2]);
      else ra += url ? '<a href="' + url + '" target="_blank" rel="noopener">' + dinhDang(esc(m[2])) + '</a>' : dinhDang(esc(m[2]));
      cuoi = RE_ANH_LK.lastIndex;
    }
    return ra + dinhDang(esc(s.slice(cuoi)));
  }
  function oBang(dong) {
    return dong.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }
  var RE_TD = /^(#{1,3})\s+(.*)$/, RE_UL = /^[-*]\s+(.*)$/, RE_OL = /^\d+[.)]\s+(.*)$/, RE_KE = /^\|?\s*:?-{3,}/;

  function sangHtml(md, goc) {
    var dong = String(md || '').split(/\r?\n/), ra = [], doan = [], i = 0, m;
    function xongDoan() {
      if (doan.length) ra.push('<p>' + doan.map(function (d) { return noiDong(d, goc); }).join('<br>') + '</p>');
      doan = [];
    }
    while (i < dong.length) {
      var d = dong[i], t = d.trim();
      if (!t) { xongDoan(); i++; continue; }
      if ((m = RE_TD.exec(t))) { xongDoan(); var cap = m[1].length + 1; ra.push('<h' + cap + '>' + noiDong(m[2], goc) + '</h' + cap + '>'); i++; continue; }
      if (RE_UL.test(t) || RE_OL.test(t)) {
        xongDoan();
        var re = RE_UL.test(t) ? RE_UL : RE_OL, the = re === RE_UL ? 'ul' : 'ol', muc = [];
        while (i < dong.length && (m = re.exec(dong[i].trim()))) { muc.push('<li>' + noiDong(m[1], goc) + '</li>'); i++; }
        ra.push('<' + the + '>' + muc.join('') + '</' + the + '>');
        continue;
      }
      if (t.charAt(0) === '|' && i + 1 < dong.length && RE_KE.test(dong[i + 1].trim())) {
        xongDoan();
        var dau = oBang(t), than = [];
        i += 2;
        while (i < dong.length && dong[i].trim().charAt(0) === '|') { than.push(oBang(dong[i])); i++; }
        ra.push('<table><thead><tr>' + dau.map(function (c) { return '<th>' + noiDong(c, goc) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          than.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + noiDong(c, goc) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table>');
        continue;
      }
      doan.push(t);
      i++;
    }
    xongDoan();
    return ra.join('');
  }

  // Chữ thuần (để tìm kiếm): bỏ ký hiệu Markdown, gộp khoảng trắng.
  function thuan(md) {
    return String(md || '')
      .replace(RE_ANH, '$1').replace(RE_LK, '$1')
      .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ')
      .replace(/^\s*#{1,3}\s+/gm, '').replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, '')
      .replace(/\|/g, ' ').replace(/\*\*?/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  return { sangHtml: sangHtml, thuan: thuan };
})();
