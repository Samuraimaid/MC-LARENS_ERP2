import { describe, expect, it } from "vitest";
import {
  requiredSku,
  requiredProductName,
  requiredPrice,
  requiredPersonName,
  requiredPhone,
  optionalEmail,
  requiredSelection,
} from "./fieldValidators";

describe("fieldValidators (U12 ES)", () => {
  it("requiredSku", () => {
    expect(requiredSku("").valid).toBe(false);
    expect(requiredSku("A").valid).toBe(false);
    expect(requiredSku("AB").valid).toBe(true);
  });

  it("requiredProductName", () => {
    expect(requiredProductName(" ").valid).toBe(false);
    expect(requiredProductName("X").valid).toBe(false);
    expect(requiredProductName("Filtro aceite").valid).toBe(true);
  });

  it("requiredPrice", () => {
    expect(requiredPrice("").valid).toBe(false);
    expect(requiredPrice("-1").valid).toBe(false);
    expect(requiredPrice("abc").valid).toBe(false);
    expect(requiredPrice("0").valid).toBe(true);
    expect(requiredPrice("12.5").valid).toBe(true);
  });

  it("requiredPersonName / phone", () => {
    expect(requiredPersonName("El nombre")("").message).toMatch(/obligatorio/);
    expect(requiredPhone("123").valid).toBe(false);
    expect(requiredPhone("8888-8888").valid).toBe(true);
  });

  it("optionalEmail empty OK; bad format fails", () => {
    expect(optionalEmail("").valid).toBe(true);
    expect(optionalEmail("nope").valid).toBe(false);
    expect(optionalEmail("a@b.com").valid).toBe(true);
  });

  it("requiredSelection", () => {
    expect(requiredSelection("un cliente")("").valid).toBe(false);
    expect(requiredSelection("un cliente")("c1").valid).toBe(true);
  });
});

/**
 * Timing contract (mirrors useFieldValidation without React):
 * silent until blur/submit; live only after invalid shown.
 */
function simulateTiming({ values, validate, blurAtIndex, submitAtIndex }) {
  let blurred = false;
  let liveMode = false;
  let submitAttempted = false;
  const frames = [];
  values.forEach((value, i) => {
    if (i === blurAtIndex) {
      blurred = true;
      const r = validate(value);
      if (!r.valid) liveMode = true;
    }
    if (i === submitAtIndex) {
      submitAttempted = true;
      blurred = true;
      const r = validate(value);
      if (!r.valid) liveMode = true;
    }
    const result = validate(value);
    const hasContent = String(value ?? "").trim() !== "";
    const showError = !result.valid && (liveMode || submitAttempted);
    const showSuccess = result.valid && hasContent && (blurred || liveMode || submitAttempted);
    frames.push({ value, showError, showSuccess, liveMode });
  });
  return frames;
}

describe("U12 timing contract", () => {
  it("stays silent while typing before blur", () => {
    const frames = simulateTiming({
      values: ["", "A", "AB"],
      validate: requiredSku,
      blurAtIndex: -1,
    });
    expect(frames.every((f) => !f.showError && !f.showSuccess)).toBe(true);
  });

  it("blur invalid → error + live; then fix → success", () => {
    const frames = simulateTiming({
      values: ["", "A", "AB"],
      validate: requiredSku,
      blurAtIndex: 0,
    });
    expect(frames[0].showError).toBe(true);
    expect(frames[0].liveMode).toBe(true);
    expect(frames[1].showError).toBe(true); // still too short, live
    expect(frames[2].showError).toBe(false);
    expect(frames[2].showSuccess).toBe(true);
  });

  it("blur valid → explicit success without live escalate", () => {
    const frames = simulateTiming({
      values: ["SKU-9", ""],
      validate: requiredSku,
      blurAtIndex: 0,
    });
    expect(frames[0].showSuccess).toBe(true);
    expect(frames[0].liveMode).toBe(false);
    // editing after success: no live yell until next blur
    expect(frames[1].showError).toBe(false);
  });

  it("optional empty email blur does not claim success", () => {
    const frames = simulateTiming({
      values: [""],
      validate: optionalEmail,
      blurAtIndex: 0,
    });
    expect(frames[0].showSuccess).toBe(false);
    expect(frames[0].showError).toBe(false);
  });
});
