# Kehadiran IDME

Extension Chrome untuk mengisi kehadiran murid di
https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru (nama dalaman "iSPEL";
guru kenali sebagai "Kehadiran IDME" — nama itu yang dipaparkan di popup.)

## Pasang
1. Chrome → `chrome://extensions`
2. Hidupkan **Developer mode** (atas kanan)
3. **Load unpacked** → pilih folder `/Users/syaifulizhan/Projects/ispel-kehadiran`
4. Pin ikon extension pada toolbar

## Aliran sebenar iSPEL (disahkan oleh pengguna, 13 Sep 2026)

1. Senarai murid — setiap baris ada **checkbox**. **DITANDA = HADIR.**
   Untuk tanda tidak hadir, checkbox itu **di-untick**.
2. Selepas untick, dropdown pertama muncul: **"Sila Pilih Kategori"**
   (contoh pilihan: *Masalah Kesihatan*).
3. Selepas kategori dipilih, dropdown **kedua** muncul: **"Sila Pilih Sebab"**
   (contoh: *Demam*). Ia datang lewat — perlu ditunggu.
4. Klik **Kemaskini** → dialog *"Adakah anda pasti?"* → **Ya** → *"Berjaya"* → **OK**
5. Klik **Sahkan** → dialog *"pasti?"* → **Ya** → *"Berjaya"* → **OK**
6. Status bertukar **kuning "Menunggu Pengesahan"** → **hijau "Telah Disahkan"**

Istilah: dropdown 1 = **Kategori**, dropdown 2 = **Sebab**.
Dalam kod, `opt.sebab` = Kategori dan `opt.jenis` = Sebab (kekal atas sebab sejarah).

### Dialog pengesahan iSPEL (gambar sebenar, 13 Sep 2026)

Selepas **Kemaskini**, iSPEL membuka dialog SweetAlert2:

```
Pengesahan Kehadiran Harian 10/08/2026
Adakah anda pasti? Maklumat pelajar tidak hadir yang tidak lengkap,
tidak akan direkodkan dalam senarai pelajar tidak hadir.
[senarai murid tidak hadir + sebab]
        [ Batal ]  [ Simpan ]  [ Sahkan ]
```

- **Simpan** → kekal kuning *Menunggu Pengesahan*
- **Sahkan** → dialog hijau *"Berjaya. Maklumat kehadiran kelas bertarikh
  10/08/2026 telah berjaya disimpan dan disahkan"* → **OK** → selesai

Tetapan `sahkan` dalam popup memilih antara kedua-duanya. **Batal** ada dalam
`JGN_KLIK` jadi ia tidak akan tertekan.

### Perangkap yang sudah ditangani

- Carian dropdown mesti dikunci kepada **baris murid itu sahaja** (`milikBaris`).
  Tanpa itu, murid kedua ditinggalkan kosong kerana carian terjumpa dropdown
  murid pertama, dan iSPEL menolak kemaskini.
- Dropdown kedua iSPEL bernama "Sebab" — padanan ikut **nama medan** tersilap
  memilih dropdown yang sama dua kali. Satu dropdown hanya diterima jika
  `bestOption()` mengesahkan ia mengandungi jawapan yang dicari.
- Pilihan *"Sila Pilih Kategori" / "Sila Pilih Sebab"* diabaikan sebagai jawapan.
- Kotak hijau *"berjaya dikemaskini"* BUKAN pengesahan. Selagi teks
  *"Menunggu Pengesahan"* masih ada, ia dikira gagal.
- **JANGAN hantar `change` selepas `.click()`.** `click()` sudah mencetuskan
  input+change. Isyarat kedua menyebabkan iSPEL menambah dropdown Kategori
  **dua kali**, dan yang kedua kekal kosong → pengesahan ditolak.
- **Jangan pilih semula nilai dropdown yang sudah betul.** iSPEL membina semula
  dropdown Sebab setiap kali Kategori berubah, lalu mengosongkannya. Penting
  untuk mod tambah pada tarikh yang sudah diisi.
- **SweetAlert2 menyimpan SEMUA ikon dalam DOM** (error/success/warning) dan
  menyembunyikan yang tidak digunakan. Semak `isVisible()`, bukan kewujudan —
  jika tidak, dialog amaran disalah baca sebagai ralat dan kerja terhenti.
- **Pilih butang dialog ikut keutamaan, bukan susunan pada skrin** — dengan
  "Batal | Simpan | Sahkan", susunan skrin memberi jawapan yang salah.
- Teks dialog *"telah berjaya disimpan dan disahkan"* diterima sebagai bukti
  muktamad; jangan tunggu lencana halaman bertukar (ia mungkin lambat).
