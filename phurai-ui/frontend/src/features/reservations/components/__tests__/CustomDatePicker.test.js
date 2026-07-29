import { isLeapYear, getDaysInMonth, validateDateInput } from "../CustomDatePicker.jsx";

console.log("====================================================");
console.log("   TEST SUITE: CUSTOM DATEPICKER VALIDATION MATRIX  ");
console.log("====================================================");

const tests = [
  // ── 1. Key input restrictions ──
  { name: "Alpha character input 'abc'", fn: () => validateDateInput("abc"), expectedValid: false },
  
  // ── 2. Leap year Feb 29 tests ──
  { name: "Feb 29 on Leap Year 2024 (Valid)", fn: () => validateDateInput("29/02/2024"), expectedValid: true, expectedYmd: "2024-02-29" },
  { name: "Feb 29 on Non-Leap Year 2025 (Invalid)", fn: () => validateDateInput("29/02/2025"), expectedValid: false },
  { name: "Feb 29 on Century Non-Leap 1900 (Invalid)", fn: () => validateDateInput("29/02/1900"), expectedValid: false },
  { name: "Feb 29 on Century Leap 2000 (Valid)", fn: () => validateDateInput("29/02/2000"), expectedValid: true, expectedYmd: "2000-02-29" },

  // ── 3. Month max days boundary tests ──
  { name: "April 31 (Invalid - April has 30 days)", fn: () => validateDateInput("31/04/2026"), expectedValid: false },
  { name: "April 30 (Valid)", fn: () => validateDateInput("30/04/2026"), expectedValid: true, expectedYmd: "2026-04-30" },
  { name: "Month 13 (Invalid)", fn: () => validateDateInput("15/13/2026"), expectedValid: false },
  { name: "Day 0 (Invalid)", fn: () => validateDateInput("00/05/2026"), expectedValid: false },
  { name: "Day 32 (Invalid)", fn: () => validateDateInput("32/05/2026"), expectedValid: false },
];

let passed = 0;
tests.forEach((t, i) => {
  const res = t.fn();
  const isOk = res.valid === t.expectedValid && (!t.expectedYmd || res.ymd === t.expectedYmd);
  console.log(`[Test ${i + 1}] ${t.name}: ${isOk ? "✅ PASS" : "❌ FAIL"}`);
  if (!isOk) {
    console.log("   Output:", res);
  } else {
    passed++;
  }
});

console.log(`\nResult: ${passed}/${tests.length} tests passed!`);
