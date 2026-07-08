import { describe, expect, it } from "vitest";
import { filterSearchableOptions, scoreSearchableOption } from "./searchableSelectFilter";

const modelOptions = [
  { value: "Accent [2010-2015] - 1.6L", label: "Accent", hint: "Años 2010-2015 · Motor 1.6L" },
  { value: "Elantra (CN7) [2020-Presente] - 1.6L", label: "Elantra (CN7)", hint: "Años 2020-Presente · Motor 1.6L" },
  { value: "Elantra (AD) [2015-2020] - 2.0L", label: "Elantra (AD)", hint: "Años 2015-2020 · Motor 2.0L" },
  { value: "Santa Fe", label: "Santa Fe", hint: "SUV" },
  {
    value: "Tucson",
    label: "Tucson",
    hint: "Plataforma equivalente elantra en mercados seleccionados",
  },
];

describe("searchableSelectFilter", () => {
  it("prioritizes label matches over hint-only matches", () => {
    const filtered = filterSearchableOptions(modelOptions, "elantra");
    expect(filtered[0].label).toBe("Elantra (AD)");
    expect(filtered[1].label).toBe("Elantra (CN7)");
    expect(filtered.at(-1)?.label).toBe("Tucson");
  });

  it("ranks starts-with matches above contains matches", () => {
    expect(scoreSearchableOption({ label: "Elantra (CN7)" }, "elantra"))
      .toBeGreaterThan(scoreSearchableOption({ label: "Tucson", hint: "equivalente elantra" }, "elantra"));
  });

  it("keeps duplicate display labels as separate unique values", () => {
    const duplicateLabelOptions = [
      { value: "Elantra (CN7) [2020-Presente] - 1.6L", label: "Elantra (CN7)" },
      { value: "Elantra (CN7) [2020-Presente] - 2.0L", label: "Elantra (CN7)" },
    ];
    const values = new Set(duplicateLabelOptions.map((option) => option.value));
    expect(values.size).toBe(2);
  });
});