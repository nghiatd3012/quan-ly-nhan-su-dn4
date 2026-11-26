/* Lõi xử lý số liệu Báo cáo PTM Vùng 4 (DN4). Chép từ bao-cao-ptm/src/core.js; từ đây chỉ sửa ở bản này.
 * Chạy hoàn toàn trên trình duyệt (cần thư viện SheetJS: biến toàn cục XLSX).
 * Quy tắc tính giữ đúng HUONG_DAN.md (mục 2 và 3b) của hệ thống PowerShell cũ.
 */
(function (root) {
  'use strict';

  // ===== Hằng số quy tắc (đổi tại đây nếu quy tắc thay đổi) =====
  const LY_DO_HM = ['MS', 'DNTD', 'RESET', 'MNP'];          // Lý do HM được tính
  const LOAI_SAYMEE = ['SME', 'MEE'];                       // Loại TB tính là Saymee / THGT
  const LOAI_WIFI = ['FWD'];                                // Loại TB tính là MobiWifi 5G
  const FIBER_HUY_DUOC_TINH = ['1C KHYC', '1C NO CUOC'];    // HĐ "Đã hủy" vẫn tính khi chặn cắt chứa cụm này (đã bỏ dấu)
  const GIA_GOI_TOI_THIEU = 100000;                         // KPI NV: giá gói tháng >= 100.000đ
  // Chấm điểm nhóm NVBH (giống BaoCao_KPI_NV.ps1, người dùng quy định 20/11/2026): điểm CT = min(%HT,120%) × tỷ trọng,
  // CT6 = Wifi + Fiber gộp (tỷ trọng cột Wifi), CT7 (chỉ tiêu Vùng giao) tính đạt 100% × 10%.
  const NVBH_NHOM = 'NVBH', DIEM_TRAN = 1.2, CT7_TY_TRONG = 0.1;
  const LECH_GIO_C2C = 7;                                   // giờ trong file C2C là UTC

  // ===== Tiện ích chuỗi =====
  const str = v => (v == null ? '' : String(v));
  const clean = v => str(v).normalize('NFC').replace(/\s+/g, ' ').trim();
  const up = v => clean(v).toUpperCase();
  // bỏ dấu tiếng Việt + viết hoa: dùng để so khớp tiêu đề / tình trạng
  const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();

  // ===== Ngày: lưu dạng số nguyên yyyymmdd =====
  const ymd = (y, m, d) => y * 10000 + m * 100 + d;
  const yOf = n => Math.floor(n / 10000), mOf = n => Math.floor(n / 100) % 100, dOf = n => n % 100;
  const daysIn = (y, m) => new Date(y, m, 0).getDate();
  const fmtD = n => n ? `${String(dOf(n)).padStart(2, '0')}/${String(mOf(n)).padStart(2, '0')}/${yOf(n)}` : '';
  function toDate(v) {
    if (v == null || v === '') return 0;
    if (v instanceof Date) {
      if (isNaN(v)) return 0;
      // SheetJS có thể trả ngày lệch vài giây do làm tròn số thực: cộng 1 phút trước khi lấy ngày
      const t = new Date(v.getTime() + 60000);
      return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
    }
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) {           // số serial Excel
        const t = new Date(Math.round((v - 25569) * 86400000) + 60000);
        return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
      }
      return 0;
    }
    const s = clean(v);
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      let d = +m[1], mo = +m[2];
      if (mo > 12 && d <= 12) [d, mo] = [mo, d];   // phòng trường hợp ghi kiểu tháng/ngày
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return ymd(+m[3], mo, d);
      return 0;
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return ymd(+m[1], +m[2], +m[3]);
    return 0;
  }
  function toNum(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = clean(v).replace(/[đ₫\s]/gi, '');
    if (!s || s === '-' || s === '–') return null;
    const pct = s.endsWith('%');
    if (pct) s = s.slice(0, -1);
    // "1,283" hoặc "1.283" (phân cách nghìn) ; "37.0" (thập phân)
    if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
    else s = s.replace(',', '.');
    const n = Number(s);
    if (!isFinite(n)) return null;
    return pct ? n / 100 : n;
  }

  // ===== Đọc workbook =====
  function readWorkbook(buf) {
    // File văn bản (CSV đã chốt PTM_*_T01-T10.csv): đọc nguyên chuỗi. Nếu để SheetJS tự đoán, "12/10/2026" bị hiểu
    // theo kiểu Mỹ thành 10/12 và số thuê bao mất số 0 đầu (sửa 26/11/2026).
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const nhiPhan = (u[0] === 0x50 && u[1] === 0x4B) || (u[0] === 0xD0 && u[1] === 0xCF);   // xlsx (zip) / xls (OLE)
    if (!nhiPhan) {
      const txt = new TextDecoder('utf-8').decode(u).replace(/^﻿/, '');
      if (!/^\s*</.test(txt)) {   // không phải bảng HTML (một số file .xls tải về là HTML: để SheetJS tự đọc)
        const dong1 = txt.slice(0, txt.indexOf('\n') >>> 0);
        return XLSX.read(txt, { type: 'string', raw: true, dense: true, FS: dong1.includes(';') ? ';' : ',' });
      }
    }
    return XLSX.read(buf, { type: 'array', cellDates: true, cellText: false, cellStyles: false, dense: true });
  }
  function sheetRows(ws) {
    // Một số file xuất từ hệ thống ghi sai vùng dữ liệu (<dimension>, vd. A1:T8 trong khi có 457 dòng):
    // tính lại vùng từ các ô thực có để không bỏ sót dòng/cột (bộ đọc của PowerShell cũng đọc mọi ô).
    const data = Array.isArray(ws) ? ws : ws['!data'];
    if (data && ws['!ref']) {
      let maxR = 0, maxC = 0;
      data.forEach((row, r) => { if (!row) return; row.forEach((c, j) => { if (c) { if (r > maxR) maxR = r; if (j > maxC) maxC = j; } }); });
      const cu = XLSX.utils.decode_range(ws['!ref']);
      if (maxR > cu.e.r || maxC > cu.e.c) ws['!ref'] = XLSX.utils.encode_range({ s: cu.s, e: { r: Math.max(maxR, cu.e.r), c: Math.max(maxC, cu.e.c) } });
    }
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
  }
  // tìm dòng tiêu đề chứa tất cả các cột cần (so khớp bỏ dấu)
  function findHeader(rows, needs, maxScan = 30) {
    const N = needs.map(fold);
    for (let r = 0; r < Math.min(rows.length, maxScan); r++) {
      const cells = rows[r].map(fold);
      if (N.every(n => cells.includes(n))) return r;
    }
    return -1;
  }
  function colIndex(header, name) {
    const f = fold(name);
    return header.findIndex(c => fold(c) === f);
  }
  function colLike(header, pred) {
    return header.findIndex(c => pred(fold(c)));
  }

  // ===== Nhận dạng loại file theo nội dung =====
  // Trả về {kind, ...dữ liệu đã rút gọn} hoặc {kind:'unknown'}
  function parseFile(name, buf) {
    const wb = readWorkbook(buf);
    const first = wb.Sheets[wb.SheetNames[0]];
    const rows = sheetRows(first);
    const top = rows.slice(0, 30).map(r => r.map(fold).join(' | ')).join('\n');

    if (findHeader(rows, ['Mã giao dịch', 'Mã C2C giới thiệu']) >= 0) return parseC2C(rows);
    if (findHeader(rows, ['Lý do HM', 'Ngày kích hoạt']) >= 0) return parseNewActive(rows);
    if (findHeader(rows, ['MÃ NHÂN VIÊN', 'NGÀY ĐẤU NỐI']) >= 0) return parseFiber(rows);
    if (findHeader(rows, ['Từ mã NV', 'Sang mã NV']) >= 0) return parseDieuChinh(rows);
    if (findHeader(rows, ['Mã NV', 'Thời gian tới']) >= 0) return parseDsNv(rows);
    if (/KPI GIAO CHO VUNG/.test(top) || rows.some(r => fold(r[0]) === 'TB PTM MBF')) return parseKpiVung(rows, name);
    const hk = findHeader(rows, ['Mã NV']);
    if (hk >= 0 && rows[hk].some(c => /QUA NV|QUA KPP/.test(fold(c)))) return parseKpiNv(wb, name);
    if (/DOANH THU|TKC/.test(top)) return { kind: 'unknown', reason: 'File doanh thu TKC: hiện chưa dùng trong báo cáo' };
    return { kind: 'unknown', reason: 'Không nhận ra loại file (không thấy các cột quen thuộc)' };
  }

  // C2C (baoCaoC2CThanhCong_* / C2C_Txx.xlsx, giống ChuanHoa_C2C.ps1): kỳ ở các dòng "Từ ngày" / "Đến ngày",
  // giờ "Thời gian hòa mạng TC" là UTC -> cộng 7 giờ, ngày theo giờ VN. Chỉ giữ [Mã GD, ngày VN, Mã NV, Mã C2C giới thiệu].
  function ngayGioC2C(v) {
    let y, mo, d, h = 0, mi = 0, s = 0;
    if (v instanceof Date) {
      if (isNaN(v)) return 0;
      const t = new Date(v.getTime() + 500);   // bù sai số làm tròn của SheetJS
      y = t.getFullYear(); mo = t.getMonth() + 1; d = t.getDate(); h = t.getHours(); mi = t.getMinutes(); s = t.getSeconds();
    } else {
      const m = clean(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (!m) return 0;
      d = +m[1]; mo = +m[2]; y = +m[3];
      if (m[4]) { h = +m[4]; mi = +m[5]; if (m[6]) s = +m[6]; }
    }
    const t = new Date(Date.UTC(y, mo - 1, d, h, mi, s) + LECH_GIO_C2C * 3600000);
    return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function parseC2C(rows) {
    let from = 0, to = 0;
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const nhan = fold(rows[r][0]);
      const gt = rows[r].slice(1).find(c => clean(c));
      const d = gt instanceof Date ? toDate(gt) : toDate(clean(gt).split(' ')[0]);
      if (nhan.startsWith('TU NGAY')) from = d; else if (nhan.startsWith('DEN NGAY')) to = d;
    }
    const h = findHeader(rows, ['Mã giao dịch', 'Mã C2C giới thiệu']);
    const H = rows[h];
    const c = { gd: colIndex(H, 'Mã giao dịch'), c2c: colIndex(H, 'Mã C2C giới thiệu'), ql: colIndex(H, 'Mã nhân viên quản lý'), tg: colIndex(H, 'Thời gian hòa mạng TC') };
    if (c.ql < 0 || c.tg < 0) throw new Error('File C2C thiếu cột "Mã nhân viên quản lý" hoặc "Thời gian hòa mạng TC"');
    const recs = [];
    let minD = 0, maxD = 0;
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r], gd = clean(row[c.gd]);
      if (!gd) continue;
      const d = ngayGioC2C(row[c.tg]);
      if (!d) continue;
      if (d > maxD) maxD = d;
      if (!minD || d < minD) minD = d;
      recs.push([gd, d, up(row[c.ql]).replace(/_C2C$/, ''), up(row[c.c2c])]);
    }
    if (!from || !to) { from = minD; to = maxD; }
    return { kind: 'c2c', from, to, recs };
  }
  // Gộp C2C: kỳ mới hơn trước, mỗi Mã giao dịch 1 lần
  function allC2c(entries) {
    const sorted = (entries || []).slice().sort((a, b) => (b.to - a.to) || ((b.importedAt || 0) - (a.importedAt || 0)));
    const seen = new Set(), out = [];
    for (const e of sorted) for (const r of e.recs) { if (seen.has(r[0])) continue; seen.add(r[0]); out.push(r); }
    return out;
  }

  // NEW_ACTIVE: chỉ giữ các cột cần + dòng có Lý do HM được tính
  function parseNewActive(rows) {
    const h = findHeader(rows, ['Lý do HM', 'Ngày kích hoạt']);
    const H = rows[h];
    const c = {
      so: colIndex(H, 'Số thuê bao'), ngay: colIndex(H, 'Ngày kích hoạt'), lydo: colIndex(H, 'Lý do HM'),
      loai: colIndex(H, 'Loại thuê bao'), goi: colIndex(H, 'Mã gói'), nv: colIndex(H, 'Nhân viên PT')
    };
    if (c.so < 0 || c.nv < 0) throw new Error('File NEW_ACTIVE thiếu cột "Số thuê bao" hoặc "Nhân viên PT"');
    const LD = new Set(LY_DO_HM);
    const recs = [];
    let total = 0;
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r];
      const d = toDate(row[c.ngay]);
      if (!d) continue;
      total++;
      const ld = up(row[c.lydo]);
      if (!LD.has(ld)) continue;
      recs.push([clean(row[c.so]), d, ld, up(row[c.loai]), c.goi >= 0 ? up(row[c.goi]) : '', up(row[c.nv])]);
    }
    return { kind: 'na', recs, total };
  }

  // FIBER: giữ mọi HĐ (cần tình trạng ở file mới nhất để chống trùng)
  function parseFiber(rows) {
    const h = findHeader(rows, ['MÃ NHÂN VIÊN', 'NGÀY ĐẤU NỐI']);
    const H = rows[h];
    let from = 0, to = 0;
    for (let r = 0; r < h; r++) {
      const s = rows[r].map(clean).join(' ');
      const m = fold(s).match(/TU NGAY\s*(\d{1,2}\/\d{1,2}\/\d{4}).*DEN NGAY\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (m) { from = toDate(m[1]); to = toDate(m[2]); break; }
    }
    const c = {
      user: colIndex(H, 'USER'), hd: colIndex(H, 'SỐ HỢP ĐỒNG'), ngay: colIndex(H, 'NGÀY ĐẤU NỐI'),
      nv: colIndex(H, 'MÃ NHÂN VIÊN'), tt: colIndex(H, 'TÌNH TRẠNG HỢP ĐỒNG'), cc: colIndex(H, 'TÌNH TRẠNG CHẶN CẮT'),
      dv: colIndex(H, 'DỊCH VỤ'), ten: colIndex(H, 'TÊN NHÂN VIÊN')
    };
    const recs = [];
    let maxD = 0, minD = 0;
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r];
      const d = toDate(row[c.ngay]);
      if (!d) continue;   // bỏ dòng đánh số cột (1, 2, 3…) và dòng trống
      if (d > maxD) maxD = d;
      if (!minD || d < minD) minD = d;
      recs.push([clean(row[c.user]), c.hd >= 0 ? clean(row[c.hd]) : '', d, up(row[c.nv]),
        clean(row[c.tt]), c.cc >= 0 ? clean(row[c.cc]) : '', c.dv >= 0 ? clean(row[c.dv]) : '']);
    }
    if (!from) { from = minD; to = maxD; }
    return { kind: 'fiber', from, to, recs };
  }

  function parseDsNv(rows) {
    const h = findHeader(rows, ['Mã NV', 'Thời gian tới']);
    const H = rows[h];
    const c = {
      ma: colIndex(H, 'Mã NV'), ten: colIndex(H, 'Họ và Tên NV'), tu: colIndex(H, 'Thời gian tới'),
      den: colIndex(H, 'Thời gian đi'), tt: colIndex(H, 'Tình trạng')
    };
    if (c.ten < 0) c.ten = colLike(H, f => f.includes('TEN'));
    const nv = [];
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r];
      const ma = clean(row[c.ma]);
      if (!ma) continue;
      nv.push({
        donvi: clean(row[0]), ma, ten: c.ten >= 0 ? clean(row[c.ten]) : '',
        tu: toDate(row[c.tu]), den: c.den >= 0 ? toDate(row[c.den]) : 0,
        loai: c.tt >= 0 ? clean(row[c.tt]) : ''
      });
    }
    return { kind: 'ds', nv };
  }

  function parseKpiVung(rows, name) {
    let nam = 0;
    for (const r of rows.slice(0, 5)) { const m = fold(r.join(' ')).match(/NAM\s*(20\d\d)/); if (m) { nam = +m[1]; break; } }
    if (!nam) { const m = str(name).match(/(20\d\d)/); if (m) nam = +m[1]; }
    // các cột tháng T1..T12 theo dòng tiêu đề gần nhất phía trên mỗi chỉ tiêu
    const kpi = { MBF: Array(12).fill(null), SME: Array(12).fill(null), FIBER: Array(12).fill(null), WIFI: Array(12).fill(null) };
    let cols = null;
    for (const row of rows) {
      const f = row.map(fold);
      if (f.includes('T1') && f.includes('T2')) {
        cols = {};
        f.forEach((v, i) => { const m = v.match(/^T(\d{1,2})$/); if (m && +m[1] >= 1 && +m[1] <= 12) cols[+m[1]] = i; });
        continue;
      }
      if (!cols) continue;
      const k0 = f[0] || '';   // dòng trống hoàn toàn: mảng rỗng
      const key = k0 === 'TB PTM MBF' ? 'MBF' : k0 === 'TB PTM THGT' ? 'SME' : k0.startsWith('TB PTM FIBER') ? 'FIBER'
        : (k0.startsWith('TB WIFI') ? 'WIFI' : null);
      if (!key) continue;
      for (let m = 1; m <= 12; m++) if (cols[m] != null) kpi[key][m - 1] = toNum(row[cols[m]]);
    }
    if (!nam) nam = new Date().getFullYear();
    return { kind: 'kpiv', nam, kpi };
  }

  // KPI NV Txx: sheet 1 = chỉ tiêu từng NV; sheet "Mã gói cước data" = giá gói theo cột "Tháng"
  function parseKpiNv(wb, name) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = sheetRows(ws);
    const h = findHeader(rows, ['Mã NV']);
    const H = rows[h];
    let thang = 0, nam = 0;
    const ms = wb.SheetNames[0].match(/T\s*(\d{1,2})/i) || str(name).match(/T\s*(\d{1,2})/i);
    if (ms) thang = +ms[1];
    const my = str(name).match(/(20\d\d)/); if (my) nam = +my[1];
    // Cột chỉ tiêu: tìm như BaoCao_KPI_NV.ps1 (tên chỉ tiêu bỏ khoảng trắng chứa cụm nhận diện; cột đầu tiên khớp).
    // Mỗi chỉ tiêu: Số lượng (KH) | Tỷ lệ | (chỉ tiêu nhập tay) Thực hiện.
    const cats = {};
    const tieuDe = H.map(v => fold(v).replace(/\s/g, ''));
    for (const c of KPI_COLS) { const i = tieuDe.findIndex(f => f.includes(c.match)); if (i >= 0) cats[c.k] = i; }
    H.forEach((v, i) => {   // dự phòng cho mẫu file cũ
      const f = fold(v);
      if (!f) return;
      let k = null;
      if (f.includes('QUA KPP')) k = 'KPP';
      else if (f.includes('THGT')) k = 'THGT';
      else if (f.includes('WIFI')) k = 'WIFI';
      else if (f.includes('FIBER')) k = 'FIBER';
      else if (f.includes('MOBIFONE') && f.includes('QUA NV')) k = 'MBF';
      if (k && cats[k] == null) cats[k] = i;
    });
    const nhap = new Set(KPI_COLS.filter(c => c.nhap).map(c => c.k));
    const cMa = colIndex(H, 'Mã NV'), cDv = colIndex(H, 'Đơn vị'), cTen = colLike(H, f => f.startsWith('HO VA TEN') || f === 'HO TEN');
    const nv = [];
    for (let r = h + 2; r < rows.length; r++) {   // dòng tiêu đề thứ 2: "Số lượng | Tỷ lệ"
      const row = rows[r];
      const ma = clean(row[cMa]);
      if (!ma) continue;
      const kh = {}, w = {}, th = {};
      for (const k of Object.keys(cats)) {
        kh[k] = toNum(row[cats[k]]); w[k] = toNum(row[cats[k] + 1]);
        if (nhap.has(k)) th[k] = toNum(row[cats[k] + 2]);
      }
      nv.push({ ma, donvi: cDv >= 0 ? clean(row[cDv]) : '', ten: cTen >= 0 ? clean(row[cTen]) : '', kh, w, th });
    }
    // bảng giá gói
    const gia = {};
    const sn = wb.SheetNames.find(s => fold(s).includes('GOI'));
    if (sn) {
      const pr = sheetRows(wb.Sheets[sn]);
      const ph = findHeader(pr, ['Mã gói cước']);
      if (ph >= 0) {
        const cg = colIndex(pr[ph], 'Mã gói cước'), ct = colIndex(pr[ph], 'Tháng');
        for (let r = ph + 1; r < pr.length; r++) {
          const code = up(pr[r][cg]);
          if (code) gia[code] = toNum(pr[r][ct]);
        }
      }
    }
    return { kind: 'kpinv', thang, nam, nv, gia, cats: Object.keys(cats) };
  }

  // giống Map-ChiTieu của BaoCao_KPI_NV.ps1 (xét theo thứ tự, bỏ khoảng trắng)
  const DC_CHI_TIEU = [
    ['WIFI', /WIFI|FWD/], ['FIBER', /FIBER/], ['KPP', /KPP|C2C/], ['THGT', /THGT|SAYMEE/], ['MBF', /MOBIFONE|^NV$/]
  ];
  function dcKey(s) { const f = fold(s).replace(/\s/g, ''); for (const [k, re] of DC_CHI_TIEU) if (re.test(f)) return k; return null; }
  function parseDieuChinh(rows) {
    const h = findHeader(rows, ['Từ mã NV', 'Sang mã NV']);
    const H = rows[h];
    const c = {
      th: colIndex(H, 'Tháng'), ct: colIndex(H, 'Chỉ tiêu'), tu: colIndex(H, 'Từ mã NV'), tenTu: colIndex(H, 'Tên NV chuyển'),
      sang: colIndex(H, 'Sang mã NV'), tenSang: colIndex(H, 'Tên NV nhận'), sl: colIndex(H, 'Số lượng'),
      sotb: colLike(H, f => f.startsWith('SO THUE BAO')), gc: colIndex(H, 'Ghi chú')
    };
    const list = [];
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!clean(row[c.tu]) && !clean(row[c.sang])) continue;
      list.push({
        thang: monthKey(row[c.th]), chiTieu: clean(row[c.ct]), tu: clean(row[c.tu]), tenTu: clean(row[c.tenTu]),
        sang: clean(row[c.sang]), tenSang: clean(row[c.tenSang]), sl: toNum(row[c.sl]) || 0,
        sotb: c.sotb >= 0 ? clean(row[c.sotb]) : '', ghiChu: c.gc >= 0 ? clean(row[c.gc]) : ''
      });
    }
    return { kind: 'dc', list };
  }
  // ô "Tháng" của file điều chỉnh -> "MM/yyyy"
  function monthKey(v) {
    if (v instanceof Date || typeof v === 'number') {
      const d = toDate(v); return d ? `${String(mOf(d)).padStart(2, '0')}/${yOf(d)}` : '';
    }
    const m = clean(v).match(/(\d{1,2})\s*[\/\-.]\s*(20\d\d)/);
    return m ? `${m[1].padStart(2, '0')}/${m[2]}` : clean(v);
  }

  // ===== Chuẩn bị dữ liệu chung =====
  // Danh sách NV: mã (viết hoa) -> {row, windows:[[tu,den]]}
  function nvMap(ds) {
    const map = new Map();
    for (const n of (ds ? ds.nv : [])) {
      const k = up(n.ma);
      if (!map.has(k)) map.set(k, { n, win: [] });
      map.get(k).win.push([n.tu || 0, n.den || 0]);
    }
    return map;
  }
  const inWin = (e, d) => e.win.some(([a, b]) => (!a || d >= a) && (!b || d <= b));

  // Gộp NEW_ACTIVE của mọi tháng, chống trùng (Số TB + Ngày kích hoạt)
  function allNa(naEntries) {
    const seen = new Set(), out = [];
    for (const e of naEntries) for (const r of e.recs) {
      const k = r[0] + '|' + r[1];
      if (seen.has(k)) continue;
      seen.add(k); out.push(r);
    }
    return out;
  }
  // Gộp Fiber: file mới nhất trước; mỗi HĐ (USER + SỐ HĐ) tính 1 lần theo tình trạng ở file mới nhất
  function allFiber(fiberEntries) {
    const sorted = fiberEntries.slice().sort((a, b) => (b.to - a.to) || (b.from - a.from) || ((b.importedAt || 0) - (a.importedAt || 0)));
    const seen = new Set(), out = [];
    for (const e of sorted) for (const r of e.recs) {
      const k = up(r[0]) + '|' + up(r[1]);
      if (seen.has(k)) continue;
      seen.add(k); out.push(r);
    }
    return out;
  }
  function fiberCounted(r) {
    const tt = fold(r[4]);
    if (tt === 'DANG HOAT DONG') return true;
    if (tt === 'DA HUY') { const cc = fold(r[5]); return FIBER_HUY_DUOC_TINH.some(p => cc.includes(p)); }
    return false;
  }
  const isSaymee = loai => LOAI_SAYMEE.includes(loai);

  // ===== Báo cáo tổng (dashboard) =====
  // Trả về D đúng cấu trúc mẫu dashboard_template.html + danh sách chi tiết + cảnh báo
  function buildDashboard(store, nam, thang) {
    const warn = [];
    const ds = store.ds;
    if (!ds) throw new Error('Chưa nạp "Danh sach NV DN4.xlsx".');
    const map = nvMap(ds);
    const Z = () => Array(12).fill(0);
    const nv = [], byCode = new Map();
    for (const [k, e] of map) {
      const n = e.n;
      const o = { ma: n.ma, ten: n.ten, donvi: n.donvi, loai: n.loai || 'Điểm bán', tu: fmtD(n.tu), den: fmtD(n.den),
        MBF: Z(), SME: Z(), FIBER: Z(), xMBF: Z(), xSME: Z(), xFIBER: Z(), WIFI: Z(), xWIFI: Z(), FWD: Z() };
      nv.push(o); byCode.set(k, o);
    }
    const months = new Set(), detail = [];
    for (const r of allNa(store.na)) {
      const d = r[1];
      if (yOf(d) !== nam) continue;
      const m = mOf(d);
      months.add(m);
      const e = map.get(r[5]);
      if (!e) continue;
      const kind = isSaymee(r[3]) ? 'SME' : 'MBF';
      const ok = inWin(e, d), o = byCode.get(r[5]);
      (ok ? o[kind] : o['x' + kind])[m - 1]++;
      // MobiWifi 5G = Loại TB FWD và có Mã gói (1 phần MobiFone); FWD = mọi TB FWD, chỉ để hiển thị (như BaoCao_PTM.ps1)
      if (kind === 'MBF' && LOAI_WIFI.includes(r[3])) { if (r[4]) (ok ? o.WIFI : o.xWIFI)[m - 1]++; if (ok) o.FWD[m - 1]++; }
      detail.push([kind === 'SME' ? 'Saymee' : 'MobiFone', m, fmtD(d), r[0], r[3], r[2], r[4], e.n.ma, e.n.ten, o.loai, ok ? 'Có' : 'Ngoài thời gian công tác']);
    }
    for (const r of allFiber(store.fiber)) {
      const d = r[2];
      if (yOf(d) !== nam || !fiberCounted(r)) continue;
      const e = map.get(r[3]);
      if (!e) continue;
      const m = mOf(d);
      months.add(m);
      const ok = inWin(e, d), o = byCode.get(r[3]);
      (ok ? o.FIBER : o.xFIBER)[m - 1]++;
      detail.push(['Fiber', m, fmtD(d), r[0], r[6], r[4] + (r[5] ? ' / ' + r[5] : ''), '', e.n.ma, e.n.ten, o.loai, ok ? 'Có' : 'Ngoài thời gian công tác']);
    }
    const ms = [...months].sort((a, b) => a - b);
    if (!ms.length) throw new Error(`Chưa có dữ liệu năm ${nam}.`);
    if (!thang) thang = ms[ms.length - 1];
    if (!ms.includes(thang)) warn.push(`Tháng ${thang}/${nam} chưa có dữ liệu NEW_ACTIVE/Fiber.`);
    const kv = store.kpiv.find(k => k.nam === nam);
    const N12 = () => Array(12).fill(null);
    const kpi = kv ? { MBF: kv.kpi.MBF.slice(), SME: kv.kpi.SME.slice(), FIBER: kv.kpi.FIBER.slice(), WIFI: (kv.kpi.WIFI || N12()).slice() } : { MBF: N12(), SME: N12(), FIBER: N12(), WIFI: N12() };
    if (!kv) warn.push(`Chưa nạp file KPI_Vung4_${nam}.xlsx: không tính được % hoàn thành.`);
    else if (kpi.MBF[thang - 1] == null && kpi.SME[thang - 1] == null) warn.push(`KPI_Vung4_${nam} chưa có chỉ tiêu tháng ${thang}.`);
    if (!store.na.some(e => e.nam === nam && e.thang === thang)) warn.push(`Chưa có file NEW_ACTIVE tháng ${thang}/${nam}.`);
    const fCover = store.fiber.some(f => f.from <= ymd(nam, thang, daysIn(nam, thang)) && f.to >= ymd(nam, thang, 1));
    if (!fCover) warn.push(`Chưa có file Fiber phủ tháng ${thang}/${nam}.`);
    const D = { nam, thang, months: ms, taoLuc: nowText(), nv, kpi, nguon: sourceNames(store) };
    detail.sort((a, b) => (a[1] - b[1]) || a[0].localeCompare(b[0]) || a[2].split('/').reverse().join('').localeCompare(b[2].split('/').reverse().join('')));
    const tot = k => nv.reduce((s, o) => s + o[k][thang - 1], 0);
    const summary = { MBF: tot('MBF'), SME: tot('SME'), FIBER: tot('FIBER'), kMBF: kpi.MBF[thang - 1], kSME: kpi.SME[thang - 1], kFIBER: kpi.FIBER[thang - 1],
      WIFI: tot('WIFI'), FWD: tot('FWD'), kWIFI: kpi.WIFI[thang - 1] };
    return { D, detail, warn, summary };
  }
  const DETAIL_HEAD = ['Chỉ tiêu', 'Tháng', 'Ngày', 'Số TB / User Fiber', 'Loại TB / Dịch vụ', 'Lý do HM / Tình trạng HĐ', 'Mã gói', 'Mã NV', 'Tên NV', 'Nhóm', 'Được tính'];

  function nowText() {
    const t = new Date(), p = n => String(n).padStart(2, '0');
    return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
  }
  function sourceNames(store) {
    const out = [];
    store.na.slice().sort((a, b) => (a.nam - b.nam) || (a.thang - b.thang)).forEach(e => out.push(e.name));
    store.fiber.slice().sort((a, b) => a.from - b.from).forEach(e => out.push(e.name));
    if (store.ds) out.push(store.ds.name);
    store.kpiv.forEach(e => out.push(e.name));
    return [...new Set(out)];
  }

  // ===== Báo cáo KPI nhân viên (giống BaoCao_KPI_NV.ps1, HUONG_DAN mục 3) =====
  // match: cụm nhận diện trong tên chỉ tiêu (bỏ dấu, bỏ khoảng trắng); nhap: số thực hiện nhập tay ở cột "Thực hiện".
  const KPI_COLS = [
    { k: 'C2C', name: 'Điểm bán C2C', th: 'Điểm bán<br>C2C', match: 'DIEMBANC2C', nhap: true },
    { k: 'MBF', name: 'MobiFone qua NV', th: 'MobiFone<br>qua NV', match: 'MOBIFONEPTMQUANV' },
    { k: 'KPP', name: 'MobiFone qua KPP', th: 'MobiFone<br>qua KPP', match: 'MOBIFONEPTMQUAKPP' },
    { k: 'THGT', name: 'THGT qua NV', th: 'THGT<br>qua NV', match: 'THGTPTMQUANV' },
    { k: 'DT', name: 'Doanh thu (tr.đ)', th: 'Doanh thu<br>(tr.đ)', match: 'DOANHTHUPHANPHOI', nhap: true },
    { k: 'WIFI', name: 'MobiWifi 5G', th: 'MobiWifi<br>5G', match: 'MOBIWIFI' },
    { k: 'FIBER', name: 'Mobi Fiber', th: 'Mobi<br>Fiber', match: 'MOBIFIBER' }
  ];
  function buildKpiNv(store, nam, thang) {
    const warn = [];
    const kn = store.kpinv.filter(k => !thang || k.thang === thang)
      .sort((a, b) => ((b.nam || 0) - (a.nam || 0)) || (b.thang - a.thang))[0];
    if (!kn) throw new Error(thang ? `Chưa nạp file "KPI NV T${String(thang).padStart(2, '0')}.xlsx".` : 'Chưa nạp file "KPI NV Txx.xlsx".');
    thang = kn.thang;
    if (!nam) nam = kn.nam || latestYearWithMonth(store, thang) || new Date().getFullYear();
    const map = nvMap(store.ds);
    if (!store.ds) warn.push('Chưa nạp Danh sach NV: không kiểm tra được thời gian công tác và nhóm kênh.');
    // Chỉ tiêu có trong file KPI (file đã lưu trước khi có cột C2C/Doanh thu: suy từ KH)
    const coCot = new Set(kn.cats || KPI_COLS.filter(c => kn.nv.some(n => n.kh && c.k in n.kh)).map(c => c.k));
    const cols = KPI_COLS.filter(c => coCot.has(c.k));
    const plan = new Map(kn.nv.map(n => [up(n.ma), n]));
    const th = new Map(kn.nv.map(n => {
      const t = {};
      for (const c of cols) t[c.k] = c.nhap ? ((n.th || {})[c.k] == null ? null : n.th[c.k]) : 0;
      return [up(n.ma), t];
    }));
    // Mã không có trong Danh sach NV: không giới hạn thời gian (như PowerShell)
    const winOk = (code, d) => { const e = map.get(code); return e ? inWin(e, d) : true; };
    const gia = kn.gia || {};
    const missingPack = new Map();
    const detail = [];
    const name = code => (plan.get(code) || {}).ten || '';
    let maxD = 0;
    const m0 = ymd(nam, thang, 1), m1 = ymd(nam, thang, daysIn(nam, thang));
    for (const r of allNa(store.na)) {
      const d = r[1];
      if (d < m0 || d > m1) continue;
      if (d > maxD) maxD = d;
      const code = r[5], loai = r[3], sme = isSaymee(loai);
      const kpp = /_C2C$/.test(code), target = kpp ? code.replace(/_C2C$/, '') : code;
      if (!plan.has(target)) continue;
      if (!winOk(code, d)) continue;
      if (!r[4]) continue;   // không có mã gói: không tính
      const p = gia[r[4]];
      if (p === undefined) { missingPack.set(r[4], (missingPack.get(r[4]) || 0) + 1); continue; }
      if (p == null || p < GIA_GOI_TOI_THIEU) continue;
      const t = th.get(target);
      const add = (k, lab) => { if (!(k in t)) return; t[k]++; detail.push([lab, fmtD(d), r[0], loai, r[4], p, code, plan.get(target).ma, name(target)]); };
      if (kpp) { if (!sme) add('KPP', 'KPP'); continue; }
      if (sme) add('THGT', 'THGT'); else add('MBF', 'NV');
      if (LOAI_WIFI.includes(loai)) add('WIFI', 'WIFI');
    }
    // CT1 – Điểm bán C2C: mỗi Mã C2C giới thiệu của NV có >= 1 GD trong tháng = 1 điểm.
    // Tháng có GD C2C thì thay số nhập tay; chưa có file C2C phủ tháng thì giữ số nhập tay.
    let c2cTuDong = false;
    if (coCot.has('C2C')) {
      const diem = new Set();
      for (const r of allC2c(store.c2c)) {
        if (r[1] < m0 || r[1] > m1) continue;
        c2cTuDong = true;
        if (plan.has(r[2])) diem.add(r[2] + '|' + r[3]);
      }
      if (c2cTuDong) {
        for (const t of th.values()) t.C2C = 0;
        for (const k of diem) th.get(k.split('|')[0]).C2C++;
      }
    }
    for (const r of allFiber(store.fiber)) {
      const d = r[2];
      if (d < m0 || d > m1 || !fiberCounted(r)) continue;
      const code = r[3];
      if (!plan.has(code) || !winOk(code, d) || !('FIBER' in th.get(code))) continue;
      th.get(code).FIBER++;
      detail.push(['FIBER', fmtD(d), r[0], r[6], r[4], r[5], code, plan.get(code).ma, name(code)]);
    }
    // điều chỉnh thủ công: trừ NV chuyển, cộng NV nhận (một trong hai có thể để trống)
    const mk = `${String(thang).padStart(2, '0')}/${nam}`;
    const adj = new Map(), adjNotes = [];
    const dcs = (store.dc ? store.dc.list : []).filter(x => x.thang === mk);
    for (const x of dcs) {
      const k = dcKey(x.chiTieu), a = up(x.tu), b = up(x.sang), sl = Math.round(x.sl) || 1;
      if (!k || !coCot.has(k)) { warn.push(`Điều chỉnh: không nhận ra chỉ tiêu "${x.chiTieu}".`); continue; }
      if ((a && !th.has(a)) || (b && !th.has(b))) { warn.push(`Điều chỉnh: mã ${a && !th.has(a) ? x.tu : x.sang} không có trong file KPI NV.`); continue; }
      if (a) { th.get(a)[k] -= sl; adj.set(a + '|' + k, (adj.get(a + '|' + k) || 0) - sl); }
      if (b) { th.get(b)[k] += sl; adj.set(b + '|' + k, (adj.get(b + '|' + k) || 0) + sl); }
      adjNotes.push({ k, a, b, sl, ghiChu: x.ghiChu });
      detail.unshift(['DC-' + k, '', x.sotb, '', `Điều chỉnh ${sl} TB`, x.ghiChu, x.tu, b ? plan.get(b).ma : '', b ? name(b) : '']);
    }
    for (const [code, t] of th) for (const k of Object.keys(t)) if (t[k] < 0) warn.push(`Điều chỉnh làm ${name(code) || code} âm ${k}: ${t[k]}.`);
    if (missingPack.size) warn.push('Gói cước không có trong bảng giá (không tính): ' + [...missingPack].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} (${n})`).join(', ') + '.');
    if (!store.na.some(e => e.nam === nam && e.thang === thang)) warn.push(`Chưa có file NEW_ACTIVE tháng ${thang}/${nam}.`);

    // ngày số liệu & tiến độ thời gian: theo ngày kích hoạt mới nhất trong NEW_ACTIVE (như PowerShell)
    let fiberTo = 0;
    for (const f of store.fiber) if (f.from <= m1 && f.to >= m0) fiberTo = Math.max(fiberTo, Math.min(f.to, m1));
    const endD = maxD || fiberTo || m1;
    const ngay = dOf(endD), soNgay = daysIn(nam, thang);
    const tienDo = ngay / soNgay;

    // Điểm KPI HT (% BQ): bình quân có trọng số "Tỷ lệ" (trống = 1) các chỉ tiêu có KH > 0;
    // chỉ tiêu nhập tay chưa có số thực hiện: bỏ khỏi cả tử và mẫu. Nhóm NVBH: trần 120%, CT6 gộp, CT7.
    const chuaNhap = new Set();
    const kenh = code => { const e = map.get(code); return e ? up(e.n.loai) : ''; };
    const GN = { NVBH: 'Nhân viên bán hàng', GDV: 'Giao dịch viên', AM: 'AM', FIBER: 'Nhân viên Fiber' };
    const ORDER = ['NVBH', 'AM', 'GDV', 'FIBER'];
    const rows = kn.nv.map(n => {
      const code = up(n.ma), e = map.get(code);
      const g = kenh(code) || up(n.donvi) || 'KHÁC';
      const t = th.get(code), nvbh = g === NVBH_NHOM;
      const w = k => { const v = (n.w || {})[k]; return v ? v : 1; };
      let sw = 0, sp = 0;
      for (const c of cols) {
        const kh = n.kh[c.k];
        if (!(kh > 0)) continue;
        if (t[c.k] == null) { chuaNhap.add(c.k); continue; }
        if (nvbh && (c.k === 'WIFI' || c.k === 'FIBER')) continue;
        let p = t[c.k] / kh;
        if (nvbh) p = Math.min(p, DIEM_TRAN);
        sw += w(c.k); sp += w(c.k) * p;
      }
      if (nvbh) {
        const kh6 = (+n.kh.WIFI || 0) + (+n.kh.FIBER || 0), th6 = (+t.WIFI || 0) + (+t.FIBER || 0);
        const w6 = (n.w || {}).WIFI || (n.w || {}).FIBER;
        if (kh6 > 0 && w6) { sw += w6; sp += w6 * Math.min(th6 / kh6, DIEM_TRAN); }
        sw += CT7_TY_TRONG; sp += CT7_TY_TRONG;
      }
      const cells = cols.map(c => {
        const kh = n.kh[c.k], v = t[c.k];
        return { k: c.k, kh: kh == null ? null : kh, th: v, w: (n.w || {})[c.k] || 0, adj: adj.get(code + '|' + c.k) || 0,
          p: kh && v != null ? v / kh * 100 : null };
      });
      return { ma: n.ma, ten: n.ten || (e ? e.n.ten : ''), donvi: shortUnit(n.donvi || (e ? e.n.donvi : '')), g, nvbh, cells,
        bq: sw > 0 && !kn.chiTH ? sp / sw * 100 : null };
    });
    // Chỉ hiện cột nhập tay khi có NV được giao KH
    const tkh = k => rows.reduce((s, r) => s + (r.cells.find(x => x.k === k).kh || 0), 0);
    // Tháng cũ chưa có file KPI NV (kn.chiTH, do công cụ đồng bộ tạo): chỉ hiện số thực hiện; C2C hiện khi có file giao dịch
    const colsHien = kn.chiTH ? cols.filter(c => !c.nhap || (c.k === 'C2C' && c2cTuDong)) : cols.filter(c => !c.nhap || tkh(c.k) > 0);
    const hien = new Set(colsHien.map(c => c.k));
    rows.forEach(r => { r.cells = r.cells.filter(c => hien.has(c.k)); });
    const groups = [];
    const gKeys = [...new Set(rows.map(r => r.g))].sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    for (const g of gKeys) groups.push({ g, label: GN[g] || g, rows: rows.filter(r => r.g === g) });
    const totals = colsHien.map(c => {
      const cs = rows.map(r => r.cells.find(x => x.k === c.k));
      const kh = cs.reduce((s, x) => s + (x.kh || 0), 0);
      const coTh = cs.some(x => x.kh > 0 && x.th != null);
      const v = cs.reduce((s, x) => s + (x.th || 0), 0);
      return { k: c.k, name: c.name, kh, th: c.nhap && !coTh && !kn.chiTH ? null : v, p: kh > 0 && (!c.nhap || coTh) ? v / kh * 100 : null };
    });
    const notes = adjText(adjNotes, code => name(code) || code);
    const nvbhNote = rows.some(r => r.nvbh) ? {
      c2cTuDong, chuaNhap: colsHien.filter(c => c.nhap && chuaNhap.has(c.k)).map(c => c.name)
    } : null;
    detail.sort((a, b) => (a[0].startsWith('DC') ? -1 : 0) - (b[0].startsWith('DC') ? -1 : 0) || a[0].localeCompare(b[0]) || a[1].split('/').reverse().join('').localeCompare(b[1].split('/').reverse().join('')));
    return { nam, thang, ngay, soNgay, tienDo, cols: colsHien.map(c => ({ k: c.k, name: c.name, th: c.th, nhap: !!c.nhap })),
      groups, totals, notes, nvbhNote: kn.chiTH ? null : nvbhNote, warn, detail, taoLuc: nowText(), kpiFile: kn.name,
      chiTH: !!kn.chiTH, khTheo: kn.khTheo || null };
  }
  const KPI_DETAIL_HEAD = ['Chi tieu', 'Ngay', 'So TB / User Fiber', 'Loai TB / Dich vu', 'Ma goi / Tinh trang HD', 'Gia thang / Chan cat', 'Ma PT', 'Ma NV', 'Ten NV'];

  function latestYearWithMonth(store, thang) {
    const ys = store.na.filter(e => e.thang === thang).map(e => e.nam);
    return ys.length ? Math.max(...ys) : 0;
  }
  function shortUnit(s) {
    s = clean(s).replace(/\u00D0/g, 'Đ');   // chữ Ð (Eth) gõ nhầm thay cho Đ
    return s.replace(/^Cửa hàng (MobiFone )?/i, '').replace(/^CH\s+/, '').replace(/^Trung tâm giao dịch (Huyện |Thị xã |TP |Thành phố )?/i, '').replace(/^TTGD\s+/, '')
      .replace(/^H\.\s*/, '').replace(/^TX\.?\s+/, '').replace(/^TP\.?\s+/, '').trim();   // "Hội An", không "CH/TP/TTGD Hội An" (26/11/2026)
  }
  // "MobiWifi 5G: chuyển 2 TB từ A sang B 1, C 1"
  function adjText(list, nm) {
    const lab = { MBF: 'MobiFone qua NV', KPP: 'MobiFone qua KPP', THGT: 'THGT qua NV', WIFI: 'MobiWifi 5G', FIBER: 'Mobi Fiber' };
    const g = new Map();
    for (const x of list) {
      const key = x.k + '|' + x.a;
      if (!g.has(key)) g.set(key, { k: x.k, a: x.a, to: new Map(), sum: 0 });
      const o = g.get(key);
      o.sum += x.sl; o.to.set(x.b, (o.to.get(x.b) || 0) + x.sl);
    }
    const ten = c => (c ? nm(c) : '') || '(ngoài)';
    return [...g.values()].map(o => `${lab[o.k]}: chuyển ${o.sum} TB từ ${ten(o.a)} sang ` +
      [...o.to].map(([b, n]) => o.to.size > 1 ? `${ten(b)} ${n}` : ten(b)).join(', '));
  }

  // ===== CSV =====
  function toCsv(head, rows) {
    const q = v => { const s = str(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\r\n');
  }

  root.Core = {
    parseFile, buildDashboard, buildKpiNv, toCsv, shortUnit, DETAIL_HEAD, KPI_DETAIL_HEAD, KPI_COLS,
    fmtD, toDate, toNum, fold, up, clean, ymd, yOf, mOf, dOf, daysIn, dcKey, nowText,
    RULES: { LY_DO_HM, LOAI_SAYMEE, LOAI_WIFI, FIBER_HUY_DUOC_TINH, GIA_GOI_TOI_THIEU }
  };
})(typeof window !== 'undefined' ? window : globalThis);
