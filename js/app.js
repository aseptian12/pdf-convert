'use strict';
const $ = (s, r = document) => r.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S = { token: localStorage.getItem('tok') || '', user: JSON.parse(localStorage.getItem('usr') || 'null') };
const maxMB = () => S.user ? CFG.MAX_MB_USER : CFG.MAX_MB_GUEST;
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'show'; setTimeout(() => t.className = '', 3500); };

// ---- API (POST wajib text/plain agar tidak kena preflight CORS) ----
async function api(action, data) {
  if (!CFG.GAS_URL || CFG.GAS_URL.includes('XXXX')) return { success: false, message: 'GAS_URL belum diisi di js/config.js' };
  try {
    const r = await fetch(CFG.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: S.token, data }) });
    return await r.json();
  } catch (e) { return { success: false, message: 'Gagal terhubung ke server: ' + e.message }; }
}
function setAuth(t, u) { S.token = t; S.user = u; localStorage.setItem('tok', t); localStorage.setItem('usr', JSON.stringify(u)); renderTop(); }

// ---- Katalog 33 tool: [kategori, id, nama, deskripsi] ----
const CATS = ['Organize PDF','Optimize PDF','Convert to PDF','Convert from PDF','Edit PDF','PDF Security','PDF Intelligence'];
const T = [
[0,'merge','Gabung PDF','Satukan beberapa PDF menjadi satu'],[0,'split','Pisah PDF','Pecah PDF menjadi beberapa file'],
[0,'remove','Hapus Halaman','Buang halaman yang tidak perlu'],[0,'extract','Ekstrak Halaman','Ambil halaman tertentu'],
[0,'organize','Atur Ulang Halaman','Susun ulang urutan halaman'],[0,'scan','Scan ke PDF','Kamera ponsel ke dokumen'],
[1,'compress','Kompres PDF','Perkecil ukuran file'],[1,'ocr','OCR PDF','Kenali teks hasil scan'],[1,'repair','Perbaiki PDF','Pulihkan dokumen rusak'],
[2,'jpg2pdf','JPG ke PDF','Ubah gambar JPG/PNG menjadi PDF'],[2,'word2pdf','Word ke PDF','DOCX menjadi PDF'],[2,'excel2pdf','Excel ke PDF','XLSX menjadi PDF'],
[2,'ppt2pdf','PowerPoint ke PDF','Slide menjadi PDF'],[2,'html2pdf','HTML ke PDF','Halaman web menjadi PDF'],
[3,'pdf2jpg','PDF ke JPG','Halaman PDF menjadi gambar'],[3,'pdf2word','PDF ke Word','PDF menjadi DOCX'],[3,'pdf2ppt','PDF ke PowerPoint','PDF menjadi slide'],
[3,'pdf2xls','PDF ke Excel','Tabel PDF menjadi XLSX'],[3,'pdf2a','PDF ke PDF/A','Format arsip ISO'],
[4,'rotate','Putar PDF','Putar halaman 90°/180°/270°'],[4,'pagenum','Nomor Halaman','Tambah nomor halaman'],[4,'watermark','Tambah Watermark','Teks atau logo latar'],
[4,'crop','Potong PDF','Pangkas margin halaman'],[4,'editpdf','Edit Teks Dasar','Anotasi dan teks'],[4,'forms','Formulir PDF','Isi formulir interaktif'],
[5,'sign','Tanda Tangan PDF','Tanda tangan visual'],[5,'redact','Redaksi PDF','Hitamkan area sensitif'],[5,'compare','Bandingkan PDF','Bandingkan dua dokumen'],
[5,'protect','Kunci PDF','Beri kata sandi'],[5,'unlock','Buka PDF','Buka kunci dokumen Anda'],
[6,'summarize','AI Ringkasan','Ringkas isi dokumen'],[6,'translate','Terjemahan PDF','Terjemahkan dokumen'],[6,'pdf2md','PDF ke Markdown','Ekstrak ke teks Markdown']];
const READY = new Set(['merge','split','remove','extract','rotate','jpg2pdf','organize','scan','compress','pdf2jpg','pagenum','watermark','crop','editpdf','forms','sign','redact','compare','pdf2md','repair','unlock','pdf2ppt','pdf2xls','html2pdf','word2pdf','excel2pdf','ppt2pdf','ocr','pdf2word','summarize','translate']);
const CLOUD = new Set(['html2pdf','word2pdf','excel2pdf','ppt2pdf','ocr','pdf2word','summarize','translate']);
const CLOUD_MB = { word2pdf: 5, excel2pdf: 5, ppt2pdf: 5, html2pdf: 2, ocr: 2, pdf2word: 2 };

