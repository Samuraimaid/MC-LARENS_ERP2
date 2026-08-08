export const PDF_DOCUMENT_TYPE_OPTIONS = [
  { id: "invoice", label: "Facturas (pagada, pendiente, crédito)" },
  { id: "quotation", label: "Cotizaciones" },
  { id: "payment_receipt", label: "Comprobante de abono" },
  { id: "petty_cash", label: "Caja chica" },
];

export const PDF_PREVIEW_OPTIONS = [
  { id: "invoice_paid", label: "Factura pagada", docType: "invoice" },
  { id: "invoice_pending", label: "Factura pendiente", docType: "invoice" },
  { id: "invoice_credit", label: "Factura a crédito", docType: "invoice" },
  { id: "payment_partial", label: "Abono en factura", docType: "invoice" },
  { id: "quotation", label: "Cotización", docType: "quotation" },
  { id: "payment_receipt", label: "Comprobante de abono", docType: "payment_receipt" },
  { id: "petty_cash", label: "Caja chica", docType: "petty_cash" },
];

export const PDF_THEME_COLOR_OPTIONS = [
  { key: "invoice_paid", label: "Factura pagada", hint: "Verde — cobro completado" },
  { key: "quotation", label: "Cotización", hint: "Azul — presupuestos" },
  { key: "invoice_credit", label: "Factura a crédito", hint: "Rojo — venta financiada" },
  { key: "payment_partial", label: "Abono / pago parcial", hint: "Amarillo — saldo pendiente" },
  { key: "invoice_pending", label: "Factura pendiente", hint: "Neutro — sin cobro aún" },
  { key: "petty_cash", label: "Caja chica", hint: "Morado — gastos operativos" },
];

const INVOICE_SECTIONS = {
  header_logo: true,
  company_name: true,
  company_tagline: true,
  status_badge: true,
  salesperson: true,
  document_number: true,
  date: true,
  customer: true,
  customer_tax_id: true,
  customer_phone: true,
  customer_email: true,
  customer_address: true,
  vehicle: true,
  plate: true,
  vin: true,
  vehicle_color: true,
  items: true,
  items_installed_group: true,
  items_carry_group: true,
  breakdown: true,
  breakdown_gross_subtotal: true,
  breakdown_line_discount: true,
  breakdown_global_discount: true,
  breakdown_subtotal: true,
  breakdown_iva: true,
  breakdown_retention: true,
  breakdown_total: true,
  payment_details: true,
  notes: true,
  company_footer: true,
  watermark: true,
};

const QUOTATION_SECTIONS = {
  header_logo: true,
  company_name: true,
  status_badge: true,
  document_number: true,
  date: true,
  customer: true,
  customer_phone: true,
  vehicle: true,
  plate: true,
  items: true,
  breakdown: true,
  breakdown_gross_subtotal: true,
  breakdown_line_discount: true,
  breakdown_global_discount: true,
  breakdown_subtotal: true,
  breakdown_iva: true,
  breakdown_total: true,
  notes: true,
  company_footer: true,
  watermark: true,
};

const PAYMENT_RECEIPT_SECTIONS = {
  header_logo: true,
  company_name: true,
  status_badge: true,
  document_title: true,
  invoice_number: true,
  customer: true,
  payment_date: true,
  payment_method: true,
  amount_this_payment: true,
  amount_paid_total: true,
  amount_pending: true,
  invoice_total: true,
  disclaimer: true,
  company_footer: true,
  watermark: true,
};

const PETTY_CASH_SECTIONS = {
  header_logo: true,
  company_name: true,
  status_badge: true,
  voucher_number: true,
  date: true,
  branch: true,
  beneficiary: true,
  category: true,
  description: true,
  amount: true,
  payment_method: true,
  authorized_by: true,
  received_by: true,
  notes: true,
  company_footer: true,
  watermark: true,
};

export const DEFAULT_PDF_DOCUMENT_SECTIONS = {
  invoice: { ...INVOICE_SECTIONS },
  quotation: { ...QUOTATION_SECTIONS },
  payment_receipt: { ...PAYMENT_RECEIPT_SECTIONS },
  petty_cash: { ...PETTY_CASH_SECTIONS },
};

