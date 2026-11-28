// Thẻ Chính sách & Hướng dẫn (27/11/2026): danh sách theo mục, tìm bài không dấu, màn đọc bài.
// Bài và mục lục đọc từ file tĩnh huong-dan/ trên GitHub Pages (Apps Script ghi khi QL/QT lưu bài);
// lỗi hoặc chưa có thì hỏi Apps Script (bai.ds, bai.get). Soạn bài: huongdan-soan.js (HuongDanSoan).
window.HuongDan = (function () {
  var el = UI.el, H = HDChung;
  var KHOA_ML = 'qlns.hd.moi', KHOA_ND = 'qlns.hd.nd:';
  var S = { mucLuc: null, q: '', vung: null };

  App.dangKyThe({ id: 'huongdan', ten: 'Chính sách & Hướng dẫn', quyenToiThieu: 'NV', ve: ve });

  function laQL() { var q = App.nguoiDung && App.nguoiDung.quyen; return q === 'QL' || q === 'QT'; }
  function docPhien(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function ghiPhien(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function ngay(iso) { return UI.ngayGio(iso).slice(0, 10); }

  // Mục lục: GitHub → (lỗi) Apps Script; rồi lấy bản mới hơn giữa bản tải được và bản người này vừa lưu.
  function taiMucLuc() {
    var vuaLuu = docPhien(KHOA_ML);
    return fetch('huong-dan/muc-luc.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function () {
        return Api.goi('bai.ds', null, true).then(function (kq) {
          if (!kq.ok) throw new Error(kq.thongBao || 'Không tải được danh sách bài');
          return kq.mucLuc;
        });
      })
      .then(function (ml) { return H.chonMoiHon(ml, vuaLuu); }, function (e) { if (vuaLuu) return vuaLuu; throw e; });
  }
  function docNoiDung(b) {
    var daLuu = docPhien(KHOA_ND + b.id + ':' + b.phienBan);
    if (daLuu != null) return Promise.resolve(daLuu);
    return fetch('huong-dan/bai/' + encodeURIComponent(b.id) + '.md?v=' + b.phienBan)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .catch(function () {
        return Api.goi('bai.get', { id: b.id }).then(function (kq) {
          if (!kq.ok) throw new Error(kq.thongBao || 'Không tải được bài');
          return kq.bai.noiDung;
        });
      });
  }

  function ve(vung) {
    S.vung = vung;
    vung.appendChild(el('div', { class: 'card' }, [el('p', { class: 'hint', text: 'Đang tải danh sách bài…' })]));
    taiMucLuc().then(function (ml) {
      if (!App.conHieuLuc()) return;
      S.mucLuc = ml;
      veDs();
    }).catch(function (e) {
      if (!App.conHieuLuc()) return;
      UI.xoa(vung).appendChild(el('div', { class: 'card' }, [el('p', { class: 'loi-the', text: e.message })]));
    });
  }

  function tenMuc(id) {
    var m = (S.mucLuc.muc || []).filter(function (x) { return x.id === id; })[0];
    return m ? m.ten : '';
  }

  function veDs() {
    var vung = UI.xoa(S.vung), ql = laQL();
    var dau = el('h3', null, [el('span', { text: 'Chính sách & Hướng dẫn' })]);
    if (ql && window.HuongDanSoan) {
      dau.appendChild(el('span', { class: 'hd-lenh' }, [
        el('button', { type: 'button', class: 'btn nho', id: 'hd-moi', text: '+ Bài mới', onclick: function () { soan(null); } }),
        el('button', { type: 'button', class: 'btn g nho', id: 'hd-sap-muc', text: 'Sắp xếp mục', onclick: sapMuc })
      ]));
    }
    var tim = el('input', { id: 'hd-tim', type: 'search', placeholder: '🔍 Tìm bài…', value: S.q, autocomplete: 'off' });
    var ds = el('div', { class: 'hd-ds' });
    thongBao(vung);
    tim.addEventListener('input', function () { S.q = tim.value; veKetQua(ds); });
    vung.appendChild(el('div', { class: 'card' }, [dau, tim, ds]));
    veKetQua(ds);
  }

  function veKetQua(ds) {
    UI.xoa(ds);
    var now = Date.now();
    if (S.q.trim()) {
      var kq = H.timBai(S.mucLuc, S.q);
      if (!kq.length) { ds.appendChild(el('p', { class: 'hint', text: 'Không tìm thấy bài phù hợp.' })); return; }
      kq.forEach(function (b) { ds.appendChild(dongBai(b, now, tenMuc(b.muc))); });
      return;
    }
    var nhom = H.mucHien(S.mucLuc, laQL());
    if (!nhom.length) { ds.appendChild(el('p', { class: 'hint', text: 'Chưa có bài nào.' })); return; }
    nhom.forEach(function (x, i) {
      var d = el('details', { class: 'hd-muc', dataset: { id: x.muc.id }, open: i === 0 || null },
        [el('summary', null, [x.muc.ten + ' ', el('small', { text: '(' + x.bai.length + ')' })])]);
      if (!x.bai.length) d.appendChild(el('p', { class: 'hint', text: 'Chưa có bài — mục này đang ẩn với nhân viên.' }));
      x.bai.forEach(function (b) { d.appendChild(dongBai(b, now)); });
      ds.appendChild(d);
    });
  }

  function dongBai(b, now, muc) {
    var nhan = H.laMoi(b, now);
    var phu = (b.tenNguoiDang || b.nguoiDang) + ' · ' + ngay(b.lucSua || b.lucDang) + (muc ? ' · ' + muc : '');
    return el('button', { type: 'button', class: 'hd-bai', dataset: { id: b.id }, onclick: function () { moBai(b); } }, [
      el('span', { class: 'hd-td' }, [b.tieuDe, nhan ? el('span', { class: 'chip', text: nhan }) : null]),
      el('small', { text: phu })
    ]);
  }

  function moBai(b) {
    var vung = UI.xoa(S.vung), ql = laQL();
    var nd = el('div', { class: 'md' }, [el('p', { class: 'hint', text: 'Đang tải bài…' })]);
    var meta = 'Đăng: ' + (b.tenNguoiDang || b.nguoiDang) + ' · ' + UI.ngayGio(b.lucDang) +
      (b.lucSua ? ' — Sửa: ' + (b.tenNguoiSua || b.nguoiSua) + ' · ' + UI.ngayGio(b.lucSua) : '');
    var lenh = el('div', { class: 'hd-lenh' }, [el('button', { type: 'button', class: 'btn g nho', id: 'hd-quay-lai', text: '← Quay lại', onclick: veDs })]);
    var the = el('div', { class: 'card hd-doc' }, [lenh, el('h2', { class: 'hd-tieu-de', text: b.tieuDe }), el('p', { class: 'hint', text: meta }), nd]);
    if ((b.tep || []).length) {
      the.appendChild(el('div', { class: 'hd-tep' }, [el('b', { text: 'Tệp đính kèm' })].concat(b.tep.map(function (t) {
        return el('a', { href: t.duongDan, target: '_blank', rel: 'noopener', download: t.ten, text: '📎 ' + t.ten + ' (' + kb(t.kichThuoc) + ')' });
      }))));
    }
    thongBao(vung);
    vung.appendChild(the);
    window.scrollTo(0, 0);
    docNoiDung(b).then(function (md) {
      if (!App.conHieuLuc()) return;
      nd.innerHTML = Markdown.sangHtml(md, '');   // an toàn: sangHtml đã thoát mọi ký tự
      if (ql && window.HuongDanSoan) {
        lenh.appendChild(el('button', { type: 'button', class: 'btn nho', id: 'hd-sua', text: 'Sửa',
          onclick: function () { soan(Object.assign({}, b, { noiDung: md })); } }));
      }
    }).catch(function (e) { UI.xoa(nd).appendChild(el('p', { class: 'loi-the', text: e.message })); });
  }
  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  function soan(bai) {
    HuongDanSoan.moBai(UI.xoa(S.vung), bai, S.mucLuc, function (ml, baiMoi, tb) {
      if (ml) daLuu(ml, baiMoi, tb); else if (bai) moBai(bai); else veDs();
    });
  }
  function sapMuc() {
    HuongDanSoan.moMuc(UI.xoa(S.vung), S.mucLuc, function (ml, x, tb) { if (ml) daLuu(ml, null, tb); else veDs(); });
  }
  // Thông báo một lần (vd. "Đã đăng bài…") ở đầu màn kế tiếp.
  function thongBao(vung) {
    if (!S.tb) return;
    vung.appendChild(el('div', { class: 'card hd-tb', role: 'status', text: '✅ ' + S.tb }));
    S.tb = '';
  }

  // Sau khi lưu/xóa: nhớ mục lục (và nội dung bài vừa lưu) trong phiên để thấy ngay, không chờ GitHub Pages 1–2 phút.
  function daLuu(ml, baiMoi, tb) {
    ghiPhien(KHOA_ML, ml);
    if (baiMoi && baiMoi.id) ghiPhien(KHOA_ND + baiMoi.id + ':' + baiMoi.phienBan, baiMoi.noiDung);
    S.mucLuc = ml;
    S.tb = tb || '';
    var b = baiMoi && (ml.bai || []).filter(function (x) { return x.id === baiMoi.id; })[0];
    if (b) moBai(b); else veDs();
  }

  return { taiLai: function () { if (S.vung) { UI.xoa(S.vung); ve(S.vung); } }, daLuu: daLuu };
})();