- **JANGAN kumpulkan baris murid ikut bilangan medan.** Murid yang sudah ditanda
  tidak hadir ada 2 dropdown tambahan, jadi ia jatuh ke kumpulan lain dan HILANG
  (dibaca 37 daripada 38). Kumpulkan ikut induk + tag sahaja.
- Teks pilihan dropdown ("MENGIKUT KELUARGA BERCUTI/BERKURSUS") boleh tersalah
  dibaca sebagai nama murid — tapis keluar, utamakan nama ber-BIN/BINTI/A-L/A-P.
- Medan tarikh kadangkala tidak menerima nilai pada percubaan pertama; cuba
  beberapa format, dan SAHKAN nilainya sebelum menanda sesiapa. Menanda murid
  pada hari yang salah adalah kerosakan paling teruk yang boleh berlaku.
- Butang Sahkan dimatikan iSPEL selagi ada murid tidak hadir yang dropdownnya
  kosong — `barisTidakLengkap()` menyenaraikan siapa.
- Tarikh dipapar & ditulis dalam **DD/MM/YYYY** di semua tempat — `<input type=date>`
  memapar ikut locale dan pernah menyebabkan bulan tersilap dengan hari.

## Cara guna
1. Log masuk iSPEL, buka tab kehadiran, pilih kelas.
2. Klik ikon extension.
3. **Langkah 1** — set julat tarikh + hari sekolah + tarikh cuti yang anda tahu → *Bina jadual*.
4. **Langkah 2** — taip nama pendek murid tidak hadir bagi setiap tarikh
   (contoh `aisyah, muhd ali`). Kosong = semua hadir.
   Klik *Semak nama dengan senarai kelas semasa* untuk pastikan setiap nama
   padan dengan seorang murid sahaja (✓ = selamat, ⚠ = kabur/tiada).
5. **Langkah 3** — klik **Teruskan**. Setiap tarikh: tanda tidak hadir →
   Masalah Kesihatan → Demam → Kemaskini → tunggu pengesahan hijau.

## Keselamatan
- Berhenti sendiri jika nama kabur (tidak meneka murid).
- Melangkau tarikh apabila sistem sebut cuti / tiada senarai / butang kemaskini mati.
- Log setiap tarikh: ✅ berjaya · ⏭ dilangkau · ❌ gagal (dengan sebab).

## Butang "Rakam struktur halaman"
Merakam struktur borang (nama medan, pilihan dropdown, pengepala jadual) dengan
**nama & nombor murid ditutup** lalu menyalinnya ke clipboard — untuk menala
selector supaya tepat dengan borang iSPEL sebenar.

---

## ⚠️ Pengajaran penting (13 Sep 2026) — JANGAN ulang

Versi awal menyebabkan sesi iSPEL pengguna terputus berulang kali:
pusingan refresh, dilempar ke `idme.moe.gov.my/login`, `Page Expired` (419),
dan dialog merah **"CSRF token mismatch"**.

**Punca:** tiga kecacatan yang bergabung —

1. `searchButton` mengandungi pemilih **am** `button[type="submit"]`. Pada aplikasi
   Laravel seperti iSPEL, butang submit pertama dalam DOM lazimnya ialah borang
   **Log Keluar** di bar navigasi. Extension mengkliknya → sesi dimusnahkan.
2. `all_frames: true` → content script berjalan dalam setiap iframe, setiap satu
   menyambung kerja secara berasingan → klik berganda-ganda.
3. Content script **menyambung kerja secara automatik** pada setiap muat halaman.
   Kerja yang tergantung (`status: 'running'`) menjadi pusingan klik→refresh→klik
   tanpa henti, yang juga mencetuskan pelindung **Imperva** di hadapan iSPEL.

**Peraturan tetap selepas ini:**

- JANGAN sekali-kali guna pemilih butang am. Padan ikut **teks** butang.
- `JGN_KLIK` menolak: log keluar, logout, keluar, padam, hapus, buang, delete,
  reset, batal, cancel, kembali, back, daftar, profil, tukar kata laluan.
- `all_frames: false` — frame atas sahaja.
- Tiada sambung automatik. Halaman dimuat semula = kerja **dibekukan**,
  pengguna tekan Teruskan sendiri.
- Hanya bertindak bila `location.pathname` mengandungi `kehadiran`.
- Ralat CSRF / token / sesi / 419 dikesan sebagai **sistemik** → seluruh kerja
  dihentikan serta-merta, bukan diulang pada 23 tarikh.
- Jeda ~3 saat + rawak antara tarikh. iSPEL di belakang Imperva; jangan hentam.

## Ujian

```bash
cd <scratchpad>   # mock-*.html, uji.js, uji-selamat.js
node uji.js          # 42 ujian: table/div, padanan nama, dropdown, tarikh
node uji-selamat.js  # 12 ujian: butang bahaya, ralat CSRF, sistemik
```
