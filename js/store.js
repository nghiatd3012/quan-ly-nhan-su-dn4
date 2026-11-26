/* Dữ liệu gốc đã nạp (trạng thái): gộp file mới theo đúng quy tắc của bao-cao-ptm (app.js saveParsed),
 * chuyển sang "store" cho Core, sao lưu/khôi phục, nén để lưu lên Drive.
 * Hàm thuần: nhận trạng thái cũ, trả trạng thái mới (không sửa đối tượng đầu vào).
 */
(function (root) {
  'use strict';
  const C = root.Core;
  const p2 = n => String(n).padStart(2, '0');
  const fmtN = n => n == null ? '–' : Math.round(n).toLocaleString('vi-VN');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const APP = 'baocao-ptm-vung4';

  function taoMoi() { return { data: {} }; }
  function sao(tt) { return { data: Object.assign({}, tt.data) }; }

  function chuyenStore(tt) {
    const s = { na: [], fiber: [], c2c: [], ds: null, kpiv: [], kpinv: [], dc: null };
    for (const [k, v] of Object.entries(tt.data)) {
      if (k.startsWith('na:')) s.na.push(v);
      else if (k.startsWith('c2c:')) s.c2c.push(v);
      else if (k.startsWith('fiber:')) s.fiber.push(v);
      else if (k.startsWith('kpiv:')) s.kpiv.push(v);
      else if (k.startsWith('kpinv:')) s.kpinv.push(v);
      else if (k === 'ds') s.ds = v;
      else if (k === 'dc') s.dc = v;
    }
    return s;
  }

  function latestYearWith(s, thang) {
    const ys = s.na.filter(e => e.thang === thang).map(e => e.nam);
    return ys.length ? Math.max(...ys) : 0;
  }

  // Trả {tt, thongBao: {loai: 'ok'|'warn'|'err', html}}
  function gop(ttCu, f, p) {
    const tt = sao(ttCu), d = tt.data;
    const base = { name: f.name, importedAt: Date.now(), fileTime: f.lastModified || Date.now() };
    const ten = `<b>${esc(f.name)}</b>`;
    const s = chuyenStore(ttCu);
    const tb = (loai, html) => ({ tt, thongBao: { loai, html } });
    const giu = (loai, html) => ({ tt: ttCu, thongBao: { loai, html } });

    if (p.kind === 'na') {
      const by = new Map();
      for (const r of p.recs) { const k = C.yOf(r[1]) * 100 + C.mOf(r[1]); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
      if (!by.size) return giu('warn', `${ten}: file NEW_ACTIVE không có dòng nào được tính.`);
      const main = [...by].sort((a, b) => b[1].length - a[1].length)[0][0];
      const msgs = [];
      for (const [k, recs] of by) {
        const nam = Math.floor(k / 100), thang = k % 100, key = `na:${nam}-${p2(thang)}`;
        const old = d[key];
        if (k === main || !old) {
          d[key] = Object.assign({}, base, { kind: 'na', nam, thang, recs, total: k === main ? p.total : recs.length });
          msgs.push(`T${p2(thang)}/${nam}: ${fmtN(recs.length)} TB được tính` + (old && k === main ? ` (thay file cũ ${esc(old.name)})` : ''));
        } else {
          const seen = new Set(old.recs.map(r => r[0] + '|' + r[1]));
          const add = recs.filter(r => !seen.has(r[0] + '|' + r[1]));
          d[key] = Object.assign({}, old, { recs: old.recs.concat(add) });
          msgs.push(`T${p2(thang)}/${nam}: bổ sung ${fmtN(add.length)} TB vào dữ liệu đã có`);
        }
      }
      return tb('ok', `${ten} → NEW_ACTIVE. ${msgs.join('; ')}.`);
    }
    if (p.kind === 'fiber') {
      const removed = [];
      for (const e of s.fiber) {
        if (e.from >= p.from && e.to <= p.to) { removed.push(e.name); delete d[`fiber:${e.from}-${e.to}`]; }
      }
      d[`fiber:${p.from}-${p.to}`] = Object.assign({}, base, { kind: 'fiber', from: p.from, to: p.to, recs: p.recs });
      return tb('ok', `${ten} → Fiber kỳ ${C.fmtD(p.from)} – ${C.fmtD(p.to)} (${fmtN(p.recs.length)} HĐ)` +
        (removed.length ? `; thay ${removed.map(esc).join(', ')}` : '') + '.');
    }
    if (p.kind === 'c2c') {
      if (!p.recs.length) return giu('warn', `${ten}: file C2C không có giao dịch nào.`);
      const removed = [];
      for (const e of s.c2c) {
        if (e.from >= p.from && e.to <= p.to) { removed.push(e.name); delete d[`c2c:${e.from}-${e.to}`]; }
      }
      d[`c2c:${p.from}-${p.to}`] = Object.assign({}, base, { kind: 'c2c', from: p.from, to: p.to, recs: p.recs });
      return tb('ok', `${ten} → Giao dịch C2C kỳ ${C.fmtD(p.from)} – ${C.fmtD(p.to)} (${fmtN(p.recs.length)} GD)` +
        (removed.length ? `; thay ${removed.map(esc).join(', ')}` : '') + '.');
    }
    if (p.kind === 'ds') {
      d.ds = Object.assign({}, base, { kind: 'ds', nv: p.nv });
      return tb('ok', `${ten} → Danh sách NV (${p.nv.length} mã).`);
    }
    if (p.kind === 'kpiv') {
      d[`kpiv:${p.nam}`] = Object.assign({}, base, { kind: 'kpiv', nam: p.nam, kpi: p.kpi });
      const ms = p.kpi.MBF.map((v, i) => v != null ? 'T' + (i + 1) : '').filter(Boolean);
      return tb('ok', `${ten} → KPI Vùng 4 năm ${p.nam} (có KH ${ms.length ? ms[0] + '–' + ms[ms.length - 1] : 'không tháng nào'}).`);
    }
    if (p.kind === 'kpinv') {
      if (!p.thang) return giu('err', `${ten}: file KPI NV không rõ tháng. Đặt tên dạng "KPI NV T11.xlsx" hoặc sheet "CT T11".`);
      const nam = p.nam || latestYearWith(s, p.thang) || new Date().getFullYear();
      d[`kpinv:${nam}-${p2(p.thang)}`] = Object.assign({}, base, { kind: 'kpinv', nam, thang: p.thang, nv: p.nv, gia: p.gia, cats: p.cats });
      const miss = ['C2C', 'MBF', 'KPP', 'THGT', 'DT', 'WIFI', 'FIBER'].filter(k => !(p.cats || []).includes(k));
      const soGoi = Object.keys(p.gia || {}).length;
      return tb(miss.length ? 'warn' : 'ok', `${ten} → KPI NV tháng ${p2(p.thang)}/${nam} (${p.nv.length} NV, bảng giá ${soGoi} gói)` +
        (miss.length ? `. Không thấy cột chỉ tiêu: ${miss.join(', ')}` : '') + (soGoi ? '' : '. Thiếu sheet "Mã gói cước data"') + '.');
    }
    if (p.kind === 'dc') {
      d.dc = Object.assign({}, base, { kind: 'dc', list: p.list });
      return tb('ok', `${ten} → Điều chỉnh KPI NV (${p.list.length} dòng).`);
    }
    return giu('warn', `${ten}: bỏ qua. ${esc(p.reason || '')}`);
  }

  function xoa(ttCu, key) { const tt = sao(ttCu); delete tt.data[key]; return tt; }

  function datDieuChinh(ttCu, list) {
    const tt = sao(ttCu);
    const cu = tt.data.dc || { name: 'Nhập trên trang', importedAt: Date.now(), kind: 'dc' };
    tt.data.dc = Object.assign({}, cu, { kind: 'dc', list: list.slice() });
    return tt;
  }

  function tuSaoLuu(obj) {
    if (!obj || obj.app !== APP || !obj.data) throw new Error('không phải file sao lưu của công cụ Báo cáo PTM');
    return { data: Object.assign({}, obj.data) };
  }
  function thanhSaoLuu(tt) { return { app: APP, version: 1, savedAt: new Date().toISOString(), data: tt.data }; }

  function cacThangCoDuLieu(tt) {
    const s = chuyenStore(tt), m = new Map();
    for (const e of s.na.concat(s.kpinv)) m.set(e.nam * 100 + e.thang, { nam: e.nam, thang: e.thang });
    return [...m.keys()].sort((a, b) => a - b).map(k => m.get(k));
  }

  // ===== Nén gzip + base64 (trình duyệt và Node 18+ đều có CompressionStream) =====
  function base64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function tuBase64(b64) {
    const s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  async function nen(tt) {
    const stream = new Blob([JSON.stringify(tt)]).stream().pipeThrough(new CompressionStream('gzip'));
    return base64(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  async function giaiNen(b64) {
    const stream = new Blob([tuBase64(b64)]).stream().pipeThrough(new DecompressionStream('gzip'));
    const tt = JSON.parse(await new Response(stream).text());
    if (!tt || typeof tt.data !== 'object') throw new Error('Dữ liệu gốc trên Drive bị hỏng');
    return tt;
  }

  root.Store = { taoMoi, gop, xoa, datDieuChinh, chuyenStore, tuSaoLuu, thanhSaoLuu, cacThangCoDuLieu, nen, giaiNen };
})(typeof window !== 'undefined' ? window : globalThis);
