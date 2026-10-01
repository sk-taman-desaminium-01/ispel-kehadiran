const VERSI = '1.6.1';
const JOB_KEY = 'ispelJob', PREF = 'ispelPref';

/* ───── Pemecah nama: SEMUA aksara bukan huruf adalah pemisah, KECUALI jarak.
   Jarak bermakna nama itu 2–3 perkataan. Jadi "1. aidan 2. hakeem",
   "aidan, hakeem", "aidan. hakeem", "aidan / hakeem", "- aidan" semua betul,
   manakala "FAYYADH ALISYA" kekal SATU nama.                              ───── */
function parseNames(raw) {
  let s = String(raw || '');
  s = s.replace(/[\r\n\t;|]+/g, ',');                       // baris baharu & ; | = pemisah
  s = s.replace(/(^|[\s,])[-–—•*·]+(?=[\s,]|$)/g, ' , ');     // bullet "- nama"
  s = s.replace(/[^\p{L}\s'’\-]+/gu, ',');                   // nombor, / , @ , tanda baca = pemisah
  return s.split(',')
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => (t.match(/\p{L}/gu) || []).length >= 2);   // buang serpihan "a", "l"
}

const $ = (id) => document.getElementById(id);
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const DEF_DAYS = [1, 2, 3, 4, 5];

let entries = [];   // [{ tarikh, names: [] }] — names kekal RENTETAN biasa
let roster = null;  // nama murid dari jadual iSPEL (untuk semakan)

/**
 * Kategori/sebab PER NAMA, ditarik dari Portal SKTD — bukan disimpan dalam
 * `entries` (yang kekal rentetan biasa untuk paparan/sunting sedia ada).
 * { [tarikh]: { [namaLowerCase]: { kategori, sebab } } }
 *
 * Dipetakan ke bentuk `{nama,kategori,sebab}` HANYA semasa `mulakan()`
 * membina job untuk content.js — supaya UI sedia ada (kotak teks
 * dipisah-koma) langsung tidak berubah.
 */
let metaPortal = {};

const PORTAL_ASAL = ['https://sktd.edu.my/portal', 'https://portal.sktd.edu.my/portal'];

$('days').innerHTML = HARI.map((h, i) =>
  `<label><input type="checkbox" class="d" value="${i}" ${DEF_DAYS.includes(i) ? 'checked' : ''}>${h.slice(0, 3)}</label>`
).join('');

/* ───── simpan/pulih tetapan ───── */
const TXT = ['from', 'to', 'skip', 'sebab', 'jenis', 'kelasPortal'];
const CHK = ['sahkan', 'hadirLain', 'kosong', 'stopIsu', 'stopGagal'];
(async () => {
  const { [PREF]: p } = await chrome.storage.local.get(PREF);
  if (p) {
    TXT.forEach((f) => { if (p[f] != null) $(f).value = p[f]; });
    CHK.forEach((k) => { if (p[k] != null) $(k).checked = p[k]; });
    if (p.days) document.querySelectorAll('.d').forEach((c) => (c.checked = p.days.includes(+c.value)));
    if (p.entries?.length) { entries = p.entries; drawSched(); }
    if (p.from && p.to) buildSchedule(true);   // selaraskan baris dengan julat tarikh sebenar
  }
  const today = new Date().toISOString().slice(0, 10);
  if (!$('from').value) $('from').value = today;
  if (!$('to').value) $('to').value = today;
  render();
})();

/**
 * Semak versi baharu — extension dipasang secara manual (Load unpacked),
 * jadi Chrome TIDAK kemas kini automatik. Fail kecil ini dikemas kini oleh
 * sekolah setiap kali versi baharu diterbitkan; kalau berbeza daripada
 * VERSI di sini, tunjuk notis dengan pautan ke panduan (muat turun +
 * pasang semula — sama seperti pasang kali pertama).
 */
(async () => {
  try {
    const r = await fetch('https://sktd.edu.my/ispel-kehadiran-versi.json', { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j.versi && j.versi !== VERSI) {
      const el = $('kemaskini');
      el.hidden = false;
      el.innerHTML = `🔔 Versi baharu (${j.versi}) tersedia — anda guna v${VERSI}. ` +
        `<a href="${j.pautan || 'https://sktd.edu.my/bantuan-ispel'}" target="_blank" rel="noreferrer">Kemas kini di sini →</a>`;
    }
  } catch (_) { /* tiada internet / tapak tidak dapat dicapai — senyap sahaja */ }
})();
function savePref() {
  const p = { days: days(), entries: collect() };
  TXT.forEach((f) => (p[f] = $(f).value));
  CHK.forEach((k) => (p[k] = $(k).checked));
  chrome.storage.local.set({ [PREF]: p });
}
const dmy = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const namaHari = (iso) => HARI[new Date(iso + 'T12:00').getDay()];
const days = () => [...document.querySelectorAll('.d:checked')].map((c) => +c.value);

/* ───── langkah 1: bina jadual ───── */
function buildSchedule(senyap) {
  try {
    const from = $('from').value, to = $('to').value;
    if (!from || !to) throw new Error('Pilih tarikh dari & hingga');
    if (to < from) throw new Error('Tarikh "hingga" lebih awal daripada "dari"');
    const dd = days();
    if (!dd.length) throw new Error('Pilih sekurang-kurangnya satu hari');
    const skip = new Set([
      ...($('skip').value.match(/\d{4}-\d{2}-\d{2}/g) || []),
      ...($('skip').value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g) || [])
        .map((x) => { const [d2, m2, y2] = x.split('/'); return `${y2}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`; })
    ]);
    const lama = Object.fromEntries(collect().map((e) => [e.tarikh, e.names]));
    const out = [];
    for (const d = new Date(from + 'T12:00'); d <= new Date(to + 'T12:00'); d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (dd.includes(d.getDay()) && !skip.has(iso)) out.push({ tarikh: iso, names: lama[iso] || [] });
    }
    if (!out.length) throw new Error('Tiada tarikh selepas ditapis');
    entries = out; drawSched(); savePref();
    const berisi = out.filter((e) => e.names.length).length;
    $('echo').textContent =
      `${dmy(out[0].tarikh)} (${namaHari(out[0].tarikh)})  →  ${dmy(out[out.length - 1].tarikh)} (${namaHari(out[out.length - 1].tarikh)})  ·  ${out.length} hari`;
    msg(`${out.length} tarikh siap${berisi ? ` · ${berisi} sudah ada nama` : ''} — isi nama bagi setiap tarikh.`);
  } catch (e) { if (!senyap) msg('⚠️ ' + e.message); }
}
$('build').onclick = () => buildSchedule(false);
['from', 'to'].forEach((id) => { $(id).onchange = () => buildSchedule(true); });
document.querySelectorAll('.d').forEach((c) => c.addEventListener('change', () => buildSchedule(true)));

/* ───── langkah 2: jadual nama ───── */
function drawSched() {
  $('step2').hidden = $('step3').hidden = false;
  $('sched').innerHTML = entries.map((e) => {
    const d = new Date(e.tarikh + 'T12:00');
    return `<div class="srow">
      <div class="sdate"><b>${dmy(e.tarikh)}</b><span>${HARI[d.getDay()]}</span></div>
      <input type="text" class="sn" data-date="${e.tarikh}" value="${e.names.join(', ').replace(/"/g, '&quot;')}" placeholder="— semua hadir —">
      <span class="mark" data-m="${e.tarikh}"></span>
    </div>`;
  }).join('');
  $('sched').oninput = (ev) => {
    if (!ev.target.classList.contains('sn')) return;
    collect(); savePref(); if (roster) verify();
  };
  if (roster) verify();
}

// Sumber kebenaran tunggal: nilai sebenar dalam kotak input.
function collect() {
  const inps = [...document.querySelectorAll('.sn')];
  if (inps.length) {
    entries = inps.map((i) => ({
      tarikh: i.dataset.date,
      names: parseNames(i.value)
    }));
  }
  return entries;
}

/**
 * Tarik senarai murid tidak hadir yang SUDAH DISAHKAN guru kelas di Portal
 * SKTD — gantikan taip manual. Guru kelas mesti sudah log masuk
 * portal.sktd.edu.my di TAB LAIN Chrome yang sama; kuki sesi Clerk itu
 * dihantar sendiri oleh pelayar (`credentials:'include'`) — tiada token
 * berasingan diperlukan. Lihat `sktd-portal/src/app/api/kehadiran/route.ts`.
 */
async function tarikDariPortal() {
  let kelas = $('kelasPortal').value.trim();

  // Baca kelas TERUS dari dropdown iSPEL — ia dieja penuh ("TAHUN DUA
  // MAJU") manakala Portal guna nombor ("2 MAJU"). Taipan manual pengguna
  // (yang menyalin apa dia NAMPAK di iSPEL) hampir selalu tidak sepadan
  // format Portal, dan itu punca "tiada nama ditarik" yang paling kerap.
  try {
    const k = await send('kelas');
    if (k?.portal) {
      if (k.portal !== kelas) {
        $('kelasPortal').value = k.portal;
        kelas = k.portal;
        savePref();
        msg(`Kelas dikesan dari iSPEL: "${k.mentah}" → "${k.portal}"`);
      }
    }
  } catch (_) { /* iSPEL belum dibuka / kelas belum dipilih — guna taipan manual */ }

  if (!kelas) { msg('⚠️ Buka iSPEL & pilih kelas dahulu, atau isi nama Kelas manual (Langkah 1)'); return; }
  collect();
  if (!entries.length) { msg('⚠️ Bina jadual dahulu (Langkah 1)'); return; }

  let ok = 0, belumSah = 0, ralat = 0, ralatContoh = '';
  for (const e of entries) {
    let res = null, gagalSemua = true;
    for (const asal of PORTAL_ASAL) {
      try {
        res = await fetch(`${asal}/api/kehadiran?kelas=${encodeURIComponent(kelas)}&tarikh=${e.tarikh}`, { credentials: 'include' });
        gagalSemua = false;
        break;
      } catch (_) { /* cuba asal seterusnya */ }
    }
    if (gagalSemua || !res) { ralat++; ralatContoh = ralatContoh || 'Sambungan ke Portal gagal — semak internet.'; continue; }
    if (res.status === 401) { ralat++; ralatContoh = 'Log masuk portal.sktd.edu.my di tab lain Chrome dahulu, kemudian cuba lagi.'; continue; }
    if (!res.ok) { ralat++; ralatContoh = ralatContoh || `Portal memulangkan ${res.status}.`; continue; }
    const j = await res.json().catch(() => null);
    if (!j) { ralat++; ralatContoh = ralatContoh || 'Jawapan Portal tidak difahami.'; continue; }
    if (!j.disahkan) { belumSah++; continue; }

    metaPortal[e.tarikh] = {};
    for (const t of j.tidakHadir) metaPortal[e.tarikh][t.nama.toLowerCase()] = { kategori: t.kategori, sebab: t.sebab };
    e.names = j.tidakHadir.map((t) => t.nama);
    ok++;
  }

  drawSched(); savePref();
  msg(`Ditarik dari Portal — ${ok} tarikh disahkan, ${belumSah} belum disahkan, ${ralat} ralat` +
    (ralatContoh ? ` (${ralatContoh})` : ''));
}
$('tarikPortal').onclick = () => void tarikDariPortal();

$('fillall').onclick = () => {
  const names = parseNames($('bulk').value);
  entries = collect().map((e) => ({ ...e, names: [...names] }));
  drawSched(); savePref();
};

/* ───── semakan nama vs senarai kelas ───── */
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
function score(short, full) {
  const F = norm(full), S = norm(short);
  if (!S || !F) return 0;
  const ftok = F.split(' '), stok = S.split(' ');
  let hit = 0;
  for (const t of stok) {
    if (ftok.includes(t)) hit += 2;
    else if (ftok.some((f) => f.startsWith(t) && t.length >= 3)) hit += 1.5;
    else if (F.replace(/ /g, '').includes(t)) hit += 1;
    else return 0;
  }
  return hit / stok.length + (F.startsWith(S) ? 0.5 : 0);
}
function matchOne(short) {
  const s = roster.map((n) => ({ n, v: score(short, n) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  if (!s.length) return { st: 'tiada' };
  if (s.length > 1 && s[1].v >= s[0].v - 0.01) return { st: 'kabur', c: s.slice(0, 3).map((x) => x.n) };
  return { st: 'ok', n: s[0].n };
}
function verify() {
  const lines = [];
  collect().forEach((e) => {
    const bad = [];
    e.names.forEach((nm) => {
      const m = matchOne(nm);
      if (m.st === 'ok') lines.push(`${dmy(e.tarikh)}  ✓ ${nm} → ${m.n}`);
      else if (m.st === 'kabur') { bad.push(nm); lines.push(`${dmy(e.tarikh)}  ⚠ "${nm}" kabur → ${m.c.join(' | ')}`); }
      else { bad.push(nm); lines.push(`${dmy(e.tarikh)}  ✗ "${nm}" tiada dalam senarai`); }
    });
    const mk = $('sched').querySelector(`[data-m="${e.tarikh}"]`);
    if (mk) { mk.textContent = !e.names.length ? '' : bad.length ? '⚠' : '✓'; mk.className = 'mark ' + (bad.length ? 'bad' : 'good'); }
  });
  $('log').textContent = lines.join('\n') || '(tiada nama diisi)';
}
$('check').onclick = async () => {
  try {
    const r = await send('rows');
    roster = r.nama || [];
    if (!roster.length) {
      const d = r.diag || {};
      $('log').textContent =
        'DIAGNOSTIK — senarai murid tidak dikenali\n' +
        `  <table> dijumpai      : ${d.adaJadual ? 'ya' : 'TIDAK'}\n` +
        `  baris dalam <table>   : ${d.barisJadual}\n` +
        `  baris berulang (div)  : ${d.kumpulanBerulang}\n` +
        `  contoh nama dikesan   : ${(d.contohNamaBerulang || []).join(' | ') || '(tiada)'}\n` +
        `  radio / checkbox / select : ${d.radio} / ${d.checkbox} / ${d.select}\n` +
        `  iframe                : ${(d.iframe || []).length ? (d.iframe || []).join(', ') : 'tiada'}\n` +
        `  teks cuti dikesan     : ${d.teksCuti || 'tiada'}\n` +
        `  URL                   : ${d.urlSemasa || ''}`;
      return msg('⚠️ Senarai tidak dikenali — lihat diagnostik di bawah.');
    }
    verify();
    const d = r.diag || {};
    // Sentiasa lapor keadaan medan tarikh — inilah yang menghalang Teruskan
    const tambah = [
      '',
      '─── KEADAAN HALAMAN ───',
      `murid dikesan : ${roster.length}`,
      `halaman       : ${d.infoHalaman || '(tiada info)'}`,
      `medan tarikh  : ${d.medanTarikh}`,
      `iframe        : ${(d.iframe || []).length ? (d.iframe || []).join(', ') : 'tiada'}`,
      d.medanTarikh === 'TIDAK DIJUMPAI' ? `MEDAN ADA     : ${d.inventoriMedan}` : ''
    ].filter((x) => x !== '').join('\n');
    $('log').textContent += '\n' + tambah;
    msg(`${roster.length} murid · medan tarikh: ${d.medanTarikh}`);
  } catch (e) { msg('⚠️ ' + e.message); }
};

/* ───── langkah 3: jalankan ───── */
let versiDisemak = false;
async function pastikanVersiSama(tabId) {
  if (versiDisemak) return;
  let r = null;
  try { r = await chrome.tabs.sendMessage(tabId, { cmd: 'ping' }); } catch (_) { r = null; }
  if (!r) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await new Promise((x) => setTimeout(x, 400));
    try { r = await chrome.tabs.sendMessage(tabId, { cmd: 'ping' }); } catch (_) { r = null; }
  }
  if (!r) throw new Error('Halaman tidak menjawab — tekan Cmd+R pada tab iSPEL.');
  if (r.versi !== VERSI) {
    throw new Error(`KOD LAMA MASIH BERJALAN pada tab iSPEL (v${r.versi || '?'}, sepatutnya v${VERSI}). ` +
      'Tekan Cmd+R pada tab iSPEL, kemudian cuba lagi. JANGAN jalankan — hasilnya tidak boleh dipercayai.');
  }
  versiDisemak = true;
}

async function send(cmd, extra = {}) {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!t || !/^https:\/\/moeispel\.moe\.gov\.my\//.test(t.url || '')) {
    throw new Error('Buka tab iSPEL dahulu (sahsiah/kehadiran/tabguru)');
  }
  await pastikanVersiSama(t.id);
  try {
    const r = await chrome.tabs.sendMessage(t.id, { cmd, ...extra });
    if (r) return r;
    throw new Error('tiada balasan');
  } catch (_) {
    // Content script belum disuntik (tab dibuka sebelum extension dipasang/dimuat semula).
    msg('Menyambung ke halaman iSPEL…');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: t.id, allFrames: true }, files: ['content.js']
      });
    } catch (e) {
      throw new Error('Gagal menyuntik ke halaman: ' + e.message + ' — muat semula tab iSPEL (Cmd+R).');
    }
    await new Promise((r) => setTimeout(r, 500));
    const r2 = await chrome.tabs.sendMessage(t.id, { cmd, ...extra });
    if (!r2) throw new Error('Halaman tidak menjawab — muat semula tab iSPEL (Cmd+R) dan cuba lagi.');
    return r2;
  }
}

