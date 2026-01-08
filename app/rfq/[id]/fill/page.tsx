"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Zap,
  CheckCircle2,
  Download,
  FileUp,
  Clock,
  AlertTriangle,
  Package,
  FileText,
  Building2,
  Truck,
  ClipboardList,
  Box,
  XCircle,
  FileDown,
  FileBadge,
} from "lucide-react";
import type { RfqSummary } from "@/lib/rfq-extraction-prompt";
import { PastBidSearch } from "./PastBidSearch";

interface RFQData {
  id: number;
  fileName: string;
  s3Url: string;
  extractedFields: {
    rfqSummary?: RfqSummary;
    // Legacy fields for backward compatibility
    rfqNumber?: string;
    requestedReplyDate?: string;
    contractingOffice?: string;
    items?: Array<{
      itemNumber?: string;
      quantity?: number;
      unit?: string;
      description?: string;
      nsn?: string;
      partNumber?: string;
      manufacturerPartNumber?: string;
      hazmat?: boolean;
      unNumber?: string;
    }>;
  };
}

interface CompanyProfile {
  companyName: string;
  cageCode: string;
  samUei: string;
  naicsCode: string;
  contactPerson: string;
  defaultPaymentTerms: string;
  defaultFob: string;
  businessType: string;
  smallDisadvantaged: boolean;
  womanOwned: boolean;
  veteranOwned: boolean;
  serviceDisabledVetOwned: boolean;
  hubZone: boolean;
}

