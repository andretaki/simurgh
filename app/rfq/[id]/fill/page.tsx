"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Zap,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Download,
  FileUp,
  Clock,
  Building2,
  AlertTriangle,
} from "lucide-react";

interface RFQData {
  id: number;
  fileName: string;
  s3Url: string;
  extractedFields: {
    rfqNumber?: string;
    requestedReplyDate?: string;
    contractingOffice?: string;
    items?: Array<{
      itemNumber: string;
      quantity: number;
      unit: string;
      description: string;
      nsn?: string;
      hazmat?: boolean;
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // For PDF boilerplate fill
  const [profileData, setProfileData] = useState({
    // Business identifiers
    cageCode: "",
    samUei: "",
    naicsCode: "",
    samRegistered: true,

    // Terms
    paymentTerms: "other", // "net45" or "other"
    paymentTermsOther: "Net 30",
    shippingCost: "noFreight" as "noFreight" | "ppa",
    fob: "origin" as "origin" | "destination",

    // Business type & certifications
    businessType: "small" as "large" | "small",
    smallDisadvantaged: false,
    womanOwned: false,
    veteranOwned: false,
    serviceDisabledVetOwned: false,
    hubZone: false,
    employeeCount: "<500",

    // Signature
    authorizedSignature: "",
    signatureDate: new Date().toISOString().split("T")[0],

    // Quote header
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
    // Set prices firm until to 30 days from now
    const firmUntil = new Date();
    firmUntil.setDate(firmUntil.getDate() + 30);

    setProfileData({
      // Business identifiers
      cageCode: profile.cageCode || "",
      samUei: profile.samUei || "",
      naicsCode: profile.naicsCode || "",
      samRegistered: true,

      // Terms
      paymentTerms: profile.defaultPaymentTerms === "Net 45" ? "net45" : "other",
      paymentTermsOther: profile.defaultPaymentTerms || "Net 30",
      shippingCost: "noFreight",
      fob: profile.defaultFob === "destination" ? "destination" : "origin",

      // Business type & certifications
      businessType: profile.businessType === "large" ? "large" : "small",
      smallDisadvantaged: profile.smallDisadvantaged ?? false,
      womanOwned: profile.womanOwned ?? false,
      veteranOwned: profile.veteranOwned ?? false,
      serviceDisabledVetOwned: profile.serviceDisabledVetOwned ?? false,
      hubZone: profile.hubZone ?? false,
      employeeCount: "<500",

      // Signature
      authorizedSignature: profile.contactPerson || "",
      signatureDate: new Date().toISOString().split("T")[0],

      // Quote header
      pricesFirmUntil: firmUntil.toISOString().split("T")[0],
    });
    setProfileLoaded(true);
  };

  // Generate PDF with boilerplate filled (no pricing)
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

  const extracted = rfqData.extractedFields || {};
  const firstItem = extracted.items?.[0];

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
                RFQ #{extracted.rfqNumber || rfqData.fileName}
              </h1>
              <p className="text-gray-500">{extracted.contractingOffice}</p>
            </div>

            {extracted.requestedReplyDate && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-full">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Due {extracted.requestedReplyDate}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split Layout: PDF Preview + Form */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: PDF Preview */}
          <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-120px)]">
            <div className="bg-white rounded-2xl border shadow-sm h-full overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">PDF Preview</span>
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

          {/* Right: Form */}
          <div className="space-y-6">

        {/* What They Need */}
        {firstItem && (
          <div className="bg-white rounded-2xl border p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              What they need
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-gray-900">{firstItem.quantity}</span>
              <span className="text-xl text-gray-500">{firstItem.unit}</span>
            </div>
            <p className="text-gray-600">{firstItem.description?.substring(0, 100)}</p>
            <div className="flex items-center gap-3 mt-3">
              {firstItem.nsn && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                  NSN: {firstItem.nsn}
                </span>
              )}
              {firstItem.hazmat && (
                <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  HAZMAT
                </span>
              )}
            </div>
          </div>
        )}

        {/* Profile Status */}
        {profileLoaded ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-green-900">Profile Loaded</p>
              <p className="text-sm text-green-700">Your company info is ready for reference</p>
            </div>
          </div>
        ) : companyProfile ? (
          <button
            onClick={() => applyProfile(companyProfile)}
            className="w-full p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white text-left hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Load Company Profile</p>
                  <p className="text-blue-100 text-sm">CAGE, SAM, certifications...</p>
                </div>
              </div>
              <ChevronRight className="h-6 w-6 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        ) : null}

        {/* Collapsible: Company Details (for reference) */}
        {profileLoaded && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-700">Company Details</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  From profile
                </span>
              </div>
              {detailsOpen ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {detailsOpen && (
              <div className="p-6 pt-2 border-t space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">CAGE Code</Label>
                    <p className="font-mono text-sm mt-1">{profileData.cageCode || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">SAM UEI</Label>
                    <p className="font-mono text-sm mt-1">{profileData.samUei || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">NAICS</Label>
                    <p className="font-mono text-sm mt-1">{profileData.naicsCode || "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Payment</Label>
                    <p className="text-sm mt-1">{profileData.paymentTerms === "net45" ? "Net 45" : profileData.paymentTermsOther}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">FOB</Label>
                    <p className="text-sm mt-1 capitalize">{profileData.fob}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Business</Label>
                    <p className="text-sm mt-1 capitalize">{profileData.businessType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Prices Firm Until</Label>
                    <p className="text-sm mt-1">{profileData.pricesFirmUntil || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Signature</Label>
                    <p className="text-sm mt-1">{profileData.authorizedSignature || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Date</Label>
                    <p className="text-sm mt-1">{profileData.signatureDate || "—"}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">Certifications</Label>
                  <div className="flex flex-wrap gap-2">
                    {profileData.smallDisadvantaged && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">SDB</span>
                    )}
                    {profileData.womanOwned && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">WOSB</span>
                    )}
                    {profileData.veteranOwned && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">VOSB</span>
                    )}
                    {profileData.serviceDisabledVetOwned && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">SDVOSB</span>
                    )}
                    {profileData.hubZone && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">HUBZone</span>
                    )}
                    {!profileData.smallDisadvantaged && !profileData.womanOwned && !profileData.veteranOwned && !profileData.serviceDisabledVetOwned && !profileData.hubZone && (
                      <span className="text-sm text-gray-400">None</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* THE MAIN ACTION */}
        <div className="bg-white rounded-2xl border p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Fill the RFQ</h2>
            <p className="text-gray-500">
              Generate with company info pre-filled, add pricing in Adobe, then upload
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-6 py-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
              <span className="text-xs text-gray-600">Generate</span>
            </div>
            <div className="w-6 h-px bg-gray-300" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">2</div>
              <span className="text-xs text-gray-600">Add Pricing</span>
            </div>
            <div className="w-6 h-px bg-gray-300" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">3</div>
              <span className="text-xs text-gray-600">Upload</span>
            </div>
          </div>

          {/* Primary: Generate with boilerplate */}
          <button
            onClick={handleGenerate}
            disabled={generating || !profileLoaded}
            className="w-full flex items-center justify-center gap-3 h-16 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg"
          >
            {generating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Zap className="h-5 w-5" />
            )}
            {generating ? "Generating..." : "Generate with Company Info"}
          </button>

          <p className="text-center text-xs text-gray-400">
            CAGE, SAM, certifications, payment terms pre-filled. Just add pricing.
          </p>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            {rfqData.s3Url && (
              <a
                href={rfqData.s3Url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-12 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all"
              >
                <Download className="h-4 w-4" />
                Original RFQ
              </a>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 h-12 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
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

          </div> {/* End Right: Form */}
        </div> {/* End grid */}
      </div> {/* End Split Layout */}
    </div>
  );
}
