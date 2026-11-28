// Hàm thuần (không dùng DOM) của thẻ Chính sách & Hướng dẫn: bỏ dấu, tìm bài, nhãn "Mới", chọn mục lục mới hơn.
window.HDChung = (function () {
  var BAY_NGAY = 7 * 24 * 3600 * 1000;

  function boDau(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function moc(iso) { var t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; }

  // Mục lục tải từ GitHub có thể cũ hơn bản người dùng vừa lưu (Pages trễ 1–2 phút): lấy bản có capNhat mới hơn.
  function chonMoiHon(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return moc(b.capNhat) > moc(a.capNhat) ? b : a;
  }

  // Mọi từ trong q phải có trong tiêu đề + nội dung (không dấu); bài khớp ở tiêu đề xếp trước.
  function timBai(mucLuc, q) {
    var tu = boDau(q).split(' ').filter(Boolean);
    if (!tu.length) return [];
    var trongTieuDe = [], trongNoiDung = [];
    ((mucLuc && mucLuc.bai) || []).forEach(function (b) {
      var td = boDau(b.tieuDe), tat = td + ' ' + boDau(b.chu);
      if (!tu.every(function (t) { return tat.indexOf(t) >= 0; })) return;
      (tu.every(function (t) { return td.indexOf(t) >= 0; }) ? trongTieuDe : trongNoiDung).push(b);
    });
    return trongTieuDe.concat(trongNoiDung);
  }

  function laMoi(bai, now) {
    var dang = moc(bai.lucDang), sua = moc(bai.lucSua);
    if (sua && sua !== dang && now - sua < BAY_NGAY) return 'Mới cập nhật';
    if (dang && now - dang < BAY_NGAY) return 'Mới';
    return '';
  }

  // Các mục theo thứ tự, mỗi mục kèm bài mới nhất trước; NV (laQL=false) không thấy mục chưa có bài.
  function mucHien(mucLuc, laQL) {
    var bai = (mucLuc && mucLuc.bai) || [];
    return ((mucLuc && mucLuc.muc) || []).slice().sort(function (a, b) { return (a.thuTu || 0) - (b.thuTu || 0); })
      .map(function (m) {
        return { muc: m, bai: bai.filter(function (b) { return b.muc === m.id; })
          .sort(function (x, y) { return Math.max(moc(y.lucDang), moc(y.lucSua)) - Math.max(moc(x.lucDang), moc(x.lucSua)); }) };
      })
      .filter(function (x) { return laQL || x.bai.length; });
  }

  return { boDau: boDau, chonMoiHon: chonMoiHon, timBai: timBai, laMoi: laMoi, mucHien: mucHien };
})();