export default function RFQFillPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.id as string;

  const [rfqData, setRfqData] = useState<RFQData | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingBranded, setGeneratingBranded] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Vendor quote fields
  const [vendorQuoteRef, setVendorQuoteRef] = useState("");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");

  // Track which line item is being edited (for past price selection)
  const [activeLineItemIndex, setActiveLineItemIndex] = useState(0);

  const [profileData, setProfileData] = useState({
    quoteRefNum: "",
    cageCode: "",
    samUei: "",
    naicsCode: "",
    samRegistered: true,
    paymentTerms: "other",
    paymentTermsOther: "Net 30",
    shippingCost: "noFreight" as "noFreight" | "ppa",
    fob: "origin" as "origin" | "destination",
    businessType: "small" as "large" | "small",
    smallDisadvantaged: false,
    womanOwned: false,
    veteranOwned: false,
    serviceDisabledVetOwned: false,
    hubZone: false,
    employeeCount: "<500",
    authorizedSignature: "",
    signatureDate: new Date().toISOString().split("T")[0],
    pricesFirmUntil: "",
    noBidReason: "" as "" | "not_accepting" | "geographic" | "debarred" | "other",
    noBidOtherText: "",
    lineItems: [] as Array<{
      itemNumber: string;
      unitCost: string;
      deliveryDays: string;
      countryOfOrigin: string;
      manufacturer: string;
      isIawNsn: boolean;
      minimumQty: string;
      qtyUnitPack: string;
      exceptionNote: string;
      noBidReason: "" | "low_quantity" | "nsn_no_bid" | "other";  // Simplified: qty too low, NSN we don't bid, other
      noBidOtherText: string;
      priceBreaks: Array<{
        fromQty: number;
        toQty: number;
        unitCost: string;
        deliveryDays: string;
      }>;
    }>,
  });

  const fetchData = useCallback(async () => {
    try {
      let rfq: RFQData | null = null;
      const rfqResponse = await fetch(`/api/rfq/${rfqId}`);
      if (rfqResponse.ok) {
        rfq = await rfqResponse.json();
        setRfqData(rfq);
      }

      const profileResponse = await fetch("/api/company-profile");
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        if (profile) {
          setCompanyProfile(profile);
          applyProfile(profile, rfq);
        }
      }

      // Load existing draft/submitted response (if any) and merge into state.
      const responseRes = await fetch(`/api/rfq/${rfqId}/response`);
      if (responseRes.ok) {
        const { response } = await responseRes.json();
        if (response?.responseData && typeof response.responseData === "object") {
          const saved = response.responseData as any;
          setProfileData((prev) => {
            const mergedLineItems = prev.lineItems.map((li, idx) => ({
              ...li,
              ...(saved.lineItems?.[idx] || {}),
              priceBreaks: Array.isArray(saved.lineItems?.[idx]?.priceBreaks)
                ? saved.lineItems[idx].priceBreaks
                : li.priceBreaks,
            }));

            return {
              ...prev,
              ...saved,
              lineItems: mergedLineItems,
            };
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyProfile = (profile: CompanyProfile, rfq: RFQData | null) => {
    const firmUntil = new Date();
    firmUntil.setDate(firmUntil.getDate() + 30);

    const rfqSummary = rfq?.extractedFields?.rfqSummary;
    const extractedItems = (rfqSummary?.items || rfq?.extractedFields?.items || []) as Array<any>;
    const lineItems = extractedItems.map((item, index) => ({
      itemNumber: item?.itemNumber || String(index + 1),
      unitCost: "",
      deliveryDays: "45",              // ALWAYS 45 days - boss never changes this
      countryOfOrigin: "USA",          // ALWAYS USA - boss never changes this
      manufacturer: profile.companyName || "",
      isIawNsn: true,                  // Default Yes
      minimumQty: "",
      qtyUnitPack: "",
      exceptionNote: "",
      noBidReason: "" as "" | "low_quantity" | "nsn_no_bid" | "other",  // Simplified no-bid reasons
      noBidOtherText: "",
      priceBreaks: [] as Array<{ fromQty: number; toQty: number; unitCost: string; deliveryDays: string }>,
    }));

    const year = new Date().getFullYear();
    const defaultQuoteRefNum = `AC-${year}-${Math.floor(Math.random() * 10000)}`;

    // Generate vendor quote ref using the new format: ACQ-RFQ-{rfqNumber}-{seq}
    const rfqNumber = rfqSummary?.header?.rfqNumber || rfq?.extractedFields?.rfqNumber;
    const cleanRfqNum = rfqNumber ? rfqNumber.replace(/[^a-zA-Z0-9-]/g, "") : String(rfq?.id || "0");
    const defaultVendorQuoteRef = `ACQ-RFQ-${cleanRfqNum}-1`;

    // Set vendor quote fields
    setVendorQuoteRef(defaultVendorQuoteRef);
    setQuoteValidUntil(firmUntil.toISOString().split("T")[0]);
    setQuoteNotes("");

    setProfileData({
      quoteRefNum: defaultQuoteRefNum,
      cageCode: profile.cageCode || "",
      samUei: profile.samUei || "",
      naicsCode: profile.naicsCode || "",
      samRegistered: true,
      paymentTerms: profile.defaultPaymentTerms === "Net 45" ? "net45" : "other",
      paymentTermsOther: profile.defaultPaymentTerms || "Net 30",
      shippingCost: "noFreight",
      fob: profile.defaultFob === "destination" ? "destination" : "origin",
      businessType: profile.businessType === "large" ? "large" : "small",
      smallDisadvantaged: profile.smallDisadvantaged ?? false,
      womanOwned: profile.womanOwned ?? false,
      veteranOwned: profile.veteranOwned ?? false,
      serviceDisabledVetOwned: profile.serviceDisabledVetOwned ?? false,
      hubZone: profile.hubZone ?? false,
      employeeCount: "<500",
      authorizedSignature: profile.contactPerson || "",
      signatureDate: new Date().toISOString().split("T")[0],
      pricesFirmUntil: firmUntil.toISOString().split("T")[0],
      noBidReason: "",
      noBidOtherText: "",
      lineItems,
    });
    setProfileLoaded(true);
  };

  // Validation checklist - returns list of missing required fields
  const getValidationErrors = (): string[] => {
    const errors: string[] = [];

    // Check line items have pricing (unless no-bid)
    profileData.lineItems.forEach((item, idx) => {
      if (!item.noBidReason && (!item.unitCost || item.unitCost.trim() === "")) {
        errors.push(`Line ${item.itemNumber || idx + 1}: Unit price required`);
      }
    });

    // Check at least one line item is bidding (or global no-bid is set)
    const hasBiddingItems = profileData.lineItems.some((item) => !item.noBidReason && item.unitCost);
    const isGlobalNoBid = !!profileData.noBidReason;
    if (!hasBiddingItems && !isGlobalNoBid) {
      errors.push("At least one line item must have pricing");
    }

    return errors;
  };

  const validationErrors = getValidationErrors();
  const isReadyToGenerate = validationErrors.length === 0 || !!profileData.noBidReason;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/rfq/${rfqId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseData: profileData }),
      });

      if (!response.ok) throw new Error("Failed to generate PDF");

      const { pdfUrl } = await response.json();
      window.open(pdfUrl, "_blank");
    } catch (error) {
      console.error("Generate error:", error);
      alert("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBranded = async () => {
    if (!isReadyToGenerate) {
      alert("Please fill in all required fields before generating the quote.");
      return;
    }

    setGeneratingBranded(true);
    try {
      const response = await fetch(`/api/rfq/${rfqId}/generate-branded`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseData: profileData,
          vendorQuoteRef: vendorQuoteRef || undefined,
          quoteValidUntil: quoteValidUntil || undefined,
          notes: quoteNotes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate branded quote PDF");
      }

      // Response is a PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Get filename from header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `AllianceChemicalQuote_${vendorQuoteRef}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) filename = match[1];
      }

      // Update vendorQuoteRef from response header if server generated one
      const serverQuoteRef = response.headers.get("X-Vendor-Quote-Ref");
      if (serverQuoteRef && serverQuoteRef !== vendorQuoteRef) {
        setVendorQuoteRef(serverQuoteRef);
      }

      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Generate branded error:", error);
      alert(error instanceof Error ? error.message : "Failed to generate branded quote PDF");
    } finally {
      setGeneratingBranded(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch(`/api/rfq/${rfqId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseData: profileData }),
      });
      if (!res.ok) throw new Error("Failed to save draft");
      alert("Draft saved");
    } catch (error) {
      console.error("Save draft error:", error);
      alert("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const updateLineItem = (index: number, patch: Partial<(typeof profileData.lineItems)[number]>) => {
    setProfileData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)),
    }));
  };

  const updatePriceBreak = (
    itemIndex: number,
    breakIndex: number,
    patch: Partial<(typeof profileData.lineItems)[number]["priceBreaks"][number]>
  ) => {
    setProfileData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, idx) => {
        if (idx !== itemIndex) return li;
        const next = li.priceBreaks.map((pb, j) => (j === breakIndex ? { ...pb, ...patch } : pb));
        return { ...li, priceBreaks: next };
      }),
    }));
  };

  const addPriceBreak = (itemIndex: number) => {
    setProfileData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, idx) => {
        if (idx !== itemIndex) return li;
        if (li.priceBreaks.length >= 4) return li;
        return {
          ...li,
          priceBreaks: [...li.priceBreaks, { fromQty: 0, toQty: 0, unitCost: "", deliveryDays: "" }],
        };
      }),
    }));
  };

  const removePriceBreak = (itemIndex: number, breakIndex: number) => {
    setProfileData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, idx) => {
        if (idx !== itemIndex) return li;
        return { ...li, priceBreaks: li.priceBreaks.filter((_, j) => j !== breakIndex) };
      }),
    }));
  };

  // Handler for when boss clicks a past price from search results
  const handlePastPriceSelect = (unitCost: string, itemIndex?: number) => {
    const targetIndex = itemIndex ?? activeLineItemIndex;
    updateLineItem(targetIndex, { unitCost });
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    setUploading(true);
    try {
      const presignResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: "application/pdf" }),
      });
      if (!presignResponse.ok) throw new Error("Failed to get upload URL");
      const { url, key } = await presignResponse.json();

      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!uploadResponse.ok) throw new Error("Upload failed");

      const bucketUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET || "simurgh-rfq-bucket"}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1"}.amazonaws.com`;
      const pdfUrl = `${bucketUrl}/${key}`;

      await fetch(`/api/rfq/${rfqId}/upload-completed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrl, s3Key: key, responseData: profileData }),
      });

      router.push("/projects");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!rfqData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">RFQ not found</p>
      </div>
    );
  }

  // Support both new rfqSummary format and legacy format
  const rfqSummary = rfqData.extractedFields?.rfqSummary;
  const header = rfqSummary?.header;
  const buyer = rfqSummary?.buyer;
  const items = rfqSummary?.items || rfqData.extractedFields?.items || [];
  const hazmat = rfqSummary?.hazmat;
  const packaging = rfqSummary?.packaging;
  const lotControl = rfqSummary?.lotControl;
  const docsRequired = rfqSummary?.documentationRequired || [];

  // For backward compatibility
  const rfqNumber = header?.rfqNumber || rfqData.extractedFields?.rfqNumber;
  const requestedReplyDate = header?.requestedReplyDate || rfqData.extractedFields?.requestedReplyDate;
  const contractingOffice = buyer?.contractingOffice || rfqData.extractedFields?.contractingOffice;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            href="/projects"
            className="inline-flex items-center text-gray-500 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                RFQ #{rfqNumber || rfqData.fileName}
              </h1>
              <p className="text-gray-500">{contractingOffice}</p>
            </div>

            {requestedReplyDate && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-full">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Due {requestedReplyDate}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: PDF Preview */}
          <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-120px)]">
            <div className="bg-white rounded-2xl border shadow-sm h-full overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Original RFQ</span>
                {rfqData.s3Url && (
                  <a
                    href={rfqData.s3Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Open in new tab
                    <Download className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex-1 bg-gray-100">
                {rfqData.s3Url ? (
                  <iframe
                    src={`${rfqData.s3Url}#toolbar=0&navpanes=0`}
                    className="w-full h-full"
                    title="RFQ PDF Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No PDF available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Extracted Data + Actions */}
          <div className="space-y-6">

            {/* RFQ Header Info */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-gray-400" />
                <h2 className="font-semibold text-gray-900">RFQ Details</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {header?.rfqDate && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase">RFQ Date</p>
                    <p className="font-medium">{header.rfqDate}</p>
                  </div>
                )}
                {requestedReplyDate && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Reply By</p>
                    <p className="font-medium text-amber-600">{requestedReplyDate}</p>
                  </div>
                )}
                {header?.deliveryBeforeDate && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Deliver By</p>
                    <p className="font-medium">{header.deliveryBeforeDate}</p>
                  </div>
                )}
                {buyer?.primeContractNumber && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Prime Contract</p>
                    <p className="font-mono text-xs">{buyer.primeContractNumber}</p>
                  </div>
                )}
              </div>

              {/* POC Info */}
              {(buyer?.pocName || buyer?.pocEmail || buyer?.pocPhone) && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-gray-400 text-xs uppercase mb-2">Point of Contact</p>
                  <div className="space-y-1 text-sm">
                    {buyer?.pocName && <p className="font-medium">{buyer.pocName}</p>}
                    {buyer?.pocEmail && <p className="text-blue-600">{buyer.pocEmail}</p>}
                    {buyer?.pocPhone && <p className="text-gray-600">{buyer.pocPhone}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Past Bid Search - Boss's quick lookup */}
            <PastBidSearch
              onSelectPrice={handlePastPriceSelect}
              currentNsn={items[0]?.nsn}
              activeLineItemIndex={activeLineItemIndex}
              lineItemCount={items.length}
            />

            {/* LINE ITEMS */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-gray-400" />
                <h2 className="font-semibold text-gray-900">
                  Line Items ({items.length})
                </h2>
                <span className="ml-auto text-xs text-gray-400">
                  PDF fills matching item fields when available
                </span>
              </div>

              <div className="space-y-6">
                {items.map((item, index) => {
                  const responseItem = profileData.lineItems[index];
                  const pricingDisabled = profileData.noBidReason !== "";

                  return (
                    <div key={index} className={`${index > 0 ? "pt-6 border-t" : ""}`}>
                    {/* Item Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-gray-900">
                          {item.quantity || "?"}
                        </span>
                        <span className="text-lg text-gray-500">
                          {item.unit || "EA"}
                        </span>
                      </div>
                      {item.itemNumber && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                          Item {item.itemNumber}
                        </span>
                      )}
                    </div>

                    {/* Product Type & Description */}
                    <div className="mb-3">
                      {"productType" in item && item.productType && (
                        <p className="text-lg font-semibold text-gray-900 mb-1">
                          {item.productType}
                        </p>
                      )}
                      {"shortDescription" in item && item.shortDescription && (
                        <p className="text-gray-600 text-sm">
                          {item.shortDescription}
                        </p>
                      )}
                      {/* Legacy: full description */}
                      {"description" in item && item.description && !("shortDescription" in item) && (
                        <p className="text-gray-600 text-sm whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Part Numbers & IDs */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {item.nsn && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-blue-400 text-xs uppercase">NSN</p>
                          <p className="font-mono font-medium text-blue-900">{item.nsn}</p>
                        </div>
                      )}
                      {item.partNumber && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-400 text-xs uppercase">Part Number</p>
                          <p className="font-mono font-medium text-gray-900">{item.partNumber}</p>
                        </div>
                      )}
                      {item.manufacturerPartNumber && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-400 text-xs uppercase">Mfr P/N</p>
                          <p className="font-mono font-medium text-gray-900">{item.manufacturerPartNumber}</p>
                        </div>
                      )}
                      {"specification" in item && item.specification && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-400 text-xs uppercase">Spec</p>
                          <p className="text-gray-900 text-sm">{item.specification}</p>
                        </div>
                      )}
                    </div>

                    {/* Hazmat Warning */}
                    {(("isHazmat" in item && item.isHazmat) || ("hazmat" in item && item.hazmat)) && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-medium text-red-900">HAZMAT Material</p>
                          {item.unNumber && (
                            <p className="text-sm text-red-700">UN: {item.unNumber}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pricing - Simplified for boss */}
                    <div className="mt-4 rounded-xl overflow-hidden border-2 border-green-200">
                      {/* Header with defaults indicator */}
                      <div className="bg-green-50 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-green-900">Your Quote</p>
                          <p className="text-xs text-green-700 flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded">
                              <Truck className="h-3 w-3" />
                              45 days
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded">
                              Made in USA
                            </span>
                            <span className="text-green-600">(auto-filled)</span>
                          </p>
                        </div>
                        {pricingDisabled && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Global No Bid</span>
                        )}
                      </div>

                      <div className="bg-white p-4 space-y-4">
                        {/* No-Bid Toggle - compact */}
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!responseItem?.noBidReason}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateLineItem(index, { noBidReason: "low_quantity", unitCost: "" });
                                } else {
                                  updateLineItem(index, { noBidReason: "" });
                                }
                              }}
                              disabled={pricingDisabled}
                              className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm font-medium text-gray-700">No Bid</span>
                          </label>

                          {responseItem?.noBidReason && (
                            <select
                              value={responseItem.noBidReason}
                              onChange={(e) => updateLineItem(index, { noBidReason: e.target.value as "" | "low_quantity" | "nsn_no_bid" | "other" })}
                              className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm"
                            >
                              <option value="low_quantity">Quantity too low</option>
                              <option value="nsn_no_bid">NSN we don&apos;t bid on</option>
                              <option value="other">Other reason</option>
                            </select>
                          )}
                          {responseItem?.noBidReason === "other" && (
                            <input
                              value={responseItem?.noBidOtherText || ""}
                              onChange={(e) => updateLineItem(index, { noBidOtherText: e.target.value })}
                              placeholder="Specify reason"
                              className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm"
                            />
                          )}
                        </div>

                        {/* Unit Cost - THE MAIN INPUT */}
                        {!responseItem?.noBidReason && (
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                              Unit Price ($) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={responseItem?.unitCost || ""}
                                onChange={(e) => updateLineItem(index, { unitCost: e.target.value })}
                                onFocus={() => setActiveLineItemIndex(index)}
                                placeholder="Enter price"
                                className="w-full h-14 pl-10 pr-4 rounded-xl border-2 border-green-300 bg-green-50 text-2xl font-bold text-gray-900 focus:border-green-500 focus:ring-4 focus:ring-green-100 focus:bg-white transition-all"
                                autoComplete="off"
                              />
                            </div>
                            {responseItem?.unitCost && item.quantity && (
                              <div className="flex items-center justify-between text-sm bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                                <span className="text-blue-700">
                                  Total for {item.quantity} {item.unit || "EA"}:
                                </span>
                                <span className="font-bold text-blue-900 text-lg">
                                  ${(parseFloat(responseItem.unitCost) * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Advanced Options - Collapsible */}
                        {!responseItem?.noBidReason && (
                          <details className="group">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1">
                              <span className="group-open:rotate-90 transition-transform">▶</span>
                              Advanced options (rarely needed)
                            </summary>
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-gray-400 text-xs uppercase mb-1">Delivery Days</p>
                                  <input
                                    value={responseItem?.deliveryDays || "45"}
                                    onChange={(e) => updateLineItem(index, { deliveryDays: e.target.value })}
                                    placeholder="45"
                                    disabled={pricingDisabled}
                                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                  />
                                </div>
                                <div>
                                  <p className="text-gray-400 text-xs uppercase mb-1">Country</p>
                                  <select
                                    value={(responseItem?.countryOfOrigin || "USA").toUpperCase() === "USA" ? "USA" : "OTHER"}
                                    onChange={(e) => {
                                      if (e.target.value === "USA") {
                                        updateLineItem(index, { countryOfOrigin: "USA" });
                                      } else {
                                        updateLineItem(index, { countryOfOrigin: "" });
                                      }
                                    }}
                                    disabled={pricingDisabled}
                                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                  >
                                    <option value="USA">USA</option>
                                    <option value="OTHER">Other</option>
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-gray-400 text-xs uppercase mb-1">Manufacturer</p>
                                  <input
                                    value={responseItem?.manufacturer || ""}
                                    onChange={(e) => updateLineItem(index, { manufacturer: e.target.value })}
                                    placeholder="Your company"
                                    disabled={pricingDisabled}
                                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                  />
                                </div>
                                <div>
                                  <p className="text-gray-400 text-xs uppercase mb-1">IAW NSN?</p>
                                  <select
                                    value={responseItem?.isIawNsn ? "Y" : "N"}
                                    onChange={(e) => updateLineItem(index, { isIawNsn: e.target.value === "Y" })}
                                    disabled={pricingDisabled}
                                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                  >
                                    <option value="Y">Yes</option>
                                    <option value="N">No</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs uppercase mb-1">Exception Note</p>
                                <input
                                  value={responseItem?.exceptionNote || ""}
                                  onChange={(e) => updateLineItem(index, { exceptionNote: e.target.value })}
                                  placeholder="Optional"
                                  disabled={pricingDisabled}
                                  className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-gray-400 text-xs uppercase mb-1">Min Qty Run</p>
                                  <input
                                    value={responseItem?.minimumQty || ""}
                                    onChange={(e) => updateLineItem(index, { minimumQty: e.target.value })}
                                    placeholder="Optional"
                                    disabled={pricingDisabled}
                                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                  />
                                </div>
                                <div>
                                  <p className="text-gray-400 text-xs uppercase mb-1">Qty Unit Pack</p>
                                  <input
                                    value={responseItem?.qtyUnitPack || ""}
                                    onChange={(e) => updateLineItem(index, { qtyUnitPack: e.target.value })}
                                    placeholder="Optional"
                                    disabled={pricingDisabled}
                                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                  />
                                </div>
                              </div>

                              {/* Price Breaks */}
                              <div className="pt-2">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-gray-400 text-xs uppercase">Price Breaks</p>
                                  <button
                                    type="button"
                                    onClick={() => addPriceBreak(index)}
                                    disabled={pricingDisabled || (responseItem?.priceBreaks?.length || 0) >= 4}
                                    className="text-xs px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    + Add
                                  </button>
                                </div>
                                {(responseItem?.priceBreaks || []).length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">None</p>
                                ) : (
                                  <div className="space-y-2">
                                    {(responseItem?.priceBreaks || []).map((pb, pbIdx) => (
                                      <div key={pbIdx} className="grid grid-cols-5 gap-2 items-center">
                                        <input
                                          type="number"
                                          value={pb.fromQty}
                                          onChange={(e) => updatePriceBreak(index, pbIdx, { fromQty: Number(e.target.value) })}
                                          placeholder="From"
                                          className="h-8 px-2 rounded border border-gray-200 bg-white text-xs"
                                        />
                                        <input
                                          type="number"
                                          value={pb.toQty}
                                          onChange={(e) => updatePriceBreak(index, pbIdx, { toQty: Number(e.target.value) })}
                                          placeholder="To"
                                          className="h-8 px-2 rounded border border-gray-200 bg-white text-xs"
                                        />
                                        <input
                                          value={pb.unitCost}
                                          onChange={(e) => updatePriceBreak(index, pbIdx, { unitCost: e.target.value })}
                                          placeholder="Price"
                                          className="h-8 px-2 rounded border border-gray-200 bg-white text-xs"
                                        />
                                        <input
                                          value={pb.deliveryDays}
                                          onChange={(e) => updatePriceBreak(index, pbIdx, { deliveryDays: e.target.value })}
                                          placeholder="Days"
                                          className="h-8 px-2 rounded border border-gray-200 bg-white text-xs"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removePriceBreak(index, pbIdx)}
                                          className="h-8 px-2 rounded border border-gray-200 bg-white hover:bg-red-50 text-red-500 text-xs"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}

                {items.length === 0 && (
                  <p className="text-gray-400 text-center py-4">No line items extracted</p>
                )}
              </div>
            </div>

            {/* HAZMAT Details */}
            {hazmat?.isHazmat && (
              <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h2 className="font-semibold text-red-900">Hazmat Requirements</h2>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {hazmat.unNumber && (
                    <div>
                      <p className="text-red-400 text-xs uppercase">UN Number</p>
                      <p className="font-mono font-medium text-red-900">{hazmat.unNumber}</p>
                    </div>
                  )}
                  {hazmat.properShippingName && (
                    <div>
                      <p className="text-red-400 text-xs uppercase">Shipping Name</p>
                      <p className="font-medium text-red-900">{hazmat.properShippingName}</p>
                    </div>
                  )}
                  {hazmat.hazardClass && (
                    <div>
                      <p className="text-red-400 text-xs uppercase">Hazard Class</p>
                      <p className="font-medium text-red-900">{hazmat.hazardClass}</p>
                    </div>
                  )}
                  {hazmat.packingGroup && (
                    <div>
                      <p className="text-red-400 text-xs uppercase">Packing Group</p>
                      <p className="font-medium text-red-900">{hazmat.packingGroup}</p>
                    </div>
                  )}
                </div>

                {hazmat.regulations && hazmat.regulations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-red-400 text-xs uppercase mb-2">Regulations</p>
                    <div className="flex flex-wrap gap-2">
                      {hazmat.regulations.map((reg, i) => (
                        <span key={i} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          {reg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Packaging Requirements */}
            {packaging && (packaging.unitContainer || packaging.outerPackaging || packaging.milStandards?.length) && (
              <div className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Box className="h-5 w-5 text-gray-400" />
                  <h2 className="font-semibold text-gray-900">Packaging Requirements</h2>
                </div>

                <div className="space-y-3 text-sm">
                  {packaging.unitContainer && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-400 text-xs uppercase mb-1">Unit Container</p>
                      <p className="text-gray-800">{packaging.unitContainer}</p>
                    </div>
                  )}
                  {packaging.outerPackaging && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-400 text-xs uppercase mb-1">Outer Packaging</p>
                      <p className="text-gray-800">{packaging.outerPackaging}</p>
                    </div>
                  )}
                  {packaging.milStandards && packaging.milStandards.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase mb-2">MIL Standards</p>
                      <div className="flex flex-wrap gap-2">
                        {packaging.milStandards.map((std, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-mono">
                            {std}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {packaging.specialMarkings && packaging.specialMarkings.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase mb-2">Special Markings</p>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        {packaging.specialMarkings.map((mark, i) => (
                          <li key={i}>{mark}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lot Control */}
            {lotControl?.lotControlRequired && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                  <h2 className="font-semibold text-amber-900">Lot Control Required</h2>
                </div>
                {lotControl.lotMarkingText && (
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Marking:</span> {lotControl.lotMarkingText}
                  </p>
                )}
                {lotControl.lotSegregationRequired && (
                  <p className="text-sm text-amber-800 mt-1">Lot segregation required</p>
                )}
              </div>
            )}

            {/* Documentation Required */}
            {docsRequired.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <h2 className="font-semibold text-gray-900">Documentation Required</h2>
                </div>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {docsRequired.map((doc, i) => (
                    <li key={i}>{doc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Company Boilerplate Data */}
            {profileLoaded && (
              <div className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-green-500" />
                  <h2 className="font-semibold text-gray-900">Your Company Info</h2>
                  <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                  <span className="text-xs text-green-600">Auto-loaded</span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs uppercase">CAGE</p>
                    <p className="font-mono font-medium">{profileData.cageCode || "—"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs uppercase">SAM UEI</p>
                    <p className="font-mono font-medium text-xs">{profileData.samUei || "—"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs uppercase">NAICS</p>
                    <p className="font-mono font-medium">{profileData.naicsCode || "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs uppercase">Payment</p>
                    <p className="font-medium">
                      {profileData.paymentTerms === "net45" ? "Net 45" : profileData.paymentTermsOther}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs uppercase">FOB</p>
                    <p className="font-medium capitalize">{profileData.fob}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs uppercase">Prices Firm</p>
                    <p className="font-medium">{profileData.pricesFirmUntil || "—"}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {profileData.smallDisadvantaged && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">SDB</span>
                  )}
                  {profileData.womanOwned && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">WOSB</span>
                  )}
                  {profileData.veteranOwned && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">VOSB</span>
                  )}
                  {profileData.serviceDisabledVetOwned && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">SDVOSB</span>
                  )}
                  {profileData.hubZone && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">HUBZone</span>
                  )}
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">SAM Registered</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">No Freight Adder</span>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-gray-400 text-xs uppercase mb-1">Authorized Signature</p>
                  <p className="font-medium italic">{profileData.authorizedSignature || "—"}</p>
                </div>
              </div>
            )}

            {/* Submission Checklist */}
            <div className={`rounded-2xl border p-6 ${isReadyToGenerate ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                {isReadyToGenerate ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                <h2 className={`font-semibold ${isReadyToGenerate ? "text-green-900" : "text-amber-900"}`}>
                  Submission Checklist
                </h2>
              </div>

              {isReadyToGenerate ? (
                <p className="text-sm text-green-700">
                  All required fields are complete. You can generate the quote PDFs.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-amber-700 mb-2">
                    Please complete the following before generating:
                  </p>
                  <ul className="space-y-1">
                    {validationErrors.map((error, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-amber-800">
                        <XCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Vendor Quote Section */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileBadge className="h-5 w-5 text-blue-500" />
                <h2 className="font-semibold text-gray-900">Vendor Quote</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-2">Vendor Quote Reference</p>
                  <input
                    value={vendorQuoteRef}
                    onChange={(e) => setVendorQuoteRef(e.target.value)}
                    placeholder="e.g., ACQ-RFQ-12345-1"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Auto-generated. Edit if needed. This appears on the branded quote and PO.
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 text-xs uppercase mb-2">Quote Valid Until</p>
                  <input
                    type="date"
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"
                  />
                </div>

                <div>
                  <p className="text-gray-500 text-xs uppercase mb-2">Notes / Exceptions (optional)</p>
                  <textarea
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Keep brief. Do not contradict RFQ terms."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>

              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4 border">
                  <p className="text-gray-500 text-xs uppercase mb-2">Response</p>
                  <select
                    value={profileData.noBidReason}
                    onChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        noBidReason: e.target.value as typeof prev.noBidReason,
                        noBidOtherText: e.target.value === "other" ? prev.noBidOtherText : "",
                      }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"
                  >
                    <option value="">Bid (Fill pricing below)</option>
                    <option value="not_accepting">No Bid: Not accepting orders</option>
                    <option value="geographic">No Bid: Geographic limitation</option>
                    <option value="debarred">No Bid: Debarred / unable to comply</option>
                    <option value="other">No Bid: Other</option>
                  </select>
                  {profileData.noBidReason === "other" && (
                    <input
                      value={profileData.noBidOtherText}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, noBidOtherText: e.target.value }))}
                      placeholder="Other reason"
                      className="mt-2 w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"
                    />
                  )}
                </div>

                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft || !profileLoaded}
                  className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  {savingDraft ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  {savingDraft ? "Saving..." : "Save Draft"}
                </button>

                {/* Two separate download buttons */}
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !profileLoaded || (!isReadyToGenerate && !profileData.noBidReason)}
                    className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <FileDown className="h-5 w-5" />
                    )}
                    {generating
                      ? "Generating..."
                      : profileData.noBidReason
                        ? "Download Buyer Form (No-Bid)"
                        : "Download Buyer Form PDF"}
                  </button>

                  <button
                    onClick={handleGenerateBranded}
                    disabled={generatingBranded || !profileLoaded || !isReadyToGenerate}
                    className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingBranded ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <FileBadge className="h-5 w-5" />
                    )}
                    {generatingBranded ? "Generating..." : "Download Branded Quote PDF"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {rfqData.s3Url && (
                    <a
                      href={rfqData.s3Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 h-10 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      Original PDF
                    </a>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 h-10 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading..." : "Upload Completed"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-4 text-center">
                Fill pricing above → Download PDFs. Branded quote includes your company letterhead.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
