/**
 * test-processBuffer.js
 * Menguji LOGIKA processBuffer() dari useSerial.js (diekstrak apa adanya,
 * tanpa React state) terhadap skenario stream serial yang realistis:
 *   - satu frame utuh diterima sekaligus
 *   - frame terpotong di tengah (Web Serial API bisa deliver per-chunk kecil)
 *   - beberapa frame numpuk dalam satu chunk (device kirim cepat)
 *
 * Jalankan: node test-processBuffer.js
 */

// ============================================================
// REGEX LAMA (persis dari useSerial.js baris 23 saat ini)
// ============================================================
const OLD_REGEX = /(ST|US)\D{0,3}(GS|NT|OL)\D{0,3}([+-]?\s*\d+\.?\d*)\s*(kg|t)?/i;

// ============================================================
// REGEX BARU (fix bug tanda +/- DAN wajib diakhiri CR/LF supaya
// tidak match frame yang belum lengkap / masih terpotong)
// ============================================================
const NEW_REGEX = /(ST|US)\D{0,3}(GS|NT|OL)[^+\-\d]{0,3}([+-]?\s*\d+\.?\d*)\s*(kg|t)?\D*\r?\n/i;

/**
 * Simulasi persis logika processBuffer() di useSerial.js, tapi pakai
 * plain object sebagai pengganti bufferRef/setWeight/setIsStable,
 * supaya bisa dites di Node tanpa React/browser.
 *
 * mode "old"   -> replikasi bug asli (1x match per pemanggilan, regex lama)
 * mode "fixed" -> regex baru + loop proses semua frame lengkap dalam buffer
 */
function makeProcessor(mode) {
  const regex = mode === "fixed" ? NEW_REGEX : OLD_REGEX;
  const state = { buffer: "", weight: null, isStable: null, readings: [] };

  function processOnce() {
    const match = state.buffer.match(regex);
    if (!match) return false;

    const [, stability, , rawWeight] = match;
    const parsedWeight = parseFloat(rawWeight.replace(/\s/g, ""));
    if (isNaN(parsedWeight)) return false;

    state.weight = parsedWeight;
    state.isStable = stability.toUpperCase() === "ST";
    state.readings.push({ weight: parsedWeight, isStable: state.isStable });

    const endIndex = state.buffer.indexOf("\n", match.index) + 1;
    if (endIndex > 0) {
      state.buffer = state.buffer.slice(endIndex);
    }
    return true;
  }

  function process() {
    if (mode === "fixed") {
      // persis seperti processBuffer() terbaru di useSerial.js: loop
      // memanggil processSingleFrame() selama masih ada frame lengkap
      while (processOnce()) {}
    } else {
      // replikasi persis kode ASLI (sebelum fix): hanya 1x match per pemanggilan
      processOnce();
    }
  }

  return {
    feed(chunk) {
      state.buffer += chunk;
      process();
    },
    state,
  };
}

// ============================================================
// TEST CASES
// ============================================================
let pass = 0, fail = 0;
function check(label, condition, detail) {
  condition ? pass++ : fail++;
  console.log(`[${condition ? "PASS" : "FAIL"}] ${label}`);
  if (!condition) console.log(`      detail: ${detail}`);
}

console.log("=".repeat(70));
console.log("TEST 1: Berat negatif — bug tanda +/- (regex LAMA vs BARU)");
console.log("=".repeat(70));
{
  const oldP = makeProcessor("old");
  oldP.feed("01ST,GS,-000450kg\r\n");
  check(
    "Regex LAMA: -450kg harus terbaca -450 (BUG, dites tetap FAIL dgn sengaja)",
    oldP.state.weight === -450,
    `dapat weight=${oldP.state.weight} (harusnya -450) — MEMBUKTIKAN bug sign masih ada`
  );

  const newP = makeProcessor("fixed");
  newP.feed("01ST,GS,-000450kg\r\n");
  check(
    "Regex BARU: -450kg terbaca -450",
    newP.state.weight === -450,
    `dapat weight=${newP.state.weight}`
  );
}

console.log("\n" + "=".repeat(70));
console.log("TEST 2: Frame terpotong di tengah (chunk kecil, mirip Web Serial nyata)");
console.log("=".repeat(70));
{
  // Simulasi device kirim "01ST,GS,+001234kg\r\n" tapi dipecah jadi
  // beberapa chunk kecil oleh reader.read() — termasuk terpotong DI TENGAH ANGKA.
  const chunks = ["01ST,GS,+00", "12", "34kg\r\n"];

  const oldP = makeProcessor("old");
  const oldSnapshots = [];
  chunks.forEach((c) => {
    oldP.feed(c);
    oldSnapshots.push(oldP.state.weight);
  });
  check(
    "Regex LAMA: TIDAK boleh update weight sebelum frame lengkap (harus tetap null di awal)",
    oldSnapshots[0] === null,
    `snapshot per-chunk: ${JSON.stringify(oldSnapshots)} — weight ter-update dari chunk PERTAMA ("01ST,GS,+00") padahal angkanya belum lengkap → nilai sempat salah/flicker sebelum akhirnya benar`
  );

  const newP = makeProcessor("fixed");
  const newSnapshots = [];
  chunks.forEach((c) => {
    newP.feed(c);
    newSnapshots.push(newP.state.weight);
  });
  check(
    "Regex BARU: weight tetap null sampai frame benar-benar lengkap (\\r\\n diterima)",
    newSnapshots[0] === null && newSnapshots[1] === null && newSnapshots[2] === 1234,
    `snapshot per-chunk: ${JSON.stringify(newSnapshots)}`
  );
}

console.log("\n" + "=".repeat(70));
console.log("TEST 3: Dua frame numpuk dalam satu chunk (device kirim cepat)");
console.log("=".repeat(70));
{
  const combinedChunk = "01ST,GS,+001000kg\r\n01ST,GS,+001050kg\r\n";

  const oldP = makeProcessor("old");
  oldP.feed(combinedChunk);
  check(
    "processBuffer() LAMA: HANYA memproses 1 dari 2 frame per pemanggilan (backlog bug)",
    oldP.state.readings.length === 1,
    `readings=${JSON.stringify(oldP.state.readings)} — frame kedua (1050kg) TERTINGGAL di buffer, baru terbaca saat data baru datang lagi nanti → tampilan berat bisa delay/nyangkut`
  );

  const newP = makeProcessor("fixed");
  newP.feed(combinedChunk);
  check(
    "processBuffer() BARU: memproses SEMUA frame lengkap dalam satu chunk (loop)",
    newP.state.readings.length === 2 && newP.state.weight === 1050,
    `readings=${JSON.stringify(newP.state.readings)}`
  );
}

console.log("\n" + "=".repeat(70));
console.log(`HASIL: ${pass} PASS, ${fail} FAIL`);
console.log("=".repeat(70));
console.log(
  "\nCatatan: pada TEST 1 & 2, hasil FAIL untuk 'Regex LAMA' itu DISENGAJA —\n" +
  "tujuannya membuktikan bug memang benar-benar ada di kode processBuffer()\n" +
  "Anda saat ini. Yang perlu SEMUA PASS adalah baris 'Regex BARU' / 'processBuffer() BARU'."
);