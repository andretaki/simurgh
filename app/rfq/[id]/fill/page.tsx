"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import type { RfqSummary } from "@/lib/rfq-extraction-prompt";

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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = useState({
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
  });

  useEffect(() => {
    fetchData();
  }, [rfqId]);

  const fetchData = async () => {
    try {
      const rfqResponse = await fetch(`/api/rfq/${rfqId}`);
      if (rfqResponse.ok) {
        setRfqData(await rfqResponse.json());
      }

      const profileResponse = await fetch("/api/company-profile");
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        if (profile) {
          setCompanyProfile(profile);
          applyProfile(profile);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  const applyProfile = (profile: CompanyProfile) => {
    const firmUntil = new Date();
    firmUntil.setDate(firmUntil.getDate() + 30);

    setProfileData({
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
    });
    setProfileLoaded(true);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/rfq/${rfqId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseData: profileData, boilerplateOnly: true }),
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

            {/* LINE ITEMS */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-gray-400" />
                <h2 className="font-semibold text-gray-900">
                  Line Items ({items.length})
                </h2>
              </div>

              <div className="space-y-6">
                {items.map((item, index) => (
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
                  </div>
                ))}

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

            {/* Actions */}
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>

              <div className="space-y-3">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !profileLoaded}
                  className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Zap className="h-5 w-5" />
                  )}
                  {generating ? "Generating..." : "Download Pre-Filled PDF"}
                </button>

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
                Download pre-filled PDF → Add pricing in Adobe → Upload completed response
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
