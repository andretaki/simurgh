"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Zap,
  DollarSign,
  Truck,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
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
    pocName?: string;
    pocEmail?: string;
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
  samRegistered: boolean;
  businessType: string;
  smallDisadvantaged: boolean;
  womanOwned: boolean;
  veteranOwned: boolean;
  serviceDisabledVetOwned: boolean;
  hubZone: boolean;
  employeeCount: string;
  noFreightAdder: boolean;
}

interface FormData {
  // The only things they MUST fill
  unitCost: string;
  deliveryDays: string;

  // Auto-filled from profile (rarely touched)
  pricesFirmUntil: string;
  paymentTerms: string;
  shippingCost: "noFreight" | "ppa";
  fob: "origin" | "destination";
  cageCode: string;
  samUei: string;
  naicsCode: string;
  businessType: "large" | "small";
  smallDisadvantaged: boolean;
  womanOwned: boolean;
  veteranOwned: boolean;
  serviceDisabledVetOwned: boolean;
  hubZone: boolean;
  employeeCount: string;
  authorizedSignature: string;
  countryOfOrigin: string;
  manufacturer: string;
}

export default function RFQFillPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.id as string;

  const [rfqData, setRfqData] = useState<RFQData | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    unitCost: "",
    deliveryDays: "",
    pricesFirmUntil: "",
    paymentTerms: "Net 30",
    shippingCost: "noFreight",
    fob: "origin",
    cageCode: "",
    samUei: "",
    naicsCode: "",
    businessType: "small",
    smallDisadvantaged: false,
    womanOwned: false,
    veteranOwned: false,
    serviceDisabledVetOwned: false,
    hubZone: false,
    employeeCount: "<500",
    authorizedSignature: "",
    countryOfOrigin: "USA",
    manufacturer: "",
  });

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [rfqId]);

  const fetchData = async () => {
    try {
      // Fetch RFQ
      const rfqResponse = await fetch(`/api/rfq/${rfqId}`);
      if (rfqResponse.ok) {
        const data = await rfqResponse.json();
        setRfqData(data);
      }

      // Fetch profile
      const profileResponse = await fetch("/api/company-profile");
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        if (profile) {
          setCompanyProfile(profile);
          applyProfile(profile);
        }
      }

      // Set default date
      const firmUntil = new Date();
      firmUntil.setDate(firmUntil.getDate() + 30);
      setFormData(prev => ({
        ...prev,
        pricesFirmUntil: firmUntil.toISOString().split("T")[0],
      }));

      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  const applyProfile = (profile: CompanyProfile) => {
    setFormData(prev => ({
      ...prev,
      cageCode: profile.cageCode || "",
      samUei: profile.samUei || "",
      naicsCode: profile.naicsCode || "",
      businessType: profile.businessType === "large" ? "large" : "small",
      smallDisadvantaged: profile.smallDisadvantaged ?? false,
      womanOwned: profile.womanOwned ?? false,
      veteranOwned: profile.veteranOwned ?? false,
      serviceDisabledVetOwned: profile.serviceDisabledVetOwned ?? false,
      hubZone: profile.hubZone ?? false,
      employeeCount: profile.employeeCount || "<500",
      paymentTerms: profile.defaultPaymentTerms || "Net 30",
      fob: profile.defaultFob === "destination" ? "destination" : "origin",
      shippingCost: profile.noFreightAdder ? "noFreight" : "ppa",
      authorizedSignature: profile.contactPerson || "",
    }));
    setProfileLoaded(true);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    setUploading(true);
    try {
      // Get presigned URL
      const presignResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: "application/pdf" }),
      });
      if (!presignResponse.ok) throw new Error("Failed to get upload URL");
      const { url, key } = await presignResponse.json();

      // Upload to S3
      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!uploadResponse.ok) throw new Error("Upload failed");

      // Save to database
      const bucketUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET || "simurgh-rfq-bucket"}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1"}.amazonaws.com`;
      const pdfUrl = `${bucketUrl}/${key}`;

      await fetch(`/api/rfq/${rfqId}/upload-completed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrl, s3Key: key, responseData: formData }),
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
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Link
            href={`/projects`}
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

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* What They Need - Quick Reference */}
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

        {/* Hero: Auto-Fill Button */}
        {!profileLoaded && companyProfile && (
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
                  <p className="text-lg font-semibold">Auto-Fill from Profile</p>
                  <p className="text-blue-100 text-sm">Fill company info, certifications & terms</p>
                </div>
              </div>
              <ChevronRight className="h-6 w-6 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        )}

        {profileLoaded && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-green-900">Profile Applied</p>
              <p className="text-sm text-green-700">Company details auto-filled</p>
            </div>
          </div>
        )}

        {/* THE ONLY REQUIRED INPUTS - Big and Obvious */}
        <div className="bg-white rounded-2xl border p-6 space-y-6">
          <div className="text-center pb-4 border-b">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Just add your pricing
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="flex items-center gap-2 text-base font-semibold mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Unit Price
              </Label>
              <Input
                value={formData.unitCost}
                onChange={(e) => setFormData(prev => ({ ...prev, unitCost: e.target.value }))}
                placeholder="$0.00"
                className="h-14 text-2xl font-bold text-center"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2 text-base font-semibold mb-2">
                <Truck className="h-4 w-4 text-blue-600" />
                Delivery Days
              </Label>
              <Input
                value={formData.deliveryDays}
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryDays: e.target.value }))}
                placeholder="45"
                className="h-14 text-2xl font-bold text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Country of Origin</Label>
              <Select
                value={formData.countryOfOrigin}
                onValueChange={(v) => setFormData(prev => ({ ...prev, countryOfOrigin: v }))}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Manufacturer</Label>
              <Input
                value={formData.manufacturer}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                placeholder="Company name"
                className="h-12"
              />
            </div>
          </div>
        </div>

        {/* Collapsible: Company Details (auto-filled) */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-400" />
              <span className="font-medium text-gray-700">Company Details</span>
              {profileLoaded && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  Auto-filled
                </span>
              )}
            </div>
            {detailsOpen ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {detailsOpen && (
            <div className="p-6 pt-2 border-t space-y-4">
              {/* IDs */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">CAGE Code</Label>
                  <Input
                    value={formData.cageCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, cageCode: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">SAM UEI</Label>
                  <Input
                    value={formData.samUei}
                    onChange={(e) => setFormData(prev => ({ ...prev, samUei: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">NAICS</Label>
                  <Input
                    value={formData.naicsCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, naicsCode: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Terms */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Payment Terms</Label>
                  <Input
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">FOB</Label>
                  <Select
                    value={formData.fob}
                    onValueChange={(v: "origin" | "destination") => setFormData(prev => ({ ...prev, fob: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="origin">Origin</SelectItem>
                      <SelectItem value="destination">Destination</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Business Type</Label>
                  <Select
                    value={formData.businessType}
                    onValueChange={(v: "large" | "small") => setFormData(prev => ({ ...prev, businessType: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Certifications */}
              <div>
                <Label className="text-xs text-gray-500 mb-2 block">Certifications</Label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: "smallDisadvantaged", label: "SDB" },
                    { key: "womanOwned", label: "WOSB" },
                    { key: "veteranOwned", label: "VOSB" },
                    { key: "serviceDisabledVetOwned", label: "SDVOSB" },
                    { key: "hubZone", label: "HUBZone" },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                        formData[key as keyof FormData]
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData[key as keyof FormData] as boolean}
                        onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Signature */}
              <div>
                <Label className="text-xs text-gray-500">Authorized Signature</Label>
                <Input
                  value={formData.authorizedSignature}
                  onChange={(e) => setFormData(prev => ({ ...prev, authorizedSignature: e.target.value }))}
                  placeholder="Your name"
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action: Download & Upload */}
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <p className="text-center text-sm text-gray-500">
            Download the RFQ, fill it in Adobe, then upload
          </p>

          <div className="grid grid-cols-2 gap-4">
            {rfqData.s3Url && (
              <a
                href={rfqData.s3Url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-gray-200 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <ExternalLink className="h-5 w-5" />
                Download RFQ
              </a>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 h-14 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileUp className="h-5 w-5" />
              )}
              {uploading ? "Uploading..." : "Upload Filled"}
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

      </div>
    </div>
  );
}
