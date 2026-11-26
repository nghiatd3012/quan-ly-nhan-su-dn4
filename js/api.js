// Gọi Web App Apps Script: POST text/plain (tránh preflight CORS), tự gắn token, giữ phiên trong localStorage.
window.Api = (function () {
  var KHOA = 'qlns.phien';

  function docPhien() {
    try { var s = localStorage.getItem(KHOA); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function ghiPhien(p) {
    try { if (p) localStorage.setItem(KHOA, JSON.stringify(p)); else localStorage.removeItem(KHOA); } catch (e) { }
  }
  var phien = docPhien(); // {token, user}

  // Nhớ kết quả đọc (KPI, Báo cáo tổng) trên máy người xem: hiện ngay bản đã nhớ, rồi tải bản mới từ máy chủ
  // (Apps Script mất ~3–4 giây mỗi lần gọi) và chỉ gọi lại onData khi số liệu đổi. Đăng xuất / đổi người thì xóa.
  var NHO = 'qlns.nho:';
  function xoaNho() {
    try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf(NHO) === 0) localStorage.removeItem(k); } } catch (e) { }
  }
  function goiNho(action, du_lieu, onData) {
    var ma = phien && phien.user ? phien.user.ma : '';
    var khoa = NHO + ma + ':' + action + ':' + JSON.stringify(du_lieu || {});
    var cu = null;
    try { cu = localStorage.getItem(khoa); } catch (e) { }
    if (cu) { try { onData(JSON.parse(cu), true); } catch (e) { cu = null; } }
    return goi(action, du_lieu, !!cu).then(function (kq) {
      if (kq && kq.ok) {
        var moi = JSON.stringify(kq);
        if (moi === cu) return kq;            // không đổi: giữ nguyên phần đang hiện
        try { localStorage.setItem(khoa, moi); } catch (e) { xoaNho(); }
      } else if (cu && kq && kq.loi === 'MANG') return kq;   // mất mạng: giữ bản đã nhớ
      onData(kq, false);
      return kq;
    });
  }

  function goi(action, du_lieu, imLang) {
    var req = Object.assign({}, du_lieu || {}, { action: action });
    if (phien && phien.token) req.token = phien.token;
    if (!imLang) UI.dangTai(true);
    return fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function () {
        return { ok: false, loi: 'MANG', thongBao: 'Không kết nối được máy chủ, vui lòng thử lại' };
      })
      .then(function (kq) {
        if (!imLang) UI.dangTai(false);
        if (!kq || typeof kq !== 'object') kq = { ok: false, loi: 'LOI', thongBao: 'Máy chủ trả về dữ liệu không hợp lệ' };
        if (!kq.ok && kq.loi === 'HET_PHIEN' && action !== 'login' && action !== 'logout') {
          datPhien(null);
          if (window.App) App.veDangNhap('Phiên đăng nhập đã hết, vui lòng đăng nhập lại');
        } else if (!kq.ok && kq.loi === 'PHAI_DOI_MK' && window.App) {
          App.veDoiMatKhau(true);
        }
        return kq;
      });
  }

  function datPhien(p) {
    if (!p || !phien || !phien.user || !p.user || phien.user.ma !== p.user.ma) xoaNho();
    phien = p; ghiPhien(p);
  }
  function layPhien() { return phien; }

  return { goi: goi, goiNho: goiNho, datPhien: datPhien, layPhien: layPhien };
})();