// ---- Mesin PDF di browser (pdf-lib) ----
const { PDFDocument, degrees } = window.PDFLib || {};
const load = async f => PDFDocument.load(await f.arrayBuffer());
async function pick(doc, idx) { const o = await PDFDocument.create(); (await o.copyPages(doc, idx)).forEach(p => o.addPage(p)); return o; }
function parse(str, n) {
  return str.split(',').map(p => p.trim()).filter(Boolean).map(p => {
    const m = p.match(/^(\d+)(?:-(\d+))?$/); if (!m) throw Error('Format halaman salah: "' + p + '"');
    const a = +m[1], b = m[2] ? +m[2] : a; if (a < 1 || b > n || a > b) throw Error('Halaman di luar rentang 1-' + n + ': ' + p);
    return Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i);
  });
}
// ---- pdf.js dimuat saat dibutuhkan (render halaman & ekstrak teks) ----
let pj; const needPdfjs = () => pj = pj || new Promise((res, rej) => { const el = document.createElement('script'); el.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  el.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; res(); }; el.onerror = () => rej(Error('Gagal memuat pdf.js, periksa koneksi.')); document.head.appendChild(el); });
async function pages(f, sc, pw) { await needPdfjs(); const d = await pdfjsLib.getDocument({ data: await f.arrayBuffer(), password: pw }).promise, out = [];
  for (let i = 1; i <= d.numPages; i++) { const p = await d.getPage(i), vp = p.getViewport({ scale: sc }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; out.push(c); } return out; }
const b64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = () => rej(Error('Gagal membaca file')); r.readAsDataURL(f); });
const fromB64 = (b, type) => { const a = atob(b), u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return new Blob([u], { type }); };
const lib = (u, g) => new Promise((res, rej) => { if (window[g]) return res(); const el = document.createElement('script'); el.src = u; el.onload = res; el.onerror = () => rej(Error('Gagal memuat pustaka dari CDN')); document.head.appendChild(el); });
async function drv(f, mode) { const r = await api('convert', { mode, name: f.name, data: await b64(f) }); if (!r.success) throw Error(r.message); return r.data.files.map(x => [x.name, fromB64(x.b64, x.type)]); }
async function ai(f, v, task) { const t = (await texts(f)).join('\n\n'); if (!t.trim()) throw Error('PDF tidak berisi teks (hasil scan butuh OCR).'); const r = await api('ai', { task, lang: v.lang, text: t }); if (!r.success) throw Error(r.message); return [[task + '.md', new Blob([r.data.text], { type: 'text/markdown' })]]; }
const jpg = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
async function texts(f) { await needPdfjs(); const d = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, o = [];
  for (let i = 1; i <= d.numPages; i++) { const t = await (await d.getPage(i)).getTextContent(); o.push(t.items.map(x => x.str).join(' ').replace(/\s+/g, ' ').trim()); } return o; }
