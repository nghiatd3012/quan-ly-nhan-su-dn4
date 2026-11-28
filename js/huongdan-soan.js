// Soạn bài và sắp xếp mục cho thẻ Chính sách & Hướng dẫn (chỉ QL/QT; 27/11/2026).
// moBai(vung, bai|null, mucLuc, xong): xong(mucLucMoi, baiMoi, thongBao) khi lưu/xóa; xong(null) khi hủy.
window.HuongDanSoan = (function () {
  var el = UI.el;
  var MAX_ND = 45000, MAX_TEP = 20 * 1024 * 1024;
  var MAU = {
    tieude: ['### ', '', 'Tiêu đề nhỏ'], dam: ['**', '**', 'chữ đậm'], ds: ['- ', '', 'ý thứ nhất'],
    lk: ['[', '](https://)', 'chữ hiện ra'], bang: ['\n| Cột 1 | Cột 2 |\n|---|---|\n| ', ' |  |\n', 'ô 1']
  };

  // Chèn ký hiệu quanh phần đang chọn (hoặc chữ mẫu) tại vị trí con trỏ.
  function chen(ta, truoc, sau, mau) {
    var a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, giua = v.slice(a, b) || mau;
    // tiêu đề, danh sách, ảnh: bắt đầu ở dòng mới
    if ((truoc.slice(-1) === ' ' || truoc === '![') && a > 0 && v.charAt(a - 1) !== '\n') truoc = '\n' + truoc;
    ta.value = v.slice(0, a) + truoc + giua + sau + v.slice(b);
    ta.focus();
    ta.setSelectionRange(a + truoc.length, a + truoc.length + giua.length);
    ta.dispatchEvent(new Event('input'));
  }
  function docB64(file) {
    return new Promise(function (ok, loi) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).replace(/^data:[^,]*,/, '')); };
      r.onerror = function () { loi(new Error('Không đọc được file ' + file.name)); };
      r.readAsDataURL(file);
    });
  }
  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  function moBai(vung, bai, mucLuc, xong) {
    var tep = (bai && bai.tep ? bai.tep : []).slice();
    var tieuDe = el('input', { id: 'hds-tieu-de', maxlength: '200', placeholder: 'Tiêu đề bài', value: bai ? bai.tieuDe : '' });
    var muc = el('select', { id: 'hds-muc' }, (mucLuc.muc || []).slice().sort(function (a, b) { return a.thuTu - b.thuTu; }).map(function (m) {
      return el('option', { value: m.id, text: m.ten, selected: bai && bai.muc === m.id || null });
    }));
    var nd = el('textarea', { id: 'hds-nd', rows: '14', class: 'hds-nd', placeholder: 'Nội dung bài (dán bài Claude đã soạn vào đây)' });
    nd.value = bai ? bai.noiDung || '' : '';
    var dem = el('small', { class: 'hint' }), tt = el('p', { class: 'hint', id: 'hds-tt' }), loi = el('p', { class: 'loi', role: 'alert' });
    var xemTruoc = el('div', { class: 'md hds-xem', id: 'hds-xem-truoc', hidden: true });
    var dsTep = el('div', { class: 'hds-tep' });
    function capNhatDem() { dem.textContent = nd.value.length.toLocaleString('vi-VN') + ' / 45.000 ký tự'; dem.className = nd.value.length > MAX_ND ? 'loi' : 'hint'; }
    nd.addEventListener('input', capNhatDem);
    function veTep() {
      UI.xoa(dsTep);
      tep.forEach(function (t, i) {
        dsTep.appendChild(el('div', { class: 'row' }, [el('span', { text: '📎 ' + t.ten + ' (' + kb(t.kichThuoc) + ')' }),
          el('button', { type: 'button', class: 'lk-do', text: 'Bỏ', onclick: function () { tep.splice(i, 1); veTep(); } })]));
      });
    }

    // khớp HD_DUOI_TEP (Api.gs): không nhận .svg/.html vì chạy được mã trên trang
    var chonAnh = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
    var chonTep = el('input', { type: 'file', accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt', hidden: true });
    function taiLen(file, laAnh) {
      if (!file) return;
      if (file.size > MAX_TEP) { loi.textContent = 'File ' + file.name + ' quá 20 MB'; return; }
      loi.textContent = '';
      tt.textContent = 'Đang tải lên ' + file.name + '…';
      docB64(file).then(function (b64) { return Api.goi('bai.tep', { ten: file.name, b64: b64 }); }).then(function (kq) {
        tt.textContent = '';
        if (!kq.ok) { loi.textContent = kq.thongBao || 'Không tải lên được'; return; }
        if (laAnh) chen(nd, '![', '](' + kq.duongDan + ')', file.name.replace(/\.[^.]+$/, ''));
        else { tep.push({ ten: file.name, duongDan: kq.duongDan, kichThuoc: kq.kichThuoc }); veTep(); }
      }).catch(function (e) { tt.textContent = ''; loi.textContent = e.message; });
    }
    chonAnh.addEventListener('change', function () { taiLen(chonAnh.files[0], true); chonAnh.value = ''; });
    chonTep.addEventListener('change', function () { taiLen(chonTep.files[0], false); chonTep.value = ''; });

    var nut = function (k, ten, fn) { return el('button', { type: 'button', class: 'btn g nho', dataset: { chen: k }, text: ten, onclick: fn }); };
    var thanhNut = el('div', { class: 'hds-nut' }, [
      nut('tieude', 'Tiêu đề nhỏ', function () { chen.apply(null, [nd].concat(MAU.tieude)); }),
      nut('dam', 'Đậm', function () { chen.apply(null, [nd].concat(MAU.dam)); }),
      nut('ds', 'Danh sách', function () { chen.apply(null, [nd].concat(MAU.ds)); }),
      nut('lk', 'Liên kết', function () { chen.apply(null, [nd].concat(MAU.lk)); }),
      nut('bang', 'Bảng', function () { chen.apply(null, [nd].concat(MAU.bang)); }),
      nut('anh', '🖼 Chèn ảnh', function () { chonAnh.click(); }),
      nut('tep', '📎 Đính kèm file', function () { chonTep.click(); }),
      chonAnh, chonTep
    ]);

    var nutXem = el('button', { type: 'button', class: 'btn g nho', id: 'hds-xem', text: 'Xem trước' });
    nutXem.addEventListener('click', function () {
      var dangXem = !xemTruoc.hidden;
      if (!dangXem) xemTruoc.innerHTML = Markdown.sangHtml(nd.value, '');   // an toàn: sangHtml đã thoát ký tự
      xemTruoc.hidden = dangXem; nd.hidden = !dangXem; thanhNut.hidden = !dangXem;
      nutXem.textContent = dangXem ? 'Xem trước' : 'Soạn tiếp';
    });

    // Sửa bài: đánh dấu → người đã đọc (nhiệm vụ Đọc gắn bài này) phải đọc lại; không đánh dấu → chỉ nhãn "Mới cập nhật".
    var docLai = bai ? el('input', { type: 'checkbox', id: 'hds-doc-lai' }) : null;
    var oDocLai = bai ? el('label', { class: 'hds-doc-lai', for: 'hds-doc-lai' }, [docLai,
      ' Yêu cầu đọc lại (nhân viên đã bấm "Tôi đã đọc" sẽ phải đọc lại)']) : null;
    var nutLuu = el('button', { type: 'button', class: 'btn', id: 'hds-luu', text: bai ? 'Lưu thay đổi' : 'Đăng bài' });
    nutLuu.addEventListener('click', function () {
      if (!tieuDe.value.trim()) { loi.textContent = 'Chưa nhập tiêu đề'; tieuDe.focus(); return; }
      if (nd.value.length > MAX_ND) { loi.textContent = 'Nội dung quá 45.000 ký tự'; return; }
      loi.textContent = ''; nutLuu.disabled = true;
      var noiDung = nd.value;
      Api.goi('bai.luu', { id: bai ? bai.id : '', tieuDe: tieuDe.value, muc: muc.value, noiDung: noiDung, tep: tep,
        docLai: !!(docLai && docLai.checked) }).then(function (kq) {
        nutLuu.disabled = false;
        if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') loi.textContent = kq.thongBao || 'Không lưu được'; return; }
        xong(kq.mucLuc, { id: kq.bai.id, phienBan: kq.bai.phienBan, noiDung: noiDung },
          kq.canhBao || ((bai ? 'Đã lưu thay đổi.' : 'Đã đăng bài.') + ' Người khác thấy sau khoảng 1–2 phút.' +
            (kq.moLai ? ' Đã yêu cầu ' + kq.moLai + ' người đọc lại.' : '')));
      });
    });
    var lenh = [nutLuu, el('button', { type: 'button', class: 'btn g', id: 'hds-huy', text: 'Hủy', onclick: function () { xong(null); } })];
    if (bai) {
      lenh.push(el('button', { type: 'button', class: 'btn do', id: 'hds-xoa', text: 'Xóa bài', onclick: function () {
        if (!confirm('Xóa bài "' + bai.tieuDe + '"? Bài sẽ biến mất khỏi trang của mọi người.')) return;
        Api.goi('bai.xoa', { id: bai.id }).then(function (kq) {
          if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') loi.textContent = kq.thongBao || 'Không xóa được'; return; }
          xong(kq.mucLuc, null, kq.canhBao || 'Đã xóa bài.');
        });
      } }));
    }

    vung.appendChild(el('div', { class: 'card hds' }, [
      el('h3', { text: bai ? 'Sửa bài' : 'Bài mới' }),
      el('label', { for: 'hds-tieu-de', text: 'Tiêu đề' }), tieuDe,
      el('label', { for: 'hds-muc', text: 'Mục' }), muc,
      el('div', { class: 'hds-dau' }, [el('label', { for: 'hds-nd', text: 'Nội dung' }), nutXem]),
      thanhNut, nd, xemTruoc, dem, dsTep, oDocLai, tt, loi,
      el('div', { class: 'hd-lenh' }, lenh)
    ]));
    capNhatDem(); veTep();
    window.scrollTo(0, 0);
    tieuDe.focus();
  }

  function moMuc(vung, mucLuc, xong) {
    var ds = (mucLuc.muc || []).slice().sort(function (a, b) { return a.thuTu - b.thuTu; }).map(function (m) { return { id: m.id, ten: m.ten }; });
    var dem = {};
    (mucLuc.bai || []).forEach(function (b) { dem[b.muc] = (dem[b.muc] || 0) + 1; });
    var hop = el('div', { class: 'hdm-ds' }), loi = el('p', { class: 'loi', role: 'alert' });
    function ve() {
      UI.xoa(hop);
      ds.forEach(function (m, i) {
        var o = el('input', { value: m.ten, 'aria-label': 'Tên mục' });
        o.addEventListener('input', function () { m.ten = o.value; });
        hop.appendChild(el('div', { class: 'hdm-dong', dataset: { id: m.id || '' } }, [o,
          el('small', { class: 'hint', text: (dem[m.id] || 0) + ' bài' }),
          el('button', { type: 'button', class: 'btn g nho', dataset: { len: '' }, text: '↑', disabled: i === 0 || null, 'aria-label': 'Lên',
            onclick: function () { ds.splice(i - 1, 0, ds.splice(i, 1)[0]); ve(); } }),
          el('button', { type: 'button', class: 'btn g nho', dataset: { xuong: '' }, text: '↓', disabled: i === ds.length - 1 || null, 'aria-label': 'Xuống',
            onclick: function () { ds.splice(i + 1, 0, ds.splice(i, 1)[0]); ve(); } })]));
      });
    }
    var nutLuu = el('button', { type: 'button', class: 'btn', id: 'hdm-luu', text: 'Lưu' });
    nutLuu.addEventListener('click', function () {
      if (ds.some(function (m) { return !m.ten.trim(); })) { loi.textContent = 'Tên mục không được để trống'; return; }
      nutLuu.disabled = true; loi.textContent = '';
      Api.goi('muc.luu', { muc: ds }).then(function (kq) {
        nutLuu.disabled = false;
        if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') loi.textContent = kq.thongBao || 'Không lưu được'; return; }
        xong(kq.mucLuc, null, kq.canhBao || 'Đã lưu các mục.');
      });
    });
    vung.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'Sắp xếp mục' }),
      el('p', { class: 'hint', text: 'Đổi tên, dùng ↑ ↓ để xếp thứ tự. Mục chưa có bài thì nhân viên không thấy.' }),
      hop,
      el('button', { type: 'button', class: 'btn g nho', id: 'hdm-them', text: '+ Thêm mục', onclick: function () { ds.push({ ten: '' }); ve(); hop.lastChild.querySelector('input').focus(); } }),
      loi,
      el('div', { class: 'hd-lenh' }, [nutLuu, el('button', { type: 'button', class: 'btn g', text: 'Hủy', onclick: function () { xong(null); } })])
    ]));
    ve();
  }

  return { moBai: moBai, moMuc: moMuc };
})();
