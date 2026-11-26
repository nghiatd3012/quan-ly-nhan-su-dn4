// Thẻ Duyệt yêu cầu (chỉ Quản trị): danh sách chờ duyệt theo nhân viên, duyệt/từ chối từng trường hoặc cả nhóm.
(function () {
  var el = UI.el;

  App.dangKyThe({ id: 'duyet', ten: 'Duyệt yêu cầu', quyenToiThieu: 'QT', ve: ve, capNhatDem: capNhatDem });

  function capNhatDem() {
    Api.goi('duyet.list').then(function (kq) { if (kq.ok) App.datDem('duyet', kq.yeuCau.length); });
  }

  function ve(vung) {
    var the = el('div', { class: 'card', id: 'duyet-ds' }, [el('h3', { text: 'Yêu cầu chờ duyệt' })]);
    var ds = el('div');
    the.appendChild(ds);
    vung.appendChild(the);
    tai(ds);
  }

  function tai(ds) {
    Api.goi('duyet.list').then(function (kq) {
      if (!App.conHieuLuc()) return;
      UI.xoa(ds);
      if (!kq.ok) {
        if (kq.loi !== 'HET_PHIEN') ds.appendChild(el('p', { class: 'loi-the', text: kq.thongBao || 'Không tải được danh sách' }));
        return;
      }
      App.datDem('duyet', kq.yeuCau.length);
      if (!kq.yeuCau.length) { ds.appendChild(el('p', { class: 'hint', text: 'Không có yêu cầu nào đang chờ duyệt.' })); return; }
      // nhóm theo nhân viên, nhóm gửi sớm nhất lên trước
      var nhom = {}, thuTu = [];
      kq.yeuCau.slice().sort(function (a, b) { return String(a.GuiLuc).localeCompare(String(b.GuiLuc)); }).forEach(function (y) {
        if (!nhom[y.MaNV]) { nhom[y.MaNV] = []; thuTu.push(y.MaNV); }
        nhom[y.MaNV].push(y);
      });
      thuTu.forEach(function (ma) { ds.appendChild(veNhom(ds, ma, nhom[ma])); });
    });
  }

  function veNhom(ds, ma, ycs) {
    var cuoi = ycs[ycs.length - 1];
    var hop = el('div', { class: 'req', dataset: { ma: ma } }, [
      el('b', { text: cuoi.HoTen || ma }), el('span', { class: 'hint', text: ' · ' + ma + ' · ' + UI.ngayGio(cuoi.GuiLuc) })
    ]);
    var tuChoi = el('div', { class: 'tu-choi', hidden: true });
    var nut = [];
    function khoa(b) { nut.forEach(function (n) { n.disabled = b; }); }
    function xuLy(ids, duyet, lyDo) {
      khoa(true);
      Api.goi('duyet.xuLy', { ids: ids, duyet: duyet, lyDo: lyDo || '' }).then(function (kq) {
        if (kq.loi === 'HET_PHIEN') return;
        if (!kq.ok) { khoa(false); window.alert(kq.thongBao || 'Không xử lý được'); return; }
        tai(ds);
      });
    }
    function moTuChoi(ids, nhan) {
      UI.xoa(tuChoi);
      var lyDo = el('input', { class: 'ly-do', placeholder: 'Lý do từ chối (không bắt buộc)', maxlength: '200' });
      var xn = el('button', { type: 'button', class: 'btn do nho nut-xac-nhan-tu-choi', text: 'Xác nhận từ chối',
        onclick: function () { xuLy(ids, false, lyDo.value.trim()); } });
      nut.push(xn);
      tuChoi.appendChild(el('label', { text: nhan, style: 'margin-top:0' }));
      tuChoi.appendChild(lyDo);
      tuChoi.appendChild(el('div', { class: 'nhom-nut' }, [xn,
        el('button', { type: 'button', class: 'btn g nho', text: 'Thôi', onclick: function () { tuChoi.hidden = true; } })]));
      tuChoi.hidden = false;
      lyDo.focus();
    }

    ycs.forEach(function (y) {
      var ten = UI.TEN_TRUONG[y.Truong] || y.Truong;
      var d = el('button', { type: 'button', class: 'btn xanh nho nut-duyet', text: '✔ Duyệt', onclick: function () { xuLy([y.Id], true); } });
      var tc = el('button', { type: 'button', class: 'btn do nho nut-tu-choi', text: '✖ Từ chối', onclick: function () { moTuChoi([y.Id], 'Từ chối: ' + ten); } });
      nut.push(d, tc);
      hop.appendChild(el('div', { class: 'row sua', dataset: { id: y.Id } }, [
        el('span', { text: ten }),
        el('b', null, [el('span', { class: 'old', text: y.Cu || 'trống' }), ' → ', y.Moi || '(để trống)']),
        el('div', { class: 'nhom-nut', style: 'margin-top:4px' }, [d, tc])
      ]));
    });

    var ids = ycs.map(function (y) { return y.Id; });
    var het = el('button', { type: 'button', class: 'btn xanh nut-duyet-het', text: '✔ Duyệt tất cả của NV này', onclick: function () { xuLy(ids, true); } });
    var tcHet = el('button', { type: 'button', class: 'btn do nut-tu-choi-het', text: '✖ Từ chối tất cả',
      onclick: function () { moTuChoi(ids, 'Từ chối tất cả ' + ids.length + ' yêu cầu của ' + (cuoi.HoTen || ma)); } });
    nut.push(het, tcHet);
    hop.appendChild(el('div', { class: 'nhom-nut' }, [het, tcHet]));
    hop.appendChild(tuChoi);
    return hop;
  }
})();
