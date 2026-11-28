// Thẻ Nhiệm vụ (28/11/2026). NV: "Nhiệm vụ của tôi" — tải ảnh (ảnh gốc, lần lượt từng ảnh), đọc bài + "Tôi đã đọc".
// QL/QT: thêm tab con Duyệt / Đã giao (nhiemvu-quanly.js, NhiemVuQL). Ảnh NV xem qua Apps Script (nv.anhXem), không công khai.
window.NhiemVu = (function () {
  var el = UI.el, N = NVChung;
  var S = { vung: null, tb: '' };
  var nhoDaTai = {};   // id ảnh → data URL ảnh nhỏ (giữ trong phiên trang)

  App.dangKyThe({ id: 'nhiemvu', ten: 'Nhiệm vụ', quyenToiThieu: 'NV', ve: ve });

  function quyen() { return App.nguoiDung && App.nguoiDung.quyen; }

  function ve(vung) {
    S.vung = vung;
    if (N.laQL(quyen()) && window.NhiemVuQL) NhiemVuQL.veTab(vung); else veCuaToi(vung);
  }

  function ngayHan(han) { var p = String(han || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  // ===== Ảnh nhỏ / ảnh lớn (dùng chung với màn Duyệt) =====
  // dsAnh: [{id, img}] — gọi nv.anhXem gộp tối đa 30 ảnh/lần; ảnh Drive chưa tạo xong ảnh nhỏ thì để ô chữ.
  function napAnhNho(dsAnh) {
    var can = dsAnh.filter(function (x) {
      if (nhoDaTai[x.id]) { x.img.src = nhoDaTai[x.id]; return false; }
      return true;
    });
    for (var i = 0; i < can.length; i += 30) (function (lo) {
      Api.goi('nv.anhXem', { ids: lo.map(function (x) { return x.id; }), co: 'nho' }, true).then(function (kq) {
        if (!kq.ok) { lo.forEach(function (x) { x.img.parentNode.classList.add('nv-chua-nho'); }); return; }
        kq.anh.forEach(function (a) {
          var x = lo.filter(function (y) { return y.id === a.id; })[0];
          if (!x) return;
          if (a.b64) { nhoDaTai[a.id] = 'data:' + a.mime + ';base64,' + a.b64; x.img.src = nhoDaTai[a.id]; }
          else x.img.parentNode.classList.add('nv-chua-nho');
        });
      });
    })(can.slice(i, i + 30));
  }
  function oAnh(a, them) {
    var img = el('img', { alt: a.ten, loading: 'lazy' });
    var o = el('div', { class: 'nv-o', title: a.ten }, [img, el('span', { class: 'nv-o-chu', text: 'Chưa có ảnh xem trước – chạm để xem ảnh gốc' })].concat(them || []));
    // bấm cả ô (kể cả khi Drive chưa có ảnh nhỏ, vd. HEIC); nút ✕ xóa ảnh không mở ảnh
    o.addEventListener('click', function (ev) { if (!ev.target.closest('button')) xemAnhGoc(a); });
    return { o: o, img: img };
  }
  function lopPhu(noiDung) {
    var phu = el('div', { class: 'nv-phu', role: 'dialog' }, [
      el('button', { type: 'button', class: 'btn g nho nv-phu-dong', text: '✕ Đóng', onclick: function () { phu.remove(); } }), noiDung]);
    phu.addEventListener('click', function (ev) { if (ev.target === phu) phu.remove(); });
    document.body.appendChild(phu);
    return phu;
  }
  function xemLon(src) { lopPhu(el('img', { src: src, alt: '' })); }
  function xemAnhGoc(a) {
    var khung = el('div', { class: 'nv-phu-nd' }, [el('p', { class: 'hint', text: 'Đang tải ảnh gốc…' })]);
    lopPhu(khung);
    Api.goi('nv.anhXem', { ids: [a.id], co: 'goc' }, true).then(function (kq) {
      UI.xoa(khung);
      if (!kq.ok || !kq.anh[0].b64) { khung.appendChild(el('p', { class: 'loi-the', text: kq.thongBao || 'Không tải được ảnh' })); return; }
      var x = kq.anh[0], url = 'data:' + x.mime + ';base64,' + x.b64;
      // HEIC: đa số trình duyệt (trừ Safari) không hiện được → vẫn cho tải về
      khung.appendChild(el('img', { src: url, alt: a.ten }));
      khung.appendChild(el('a', { class: 'btn g nho', href: url, download: a.ten, text: '⬇ Tải ảnh gốc' }));
    });
  }

  // ===== Nhiệm vụ của tôi =====
  function veCuaToi(vung) {
    S.vung = vung;
    UI.xoa(vung).appendChild(el('div', { class: 'card' }, [el('p', { class: 'hint', text: 'Đang tải nhiệm vụ…' })]));
    Api.goi('nv.cuaToi', null, true).then(function (kq) {
      if (!App.conHieuLuc() || S.vung !== vung) return;
      UI.xoa(vung);
      if (!kq.ok) { vung.appendChild(el('div', { class: 'card' }, [el('p', { class: 'loi-the', text: kq.thongBao })])); return; }
      App.capNhatDemNv(kq.dem);
      if (S.tb) { vung.appendChild(el('div', { class: 'card hd-tb', role: 'status', text: '✅ ' + S.tb })); S.tb = ''; }
      if (!kq.nhiemVu.length) {
        vung.appendChild(el('div', { class: 'card nv-xong' }, [el('p', { text: 'Bạn đã làm xong tất cả nhiệm vụ 👍' })]));
        return;
      }
      var anhCanNap = [];
      kq.nhiemVu.forEach(function (nv) { vung.appendChild(theViec(nv, anhCanNap)); });
      napAnhNho(anhCanNap);
    });
  }

  function theViec(nv, anhCanNap) {
    var tt = N.nhanTrangThai(nv), qh = N.quaHanChu(nv.quaHan);
    var phu = [];
    if (nv.han) phu.push(el('span', { class: qh ? 'nv-qh' : '', text: 'Hạn ' + ngayHan(nv.han) + (qh ? ' · ' + qh : '') }));
    phu.push(el('span', { text: 'Giao bởi ' + (nv.tenNguoiGiao || nv.nguoiGiao) }));
    var the = el('div', { class: 'card nv-viec', dataset: { id: nv.id } }, [
      el('h3', { text: nv.tieuDe }),
      el('div', { class: 'nv-phu-dong-chu' }, phu),
      el('div', { class: 'nv-tt ' + tt.lop, text: tt.chu })
    ]);
    if (nv.noiDung) the.appendChild(el('p', { class: 'nv-mo-ta', text: nv.noiDung }));
    if ((nv.anhMau || []).length) {
      the.appendChild(el('div', { class: 'nv-luoi nv-mau' }, nv.anhMau.map(function (src) {
        return el('div', { class: 'nv-o' }, [el('img', { src: src, alt: 'Ảnh mẫu', loading: 'lazy', onclick: function () { xemLon(src); } })]);
      })));
    }
    if (nv.loai === 'doc') {
      the.appendChild(el('div', { class: 'hd-lenh' }, [el('button', { type: 'button', class: 'btn', text: '→ Đọc bài' + (nv.tieuDeBai ? ': ' + nv.tieuDeBai : ''),
        onclick: function () { docBai(nv); } })]));
      return the;
    }
    if (nv.anh.length) {
      the.appendChild(el('div', { class: 'nv-luoi' }, nv.anh.map(function (a) {
        var x = oAnh(a, [el('button', { type: 'button', class: 'nv-xoa-anh', title: 'Xóa ảnh', text: '✕', onclick: function () { xoaAnh(a); } })]);
        anhCanNap.push({ id: a.id, img: x.img });
        return x.o;
      })));
    }
    var chon = el('input', { type: 'file', accept: 'image/*,.heic,.heif', multiple: true, hidden: true });
    var tienTrinh = el('div', { class: 'nv-tien-trinh' });
    chon.addEventListener('change', function () { taiNhieu(nv, Array.prototype.slice.call(chon.files), tienTrinh); chon.value = ''; });
    var chu = nv.trangThai === 'TraLai' ? 'Tải ảnh lại' : nv.anh.length ? 'Tải thêm ảnh' : 'Tải ảnh lên';
    the.appendChild(el('div', { class: 'hd-lenh' }, [el('button', { type: 'button', class: 'btn', text: '📷 ' + chu, onclick: function () { chon.click(); } }), chon]));
    the.appendChild(tienTrinh);
    return the;
  }

  function docB64(file) {
    return new Promise(function (ok, loi) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).replace(/^data:[^,]*,/, '')); };
      r.onerror = function () { loi(new Error('Không đọc được file')); };
      r.readAsDataURL(file);
    });
  }

  // Tải lần lượt từng ảnh; ảnh lỗi có nút "Thử lại" riêng. Hết ảnh đang chờ/lỗi thì tải lại danh sách.
  function taiNhieu(nv, files, khu) {
    UI.xoa(khu);
    var hopLe = [], boQua = [];
    files.forEach(function (f) {
      var loi = N.kiemAnh(f);
      if (loi) { boQua.push(loi); khu.appendChild(el('div', { class: 'nv-dong loi-the', text: loi })); } else hopLe.push(f);
    });
    if (!hopLe.length) return;
    var dong = hopLe.map(function (f) { var d = el('div', { class: 'nv-dong', text: '⏳ Chờ tải — ' + f.name }); khu.appendChild(d); return d; });
    var luot = N.taoLuotTai(hopLe.length);
    function mot(i) {
      var f = hopLe[i], d = dong[i];
      d.className = 'nv-dong'; UI.xoa(d).textContent = '⬆ Đang tải ' + (i + 1) + '/' + hopLe.length + ' — ' + f.name;
      return docB64(f).then(function (b64) {
        return Api.goi('nv.anhTai', { nvId: nv.id, ten: f.name, b64: b64 }, true);
      }, function (e) { return { ok: false, thongBao: e.message }; }).then(function (kq) {
        luot.ket(!!kq.ok);
        if (kq.ok) { d.textContent = '✔ Đã tải — ' + f.name; return true; }
        d.className = 'nv-dong loi-the';
        UI.xoa(d).appendChild(document.createTextNode('✖ ' + f.name + ': ' + (kq.thongBao || 'Lỗi') + ' '));
        d.appendChild(el('button', { type: 'button', class: 'btn g nho', text: 'Thử lại', onclick: function () {
          luot.thuLai(); mot(i).then(xongMot);
        } }));
        return false;
      });
    }
    function xongMot() {
      if (!luot.xong()) return;
      S.tb = 'Đã tải ' + luot.daTai() + ' ảnh, đang chờ duyệt.' + (boQua.length ? ' Không tải: ' + boQua.join('; ') : '');
      veCuaToi(S.vung);
    }
    hopLe.reduce(function (p, f, i) { return p.then(function () { return mot(i); }); }, Promise.resolve()).then(xongMot);
  }

  function xoaAnh(a) {
    if (!confirm('Xóa ảnh "' + a.ten + '"?')) return;
    Api.goi('nv.anhXoa', { anhId: a.id }).then(function (kq) {
      if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') alert(kq.thongBao || 'Không xóa được'); return; }
      delete nhoDaTai[a.id];
      veCuaToi(S.vung);
    });
  }

  function docBai(nv) {
    var vung = S.vung;
    HuongDan.moBaiId(vung, nv.idBai, {
      quayLai: function () { veCuaToi(vung); },
      daDoc: function (nut) {
        nut.disabled = true;
        Api.goi('nv.daDoc', { idBai: nv.idBai }).then(function (kq) {
          nut.disabled = false;
          if (!kq.ok) { if (kq.loi !== 'HET_PHIEN') alert(kq.thongBao || 'Không ghi nhận được'); return; }
          App.capNhatDemNv(kq.dem);
          S.tb = 'Đã ghi nhận bạn đọc bài "' + (nv.tieuDeBai || nv.tieuDe) + '".';
          veCuaToi(vung);
        });
      }
    });
  }

  return { taiLai: function () { if (S.vung) ve(S.vung); }, veCuaToi: veCuaToi, napAnhNho: napAnhNho, oAnh: oAnh, xemLon: xemLon, ngayHan: ngayHan };
})();