export const PDF_SECTION_LABELS = {
  header_logo: "Logo en encabezado",
  company_name: "Nombre de empresa",
  company_tagline: "Eslogan / rubro",
  status_badge: "Etiqueta de estado",
  salesperson: "Vendedor",
  document_number: "Número de documento",
  document_title: "Título del documento",
  date: "Fecha",
  customer: "Cliente / beneficiario",
  customer_tax_id: "RUC del cliente",
  customer_phone: "Teléfono del cliente",
  customer_email: "Correo del cliente",
  customer_address: "Dirección del cliente",
  vehicle: "Vehículo",
  plate: "Placa",
  vin: "Chasis / VIN",
  vehicle_color: "Color del vehículo",
  items: "Detalle de productos",
  items_installed_group: "Grupo productos instalados",
  items_carry_group: "Grupo productos para llevar",
  breakdown: "Desglose (bloque completo)",
  breakdown_gross_subtotal: "Subtotal bruto",
  breakdown_line_discount: "Descuento por línea",
  breakdown_global_discount: "Descuento global",
  breakdown_subtotal: "Subtotal",
  breakdown_iva: "IVA",
  breakdown_retention: "Retención IR",
  breakdown_total: "TOTAL",
  payment_details: "Detalle de pago",
  payment_date: "Fecha de abono",
  payment_method: "Forma de pago",
  invoice_number: "Número de factura",
  amount_this_payment: "Monto de este abono",
  amount_paid_total: "Total abonado",
  amount_pending: "Saldo pendiente",
  invoice_total: "Total factura",
  disclaimer: "Aviso automático",
  voucher_number: "Número de comprobante",
  branch: "Sucursal",
  beneficiary: "Beneficiario",
  category: "Categoría de gasto",
  description: "Concepto / descripción",
  amount: "Monto",
  authorized_by: "Autorizado por",
  received_by: "Recibido por",
  notes: "Notas",
  company_footer: "Pie de empresa",
  watermark: "Marca de agua",
};

export const PETTY_CASH_CATEGORY_OPTIONS = [
  { id: "insumos_limpieza", label: "Insumos de limpieza" },
  { id: "viaticos", label: "Viáticos" },
  { id: "adelanto_salario", label: "Adelanto de salario" },
  { id: "bono_transporte", label: "Bono de transporte" },
  { id: "alimentacion", label: "Alimentación" },
  { id: "otros", label: "Otros gastos" },
];

export const BILLING_SUBTAB_OPTIONS = [
  { id: "exchange", label: "Tasas e IVA" },
  { id: "pdf", label: "Documentos PDF" },
  { id: "petty-cash", label: "Caja chica" },
  { id: "voucher", label: "Voucher POS" },
  { id: "cancel", label: "Anulaciones" },
];

export const SETTINGS_TAB_OPTIONS = [
  { id: "general", label: "General", icon: "Settings2" },
  { id: "billing", label: "Facturación", icon: "ReceiptText" },
  { id: "vehicles", label: "Vehículos", icon: "Car" },
  { id: "monedas", label: "Monedas", icon: "DollarSign" },
  { id: "notificaciones", label: "Notificaciones", icon: "Bell" },
  { id: "impresoras", label: "Impresoras", icon: "Printer" },
  { id: "dialogos", label: "Diálogos", icon: "MessageSquareText" },
];

export function buildDefaultPdfDocumentSettings() {
  return {
    watermark_enabled: true,
    watermark_opacity: 0.11,
    watermark_scale: 0.62,
    watermark_logo_url: "",
    show_status_badge: true,
    theme_colors: {
      invoice_paid: "#16A34A",
      quotation: "#2563EB",
      invoice_credit: "#DC2626",
      payment_partial: "#EAB308",
      invoice_pending: "#1E3A5F",
      petty_cash: "#7C3AED",
    },
    sections: {
      invoice: { ...INVOICE_SECTIONS },
      quotation: { ...QUOTATION_SECTIONS },
      payment_receipt: { ...PAYMENT_RECEIPT_SECTIONS },
      petty_cash: { ...PETTY_CASH_SECTIONS },
    },
  };
}

export function sectionOptionsForDocType(docType) {
  const keys = Object.keys(DEFAULT_PDF_DOCUMENT_SECTIONS[docType] || {});
  return keys.map((key) => ({
    key,
    label: PDF_SECTION_LABELS[key] || key,
    isBreakdownChild: key.startsWith("breakdown_") && key !== "breakdown",
  }));
}