async function raster(cs, sc) { const o = await PDFDocument.create(); for (const c of cs) { const im = await o.embedJpg(await (await jpg(c, sc.q)).arrayBuffer()); o.addPage([c.width / sc.s, c.height / sc.s]).drawImage(im, { x: 0, y: 0, width: c.width / sc.s, height: c.height / sc.s }); } return o; }
const pg1 = (d, v) => { const n = d.getPageCount(), p = +v.page || 1; if (p < 1 || p > n) throw Error('Halaman harus 1-' + n); return d.getPage(p - 1); };
const RUN = {
  async merge(fs) { const o = await PDFDocument.create(); for (const f of fs) { const d = await load(f); (await o.copyPages(d, d.getPageIndices())).forEach(p => o.addPage(p)); } return [['gabungan.pdf', o]]; },
  async split(fs, v) { const d = await load(fs[0]); return Promise.all(parse(v.range, d.getPageCount()).map(async (ix, i) => ['bagian-' + (i + 1) + '.pdf', await pick(d, ix)])); },
  async extract(fs, v) { const d = await load(fs[0]); return [['ekstrak.pdf', await pick(d, parse(v.range, d.getPageCount()).flat())]]; },
  async remove(fs, v) { const d = await load(fs[0]), del = new Set(parse(v.range, d.getPageCount()).flat()), keep = d.getPageIndices().filter(i => !del.has(i)); if (!keep.length) throw Error('Semua halaman akan terhapus.'); return [['tanpa-halaman.pdf', await pick(d, keep)]]; },
  async rotate(fs, v) { const d = await load(fs[0]); d.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + +v.deg) % 360))); return [['diputar.pdf', d]]; },
  async jpg2pdf(fs) { const o = await PDFDocument.create(); for (const f of fs) { const b = await f.arrayBuffer(), img = /png$/i.test(f.name) ? await o.embedPng(b) : await o.embedJpg(b); o.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height }); } return [['gambar.pdf', o]]; },
  async organize(fs, v) { const d = await load(fs[0]); return [['diatur-ulang.pdf', await pick(d, parse(v.range, d.getPageCount()).flat())]]; },
  async scan(fs) { const o = await PDFDocument.create(); for (const f of fs) { const bm = await createImageBitmap(f), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); const im = await o.embedJpg(await (await jpg(c, .9)).arrayBuffer()); o.addPage([im.width, im.height]).drawImage(im, { x: 0, y: 0, width: im.width, height: im.height }); } return [['scan.pdf', o]]; },
  async pagenum(fs, v) { const d = await load(fs[0]), f = await d.embedFont(PDFLib.StandardFonts.Helvetica); d.getPages().forEach((p, i) => { const w = p.getSize().width, t = String(i + +v.start), tw = f.widthOfTextAtSize(t, 11); p.drawText(t, { x: v.pos === 'l' ? 30 : v.pos === 'r' ? w - 30 - tw : (w - tw) / 2, y: 20, size: 11, font: f }); }); return [['bernomor.pdf', d]]; },
  async watermark(fs, v) { const d = await load(fs[0]), f = await d.embedFont(PDFLib.StandardFonts.HelveticaBold); d.getPages().forEach(p => { const { width: w, height: h } = p.getSize(), z = Math.min(w, h) / 9, tw = f.widthOfTextAtSize(v.text, z), k = tw / 2 * Math.SQRT1_2; p.drawText(v.text, { x: w / 2 - k, y: h / 2 - k, size: z, font: f, rotate: degrees(45), opacity: .25, color: PDFLib.rgb(.4, .4, .4) }); }); return [['watermark.pdf', d]]; },
  async crop(fs, v) { const d = await load(fs[0]); d.getPages().forEach(p => { const { width: w, height: h } = p.getSize(), t = +v.t || 0, r = +v.r || 0, b = +v.b || 0, l = +v.l || 0; if (w - l - r <= 0 || h - t - b <= 0) throw Error('Potongan melebihi ukuran halaman.'); p.setCropBox(l, b, w - l - r, h - t - b); }); return [['dipotong.pdf', d]]; },
  async editpdf(fs, v) { const d = await load(fs[0]), f = await d.embedFont(PDFLib.StandardFonts.Helvetica); pg1(d, v).drawText(v.text, { x: +v.x, y: +v.y, size: +v.size || 12, font: f }); return [['teks-ditambah.pdf', d]]; },
  async sign(fs, v, x) { const d = await load(fs[0]), s = x.sig, b = await s.arrayBuffer(), im = /png$/i.test(s.name) ? await d.embedPng(b) : await d.embedJpg(b), w = +v.w || 120; pg1(d, v).drawImage(im, { x: +v.x, y: +v.y, width: w, height: w * im.height / im.width }); return [['ditandatangani.pdf', d]]; },
  async forms(fs, v) { const d = await load(fs[0]), fm = d.getForm(), names = fm.getFields().map(f => f.getName()); if (!names.length) throw Error('PDF ini tidak punya kolom formulir.'); if (!v.text.trim()) throw Error('Kolom tersedia: ' + names.join(', '));
    v.text.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => { const i = l.indexOf('='), k = l.slice(0, i).trim(); if (i < 1 || !names.includes(k)) throw Error('Kolom "' + k + '" tidak ada. Tersedia: ' + names.join(', ')); fm.getTextField(k).setText(l.slice(i + 1).trim()); }); return [['formulir-terisi.pdf', d]]; },
  async compress(fs, v) { const [s, q] = v.q.split(',').map(Number); return [['terkompres.pdf', await raster(await pages(fs[0], s), { s, q })]]; },
  async pdf2jpg(fs) { const cs = await pages(fs[0], 2); return Promise.all(cs.map(async (c, i) => ['halaman-' + (i + 1) + '.jpg', await jpg(c, .92)])); },
  async redact(fs, v) { const cs = await pages(fs[0], 2), bx = v.text.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(',').map(Number));
    if (!bx.length || bx.some(b => b.length !== 5 || b.some(isNaN))) throw Error('Format tiap baris: halaman,x,y,lebar,tinggi');
    bx.forEach(([p, x, y, w, h]) => { const c = cs[p - 1]; if (!c) throw Error('Halaman ' + p + ' tidak ada'); const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(x * 2, y * 2, w * 2, h * 2); }); return [['teredaksi.pdf', await raster(cs, { s: 2, q: .9 })]]; },
  async pdf2md(fs) { const t = await texts(fs[0]); if (!t.some(Boolean)) throw Error('PDF tidak berisi teks (mungkin hasil scan).'); return [['dokumen.md', new Blob(['# ' + fs[0].name + '\n\n' + t.map((x, i) => '## Halaman ' + (i + 1) + '\n\n' + x).join('\n\n')], { type: 'text/markdown' })]]; },
  async compare(fs) { if (fs.length !== 2) throw Error('Pilih tepat 2 PDF.'); const [a, b] = await Promise.all(fs.map(texts)), n = Math.max(a.length, b.length), r = ['# Perbandingan PDF', '', 'A: ' + fs[0].name + ' (' + a.length + ' hal)', 'B: ' + fs[1].name + ' (' + b.length + ' hal)', '']; let df = 0;
    for (let i = 0; i < n; i++) if ((a[i] || '') !== (b[i] || '')) { df++; r.push('- Halaman ' + (i + 1) + ': berbeda'); } r.push('', df ? 'Total halaman berbeda: ' + df : 'Teks kedua dokumen identik.'); return [['perbandingan.md', new Blob([r.join('\n')], { type: 'text/markdown' })]]; },
  async repair(fs) { try { const d = await PDFDocument.load(await fs[0].arrayBuffer(), { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false }), o = await PDFDocument.create(); (await o.copyPages(d, d.getPageIndices())).forEach(p => o.addPage(p)); return [['diperbaiki.pdf', o]]; } catch (e) { return [['diperbaiki-gambar.pdf', await raster(await pages(fs[0], 1.5), { s: 1.5, q: .8 })]]; } },
  async unlock(fs, v) { return [['terbuka.pdf', await raster(await pages(fs[0], 2, v.pw), { s: 2, q: .9 })]]; },
  async pdf2ppt(fs) { await lib('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'PptxGenJS'); const cs = await pages(fs[0], 2), p = new PptxGenJS(); p.defineLayout({ name: 'PG', width: cs[0].width / 144, height: cs[0].height / 144 }); p.layout = 'PG'; for (const c of cs) p.addSlide().addImage({ data: c.toDataURL('image/jpeg', .85), x: 0, y: 0, w: '100%', h: '100%' }); return [['slide.pptx', await p.write({ outputType: 'blob' })]]; },
  async pdf2xls(fs) { await Promise.all([needPdfjs(), lib('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX')]); const d = await pdfjsLib.getDocument({ data: await fs[0].arrayBuffer() }).promise, wb = XLSX.utils.book_new(); let any = false;
    for (let i = 1; i <= d.numPages; i++) { const it = (await (await d.getPage(i)).getTextContent()).items.filter(x => x.str.trim()), rows = []; it.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
      for (const x of it) { const y = x.transform[5], l = rows[rows.length - 1]; if (l && Math.abs(l.y - y) < 3) l.c.push(x); else rows.push({ y, c: [x] }); }
      const aoa = rows.map(r => { r.c.sort((a, b) => a.transform[4] - b.transform[4]); const cells = []; let end = -1e9; for (const x of r.c) { if (cells.length && x.transform[4] - end < 6) cells[cells.length - 1] += ' ' + x.str; else cells.push(x.str); end = x.transform[4] + x.width; } return cells; });
      if (aoa.length) any = true; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Halaman ' + i); }
    if (!any) throw Error('PDF tidak berisi teks (mungkin hasil scan).'); return [['tabel.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' })]]; },
  html2pdf: fs => drv(fs[0], 'html'), word2pdf: fs => drv(fs[0], 'office'), excel2pdf: fs => drv(fs[0], 'office'), ppt2pdf: fs => drv(fs[0], 'office'),
  ocr: fs => drv(fs[0], 'ocr'), pdf2word: fs => drv(fs[0], 'docx'),
  summarize: (fs, v) => ai(fs[0], v, 'ringkasan'), translate: (fs, v) => ai(fs[0], v, 'terjemahan')
};

