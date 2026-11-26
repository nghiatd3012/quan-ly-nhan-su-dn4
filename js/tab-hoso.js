// Thẻ Thông tin cá nhân: xem hồ sơ, sửa → gửi duyệt; QL/QT chọn xem hồ sơ người khác (chỉ xem); QT đặt lại mật khẩu.
(function () {
  var el = UI.el;
  var dangXem = null;   // Mã NV đang xem; null = hồ sơ của mình
  var cuaAi = null;     // người đăng nhập lúc chọn dangXem (đổi người thì bỏ lựa chọn cũ)

  // Kiểm tra nhẹ trước khi gửi; chuỗi rỗng là xóa trường, được phép.
  var KIEM_TRA = {
    NgaySinh: [/^\d{1,2}\/\d{1,2}\/\d{4}$/, 'Ngày sinh nhập dạng dd/mm/yyyy'],
    SDT: [/^0\d{8,10}$/, 'Số điện thoại gồm 9–11 chữ số, bắt đầu bằng 0'],
    Email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ'],
    CCCD: [/^\d{9}(\d{3})?$/, 'Số CCCD gồm 12 chữ số (CMND cũ 9 chữ số)'],
    SoTaiKhoan: [/^\d{4,20}$/, 'Số tài khoản chỉ gồm chữ số']
  };
  var BO_KHOANG_TRANG = { SDT: 1, CCCD: 1, SoTaiKhoan: 1 };
  var LUA_CHON = { GioiTinh: ['', 'Nam', 'Nữ'] };

  App.dangKyThe({ id: 'hoso', ten: 'Thông tin cá nhân', quyenToiThieu: 'NV', ve: ve, capNhatDem: napTruoc });

  // Nạp ngầm hồ sơ của mình ngay khi vào trang (mỗi lệnh Apps Script mất ~2 giây) để bấm thẻ là hiện ngay (26/11/2026).
  // Chỉ giữ trong bộ nhớ lúc mở trang (hồ sơ có CCCD/STK nên không lưu xuống máy); dùng 1 lần, quá 5 phút thì bỏ.
  var truoc = null, dangTaiCuaToi = false;
  function napTruoc() {
    var u = App.nguoiDung;
    if (dangTaiCuaToi || (truoc && truoc.ma === u.ma)) return;
    truoc = { ma: u.ma, luc: Date.now(), hua: Api.goi('hoSo.get', {}, true) };
  }
  function layCuaToi() {
    var t = truoc;
    truoc = null;
    if (t && t.ma === App.nguoiDung.ma && Date.now() - t.luc < 5 * 60 * 1000) {
      UI.dangTai(true);
      return t.hua.then(function (kq) { UI.dangTai(false); return kq.ok ? kq : Api.goi('hoSo.get', {}); });
    }
    return Api.goi('hoSo.get', {});
  }

  function ve(vung) {
    var u = App.nguoiDung;
    if (cuaAi !== u.ma) { dangXem = null; cuaAi = u.ma; }
    var than = el('div', { class: 'the hs-luoi' });
    if (u.quyen === 'QL' || u.quyen === 'QT') vung.appendChild(oChon(than));
    vung.appendChild(than);
    tai(than);
  }

  function oChon(than) {
    var sel = el('select', { id: 'hs-chon', onchange: function () { dangXem = sel.value || null; tai(than); } },
      [el('option', { value: '', text: 'Hồ sơ của tôi' })]);
    Api.goi('hoSo.danhSach').then(function (kq) {
      if (!kq.ok) return;
      var toi = App.nguoiDung.ma.toUpperCase();
      kq.nhanVien.filter(function (n) { return String(n.ma).toUpperCase() !== toi; }).forEach(function (n) {
        sel.appendChild(el('option', { value: n.ma, text: (n.ten || n.ma) + ' – ' + n.ma + (n.trangThai === 'Nghi' ? ' (nghỉ)' : '') }));
      });
      if (dangXem) sel.value = dangXem;
    });
    return el('div', { class: 'card hs-chon-the' }, [el('label', { for: 'hs-chon', text: 'Xem hồ sơ của', style: 'margin-top:0' }), sel]);
  }

  function tai(than, thongBao) {
    var ma = dangXem;
    if (!ma) dangTaiCuaToi = true;
    (ma ? Api.goi('hoSo.get', { ma: ma }) : layCuaToi()).then(function (kq) {
      if (!ma) dangTaiCuaToi = false;
      if (!App.conHieuLuc() || ma !== dangXem) return;
      UI.xoa(than);
      if (!kq.ok) {
        if (kq.loi !== 'HET_PHIEN') than.appendChild(el('div', { class: 'card loi-the', text: kq.thongBao || 'Không tải được hồ sơ' }));
        return;
      }
      veHoSo(than, kq.hoSo, kq.yeuCau || {}, !ma);
      if (thongBao) UI.$('hs-thong-bao').textContent = thongBao;
    });
  }

  function giaTri(v) { return v ? v : el('span', { class: 'trong', text: '—' }); }
  function hien(t) { return UI.TRUONG_AN.indexOf(t) < 0; }
  var SUA_HIEN = UI.TRUONG_SUA.filter(hien);   // các trường NV được sửa, trừ trường ẩn
  var CA_NHAN = SUA_HIEN.filter(function (t) { return UI.TRUONG_CONG_VIEC.indexOf(t) < 0; });

  function veHoSo(than, hs, yc, laCuaToi) {
    var cv = el('div', { class: 'card', id: 'hs-congviec', dataset: { ma: hs.MaNV } },
      [el('h3', { text: 'Thông tin công việc' })]);
    UI.TRUONG_KHOA.filter(hien).forEach(function (t) {
      cv.appendChild(UI.dong(UI.TEN_TRUONG[t], giaTri(hs[t]), { dataset: { truong: t } }));
    });

    var cn = el('div', { class: 'card', id: 'hs-canhan' });
    var tb = el('div', { id: 'hs-thong-bao', class: 'thanh-cong', role: 'status' });
    function veXem() {
      UI.xoa(cn);
      cn.appendChild(el('h3', null, ['Thông tin cá nhân',
        laCuaToi ? el('button', { type: 'button', id: 'hs-sua', class: 'btn g nho', text: '✏️ Sửa', onclick: veSua }) : null]));
      function oXem(t) {
        var y = yc[t], b;
        if (y && y.TrangThai === 'Cho') {
          b = el('span', null, [el('span', { class: 'old', text: y.Cu || 'trống' }),
            el('span', { class: 'pend', text: '→ ' + (y.Moi || '(để trống)') + ' · ⏳ Chờ duyệt' })]);
        } else if (y && y.TrangThai === 'TuChoi') {
          b = el('span', null, [giaTri(hs[t]), el('span', { class: 'rej', text: 'Bị từ chối' + (y.LyDo ? ': ' + y.LyDo : '') })]);
        } else b = giaTri(hs[t]);
        return UI.dong(UI.TEN_TRUONG[t], b, { dataset: { truong: t } });
      }
      // Email, Mã C2C, Mã CH, User đấu nối, User Mplus2: hiện ở mục công việc (NV vẫn sửa qua nút Sửa)
      Array.prototype.slice.call(cv.querySelectorAll('[data-cv-sua]')).forEach(function (x) { x.remove(); });
      UI.TRUONG_CONG_VIEC.forEach(function (t) { var d = oXem(t); d.dataset.cvSua = '1'; cv.appendChild(d); });
      CA_NHAN.forEach(function (t) { cn.appendChild(oXem(t)); });
      cn.appendChild(tb);
    }

    function veSua() {
      tb.textContent = '';
      UI.xoa(cn);
      cn.appendChild(el('h3', { text: 'Sửa thông tin cá nhân' }));
      cn.appendChild(el('p', { class: 'hint', text: 'Thay đổi chỉ có hiệu lực sau khi quản trị duyệt.' }));
      var banDau = {};
      SUA_HIEN.forEach(function (t) {
        var y = yc[t];
        var v = y && y.TrangThai === 'Cho' ? (y.Moi || '') : (hs[t] || '');
        banDau[t] = v;
        var id = 'hs-o-' + t, o;
        if (LUA_CHON[t]) {
          var ds = LUA_CHON[t].slice();
          if (ds.indexOf(v) < 0) ds.push(v);
          o = el('select', { id: id, dataset: { o: t } }, ds.map(function (x) { return el('option', { value: x, text: x || '—' }); }));
        } else {
          o = el('input', { id: id, dataset: { o: t }, autocomplete: 'off',
            type: t === 'Email' ? 'email' : t === 'SDT' ? 'tel' : 'text',
            inputmode: BO_KHOANG_TRANG[t] ? 'numeric' : null,
            placeholder: t === 'NgaySinh' ? 'dd/mm/yyyy' : null });
        }
        o.value = v;
        cn.appendChild(el('div', { class: 'row sua', dataset: { truong: t } }, [el('label', { for: id, text: UI.TEN_TRUONG[t], style: 'margin:0' }), o]));
      });
      var loi = el('div', { id: 'hs-loi', class: 'loi', role: 'alert' });
      var gui = el('button', { type: 'button', id: 'hs-gui', class: 'btn', text: 'Gửi duyệt' });
      cn.appendChild(loi);
      cn.appendChild(el('div', { class: 'nhom-nut' }, [gui,
        el('button', { type: 'button', id: 'hs-huy', class: 'btn g', text: 'Hủy', onclick: veXem })]));
      gui.addEventListener('click', function () {
        var thayDoi = {}, so = 0;
        for (var i = 0; i < SUA_HIEN.length; i++) {
          var t = SUA_HIEN[i];
          var v = cn.querySelector('[data-o="' + t + '"]').value.trim();
          if (BO_KHOANG_TRANG[t]) v = v.replace(/[\s.]/g, '');
          if (v === banDau[t].trim()) continue;
          if (v && KIEM_TRA[t] && !KIEM_TRA[t][0].test(v)) { loi.textContent = KIEM_TRA[t][1]; return; }
          thayDoi[t] = v; so++;
        }
        if (!so) { loi.textContent = 'Bạn chưa thay đổi thông tin nào'; return; }
        loi.textContent = '';
        gui.disabled = true;
        Api.goi('hoSo.guiSua', { thayDoi: thayDoi }).then(function (kq) {
          gui.disabled = false;
          if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') loi.textContent = kq.thongBao || 'Không gửi được'; return; }
          tai(than, kq.soYeuCau ? 'Đã gửi ' + kq.soYeuCau + ' thay đổi, chờ quản trị duyệt.' : 'Không có thay đổi mới.');
        });
      });
      var dau = cn.querySelector('[data-o]');
      if (dau) dau.focus();
    }

    veXem();
    than.appendChild(cv);
    than.appendChild(cn);

    if (!laCuaToi && App.nguoiDung.quyen === 'QT') {
      var nut = el('button', { type: 'button', id: 'hs-dat-lai-mk', class: 'btn g', text: '🔑 Đặt lại mật khẩu' });
      nut.addEventListener('click', function () {
        var ten = (hs.HoTen || hs.MaNV) + ' (' + hs.MaNV + ')';
        if (!window.confirm('Đặt lại mật khẩu của ' + ten + ' về mật khẩu mặc định? Người này sẽ phải đổi mật khẩu khi đăng nhập lần tới.')) return;
        nut.disabled = true;
        Api.goi('admin.datLaiMatKhau', { ma: hs.MaNV }).then(function (kq) {
          nut.disabled = false;
          if (kq.loi === 'HET_PHIEN') return;
          tb.className = kq.ok ? 'thanh-cong' : 'loi';
          tb.textContent = kq.ok ? 'Đã đặt lại mật khẩu của ' + ten + ' về mật khẩu mặc định.' : (kq.thongBao || 'Không đặt lại được');
        });
      });
      than.appendChild(el('div', { class: 'card' }, [el('h3', { text: 'Tài khoản' }),
        el('p', { class: 'hint', text: 'Dùng khi nhân viên quên mật khẩu. Mật khẩu mặc định nằm trong sheet CauHinh.' }), nut]));
    }
  }
})();
