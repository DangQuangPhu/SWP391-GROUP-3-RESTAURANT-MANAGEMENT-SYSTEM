function isLeapYear(year) {
  const y = Number(year);
  if (isNaN(y) || y <= 0) return false;
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function getDaysInMonth(month, year) {
  const m = Number(month);
  const y = Number(year);
  if ([1, 3, 5, 7, 8, 10, 12].includes(m)) return 31;
  if ([4, 6, 9, 11].includes(m)) return 30;
  if (m === 2) {
    return isLeapYear(y) ? 29 : 28;
  }
  return 0;
}

function validateDateInput(dateStr) {
  if (!dateStr || dateStr.trim() === "") {
    return { valid: true, ymd: "" };
  }

  const parts = dateStr.split("/");
  if (parts.length !== 3) {
    return { valid: false, message: "Định dạng ngày phải là DD/MM/YYYY" };
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { valid: false, message: "Ngày, tháng, năm phải là số hợp lệ" };
  }

  if (year < 1900 || year > 2100) {
    return { valid: false, message: "Năm phải từ 1900 đến 2100" };
  }

  if (month < 1 || month > 12) {
    return { valid: false, message: `Tháng ${month} không hợp lệ (1 - 12)` };
  }

  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    if (month === 2) {
      const leapText = isLeapYear(year) ? "năm nhuận" : "năm không nhuận";
      return {
        valid: false,
        message: `Tháng 2 năm ${year} (${leapText}) chỉ có ${maxDays} ngày!`,
      };
    }
    return {
      valid: false,
      message: `Tháng ${month} chỉ có tối đa ${maxDays} ngày!`,
    };
  }

  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { valid: true, ymd };
}

console.log("====================================================");
console.log("   TEST SUITE: CUSTOM DATEPICKER VALIDATION MATRIX  ");
console.log("====================================================");

const tests = [
  { name: "Alpha character input 'abc'", fn: () => validateDateInput("abc"), expectedValid: false },
  { name: "Feb 29 on Leap Year 2024 (Valid)", fn: () => validateDateInput("29/02/2024"), expectedValid: true, expectedYmd: "2024-02-29" },
  { name: "Feb 29 on Non-Leap Year 2025 (Invalid)", fn: () => validateDateInput("29/02/2025"), expectedValid: false },
  { name: "Feb 29 on Century Non-Leap 1900 (Invalid)", fn: () => validateDateInput("29/02/1900"), expectedValid: false },
  { name: "Feb 29 on Century Leap 2000 (Valid)", fn: () => validateDateInput("29/02/2000"), expectedValid: true, expectedYmd: "2000-02-29" },
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
