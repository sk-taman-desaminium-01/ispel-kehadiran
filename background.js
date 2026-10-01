/* Service worker — HANYA untuk hubungi Portal SKTD.
 *
 * content.js berjalan DI ATAS moeispel.moe.gov.my, jadi fetch() dari sana
 * tertakluk kepada dasar keselamatan (CSP) laman iSPEL sendiri — ramai
 * laman kerajaan sekat connect-src ke domain lain, jadi fetch terus gagal
 * dengan "sambungan gagal" walaupun Portal hidup dan kuki sesi sah.
 *
 * Service worker milik EXTENSION sendiri, bukan konteks laman web mana-mana
 * — tiada CSP laman terpakai di sini. host_permissions dalam manifest.json
 * (sktd.edu.my, portal.sktd.edu.my) masih berkuat kuasa untuk kuki sesi.
 */
const PORTAL_ASAL = ['https://sktd.edu.my/portal', 'https://portal.sktd.edu.my/portal'];

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.cmd !== 'tarikPortal') return false;
  (async () => {
    let status = null;
    for (const asal of PORTAL_ASAL) {
      try {
        const r = await fetch(
          `${asal}/api/kehadiran?kelas=${encodeURIComponent(msg.kelas)}&tarikh=${msg.tarikh}`,
          { credentials: 'include' },
        );
        status = r.status;
        if (r.ok) {
          reply({ ok: true, status, data: await r.json() });
          return;
        }
      } catch (_) { /* cuba asal seterusnya */ }
    }
    reply({ ok: false, status });
  })();
  return true; // jawapan async
});
