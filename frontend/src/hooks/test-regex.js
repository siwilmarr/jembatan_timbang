/**
 * test-regex.js
 * Skrip standalone untuk menguji CAS_CI2001A_REGEX yang dipakai di processBuffer() (useSerial.js)
 * Jalankan dengan: node test-regex.js
 *
 * Tujuan: memastikan regex tetap berhasil menangkap status, jenis, dan berat
 * meskipun separator asli dari alat CAS CI-2001A sedikit berbeda dari estimasi.
 */

// FIXED 2026-07-09: \D{0,3} sebelumnya "memakan" tanda +/- sebelum sempat
// ditangkap oleh grup [+-]?, sehingga berat NEGATIF (mis. hasil tare) selalu
// terbaca sebagai positif. Diganti [^+\-\d]{0,3} supaya tanda +/- tidak ikut
// dilahap oleh separator wildcard.
const CAS_CI2001A_REGEX = /(ST|US)\D{0,3}(GS|NT|OL)[^+\-\d]{0,3}([+-]?\s*\d+\.?\d*)\s*(kg|t)?/i;

// -----------------------------------------------------------------------
// 1. DAFTAR KASUS UJI
//    - "expected: null" berarti regex SENGAJA diharapkan TIDAK match
//      (payload korup/tidak lengkap), supaya kita tahu batas toleransi regex.
// -----------------------------------------------------------------------
const testCases = [
  // --- Format sesuai estimasi simulator.js Anda ---
  { label: "Simulator - Gross Stable (koma)", raw: "01ST,GS,+001234kg\r\n", expected: { status: "ST", type: "GS", weight: "+001234", unit: "kg" } },
  { label: "Simulator - Unstable dulu",        raw: "01US,GS,+000980kg\r\n", expected: { status: "US", type: "GS", weight: "+000980", unit: "kg" } },
  { label: "Net weight",                       raw: "01ST,NT,+000850kg\r\n", expected: { status: "ST", type: "NT", weight: "+000850", unit: "kg" } },
  { label: "Overload",                         raw: "01ST,OL,+999999kg\r\n", expected: { status: "ST", type: "OL", weight: "+999999", unit: "kg" } },
  { label: "Berat negatif (tare offset)",      raw: "01ST,GS,-000120kg\r\n", expected: { status: "ST", type: "GS", weight: "-000120", unit: "kg" } },

  // --- Variasi separator (uji toleransi regex thd format asli yg mungkin beda) ---
  { label: "Separator spasi (bukan koma)",     raw: "01 ST GS +001234 kg\r\n", expected: { status: "ST", type: "GS", weight: "+001234", unit: "kg" } },
  { label: "Tanpa separator sama sekali",      raw: "01ST GS+001234kg\r\n",   expected: { status: "ST", type: "GS", weight: "+001234", unit: "kg" } },
  { label: "Satuan ton (t)",                   raw: "01ST,GS,+001.234t\r\n",  expected: { status: "ST", type: "GS", weight: "+001.234", unit: "t" } },
  { label: "Tanpa satuan di akhir",            raw: "01ST,GS,+001234\r\n",   expected: { status: "ST", type: "GS", weight: "+001234", unit: undefined } },
  { label: "Lowercase status/jenis",           raw: "01st,gs,+001234kg\r\n", expected: { status: "st", type: "gs", weight: "+001234", unit: "kg" } },

  // --- Kasus yang MEMANG harus gagal (untuk cek false-positive) ---
  { label: "Payload corrupt (harus null)",     raw: "01XXYY????\r\n", expected: null },
  { label: "Payload kosong (harus null)",      raw: "\r\n",           expected: null },
];

// -----------------------------------------------------------------------
// 2. FUNGSI PARSE (meniru logic yang seharusnya ada di processBuffer())
// -----------------------------------------------------------------------
function parseCasPayload(raw) {
  const match = raw.match(CAS_CI2001A_REGEX);
  if (!match) return null;

  const [, status, type, weightStr, unit] = match;
  return {
    status,                 // "ST" | "US"
    type,                   // "GS" | "NT" | "OL"
    weight: weightStr.replace(/\s/g, ""), // buang spasi liar di angka
    weightValue: parseFloat(weightStr),
    unit,                   // "kg" | "t" | undefined
    isStable: status.toUpperCase() === "ST",
  };
}

// -----------------------------------------------------------------------
// 3. RUNNER
// -----------------------------------------------------------------------
let pass = 0;
let fail = 0;

console.log("=".repeat(70));
console.log("TEST: CAS_CI2001A_REGEX  (processBuffer simulation)");
console.log("Regex:", CAS_CI2001A_REGEX.source);
console.log("=".repeat(70), "\n");

testCases.forEach(({ label, raw, expected }, i) => {
  const result = parseCasPayload(raw);

  let ok;
  if (expected === null) {
    ok = result === null;
  } else {
    ok = result &&
      result.status === expected.status &&
      result.type === expected.type &&
      result.weight === expected.weight &&
      result.unit === expected.unit;
  }

  ok ? pass++ : fail++;

  console.log(`[${ok ? "PASS" : "FAIL"}] ${i + 1}. ${label}`);
  console.log(`      raw     : ${JSON.stringify(raw)}`);
  console.log(`      parsed  : ${result ? JSON.stringify(result) : "null"}`);
  if (!ok) {
    console.log(`      expected: ${expected ? JSON.stringify(expected) : "null"}`);
  }
  console.log("");
});

console.log("=".repeat(70));
console.log(`HASIL: ${pass} PASS, ${fail} FAIL dari ${testCases.length} kasus`);
console.log("=".repeat(70));

if (fail > 0) {
  console.log("\n⚠️  Ada kasus yang gagal. Cek apakah:");
  console.log("   - Regex perlu disesuaikan untuk pola separator baru");
  console.log("   - Atau kasus tsb memang di luar cakupan format CAS CI-2001A");
  process.exitCode = 1;
} else {
  console.log("\n✅ Semua kasus uji lolos. Regex siap dipakai di useSerial.js.");
}

// -----------------------------------------------------------------------
// 4. MODE INTERAKTIF - test payload custom lewat argumen CLI
//    Contoh: node test-regex.js "01ST,GS,+002500kg"
// -----------------------------------------------------------------------
const customPayload = process.argv[2];
if (customPayload) {
  console.log("\n" + "-".repeat(70));
  console.log("CUSTOM PAYLOAD TEST");
  console.log("-".repeat(70));
  console.log("raw   :", JSON.stringify(customPayload));
  console.log("parsed:", JSON.stringify(parseCasPayload(customPayload), null, 2));
}