async function mulakan(hanyaSatu) {
  try {
    collect();
    if (!entries.length) throw new Error('Bina jadual dahulu');
    const senarai = $('kosong').checked ? entries.filter((e) => e.names.length) : entries;
    if (!senarai.length) {
      throw new Error('Tiada tarikh berisi nama — pastikan nama ditaip dalam kotak bersebelahan tarikh, dipisah dengan koma');
    }
    const kerja = hanyaSatu ? senarai.slice(0, 1) : senarai;
    await chrome.storage.local.set({ [JOB_KEY]: {
      status: 'running', index: 0, entries: kerja, log: [],
      opt: {
        sebab: $('sebab').value.trim() || 'Masalah Kesihatan',
        jenis: $('jenis').value.trim() || 'Demam',
        sahkan: $('sahkan').checked,
        tandaHadirLain: $('hadirLain').checked,
        langkauKosong: $('kosong').checked,
        berhentiJikaIsu: $('stopIsu').checked,
        berhentiJikaGagal: hanyaSatu ? true : $('stopGagal').checked,
        jedaMs: 900
      }
    }});
    await send('start');
    msg(hanyaSatu
      ? `Ujian — ${dmy(kerja[0].tarikh)} (${namaHari(kerja[0].tarikh)}) · ${kerja[0].names.length} nama`
      : `Berjalan — ${kerja.length} tarikh: ${dmy(kerja[0].tarikh)} → ${dmy(kerja[kerja.length - 1].tarikh)}`);
  } catch (e) { msg('⚠️ ' + e.message); }
}
$('test').onclick = () => mulakan(true);
$('start').onclick = () => mulakan(false);