// ---- Tampilan ----
const IC = { file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  fileup: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M12 12v6M15 15l-3-3-3 3"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>', pen: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  spark: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.29 1.29L3 12l5.8 1.9a2 2 0 0 1 1.29 1.29L12 21l1.9-5.8a2 2 0 0 1 1.29-1.29L21 12l-5.8-1.9a2 2 0 0 1-1.29-1.29z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>', monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>' };
const ico = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const CI = ['layers', 'minimize', 'file', 'image', 'pen', 'lock', 'spark'];
function renderTop() {
  const h0 = location.hash.replace(/^#\/?/, '').split('/')[0], adm = S.user && S.user.peran === 'admin';
  const nv = (href, ic, lb, on) => `<a href="${href}"${on ? ' aria-current="page"' : ''}>${ico(ic)}<span>${lb}</span></a>`;
  $('#side').innerHTML = `<a class="logo" href="#/"><b>${ico('file')}</b><span>PDF Converter<small>Semua tools PDF</small></span></a>
  <nav aria-label="Navigasi utama">${nv('#/', 'grid', 'Semua Tools', h0 === '' || h0 === 'tool')}${nv('#/riwayat', 'clock', 'Riwayat', h0 === 'riwayat')}${adm ? nv('#/admin', 'shield', 'Dashboard Admin', h0 === 'admin') : ''}${S.user ? `<button id="out">${ico('logout')}<span>Keluar</span></button>` : nv('#/masuk', 'login', 'Masuk', h0 === 'masuk' || h0 === 'daftar')}</nav>
  <div class="promo">${ico('lock')}<b>Privasi terjaga</b><span>File diproses di perangkat Anda dan tidak diunggah.</span></div>`;
  $('#top').innerHTML = `<div><h2>PDF Converter</h2><p>Semua tools PDF, langsung di browser</p></div><div class="who"><span class="chip">${S.user ? esc(S.user.nama) + ' · ' + maxMB() + ' MB' : 'Tamu · maks ' + maxMB() + ' MB'}</span>${S.user ? `<span class="av" aria-hidden="true">${esc(S.user.nama.charAt(0).toUpperCase())}</span>` : ''}</div>`;
  const o = $('#out'); if (o) o.onclick = () => { api('logout'); setAuth('', null); location.hash = '#/'; };
}
const card = t => { const r = READY.has(t[1]), c = CLOUD.has(t[1]); return `<a class="card t${t[0] % 4}${r ? '' : ' off'}" ${r ? `href="#/tool/${t[1]}"` : 'aria-disabled="true"'}><span class="ic">${ico(CI[t[0]])}</span><div><h3>${t[2]}</h3><p>${t[3]}</p></div><span class="badge${c ? ' cl' : ''}">${r ? (c ? 'Cloud' : 'Browser') : 'Segera hadir'}</span></a>`; };
function home() {
  const qa = [['merge', 'Gabung PDF', 'Satukan beberapa file', 'layers', 0], ['compress', 'Kompres PDF', 'Perkecil ukuran file', 'minimize', 1], ['word2pdf', 'Word ke PDF', 'Konversi dokumen', 'file', 2], ['pdf2jpg', 'PDF ke JPG', 'Halaman jadi gambar', 'image', 3]];
  const st = [['grid', READY.size, 'Tool tersedia', 0], ['monitor', READY.size - CLOUD.size, 'Berjalan di browser', 1], ['cloud', CLOUD.size, 'Via Google (perlu login)', 2], ['shield', maxMB() + ' MB', 'Batas per file', 3]];
  app.innerHTML = `<section class="banner"><div><h1>Selamat datang di PDF Converter</h1><p>Gabung, pisah, kompres, dan ubah PDF dalam hitungan detik. File Anda diproses di perangkat sendiri.</p><a class="btn w" href="#/tool/merge">Mulai Gabung PDF ${ico('arrow')}</a></div><div class="stack" aria-hidden="true"><i></i><i></i><i></i></div></section>
  <section class="qa" aria-label="Tool populer">${qa.map(q => `<a class="t${q[4]}" href="#/tool/${q[0]}"><span class="i">${ico(q[3])}</span><b>${q[1]}</b><span class="mut">${q[2]}</span><span class="go">Buka ${ico('arrow')}</span></a>`).join('')}</section>
  <section class="stats" aria-label="Ringkasan">${st.map(x => `<div class="st t${x[3]}"><span class="ic">${ico(x[0])}</span><div><b>${x[1]}</b><span class="mut">${x[2]}</span></div></div>`).join('')}</section>
  <div class="srch">${ico('search')}<label class="sr" for="q">Cari tool</label><input id="q" type="search" placeholder="Cari tool, mis. Gabung PDF"></div><div id="cats"></div>`;
  const draw = q => { $('#cats').innerHTML = CATS.map((c, i) => { const l = T.filter(t => t[0] === i && (t[2] + t[3]).toLowerCase().includes(q)); return l.length ? `<section class="cat"><h2><span class="ic t${i % 4}">${ico(CI[i])}</span>${c} <span class="mut">(${l.length})</span></h2><div class="cards">${l.map(card).join('')}</div></section>` : ''; }).join('') || '<p>Tool tidak ditemukan.</p>'; };
  draw(''); $('#q').oninput = e => draw(e.target.value.toLowerCase());
}
const OPTS = {
  unlock: [['pw', 'Kata sandi dokumen', 'p', '']], summarize: [['lang', 'Bahasa ringkasan', 's', ['Indonesia', 'English']]], translate: [['lang', 'Terjemahkan ke', 's', ['Indonesia', 'English', 'Jepang', 'Mandarin', 'Arab']]],
  split: [['range', 'Rentang halaman (tiap rentang jadi file terpisah)', 't', '1-3,4-6']], extract: [['range', 'Halaman yang diambil', 't', '1-3,5']],
  remove: [['range', 'Halaman yang dihapus', 't', '2,4-5']], organize: [['range', 'Urutan halaman baru (boleh diulang atau dihilangkan)', 't', '3,1,2-4']],
  rotate: [['deg', 'Putar searah jarum jam', 's', ['90:90°', '180:180°', '270:270°']]],
  pagenum: [['pos', 'Posisi nomor', 's', ['t:Tengah', 'l:Kiri', 'r:Kanan']], ['start', 'Nomor awal', 'n', 1]],
  watermark: [['text', 'Teks watermark', 't', 'RAHASIA']],
  crop: [['t', 'Atas (pt)', 'n', 0], ['r', 'Kanan (pt)', 'n', 0], ['b', 'Bawah (pt)', 'n', 0], ['l', 'Kiri (pt)', 'n', 0]],
  editpdf: [['page', 'Halaman', 'n', 1], ['x', 'Posisi X (pt dari kiri)', 'n', 50], ['y', 'Posisi Y (pt dari bawah)', 'n', 50], ['size', 'Ukuran huruf', 'n', 12], ['text', 'Teks', 't', 'Isi teks']],
  sign: [['sig', 'Gambar tanda tangan (PNG/JPG)', 'f', 'image/png,image/jpeg'], ['page', 'Halaman', 'n', 1], ['x', 'Posisi X (pt)', 'n', 50], ['y', 'Posisi Y (pt)', 'n', 50], ['w', 'Lebar (pt)', 'n', 120]],
  forms: [['text', 'Isi kolom, satu baris "nama=nilai" (kosongkan untuk melihat daftar kolom)', 'a', 'NamaLengkap=Budi', 1]],
  compress: [['q', 'Kualitas', 's', ['1.5,0.7:Tinggi', '1.2,0.5:Sedang', '1,0.35:Rendah']]],
  redact: [['text', 'Area dihitamkan, satu baris "halaman,x,y,lebar,tinggi" (pt, dari kiri-atas)', 'a', '1,50,100,200,20']]
};
const NOTE = { repair: 'Perbaikan dasar; jika struktur terlalu rusak, halaman dijadikan gambar.', unlock: 'Hanya untuk dokumen yang Anda berhak buka. Hasil berupa gambar (teks tidak bisa dipilih).', pdf2ppt: 'Setiap halaman menjadi satu slide berupa gambar (tidak bisa diedit).', pdf2xls: 'Tabel dideteksi dari posisi teks; hasil perlu dirapikan.', html2pdf: 'Unggah berkas .html mandiri (gaya inline).', word2pdf: 'Dikonversi oleh Google; tata letak bisa sedikit berbeda.', excel2pdf: 'Dikonversi oleh Google; tata letak bisa sedikit berbeda.', ppt2pdf: 'Dikonversi oleh Google; tata letak bisa sedikit berbeda.', ocr: 'OCR oleh Google Docs; PDF hasil disusun ulang dan teks juga diberikan sebagai .txt.', pdf2word: 'OCR dan konversi oleh Google Docs; layout kompleks bisa berubah.', summarize: 'Teks PDF dikirim ke layanan AI melalui server Anda.', translate: 'Teks PDF dikirim ke layanan AI melalui server Anda.', compress: 'Halaman diubah menjadi gambar: teks tidak bisa dipilih lagi dan ukuran bisa lebih besar.', redact: 'Seluruh halaman dijadikan gambar agar teks di area hitam benar-benar hilang.', sign: 'Tanda tangan visual (gambar), bukan tanda tangan digital.', watermark: 'Hanya karakter Latin.', pdf2md: 'Hanya untuk PDF berisi teks; hasil scan butuh OCR.', compare: 'Membandingkan teks per halaman.', forms: 'Mengisi kolom teks formulir.' };
function tool(id) {
  const t = T.find(x => x[1] === id); if (!t || !READY.has(id)) { location.hash = '#/'; return; }
  if (CLOUD.has(id) && !S.user) { app.innerHTML = `<h1>${t[2]} <span class="badge">Cloud</span></h1><p>Tool ini memakai layanan Google dan memerlukan akun.</p><a class="btn" href="#/masuk">Masuk</a>`; return; }
  const multi = ['merge', 'jpg2pdf', 'scan', 'compare'].includes(id), EXT = { jpg2pdf: /\.(jpe?g|png)$/i, scan: /\.(jpe?g|png|webp)$/i, word2pdf: /\.docx$/i, excel2pdf: /\.xlsx$/i, ppt2pdf: /\.pptx$/i, html2pdf: /\.html?$/i, ocr: /\.(pdf|jpe?g|png)$/i },
    acc = { jpg2pdf: 'image/jpeg,image/png', scan: 'image/*', word2pdf: '.docx', excel2pdf: '.xlsx', ppt2pdf: '.pptx', html2pdf: '.html,.htm', ocr: 'application/pdf,image/jpeg,image/png' }[id] || 'application/pdf';
  const okT = f => (EXT[id] || /\.pdf$/i).test(f.name), lim = () => Math.min(maxMB(), CLOUD_MB[id] || 1e9);
  const fld = ([k, l, ty, x, opt]) => { const i = 'f_' + k, L = `<label for="${i}">${l}</label>`;
    if (ty === 's') return L + `<select id="${i}">${x.map(o => { const [v, n = v] = o.split(':'); return `<option value="${v}">${n}</option>`; }).join('')}</select>`;
    if (ty === 'a') return L + `<textarea id="${i}" rows="4" placeholder="${esc(x)}" ${opt ? '' : 'data-req'} style="width:100%;border:1px solid #64748b;border-radius:8px;padding:8px 12px;font:inherit;margin:4px 0 12px"></textarea>`;
    if (ty === 'f') return L + `<input id="${i}" type="file" accept="${x}" data-req>`;
    return L + `<input id="${i}" type="${ty === 'n' ? 'number' : ty === 'p' ? 'password' : 'text'}" ${ty === 'n' ? `value="${x}" step="any"` : `placeholder="${esc(x)}"`} data-req>`; };
  app.innerHTML = `<nav class="crumb"><a href="#/">Beranda</a> / ${CATS[t[0]]} / <b>${t[2]}</b></nav><h1>${t[2]} <span class="badge">${CLOUD.has(id) ? 'Cloud' : 'Browser'}</span></h1><p>${t[3]}. Maks ${lim()} MB per file.${NOTE[id] ? ' <span class="mut">' + NOTE[id] + '</span>' : ''}</p>
  <div class="grid2"><div><label class="drop" id="drop" tabindex="0"><input id="fi" type="file" accept="${acc}" ${multi ? 'multiple' : ''} hidden>${ico('fileup')}<b>Seret &amp; lepas berkas ke sini</b><span>atau klik untuk memilih</span></label><ul id="fl" class="fl"></ul></div>
  <aside class="panel"><h2>Opsi</h2>${(OPTS[id] || []).map(fld).join('') || `<p class="mut">${multi ? 'Urutan mengikuti daftar berkas.' : 'Tidak ada opsi tambahan.'}</p>`}
  <button id="go" class="btn" disabled>Proses</button><div id="res" aria-live="polite"></div></aside></div>`;
  let files = [];
  const fl = () => { $('#fl').innerHTML = files.map((f, i) => `<li><span>${esc(f.name)} <small class="mut">${(f.size / 1048576).toFixed(2)} MB</small></span>${multi ? `<button class="btn o" data-i="${i}" data-a="u" aria-label="Naikkan">↑</button><button class="btn o" data-i="${i}" data-a="d" aria-label="Turunkan">↓</button>` : ''}<button class="btn o" data-i="${i}" data-a="x" aria-label="Hapus ${esc(f.name)}">×</button></li>`).join(''); $('#go').disabled = !files.length; };
  const add = list => {
    for (const f of list) {
      if (!okT(f)) { toast('Tipe file tidak didukung: ' + f.name); continue; }
      if (f.size > lim() * 1048576) { toast(f.name + ' melebihi ' + lim() + ' MB' + (S.user ? '' : '. Masuk untuk batas lebih besar.')); continue; }
      files = multi ? [...files, f] : [f];
    } fl();
  };
  const dz = $('#drop'); $('#fi').onchange = e => { add([...e.target.files]); e.target.value = ''; };
  dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fi').click(); } };
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave = () => dz.classList.remove('on');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('on'); add([...e.dataTransfer.files]); };
  $('#fl').onclick = e => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i, a = b.dataset.a;
    if (a === 'x') files.splice(i, 1); else { const j = a === 'u' ? i - 1 : i + 1; if (files[j]) [files[i], files[j]] = [files[j], files[i]]; } fl(); };
  const log = (st, msg) => api('logJob', { tool_id: id, status: st, ukuran_mb: +(files.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(2), pesan: msg });
  $('#go').onclick = async () => {
    const b = $('#go'), res = $('#res'); b.disabled = true; b.textContent = 'Memproses…'; res.innerHTML = '';
    try {
      const v = {}, x = {};
      for (const f of OPTS[id] || []) { const el = $('#f_' + f[0]); if (el.dataset.req !== undefined && !(f[2] === 'f' ? el.files.length : el.value.trim())) throw Error('Lengkapi: ' + f[1]); if (f[2] === 'f') x[f[0]] = el.files[0]; else v[f[0]] = el.value; }
      const out = await RUN[id](files, v, x); let h = '<p class="ok">Selesai</p><ul class="fl">';
      for (const [n, d] of out) { const bl = d instanceof Blob ? d : new Blob([await d.save()], { type: 'application/pdf' }), u = URL.createObjectURL(bl); h += `<li><span>${esc(n)} <small class="mut">${(bl.size / 1048576).toFixed(2)} MB</small></span><a class="btn" download="${esc(n)}" href="${u}">Unduh</a></li>`; }
      res.innerHTML = h + '</ul>'; log('completed', '');
    } catch (e) { res.innerHTML = `<p class="err">Gagal: ${esc(e.message)}</p>`; log('failed', e.message); }
    b.textContent = 'Proses'; b.disabled = !files.length;
  };
}
function masuk(mode) {
  const L = mode === 'login';
  app.innerHTML = `<div class="card1"><h1>${L ? 'Masuk' : 'Daftar'}</h1><form id="f">${L ? '' : '<label for="n">Nama</label><input id="n" required minlength="3">'}
  <label for="e">Email</label><input id="e" type="email" required autocomplete="email"><label for="p">Kata sandi</label><input id="p" type="password" required minlength="8" autocomplete="${L ? 'current-password' : 'new-password'}">
  <button class="btn" id="s" style="width:100%">${L ? 'Masuk' : 'Daftar'}</button></form>
  <p><a href="#/${L ? 'daftar' : 'masuk'}">${L ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</a></p><p><a href="#/">Lanjutkan sebagai Tamu</a></p></div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault(); const s = $('#s'); s.disabled = true;
    const r = await api(L ? 'login' : 'register', { nama: $('#n') ? $('#n').value : '', email: $('#e').value, password: $('#p').value }); s.disabled = false;
    if (!r.success) return toast(r.message || 'Gagal');
    if (!L) { toast('Akun dibuat. Silakan masuk.'); location.hash = '#/masuk'; return; }
    setAuth(r.data.token, r.data.user); location.hash = '#/';
  };
}
async function riwayat() {
  if (!S.user) { location.hash = '#/masuk'; return; }
  app.innerHTML = '<h1>Riwayat Pekerjaan</h1><div id="h">Memuat…</div>'; const r = await api('history');
  if (!r.success) { if (/sesi/i.test(r.message)) { setAuth('', null); location.hash = '#/masuk'; return; } $('#h').textContent = r.message; return; }
  $('#h').innerHTML = r.data.length ? `<div class="scroll"><table><thead><tr><th>Waktu</th><th>Tool</th><th>Ukuran</th><th>Status</th></tr></thead><tbody>${r.data.map(j => `<tr><td>${esc(j.waktu)}</td><td>${esc(j.tool_id)}</td><td>${esc(j.ukuran_mb)} MB</td><td><span class="badge ${j.status === 'failed' ? 'bad' : ''}">${esc(j.status)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p>Belum ada riwayat.</p>';
}
async function admin() {
  if (!S.user || S.user.peran !== 'admin') { location.hash = '#/'; toast('Halaman ini khusus admin.'); return; }
  app.innerHTML = '<h1>Dashboard Admin</h1><div id="a">Memuat…</div>';
  const [s, u] = await Promise.all([api('adminStats'), api('adminUsers')]);
  if (!s.success) { if (/sesi/i.test(s.message)) { setAuth('', null); location.hash = '#/masuk'; return; } $('#a').textContent = s.message; return; }
  const d = s.data, ok = d.perStatus.completed || 0, bad = d.perStatus.failed || 0, tools = Object.entries(d.perTool).sort((x, y) => y[1] - x[1]), mx = tools.length ? tools[0][1] : 1;
  const k = (n, l) => `<div class="card"><div><h3>${n}</h3><p>${l}</p></div></div>`;
  $('#a').innerHTML = `<div class="cards">${k(d.totalJobs, 'Total pekerjaan')}${k(d.totalUsers, 'Pengguna terdaftar')}${k(ok, 'Berhasil')}${k(bad, 'Gagal')}</div>
  <h2>Penggunaan per tool</h2>${tools.length ? `<div class="scroll"><table><thead><tr><th>Tool</th><th>Jumlah</th><th>Proporsi</th></tr></thead><tbody>${tools.map(([n, c]) => `<tr><td>${esc(n)}</td><td>${c}</td><td><progress value="${c}" max="${mx}" aria-label="${esc(n)}"></progress></td></tr>`).join('')}</tbody></table></div>` : '<p>Belum ada pekerjaan tercatat.</p>'}
  <h2>Pengguna</h2>${u.success ? `<div class="scroll"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Terdaftar</th></tr></thead><tbody>${u.data.map(x => `<tr><td>${esc(x.nama)}</td><td>${esc(x.email)}</td><td><span class="badge">${esc(x.peran)}</span></td><td>${esc(x.tgl_daftar)}</td></tr>`).join('')}</tbody></table></div>` : '<p>' + esc(u.message) + '</p>'}`;
}
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/'); renderTop(); window.scrollTo(0, 0);
  ({ masuk: () => masuk('login'), daftar: () => masuk('daftar'), riwayat, tool: () => tool(h[1]), admin }[h[0]] || home)();
}
addEventListener('hashchange', route); route();
