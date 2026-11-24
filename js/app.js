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
const READY = new Set(['merge','split','remove','extract','rotate','jpg2pdf']);

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
const RUN = {
  async merge(fs) { const o = await PDFDocument.create(); for (const f of fs) { const d = await load(f); (await o.copyPages(d, d.getPageIndices())).forEach(p => o.addPage(p)); } return [['gabungan.pdf', o]]; },
  async split(fs, v) { const d = await load(fs[0]); return Promise.all(parse(v.range, d.getPageCount()).map(async (ix, i) => ['bagian-' + (i + 1) + '.pdf', await pick(d, ix)])); },
  async extract(fs, v) { const d = await load(fs[0]); return [['ekstrak.pdf', await pick(d, parse(v.range, d.getPageCount()).flat())]]; },
  async remove(fs, v) { const d = await load(fs[0]), del = new Set(parse(v.range, d.getPageCount()).flat()), keep = d.getPageIndices().filter(i => !del.has(i)); if (!keep.length) throw Error('Semua halaman akan terhapus.'); return [['tanpa-halaman.pdf', await pick(d, keep)]]; },
  async rotate(fs, v) { const d = await load(fs[0]); d.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + +v.deg) % 360))); return [['diputar.pdf', d]]; },
  async jpg2pdf(fs) { const o = await PDFDocument.create(); for (const f of fs) { const b = await f.arrayBuffer(), img = /png$/i.test(f.name) ? await o.embedPng(b) : await o.embedJpg(b); o.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height }); } return [['gambar.pdf', o]]; }
};

