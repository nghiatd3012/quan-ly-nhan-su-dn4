// Địa chỉ Web App Apps Script (công khai được). Thêm ?api=... trên URL để trỏ sang máy chủ khác (dùng khi kiểm thử).
(function () {
  var MAC_DINH = 'https://script.google.com/macros/s/AKfycbxIFmn_FiQKOHRYm3QLamAz7v7TcOp5TsPC8HTvo1I_wGx7owKD43f--bv98japbga7/exec';
  var ghiDe = null;
  try { ghiDe = new URLSearchParams(location.search).get('api'); } catch (e) { ghiDe = null; }
  window.CONFIG = { API_URL: ghiDe || MAC_DINH };
})();
