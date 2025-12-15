import {
  PDFCheckBox,
  PDFDocument,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
} from "pdf-lib";

type ResponseLineItem = {
  unitCost?: string;
  deliveryDays?: string;
  countryOfOrigin?: string;
  manufacturer?: string;
  isIawNsn?: boolean;
  minimumQty?: string;
  qtyUnitPack?: string;
  exceptionNote?: string;
  noBidReason?: "" | "not_our_product" | "distributor_only" | "obsolete" | "out_of_stock" | "other";
  noBidOtherText?: string;
};

type ResponseData = {
  pricesFirmUntil?: string;
  quoteRefNum?: string;
  paymentTerms?: string;
  paymentTermsOther?: string;
  shippingCost?: "noFreight" | "ppa";
  fob?: "origin" | "destination";
  purchaseOrderMinimum?: string;
  samUei?: string;
  cageCode?: string;
  samRegistered?: boolean;
  naicsCode?: string;
  naicsSizeStandard?: string;
  businessType?: "large" | "small";
  smallDisadvantaged?: boolean;
  womanOwned?: boolean;
  veteranOwned?: boolean;
  serviceDisabledVetOwned?: boolean;
  hubZone?: boolean;
  hbcu?: boolean;
  alaskaNative?: boolean;
  otherSmallBusiness?: boolean;
  employeeCount?: string;
  lineItems?: ResponseLineItem[];
  authorizedSignature?: string;
  signatureDate?: string;
  noBidReason?: "" | "not_accepting" | "geographic" | "debarred" | "other";
  noBidOtherText?: string;
};