// ---- Tampilan ----
function renderTop() {
  $('#top').innerHTML = `<a class="logo" href="#/"><b>P</b> PDF CONVERTER</a><nav><a href="#/">Semua Tools</a><a href="#/riwayat">Riwayat</a>${S.user && S.user.peran === 'admin' ? '<a href="#/admin">Admin</a>' : ''}</nav>
  <div class="who"><span class="chip">${S.user ? esc(S.user.nama) + ' · ' + maxMB() + ' MB' : 'Tamu · maks ' + maxMB() + ' MB'}</span>
  ${S.user ? '<button id="out" class="btn o">Keluar</button>' : '<a class="btn" href="#/masuk">Masuk</a>'}</div>`;
  const o = $('#out'); if (o) o.onclick = () => { api('logout'); setAuth('', null); location.hash = '#/'; };
}
const card = t => { const r = READY.has(t[1]); return `<a class="card ${r ? '' : 'off'}" ${r ? `href="#/tool/${t[1]}"` : 'aria-disabled="true"'}><span class="badge">${r ? 'Browser' : 'Segera hadir'}</span><h3>${t[2]}</h3><p>${t[3]}</p></a>`; };
function home() {
  app.innerHTML = `<section class="hero"><h1>Semua tools PDF dalam satu tempat</h1><p>Proses langsung di browser Anda. File tidak diunggah.</p>
  <label class="sr" for="q">Cari tool</label><input id="q" type="search" placeholder="Cari tool, mis. Gabung PDF"></section><div id="cats"></div>`;
  const draw = q => { $('#cats').innerHTML = CATS.map((c, i) => { const l = T.filter(t => t[0] === i && (t[2] + t[3]).toLowerCase().includes(q)); return l.length ? `<section class="cat"><h2>${c} <span class="mut">(${l.length})</span></h2><div class="cards">${l.map(card).join('')}</div></section>` : ''; }).join('') || '<p>Tool tidak ditemukan.</p>'; };
  draw(''); $('#q').oninput = e => draw(e.target.value.toLowerCase());
}
function tool(id) {
  const t = T.find(x => x[1] === id); if (!t || !READY.has(id)) { location.hash = '#/'; return; }
  const img = id === 'jpg2pdf', multi = id === 'merge' || img;
  const opt = { split: 'Rentang halaman (tiap rentang jadi file terpisah), mis. 1-3,4-6', extract: 'Halaman yang diambil, mis. 1-3,5', remove: 'Halaman yang dihapus, mis. 2,4-5' }[id];
  app.innerHTML = `<nav class="crumb"><a href="#/">Beranda</a> / ${CATS[t[0]]} / <b>${t[2]}</b></nav><h1>${t[2]} <span class="badge">Browser</span></h1><p>${t[3]}. Maks ${maxMB()} MB per file.</p>
  <div class="grid2"><div><label class="drop" id="drop" tabindex="0"><input id="fi" type="file" accept="${img ? 'image/jpeg,image/png' : 'application/pdf'}" ${multi ? 'multiple' : ''} hidden><b>Seret &amp; lepas berkas ke sini</b><span>atau klik untuk memilih</span></label><ul id="fl" class="fl"></ul></div>
  <aside class="panel"><h2>Opsi</h2>${opt ? `<label for="rg">${opt}</label><input id="rg" placeholder="1-3,5">` : ''}
  ${id === 'rotate' ? '<label for="dg">Putar searah jarum jam</label><select id="dg"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select>' : ''}
  ${!opt && id !== 'rotate' ? `<p class="mut">${multi ? 'Urutan mengikuti daftar berkas.' : 'Tidak ada opsi tambahan.'}</p>` : ''}
  <button id="go" class="btn" disabled>Proses</button><div id="res"></div></aside></div>`;
  let files = [];
  const fl = () => { $('#fl').innerHTML = files.map((f, i) => `<li><span>${esc(f.name)} <small class="mut">${(f.size / 1048576).toFixed(2)} MB</small></span>${multi ? `<button class="btn o" data-i="${i}" data-a="u" aria-label="Naikkan">↑</button><button class="btn o" data-i="${i}" data-a="d" aria-label="Turunkan">↓</button>` : ''}<button class="btn o" data-i="${i}" data-a="x" aria-label="Hapus ${esc(f.name)}">×</button></li>`).join(''); $('#go').disabled = !files.length; };
  const add = list => {
    for (const f of list) {
      const okT = img ? /^image\/(jpeg|png)$/.test(f.type) : f.type === 'application/pdf';
      if (!okT) { toast('Tipe file tidak didukung: ' + f.name); continue; }
      if (f.size > maxMB() * 1048576) { toast(f.name + ' melebihi ' + maxMB() + ' MB' + (S.user ? '' : '. Masuk untuk batas lebih besar.')); continue; }
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
      const v = { range: $('#rg') ? $('#rg').value : '', deg: $('#dg') ? $('#dg').value : 0 };
      if ($('#rg') && !v.range.trim()) throw Error('Isi halaman terlebih dahulu.');
      const out = await RUN[id](files, v); let h = '<p class="ok">Selesai</p><ul class="fl">';
      for (const [n, d] of out) { const u = URL.createObjectURL(new Blob([await d.save()], { type: 'application/pdf' })); h += `<li><span>${n}</span><a class="btn" download="${n}" href="${u}">Unduh</a></li>`; }
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
  const k = (n, l) => `<div class="card"><h3>${n}</h3><p>${l}</p></div>`;
  $('#a').innerHTML = `<div class="cards">${k(d.totalJobs, 'Total pekerjaan')}${k(d.totalUsers, 'Pengguna terdaftar')}${k(ok, 'Berhasil')}${k(bad, 'Gagal')}</div>
  <h2>Penggunaan per tool</h2>${tools.length ? `<div class="scroll"><table><thead><tr><th>Tool</th><th>Jumlah</th><th>Proporsi</th></tr></thead><tbody>${tools.map(([n, c]) => `<tr><td>${esc(n)}</td><td>${c}</td><td><progress value="${c}" max="${mx}" aria-label="${esc(n)}"></progress></td></tr>`).join('')}</tbody></table></div>` : '<p>Belum ada pekerjaan tercatat.</p>'}
  <h2>Pengguna</h2>${u.success ? `<div class="scroll"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Terdaftar</th></tr></thead><tbody>${u.data.map(x => `<tr><td>${esc(x.nama)}</td><td>${esc(x.email)}</td><td><span class="badge">${esc(x.peran)}</span></td><td>${esc(x.tgl_daftar)}</td></tr>`).join('')}</tbody></table></div>` : '<p>' + esc(u.message) + '</p>'}`;
}
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/'); renderTop(); window.scrollTo(0, 0);
  ({ masuk: () => masuk('login'), daftar: () => masuk('daftar'), riwayat, tool: () => tool(h[1]), admin }[h[0]] || home)();
}
addEventListener('hashchange', route); route();
