# Bahan Penyerahan Chrome Web Store

Tampal terus ke borang di https://chrome.google.com/webstore/devconsole
(perlu akaun Google + bayaran pendaftaran USD 5 sekali, oleh cikgu sendiri
— saya tak boleh buat langkah bayaran ini).

## Fail dimuat naik
`~/Desktop/ispel-kehadiran-pakej/ispel-kehadiran-v1.5.0.zip`

## Tajuk
```
Kehadiran IDME — SKTD
```

## Perihalan ringkas (132 aksara)
```
Isi kehadiran murid iSPEL automatik — tarik senarai tidak hadir yang
disahkan guru kelas terus dari Portal SKTD.
```

## Perihalan penuh
```
Untuk guru SK Taman Desaminium sahaja.

Extension ini mengisi kehadiran harian murid pada sistem iSPEL rasmi
KPM (moeispel.moe.gov.my) secara automatik, menggantikan tanda
satu-satu dengan tangan bagi setiap murid setiap hari.

CARA IA BERFUNGSI
1. Guru kelas tanda murid tidak hadir + kategori + sebab dalam Portal
   Kakitangan SKTD (portal.sktd.edu.my/kawalan-kelas), klik Sahkan.
2. Buka iSPEL, klik ikon extension, tekan "Tarik dari Portal SKTD" —
   senarai yang SUDAH disahkan terisi automatik.
3. Extension menanda tidak hadir, pilih kategori/sebab, kemaskini dan
   sahkan setiap tarikh di iSPEL — dengan langkau automatik untuk
   tarikh cuti dan pengesanan ralat sesi.

DATA
Extension membaca sesi log masuk Portal SKTD yang SEDIA ADA dalam
Chrome anda (mesti log masuk dahulu di tab lain) untuk mengenal pasti
guru dan kelasnya. Ia TIDAK meminta atau menyimpan kata laluan
iSPEL/MOE. Tetapan (tarikh, nama kelas) disimpan tempatan dalam
peranti sahaja. Tiada pelayan pihak ketiga terlibat — hanya Portal
SKTD (baca) dan iSPEL rasmi (tulis).

Dasar privasi penuh: https://sktd.edu.my/privasi
Sumber terbuka: https://github.com/sk-taman-desaminium-01/ispel-kehadiran
```

## Kategori
Productivity (Produktiviti)

## Justifikasi kebenaran (Chrome mewajibkan setiap satu diterangkan)

| Kebenaran | Sebab |
|---|---|
| `storage` | Simpan tetapan (julat tarikh, nama kelas, pilihan lalai) TEMPATAN sahaja dalam peranti pengguna. |
| `scripting` | Suntik content.js ke tab iSPEL bila popup mula-mula disambung (fallback jika content script belum aktif). |
| `activeTab` | Baca & isi borang pada tab iSPEL yang sedang aktif semasa pengguna menekan butang dalam popup. |
| `host_permissions: moeispel.moe.gov.my` | Baca senarai murid & isi borang kehadiran pada sistem rasmi KPM ini — tujuan tunggal extension. |
| `host_permissions: sktd.edu.my, portal.sktd.edu.my` | Baca senarai murid tidak hadir yang SUDAH disahkan guru kelas di Portal Kakitangan sekolah sendiri (guna sesi log masuk sedia ada). |

## Kenyataan Tujuan Tunggal (Single Purpose)
```
Mengautomasikan pengisian borang kehadiran harian rasmi KPM (iSPEL)
untuk guru SK Taman Desaminium, menggunakan data ketidakhadiran yang
sudah disahkan guru kelas dalam portal kakitangan sekolah sendiri.
```

## Keterlihatan
**Unlisted** (bukan Public) — hanya boleh dibuka melalui pautan terus,
tidak muncul dalam carian Chrome Web Store. Sesuai untuk alat dalaman
sekolah.

## Tangkapan skrin diperlukan
Chrome Web Store perlukan sekurang-kurangnya SATU tangkapan skrin
popup extension (1280×800 atau 640×400). Buka extension di Chrome,
`chrome://extensions` → Load unpacked → klik ikon → screenshot popup
Langkah 1–3.
