/* Ảnh "KPI nhân viên Vùng 4" (bố cục giống BaoCao_KPI_NV.ps1): khổ ngang 1760px, xuất PNG bằng html2canvas. */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtN = n => n == null ? '–' : String(Math.round(n * 10) / 10).replace('.', ',');
  const diem = p => p == null ? '–' : String(Math.round(p));
  const pctS = p => p == null ? '–' : Math.round(p) + '%';

  const CSS = `
.kimg,.kimg *{box-sizing:border-box;margin:0;padding:0}
.kimg{width:1760px;background:#eef2f7;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1d2433;padding:16px 18px 14px;line-height:normal;text-align:left}
.kimg .hd{display:flex;align-items:stretch;gap:12px;margin-bottom:12px}
.kimg .ti{background:linear-gradient(120deg,#0b4ea2,#1673d4);color:#fff;border-radius:12px;padding:12px 18px;min-width:470px;display:flex;flex-direction:column;justify-content:center}
.kimg .ti h1{font-size:27px;font-weight:800;letter-spacing:.2px;line-height:1.15;color:#fff}
.kimg .ti p{font-size:15px;opacity:.92;margin-top:5px;line-height:1.3}
.kimg .cd{flex:1;border-radius:12px;padding:9px 12px;background:#fff;border-left:7px solid #ccc}
.kimg .cd .t{font-size:16px;font-weight:600;color:#3b4a60}
.kimg .cd .v{display:flex;align-items:baseline;gap:4px;margin-top:3px}
.kimg .cd .v b{font-size:34px;line-height:1}.kimg .cd .v s{text-decoration:none;font-size:19px;color:#667}
.kimg .cd .v em{font-style:normal;margin-left:auto;font-size:27px;font-weight:800}
.kimg .cd.ok{border-color:#2fb565}.kimg .cd.ok em{color:#14813e}.kimg .cd.mid{border-color:#f2c230}.kimg .cd.mid em{color:#a06a00}.kimg .cd.low{border-color:#e8574c}.kimg .cd.low em{color:#c02a1f}
.kimg .bd{display:flex;gap:14px;align-items:flex-start}
.kimg table{flex:1;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;table-layout:fixed;width:100%}
.kimg col.c1{width:34px}.kimg col.c2{width:225px}.kimg col.c4{width:70px}
.kimg th{background:#0b4ea2;color:#fff;font-size:15px;font-weight:600;line-height:1.15;padding:5px 2px;height:48px;text-align:center}
.kimg th.l{text-align:left;padding-left:8px}
.kimg td{border-bottom:1px solid #e6ebf2;height:50px;padding:0 4px}
.kimg tr.gh td{background:#dbe7f7;color:#0b3c7a;font-weight:700;font-size:16px;height:34px;padding-left:10px}
.kimg tr.gh span{font-weight:400;color:#4a6489}
.kimg td.c{text-align:center;color:#7b889c;font-size:14px}
.kimg td.nv{padding-left:8px;white-space:nowrap;overflow:hidden}
.kimg td.nv b{display:block;font-size:18px;line-height:1.15}.kimg td.nv span{font-size:13.5px;color:#6f7d92}
.kimg td.k{text-align:center;border-left:1px solid #edf0f5;position:relative}
.kimg td.k div{line-height:1.1}.kimg td.k b{font-size:20px;color:#111}.kimg td.k s{text-decoration:none;font-size:14px;color:#6a7484}
.kimg td.k em{display:block;font-style:normal;font-weight:800;font-size:16px;line-height:1.15}
.kimg td.bq em{font-size:20px}
.kimg .ok{background:#dcf5e5}.kimg .ok em{color:#14813e}.kimg .mid{background:#fff3cf}.kimg .mid em{color:#9a6400}.kimg .low{background:#fde3e1}.kimg .low em{color:#bd281d}
.kimg .cd.ok,.kimg .cd.mid,.kimg .cd.low{background:#fff}
.kimg td.na{color:#b8c0cc;background:#f7f8fa;font-size:18px}
.kimg td.nd{background:#f3f4f8}.kimg td.nd b{color:#9aa3b2}.kimg td.nd em{color:#8a94a6;font-weight:600;font-size:13px}
.kimg .cd .v em.cc{font-size:15px;font-weight:600;color:#8a94a6;white-space:nowrap}
.kimg .nvb{margin-top:6px;font-size:14px;color:#2d4a72;padding:0 4px}
.kimg .ti.hep{min-width:400px;max-width:470px}
.kimg i.dc{position:absolute;top:2px;right:3px;font-style:normal;font-size:12px;font-weight:700;color:#fff;background:#7a4cc2;border-radius:6px;padding:0 5px;line-height:16px}
.kimg .dcn{margin-top:6px;font-size:14px;color:#4a3478;padding:0 4px}.kimg .dcn i.dc{position:static;margin-right:6px;display:inline-block}
.kimg .ft{display:flex;justify-content:space-between;font-size:14px;color:#566479;margin-top:9px;padding:0 4px;gap:16px}
.kimg .lg{white-space:nowrap}.kimg .lg span{margin-left:14px}.kimg .lg i{display:inline-block;width:13px;height:13px;border-radius:3px;margin-right:5px;vertical-align:-1px}
`;

  function cls(p, tienDo) { return p == null ? '' : p >= 100 ? 'ok' : (p >= tienDo * 100 ? 'mid' : 'low'); }

  // Cột của báo cáo: R.cols (bản mới); báo cáo cũ lưu trước đó: suy từ các ô của dòng đầu
  function cotCua(R) {
    if (R.cols) return R.cols;
    const g0 = (R.groups[0] || { rows: [] }).rows[0], ks = g0 ? g0.cells.map(c => c.k) : [];
    return root.Core.KPI_COLS.filter(c => ks.indexOf(c.k) >= 0);
  }

  function tableHtml(groups, startNo, R) {
    const cols = cotCua(R);
    let no = startNo, body = '';
    for (const g of groups) {
      body += `<tr class="gh"><td colspan="${cols.length + 3}">${esc(g.label)} <span>(${g.rows.length})</span></td></tr>`;
      for (const r of g.rows) {
        body += `<tr><td class="c">${no++}</td><td class="nv"><b>${esc(r.ten)}</b><span>${esc(r.donvi)}</span></td>`;
        for (const c of r.cells) {
          const badge = c.adj ? `<i class="dc">${c.adj > 0 ? '+' : ''}${c.adj}</i>` : '';
          if (c.kh == null) { body += `<td class="k na">${badge}–</td>`; continue; }
          if (c.th == null) { body += `<td class="k nd">${badge}<div><b>–</b><s>/${fmtN(c.kh)}</s></div><em>chưa có</em></td>`; continue; }
          if (!c.kh) { body += `<td class="k na">${badge}<div><b>${fmtN(c.th)}</b><s>/0</s></div><em>–</em></td>`; continue; }
          body += `<td class="k ${cls(c.p, R.tienDo)}">${badge}<div><b>${fmtN(c.th)}</b><s>/${fmtN(c.kh)}</s></div><em>${pctS(c.p)}</em></td>`;
        }
        body += r.bq == null ? `<td class="k bq na">–</td>` : `<td class="k bq ${cls(r.bq, R.tienDo)}"><em>${diem(r.bq)}</em></td>`;
        body += '</tr>';
      }
    }
    const colg = `<colgroup><col class="c1"><col class="c2">${cols.map(() => '<col class="c3">').join('')}<col class="c4"></colgroup>`;
    const head = `<thead><tr><th>#</th><th class="l">Nhân viên</th>${cols.map(c => `<th>${c.th}</th>`).join('')}<th>Điểm<br>KPI HT</th></tr></thead>`;
    return { html: `<table>${colg}${head}<tbody>${body}</tbody></table>`, next: no };
  }

  // chia nhóm thành 2 cột cho cân số dòng (giữ thứ tự NVBH, AM | GDV, Fiber…)
  function split(groups) {
    if (groups.length < 2) return [groups, []];
    const h = groups.map(g => g.rows.length + 0.7);
    const total = h.reduce((a, b) => a + b, 0);
    let best = 1, bestD = Infinity, acc = 0;
    for (let i = 1; i < groups.length; i++) {
      acc += h[i - 1];
      const d = Math.abs(total - 2 * acc);
      if (d < bestD) { bestD = d; best = i; }
    }
    return [groups.slice(0, best), groups.slice(best)];
  }

  function fragment(R) {
    const p2 = n => String(n).padStart(2, '0');
    const sub = `Số liệu 01/${p2(R.thang)} – ${p2(R.ngay)}/${p2(R.thang)}/${R.nam} · Tiến độ thời gian ${Math.round(R.tienDo * 100)}% (${R.ngay}/${R.soNgay} ngày) · Gói cước ≥ 100.000đ/tháng`;
    const cards = R.totals.map(t => `<div class="cd ${cls(t.p, R.tienDo)}"><div class="t">${esc(t.name)}</div><div class="v"><b>${fmtN(t.th)}</b><s>/${fmtN(t.kh)}</s>` +
      (t.th == null ? '<em class="cc">chưa có</em>' : `<em>${pctS(t.p)}</em>`) + '</div></div>').join('');
    const nb = R.nvbhNote;
    const nvbh = nb ? '<div class="nvb"><b>Điểm KPI HT NVBH</b> = Σ min(%HT,120%) × tỷ trọng: C2C 10 · qua NV 20 · KPP 15 · THGT 15 · Doanh thu 20 · Wifi+Fiber gộp 10 · CT Vùng giao 10 (tính đạt)' +
      (nb.c2cTuDong ? ' · Điểm bán C2C: mỗi điểm có GD C2C trong tháng = 1' : '') + (nb.chuaNhap && nb.chuaNhap.length ? ` · ${esc(nb.chuaNhap.join(', '))}: chưa có số thực hiện, chưa tính` : '') + '</div>' : '';
    const [L, Rr] = split(R.groups);
    const a = tableHtml(L, 1, R), b = Rr.length ? tableHtml(Rr, a.next, R) : { html: '' };
    const notes = R.notes.length ? `<div class="dcn"><i class="dc">±</i><b>Điều chỉnh:</b> ${R.notes.map(esc).join('; ')}</div>` : '';
    return `<div class="kimg"><div class="hd"><div class="ti${cotCua(R).length > 5 ? ' hep' : ''}"><h1>KPI NHÂN VIÊN VÙNG 4 – THÁNG ${p2(R.thang)}/${R.nam}</h1><p>${sub}</p></div>${cards}</div>
<div class="bd">${a.html}${b.html}</div>
<div class="ft"><div>Ô: <b>thực hiện</b>/kế hoạch và % · Điểm KPI HT = Σ %HT × tỷ trọng các chỉ tiêu có KH (100 = đạt) · KPP = mã &lt;NV&gt;_C2C · Cập nhật ${esc(R.taoLuc)}</div>
<div class="lg"><span><i style="background:#2fb565"></i>Đạt KH</span><span><i style="background:#f2c230"></i>≥ tiến độ</span><span><i style="background:#e8574c"></i>Dưới tiến độ</span></div></div>${nvbh}${notes}</div>`;
  }

  function standalone(R) {
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>KPI NV Vùng 4 T${String(R.thang).padStart(2, '0')}-${R.nam}</title><style>body{margin:0;background:#eef2f7}${CSS}</style></head><body>${fragment(R)}</body></html>`;
  }

  root.KpiImage = { CSS, fragment, standalone };
})(typeof window !== 'undefined' ? window : globalThis);