$('stop').onclick = async () => {
  const { [JOB_KEY]: job } = await chrome.storage.local.get(JOB_KEY);
  if (job) { job.status = 'berhenti'; await chrome.storage.local.set({ [JOB_KEY]: job }); }
  msg('Dihentikan.');
};

$('dump').onclick = async () => {
  try {
    const r = await send('dump');
    const json = JSON.stringify(r.data, null, 2);
    await navigator.clipboard.writeText(json);
    $('log').textContent = json.slice(0, 4000);
    msg('✅ Struktur disalin ke clipboard — tampal kepada Claude.');
  } catch (e) { msg('⚠️ ' + e.message); }
};

document.addEventListener('change', savePref);
function msg(t) { $('status').textContent = t; }

async function render() {
  const { [JOB_KEY]: job } = await chrome.storage.local.get(JOB_KEY);
  if (!job?.log) return;
  const b = job.log.filter((l) => l.status === 'berjaya').length;
  const s = job.log.filter((l) => l.status === 'skip').length;
  const g = job.log.filter((l) => l.status === 'gagal').length;
  const label = job.status === 'selesai'
    ? (g ? `Selesai dengan ${g} gagal` : `✅ BERJAYA — ${b} tarikh dikemaskini`)
    : job.status;
  msg(`${label} · ${job.log.length}/${job.entries.length} · ✅${b} ⏭${s} ❌${g}`);
  $('log').textContent = job.log.map((l) =>
    `${l.tarikh === '-' ? '-' : dmy(l.tarikh)} ${l.status === 'berjaya' ? '✅' : l.status === 'skip' ? '⏭' : '❌'} ${l.msg}` +
    (l.tidakHadir?.length ? `\n   TH: ${l.tidakHadir.join('; ')}` : '') +
    (l.isu?.length ? `\n   ⚠ ${l.isu.join('\n   ⚠ ')}` : '')
  ).join('\n');
}
chrome.storage.onChanged.addListener((c) => { if (c[JOB_KEY]) render(); });
