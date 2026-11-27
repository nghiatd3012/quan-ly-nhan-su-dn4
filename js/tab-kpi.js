// Thẻ KPI: Báo cáo tổng (QL/QT), KPI tất cả nhân viên (NV: tháng công bố; QL/QT: chọn tháng + lọc), KPI cá nhân nhiều tháng.
// Mọi giới hạn theo quyền do Apps Script quyết; trang chỉ hiển thị những gì máy chủ trả về.
(function () {
  var el = UI.el;
  // Mọi chỉ tiêu có thể có (đúng thứ tự BaoCao_KPI_NV.ps1); mỗi báo cáo chỉ hiện các cột trong R.cols.
  var COT = [
    { k: 'C2C', ngan: 'C2C', ten: 'Điểm bán C2C có giao dịch' },
    { k: 'MBF', ngan: 'MBF NV', ten: 'MobiFone qua NV' },
    { k: 'KPP', ngan: 'KPP', ten: 'MobiFone qua KPP' },
    { k: 'THGT', ngan: 'THGT', ten: 'THGT qua NV' },
    { k: 'DT', ngan: 'DT', ten: 'Doanh thu phân phối (tr.đ)' },
    { k: 'WIFI', ngan: 'Wifi', ten: 'MobiWifi 5G' },
    { k: 'FIBER', ngan: 'Fiber', ten: 'Mobi Fiber' }
  ];
  // Cột theo các mã chỉ tiêu có trong báo cáo (R.cols; báo cáo cũ: suy từ ô của các dòng)
  function cotTheo(ks) { return COT.filter(function (c) { return ks.indexOf(c.k) >= 0; }); }
  function maCot(R) {
    if (R.cols) return R.cols.map(function (c) { return c.k; });
    var ks = [];
    (R.groups || []).forEach(function (g) { (g.rows || []).forEach(function (r) { (r.cells || []).forEach(function (c) { if (ks.indexOf(c.k) < 0) ks.push(c.k); }); }); });
    return ks;
  }
  function so(v) { return v == null ? '–' : String(Math.round(v * 10) / 10).replace('.', ','); }
  var TRU = '−'; // dấu trừ
  var nho = { cuaAi: null, thang: null, cv: '', nlv: '', xemMa: null };

  App.dangKyThe({ id: 'kpi', ten: 'KPI', quyenToiThieu: 'NV', ve: ve });

  // ===== Số liệu công bố sẵn trên GitHub Pages (du-lieu/*.json, người dùng đồng ý công khai 26/11/2026) =====
  // Tải file tĩnh ~0,2 giây thay vì gọi Apps Script ~3,5 giây; lỗi / chưa có file thì quay về Apps Script như cũ.
  var DL = 'du-lieu/', mlHua = null, tep = {};
  function mucLuc() {
    if (!mlHua) mlHua = fetch(DL + 'muc-luc.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { mlHua = null; throw e; });
    return mlHua;
  }
  function docTep(ten, v) {
    var k = ten + '?v=' + encodeURIComponent(v || '');
    if (!tep[k]) tep[k] = fetch(DL + k).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { delete tep[k]; throw e; });
    return tep[k];
  }
  function tinhTinh(action, p, ml) {
    var ql = laQL(), cb = ml.thangCongBo || '';
    var dsK = (ml.kpi || []).slice().sort(), dsXem = ql ? dsK : dsK.filter(function (t) { return cb && t <= cb; });
    if (action === 'tong.get') {
      var dsT = (ml.tong || []).slice().sort();
      if (!dsT.length) return Promise.resolve({ ok: true, D: null, warn: [], summary: null, dsThang: [] });
      var tt = dsT.indexOf(p.thang) >= 0 ? p.thang : dsT[dsT.length - 1];
      return docTep('tong-' + tt + '.json', ml.capNhat).then(function (t) {
        return { ok: true, thang: tt, D: t.D, warn: t.warn || [], summary: t.summary || null, dsThang: dsT };
      });
    }
    if (action === 'kpi.thang') {
      if (!dsXem.length) return Promise.resolve({ ok: true, R: null, dsThang: [] });
      var th = ql ? (dsXem.indexOf(p.thang) >= 0 ? p.thang : dsXem[dsXem.length - 1]) : (dsXem.indexOf(cb) >= 0 ? cb : dsXem[dsXem.length - 1]);
      return docTep('kpi-' + th + '.json', ml.capNhat).then(function (R) {
        if (!ql) { R = Object.assign({}, R); delete R.warn; }
        return { ok: true, thang: th, R: R, dsThang: ql ? dsXem : [th] };
      });
    }
    // kpi.lichSu: 12 tháng gần nhất có dòng của mã đang xem
    var ma = String(p.ma || App.nguoiDung.ma).toUpperCase(), ds = dsXem.slice(-12);
    return Promise.all(ds.map(function (t) { return docTep('kpi-' + t + '.json', ml.capNhat); })).then(function (dsR) {
      var ls = [];
      dsR.forEach(function (R, i) {
        var row = null;
        (R.groups || []).forEach(function (g) { (g.rows || []).forEach(function (r) { if (String(r.ma).toUpperCase() === ma) row = r; }); });
        if (row) ls.push({ thang: ds[i], nam: R.nam, row: row, tienDo: R.tienDo, chiTH: !!R.chiTH });
      });
      return { ok: true, ma: ma, lichSu: ls };
    });
  }
  function layDuLieu(action, p, cb) {
    UI.dangTai(true);
    var web = null;
    try { web = localStorage.getItem('qlns-cong-bo-web'); } catch (e) { }
    mucLuc().then(function (ml) {
      if (web && !(ml.capNhat > web)) throw new Error('GitHub cũ hơn lần công bố trên web');
      return tinhTinh(action, p, ml);
    }).then(function (kq) { UI.dangTai(false); cb(kq); },
      function () { UI.dangTai(false); Api.goiNho(action, p, cb); });
  }

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function pt(p) { return p == null || isNaN(p) ? '–' : Math.round(p) + '%'; }
  function mau(p, tienDo) { return p == null ? '' : UI.mauPhanTram(p / 100, tienDo); }
  function laQL() { var q = App.nguoiDung.quyen; return q === 'QL' || q === 'QT'; }
  function nhanThang(t) { return 'T' + t.slice(5) + '/' + t.slice(0, 4); }
  function loiThe(vung, kq, macDinh) {
    if (kq.loi === 'HET_PHIEN') return;
    vung.appendChild(el('p', { class: 'loi-the', text: kq.thongBao || macDinh }));
  }

  // Bố cục giống web báo cáo cũ: các tab con Báo cáo tổng | KPI nhân viên (ảnh ngang/dọc) | KPI của tôi.
  function ve(vung) {
    if (nho.cuaAi !== App.nguoiDung.ma) nho = { cuaAi: App.nguoiDung.ma, thang: null, cv: '', nlv: '', xemMa: null, tab: null };
    mlHua = null;   // mỗi lần mở thẻ KPI đọc lại mục lục (biết có số liệu mới chưa)
    var bang = el('div', { class: 'card', id: 'kpi-bang' }, [el('h3', { text: 'KPI nhân viên' })]);
    var toi = el('div', { class: 'card', id: 'kpi-toi' }, [el('h3', { text: 'KPI của tôi' })]);
    var tong = laQL() ? el('div', { class: 'card', id: 'kpi-tong' }, [el('h3', { text: 'Báo cáo tổng Vùng 4' })]) : null;
    var xuat = laQL() ? el('div', { class: 'card', id: 'kpi-xuat' }, [el('h3', { text: 'Xuất báo cáo thực hiện' })]) : null;
    var ds = laQL() ? [['tong', 'Báo cáo tổng', tong], ['nv', 'KPI nhân viên', bang], ['toi', 'KPI của tôi', toi], ['xuat', 'Xuất Excel', xuat]]
      : [['nv', 'KPI nhân viên', bang], ['toi', 'KPI của tôi', toi]];   // NV vào thẳng KPI nhân viên chung (26/11/2026)
    if (!ds.some(function (x) { return x[0] === nho.tab; })) nho.tab = ds[0][0];
    var thanh = el('nav', { class: 'tab-con', role: 'tablist', 'aria-label': 'Báo cáo KPI' });
    function mo(id) {
      nho.tab = id;
      ds.forEach(function (x) {
        x[2].hidden = x[0] !== id;
        var b = thanh.querySelector('[data-con="' + x[0] + '"]');
        b.classList.toggle('on', x[0] === id); b.setAttribute('aria-selected', x[0] === id ? 'true' : 'false');
      });
    }
    ds.forEach(function (x) {
      thanh.appendChild(el('button', { type: 'button', role: 'tab', class: 'tab', id: 'kpi-con-' + x[0], dataset: { con: x[0] }, text: x[1], onclick: function () { mo(x[0]); } }));
    });
    vung.appendChild(thanh);
    ds.forEach(function (x) { vung.appendChild(x[2]); });
    mo(nho.tab);
    if (tong) taiTong(tong);
    taiBang(bang, toi);
    taiCaNhan(toi);
    if (xuat) taiXuat(xuat);
  }

  // ===== Xuất Excel báo cáo thực hiện nhiều tháng (QL/QT; người dùng chốt 27/11/2026) =====
  // Một sheet: mỗi NV 1 dòng; mỗi chỉ tiêu có cột TH từng tháng đã chọn + Cộng; cuối là % BQ từng tháng.
  function mlHoacNull() {
    var web = null;
    try { web = localStorage.getItem('qlns-cong-bo-web'); } catch (e) { }
    return mucLuc().then(function (ml) { return web && !(ml.capNhat > web) ? null : ml; }, function () { return null; });
  }
  function layThang(t, ml) {
    function quaApi() { return Api.goi('kpi.thang', { thang: t }, true).then(function (kq) { if (!kq.ok || !kq.R || kq.thang !== t) throw new Error(kq.thongBao || 'Không tải được KPI ' + nhanThang(t)); return kq.R; }); }
    if (!ml || (ml.kpi || []).indexOf(t) < 0) return quaApi();
    return docTep('kpi-' + t + '.json', ml.capNhat).catch(quaApi);
  }
  function tenCv(g) { return g === 'FIBER' ? 'Fiber' : g; }

  function taiXuat(the) {
    var ml = null;
    UI.dangTai(true);
    mlHoacNull().then(function (m) {
      ml = m;
      if (ml) return { dsThang: (ml.kpi || []).slice().sort() };
      return Api.goi('kpi.thang', {}, true).then(function (kq) { if (!kq.ok) throw new Error(kq.thongBao || 'Không tải được danh sách tháng'); return { dsThang: kq.dsThang || [] }; });
    }).then(function (x) {
      var dsThang = x.dsThang;
      if (!dsThang.length) throw new Error('Chưa có số liệu KPI.');
      return layThang(dsThang[dsThang.length - 1], ml).then(function (R) { UI.dangTai(false); veXuat(the, dsThang, R, ml); });
    }).catch(function (e) { UI.dangTai(false); if (App.conHieuLuc()) the.appendChild(el('p', { class: 'loi-the', text: e.message || String(e) })); });
  }

  function oDanhDau(ten, giaTri, nhan, chon) {
    var o = el('input', { type: 'checkbox', name: ten, value: giaTri });
    o.checked = !!chon;
    return el('label', { class: 'o-chon' }, [o, nhan]);
  }
  function giaTriChon(hop) { return Array.prototype.filter.call(hop.querySelectorAll('input'), function (o) { return o.checked; }).map(function (o) { return o.value; }); }
  function nhomChon(tieuDe, ten, ds, chonMacDinh) {
    var hop = el('div', { class: 'ds-chon' }, ds.map(function (x) { return oDanhDau(ten, x[0], x[1], chonMacDinh(x[0])); }));
    function dat(b) { Array.prototype.forEach.call(hop.querySelectorAll('input'), function (o) { o.checked = b; }); }
    return { hop: hop, khoi: el('fieldset', { class: 'xuat-nhom' }, [
      el('legend', null, [tieuDe + ' ',
        el('button', { type: 'button', class: 'lk', text: 'Tất cả', onclick: function () { dat(true); } }), ' · ',
        el('button', { type: 'button', class: 'lk', text: 'Bỏ chọn', onclick: function () { dat(false); } })]),
      hop]) };
  }

  function veXuat(the, dsThang, Rmoi, ml) {
    var cvs = [], nlvs = [];
    (Rmoi.groups || []).forEach(function (g) { (g.rows || []).forEach(function (r) {
      if (cvs.indexOf(r.g) < 0) cvs.push(r.g); if (r.donvi && nlvs.indexOf(r.donvi) < 0) nlvs.push(r.donvi); }); });
    nlvs.sort(function (a, b) { return a.localeCompare(b, 'vi'); });
    var ba = dsThang.slice(-3);
    var nThang = nhomChon('Tháng', 'xt-thang', dsThang.map(function (t) { return [t, nhanThang(t)]; }), function (t) { return ba.indexOf(t) >= 0; });
    var nCv = nhomChon('Chức vụ', 'xt-cv', cvs.map(function (g) { return [g, tenCv(g)]; }), function () { return true; });
    var nNlv = nhomChon('Nơi làm việc', 'xt-nlv', nlvs.map(function (d) { return [d, d]; }), function () { return true; });
    var nut = el('button', { type: 'button', id: 'kpi-xuat-tai', class: 'btn', text: '⬇ Tải file Excel' });
    var tb = el('p', { class: 'hint', id: 'kpi-xuat-tb' });
    nut.addEventListener('click', function () {
      var thang = giaTriChon(nThang.hop).sort(), cv = giaTriChon(nCv.hop), nlv = giaTriChon(nNlv.hop);
      if (!thang.length || !cv.length || !nlv.length) { window.alert('Hãy chọn ít nhất 1 tháng, 1 chức vụ và 1 nơi làm việc.'); return; }
      nut.disabled = true; tb.textContent = 'Đang tải số liệu ' + thang.length + ' tháng…';
      UI.dangTai(true);
      Promise.all(thang.map(function (t) { return layThang(t, ml); })).then(function (dsR) {
        var sheet = bangXuat(thang, dsR, cv, nlv, cv.length === cvs.length && nlv.length === nlvs.length);
        if (!sheet) throw new Error('Không có nhân viên nào khớp bộ lọc.');
        tb.textContent = 'Đã tạo file: ' + sheet.soNv + ' nhân viên × ' + thang.length + ' tháng.';
        return UI.xuatExcel('KPI_ThucHien_DN4_' + thang[0].replace('-', '') + (thang.length > 1 ? '-' + thang[thang.length - 1].replace('-', '') : '') + '.xlsx', [sheet]);
      }).catch(function (e) { tb.textContent = ''; window.alert(e.message || String(e)); })
        .then(function () { UI.dangTai(false); nut.disabled = false; });
    });
    the.appendChild(el('p', { class: 'hint', text: 'Chọn tháng, chức vụ, nơi làm việc rồi bấm tải. File có mỗi nhân viên 1 dòng; mỗi chỉ tiêu gồm số thực hiện từng tháng và cột Cộng; cuối là % BQ từng tháng.' }));
    [nThang.khoi, nCv.khoi, nNlv.khoi].forEach(function (k) { the.appendChild(k); });
    the.appendChild(el('div', { class: 'nhom-nut' }, [nut]));
    the.appendChild(tb);
  }

  // Trả {ten, dong, doRong, gop, soNv} cho UI.xuatExcel, hoặc null nếu không có NV nào.
  function bangXuat(thang, dsR, cv, nlv, tatCa) {
    var ks = [];
    dsR.forEach(function (R) { maCot(R).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); }); });
    var cot = cotTheo(ks);
    var nv = {}, thuTu = [], thuTuNhom = [];
    dsR.forEach(function (R, i) {
      (R.groups || []).forEach(function (g) {
        if (thuTuNhom.indexOf(g.g) < 0) thuTuNhom.push(g.g);
        (g.rows || []).forEach(function (r) {
          var ma = String(r.ma).toUpperCase();
          if (!nv[ma]) { nv[ma] = { ma: r.ma, thang: {} }; thuTu.push(ma); }
          nv[ma].ten = r.ten; nv[ma].donvi = r.donvi; nv[ma].g = r.g;   // tháng sau cùng ghi đè: thông tin mới nhất
          nv[ma].thang[i] = r;
        });
      });
    });
    var ds = thuTu.map(function (m) { return nv[m]; }).filter(function (n) { return cv.indexOf(n.g) >= 0 && nlv.indexOf(n.donvi) >= 0; });
    if (!ds.length) return null;
    // Thứ tự nhóm mới nhất trước (NVBH, GDV, AM, Fiber như bảng KPI)
    var nhomMoi = []; (dsR[dsR.length - 1].groups || []).forEach(function (g) { nhomMoi.push(g.g); });
    thuTuNhom.forEach(function (g) { if (nhomMoi.indexOf(g) < 0) nhomMoi.push(g); });
    ds.sort(function (a, b) { return nhomMoi.indexOf(a.g) - nhomMoi.indexOf(b.g); });

    var nT = thang.length, coCong = nT > 1, nhan = thang.map(nhanThang);
    var dau = ['STT', 'Mã NV', 'Họ tên', 'Chức vụ', 'Nơi làm việc'], n0 = dau.length;
    var h1 = dau.slice(), h2 = dau.map(function () { return ''; }), gop = [];
    dau.forEach(function (x, c) { gop.push({ s: { r: 3, c: c }, e: { r: 4, c: c } }); });
    cot.forEach(function (c) {
      var bd = h1.length;
      nhan.forEach(function (t, j) { h1.push(j ? '' : c.ten); h2.push(t); });
      if (coCong) { h1.push(''); h2.push('Cộng'); }
      if (h1.length - bd > 1) gop.push({ s: { r: 3, c: bd }, e: { r: 3, c: h1.length - 1 } });
    });
    var bdBq = h1.length;
    nhan.forEach(function (t, j) { h1.push(j ? '' : '% BQ'); h2.push(t); });
    if (nT > 1) gop.push({ s: { r: 3, c: bdBq }, e: { r: 3, c: h1.length - 1 } });

    function o(r, k) { var x = r ? (r.cells || []).filter(function (c) { return c.k === k; })[0] : null; return x && x.th != null ? x.th : null; }
    function lam(v) { return v == null ? '' : Math.round(v * 100) / 100; }
    var tong = h1.map(function () { return null; });
    var dong = ds.map(function (n, i) {
      var d = [i + 1, n.ma, n.ten, tenCv(n.g), n.donvi || ''];
      cot.forEach(function (c) {
        var cong = null;
        thang.forEach(function (t, j) { var v = o(n.thang[j], c.k); if (v != null) cong = (cong || 0) + v; d.push(lam(v)); });
        if (coCong) d.push(lam(cong));
      });
      thang.forEach(function (t, j) { var r = n.thang[j]; d.push(r && r.bq != null ? Math.round(r.bq) / 100 : ''); });
      d.forEach(function (v, c) { if (c >= n0 && c < bdBq && v !== '') tong[c] = (tong[c] || 0) + v; });
      return d;
    });
    var dongTong = tong.map(function (v, c) { return c === 2 ? 'Tổng cộng' : c >= n0 && c < bdBq && v != null ? lam(v) : ''; });
    var moTa = 'Chức vụ: ' + (tatCa ? 'tất cả' : cv.map(tenCv).join(', ')) + ' · Nơi làm việc: ' + (tatCa ? 'tất cả' : nlv.join(', '));
    var tieuDe = 'BÁO CÁO THỰC HIỆN KPI NHÂN VIÊN VÙNG 4 – ' + nhan[0] + (nT > 1 ? ' đến ' + nhan[nT - 1] : '');
    var ghiChu = dsR.map(function (R, j) { return R.ngay && R.soNgay && R.ngay < R.soNgay ? nhan[j] + ' số liệu đến ngày ' + p2(R.ngay) + '/' + p2(R.thang) : null; }).filter(Boolean);
    var aoa = [[tieuDe], [moTa + ' · Số thực hiện (TH); % BQ = điểm KPI hoàn thành' + (ghiChu.length ? ' · ' + ghiChu.join('; ') : '') + ' · Xuất lúc ' + UI.ngayGio(new Date().toISOString())], [], h1, h2]
      .concat(dong, [dongTong]);
    var rong = h1.map(function (x, c) { return c === 0 ? 5 : c === 1 ? 12 : c === 2 ? 24 : c === 3 ? 8 : c === 4 ? 14 : 9; });
    function xuLy(ws, X) {   // % BQ hiện dạng phần trăm; cố định 5 cột đầu + 2 dòng tiêu đề bảng
      for (var r = 5; r < aoa.length; r++) for (var c = bdBq; c < h1.length; c++) {
        var a = X.utils.encode_cell({ r: r, c: c }); if (ws[a] && ws[a].t === 'n') ws[a].z = '0%';
      }
      ws['!views'] = [{ state: 'frozen', xSplit: n0, ySplit: 5 }];
    }
    return { ten: 'Thực hiện', dong: aoa, doRong: rong, gop: gop, xuLy: xuLy, soNv: ds.length };
  }

  // ===== KPI tất cả nhân viên =====
  function taiBang(the, toi) {
    layDuLieu('kpi.thang', nho.thang ? { thang: nho.thang } : {}, function (kq) {
      if (!App.conHieuLuc()) return;
      UI.xoa(the);
      if (!kq.ok) { the.appendChild(el('h3', { text: 'KPI tất cả nhân viên' })); loiThe(the, kq, 'Không tải được KPI'); return; }
      if (!kq.R) {
        the.appendChild(el('h3', { text: 'KPI tất cả nhân viên' }));
        the.appendChild(el('p', { class: 'hint', text: 'Chưa có số liệu KPI được công bố.' }));
        return;
      }
      nho.thang = kq.thang;
      veBang(the, kq.R, kq.dsThang || [], toi);
    });
  }

  function veBang(the, R, dsThang, toi) {
    var ql = laQL();
    the.appendChild(el('h3', { text: 'KPI nhân viên – T' + p2(R.thang) + '/' + R.nam }));
    var nhom = R.groups || [];
    var tatCa = [];
    nhom.forEach(function (g) { (g.rows || []).forEach(function (r) { tatCa.push(r); }); });
    if (ql && toi) datOChonNv(toi, tatCa);

    // Bộ lọc trên cùng: chức vụ, nơi làm việc (mọi người); chọn tháng chỉ QL/QT — bảng và ảnh tải về đều theo bộ lọc
    {
      var chonThang = ql ? el('select', { id: 'kpi-thang', 'aria-label': 'Tháng' }, dsThang.map(function (t) { return el('option', { value: t, text: nhanThang(t) }); })) : null;
      if (chonThang) chonThang.value = nho.thang;
      if (chonThang) chonThang.addEventListener('change', function () { nho.thang = chonThang.value; taiBang(the, null); });
      var cvs = [], nlvs = [];
      tatCa.forEach(function (r) { if (cvs.indexOf(r.g) < 0) cvs.push(r.g); if (r.donvi && nlvs.indexOf(r.donvi) < 0) nlvs.push(r.donvi); });
      nlvs.sort(function (a, b) { return a.localeCompare(b, 'vi'); });
      var nhanCv = {};
      nhom.forEach(function (g) { nhanCv[g.g] = g.label || g.g; });
      if (cvs.indexOf(nho.cv) < 0) nho.cv = '';
      if (nlvs.indexOf(nho.nlv) < 0) nho.nlv = '';
      var chonCv = el('select', { id: 'kpi-loc-cv', 'aria-label': 'Chức vụ' }, [el('option', { value: '', text: 'Mọi chức vụ' })]
        .concat(cvs.map(function (g) { return el('option', { value: g, title: nhanCv[g], text: g === 'FIBER' ? 'Fiber' : g }); })));
      var chonNlv = el('select', { id: 'kpi-loc-nlv', 'aria-label': 'Nơi làm việc' }, [el('option', { value: '', text: 'Mọi nơi làm việc' })]
        .concat(nlvs.map(function (d) { return el('option', { value: d, text: d }); })));
      chonCv.value = nho.cv; chonNlv.value = nho.nlv;
      chonCv.addEventListener('change', function () { nho.cv = chonCv.value; veLai(); });
      chonNlv.addEventListener('change', function () { nho.nlv = chonNlv.value; veLai(); });
      the.appendChild(el('div', { class: 'loc' }, [chonThang, chonCv, chonNlv].filter(Boolean)));
    }

    the.appendChild(el('p', { class: 'hint', text: 'Số liệu đến ' + p2(R.ngay) + '/' + p2(R.thang) + '/' + R.nam +
      ' · tiến độ thời gian ' + Math.round(R.tienDo * 100) + '%' +
      (R.chiTH ? ' · tháng chưa có file KPI NV: chỉ hiện số thực hiện' : R.khTheo ? ' · kế hoạch lấy theo KPI NV T' + p2(R.khTheo) : '') }));

    // Ảnh PNG chỉ dựng khi bấm tải (ngang: gửi group · dọc: xem điện thoại), theo bộ lọc đang chọn
    var seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Khổ ảnh' });
    [['ngang', 'Ảnh ngang'], ['doc', 'Ảnh dọc']].forEach(function (x) {
      seg.appendChild(el('button', { type: 'button', dataset: { ly: x[0] }, 'aria-pressed': khoAnh() === x[0] ? 'true' : 'false', text: x[1],
        onclick: function () {
          try { localStorage.setItem('qlns-kpi-kho', x[0]); } catch (e) { }
          Array.prototype.forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', b.dataset.ly === x[0] ? 'true' : 'false'); });
        } }));
    });
    var nutTai = el('button', { type: 'button', id: 'kpi-tai-anh-nv', class: 'btn g', text: '⬇ Tải ảnh PNG' });
    nutTai.addEventListener('click', function () {
      var kho = khoAnh(), Rl = locR(R);
      if (!Rl.groups.length) { window.alert('Không có nhân viên nào khớp bộ lọc.'); return; }
      dangVe(nutTai, true, 'Đang tạo ảnh…');
      veAnhKpi(Rl, kho).then(function (blob) {
        dangVe(nutTai, false);
        luuFile('KPI_NV_Vung4_T' + p2(R.thang) + '-' + R.nam + (kho === 'doc' ? '_doc' : '') + '.png', blob);
      }).catch(function (e) { baoLoi(nutTai, e); });
    });
    the.appendChild(el('div', { class: 'nhom-nut' }, [seg, nutTai]));

    var cuon = el('div', { class: 'cuon' });
    function veLai() {
      UI.xoa(cuon);
      var hien = locR(R).groups.map(function (g) { return { g: g, rows: g.rows }; });
      cuon.appendChild(bangNv(R, hien, ql ? (nho.cv || nho.nlv ? 'Tổng nhóm đang lọc' : 'Tổng cộng') : null));
    }
    veLai();
    the.appendChild(cuon);
    the.appendChild(el('p', { class: 'hint', text: 'Ô: % hoàn thành và thực hiện/kế hoạch · % BQ = Điểm KPI HT, trọng số theo "Tỷ lệ" (NVBH: mỗi chỉ tiêu tối đa 120%, Wifi + Fiber chấm gộp, cộng chỉ tiêu Vùng giao 10% tính đạt) · "chưa có": chỉ tiêu nhập tay chưa có số, chưa tính · nhãn tím là số TB điều chỉnh.' }));
    if (R.notes && R.notes.length) {
      the.appendChild(el('ul', { class: 'ghi-chu' }, R.notes.map(function (n) { return el('li', { text: 'Điều chỉnh: ' + n }); })));
    }
    if (ql && R.warn && R.warn.length) {
      the.appendChild(el('div', { id: 'kpi-canh-bao', class: 'canh-bao' }, [el('b', { text: '⚠️ Cảnh báo' }),
        el('ul', null, R.warn.map(function (w) { return el('li', { text: w }); }))]));
    }
  }
  // Bản R chỉ gồm NV khớp bộ lọc (chức vụ, nơi làm việc); có lọc thì tính lại các ô tổng theo cùng công thức core.js
  function locR(R) {
    if (!nho.cv && !nho.nlv) return R;
    var groups = (R.groups || []).map(function (g) {
      return Object.assign({}, g, { rows: g.rows.filter(function (r) { return (!nho.cv || r.g === nho.cv) && (!nho.nlv || r.donvi === nho.nlv); }) });
    }).filter(function (g) { return g.rows.length; });
    var rows = [];
    groups.forEach(function (g) { g.rows.forEach(function (r) { rows.push(r); }); });
    var nhap = {};
    (R.cols || []).forEach(function (c) { nhap[c.k] = !!c.nhap; });
    var totals = (R.totals || []).map(function (t) {
      var cs = rows.map(function (r) { return (r.cells || []).filter(function (x) { return x.k === t.k; })[0] || {}; });
      var kh = cs.reduce(function (a, x) { return a + (x.kh || 0); }, 0);
      var coTh = cs.some(function (x) { return x.kh > 0 && x.th != null; });
      var v = cs.reduce(function (a, x) { return a + (x.th || 0); }, 0);
      return { k: t.k, name: t.name, kh: kh, th: nhap[t.k] && !coTh && !R.chiTH ? null : v, p: kh > 0 && (!nhap[t.k] || coTh) ? v / kh * 100 : null };
    });
    return Object.assign({}, R, { groups: groups, totals: totals });
  }
  function khoAnh() {
    var s = null;
    try { s = localStorage.getItem('qlns-kpi-kho'); } catch (e) { }
    return s === 'doc' || s === 'ngang' ? s : (window.innerWidth < 700 ? 'doc' : 'ngang');
  }

  function oPhanTram(c, tienDo, chiTH) {
    var td = el('td', { dataset: { k: c.k, th: String(c.th || 0), kh: String(c.kh || 0) } });
    if (chiTH) { td.appendChild(el('div', { class: c.th ? '' : 'trong', text: so(c.th || 0) })); }   // tháng cũ: chỉ số thực hiện
    else if (c.kh == null) { td.appendChild(el('span', { class: 'trong', text: '–' })); }
    else if (c.th == null) {
      td.title = 'Chưa có số thực hiện (chưa tính vào % BQ)';
      td.appendChild(el('div', { class: 'trong', text: 'chưa có' }));
      td.appendChild(el('small', { class: 'so', text: '–/' + so(c.kh) }));
    } else {
      var p = c.kh ? c.th / c.kh * 100 : null;
      td.className = mau(p, tienDo);
      td.appendChild(el('div', { text: pt(p) }));
      td.appendChild(el('small', { class: 'so', text: so(c.th) + '/' + so(c.kh) }));
    }
    if (c.adj) td.appendChild(el('span', { class: 'adj', text: (c.adj > 0 ? '+' : TRU) + Math.abs(c.adj) }));
    return td;
  }

  function bangNv(R, hien, nhanTong) {
    var COT = cotTheo(maCot(R));
    var tb = el('tbody');
    var tong = {}, bqs = [];
    COT.forEach(function (c) { tong[c.k] = { k: c.k, th: 0, kh: 0, coKh: false, coTh: false }; });
    hien.forEach(function (x) {
      tb.appendChild(el('tr', { class: 'grp' }, [el('td', { colspan: String(COT.length + 2), text: (x.g.label || x.g.g) + ' (' + x.rows.length + ')' })]));
      x.rows.forEach(function (r) {
        var tr = el('tr', { dataset: { ma: r.ma } }, [el('td', { class: 'ten' }, [el('b', { text: r.ten || r.ma }), el('small', { text: r.ma + (r.donvi ? ' · ' + r.donvi : '') })])]);
        COT.forEach(function (c) {
          var o = (r.cells || []).filter(function (x) { return x.k === c.k; })[0] || { k: c.k, kh: null, th: 0 };
          tr.appendChild(oPhanTram(o, R.tienDo, R.chiTH));
          tong[c.k].th += o.th || 0;
          if (o.th != null && o.kh) tong[c.k].coTh = true;
          if (o.kh != null) { tong[c.k].kh += o.kh; tong[c.k].coKh = true; }
        });
        tr.appendChild(el('td', { class: mau(r.bq, R.tienDo) + ' bq', dataset: { k: 'BQ' }, text: pt(r.bq) }));
        if (r.bq != null) bqs.push(r.bq);
        tb.appendChild(tr);
      });
    });
    if (!hien.length) tb.appendChild(el('tr', null, [el('td', { colspan: String(COT.length + 2), class: 'trong', text: 'Không có nhân viên nào khớp bộ lọc.' })]));
    else if (nhanTong) {
      var tr = el('tr', { class: 'tot' }, [el('td', { class: 'ten', text: nhanTong })]);
      COT.forEach(function (c) { var t = tong[c.k]; tr.appendChild(oPhanTram({ k: c.k, th: t.coTh || !t.kh ? t.th : null, kh: t.coKh ? t.kh : null }, R.tienDo, R.chiTH)); });
      var bqTb = bqs.length ? bqs.reduce(function (a, b) { return a + b; }, 0) / bqs.length : null;
      tr.appendChild(el('td', { class: mau(bqTb, R.tienDo) + ' bq', dataset: { k: 'BQ' }, title: 'Bình quân % BQ các nhân viên đang hiện', text: pt(bqTb) }));
      tb.appendChild(tr);
    }
    var thead = el('thead', null, [el('tr', null, [el('th', { text: 'Nhân viên' })]
      .concat(COT.map(function (c) { return el('th', { title: c.ten, text: c.ngan }); }), [el('th', { text: '% BQ' })]))]);
    return el('table', { class: 'kpi' }, [thead, tb]);
  }

  // ===== KPI cá nhân nhiều tháng =====
  function datOChonNv(toi, rows) {
    if (toi.querySelector('#kpi-toi-chon')) return;
    var toiMa = App.nguoiDung.ma.toUpperCase();
    var sel = el('select', { id: 'kpi-toi-chon', 'aria-label': 'Xem KPI của' }, [el('option', { value: '', text: 'Của tôi' })]
      .concat(rows.filter(function (r) { return String(r.ma).toUpperCase() !== toiMa; })
        .map(function (r) { return el('option', { value: r.ma, text: (r.ten || r.ma) + ' – ' + r.ma }); })));
    sel.value = nho.xemMa || '';
    sel.addEventListener('change', function () { nho.xemMa = sel.value || null; taiCaNhan(toi); });
    toi.insertBefore(sel, toi.children[1] || null);
  }

  function taiCaNhan(toi) {
    var ma = nho.xemMa;
    layDuLieu('kpi.lichSu', ma ? { ma: ma } : {}, function (kq) {
      if (!App.conHieuLuc() || ma !== nho.xemMa) return;
      var cu = toi.querySelector('.ca-nhan');
      if (cu) cu.remove();
      var vung = el('div', { class: 'ca-nhan' });
      toi.appendChild(vung);
      var h3 = toi.querySelector('h3');
      h3.textContent = ma ? 'KPI cá nhân' : 'KPI của tôi';
      if (!kq.ok) { loiThe(vung, kq, 'Không tải được KPI cá nhân'); return; }
      var ls = kq.lichSu || [];
      if (!ls.length) { vung.appendChild(el('p', { class: 'hint', text: 'Chưa có số liệu KPI.' })); return; }
      if (ma) h3.textContent = 'KPI cá nhân – ' + (ls[ls.length - 1].row.ten || ma);
      var thead = el('thead', null, [el('tr', null, [el('th', { text: 'Chỉ tiêu' })]
        .concat(ls.map(function (x) { return el('th', { title: 'Tháng ' + x.thang.slice(5) + '/' + x.thang.slice(0, 4), text: 'T' + x.thang.slice(5) }); })))]);
      var tb = el('tbody');
      var ks = [];
      ls.forEach(function (x) { (x.row.cells || []).forEach(function (c) { if (ks.indexOf(c.k) < 0) ks.push(c.k); }); });
      cotTheo(ks).forEach(function (c) {
        var tr = el('tr', null, [el('td', { text: c.ten })]);
        ls.forEach(function (x) {
          var o = (x.row.cells || []).filter(function (y) { return y.k === c.k; })[0] || { k: c.k, kh: null, th: 0 };
          var td = oPhanTram(o, x.tienDo, x.chiTH);
          td.addEventListener('click', function () { td.classList.toggle('mo'); });
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      tb.appendChild(el('tr', { class: 'tot' }, [el('td', { text: '% BQ' })]
        .concat(ls.map(function (x) { return el('td', { class: mau(x.row.bq, x.tienDo), text: pt(x.row.bq) }); }))));
      vung.appendChild(el('div', { class: 'cuon' }, [el('table', { class: 'kpi ca-nhan-bang' }, [thead, tb])]));
      vung.appendChild(el('p', { class: 'hint', text: 'Chạm vào ô để xem Thực hiện/Kế hoạch.' }));
    });
  }

  // ===== Báo cáo tổng =====
  var mauDash = null;
  function layMauDash() {
    if (!mauDash) mauDash = fetch('dashboard.html').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .catch(function (e) { mauDash = null; throw e; });
    return mauDash;
  }
  function dashHtml(mau, D, nhung) {
    var html = mau.replace('/*__DATA__*/null', JSON.stringify(D).replace(/</g, '\\u003c'));
    if (nhung) html = html.replace('</body>', '<script>(function(){function s(){parent.postMessage({qlnsDashH:document.documentElement.scrollHeight},"*")}' +
      'new ResizeObserver(s).observe(document.body);addEventListener("load",s);s()})();<' + '/script></body>');
    return html;
  }
  window.addEventListener('message', function (e) {
    var f = document.getElementById('kpi-dash');
    if (f && e.source === f.contentWindow && e.data && e.data.qlnsDashH) f.style.height = (e.data.qlnsDashH + 4) + 'px';
  });

  function taiTong(the) {
    layDuLieu('tong.get', {}, function (kq) {
      if (!App.conHieuLuc()) return;
      UI.xoa(the);
      the.appendChild(el('h3', { text: 'Báo cáo tổng Vùng 4' }));
      if (!kq.ok) { loiThe(the, kq, 'Không tải được Báo cáo tổng'); return; }
      if (!kq.D) { the.appendChild(el('p', { class: 'hint', text: 'Chưa có Báo cáo tổng.' })); return; }
      if (kq.warn && kq.warn.length) {
        the.appendChild(el('div', { id: 'kpi-tong-canh-bao', class: 'canh-bao' }, [el('b', { text: '⚠️ Cảnh báo' }),
          el('ul', null, kq.warn.map(function (w) { return el('li', { text: w }); }))]));
      }
      if (kq.summary) the.appendChild(oTomTat(kq.summary, kq.thang));
      var khung = el('iframe', { id: 'kpi-dash', class: 'dash', title: 'Báo cáo tổng Vùng 4' });
      // phần trên luôn là tháng mới nhất; xem tháng khác bằng ô chọn tháng trong dashboard bên dưới
      the.appendChild(el('div', { id: 'kpi-tong-chi-tiet' }, [khung]));
      layMauDash().then(function (mau) { khung.srcdoc = dashHtml(mau, kq.D, true); })
        .catch(function () { khung.replaceWith(el('p', { class: 'loi-the', text: 'Không tải được mẫu Báo cáo tổng (dashboard.html).' })); });
    });
  }

  function oTomTat(s, thang) {
    function o(nhan, th, kh) {
      var p = kh ? th / kh * 100 : null;
      return el('div', { class: 'k' }, [el('span', { text: nhan }),
        el('div', null, [el('b', { text: String(th) }), el('small', { text: ' / ' + (kh == null ? 'không giao' : kh) }),
          el('em', { class: p == null ? '' : (p >= 100 ? 'ok' : ''), text: p == null ? '' : ' ' + pt(p) })]),
        el('div', { class: 'bar' }, [el('i', { style: 'width:' + Math.min(100, p || 0) + '%' })])]);
    }
    var khPtm = s.kMBF == null && s.kSME == null ? null : (s.kMBF || 0) + (s.kSME || 0);
    var ds = [o('TB PTM (MBF + Saymee)', s.MBF + s.SME, khPtm), o('MobiFone', s.MBF, s.kMBF), o('Saymee (THGT)', s.SME, s.kSME), o('Fiber', s.FIBER, s.kFIBER)];
    if (s.WIFI != null) {   // bản Báo cáo tổng công bố từ 26/11/2026 trở đi mới có MobiWifi 5G
      var w = o('MobiWifi 5G (trong MobiFone)', s.WIFI, s.kWIFI);
      if (s.FWD != null) w.querySelector('div').insertBefore(el('small', { title: 'Mọi TB FWD, kể cả chưa có gói', text: ' (' + s.FWD + ' FWD)' }), w.querySelector('div small'));
      ds.push(w);
    }
    return el('div', { class: 'kpis', id: 'kpi-tong-so', 'aria-label': 'Tóm tắt ' + nhanThang(thang) }, ds);
  }

  // ===== Tải ảnh =====
  var NGUON_H2C = ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'vendor/html2canvas.min.js'];
  var h2cUrl = null;
  function napHtml2canvas() { return UI.napThuVien('html2canvas', NGUON_H2C).then(function (url) { h2cUrl = url || h2cUrl || NGUON_H2C[1]; }); }
  var luuFile = UI.luuFile;
  function thanhBlob(canvas) { return new Promise(function (ok) { canvas.toBlob(ok, 'image/png'); }); }
  function dangVe(nut, bat, chu) {
    nut.disabled = bat;
    if (bat) { nut.dataset.chu = nut.textContent; nut.textContent = chu; } else if (nut.dataset.chu) nut.textContent = nut.dataset.chu;
  }
  function baoLoi(nut, e) { dangVe(nut, false); window.alert('Không tạo được ảnh: ' + (e && e.message || e)); }

  // Dựng ảnh KPI NV (kho = 'ngang' 1760px | 'doc' 760px) trong vùng ẩn rồi chụp bằng html2canvas → Promise<Blob PNG>
  function veAnhKpi(R, kho) {
    var doc = kho === 'doc';
    var san = el('div', { style: 'position:fixed;left:-20000px;top:0' });
    return napHtml2canvas().then(function () {
      var st = document.createElement('style');
      st.textContent = doc ? KpiImage.CSS_DOC : KpiImage.CSS;
      san.appendChild(st);
      var vo = document.createElement('div');
      vo.innerHTML = doc ? KpiImage.fragmentDoc(R) : KpiImage.fragment(R); // chuỗi đã escape trong kpi_image.js
      san.appendChild(vo);
      document.body.appendChild(san);
      return document.fonts && document.fonts.ready;
    }).then(function () {
      var e = san.querySelector('.kimg');
      return window.html2canvas(e, { scale: doc ? 2 : 1, backgroundColor: '#eef2f7', logging: false, width: e.offsetWidth, height: e.offsetHeight, windowWidth: doc ? 800 : 1800 });
    }).then(thanhBlob).then(function (blob) { san.remove(); return blob; }, function (e) { san.remove(); throw e; });
  }
})();
