import { describe, expect, it } from "vitest";
import {
  formatDocumentExchangeRateLabel,
  formatDocumentLineAmount,
  formatDocumentSettlementAmount,
} from "./documentCurrency";

describe("documentCurrency", () => {
  const saleDoc = { currency: "NIO", exchange_rate: 36.5 };

  it("formats sale line items as USD base with NIO equivalent", () => {
    expect(formatDocumentLineAmount(35, saleDoc, "sale")).toBe("US$35.00 (C$1,277.50)");
  });

  it("formats settlement totals from NIO base", () => {
    expect(formatDocumentSettlementAmount(1401.4, saleDoc)).toBe("US$38.39 (C$1,401.40)");
  });

  it("shows exchange rate label", () => {
    expect(formatDocumentExchangeRateLabel(saleDoc)).toContain("1 US$ = C$36.50");
    expect(formatDocumentExchangeRateLabel(saleDoc)).toContain("Córdobas");
  });

  it("formats quotation lines stored in NIO", () => {
    const quote = { currency: "NIO", exchange_rate: 9 };
    expect(formatDocumentLineAmount(315, quote, "quotation")).toBe("US$35.00 (C$315.00)");
  });
});