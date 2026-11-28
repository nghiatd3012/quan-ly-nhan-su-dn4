// Khung trang: đăng nhập, đổi mật khẩu (bắt buộc lần đầu), thẻ theo quyền.
// Các thẻ đăng ký bằng App.dangKyThe({id, ten, quyenToiThieu, ve(el)}); thẻ tạm dưới đây sẽ được thay ở bước 6–8.
window.App = (function () {
  var $ = UI.$, el = UI.el;
  var QUYEN = { NV: 1, QL: 2, QT: 3 };
  var THU_TU = ['huongdan', 'kpi', 'hoso', 'duyet', 'nap'];
  var dsThe = {};
  var demThe = {}; // số đếm trên tên thẻ, giữ lại khi vẽ lại thanh thẻ
  var theDangMo = null;
  var lanVe = 0; // tăng mỗi lần đổi màn để bỏ kết quả về muộn

  var App = { nguoiDung: null };

  // Thẻ mở đầu khi vào trang: KPI (dù thẻ Chính sách & Hướng dẫn đứng trước trên thanh thẻ).
  App.theMoDau = function (ds) {
    if (ds.some(function (t) { return t.id === 'kpi'; })) return 'kpi';
    return ds[0] ? ds[0].id : null;
  };

  App.dangKyThe = function (the) {
    dsThe[the.id] = the;
    if (THU_TU.indexOf(the.id) < 0) THU_TU.push(the.id);
    if (!$('khung').hidden) veThanhThe();
  };

  function theDuocXem() {
    var q = QUYEN[App.nguoiDung && App.nguoiDung.quyen] || 0;
    return THU_TU.filter(function (id) { return dsThe[id] && q >= (QUYEN[dsThe[id].quyenToiThieu] || 1); })
      .map(function (id) { return dsThe[id]; });
  }

  function hienMan(ten) {
    $('man-dang-nhap').hidden = ten === 'khung';
    $('dn-form').hidden = ten !== 'dangNhap';
    $('dmk-form').hidden = ten !== 'doiMK';
    $('khung').hidden = ten !== 'khung';
    lanVe++;
  }

  App.veDangNhap = function (thongBao) {
    App.nguoiDung = null;
    theDangMo = null;
    demThe = {};
    UI.xoa($('the-nd'));
    UI.xoa($('the-ds'));
    hienMan('dangNhap');
    $('dn-mk').value = '';
    $('dn-loi').textContent = thongBao || '';
    $('dn-nut').disabled = false;
    ($('dn-ma').value ? $('dn-mk') : $('dn-ma')).focus();
  };

  App.veDoiMatKhau = function (batBuoc) {
    hienMan('doiMK');
    ['dmk-cu', 'dmk-moi', 'dmk-lai'].forEach(function (id) { $(id).value = ''; });
    $('dmk-loi').textContent = '';
    $('dmk-nut').disabled = false;
    $('dmk-huy').hidden = !!batBuoc;
    $('dmk-ghichu').textContent = batBuoc
      ? 'Lần đầu đăng nhập, bạn cần đổi mật khẩu do quản trị cấp trước khi sử dụng.'
      : 'Nhập mật khẩu hiện tại và mật khẩu mới.';
    $('dmk-cu').focus();
  };

  function veKhung() {
    var u = App.nguoiDung;
    hienMan('khung');
    $('nd-ten').textContent = u.ten || u.ma;
    $('nd-phu').textContent = u.ma + ' · ' + (UI.TEN_QUYEN[u.quyen] || u.quyen);
    veThanhThe();
    var ds = theDuocXem();
    var dau = ds.filter(function (t) { return t.id === theDangMo; })[0];
    var idDau = dau ? dau.id : App.theMoDau(ds);
    if (idDau) moThe(idDau);
    // thẻ nào có capNhatDem() (vd. số yêu cầu chờ duyệt) thì lấy số ngay khi vào trang
    ds.forEach(function (t) { if (t.capNhatDem) t.capNhatDem(); });
  }

  function veThanhThe() {
    var nav = UI.xoa($('the-ds'));
    theDuocXem().forEach(function (t) {
      nav.appendChild(el('button', {
        type: 'button', role: 'tab', class: 'tab' + (t.id === theDangMo ? ' on' : ''),
        dataset: { the: t.id, ten: t.ten }, 'aria-selected': t.id === theDangMo ? 'true' : 'false',
        onclick: function () { moThe(t.id); }
      }, [t.ten, el('span', { class: 'n', id: 'dem-' + t.id, hidden: !demThe[t.id], text: demThe[t.id] ? String(demThe[t.id]) : '' })]));
    });
  }

  function moThe(id) {
    var t = dsThe[id];
    if (!t) return;
    theDangMo = id;
    Array.prototype.forEach.call($('the-ds').children, function (b) {
      var on = b.dataset.the === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var nd = UI.xoa($('the-nd'));
    var vung = el('div', { class: 'the', dataset: { the: id } });
    nd.appendChild(vung);
    var lan = lanVe;
    App.conHieuLuc = function () { return lan === lanVe && theDangMo === id; };
    try { t.ve(vung); } catch (e) { vung.appendChild(el('div', { class: 'card loi', text: 'Lỗi hiển thị: ' + e.message })); }
  }

  // Đặt số đếm trên tên thẻ (vd. số yêu cầu chờ duyệt); 0 thì ẩn.
  App.datDem = function (id, n) {
    demThe[id] = n || 0;
    var e = $('dem-' + id);
    if (!e) return;
    e.textContent = n ? String(n) : '';
    e.hidden = !n;
  };

  function vaoTrang(user) {
    App.nguoiDung = user;
    if (user.phaiDoiMK) App.veDoiMatKhau(true); else veKhung();
  }

  // ===== Sự kiện =====
  $('dn-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var ma = $('dn-ma').value.trim(), mk = $('dn-mk').value;
    if (!ma || !mk) { $('dn-loi').textContent = 'Nhập Mã NV và mật khẩu'; return; }
    $('dn-nut').disabled = true;
    $('dn-loi').textContent = '';
    Api.goi('login', { ma: ma, mk: mk }).then(function (kq) {
      $('dn-nut').disabled = false;
      if (!kq.ok) { $('dn-loi').textContent = kq.thongBao || 'Đăng nhập không thành công'; return; }
      Api.datPhien({ token: kq.token, user: kq.user });
      vaoTrang(kq.user);
    });
  });

  $('dmk-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var cu = $('dmk-cu').value, moi = $('dmk-moi').value, lai = $('dmk-lai').value;
    var loi = $('dmk-loi');
    if (moi.length < 6) { loi.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự'; return; }
    if (moi !== lai) { loi.textContent = 'Mật khẩu nhập lại không khớp'; return; }
    if (moi === cu) { loi.textContent = 'Mật khẩu mới phải khác mật khẩu hiện tại'; return; }
    $('dmk-nut').disabled = true;
    loi.textContent = '';
    Api.goi('doiMatKhau', { cu: cu, moi: moi }).then(function (kq) {
      $('dmk-nut').disabled = false;
      if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') loi.textContent = kq.thongBao || 'Không đổi được mật khẩu'; return; }
      var p = Api.layPhien();
      p.user.phaiDoiMK = false;
      Api.datPhien(p);
      App.nguoiDung = p.user;
      veKhung();
    });
  });

  $('dmk-huy').addEventListener('click', function () { if (App.nguoiDung) veKhung(); });
  $('nut-doi-mk').addEventListener('click', function () { App.veDoiMatKhau(false); });

  $('nut-dang-xuat').addEventListener('click', function () {
    var p = Api.layPhien();
    Api.datPhien(null);
    if (p && p.token) Api.goi('logout', { token: p.token });
    App.veDangNhap('');
  });

  // ===== Thẻ tạm (bước 5): chỉ kiểm tra phiên; nội dung làm ở bước 6–8 =====
  function theTam(id, ten, quyen) {
    App.dangKyThe({
      id: id, ten: ten, quyenToiThieu: quyen, tam: true,
      ve: function (vung) {
        Api.goi('hoSo.get').then(function (kq) {
          if (!kq.ok || !App.conHieuLuc()) return;
          vung.appendChild(el('div', { class: 'card' }, [el('h3', { text: ten }), el('p', { class: 'hint', text: 'Nội dung thẻ đang được xây dựng.' })]));
        });
      }
    });
  }
  theTam('hoso', 'Thông tin cá nhân', 'NV');
  theTam('kpi', 'KPI', 'NV');
  theTam('duyet', 'Duyệt yêu cầu', 'QT');
  theTam('nap', 'Nạp số liệu', 'QT');

  // Gọi sau khi đã nạp mọi file thẻ (cuối index.html).
  App.batDau = function () {
    var p = Api.layPhien();
    if (p && p.token && p.user) vaoTrang(p.user); else App.veDangNhap('');
  };

  return App;
})();
