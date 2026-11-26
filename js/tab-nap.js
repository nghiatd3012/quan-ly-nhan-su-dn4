// Thẻ Nạp số liệu (chỉ Quản trị): nạp file Excel, xem/xóa dữ liệu gốc, điều chỉnh KPI, sao lưu/khôi phục,
// và nút "Cập nhật báo cáo": tính Báo cáo tổng + KPI NV trong trình duyệt → lưu dữ liệu gốc lên Drive → công bố.
(function () {
  var el = UI.el;
  var NGUON_XLSX = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'vendor/xlsx.full.min.js'];
  var CHI_TIEU_DC = ['MobiWifi 5G', 'MobiFone qua NV', 'MobiFone qua KPP', 'THGT qua NV', 'MobiFiber'];

  // Trạng thái giữ trong bộ nhớ giữa các lần chuyển thẻ (mất khi tải lại trang nếu chưa Cập nhật báo cáo).
  var S = { cuaAi: null, tt: null, phienBan: '', thayDoi: false, dsMoi: false, thangCongBo: '', loiTai: '' };
  var log = [];          // [{loai, html}] — html do Store tạo (đã escape tên file)
  var ketQua = null;     // {loai, dong:[...], canhBao:[...]}

  App.dangKyThe({ id: 'nap', ten: 'Nạp số liệu', quyenToiThieu: 'QT', ve: ve });

  window.addEventListener('beforeunload', function (e) {
    if (S.thayDoi) { e.preventDefault(); e.returnValue = ''; }
  });

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtN(n) { return n == null ? '–' : Math.round(n).toLocaleString('vi-VN'); }
  function themLog(loai, html) { log.unshift({ loai: loai, html: html }); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  var vungThe = null;
  function ve(vung) {
    if (S.cuaAi !== App.nguoiDung.ma) { S = { cuaAi: App.nguoiDung.ma, tt: null, phienBan: '', thayDoi: false, dsMoi: false, thangCongBo: '', loiTai: '' }; log = []; ketQua = null; }
    vungThe = vung;
    if (S.tt) { veTatCa(); return; }
    vung.appendChild(el('div', { class: 'card' }, [el('p', { class: 'hint', text: 'Đang tải dữ liệu gốc từ Google Drive…' })]));
    taiTuDrive();
  }

  function taiTuDrive() {
    Promise.all([Api.goi('admin.taiTrangThai'), Api.goi('admin.cauHinh')]).then(function (kq) {
      var a = kq[0], c = kq[1];
      if (!a.ok || !c.ok) {
        if (a.loi === 'HET_PHIEN' || c.loi === 'HET_PHIEN') return null;
        throw new Error((!a.ok ? a : c).thongBao || 'Không tải được dữ liệu');
      }
      S.phienBan = a.phienBan || '';
      S.thangCongBo = c.cauHinh.ThangCongBo || '';
      return a.du_lieu ? Store.giaiNen(a.du_lieu) : Store.taoMoi();
    }).then(function (tt) {
      if (!tt) return;
      S.tt = tt; S.loiTai = '';
      if (App.conHieuLuc()) veTatCa();
    }).catch(function (e) {
      // Không cho cập nhật khi chưa đọc được dữ liệu cũ: tránh ghi đè dữ liệu trên Drive bằng dữ liệu rỗng.
      S.loiTai = e.message || String(e);
      if (!App.conHieuLuc()) return;
      UI.xoa(vungThe);
      vungThe.appendChild(el('div', { class: 'card' }, [el('p', { class: 'loi-the', text: 'Không đọc được dữ liệu gốc trên Drive: ' + S.loiTai }),
        el('button', { type: 'button', class: 'btn g', text: 'Thử lại', onclick: function () { UI.xoa(vungThe); ve(vungThe); } })]));
    });
  }

  function doi(ttMoi) { S.tt = ttMoi; S.thayDoi = true; }

  // ===== Vẽ =====
  function veTatCa() {
    UI.xoa(vungThe);
    vungThe.appendChild(theNap());
    vungThe.appendChild(theDuLieu());
    vungThe.appendChild(theDieuChinh());
    vungThe.appendChild(theCapNhat());
    vungThe.appendChild(theSaoLuu());
  }
  function veLai() { if (App.conHieuLuc() && vungThe) veTatCa(); }

  function theNap() {
    var input = el('input', { type: 'file', id: 'nap-file', multiple: true, accept: '.xls,.xlsx,.xlsm', class: 'an-file' });
    input.addEventListener('change', function () { var fs = Array.prototype.slice.call(input.files); input.value = ''; napFile(fs); });
    var vung = el('label', { for: 'nap-file', class: 'drop' }, ['📂 Chạm để chọn file Excel', el('br'),
      el('small', { text: 'Chọn được nhiều file. Trang tự nhận loại file theo nội dung (NEW_ACTIVE, Fiber, Giao dịch C2C, Danh sách NV, KPI Vùng, KPI NV, Điều chỉnh).' })]);
    ['dragenter', 'dragover'].forEach(function (t) { vung.addEventListener(t, function (e) { e.preventDefault(); vung.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { vung.addEventListener(t, function (e) { e.preventDefault(); vung.classList.remove('over'); }); });
    vung.addEventListener('drop', function (e) { napFile(Array.prototype.slice.call(e.dataTransfer.files)); });
    var ul = el('ul', { id: 'nap-log', class: 'log' });
    log.forEach(function (x) { var li = el('li', { class: 'l-' + x.loai }); li.innerHTML = x.html; ul.appendChild(li); });
    return el('div', { class: 'card' }, [el('h3', { text: '1. Nạp file Excel' }), input, vung, ul]);
  }

  function napFile(files) {
    files = files.filter(function (f) { return /\.(xlsx?|xlsm)$/i.test(f.name); });
    if (!files.length) { themLog('err', 'Không có file Excel (.xls, .xlsx) nào được chọn.'); veLai(); return; }
    files.sort(function (a, b) { return a.lastModified - b.lastModified; }); // file mới nhất xử lý sau cùng
    UI.dangTai(true);
    UI.napThuVien('XLSX', NGUON_XLSX).then(function () {
      return files.reduce(function (p, f) {
        return p.then(function () { return f.arrayBuffer(); }).then(function (buf) {
          var p = Core.parseFile(f.name, new Uint8Array(buf));
          var truoc = S.tt, r = Store.gop(S.tt, f, p);
          if (r.tt !== S.tt) { doi(r.tt); if (p.kind === 'ds') S.dsMoi = true; }
          themLog(r.thongBao.loai, r.thongBao.html);
          // Lưu bản gốc file lên Drive; máy tính kéo về OneDrive ở lần chạy báo cáo tới (26/11/2026)
          if (r.tt !== truoc) {   // file được nhận vào dữ liệu (không phải file cũ hơn / không nhận ra)
            return Api.goi('admin.luuTep', { ten: f.name, lastModified: f.lastModified, size: f.size, b64: Store.base64(new Uint8Array(buf)) }, true)
              .then(function (kq) { themLog(kq.ok ? 'ok' : 'warn', kq.ok ? 'Đã lưu bản gốc <b>' + esc(f.name) + '</b> lên Google Drive.'
                : '<b>' + esc(f.name) + '</b>: chưa lưu được bản gốc lên Drive (' + esc(kq.thongBao || kq.loi) + ').'); });
          }
        }).catch(function (e) { themLog('err', '<b>' + esc(f.name) + '</b>: không đọc được (' + esc(e.message || e) + ').'); });
      }, Promise.resolve());
    }).catch(function (e) { themLog('err', esc(e.message || e)); })
      .then(function () { UI.dangTai(false); veLai(); });
  }

  function theDuLieu() {
    var s = Store.chuyenStore(S.tt);
    var naMs = s.na.slice().sort(function (a, b) { return (a.nam - b.nam) || (a.thang - b.thang); });
    var kpinv = s.kpinv.slice().sort(function (a, b) { return (a.nam - b.nam) || (a.thang - b.thang); });
    function chip(on, t) { return el('span', { class: 'chip' + (on ? '' : ' off'), text: t }); }
    var chips = el('div', { id: 'nap-tinh-trang' }, [
      chip(naMs.length, naMs.length ? 'NEW_ACTIVE ' + naMs.length + ' tháng' : 'Chưa có NEW_ACTIVE'),
      chip(s.fiber.length, s.fiber.length ? 'Fiber ' + s.fiber.length + ' file' : 'Chưa có Fiber'),
      chip(s.c2c.length, s.c2c.length ? 'C2C ' + s.c2c.length + ' file' : 'Chưa có C2C'),
      chip(!!s.ds, s.ds ? 'Danh sách NV ' + s.ds.nv.length + ' mã' : 'Chưa có Danh sách NV'),
      chip(s.kpiv.length, s.kpiv.length ? 'KPI Vùng ' + s.kpiv.map(function (k) { return k.nam; }).join(', ') : 'Chưa có KPI Vùng'),
      chip(kpinv.length, kpinv.length ? 'KPI NV ' + kpinv.map(function (k) { return 'T' + p2(k.thang); }).join(', ') : 'Chưa có KPI NV'),
      s.dc ? chip(true, 'Điều chỉnh ' + s.dc.list.length + ' dòng') : null
    ]);
    var dong = [];
    naMs.forEach(function (e) { dong.push(['na:' + e.nam + '-' + p2(e.thang), 'NEW_ACTIVE', 'T' + p2(e.thang) + '/' + e.nam, fmtN(e.recs.length) + ' TB được tính', e]); });
    s.fiber.slice().sort(function (a, b) { return a.from - b.from; }).forEach(function (e) { dong.push(['fiber:' + e.from + '-' + e.to, 'Fiber', Core.fmtD(e.from) + ' – ' + Core.fmtD(e.to), fmtN(e.recs.length) + ' HĐ', e]); });
    s.c2c.slice().sort(function (a, b) { return a.from - b.from; }).forEach(function (e) { dong.push(['c2c:' + e.from + '-' + e.to, 'Giao dịch C2C', Core.fmtD(e.from) + ' – ' + Core.fmtD(e.to), fmtN(e.recs.length) + ' GD', e]); });
    if (s.ds) dong.push(['ds', 'Danh sách NV', '', s.ds.nv.length + ' mã', s.ds]);
    s.kpiv.forEach(function (e) { dong.push(['kpiv:' + e.nam, 'KPI Vùng', 'Năm ' + e.nam, '', e]); });
    kpinv.forEach(function (e) { dong.push(['kpinv:' + e.nam + '-' + p2(e.thang), 'KPI NV', 'T' + p2(e.thang) + '/' + e.nam, e.nv.length + ' NV', e]); });
    if (s.dc) dong.push(['dc', 'Điều chỉnh', '', s.dc.list.length + ' dòng', s.dc]);
    var tb = el('tbody');
    if (!dong.length) tb.appendChild(el('tr', null, [el('td', { class: 'trong', text: 'Chưa có dữ liệu. Nạp file ở mục 1.' })]));
    dong.forEach(function (r) {
      var nut = el('button', { type: 'button', class: 'lk-do', text: 'Xóa', onclick: function () {
        if (!window.confirm('Xóa dữ liệu ' + r[1] + ' ' + r[2] + ' (' + (r[4].name || '') + ')?')) return;
        doi(Store.xoa(S.tt, r[0])); veLai();
      } });
      tb.appendChild(el('tr', { dataset: { khoa: r[0] } }, [el('td', { text: r[1] }), el('td', { text: r[2] }), el('td', { text: r[3] }),
        el('td', { class: 'wrap', text: r[4].name || '' }), el('td', null, [nut])]));
    });
    var bang = el('table', { id: 'nap-bang-du-lieu', class: 'du-lieu' }, [
      el('thead', null, [el('tr', null, ['Loại', 'Kỳ', 'Nội dung', 'File', ''].map(function (t) { return el('th', { text: t }); }))]), tb]);
    return el('div', { class: 'card' }, [el('h3', { text: '2. Dữ liệu đang có' }), chips, el('div', { class: 'cuon' }, [bang]),
      el('p', { class: 'hint', text: S.thayDoi ? '⚠️ Có thay đổi chưa lưu: bấm "Cập nhật báo cáo" để lưu lên Google Drive và công bố.'
        : 'Dữ liệu gốc lưu trên Google Drive, nạp tiếp được từ máy khác.' })]);
  }

  // ===== Điều chỉnh KPI =====
  function tenTheoMa(ma) {
    var s = Store.chuyenStore(S.tt), u = Core.up(ma), i, n;
    for (i = 0; i < s.kpinv.length; i++) { n = s.kpinv[i].nv.filter(function (x) { return Core.up(x.ma) === u; })[0]; if (n) return n.ten; }
    if (s.ds) { n = s.ds.nv.filter(function (x) { return Core.up(x.ma) === u; })[0]; if (n) return n.ten; }
    return '';
  }
  function theDieuChinh() {
    var s = Store.chuyenStore(S.tt), list = s.dc ? s.dc.list : [];
    var tb = el('tbody');
    if (!list.length) tb.appendChild(el('tr', null, [el('td', { class: 'trong', colspan: '7', text: 'Chưa có điều chỉnh nào.' })]));
    list.forEach(function (x, i) {
      tb.appendChild(el('tr', { dataset: { i: String(i) } }, [el('td', { text: x.thang }), el('td', { text: x.chiTieu }),
        el('td', null, [x.tu, x.tenTu ? el('small', { class: 'nho-xam', text: x.tenTu }) : null]),
        el('td', null, [x.sang, x.tenSang ? el('small', { class: 'nho-xam', text: x.tenSang }) : null]),
        el('td', { text: String(x.sl) }), el('td', { class: 'wrap', text: x.ghiChu || '' }),
        el('td', null, [el('button', { type: 'button', class: 'lk-do', text: 'Xóa', onclick: function () {
          var l = list.slice(); l.splice(i, 1); doi(Store.datDieuChinh(S.tt, l)); veLai();
        } })])]));
    });
    var bang = el('table', { id: 'dc-bang', class: 'du-lieu' }, [el('thead', null, [el('tr', null,
      ['Tháng', 'Chỉ tiêu', 'Từ mã NV', 'Sang mã NV', 'SL', 'Ghi chú', ''].map(function (t) { return el('th', { text: t }); }))]), tb]);

    var ma = {};
    s.kpinv.forEach(function (k) { k.nv.forEach(function (n) { ma[n.ma] = n.ten; }); });
    var dl = el('datalist', { id: 'dc-ds-ma' }, Object.keys(ma).map(function (m) { return el('option', { value: m, text: ma[m] }); }));
    var mac = Store.cacThangCoDuLieu(S.tt).slice(-1)[0];
    function o(id, nhan, the) { return el('div', { class: 'f' }, [el('label', { for: id, text: nhan }), the]); }
    var thang = el('input', { id: 'dc-thang', placeholder: '11/2026', inputmode: 'numeric', value: mac ? p2(mac.thang) + '/' + mac.nam : '' });
    var ct = el('select', { id: 'dc-ct' }, CHI_TIEU_DC.map(function (t) { return el('option', { value: t, text: t }); }));
    var tu = el('input', { id: 'dc-tu', list: 'dc-ds-ma', autocapitalize: 'characters' });
    var sang = el('input', { id: 'dc-sang', list: 'dc-ds-ma', autocapitalize: 'characters' });
    var sl = el('input', { id: 'dc-sl', type: 'number', min: '1', value: '1', inputmode: 'numeric' });
    var gc = el('input', { id: 'dc-gc' });
    var loi = el('div', { class: 'loi', role: 'alert' });
    var them = el('button', { type: 'button', id: 'dc-them', class: 'btn', text: 'Thêm điều chỉnh' });
    them.addEventListener('click', function () {
      var m = thang.value.trim().match(/^(\d{1,2})\/(\d{4})$/);
      if (!m || +m[1] < 1 || +m[1] > 12) { loi.textContent = 'Tháng nhập dạng MM/yyyy, ví dụ 11/2026'; return; }
      if (!tu.value.trim() || !sang.value.trim()) { loi.textContent = 'Nhập Từ mã NV và Sang mã NV'; return; }
      if (Core.up(tu.value) === Core.up(sang.value)) { loi.textContent = 'Từ mã NV và Sang mã NV phải khác nhau'; return; }
      if (!(+sl.value >= 1)) { loi.textContent = 'Số lượng phải từ 1 trở lên'; return; }
      var x = { thang: p2(+m[1]) + '/' + m[2], chiTieu: ct.value, tu: tu.value.trim(), tenTu: tenTheoMa(tu.value), sang: sang.value.trim(),
        tenSang: tenTheoMa(sang.value), sl: Math.round(+sl.value), sotb: '', ghiChu: gc.value.trim() };
      doi(Store.datDieuChinh(S.tt, list.concat([x])));
      veLai();
    });
    var xlsx = el('button', { type: 'button', id: 'dc-xlsx', class: 'btn g', text: 'Tải file điều chỉnh (.xlsx)' });
    xlsx.addEventListener('click', function () {
      UI.napThuVien('XLSX', NGUON_XLSX).then(function () {
        var aoa = [['Tháng', 'Chỉ tiêu', 'Từ mã NV', 'Tên NV chuyển', 'Sang mã NV', 'Tên NV nhận', 'Số lượng', 'Số thuê bao (nếu có)', 'Ghi chú']]
          .concat(list.map(function (x) { return [x.thang, x.chiTieu, x.tu, x.tenTu, x.sang, x.tenSang, x.sl, x.sotb, x.ghiChu]; }));
        var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [10, 18, 16, 22, 16, 22, 9, 16, 40].map(function (w) { return { wch: w }; });
        XLSX.utils.book_append_sheet(wb, ws, 'Dieu chinh');
        UI.luuFile('Dieu chinh KPI NV.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      }).catch(function (e) { loi.textContent = e.message || String(e); });
    });
    return el('div', { class: 'card' }, [el('h3', { text: '3. Điều chỉnh KPI nhân viên' }),
      el('p', { class: 'hint', text: 'Chuyển số thuê bao giữa 2 nhân viên trong một tháng (tổng Vùng không đổi). Nạp file "Dieu chinh KPI NV.xlsx" sẽ thay toàn bộ danh sách.' }),
      el('div', { class: 'cuon' }, [bang]),
      el('div', { class: 'luoi-f' }, [o('dc-thang', 'Tháng (MM/yyyy)', thang), o('dc-ct', 'Chỉ tiêu', ct), o('dc-tu', 'Từ mã NV', tu),
        o('dc-sang', 'Sang mã NV', sang), o('dc-sl', 'Số lượng', sl), o('dc-gc', 'Ghi chú', gc)]), dl, loi,
      el('div', { class: 'nhom-nut' }, [them, xlsx])]);
  }

  // ===== Cập nhật báo cáo =====
  function theCapNhat() {
    // Luôn công bố đến tháng mới nhất có số liệu KPI (người dùng chốt 26/11/2026: bỏ ô chọn tháng)
    var nut = el('button', { type: 'button', id: 'nap-cap-nhat', class: 'btn khoi', text: '🔄 Cập nhật báo cáo' });
    var kq = el('div', { id: 'nap-ket-qua', role: 'status' });
    if (ketQua) veKetQua(kq);
    nut.addEventListener('click', function () { capNhat(nut); });
    return el('div', { class: 'card' }, [el('h3', { text: '4. Cập nhật báo cáo' }),
      el('p', { class: 'hint', text: 'Tính Báo cáo tổng và KPI NV cho mọi tháng có dữ liệu, lưu dữ liệu gốc lên Google Drive và công bố cho mọi người đến tháng mới nhất.' }),
      nut, kq]);
  }

  function veKetQua(kq) {
    UI.xoa(kq);
    kq.className = 'ket-qua kq-' + ketQua.loai;
    ketQua.dong.forEach(function (d) { kq.appendChild(el('p', { text: d })); });
    if (ketQua.canhBao.length) kq.appendChild(el('ul', null, ketQua.canhBao.map(function (w) { return el('li', { text: w }); })));
    if (ketQua.taiLai) {
      kq.appendChild(el('button', { type: 'button', id: 'nap-tai-lai', class: 'btn g', text: 'Tải lại dữ liệu từ Drive (bỏ thay đổi trên máy này)', onclick: function () {
        S.tt = null; S.thayDoi = false; S.dsMoi = false; ketQua = null; log = [];
        UI.xoa(vungThe); ve(vungThe);
      } }));
    }
    kq.dataset.xong = '1';
  }

  function capNhat(nut) {
    var thangCongBo = '';
    var kqEl = UI.$('nap-ket-qua');
    delete kqEl.dataset.xong;
    UI.xoa(kqEl).className = '';
    kqEl.appendChild(el('p', { class: 'hint', text: 'Đang tính báo cáo…' }));
    nut.disabled = true;
    var store = Store.chuyenStore(S.tt), kpi = [], tong = [], canhBao = [];
    function xong(loai, dong, them) {
      nut.disabled = false;
      ketQua = Object.assign({ loai: loai, dong: dong, canhBao: canhBao }, them || {});
      if (App.conHieuLuc() && document.body.contains(kqEl)) veKetQua(kqEl);
    }
    // Nhường trình duyệt vẽ chữ "Đang tính" trước khi tính (có thể vài giây với dữ liệu thật).
    setTimeout(function () {
      Store.cacThangCoDuLieu(S.tt).forEach(function (x) {
        var khoa = x.nam + '-' + p2(x.thang), nhan = p2(x.thang) + '/' + x.nam;
        try {
          var T = Core.buildDashboard(store, x.nam, x.thang);
          tong.push({ thang: khoa, D: T.D, warn: T.warn, summary: T.summary });
          T.warn.forEach(function (w) { canhBao.push('Báo cáo tổng T' + nhan + ': ' + w); });
        } catch (e) { canhBao.push('Báo cáo tổng T' + nhan + ': ' + (e.message || e)); }
        // KPI NV của năm này; tháng chưa có file KPI NV xử lý như trên máy (Store.kpiNvChoThang)
        var kn = Store.kpiNvChoThang(store, x.nam, x.thang);
        if (!kn) { canhBao.push('Tháng ' + nhan + ' chưa có file KPI NV'); return; }
        try {
          var R = Core.buildKpiNv(Object.assign({}, store, { kpinv: kn }), x.nam, x.thang);
          kpi.push({ thang: khoa, R: R });
          R.warn.forEach(function (w) { canhBao.push('KPI NV T' + nhan + ': ' + w); });
        } catch (e) { canhBao.push('KPI NV T' + nhan + ': ' + (e.message || e)); }
      });
      var dsK = kpi.map(function (k) { return k.thang; }).sort();
      thangCongBo = dsK[dsK.length - 1] || S.thangCongBo || '';
      var dsMoi = S.dsMoi && store.ds;
      kqEl.lastChild.textContent = 'Đang lưu dữ liệu gốc lên Google Drive…';
      Store.nen(S.tt).then(function (du_lieu) {
        return Api.goi('admin.luuTrangThai', { du_lieu: du_lieu, phienBanCu: S.phienBan });
      }).then(function (r) {
        if (!r.ok) {
          if (r.loi === 'HET_PHIEN') return null;
          xong('loi', [r.thongBao || 'Không lưu được dữ liệu gốc'], { taiLai: r.loi === 'XUNG_DOT' });
          return null;
        }
        S.phienBan = r.phienBan;
        S.thayDoi = false;
        if (kqEl.lastChild) kqEl.lastChild.textContent = 'Đang công bố báo cáo…';
        return Api.goi('admin.congBo', { kpi: kpi, tong: tong, thangCongBo: thangCongBo }).then(function (c) {
          if (!c.ok) { if (c.loi !== 'HET_PHIEN') xong('loi', ['Đã lưu dữ liệu gốc nhưng chưa công bố được: ' + (c.thongBao || '')]); return null; }
          if (thangCongBo) S.thangCongBo = thangCongBo;
          // số liệu trên GitHub (du-lieu/) chỉ được cập nhật khi máy tính chạy báo cáo: trình duyệt này đọc Apps Script cho đến lúc đó
          try { localStorage.setItem('qlns-cong-bo-web', new Date().toISOString()); } catch (e) { }
          var dong = ['✅ Đã cập nhật báo cáo: ' + kpi.length + ' tháng KPI NV, ' + tong.length + ' tháng Báo cáo tổng' +
            (thangCongBo ? '; nhân viên xem đến T' + thangCongBo.slice(5) + '/' + thangCongBo.slice(0, 4) : '') + '.'];
          if (!dsMoi) return dong;
          return Api.goi('admin.dongBoNv', { ds: store.ds.nv }).then(function (d) {
            if (!d.ok) { dong.push('⚠️ Chưa đồng bộ được Danh sách NV: ' + (d.thongBao || '')); return dong; }
            S.dsMoi = false;
            dong.push('Danh sách NV: Tạo mới ' + d.tao.length + ' tài khoản' + (d.tao.length ? ' (' + d.tao.join(', ') + ')' : '') +
              ', ' + d.nghi.length + ' người chuyển nghỉ, ' + d.capNhat.length + ' thay đổi chức vụ/nơi làm việc/ngày vào.');
            d.capNhat.forEach(function (x) { canhBao.push('Hồ sơ ' + x.ma + ': ' + x.truong + ' "' + x.cu + '" → "' + x.moi + '"'); });
            return dong;
          });
        });
      }).then(function (dong) {
        if (dong) xong('ok', dong);
      }).catch(function (e) { xong('loi', ['Lỗi: ' + (e.message || e)]); });
    }, 30);
  }

  // ===== Sao lưu / khôi phục =====
  function theSaoLuu() {
    var tai = el('button', { type: 'button', id: 'nap-tai-sao-luu', class: 'btn g', text: '⬇ Tải bản sao lưu (.json)' });
    tai.addEventListener('click', function () {
      var ngay = new Date().toISOString().slice(0, 10);
      UI.luuFile('SaoLuu_BaoCao_PTM_' + ngay + '.json', new Blob([JSON.stringify(Store.thanhSaoLuu(S.tt))], { type: 'application/json' }));
    });
    var input = el('input', { type: 'file', id: 'nap-khoi-phuc', accept: '.json,application/json', class: 'an-file' });
    input.addEventListener('change', function () {
      var f = input.files[0]; input.value = '';
      if (!f) return;
      f.text().then(function (t) {
        var moi = Store.tuSaoLuu(JSON.parse(t));
        var n = Object.keys(moi.data).length;
        // như công cụ cũ: mục trong bản sao lưu ghi đè mục cùng khóa, mục khác giữ nguyên
        doi({ data: Object.assign({}, S.tt.data, moi.data) });
        if (moi.data.ds) S.dsMoi = true;
        themLog('ok', 'Đã khôi phục ' + n + ' mục từ <b>' + esc(f.name) + '</b>. Bấm "Cập nhật báo cáo" để lưu lên Drive.');
      }).catch(function (e) { themLog('err', 'Không khôi phục được: ' + esc(e.message || e) + '.'); })
        .then(veLai);
    });
    return el('div', { class: 'card' }, [el('h3', { text: '5. Sao lưu / khôi phục' }),
      el('p', { class: 'hint', text: 'Dùng được bản sao lưu (.json) của công cụ Báo cáo PTM cũ để chuyển dữ liệu sang trang này.' }),
      el('div', { class: 'nhom-nut' }, [tai, input, el('label', { for: 'nap-khoi-phuc', class: 'btn g', text: '⬆ Khôi phục từ file sao lưu (.json)' })])]);
  }
})();
