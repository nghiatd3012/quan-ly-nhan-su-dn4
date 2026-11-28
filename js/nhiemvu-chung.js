// Hàm dùng chung của thẻ Nhiệm vụ (không cần DOM, kiểm thử bằng Node).
window.NVChung = (function () {
  var DUOI_ANH = /\.(jpe?g|png|heic|heif)$/i;
  var MAX_ANH = 20 * 1024 * 1024;

  function quaHanChu(n) { return n > 0 ? 'Quá hạn ' + n + ' ngày' : ''; }

  function nhanTrangThai(nv) {
    if (nv.trangThai === 'TraLai') return { chu: 'Bị trả lại: "' + (nv.loiNhan || '') + '"', lop: 'do' };
    if (nv.loai === 'doc') return { chu: 'Chưa đọc', lop: '' };
    if (nv.trangThai === 'DangLam') return { chu: 'Đang thực hiện · Đã tải ' + (nv.soAnh || 0) + ' ảnh', lop: 'cho' };
    return { chu: 'Chưa làm', lop: '' };
  }

  function laQL(quyen) { return quyen === 'QL' || quyen === 'QT'; }

  // Số hiện trên thẻ: NV = việc còn lại; QL/QT = việc của mình + lượt chờ duyệt.
  function demTren(dem, quyen) {
    if (!dem) return 0;
    return (dem.conLai || 0) + (laQL(quyen) ? (dem.choDuyet || 0) : 0);
  }

  // Thẻ mở đầu: NV còn việc → Nhiệm vụ; còn lại → KPI (như trước), không có thì thẻ đầu tiên.
  function theMoDau(dsId, quyen, dem) {
    if (!laQL(quyen) && dem && dem.conLai > 0 && dsId.indexOf('nhiemvu') >= 0) return 'nhiemvu';
    if (dsId.indexOf('kpi') >= 0) return 'kpi';
    return dsId[0] || null;
  }

  function kiemAnh(file) {
    if (!DUOI_ANH.test(file.name || '')) return '"' + file.name + '": chỉ nhận ảnh JPEG, PNG hoặc HEIC';
    if (file.size > MAX_ANH) return '"' + file.name + '": ảnh quá 20 MB';
    return null;
  }

  // Đếm một lượt tải nhiều ảnh: chỉ coi là xong khi không còn ảnh đang chờ/đang tải và không còn ảnh lỗi chưa thử lại.
  function taoLuotTai(soAnh) {
    var dangCho = soAnh, conLoi = 0, daTai = 0;
    return {
      ket: function (ok) { dangCho--; if (ok) daTai++; else conLoi++; },
      thuLai: function () { conLoi--; dangCho++; },
      xong: function () { return dangCho === 0 && conLoi === 0 && daTai > 0; },
      daTai: function () { return daTai; }
    };
  }

  return { taoLuotTai: taoLuotTai, quaHanChu: quaHanChu, nhanTrangThai: nhanTrangThai, demTren: demTren, theMoDau: theMoDau, kiemAnh: kiemAnh, laQL: laQL };
})();
