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

  function goi(action, du_lieu) {
    var req = Object.assign({}, du_lieu || {}, { action: action });
    if (phien && phien.token) req.token = phien.token;
    UI.dangTai(true);
    return fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function () {
        return { ok: false, loi: 'MANG', thongBao: 'Không kết nối được máy chủ, vui lòng thử lại' };
      })
      .then(function (kq) {
        UI.dangTai(false);
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

  function datPhien(p) { phien = p; ghiPhien(p); }
  function layPhien() { return phien; }

  return { goi: goi, datPhien: datPhien, layPhien: layPhien };
})();
