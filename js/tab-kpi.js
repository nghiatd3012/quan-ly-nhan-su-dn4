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

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function pt(p) { return p == null || isNaN(p) ? '–' : Math.round(p) + '%'; }
  function mau(p, tienDo) { return p == null ? '' : UI.mauPhanTram(p / 100, tienDo); }
  function laQL() { var q = App.nguoiDung.quyen; return q === 'QL' || q === 'QT'; }
  function nhanThang(t) { return 'T' + t.slice(5) + '/' + t.slice(0, 4); }
  function loiThe(vung, kq, macDinh) {
    if (kq.loi === 'HET_PHIEN') return;
    vung.appendChild(el('p', { class: 'loi-the', text: kq.thongBao || macDinh }));
  }

  function ve(vung) {
    if (nho.cuaAi !== App.nguoiDung.ma) nho = { cuaAi: App.nguoiDung.ma, thang: null, cv: '', nlv: '', xemMa: null };
    var bang = el('div', { class: 'card', id: 'kpi-bang' }, [el('h3', { text: 'KPI tất cả nhân viên' })]);
    var toi = el('div', { class: 'card', id: 'kpi-toi' }, [el('h3', { text: 'KPI của tôi' })]);
    if (laQL()) {
      var tong = el('div', { class: 'card', id: 'kpi-tong' }, [el('h3', { text: 'Báo cáo tổng Vùng 4' })]);
      vung.appendChild(tong); vung.appendChild(bang); vung.appendChild(toi);
      taiTong(tong, null);
    } else {
      vung.appendChild(toi); vung.appendChild(bang);
    }
    taiBang(bang, toi);
    taiCaNhan(toi);
  }

  // ===== KPI tất cả nhân viên =====
  function taiBang(the, toi) {
    Api.goi('kpi.thang', nho.thang ? { thang: nho.thang } : {}).then(function (kq) {
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
    the.appendChild(el('h3', { text: 'KPI tất cả nhân viên – T' + p2(R.thang) + '/' + R.nam }));
    the.appendChild(el('p', { class: 'hint', text: 'Số liệu đến ' + p2(R.ngay) + '/' + p2(R.thang) + '/' + R.nam +
      ' · tiến độ thời gian ' + Math.round(R.tienDo * 100) + '%' }));

    var nhom = R.groups || [];
    var tatCa = [];
    nhom.forEach(function (g) { (g.rows || []).forEach(function (r) { tatCa.push(r); }); });
    if (ql && toi) datOChonNv(toi, tatCa);

    var cuon = el('div', { class: 'cuon' });
    function veLai() {
      UI.xoa(cuon);
      var hien = nhom.map(function (g) {
        return { g: g, rows: g.rows.filter(function (r) { return (!nho.cv || r.g === nho.cv) && (!nho.nlv || r.donvi === nho.nlv); }) };
      }).filter(function (x) { return x.rows.length; });
      cuon.appendChild(bangNv(R, hien, ql ? (nho.cv || nho.nlv ? 'Tổng nhóm đang lọc' : 'Tổng cộng') : null));
    }

    if (ql) {
      var chonThang = el('select', { id: 'kpi-thang', 'aria-label': 'Tháng' }, dsThang.map(function (t) { return el('option', { value: t, text: nhanThang(t) }); }));
      chonThang.value = nho.thang;
      chonThang.addEventListener('change', function () { nho.thang = chonThang.value; taiBang(the, null); });
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
      the.appendChild(el('div', { class: 'loc' }, [chonThang, chonCv, chonNlv]));
    }
    veLai();
    the.appendChild(cuon);
    the.appendChild(el('p', { class: 'hint', text: 'Ô: % hoàn thành và thực hiện/kế hoạch · % BQ = Điểm KPI HT, trọng số theo "Tỷ lệ" (NVBH: mỗi chỉ tiêu tối đa 120%, Wifi + Fiber chấm gộp, cộng chỉ tiêu Vùng giao 10% tính đạt) · "chưa có": chỉ tiêu nhập tay chưa có số, chưa tính · nhãn tím là số TB điều chỉnh.' }));
    if (R.notes && R.notes.length) {
      the.appendChild(el('ul', { class: 'ghi-chu' }, R.notes.map(function (n) { return el('li', { text: 'Điều chỉnh: ' + n }); })));
    }
    if (ql) {
      var nut = el('button', { type: 'button', id: 'kpi-tai-anh-nv', class: 'btn g', text: '⬇ Tải ảnh KPI NV' });
      nut.addEventListener('click', function () { taiAnhKpi(nut, R); });
      the.appendChild(el('div', { class: 'nhom-nut' }, [nut]));
      if (R.warn && R.warn.length) {
        the.appendChild(el('div', { id: 'kpi-canh-bao', class: 'canh-bao' }, [el('b', { text: '⚠️ Cảnh báo' }),
          el('ul', null, R.warn.map(function (w) { return el('li', { text: w }); }))]));
      }
    }
  }

  function oPhanTram(c, tienDo) {
    var td = el('td', { dataset: { k: c.k, th: String(c.th || 0), kh: String(c.kh || 0) } });
    if (c.kh == null) { td.appendChild(el('span', { class: 'trong', text: '–' })); }
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
          tr.appendChild(oPhanTram(o, R.tienDo));
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
      COT.forEach(function (c) { var t = tong[c.k]; tr.appendChild(oPhanTram({ k: c.k, th: t.coTh || !t.kh ? t.th : null, kh: t.coKh ? t.kh : null }, R.tienDo)); });
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
    Api.goi('kpi.lichSu', ma ? { ma: ma } : {}).then(function (kq) {
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
          var td = oPhanTram(o, x.tienDo);
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

  function taiTong(the, thang) {
    Api.goi('tong.get', thang ? { thang: thang } : {}).then(function (kq) {
      if (!App.conHieuLuc()) return;
      UI.xoa(the);
      the.appendChild(el('h3', { text: 'Báo cáo tổng Vùng 4' }));
      if (!kq.ok) { loiThe(the, kq, 'Không tải được Báo cáo tổng'); return; }
      if (!kq.D) { the.appendChild(el('p', { class: 'hint', text: 'Chưa có Báo cáo tổng.' })); return; }
      var ds = kq.dsThang || [];
      if (ds.length > 1) {
        var sel = el('select', { id: 'kpi-tong-thang', 'aria-label': 'Tháng Báo cáo tổng' }, ds.map(function (t) { return el('option', { value: t, text: nhanThang(t) }); }));
        sel.value = kq.thang;
        sel.addEventListener('change', function () { taiTong(the, sel.value); });
        the.querySelector('h3').appendChild(sel);
      }
      if (kq.warn && kq.warn.length) {
        the.appendChild(el('div', { id: 'kpi-tong-canh-bao', class: 'canh-bao' }, [el('b', { text: '⚠️ Cảnh báo' }),
          el('ul', null, kq.warn.map(function (w) { return el('li', { text: w }); }))]));
      }
      if (kq.summary) the.appendChild(oTomTat(kq.summary, kq.thang));
      var khung = el('iframe', { id: 'kpi-dash', class: 'dash', title: 'Báo cáo tổng Vùng 4' });
      // trên điện thoại báo cáo chi tiết rất dài: thu gọn, chạm mới mở
      var moRong = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
      the.appendChild(el('details', { id: 'kpi-tong-chi-tiet', open: moRong }, [el('summary', { text: 'Xem Báo cáo tổng chi tiết' }), khung]));
      var nut = el('button', { type: 'button', id: 'kpi-tai-anh-tong', class: 'btn g', text: '⬇ Tải ảnh Báo cáo tổng' });
      nut.addEventListener('click', function () { taiAnhTong(nut, kq.D); });
      the.appendChild(el('div', { class: 'nhom-nut' }, [nut]));
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
    return el('div', { class: 'kpis', id: 'kpi-tong-so', 'aria-label': 'Tóm tắt ' + nhanThang(thang) }, [
      o('TB PTM (MBF + Saymee)', s.MBF + s.SME, khPtm), o('MobiFone', s.MBF, s.kMBF), o('Saymee', s.SME, s.kSME), o('Fiber', s.FIBER, s.kFIBER)]);
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

  function taiAnhKpi(nut, R) {
    dangVe(nut, true, 'Đang vẽ ảnh…');
    var san = el('div', { style: 'position:fixed;left:-20000px;top:0' });
    napHtml2canvas().then(function () {
      var st = document.createElement('style');
      st.textContent = KpiImage.CSS;
      san.appendChild(st);
      var vo = document.createElement('div');
      vo.innerHTML = KpiImage.fragment(R); // chuỗi đã escape trong kpi_image.js
      san.appendChild(vo);
      document.body.appendChild(san);
      return document.fonts && document.fonts.ready;
    }).then(function () {
      var e = san.querySelector('.kimg');
      return window.html2canvas(e, { scale: 1, backgroundColor: '#eef2f7', logging: false, width: e.offsetWidth, height: e.offsetHeight, windowWidth: 1800 });
    }).then(thanhBlob).then(function (blob) {
      san.remove(); dangVe(nut, false);
      luuFile('KPI_NV_Vung4_T' + p2(R.thang) + '-' + R.nam + '.png', blob);
    }).catch(function (e) { san.remove(); baoLoi(nut, e); });
  }

  // html2canvas 1.4.1 không đọc được màu dạng color(...)/oklch (vd. color-mix của ô nhiệt):
  // trong khung chụp (dùng một lần) đổi các màu đó sang rgba qua một canvas 1×1.
  function doiMauRgb(d) {
    var cv = d.createElement('canvas'); cv.width = cv.height = 1;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    function rgba(v) {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = v; ctx.fillRect(0, 0, 1, 1);
      var x = ctx.getImageData(0, 0, 1, 1).data;
      return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + (x[3] / 255).toFixed(3) + ')';
    }
    var THUOC_TINH = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'fill', 'stroke'];
    Array.prototype.forEach.call(d.querySelectorAll('*'), function (e) {
      var cs = d.defaultView.getComputedStyle(e);
      THUOC_TINH.forEach(function (t) {
        var v = cs.getPropertyValue(t);
        if (/^(color|oklch|oklab|lab|lch)\(/.test(v)) e.style.setProperty(t, rgba(v));
      });
    });
  }

  // Vẽ Báo cáo tổng ở khổ máy tính (1440px, nền sáng) trong một khung ẩn rồi chụp bằng html2canvas nạp trong chính khung đó.
  function taiAnhTong(nut, D) {
    dangVe(nut, true, 'Đang vẽ ảnh…');
    var khung = el('iframe', { style: 'position:fixed;left:-20000px;top:0;width:1440px;height:900px;border:0', 'aria-hidden': 'true' });
    Promise.all([layMauDash(), napHtml2canvas()]).then(function (kq) {
      var html = dashHtml(kq[0], D, false).replace('<html lang="vi">', '<html lang="vi" data-theme="light">')
        .replace('</body>', '<script src="' + h2cUrl + '"><' + '/script></body>');
      return new Promise(function (ok, loi) {
        khung.onload = ok;
        khung.onerror = loi;
        khung.srcdoc = html;
        document.body.appendChild(khung);
      });
    }).then(function () {
      var w = khung.contentWindow, d = khung.contentDocument;
      if (!w.html2canvas) throw new Error('không nạp được html2canvas trong khung');
      return (d.fonts ? d.fonts.ready : Promise.resolve()).then(function () {
        doiMauRgb(d);
        var goc = d.documentElement;
        return w.html2canvas(d.body, { scale: 1, logging: false, backgroundColor: '#f9f9f7', windowWidth: 1440, width: goc.scrollWidth, height: goc.scrollHeight });
      });
    }).then(thanhBlob).then(function (blob) {
      khung.remove(); dangVe(nut, false);
      luuFile('BaoCao_PTM_Vung4_T' + p2(D.thang) + '-' + D.nam + '.png', blob);
    }).catch(function (e) { khung.remove(); baoLoi(nut, e); });
  }
})();