function formatMMDDYY(isoDate: string): string {
  const date = new Date(isoDate);
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const yy = date.getFullYear().toString().slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function safeSetText(form: any, fieldName: string, value: string | null | undefined) {
  if (!value) return;
  try {
    const field = form.getField(fieldName);
    if (field instanceof PDFTextField) {
      field.setText(String(value));
    }
  } catch {
    // ignore missing fields
  }
}

function safeSetCheckbox(form: any, fieldName: string, checked: boolean) {
  try {
    const field = form.getField(fieldName);
    if (field instanceof PDFCheckBox) {
      if (checked) field.check();
      else field.uncheck();
    }
  } catch {
    // ignore missing fields
  }
}

function safeSelectRadio(
  form: any,
  fieldName: string,
  optionsPicker: (options: string[]) => string | null
) {
  try {
    const field = form.getField(fieldName);
    if (!(field instanceof PDFRadioGroup)) return;
    const options = field.getOptions();
    const pick = optionsPicker(options);
    if (pick) field.select(pick);
  } catch {
    // ignore missing fields / selection issues
  }
}

function pickByIndex(options: string[], idx: number): string | null {
  if (idx < 0 || idx >= options.length) return null;
  return options[idx];
}

function pickContains(options: string[], needle: RegExp): string | null {
  return options.find((o) => needle.test(o)) ?? null;
}

function employeeCountToSizeIndex(employeeCount: string | undefined): number | null {
  if (!employeeCount) return null;
  switch (employeeCount) {
    case "<500":
      return 0;
    case "501-750":
      return 1;
    case "751-1000":
      return 2;
    case "1001-1500":
      return 3;
    case ">1500":
      return 4;
    default:
      return null;
  }
}

export async function fillAsrcAcroFormIfPresent(
  pdfDoc: PDFDocument,
  responseData: ResponseData
): Promise<{ filled: boolean }> {
  let form;
  try {
    form = pdfDoc.getForm();
  } catch {
    return { filled: false };
  }

  const fieldNames = new Set(form.getFields().map((f: any) => f.getName()));
  const hasKnown = fieldNames.has("priceFirmUntil") || fieldNames.has("unitCost-1");
  if (!hasKnown) return { filled: false };

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Quote details
  if (responseData.pricesFirmUntil) {
    safeSetText(form, "priceFirmUntil", formatMMDDYY(responseData.pricesFirmUntil));
  }
  safeSetText(form, "quoteRefNum", responseData.quoteRefNum);

  // Payment terms
  safeSelectRadio(form, "paymentTerms", (options) => {
    if (responseData.paymentTerms === "net45") {
      return pickContains(options, /45/i) ?? pickByIndex(options, 0);
    }
    return pickContains(options, /other/i) ?? pickByIndex(options, 1) ?? pickByIndex(options, 0);
  });
  safeSetText(form, "paymentTermsOther", responseData.paymentTermsOther);

  // Shipping & handling
  safeSetCheckbox(form, "complimentaryFreight", responseData.shippingCost === "noFreight");
  safeSetCheckbox(form, "ppaByVender", responseData.shippingCost === "ppa");
  safeSelectRadio(form, "fob", (options) => {
    if (responseData.fob === "origin") {
      return pickContains(options, /origin/i) ?? pickByIndex(options, 0);
    }
    if (responseData.fob === "destination") {
      return pickContains(options, /destination/i) ?? pickByIndex(options, 1) ?? pickByIndex(options, 0);
    }
    return null;
  });
  safeSetText(form, "purchaseOrderMinimum", responseData.purchaseOrderMinimum);

  // Business info
  safeSetText(form, "SAMUEI", responseData.samUei);
  safeSetText(form, "CAGE", responseData.cageCode);
  safeSelectRadio(form, "SAM", (options) => {
    if (responseData.samRegistered === true) {
      return pickContains(options, /^yes$/i) ?? pickContains(options, /yes/i) ?? pickByIndex(options, 0);
    }
    if (responseData.samRegistered === false) {
      return pickContains(options, /^no$/i) ?? pickContains(options, /no/i) ?? pickByIndex(options, 1) ?? pickByIndex(options, 0);
    }
    return null;
  });
  safeSetText(form, "NAICS", responseData.naicsCode);
  safeSetText(form, "NAICSSIZE", responseData.naicsSizeStandard);

  safeSelectRadio(form, "BT", (options) => {
    if (responseData.businessType === "large") {
      return pickContains(options, /large/i) ?? pickByIndex(options, 0);
    }
    if (responseData.businessType === "small") {
      return pickContains(options, /small/i) ?? pickByIndex(options, 1) ?? pickByIndex(options, 0);
    }
    return null;
  });

  safeSetCheckbox(form, "smalldisad", !!responseData.smallDisadvantaged);
  safeSetCheckbox(form, "HubZone", !!responseData.hubZone);
  safeSetCheckbox(form, "womenowned", !!responseData.womanOwned);
  safeSetCheckbox(form, "vetowned", !!responseData.veteranOwned);
  safeSetCheckbox(form, "sdvet", !!responseData.serviceDisabledVetOwned);
  safeSetCheckbox(form, "hist", !!responseData.hbcu);
  safeSetCheckbox(form, "ANC", !!responseData.alaskaNative);
  safeSetCheckbox(form, "other", !!responseData.otherSmallBusiness);

  safeSelectRadio(form, "size", (options) => {
    const idx = employeeCountToSizeIndex(responseData.employeeCount);
    if (idx == null) return null;
    return pickByIndex(options, idx);
  });

  // Global no-bid (if present on the template)
  safeSelectRadio(form, "noBidCode", (options) => {
    if (!responseData.noBidReason) return null;
    const idx =
      responseData.noBidReason === "not_accepting"
        ? 0
        : responseData.noBidReason === "geographic"
          ? 1
          : responseData.noBidReason === "debarred"
            ? 2
            : 3;
    return pickByIndex(options, idx) ?? pickByIndex(options, 0);
  });
  if (responseData.noBidReason === "other") {
    safeSetText(form, "noBidReason", responseData.noBidOtherText || "");
  }

  // Signature fields (field names vary across templates; fill only if present)
  if (responseData.authorizedSignature) {
    safeSetText(form, "authorizedSignature", responseData.authorizedSignature);
    safeSetText(form, "AuthorizedSignature", responseData.authorizedSignature);
    safeSetText(form, "signature", responseData.authorizedSignature);
  }
  if (responseData.signatureDate) {
    safeSetText(form, "signatureDate", formatMMDDYY(responseData.signatureDate));
    safeSetText(form, "SignatureDate", formatMMDDYY(responseData.signatureDate));
    safeSetText(form, "date", formatMMDDYY(responseData.signatureDate));
  }

  // Per-line-item fields (supports suffix pattern)
  const items = responseData.lineItems || [];
  for (let i = 0; i < items.length; i++) {
    const n = i + 1;
    const item = items[i];

    safeSelectRadio(form, `noBidReason-${n}`, (options) => {
      if (!item.noBidReason) return null;
      const idx =
        item.noBidReason === "not_our_product"
          ? 0
          : item.noBidReason === "distributor_only"
            ? 1
            : item.noBidReason === "obsolete"
              ? 2
              : item.noBidReason === "out_of_stock"
                ? 3
                : 4;
      return pickByIndex(options, idx) ?? pickByIndex(options, 0);
    });
    if (item.noBidReason === "other") {
      safeSetText(form, `noBidOther-${n}`, item.noBidOtherText || "");
    }

    const lineNoBid = !!item.noBidReason;
    safeSetText(form, `unitCost-${n}`, lineNoBid ? "" : item.unitCost);
    safeSetText(form, `deliveryDays-${n}`, lineNoBid ? "" : item.deliveryDays);

    safeSelectRadio(form, `madeIn-${n}`, (options) => {
      const origin = (item.countryOfOrigin || "").trim();
      if (!origin) return null;
      if (origin.toUpperCase() === "USA" || origin.toUpperCase() === "US") {
        return pickContains(options, /usa/i) ?? pickByIndex(options, 0);
      }
      return pickContains(options, /other/i) ?? pickByIndex(options, 1) ?? pickByIndex(options, 0);
    });
    if (item.countryOfOrigin && item.countryOfOrigin.toUpperCase() !== "USA" && item.countryOfOrigin.toUpperCase() !== "US") {
      safeSetText(form, `madeInOther-${n}`, item.countryOfOrigin);
    }

    const exceptionParts = [];
    if (item.manufacturer) exceptionParts.push(`MFR: ${item.manufacturer}`);
    if (item.exceptionNote) exceptionParts.push(`NOTE: ${item.exceptionNote}`);
    safeSetText(form, `exceptionNote-${n}`, exceptionParts.join(" "));

    if (typeof item.isIawNsn === "boolean") {
      safeSetText(form, `polchemQuestion1-${n}`, item.isIawNsn ? "Y" : "N");
    }
    safeSetText(form, `polchemQuestion2-${n}`, item.minimumQty);
    safeSetText(form, `polchemQuestion3-${n}`, item.qtyUnitPack);
  }

  form.updateFieldAppearances(font);
  return { filled: true };
}
