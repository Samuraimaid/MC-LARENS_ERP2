import { describe, expect, it } from "vitest";
import {
  MORPH_TOGGLE_DURATION_MS,
  MORPH_TOGGLE_EASING,
  MORPH_TOGGLE_ERROR_ES,
  MORPH_TOGGLE_KNOB_DIAMETER_PX,
  MORPH_TOGGLE_KNOB_RADIUS_PX,
  MORPH_TOGGLE_LABEL_OFF,
  MORPH_TOGGLE_LABEL_ON,
  MORPH_TOGGLE_PADDING_PX,
  MORPH_TOGGLE_RAIL_HEIGHT_PX,
  MORPH_TOGGLE_RAIL_WIDTH_PX,
  MORPH_TOGGLE_TRANSITION,
  MORPH_TOGGLE_TRAVEL_PX,
} from "./MorphToggle";
import { morphToggleGeometryContract } from "@/hooks/useOptimisticToggle";

describe("MorphToggle geometry + morph contract (U13)", () => {
  it("rail width is 2× knob diameter; padding equals knob radius", () => {
    expect(MORPH_TOGGLE_RAIL_WIDTH_PX).toBe(MORPH_TOGGLE_KNOB_DIAMETER_PX * 2);
    expect(MORPH_TOGGLE_PADDING_PX).toBe(MORPH_TOGGLE_KNOB_RADIUS_PX);
    expect(MORPH_TOGGLE_KNOB_RADIUS_PX).toBe(MORPH_TOGGLE_KNOB_DIAMETER_PX / 2);
    expect(MORPH_TOGGLE_RAIL_HEIGHT_PX).toBe(MORPH_TOGGLE_KNOB_DIAMETER_PX);
    expect(MORPH_TOGGLE_TRAVEL_PX).toBe(
      MORPH_TOGGLE_RAIL_WIDTH_PX - MORPH_TOGGLE_KNOB_DIAMETER_PX
    );
  });

  it("morph timing is 250ms ease-out (don't snap)", () => {
    expect(MORPH_TOGGLE_DURATION_MS).toBe(250);
    expect(MORPH_TOGGLE_EASING).toBe("ease-out");
    expect(MORPH_TOGGLE_TRANSITION).toBe("250ms ease-out");
  });

  it("Spanish labels and rollback toast", () => {
    expect(MORPH_TOGGLE_LABEL_ON).toBe("Activado");
    expect(MORPH_TOGGLE_LABEL_OFF).toBe("Desactivado");
    expect(MORPH_TOGGLE_ERROR_ES).toMatch(/No se pudo guardar/);
    expect(MORPH_TOGGLE_ERROR_ES).toMatch(/intenta de nuevo/);
  });

  it("geometry helper lists the four morph props", () => {
    const c = morphToggleGeometryContract();
    expect(c.railWidth).toBe(2 * c.knobDiameter);
    expect(c.railPadding).toBe(c.knobRadius);
    expect(c.morphProps).toEqual([
      "rail-color",
      "knob-translateX",
      "knob-shadow",
      "label-opacity",
    ]);
    expect(c.durationMs).toBe(250);
    expect(c.easing).toBe("ease-out");
  });
});
