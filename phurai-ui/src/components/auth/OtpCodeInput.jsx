import { useEffect, useRef, useState } from "react";
import "@/styles/OtpCodeInput.css";

const EMPTY_DIGITS = ["", "", "", "", "", ""];

function normalizeDigits(value) {
  if (Array.isArray(value) && value.length === 6) {
    return value.map((digit) => String(digit || "").replace(/\D/g, "").slice(-1));
  }
  return [...EMPTY_DIGITS];
}

function OtpCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  error = false,
  shake = false,
  idPrefix = "otp",
  className = "",
}) {
  const digits = normalizeDigits(value);
  const inputRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, disabled, idPrefix]);

  const previousLengthRef = useRef(0);

  useEffect(() => {
    const code = digits.join("");
    if (code.length === 6 && previousLengthRef.current < 6) {
      onComplete?.(code);
    }
    previousLengthRef.current = code.length;
  }, [digits, onComplete]);

  const updateDigit = (index, nextValue) => {
    const digit = nextValue.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    onChange?.(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Enter" && digits.join("").length === 6) {
      return;
    }
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveIndex(index - 1);
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...EMPTY_DIGITS];
    pasted.split("").forEach((char, index) => {
      next[index] = char;
    });
    onChange?.(next);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
    setActiveIndex(focusIndex);
  };

  return (
    <div
      className={`otp-code-input${error || shake ? " is-error" : ""}${className ? ` ${className}` : ""}`}
      onPaste={handlePaste}
    >
      <div
        className="otp-code-input__grid"
        role="group"
        aria-label="6-digit verification code"
      >
        {digits.map((digit, index) => (
          <input
            key={`${idPrefix}-${index}`}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            id={`${idPrefix}-${index}`}
            className={`otp-code-input__box${
              error ? " is-error" : ""
            }${activeIndex === index ? " is-active" : ""}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of 6`}
            onChange={(event) => updateDigit(index, event.target.value)}
            onFocus={() => setActiveIndex(index)}
            onKeyDown={(event) => handleKeyDown(index, event)}
          />
        ))}
      </div>
    </div>
  );
}

export default OtpCodeInput;
