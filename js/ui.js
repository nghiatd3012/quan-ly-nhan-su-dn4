// Tiện ích DOM, định dạng, màu. Luôn gán chữ bằng textContent để không chèn HTML từ dữ liệu.
window.UI = (function () {
  function el(tag, thuocTinh, con) {
    var e = document.createElement(tag);
    if (thuocTinh) Object.keys(thuocTinh).forEach(function (k) {
      var v = thuocTinh[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; });
      else e.setAttribute(k, v === true ? '' : v);
    });
    (con || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function xoa(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }

  // 'ok' khi ≥ 100%; 'mid' khi ≥ tiến độ thời gian; 'low' khi dưới tiến độ. p và tienDo là tỉ lệ (1 = 100%).
  function mauPhanTram(p, tienDo) {
    if (p == null || isNaN(p)) return '';
    if (p >= 1) return 'ok';
    if (p >= (tienDo == null ? 1 : tienDo)) return 'mid';
    return 'low';
  }
  function phanTram(p, soLe) {
    if (p == null || isNaN(p)) return '';
    return (p * 100).toFixed(soLe == null ? 0 : soLe).replace('.', ',') + '%';
  }

  var demTai = 0;
  function dangTai(bat) {
    demTai = Math.max(0, demTai + (bat ? 1 : -1));
    var e = $('dang-tai');
    if (e) e.hidden = demTai === 0;
  }

  var TEN_QUYEN = { NV: 'Nhân viên', QL: 'Quản lý', QT: 'Quản trị' };

  // Khớp TRUONG_KHOA / TRUONG_SUA trong apps-script/Logic.gs.
  var TRUONG_KHOA = ['MaNV', 'HoTen', 'ChucVu', 'NoiLamViec', 'NgayVao', 'Quyen'];
  var TRUONG_SUA = ['NgaySinh', 'GioiTinh', 'SDT', 'Email', 'DiaChi', 'CCCD', 'SoTaiKhoan', 'DoanVien', 'GhiChu',
  'MST', 'NganHang', 'MaC2C', 'MaCH', 'MaCHCu', 'UserDauNoi', 'SoEZ', 'DiaBan',   // 8 trường chuyển từ trang nhân sự cũ (26/11/2026)
  'UserMplus2'];
  // Hồ sơ: các trường NV tự sửa nhưng hiện ở mục công việc; các trường ẩn (vẫn giữ trong Sheet) (26/11/2026)
  var TRUONG_CONG_VIEC = ['Email', 'MaC2C', 'MaCH', 'UserDauNoi', 'UserMplus2'];
  var TRUONG_AN = ['Quyen', 'DoanVien', 'GhiChu', 'SoEZ'];
  var TEN_TRUONG = {
    MaNV: 'Mã NV', HoTen: 'Họ tên', ChucVu: 'Chức vụ', NoiLamViec: 'Nơi làm việc', NgayVao: 'Ngày vào làm', Quyen: 'Quyền',
    NgaySinh: 'Ngày sinh', GioiTinh: 'Giới tính', SDT: 'Số điện thoại', Email: 'Email', DiaChi: 'Địa chỉ',
    CCCD: 'Số CCCD', SoTaiKhoan: 'Số tài khoản', DoanVien: 'Đoàn viên', GhiChu: 'Ghi chú',
    MST: 'Mã số thuế cá nhân', NganHang: 'Ngân hàng', MaC2C: 'Mã C2C', MaCH: 'Mã cửa hàng', MaCHCu: 'Mã cửa hàng cũ',
    UserDauNoi: 'User đấu nối', SoEZ: 'Số EZ', DiaBan: 'Địa bàn phụ trách', UserMplus2: 'User Mplus2'
  };

  // Chuỗi ISO → "dd/mm/yyyy HH:MM" giờ máy.
  function ngayGio(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    function h2(n) { return (n < 10 ? '0' : '') + n; }
    return h2(d.getDate()) + '/' + h2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + h2(d.getHours()) + ':' + h2(d.getMinutes());
  }

  // Dòng "nhãn — giá trị" như bản mẫu.
  function dong(nhan, giaTri, thuocTinh) {
    var b = el('b', null, [giaTri == null ? '' : giaTri]);
    return el('div', Object.assign({ class: 'row' }, thuocTinh || {}), [el('span', { text: nhan }), b]);
  }

  // Nạp thư viện ngoài khi cần: thử lần lượt từng địa chỉ (cdnjs trước, bản trong vendor/ sau). Trả Promise<url đã dùng>.
  var dangNap = {};
  function napThuVien(tenBien, dsUrl) {
    if (window[tenBien]) return Promise.resolve(dangNap[tenBien + ':url'] || '');
    if (dangNap[tenBien]) return dangNap[tenBien];
    var p = dsUrl.reduce(function (truoc, url) {
      return truoc.catch(function () {
        return new Promise(function (ok, loi) {
          var s = document.createElement('script');
          s.src = url;
          s.onload = function () { if (window[tenBien]) { dangNap[tenBien + ':url'] = url; ok(url); } else loi(new Error('thiếu ' + tenBien)); };
          s.onerror = function () { s.remove(); loi(new Error('Không tải được thư viện ' + tenBien + '. Kiểm tra kết nối mạng.')); };
          document.head.appendChild(s);
        });
      });
    }, Promise.reject(new Error('')));
    dangNap[tenBien] = p;
    p.catch(function () { dangNap[tenBien] = null; });
    return p;
  }

  // Tải một Blob về máy với tên file cho trước.
  function luuFile(ten, blob) {
    var a = el('a', { href: URL.createObjectURL(blob), download: ten });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
  }

  return { napThuVien: napThuVien, luuFile: luuFile, el: el, $: $, xoa: xoa, mauPhanTram: mauPhanTram, phanTram: phanTram, dangTai: dangTai, TEN_QUYEN: TEN_QUYEN,
    TRUONG_KHOA: TRUONG_KHOA, TRUONG_SUA: TRUONG_SUA, TRUONG_CONG_VIEC: TRUONG_CONG_VIEC, TRUONG_AN: TRUONG_AN, TEN_TRUONG: TEN_TRUONG, ngayGio: ngayGio, dong: dong };
})();
