// Thẻ Nhiệm vụ — phần Quản lý / Quản trị (28/11/2026): tab con Việc của tôi · Duyệt · Đã giao; giao/sửa việc, theo dõi, duyệt ảnh.
window.NhiemVuQL = (function () {
  var el = UI.el, N = NVChung;
  var S = { vung: null, con: null, tab: null, nut: {}, tb: '' };
  var TEN_TT_ANH = { Xong: 'Đạt', DangLam: 'Chờ duyệt', TraLai: 'Bị trả lại', ChuaLam: 'Chưa làm' };

  function veTab(vung) {
    S.vung = vung;
    var thanh = el('div', { class: 'nv-tabcon', role: 'tablist' });
    [['toi', 'Việc của tôi'], ['duyet', 'Duyệt'], ['dagiao', 'Đã giao']].forEach(function (x) {
      S.nut[x[0]] = el('button', { type: 'button', class: 'btn g nho', dataset: { tab: x[0] }, text: x[1], onclick: function () { moTab(x[0]); } });
      thanh.appendChild(S.nut[x[0]]);
    });
    S.con = el('div');
    vung.appendChild(thanh);
    vung.appendChild(S.con);
    datSoDuyet(App.dem ? App.dem.choDuyet : 0);
    moTab(S.tab || (App.dem && App.dem.choDuyet > 0 ? 'duyet' : 'dagiao'));
  }
  function moTab(id) {
    S.tab = id;
    Object.keys(S.nut).forEach(function (k) { S.nut[k].classList.toggle('on', k === id); });
    var con = UI.xoa(S.con);
    if (id === 'toi') NhiemVu.veCuaToi(con); else if (id === 'duyet') veDuyet(con); else veDaGiao(con);
  }
  function datSoDuyet(n) { S.nut.duyet.textContent = 'Duyệt' + (n ? ' (' + n + ')' : ''); }
  function conHieuLuc(con) { return App.conHieuLuc() && S.con === con && con.isConnected; }
  function thongBao(con) { if (S.tb) { con.appendChild(el('div', { class: 'card hd-tb', role: 'status', text: '✅ ' + S.tb })); S.tb = ''; } }
  function dangTai(con, chu) { UI.xoa(con).appendChild(el('div', { class: 'card' }, [el('p', { class: 'hint', text: chu })])); }
  function baoLoi(con, kq) { if (kq.loi !== 'HET_PHIEN') UI.xoa(con).appendChild(el('div', { class: 'card' }, [el('p', { class: 'loi-the', text: kq.thongBao })])); }
  function hanChu(nv) {
    if (!nv.han) return 'Không hạn';
    return 'Hạn ' + NhiemVu.ngayHan(nv.han) + (nv.quaHan ? ' · ' + N.quaHanChu(nv.quaHan) : '');
  }

  // ===== Duyệt =====
  function veDuyet(con) {
    dangTai(con, 'Đang tải lượt chờ duyệt…');
    Api.goi('nv.choDuyet', null, true).then(function (kq) {
      if (!conHieuLuc(con)) return;
      if (!kq.ok) return baoLoi(con, kq);
      UI.xoa(con);
      thongBao(con);
      datSoDuyet(kq.luot.length);
      if (!kq.luot.length) { con.appendChild(el('div', { class: 'card nv-xong' }, [el('p', { text: 'Không có lượt nào chờ duyệt 👍' })])); return; }
      var anh = [];
      kq.luot.forEach(function (l) { con.appendChild(theLuot(l, anh, con)); });
      NhiemVu.napAnhNho(anh);
    });
  }
  function theLuot(l, anhCanNap, con) {
    var loi = el('p', { class: 'loi-the' });
    var o = el('textarea', { rows: 2, maxlength: 500, placeholder: 'Lời nhắn cho nhân viên (bắt buộc khi trả lại), vd. Ảnh mờ, chụp lại thấy logo', hidden: true });
    var the = el('div', { class: 'card nv-luot', dataset: { nv: l.nvId, ma: l.ma } }, [
      el('h3', { text: l.ten }),
      el('div', { class: 'nv-phu-dong-chu' }, [el('span', { text: [l.chucVu, l.noiLamViec].filter(Boolean).join(' · ') }),
        el('span', { text: 'Gửi lúc ' + UI.ngayGio(l.lucCapNhat) })]),
      el('p', { class: 'nv-mo-ta' }, [el('b', { text: l.tieuDe }), ' — ' + hanChu({ han: l.han, quaHan: 0 })]),
      el('div', { class: 'nv-luoi' }, l.anh.map(function (a) {
        var x = NhiemVu.oAnh(a, a.moi ? [el('span', { class: 'chip', text: 'mới' })] : null);
        anhCanNap.push({ id: a.id, img: x.img });
        return x.o;
      })), o, loi
    ]);
    var nutDat = el('button', { type: 'button', class: 'btn', text: '✔ Đạt' });
    var nutTra = el('button', { type: 'button', class: 'btn do', text: '↩ Trả lại' });
    function gui(dat) {
      if (!dat && o.hidden) { o.hidden = false; nutTra.textContent = 'Gửi trả lại'; o.focus(); return; }
      if (!dat && !o.value.trim()) { loi.textContent = 'Ghi lời nhắn để nhân viên biết cần làm lại gì'; o.focus(); return; }
      nutDat.disabled = nutTra.disabled = true; loi.textContent = '';
      Api.goi('nv.duyet', { nvId: l.nvId, ma: l.ma, dat: dat, loiNhan: dat ? '' : o.value }).then(function (kq) {
        nutDat.disabled = nutTra.disabled = false;
        if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') loi.textContent = kq.thongBao; return; }
        App.capNhatDemNv(kq.dem);
        datSoDuyet(kq.dem.choDuyet);
        the.remove();
        if (!con.querySelector('.nv-luot')) veDuyet(con);
      });
    }
    nutDat.addEventListener('click', function () { gui(true); });
    nutTra.addEventListener('click', function () { gui(false); });
    the.appendChild(el('div', { class: 'hd-lenh' }, [nutDat, nutTra]));
    return the;
  }

  // ===== Đã giao =====
  function veDaGiao(con, ketThuc) {
    dangTai(con, 'Đang tải danh sách nhiệm vụ…');
    Api.goi('nv.ds', { ketThuc: !!ketThuc }, true).then(function (kq) {
      if (!conHieuLuc(con)) return;
      if (!kq.ok) return baoLoi(con, kq);
      UI.xoa(con);
      thongBao(con);
      var oKt = el('input', { type: 'checkbox', id: 'nv-hien-kt', checked: ketThuc || null });
      oKt.addEventListener('change', function () { veDaGiao(con, oKt.checked); });
      var ds = el('div', { class: 'nv-ds' });
      con.appendChild(el('div', { class: 'card' }, [
        el('h3', null, [el('span', { text: 'Nhiệm vụ đã giao' }),
          el('button', { type: 'button', class: 'btn nho', id: 'nv-giao', text: '+ Giao việc', onclick: function () { moForm(con, null, null); } })]),
        el('label', { class: 'hds-doc-lai', for: 'nv-hien-kt' }, [oKt, ' Hiện cả nhiệm vụ đã kết thúc']), ds]));
      if (!kq.nhiemVu.length) { ds.appendChild(el('p', { class: 'hint', text: 'Chưa có nhiệm vụ nào.' })); return; }
      kq.nhiemVu.forEach(function (nv) {
        var d = nv.dem, doc = nv.loai === 'doc';
        var dem = doc ? 'Đã đọc ' + d.xong + ' · Chưa đọc ' + d.chuaLam
          : 'Đạt ' + d.xong + ' · Chờ duyệt ' + d.dangLam + ' · Bị trả lại ' + d.traLai + ' · Chưa làm ' + d.chuaLam;
        ds.appendChild(el('button', { type: 'button', class: 'hd-bai', dataset: { id: nv.id }, onclick: function () { veTheoDoi(con, nv.id); } }, [
          el('span', { class: 'hd-td' }, [(doc ? '📖 ' : '📷 ') + nv.tieuDe,
            nv.trangThai === 'KetThuc' ? el('span', { class: 'chip off', text: 'Đã kết thúc' }) : null]),
          el('small', { text: hanChu(nv) + ' · Giao bởi ' + nv.tenNguoiGiao }),
          el('small', { class: d.quaHan ? 'nv-qh' : '', text: dem + (d.quaHan ? ' · Quá hạn ' + d.quaHan + ' người' : '') })
        ]));
      });
    });
  }

  function veTheoDoi(con, id) {
    dangTai(con, 'Đang tải…');
    Api.goi('nv.theoDoi', { id: id }, true).then(function (kq) {
      if (!conHieuLuc(con)) return;
      if (!kq.ok) return baoLoi(con, kq);
      UI.xoa(con);
      thongBao(con);
      var nv = kq.nhiemVu, doc = nv.loai === 'doc', loi = el('p', { class: 'loi-the' });
      var lenh = el('div', { class: 'hd-lenh' }, [el('button', { type: 'button', class: 'btn g nho', text: '← Quay lại', onclick: function () { veDaGiao(con); } })]);
      if (nv.suaDuoc) {
        lenh.appendChild(el('button', { type: 'button', class: 'btn nho', id: 'nv-sua', text: 'Sửa', onclick: function () { moForm(con, nv, kq.nguoi); } }));
        if (nv.trangThai === 'Mo') lenh.appendChild(el('button', { type: 'button', class: 'btn g nho', id: 'nv-ket-thuc', text: 'Kết thúc', onclick: function () {
          if (!confirm('Kết thúc nhiệm vụ "' + nv.tieuDe + '"? Nhiệm vụ biến mất khỏi danh sách của nhân viên; bảng theo dõi và ảnh vẫn giữ.')) return;
          Api.goi('nv.ketThuc', { id: nv.id }).then(function (r) {
            if (!r.ok) { if (r.loi !== 'HET_PHIEN') loi.textContent = r.thongBao; return; }
            S.tb = 'Đã kết thúc nhiệm vụ.'; capNhatDem(); veDaGiao(con);
          });
        } }));
        lenh.appendChild(el('button', { type: 'button', class: 'btn do nho', id: 'nv-xoa', text: 'Xóa', onclick: function () {
          if (!confirm('Xóa hẳn nhiệm vụ "' + nv.tieuDe + '"?\nXóa cả ảnh nhân viên đã nộp, không khôi phục được trên trang. Chỉ dùng khi giao nhầm.')) return;
          Api.goi('nv.xoa', { id: nv.id }).then(function (r) {
            if (!r.ok) { if (r.loi !== 'HET_PHIEN') loi.textContent = r.thongBao; return; }
            S.tb = 'Đã xóa nhiệm vụ.'; capNhatDem(); veDaGiao(con);
          });
        } }));
      }
      var bang = el('table', { class: 'nv-bang' }, [el('thead', null, [el('tr', null, ['Nhân viên', 'Chức vụ · Nơi làm việc', 'Trạng thái'].map(function (t) { return el('th', { text: t }); }))])]);
      var than = el('tbody');
      kq.nguoi.forEach(function (p) {
        var chu = doc ? (p.trangThai === 'Xong' ? 'Đã đọc' : 'Chưa đọc') : TEN_TT_ANH[p.trangThai] + (p.soAnh ? ' (' + p.soAnh + ' ảnh)' : '');
        if (p.trangThai === 'TraLai' && p.loiNhan) chu += ': "' + p.loiNhan + '"';
        than.appendChild(el('tr', { class: 'tt-' + p.trangThai }, [el('td', { text: p.ten }), el('td', { text: [p.chucVu, p.noiLamViec].filter(Boolean).join(' · ') }),
          el('td', null, [chu, p.quaHan ? el('div', { class: 'nv-qh', text: N.quaHanChu(p.quaHan) }) : null])]));
      });
      bang.appendChild(than);
      con.appendChild(el('div', { class: 'card' }, [lenh,
        el('h3', { text: (doc ? '📖 ' : '📷 ') + nv.tieuDe + (nv.trangThai === 'KetThuc' ? ' (đã kết thúc)' : '') }),
        el('div', { class: 'nv-phu-dong-chu' }, [el('span', { text: hanChu(nv) }), el('span', { text: 'Giao bởi ' + nv.tenNguoiGiao + ' · ' + UI.ngayGio(nv.lucGiao) })]),
        nv.noiDung ? el('p', { class: 'nv-mo-ta', text: nv.noiDung }) : null, loi,
        el('div', { class: 'nv-cuon' }, [bang])]));
    });
  }
  function capNhatDem() { Api.goi('nv.dem', null, true).then(function (kq) { if (kq.ok) App.capNhatDemNv(kq.dem); }); }

  // ===== Giao việc / Sửa =====
  function moForm(con, nv, nguoi) {
    dangTai(con, 'Đang tải danh sách nhân viên…');
    Promise.all([Api.goi('hoSo.danhSach', null, true), Api.goi('bai.ds', null, true)]).then(function (r) {
      if (!conHieuLuc(con)) return;
      if (!r[0].ok) return baoLoi(con, r[0]);
      veForm(con, nv, nguoi, r[0].nhanVien.filter(function (x) { return x.trangThai !== 'Nghi'; }), r[1].ok ? r[1].mucLuc.bai : []);
    });
  }
  function luaChon(ds, tatCa) {
    return el('select', null, [el('option', { value: '', text: tatCa })].concat(ds.map(function (x) { return el('option', { value: x, text: x }); })));
  }
  function veForm(con, nv, nguoi, dsNv, dsBai) {
    UI.xoa(con);
    var sua = !!nv, loi = el('p', { class: 'loi-the' }), tt = el('p', { class: 'hint' });
    var tieuDe = el('input', { id: 'nvf-tieu-de', maxlength: 200, value: sua ? nv.tieuDe : '', placeholder: 'vd. Dán poster MobiWifi 5G tại các điểm bán' });
    var loai = el('select', { id: 'nvf-loai', disabled: sua || null }, [el('option', { value: 'anh', text: '📷 Tải ảnh' }), el('option', { value: 'doc', text: '📖 Đọc bài' })]);
    if (sua) loai.value = nv.loai;
    var bai = el('select', { id: 'nvf-bai' }, [el('option', { value: '', text: '— Chọn bài —' })].concat(dsBai.map(function (b) { return el('option', { value: b.id, text: b.tieuDe }); })));
    if (sua && nv.idBai) bai.value = nv.idBai;
    var oBai = el('div', null, [el('label', { for: 'nvf-bai', text: 'Bài cần đọc' }), bai]);
    var moTa = el('textarea', { id: 'nvf-mo-ta', rows: 4, maxlength: 5000, placeholder: 'Mô tả việc cần làm (tùy chọn)' });
    moTa.value = sua ? nv.noiDung || '' : '';
    var han = el('input', { id: 'nvf-han', type: 'date', value: sua ? nv.han : '' });
    // Ảnh mẫu
    var anhMau = sua ? (nv.anhMau || []).slice() : [];
    var luoiMau = el('div', { class: 'nv-luoi nv-mau' });
    function veMau() {
      UI.xoa(luoiMau);
      anhMau.forEach(function (p, i) {
        luoiMau.appendChild(el('div', { class: 'nv-o' }, [el('img', { src: p, alt: 'Ảnh mẫu' }),
          el('button', { type: 'button', class: 'nv-xoa-anh', title: 'Bỏ ảnh', text: '✕', onclick: function () { anhMau.splice(i, 1); veMau(); } })]));
      });
    }
    var chonMau = el('input', { type: 'file', accept: 'image/*,.heic,.heif', multiple: true, hidden: true });
    chonMau.addEventListener('change', function () {
      var fs = Array.prototype.slice.call(chonMau.files); chonMau.value = '';
      fs.reduce(function (p, f) {
        return p.then(function () {
          var l = N.kiemAnh(f);
          if (l) { loi.textContent = l; return; }
          tt.textContent = 'Đang tải ảnh mẫu ' + f.name + '…';
          return new Promise(function (ok) {
            var rd = new FileReader();
            rd.onload = function () { ok(String(rd.result).replace(/^data:[^,]*,/, '')); };
            rd.onerror = function () { ok(''); };
            rd.readAsDataURL(f);
          }).then(function (b64) { return Api.goi('nv.anhMau', { ten: f.name, b64: b64 }, true); }).then(function (kq) {
            if (!kq.ok) { loi.textContent = kq.thongBao; return; }
            anhMau.push(kq.duongDan); veMau();
          });
        });
      }, Promise.resolve()).then(function () { tt.textContent = ''; });
    });
    // Người được giao: lọc nhanh theo Chức vụ / Nơi làm việc → chọn hết NV khớp; bỏ chọn / thêm từng người tùy ý
    var chon = {};
    if (sua) (nguoi || []).forEach(function (p) { chon[p.ma] = true; });
    var uniq = function (k) { var o = {}; dsNv.forEach(function (x) { if (x[k]) o[x[k]] = 1; }); return Object.keys(o).sort(); };
    var locCv = luaChon(uniq('chucVu'), 'Tất cả chức vụ'), locNoi = luaChon(uniq('noiLamViec'), 'Tất cả nơi làm việc');
    locCv.id = 'nvf-cv'; locNoi.id = 'nvf-noi';
    var laNv = function (x) { return !x.quyen || x.quyen === 'NV'; };
    var khop = function (x) { return (!locCv.value || x.chucVu === locCv.value) && (!locNoi.value || x.noiLamViec === locNoi.value); };
    var dsChon = el('div', { class: 'nv-chon' }), demChon = el('b');
    function veChon() {
      UI.xoa(dsChon);
      var nhom = [['Nhân viên', dsNv.filter(laNv)], ['Khác (Quản lý, Quản trị)', dsNv.filter(function (x) { return !laNv(x); })]];
      nhom.forEach(function (g) {
        if (!g[1].length) return;
        dsChon.appendChild(el('div', { class: 'nv-chon-nhom', text: g[0] }));
        g[1].slice().sort(function (a, b) { return (khop(b) - khop(a)) || (a.ten < b.ten ? -1 : 1); }).forEach(function (x) {
          var o = el('input', { type: 'checkbox', checked: chon[x.ma] || null, dataset: { ma: x.ma } });
          o.addEventListener('change', function () { if (o.checked) chon[x.ma] = true; else delete chon[x.ma]; dem(); });
          dsChon.appendChild(el('label', { class: 'nv-chon-dong' + (khop(x) ? '' : ' mo') }, [o, ' ' + x.ten + ' ',
            el('small', { text: [x.chucVu, x.noiLamViec].filter(Boolean).join(' · ') })]));
        });
      });
      dem();
    }
    function dem() { demChon.textContent = 'Đã chọn ' + Object.keys(chon).length + ' người'; }
    function apLoc() { chon = {}; dsNv.forEach(function (x) { if (laNv(x) && khop(x)) chon[x.ma] = true; }); veChon(); }
    locCv.addEventListener('change', apLoc); locNoi.addEventListener('change', apLoc);
    if (!sua) apLoc(); else veChon();
    function capNhatLoai() { oBai.hidden = loai.value !== 'doc'; }
    loai.addEventListener('change', capNhatLoai); capNhatLoai();

    var nutLuu = el('button', { type: 'button', class: 'btn', id: 'nvf-luu', text: sua ? 'Lưu thay đổi' : 'Giao việc' });
    nutLuu.addEventListener('click', function () {
      if (!tieuDe.value.trim()) { loi.textContent = 'Chưa nhập tiêu đề'; tieuDe.focus(); return; }
      if (loai.value === 'doc' && !bai.value) { loi.textContent = 'Chưa chọn bài cần đọc'; return; }
      var giao = Object.keys(chon);
      if (!giao.length) { loi.textContent = 'Chưa chọn người được giao'; return; }
      nutLuu.disabled = true; loi.textContent = '';
      Api.goi('nv.luu', { id: sua ? nv.id : '', tieuDe: tieuDe.value, loai: loai.value, idBai: bai.value, noiDung: moTa.value,
        han: han.value, anhMau: anhMau, giaoCho: giao }).then(function (kq) {
        nutLuu.disabled = false;
        if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') loi.textContent = kq.thongBao; return; }
        S.tb = (sua ? 'Đã lưu thay đổi.' : 'Đã giao việc cho ' + giao.length + ' người.');
        capNhatDem();
        if (sua) veTheoDoi(con, nv.id); else veDaGiao(con);
      });
    });
    con.appendChild(el('div', { class: 'card hds nvf' }, [
      el('h3', { text: sua ? 'Sửa nhiệm vụ' : 'Giao việc' }),
      el('label', { for: 'nvf-tieu-de', text: 'Tiêu đề' }), tieuDe,
      el('label', { for: 'nvf-loai', text: 'Loại' }), loai, oBai,
      el('label', { for: 'nvf-mo-ta', text: 'Mô tả' }), moTa,
      el('div', { class: 'hds-dau' }, [el('label', { text: 'Ảnh mẫu (tùy chọn, công khai trên trang)' }),
        el('button', { type: 'button', class: 'btn g nho', text: '🖼 Thêm ảnh mẫu', onclick: function () { chonMau.click(); } }), chonMau]),
      luoiMau,
      el('label', { for: 'nvf-han', text: 'Hạn (để trống nếu không có hạn)' }), han,
      el('label', { text: 'Giao cho' }),
      el('div', { class: 'nv-loc' }, [locCv, locNoi]), demChon, dsChon, tt, loi,
      el('div', { class: 'hd-lenh' }, [nutLuu, el('button', { type: 'button', class: 'btn g', text: 'Hủy', onclick: function () {
        if (sua) veTheoDoi(con, nv.id); else veDaGiao(con);
      } })])
    ]));
    veMau();
    window.scrollTo(0, 0);
    tieuDe.focus();
  }

  return { veTab: veTab };
})();
