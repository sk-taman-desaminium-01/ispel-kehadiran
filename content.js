/* iSPEL Kehadiran Auto — engine automasi
 * Semua rujukan DOM dikumpulkan dalam SEL di bawah supaya mudah ditala
 * selepas struktur borang iSPEL sebenar dirakam (butang "Rakam Struktur").
 */
(() => {
  'use strict';
  if (window.__ispelVersi === '1.4.0') return;
  window.__ispelVersi = '1.5.0';

  const VERSI = '1.5.0';
  const JOB_KEY = 'ispelJob';

  /* ───────────────── 1. SELECTOR (calon; cuba satu demi satu) ───────────── */
  const SEL = {
    // Medan tarikh
    dateInput: [
      'input[type="date"]',
      'input[name*="tarikh" i]',
      'input[id*="tarikh" i]',
      'input[placeholder*="tarikh" i]',
      'input.datepicker',
      'input[name*="date" i]'
    ],
    // Butang papar/cari senarai selepas tukar tarikh
    // HANYA id khusus — JANGAN sekali-kali guna 'button[type=submit]' am,
    // kerana butang submit pertama pada halaman boleh jadi apa-apa (termasuk log keluar).
    searchButton: ['#btnCari', '#btnPapar', '#btnSearch'],
    searchButtonText: ['papar', 'cari', 'search', 'hantar', 'pilih'],

    // Baris murid
    table: ['table.table', 'table#jadual', 'table'],
    rows: ['tbody tr'],

    // Dalam satu baris
    nameCell: ['td'],                       // dikesan automatik: sel dengan teks nama terpanjang
    absentRadio: [
      'input[type="radio"][value*="TH" i]',
      'input[type="radio"][value="2"]',
      'input[type="radio"]'
    ],
    presentRadio: [
      'input[type="radio"][value*="H" i]',
      'input[type="radio"][value="1"]',
      'input[type="radio"]'
    ],
    statusSelect: ['select[name*="kehadiran" i]', 'select[name*="status" i]', 'select'],
    reasonSelect: ['select[name*="sebab" i]', 'select[name*="alasan" i]', 'select[name*="kategori" i]'],
    subReasonSelect: ['select[name*="jenis" i]', 'select[name*="sub" i]'],
    remarkInput: ['input[name*="catatan" i]', 'textarea[name*="catatan" i]', 'input[name*="nota" i]', 'textarea'],

    // Simpan & sahkan
    updateButton: ['#btnKemaskini'],
    updateButtonText: ['kemaskini', 'simpan', 'hantar', 'update'],
    confirmButtonText: ['ya', 'sahkan', 'ok', 'teruskan', 'confirm'],
    // Tindakan PENGESAHAN peringkat kedua (kuning "Menunggu" → hijau "Telah Disahkan")
    confirmActionText: ['sahkan kehadiran', 'hantar pengesahan', 'sahkan', 'pengesahan', 'verify', 'confirm'],
    successBanner: [
      '.alert-success', '.swal2-success', '.toast-success',
      '.text-success', '.bg-success', '.badge-success'
    ],

    // Petunjuk cuti / tidak boleh isi
    holidayText: [
      'cuti', 'kelepasan am', 'bukan hari sekolah', 'hari minggu',
      'tiada sesi', 'tiada kelas', 'cuti peristiwa', 'cuti penggal',
      'tidak dibenarkan', 'belum dibuka', 'tempoh telah tamat', 'hari ini bukan'
    ]
  };

  /* ───────────────── 2. Utiliti DOM ───────────────── */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

  function pick(cands, root = document) {
    for (const s of cands) {
      const el = root.querySelector(s);
      if (el && isVisible(el)) return el;
    }
    return null;
  }
  function pickAll(cands, root = document) {
    for (const s of cands) {
      const els = [...root.querySelectorAll(s)].filter(isVisible);
      if (els.length) return els;
    }
    return [];
  }
  function isVisible(el) {
    if (!el) return false;
    if (el.disabled) return true; // masih "ada", cuma tak boleh diklik
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && (r.width + r.height) > 0;
  }
  function byText(tags, words) {
    const els = [...document.querySelectorAll(tags)].filter(isVisible);
    for (const w of words) {
      const hit = els.find((e) => txt(e).toLowerCase().includes(w));
      if (hit) return hit;
    }
    return null;
  }
  // Butang yang TIDAK BOLEH diklik walau apa pun berlaku
  const JGN_KLIK = /log\s*keluar|logout|sign\s*out|^\s*keluar\s*$|padam|hapus|buang|delete|reset|batal|cancel|kembali|^\s*back\s*$|daftar|profil|tukar kata/i;
  function safeClick(el, sebab) {
    if (!el || el.disabled) return false;
    const t = txt(el);
    if (JGN_KLIK.test(t)) { console.warn('[iSPEL] klik DITOLAK:', t, sebab); return false; }
    el.click();
    return true;
  }

  // Hanya bertindak pada halaman kehadiran — bukan mana-mana halaman moeispel
  function halamanKehadiran() {
    return /kehadiran/i.test(location.pathname + location.hash);
  }

  function fire(el, types) {
    for (const t of types) el.dispatchEvent(new Event(t, { bubbles: true }));
  }
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(el, value) : (el.value = value);
    fire(el, ['input', 'change', 'blur']);
  }
  /* Padanan dropdown "paling hampir": tepat > awalan > terkandung >
     pertindihan perkataan > keserupaan trigram. Jadi "kesihatan" boleh jumpa
     "Masalah Kesihatan", "demam" jumpa "Demam / Selesema", dsb. */
  function trigram(a, b) {
    const g = (x) => { const r = new Set(); for (let i = 0; i < x.length - 2; i++) r.add(x.slice(i, i + 3)); return r; };
    const A = g(a), B = g(b);
    if (!A.size || !B.size) return 0;
    let n = 0; for (const x of A) if (B.has(x)) n++;
    return (2 * n) / (A.size + B.size);
  }
  function scoreOption(want, teks) {
    const W = norm(want), T = norm(teks);
    if (!W || !T) return 0;
    if (T === W) return 100;
    if (T.startsWith(W) || W.startsWith(T)) return 85;
    if (T.includes(W) || W.includes(T)) return 75;
    const wt = W.split(' '), tt = T.split(' ');
    const sama = wt.filter((x) => tt.some((y) => y === x || (x.length >= 4 && y.startsWith(x)) || (y.length >= 4 && x.startsWith(y)))).length;
    const overlap = sama ? (55 * sama) / Math.max(wt.length, tt.length) : 0;
    return Math.max(overlap, 70 * trigram(W, T));
  }
  // "Sila Pilih Kategori", "Sila Pilih Sebab", "- Pilih -" dll. BUKAN jawapan
  // Kenal "---SILA PILIH KATEGORI---", "- Pilih -", "--Sila Pilih Sebab--" dsb.
  // \b supaya "Pilihan Lain" TIDAK tersalah dianggap placeholder.
  const OPT_ABAI = /^\s*-*\s*(sila\s*pilih\b.*|pilih\b.*|choose\b.*|select\b.*|none|tiada|semua)?\s*-*\s*$/i;

  function bestOption(select, wants) {
    let best = null, bs = 0;
    for (const o of select.options) {
      const t = txt(o);
      if (OPT_ABAI.test(t.trim()) || o.disabled || o.value === '' || o.value === '0') continue;
      for (const w of wants.filter(Boolean)) {
        const sc = scoreOption(w, t);
        if (sc > bs) { bs = sc; best = o; }
      }
    }
    return bs >= 35 ? { opt: best, teks: txt(best), skor: Math.round(bs) } : null;
  }
  function chooseOption(select, wants) {
    const b = bestOption(select, wants);
    if (!b) return null;
    const label = b.teks + (b.skor < 100 ? ` (~${b.skor}%)` : '');
    // Sudah betul? JANGAN sentuh. Memilih semula nilai yang sama menyebabkan
    // iSPEL membina semula dropdown Sebab dan mengosongkannya.
    if (select.value === b.opt.value) return label + ' (sedia ada)';
    select.value = b.opt.value;
    fire(select, ['change']);   // 'input' juga = pengendali iSPEL berjalan 2×
    return label;
  }
  // Cari select yang pilihannya memang mengandungi apa yang kita mahu
  function selectByOptionText(root, wants, kecuali) {
    let best = null, bs = 0;
    for (const sel of root.querySelectorAll('select')) {
      if (sel === kecuali || sel.disabled) continue;
      const b = bestOption(sel, wants);
      if (b && b.skor > bs) { bs = b.skor; best = sel; }
    }
    return best;
  }

  async function waitFor(fn, timeout = 12000, step = 120) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  /* ───────────────── 3. Padanan nama ringkas ───────────────── */
  const norm = (s) => (s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "nur aisyah" padan dengan "NUR AISYAH BINTI AHMAD"; "nuraisyah" pun padan.
  function scoreName(short, full) {
    const F = norm(full), S = norm(short);
    if (!S || !F) return 0;
    const ftok = F.split(' ');
    const stok = S.split(' ');
    let hit = 0;
    for (const t of stok) {
      if (ftok.some((f) => f === t)) hit += 2;
      else if (ftok.some((f) => f.startsWith(t) && t.length >= 3)) hit += 1.5;
      else if (F.replace(/ /g, '').includes(t)) hit += 1;
      else return 0; // setiap perkataan mesti ada
    }
    return hit / stok.length + (F.startsWith(S) ? 0.5 : 0);
  }

  function matchRows(shortName, rows) {
    const scored = rows
      .map((r) => ({ row: r, name: r.__name, score: scoreName(shortName, r.__name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!scored.length) return { status: 'tiada' };
    if (scored.length > 1 && scored[1].score >= scored[0].score - 0.01) {
      return { status: 'kabur', calon: scored.slice(0, 4).map((x) => x.name) };
    }
    return { status: 'ok', hit: scored[0] };
  }

  /* ───────────────── 4. Baca senarai murid (jadual ATAU div berulang) ───── */
  // Kumpulkan baris ikut STRUKTUR (induk + tag + bilangan input), bukan kelas CSS —
  // supaya baris berselang (odd/even) tidak dipecahkan kepada dua kumpulan.
  function findRepeatedRows() {
    const groups = new Map();
    for (const el of document.querySelectorAll('tr, div, li')) {
      if (!el.querySelector('input, select')) continue;
      const parent = el.parentElement;
      if (!parent) continue;
      if (!groups.has(parent)) groups.set(parent, new Map());
      const g = groups.get(parent);
      const key = el.tagName + ':' + el.querySelectorAll('input, select').length;
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(el);
    }
    let best = [], bestScore = 0;
    for (const g of groups.values()) {
      for (const arr of g.values()) {
        const vis = arr.filter(isVisible);
        if (vis.length < 3) continue;
        const score = vis.filter((e) => rowName(e)).length;   // baris yang ada nama
        if (score > bestScore) { bestScore = score; best = vis; }
      }
    }
    return best;
  }

  // Buka senarai berhalaman supaya semua murid dipaparkan.
  // KETAT: hanya dropdown "bilangan baris" disentuh — bukan Kelas/Bulan/Tahun.
  const SAIZ_SAH = new Set([5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 500, 1000, -1]);
  function isLengthSelect(sel) {
    const opts = [...sel.options];
    if (opts.length < 2 || opts.length > 8) return false;
    return opts.every((o) => {
      if (/semua|all/i.test(o.textContent)) return true;
      const n = parseInt(o.value, 10);
      return Number.isFinite(n) && SAIZ_SAH.has(n) && String(n) === o.value.trim();
    });
  }

  async function expandList() {
    let changed = false;
    for (const sel of document.querySelectorAll('select')) {
      if (!isLengthSelect(sel)) continue;
      const opts = [...sel.options];
      const semua = opts.find((o) => /semua|all/i.test(o.textContent) || o.value === '-1');
      const terbesar = opts
        .map((o) => ({ o, n: parseInt(o.value, 10) }))
        .filter((x) => Number.isFinite(x.n) && x.n > 0)
        .sort((a, b) => b.n - a.n)[0];
      const kini = parseInt(sel.value, 10);
      const pilih = semua || (terbesar && (!Number.isFinite(kini) || terbesar.n > kini) ? terbesar.o : null);
      if (pilih && sel.value !== pilih.value) {
        sel.value = pilih.value;
        fire(sel, ['input', 'change']);
        changed = true;
      }
    }
    const btn = byText('button, a', ['papar semua', 'tunjuk semua', 'show all', 'semua murid']);
    if (btn) { btn.click(); changed = true; }
    if (changed) await sleep(900);
    return changed;
  }

  function paginationInfo() {
    const t = [...document.querySelectorAll('div, span, p, small')]
      .map((e) => txt(e))
      .find((x) => /(menunjukkan|showing|daripada|of)\s.*\d+/i.test(x) && x.length < 120);
    return t || null;
  }

  function rowName(el) {
    const cands = [];
    // Teks pilihan dropdown (contoh "MENGIKUT KELUARGA BERCUTI/BERKURSUS")
    // BUKAN nama murid — kumpulkan supaya boleh ditapis keluar.
    const teksPilihan = new Set();
    for (const sel of el.querySelectorAll('select')) {
      for (const o of sel.options) teksPilihan.add(norm(o.textContent));
    }
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script, style, button, select, textarea').forEach((n) => n.remove());
    const w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) cands.push(n.textContent);
    el.querySelectorAll('input[readonly], input[type=hidden], input[type=text]')
      .forEach((i) => cands.push(i.value));
    el.querySelectorAll('[title], [data-nama], [data-name], [aria-label]').forEach((e) => {
      cands.push(e.getAttribute('title'), e.getAttribute('data-nama'),
                 e.getAttribute('data-name'), e.getAttribute('aria-label'));
    });
    const bersih = [];
    for (const c of cands) {
      const t = (c || '').replace(/\s+/g, ' ').trim();
      if (/^\d+[.)]?$/.test(t)) continue;
      if (teksPilihan.has(norm(t))) continue;                 // teks dropdown
      const letters = (t.match(/[A-Za-z]/g) || []).length;
      if (letters >= 6 && t.split(' ').length >= 2) bersih.push(t);
    }
    // Nama murid Malaysia hampir pasti mengandungi BIN / BINTI / A/L / A/P
    const berbin = bersih.filter((t) => /\b(BIN|BINTI|A\/L|A\/P|AL)\b/i.test(t));
    const pilihan = berbin.length ? berbin : bersih;
    return pilihan.sort((a, b) => b.length - a.length)[0] || '';
  }

  function readRows() {
    let rows = [];
    const table = pick(SEL.table);
    if (table) rows = pickAll(SEL.rows, table).filter((tr) => tr.querySelectorAll('td').length >= 2);
    if (!rows.length) rows = findRepeatedRows();
    for (const r of rows) r.__name = rowName(r);
    return rows.filter((r) => r.__name);
  }

  /* Bila nama tidak dijumpai dalam senarai yang dibaca, cari ia pada SELURUH
     halaman dan laporkan bentuk barisnya. Inilah yang memberitahu kita kenapa
     baris itu terlepas daripada bacaan. */
  function jejakNama(pendek) {
    const P = norm(pendek);
    if (!P) return null;
    const dibaca = new Set(readRows());
    const jumpa = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (!norm(n.textContent).includes(P)) continue;
      const baris = n.parentElement && n.parentElement.closest('tr, li, .rowmurid, div');
      if (!baris) continue;
      jumpa.push({
        tag: baris.tagName,
        cls: (baris.className || '').toString().slice(0, 50),
        input: baris.querySelectorAll('input').length,
        select: baris.querySelectorAll('select').length,
        td: baris.querySelectorAll('td').length,
        nampak: isVisible(baris),
        dalamBacaan: dibaca.has(baris),
        namaDibaca: rowName(baris).slice(0, 60),
        induk: baris.parentElement ? baris.parentElement.tagName + '.' +
               (baris.parentElement.className || '').toString().slice(0, 30) : '-',
        html: (baris.outerHTML || '').replace(/>[^<>]{3,}</g, '>«t»<').slice(0, 400)
      });
      if (jumpa.length >= 2) break;
    }
    return jumpa.length ? jumpa : null;
  }

  function diagnose() {
    const table = pick(SEL.table);
    const rep = findRepeatedRows();
    return {
      adaJadual: !!table,
      barisJadual: table ? table.querySelectorAll('tbody tr').length : 0,
      kumpulanBerulang: rep.length,
      contohNamaBerulang: rep.slice(0, 3).map(rowName).filter(Boolean),
      iframe: [...document.querySelectorAll('iframe')].map((f) => f.src || '(tiada src)'),
      radio: document.querySelectorAll('input[type=radio]').length,
      checkbox: document.querySelectorAll('input[type=checkbox]').length,
      select: document.querySelectorAll('select').length,
      jumlahDikesan: readRows().length,
      infoHalaman: paginationInfo(),
      medanTarikh: (findDateField() || {}).kind || 'TIDAK DIJUMPAI',
      inventoriMedan: inventori(),
      teksCuti: holidayReason(),
      urlSemasa: location.href
    };
  }

  /* ───────────────── 5. Tanda satu baris ───────────────── */
  // Kenal pasti kawalan kehadiran dalam satu baris
  function kawalanKehadiran(tr) {
    const radios = [...tr.querySelectorAll('input[type="radio"]')].filter((r) => !r.disabled);
    if (radios.length >= 2) return { jenis: 'radio', radios };

    const cbs = [...tr.querySelectorAll('input[type="checkbox"]')].filter((c) => !c.disabled);
    if (cbs.length) {
      const lab = (c) => norm([c.labels && c.labels[0] ? c.labels[0].textContent : '',
        c.name || '', c.id || '', c.getAttribute('aria-label') || '',
        c.getAttribute('title') || ''].join(' '));
      const pilih = cbs.find((c) => /HADIR|KEHADIRAN|STATUS|ATTEND/.test(lab(c))) || cbs[0];
      return { jenis: 'checkbox', cb: pilih };
    }

    const sel = pick(SEL.statusSelect, tr);
    if (sel) return { jenis: 'select', sel };
    if (radios.length === 1) return { jenis: 'radio1', radios };
    return null;
  }

  async function markRow(tr, mode, opt) {
    // mode: 'tidak-hadir' | 'hadir'
    const wantTH = mode === 'tidak-hadir';
    const k = kawalanKehadiran(tr);
    if (!k) return { gagal: 'kawalan kehadiran tidak dijumpai dalam baris murid' };

    if (k.jenis === 'checkbox') {
      // iSPEL: DITANDA = HADIR. Untick = tidak hadir.
      const mahuDitanda = !wantTH;
      if (k.cb.checked !== mahuDitanda) {
        // click() sudah mencetuskan input+change secara semula jadi.
        // Menghantar 'change' tambahan menyebabkan iSPEL menambah dropdown
        // kategori DUA KALI, dan yang kedua kekal kosong.
        k.cb.click();
      }
      if (k.cb.checked !== mahuDitanda) {
        return { gagal: `checkbox kehadiran tidak dapat ${wantTH ? 'dibuka' : 'ditanda'}` };
      }
    } else if (k.jenis === 'radio') {
      const label = (r) => norm(
        (r.labels && r.labels[0] ? r.labels[0].textContent : '') + ' ' +
        (r.value || '') + ' ' + (r.getAttribute('aria-label') || ''));
      const isTH = (r) => /TIDAK|TH|ABSEN|2/.test(label(r)) && !/TIDAK ADA/.test(label(r));
      let target = wantTH ? k.radios.find(isTH) : k.radios.find((r) => !isTH(r));
      if (!target) target = wantTH ? k.radios[1] : k.radios[0];
      if (!target.checked) target.click();   // click() = input+change semula jadi
    } else if (k.jenis === 'select') {
      chooseOption(k.sel, wantTH ? [opt.statusTH || 'tidak hadir', 'tidak hadir', 'absent'] : ['hadir', 'present']);
    } else {
      if (wantTH === k.radios[0].checked) k.radios[0].click();
    }

    if (!wantTH) return { kawalan: k.jenis, sebab: null };

    // tunggu dropdown Kategori muncul — adaptif, bukan tidur tetap
    await waitFor(() => tr.querySelector('select') || dialogTerbuka(), 2500);

    // Skop carian: baris → dialog → bekas induk baris → seluruh halaman
    const skopList = () => [
      tr,
      document.querySelector('.swal2-popup, .modal.show, .modal[style*="block"]'),
      tr.parentElement,
      document
    ].filter(Boolean);

    // Dropdown mesti milik BARIS INI (atau kawalan peringkat halaman/dialog yang
    // tiada baris induk). Tanpa ini, carian bocor ke dropdown murid lain dan
    // baris ini ditinggalkan kosong — iSPEL kemudian tolak kemaskini.
    const milikBaris = (el) => {
      const baris = el.closest('tr, .rowmurid, li');
      return !baris || baris === tr;
    };
    /* Satu dropdown hanya diterima jika ia BENAR-BENAR mengandungi pilihan yang
       kita cari. Padanan ikut nama medan sahaja tidak selamat — dropdown kedua
       iSPEL bernama "Sebab", jadi carian nama boleh tersilap ambil yang sama. */
    const cariSelect = (wants, kecuali) => {
      for (const k2 of skopList()) {
        const akar = k2 === document ? document : k2;
        const calon = [];
        try { calon.push(...akar.querySelectorAll(SEL.reasonSelect.join(','))); } catch (_) { /* abaikan */ }
        const ikutKandungan = selectByOptionText(akar, wants, kecuali);
        if (ikutKandungan) calon.push(ikutKandungan);
        for (const hit of calon) {
          if (hit === kecuali || hit.disabled || !milikBaris(hit)) continue;
          if (!bestOption(hit, wants)) continue;        // mesti ada jawapan di dalamnya
          return hit;
        }
      }
      return null;
    };

    // (a) KATEGORI — iSPEL: "Sila Pilih Kategori"
    let sebab = null, jenis = null;
    const katWants = [opt.sebab, 'masalah kesihatan', 'kesihatan', 'sakit'];
    const rs = await waitFor(() => cariSelect(katWants, null), 3000) || cariSelect(katWants, null);
    if (rs) sebab = chooseOption(rs, katWants);

    // (b) SEBAB — dropdown kedua, muncul/terisi selepas kategori dipilih
    const sebWants = [opt.jenis, 'demam', 'selesema'];
    const ss = await waitFor(() => {
      const kandidat = cariSelect(sebWants, rs);
      // mesti benar-benar ada pilihan yang berguna, bukan sekadar "Sila Pilih Sebab"
      return kandidat && bestOption(kandidat, sebWants) ? kandidat : null;
    }, 4000);
    if (ss) jenis = chooseOption(ss, sebWants);

    if (!jenis) {
      for (const k2 of skopList()) {
        if (k2 === document) break;
        const rm = pick(SEL.remarkInput, k2);
        if (rm && milikBaris(rm)) { setValue(rm, opt.jenis); jenis = opt.jenis + ' (catatan)'; break; }
      }
    }

    if (!sebab) return { kawalan: k.jenis, sebab, jenis, gagal: 'dropdown Kategori tidak dijumpai' };
    if (!jenis) return { kawalan: k.jenis, sebab, jenis, gagal: 'dropdown Sebab (kedua) tidak dijumpai' };

    // Tiada dropdown kosong yang tertinggal dalam baris ini
    await sleep(120);
    const kosong = [...tr.querySelectorAll('select')]
      .filter((x) => isVisible(x) && !x.disabled)
      .filter((x) => !x.value || OPT_ABAI.test(txt(x.options[x.selectedIndex] || {}).trim()));
    if (kosong.length) {
      return { kawalan: k.jenis, sebab, jenis,
        gagal: `${kosong.length} dropdown masih kosong dalam baris ini (iSPEL akan tolak kemaskini)` };
    }
    return { kawalan: k.jenis, sebab, jenis };
  }

  /* ───────────────── 6. Kesan cuti / tak boleh isi ───────────────── */
  function holidayReason() {
    const main = txt(document.querySelector('main, .content, #content, body')).toLowerCase();
    for (const w of SEL.holidayText) {
      if (main.includes(w)) return w;
    }
    return null;
  }

  /* ───────────────── 7. Tetapkan tarikh ───────────────── */
  const PATS_TKH = /tarikh|tkh|date|picker|calendar|kalendar/i;

  function findDateField() {
    const cands = [...document.querySelectorAll('input')].filter(isVisible)
      .filter((e) => !['radio', 'checkbox', 'hidden', 'submit', 'button'].includes(e.type));
    const attr = (e) => [e.name, e.id, (e.className || '').toString(),
      e.getAttribute('placeholder') || '', e.getAttribute('aria-label') || ''].join(' ');

    let el = cands.find((e) => e.type === 'date');
    if (el) return { kind: 'date', el };
    el = cands.find((e) => PATS_TKH.test(attr(e)));
    if (el) return { kind: 'teks', el };
    el = cands.find((e) => /^\s*\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\s*$/.test(e.value || ''));
    if (el) return { kind: 'teks', el };
    el = cands.find((e) => /dd[-/]mm|mm[-/]dd|yyyy/i.test(e.getAttribute('placeholder') || ''));
    if (el) return { kind: 'teks', el };
    el = cands.find((e) => e.labels && e.labels[0] && PATS_TKH.test(txt(e.labels[0])));
    if (el) return { kind: 'teks', el };

    // tiga dropdown: hari / bulan / tahun
    const sels = [...document.querySelectorAll('select')].filter(isVisible);
    const f = (re) => sels.find((x) => re.test([x.name, x.id, (x.className || '').toString()].join(' ')));
    const hari = f(/^(?!.*bulan).*(hari|day)/i), bulan = f(/bulan|month/i), tahun = f(/tahun|year/i);
    if (bulan && (hari || tahun)) return { kind: 'select3', hari, bulan, tahun };
    return null;
  }

  // Senarai medan yang ADA pada halaman — supaya ralat membawa bukti, bukan tekaan
  function inventori(had = 22) {
    return [...document.querySelectorAll('input, select')].filter(isVisible)
      .filter((e) => !['hidden'].includes(e.type)).slice(0, had).map((e) => {
        const b = [e.tagName.toLowerCase() + (e.type ? ':' + e.type : '')];
        if (e.name) b.push('name=' + e.name);
        if (e.id) b.push('id=' + e.id);
        const c = (e.className || '').toString().trim();
        if (c) b.push('cls=' + c.slice(0, 34));
        const ph = e.getAttribute('placeholder');
        if (ph) b.push('ph=' + ph);
        if (e.tagName === 'SELECT') b.push('opt=' + [...e.options].slice(0, 4).map((o) => txt(o)).join('/'));
        else if (e.value && !/^\d{6,}$/.test(e.value)) b.push('val=' + String(e.value).slice(0, 18));
        return '[' + b.join(' ') + ']';
      }).join(' ');
  }

  async function applyDate(iso) {
    const f = findDateField();
    if (!f) {
      return { ok: false, sistemik: true, msg: 'Medan tarikh tidak dijumpai. MEDAN PADA HALAMAN: ' + inventori() +
        ` || baris murid dikesan: ${findRepeatedRows().length}, iframe: ${document.querySelectorAll('iframe').length}` };
    }
    const before = readRows().length;
    const [y, m, d] = iso.split('-');

    if (f.kind === 'select3') {
      if (f.hari) chooseOption(f.hari, [String(+d), d]);
      if (f.bulan) chooseOption(f.bulan, [String(+m), m, BULAN_NAMA[+m - 1]]);
      if (f.tahun) chooseOption(f.tahun, [y]);
    } else if (f.kind === 'date') {
      setValue(f.el, iso);
    } else {
      /* HANYA DD/MM/YYYY. iSPEL menolak format lain dengan dialog merah
         "Format Tarikh Tidak Sah". Cuba semula dengan format yang SAMA. */
      const bentuk = `${d}/${m}/${y}`;
      const betul = () => (f.el.value || '').trim() === bentuk;
      for (let cuba = 0; cuba < 3 && !betul(); cuba++) {
        f.el.focus();
        setValue(f.el, bentuk);
        fire(f.el, ['keyup']);
        f.el.blur();
        await sleep(450);
      }
      if (!betul()) {
        return { ok: false, msg: `Medan tarikh menolak "${bentuk}" (kekal "${f.el.value}")` };
      }
    }
    await sleep(150);

    const btn = pick(SEL.searchButton) || byText('button, a.btn, input[type=button]', SEL.searchButtonText);
    safeClick(btn, 'papar senarai');
    await sleep(300);

    const dlgTarikh = dialogTerbuka();
    if (dlgTarikh && /format\s*tarikh/i.test(txt(dlgTarikh))) {
      klikDialog(dlgTarikh, ['ok', 'tutup']);
      await sleep(400);
      return { ok: false, sistemik: true,
        msg: `iSPEL menolak format tarikh yang dihantar ("${f.el ? f.el.value : '?'}") — ${bersihTeks(txt(dlgTarikh)).slice(0, 110)}` };
    }
    await waitFor(() => document.readyState === 'complete', 8000);

    /* Tunggu senarai murid benar-benar SIAP: bilangan baris mesti sama dua
       kali berturut-turut. Tanpa ini, senarai dibaca semasa AJAX masih memuat
       dan murid kelihatan "tiada dalam senarai". */
    let sebelumnya = -1, stabil = 0;
    await waitFor(() => {
      if (holidayReason() && !readRows().length) return true;
      const n = readRows().length;
      stabil = (n > 0 && n === sebelumnya) ? stabil + 1 : 0;
      sebelumnya = n;
      return stabil >= 1 ? true : null;
    }, 8000, 200);

    // Borang mesti benar-benar menunjukkan tarikh yang diminta
    if (f.kind !== 'select3' && f.el) {
      const adaDigit = (f.el.value || '').replace(/\D/g, '');
      const mahu1 = `${d}${m}${y}`, mahu2 = `${y}${m}${d}`;
      if (adaDigit && adaDigit !== mahu1 && adaDigit !== mahu2) {
        return { ok: false, msg: `Borang menunjukkan tarikh "${f.el.value}" sedangkan yang diminta ${d}/${m}/${y} — dibatalkan demi keselamatan` };
      }
    }
    return { ok: true, medan: f.kind, bilMurid: readRows().length };
  }

  const BULAN_NAMA = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  /* ─────────── 8. Kemaskini → Sahkan (kuning → hijau) ─────────── */

  function dialogTerbuka() {
    return [...document.querySelectorAll('.swal2-popup, .modal.show, .modal[style*="block"], [role="dialog"]')]
      .find(isVisible) || null;
  }
  /* Pilih ikut KEUTAMAAN dalam senarai `kata`, bukan susunan butang pada skrin.
     Dialog iSPEL ada "Batal | Simpan | Sahkan" — Simpan kekal kuning,
     Sahkan yang menjadikannya hijau. */
  function klikDialog(d, kata) {
    const btns = [...d.querySelectorAll('button, a, input[type=button], input[type=submit]')]
      .filter(isVisible)
      .filter((b) => txt(b) || b.value);
    for (const w of kata) {
      const btn = btns.find((b) => (txt(b) || b.value || '').toLowerCase().trim() === w) ||
                  btns.find((b) => (txt(b) || b.value || '').toLowerCase().includes(w));
      if (btn && safeClick(btn, 'dialog:' + w)) return txt(btn) || btn.value;
    }
    return null;
  }

  /* Tutup apa-apa dialog yang tertinggal terbuka. Modal yang terbuka
     menghalang SEMUA klik pada tarikh berikutnya. "Batal" dibenarkan di sini
     kerana membatalkan dialog tergantung adalah tindakan selamat. */
  async function tutupDialogTertinggal(had = 5) {
    let bil = 0;
    for (let i = 0; i < had; i++) {
      const d = dialogTerbuka();
      if (!d) break;
      const btns = [...d.querySelectorAll('button, a, input[type=button], input[type=submit]')]
        .filter(isVisible);
      const cari = (w) => btns.find((b) => (txt(b) || b.value || '').toLowerCase().trim() === w);
      const btn = cari('ok') || cari('tutup') || cari('close') || cari('selesai') || cari('batal') ||
                  d.querySelector('.swal2-confirm, .swal2-close, .close, [data-dismiss="modal"]');
      if (!btn) break;
      btn.click();                     // sengaja memintas JGN_KLIK: ini penutupan sahaja
      bil++;
      await sleep(300);
    }
    return bil;
  }

  /* Uruskan rantaian dialog iSPEL:
     "Adakah anda pasti?" → Ya  →  "Berjaya" → OK */
  async function uruskanDialog(opt = {}, pusingan = 4) {
    let akhir = null;
    for (let i = 0; i < pusingan; i++) {
      const d = await waitFor(dialogTerbuka, i === 0 ? 2500 : 1200);
      if (!d) return akhir;
      const t = txt(d).slice(0, 200);
      // SweetAlert2 meletakkan SEMUA ikon dalam DOM dan menyembunyikan yang
      // tidak digunakan — jadi kewujudan sahaja tidak bermakna apa-apa.
      const adaIkonRalat = [...d.querySelectorAll('.swal2-icon-error, .swal2-error')].some(isVisible);
      const adaIkonJaya = [...d.querySelectorAll('.swal2-icon-success, .swal2-success')].some(isVisible);

      if (adaIkonRalat || (/ralat|error|gagal|tidak dibenarkan|unauthor|csrf/i.test(t) && !/berjaya/i.test(t))) {
        klikDialog(d, ['ok', 'tutup', 'close']);
        await sleep(500);
        return { jenis: 'ralat', teks: t };
      }
      if (adaIkonJaya || /berjaya|success|tersimpan|telah disahkan/i.test(t)) {
        klikDialog(d, ['ok', 'tutup', 'close', 'selesai']);
        await sleep(350);
        akhir = { jenis: 'berjaya', teks: t };
        continue;   // mungkin ada dialog lain selepasnya
      }
      if (/pasti|adakah|yakin|confirm|sahkan|simpan|teruskan/i.test(t)) {
        const kata = opt.sahkan === false
          ? ['simpan', 'ya', 'ok', 'teruskan', 'confirm']
          : ['sahkan', 'ya', 'ok', 'teruskan', 'confirm', 'simpan'];
        const ditekan = klikDialog(d, kata);
        if (!ditekan) return { jenis: 'tersekat', teks: t };
        akhir = { jenis: 'soalan-dijawab', teks: t, butang: ditekan };
        await sleep(500);
        continue;
      }
      return { jenis: 'tidak dikenali', teks: t };
    }
    return akhir;
  }


  // Status dibaca dari TEKS, bukan warna — jauh lebih tepat
  function statusSekarang() {
    let siap = null, menunggu = null;
    for (const e of document.querySelectorAll('span, div, td, p, small, label, b, strong, h4, h5, .badge, .label, .chip')) {
      if (!isVisible(e)) continue;
      const t = txt(e);
      if (!t || t.length > 90) continue;
      if (/telah\s*disahkan|sudah\s*disahkan|^disahkan$/i.test(t)) {
        if (!siap || t.length < siap.length) siap = t;
      } else if (/menunggu\s*pengesahan|belum\s*disahkan|menunggu\s*sah|pending/i.test(t)) {
        if (!menunggu || t.length < menunggu.length) menunggu = t;
      }
    }
    return { siap, menunggu };
  }

  // Murid yang ditanda tidak hadir tetapi dropdownnya belum lengkap
  function barisTidakLengkap() {
    const senarai = [];
    for (const tr of readRows()) {
      const k = kawalanKehadiran(tr);
      if (!k) continue;
      const tidakHadir = k.jenis === 'checkbox' ? !k.cb.checked
        : k.jenis === 'radio' ? k.radios.some((r) => r.checked && /TIDAK|TH/i.test(r.value || ''))
        : false;
      if (!tidakHadir) continue;
      const kosong = [...tr.querySelectorAll('select')]
        .filter((x) => isVisible(x) && !x.disabled)
        .filter((x) => !x.value || OPT_ABAI.test(txt(x.options[x.selectedIndex] || {}).trim()));
      if (kosong.length) senarai.push(`${tr.__name} (${kosong.length} dropdown kosong)`);
    }
    return senarai;
  }
  function inventoriButang() {
    return [...document.querySelectorAll('button, a.btn, input[type=button], input[type=submit], .badge, .label')]
      .filter(isVisible).map((b) => txt(b)).filter((t) => t && t.length < 40)
      .slice(0, 20).map((t) => `"${t}"`).join(' ');
  }

  function adaHijau() {
    return [...document.querySelectorAll('.alert-success, .swal2-success, .text-success, .bg-success, .badge-success')]
      .find(isVisible) || null;
  }

  async function saveAndConfirm(opt = {}) {
    // ── Peringkat 1: Kemaskini ──
    const btn = byText('button, input[type=submit], a.btn', SEL.updateButtonText) || pick(SEL.updateButton);
    if (!btn) return { ok: false, msg: 'Butang Kemaskini tidak dijumpai | BUTANG: ' + inventoriButang() };
    if (btn.disabled) return { ok: false, msg: 'Butang Kemaskini dimatikan (mungkin cuti/tutup)' };
    if (!safeClick(btn, 'kemaskini')) return { ok: false, msg: 'Butang kemaskini ditolak oleh penapis keselamatan' };
    await sleep(250);

    const d1 = await uruskanDialog(opt);
    if (d1 && d1.jenis === 'ralat') return jadikanRalat(d1.teks);
    if (d1 && d1.jenis === 'tersekat') return { ok: false, msg: 'Dialog tersekat selepas Kemaskini: ' + d1.teks };

    /* iSPEL sendiri berkata "telah berjaya disimpan dan disahkan" — itu bukti
       muktamad. Jangan tunggu lencana halaman bertukar, ia mungkin lambat. */
    if (d1 && d1.jenis === 'berjaya' && /disahkan/i.test(d1.teks)) {
      await tutupDialogTertinggal();
      return { ok: true, msg: 'DISAHKAN — ' + bersihTeks(d1.teks).slice(0, 140) };
    }
    if (d1 && d1.jenis === 'berjaya' && opt.sahkan === false && /disimpan|berjaya/i.test(d1.teks)) {
      return { ok: true, msg: 'disimpan (belum disahkan ikut tetapan) — ' + bersihTeks(d1.teks).slice(0, 120) };
    }
    const ralat1 = bacaRalat();
    if (ralat1) return ralat1;

    // ── Peringkat 2: Sahkan ──
    let st = await waitFor(() => { const x = statusSekarang(); return (x.siap || x.menunggu) ? x : null; }, 6000)
             || statusSekarang();
    if (st.siap) {
      return { ok: true, msg: 'disahkan — ' + st.siap +
        (d1 && d1.butang ? ` (dialog: "${d1.butang}")` : '') };
    }
    if (opt.sahkan === false) {
      return { ok: true, msg: 'dikemaskini, pengesahan dilangkau ikut tetapan' + (st.menunggu ? ` (${st.menunggu})` : '') };
    }

    const skop = document.querySelector('.swal2-popup, .modal.show, .modal[style*="block"]') || document;

    // tanda kotak perakuan jika ada ("Saya mengesahkan…")
    for (const cb of skop.querySelectorAll('input[type=checkbox]')) {
      const lab = norm((cb.labels && cb.labels[0] ? cb.labels[0].textContent : '') + ' ' +
                       (cb.getAttribute('aria-label') || ''));
      if (!cb.checked && /SAH|AKUI|PERAKUAN|BENAR/.test(lab)) { cb.click(); await sleep(150); }
    }

    /* Butang pengesahan peringkat halaman. Yang berskop LUAS (laporan, bulanan,
       mingguan, keseluruhan) TIDAK disentuh — aliran betul ialah melalui dialog
       Batal|Simpan|Sahkan. Menekan "Sahkan dan Simpan Laporan" boleh mengesahkan
       lebih daripada sehari. */
    /* "Sahkan dan Simpan Laporan" DIBENARKAN — buktinya dialog & mesej kejayaan
       iSPEL kedua-duanya menyebut SATU tarikh ("Pengesahan Kehadiran Harian
       10/08/2026", "kehadiran kelas bertarikh 10/08/2026 telah ... disahkan").
       Yang masih disekat hanyalah skop yang jelas melebihi sehari. */
    const SKOP_LUAS = /bulanan|mingguan|keseluruhan|semua\s+tarikh|penggal|tahunan/i;

    /* Kumpul calon butang pengesahan, susun ikut KEUTAMAAN:
       teks tepat "sahkan" > "sahkan kehadiran" > mengandungi "sahkan" > lain.
       Butang yang dimatikan diletak di belakang — jangan ambil yang mati
       sedangkan ada yang hidup. */
    const calonSahkan = () => [...document.querySelectorAll('button, a, input[type=button], input[type=submit]')]
      .filter(isVisible)
      .filter((b) => b !== btn)
      .filter((b) => {
        const t = (txt(b) || b.value || '').toLowerCase();
        return SEL.confirmActionText.some((w) => t.includes(w)) &&
               !SEL.updateButtonText.some((w) => t === w) && !SKOP_LUAS.test(t);
      })
      .sort((a, b2) => {
        const ta = (txt(a) || a.value || '').toLowerCase().trim();
        const tb = (txt(b2) || b2.value || '').toLowerCase().trim();
        const skor = (t, e) => (e.disabled ? 0 : 100) + (t === 'sahkan' ? 40 : 0) +
          (t.startsWith('sahkan') ? 20 : 0) + (t.length < 20 ? 10 : 0);
        return skor(tb, b2) - skor(ta, a);
      });

    // Tunggu sehingga ada calon yang HIDUP (butang selalunya hidup lewat sedikit)
    let sahBtn = await waitFor(() => calonSahkan().find((b) => !b.disabled), 5000);

    /* Masih tiada yang hidup? Kemungkinan besar iSPEL mahu Kemaskini disimpan
       dahulu. Tekan Kemaskini sekali lagi, uruskan dialognya, kemudian cuba
       semula — menyimpan dua kali tidak merosakkan apa-apa. */
    if (!sahBtn) {
      const semula = byText('button, input[type=submit], a.btn', SEL.updateButtonText) || pick(SEL.updateButton);
      if (semula && !semula.disabled && safeClick(semula, 'kemaskini ulangan')) {
        await sleep(300);
        const dUlang = await uruskanDialog(opt);
        if (dUlang && dUlang.jenis === 'ralat') return jadikanRalat(dUlang.teks);
        if (dUlang && dUlang.jenis === 'berjaya' && /disahkan/i.test(dUlang.teks)) {
          await tutupDialogTertinggal();
          return { ok: true, msg: 'DISAHKAN pada cubaan kedua — ' + bersihTeks(dUlang.teks).slice(0, 130) };
        }
        sahBtn = await waitFor(() => calonSahkan().find((b) => !b.disabled), 5000);
      }
    }

    const ditolakSkop = [...document.querySelectorAll('button, a')]
      .filter(isVisible)
      .filter((b) => SKOP_LUAS.test(txt(b) || b.value || ''));
    const calonMati = calonSahkan().filter((b) => b.disabled)
      .map((b) => `"${txt(b) || b.value}"`);

    if (!sahBtn) {
      if (!st.menunggu) {
        const h = adaHijau();
        if (h) return { ok: true, msg: txt(h).slice(0, 120) || 'pengesahan hijau' };
      }
      const belum = barisTidakLengkap();
      return { ok: false, msg: 'Dikemaskini tetapi tidak disahkan.' +
        (calonMati.length ? ` Butang pengesahan DIMATIKAN: ${calonMati.join(', ')}.` : ' Butang pengesahan tidak dijumpai.') +
        (belum.length ? ` ${belum.length} baris tidak lengkap: ${belum.slice(0, 3).join(' ; ')}.` : '') +
        (ditolakSkop.length ? ` Diabaikan kerana skop luas: "${txt(ditolakSkop[0])}".` : '') +
        ` Dialog selepas Kemaskini: ${d1 ? d1.jenis + ' — ' + bersihTeks(d1.teks).slice(0, 60) : 'TIADA dialog muncul'}.` +
        ` Status: ${st.menunggu || 'tidak diketahui'} | BUTANG: ${inventoriButang()}` };
    }

    const namaBtn = txt(sahBtn) || sahBtn.value;
    if (!safeClick(sahBtn, 'sahkan')) {
      return { ok: false, msg: `Butang "${namaBtn}" ditolak penapis keselamatan (senarai larangan JGN_KLIK)` };
    }
    await sleep(250);

    const d2 = await uruskanDialog(opt);
    if (d2 && d2.jenis === 'ralat') return jadikanRalat(d2.teks);
    if (d2 && d2.jenis === 'tersekat') return { ok: false, msg: 'Dialog tersekat selepas Sahkan: ' + d2.teks };
    const ralat2 = bacaRalat();
    if (ralat2) return ralat2;
    if (d2 && d2.jenis === 'berjaya' && !statusSekarang().menunggu) {
      return { ok: true, msg: `disahkan (tekan "${namaBtn}") — ${bersihTeks(d2.teks).slice(0, 100)}` };
    }

    const st2 = await waitFor(() => (statusSekarang().siap ? statusSekarang() : null), 5000);
    if (st2) {
      await tutupDialogTertinggal();          // WAJIB: jangan tinggalkan modal terbuka
      return { ok: true, msg: `disahkan (tekan "${namaBtn}") — ${st2.siap}` };
    }

    // sama di sini: hijau hanya dipercayai bila tiada lagi status "menunggu"
    if (!statusSekarang().menunggu) {
      const h2 = adaHijau();
      if (h2) return { ok: true, msg: `disahkan (tekan "${namaBtn}") — ${txt(h2).slice(0, 90)}` };
    }

    return { ok: false, msg: `Ditekan "${namaBtn}" tetapi status masih: ${statusSekarang().menunggu || 'tidak diketahui'} | BUTANG: ${inventoriButang()}` };
  }

  // Buang label butang yang terikut dalam teks dialog
  function bersihTeks(t) {
    return String(t || '')
      .replace(/\s*\b(Batal|Simpan|Sahkan|OK|Ok|Tutup|Close|Ya|Tidak)\b\s*/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function jadikanRalat(teks) {
    const sesiMati = /csrf|token|session|sesi|expired|luput|unauthenticated|unauthorized|419|log\s*masuk/i.test(teks);
    return {
      ok: false, sistemik: sesiMati,
      msg: (sesiMati ? 'SESI ISPEL TERPUTUS — ' : 'Ralat dari iSPEL — ') + teks.slice(0, 160) +
           (sesiMati ? ' | Muat semula halaman & log masuk semula sebelum cuba lagi.' : '')
    };
  }

  // Baca kotak ralat dalam halaman (bukan dialog).
  // WAJIB isVisible: SweetAlert2 menyimpan ikon ralat tersembunyi dalam DOM,
  // dan kewujudannya sahaja pernah menyebabkan ralat PALSU dilaporkan.
  function bacaRalat() {
    const ralat = [...document.querySelectorAll('.swal2-icon-error, .swal2-error, .alert-danger, .toast-error')]
      .find(isVisible);
    if (!ralat) return null;
    const kotak = ralat.closest('.swal2-popup, .modal, .alert') || ralat;
    const teks = txt(kotak).replace(/\s*OK\s*$/i, '').trim().slice(0, 160);
    const okBtn = kotak.querySelector('.swal2-confirm, button');
    if (okBtn && /^\s*(ok|tutup|close)\s*$/i.test(txt(okBtn))) okBtn.click();
    const sesiMati = /csrf|token|session|sesi|expired|luput|unauthenticated|unauthorized|419|log\s*masuk/i.test(teks);
    return {
      ok: false, sistemik: sesiMati,
      msg: (sesiMati ? 'SESI ISPEL TERPUTUS — ' : 'Ralat dari iSPEL — ') + teks +
           (sesiMati ? ' | Muat semula halaman & log masuk semula sebelum cuba lagi.' : '')
    };
  }

  /* ───────────────── 9. Proses satu tarikh ───────────────── */
  async function processDate(iso, names, job) {
    const log = (status, msg, extra) => ({ tarikh: iso, status, msg, ...extra });

    if (!names.length && job.opt.langkauKosong) {
      return log('skip', 'tiada nama diisi untuk tarikh ini');
    }

    // Dialog tertinggal daripada tarikh sebelumnya menghalang semua klik
    const disapu = await tutupDialogTertinggal();

    const d = await applyDate(iso);
    if (!d.ok) return log('gagal', d.msg, d.sistemik ? { sistemik: true } : undefined);

    await expandList();
    const cuti = holidayReason();
    let rows = readRows();
    if (cuti && !rows.length) return log('skip', `dilangkau — sistem sebut "${cuti}"`);
    if (!rows.length) return log('skip', 'tiada senarai murid (kemungkinan cuti / belum dibuka)');

    const absen = [], isu = [];
    for (const item of names) {
      // Nama dari Portal SKTD bawa kategori/sebab SENDIRI (per murid). Nama
      // ditaip manual (rentetan biasa) guna lalai global job.opt.sebab/jenis
      // — keserasian ke belakang dengan setiap job lama yang tersimpan.
      const nama = typeof item === 'string' ? item : item.nama;
      const optNama = (typeof item === 'object' && (item.kategori || item.sebab))
        ? { ...job.opt, sebab: item.kategori || job.opt.sebab, jenis: item.sebab || job.opt.jenis }
        : job.opt;
      const m = matchRows(nama, rows);
      if (m.status === 'tiada') {
        const jejak = jejakNama(nama);
        isu.push(`"${nama}" tiada dalam ${rows.length} murid yang dibaca. ` +
          (jejak
            ? 'JEJAK: ' + JSON.stringify(jejak[0])
            : 'Nama itu TIDAK WUJUD langsung pada halaman ini.'));
        continue;
      }
      if (m.status === 'kabur') { isu.push(`"${nama}" kabur → ${m.calon.join(' | ')}`); continue; }
      const r = await markRow(m.hit.row, 'tidak-hadir', optNama);
      if (r.gagal) { isu.push(`"${nama}" = ${m.hit.name} → ${r.gagal}`); continue; }
      m.hit.row.__done = true;
      absen.push(`${m.hit.name} [${r.kawalan}] (${r.sebab}/${r.jenis})`);
    }

    if (isu.length && job.opt.berhentiJikaIsu) {
      return log('gagal', 'ada murid tidak dapat ditanda — TIADA APA dikemaskini', { isu });
    }
    if (!absen.length && names.length) {
      return log('gagal', 'tiada seorang pun berjaya ditanda — kemaskini dibatalkan', { isu });
    }

    // Mod TAMBAH (tandaHadirLain = false): murid lain TIDAK disentuh sama sekali,
    // jadi tanda tidak hadir yang sudah ada (contoh: HAKEEM) kekal.
    if (job.opt.tandaHadirLain) {
      for (const tr of rows) if (!tr.__done) await markRow(tr, 'hadir', job.opt);
    }

    const s = await saveAndConfirm(job.opt);
    await tutupDialogTertinggal();          // bersihkan untuk tarikh seterusnya
    return log(s.ok ? 'berjaya' : 'gagal',
      s.msg + (disapu ? ` [${disapu} dialog tertinggal ditutup dahulu]` : ''), {
      tidakHadir: absen, isu: isu.length ? isu : undefined,
      sistemik: s.sistemik || undefined
    });
  }

  /* ───────────────── 10. Enjin kerja (tahan muat semula halaman) ───────── */
  async function runJob() {
    let { [JOB_KEY]: job } = await chrome.storage.local.get(JOB_KEY);
    if (!job || job.status !== 'running') return;
    if (!halamanKehadiran()) {
      job.status = 'berhenti';
      job.log.push({ tarikh: '-', status: 'gagal', msg: 'bukan halaman kehadiran — kerja dihentikan' });
      await chrome.storage.local.set({ [JOB_KEY]: job });
      return;
    }

    while (job.index < job.entries.length) {
      const fresh = (await chrome.storage.local.get(JOB_KEY))[JOB_KEY];
      if (!fresh || fresh.status !== 'running') return;      // pengguna tekan Henti
      job = fresh;

      const { tarikh: iso, names = [] } = job.entries[job.index];
      let entry;
      try { entry = await processDate(iso, names, job); }
      catch (e) { entry = { tarikh: iso, status: 'gagal', msg: 'ralat: ' + e.message }; }

      job.log.push(entry);
      job.index += 1;
      if (entry.sistemik) {
        entry.msg += ' — KERJA DIHENTIKAN (masalah sama akan berulang pada semua tarikh)';
        job.status = 'berhenti';
        await chrome.storage.local.set({ [JOB_KEY]: job });
        return;
      }
      if (entry.status === 'gagal' && job.opt.berhentiJikaGagal) {
        job.status = 'berhenti';
        await chrome.storage.local.set({ [JOB_KEY]: job });
        return;
      }
      await chrome.storage.local.set({ [JOB_KEY]: job });
      await sleep((job.opt.jedaMs || 900) + Math.random() * 400);
    }
    job.status = 'selesai';
    await chrome.storage.local.set({ [JOB_KEY]: job });
  }

  /* ───────────────── 11. Rakam struktur (untuk tala selector) ───────────── */
  function dumpStructure() {
    const mask = (s) => (s || '')
      .replace(/\d/g, '#')
      .replace(/\b[A-Z][a-z]+(?:\s+(?:bin|binti|a\/l|a\/p)\s+[A-Z][a-z]+)+/gi, '«NAMA»');
    const el = (e) => ({
      tag: e.tagName.toLowerCase(),
      type: e.type || null,
      id: e.id || null,
      name: e.getAttribute('name') || null,
      cls: (e.className || '').toString().slice(0, 80) || null,
      placeholder: e.getAttribute('placeholder') || null,
      label: e.labels && e.labels[0] ? mask(txt(e.labels[0])).slice(0, 60) : null,
      options: e.tagName === 'SELECT'
        ? [...e.options].slice(0, 25).map((o) => `${o.value}=${txt(o).slice(0, 40)}`) : undefined
    });

    const table = pick(SEL.table);
    const rows = table ? [...table.querySelectorAll('tbody tr')].slice(0, 2) : [];

    const rep = findRepeatedRows();
    return {
      url: location.href,
      tajuk: mask(document.title),
      diagnostik: diagnose(),
      sampelBarisBerulang: rep.slice(0, 2).map((r) =>
        mask(r.outerHTML).replace(/>[^<>]{3,}</g, '>«teks»<').slice(0, 2500)),
      medan: [...document.querySelectorAll('input, select, textarea')].filter(isVisible).map(el),
      butang: [...document.querySelectorAll('button, input[type=submit], input[type=button], a.btn')]
        .filter(isVisible).map((b) => ({ teks: txt(b).slice(0, 40), id: b.id || null, cls: (b.className || '').slice(0, 60) })),
      jadual: {
        pengepala: table ? [...table.querySelectorAll('thead th')].map((t) => txt(t).slice(0, 40)) : [],
        bilBaris: table ? table.querySelectorAll('tbody tr').length : 0,
        contohBarisHTML: rows.map((r) => mask(r.outerHTML).replace(/>[^<>]{3,}</g, '>«teks»<').slice(0, 2500))
      },
      teksAmaran: [...document.querySelectorAll('.alert, .swal2-html-container, .badge, .label')]
        .filter(isVisible).map((a) => mask(txt(a)).slice(0, 120)).slice(0, 15)
    };
  }

  window.__ispelTest = {
    readRows, rowName, findRepeatedRows, diagnose, expandList, findDateField, applyDate, inventori,
    markRow, saveAndConfirm, processDate, statusSekarang, inventoriButang, kawalanKehadiran, uruskanDialog, barisTidakLengkap, jejakNama, tutupDialogTertinggal, scoreName, matchRows, scoreOption, bestOption
  };

  /* ───────────────── 12. Mesej dari popup ───────────────── */
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg.cmd === 'ping') { reply({ ok: true, versi: VERSI, url: location.href }); return true; }
    if (msg.cmd === 'dump') { reply({ ok: true, data: dumpStructure() }); return true; }
    if (msg.cmd === 'rows') {
      expandList().then(() =>
        reply({ ok: true, versi: VERSI, nama: readRows().map((r) => r.__name), diag: diagnose() }));
      return true;
    }
    if (msg.cmd === 'start') { runJob().then(() => {}); reply({ ok: true }); return true; }
    return false;
  });

  /* TIADA sambung semula automatik.
     Kalau halaman dimuat semula sementara kerja berjalan, kerja itu DIBEKUKAN
     dan pengguna perlu menekan Teruskan sendiri. Ini menghalang pusingan
     klik-refresh-klik yang boleh membatalkan sesi iSPEL. */
  chrome.storage.local.get(JOB_KEY).then(({ [JOB_KEY]: job }) => {
    if (job && job.status === 'running') {
      job.status = 'terhenti';
      job.log.push({ tarikh: '-', status: 'skip',
        msg: 'halaman dimuat semula — kerja dibekukan, tekan Teruskan untuk sambung' });
      chrome.storage.local.set({ [JOB_KEY]: job });
    }
  });
})();
