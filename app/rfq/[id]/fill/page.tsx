"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Save, ChevronDown, ChevronRight, Building2, FileText, Package, DollarSign, Truck, Plus, Trash2, AlertCircle, CheckCircle2, ExternalLink, ClipboardList, Calendar, MapPin, Beaker } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface RFQData {
  id: number;
  fileName: string;
  s3Url: string;
  extractedFields: {
    rfqNumber?: string;
    rfqDate?: string;
    quoteFirmUntil?: string;
    requestedReplyDate?: string;
    deliveryBeforeDate?: string;
    contractingOffice?: string;
    primeContractNumber?: string;
    pocName?: string;
    pocEmail?: string;
    pocPhone?: string;
    pocFax?: string;
    defaultPaymentTerms?: string;
    defaultFob?: string;
    items?: Array<{
      itemNumber: string;
      quantity: number;
      unit: string;
      description: string;
      nsn?: string;
      partNumber?: string;
      manufacturerPartNumber?: string;
      unitOfIssue?: string;
      specifications?: string;
      hazmat?: boolean;
      unNumber?: string;
    }>;
    requiresCageCode?: boolean;
    requiresSamUei?: boolean;
    requiresNaicsCode?: boolean;
    requiresBusinessType?: boolean;
    requiresCertifications?: boolean;
    requiresPaymentTerms?: boolean;
    requiresFobTerms?: boolean;
    requiresShippingCost?: boolean;
    requiresCountryOfOrigin?: boolean;
    requiresDeliveryDays?: boolean;
    requiresUnitCost?: boolean;
    requiresPriceBreaks?: boolean;
    requiresManufacturer?: boolean;
    clauseCodes?: string[];
  };
}

interface PriceBreak {
  fromQty: number;
  toQty: number;
  unitCost: string;
  deliveryDays: string;
}

interface LineItemResponse {
  itemNumber: string;
  unitCost: string;
  deliveryDays: string;
  countryOfOrigin: string;
  manufacturer: string;
  isIawNsn: boolean;
  minimumQty: string;
  qtyUnitPack: string;
  exceptionNote: string;
  priceBreaks: PriceBreak[];
}

interface CompanyProfile {
  companyName: string;
  cageCode: string;
  samUei: string;
  naicsCode: string;
  address: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
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
  // Header fields
  pricesFirmUntil: string;
  paymentTerms: string;
  paymentTermsOther: string;
  shippingCost: "noFreight" | "ppa";
  fob: "origin" | "destination";
  purchaseOrderMinimum: string;

  // Company fields (from profile)
  samUei: string;
  cageCode: string;
  samRegistered: boolean;
  naicsCode: string;
  naicsSizeStandard: string;
  businessType: "large" | "small";
  smallDisadvantaged: boolean;
  womanOwned: boolean;
  veteranOwned: boolean;
  serviceDisabledVetOwned: boolean;
  hubZone: boolean;
  hbcu: boolean;
  alaskaNative: boolean;
  otherSmallBusiness: boolean;
  employeeCount: string;

  // Line item responses
  lineItems: LineItemResponse[];

  // Signature
  authorizedSignature: string;
  signatureDate: string;
}

export default function RFQFillPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.id as string;

  const [rfqData, setRfqData] = useState<RFQData | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    pricesFirmUntil: "",
    paymentTerms: "other",
    paymentTermsOther: "Net 30",
    shippingCost: "noFreight",
    fob: "origin",
    purchaseOrderMinimum: "",
    samUei: "",
    cageCode: "",
    samRegistered: true,
    naicsCode: "424690",
    naicsSizeStandard: "",
    businessType: "small",
    smallDisadvantaged: true,
    womanOwned: true,
    veteranOwned: false,
    serviceDisabledVetOwned: false,
    hubZone: false,
    hbcu: false,
    alaskaNative: false,
    otherSmallBusiness: false,
    employeeCount: "<500",
    lineItems: [],
    authorizedSignature: "",
    signatureDate: new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [companyInfoOpen, setCompanyInfoOpen] = useState(false);
  const [certificationsOpen, setCertificationsOpen] = useState(false);

  useEffect(() => {
    fetchRFQData();
  }, [rfqId]);

  const fetchRFQData = async () => {
    try {
      // Fetch RFQ data
      const response = await fetch(`/api/rfq/${rfqId}`);
      if (!response.ok) throw new Error("Failed to fetch RFQ data");
      const data = await response.json();
      setRfqData(data);

      // Initialize line items from extracted data
      const extractedItems = data.extractedFields?.items || [];
      const lineItemResponses: LineItemResponse[] = extractedItems.map((item: any) => ({
        itemNumber: item.itemNumber || "1",
        unitCost: "",
        deliveryDays: "",
        countryOfOrigin: "USA",
        manufacturer: "",
        isIawNsn: true,
        minimumQty: "",
        qtyUnitPack: item.unitOfIssue || "",
        exceptionNote: "",
        priceBreaks: [
          { fromQty: 1, toQty: Math.floor((item.quantity || 100) / 2), unitCost: "", deliveryDays: "" },
          { fromQty: Math.floor((item.quantity || 100) / 2) + 1, toQty: item.quantity || 100, unitCost: "", deliveryDays: "" },
        ],
      }));

      // If no items extracted, add a default one
      if (lineItemResponses.length === 0) {
        lineItemResponses.push({
          itemNumber: "1",
          unitCost: "",
          deliveryDays: "",
          countryOfOrigin: "USA",
          manufacturer: "",
          isIawNsn: true,
          minimumQty: "",
          qtyUnitPack: "",
          exceptionNote: "",
          priceBreaks: [],
        });
      }

      // Fetch company profile
      try {
        const profileResponse = await fetch("/api/company-profile");
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          if (profile) {
            setCompanyProfile(profile);
            setFormData(prev => ({
              ...prev,
              samUei: profile.samUei || "",
              cageCode: profile.cageCode || "",
              samRegistered: profile.samRegistered ?? true,
              naicsCode: profile.naicsCode || "424690",
              businessType: profile.businessType === "large" ? "large" : "small",
              smallDisadvantaged: profile.smallDisadvantaged ?? false,
              womanOwned: profile.womanOwned ?? false,
              veteranOwned: profile.veteranOwned ?? false,
              serviceDisabledVetOwned: profile.serviceDisabledVetOwned ?? false,
              hubZone: profile.hubZone ?? false,
              employeeCount: profile.employeeCount || "<500",
              paymentTermsOther: profile.defaultPaymentTerms || "Net 30",
              fob: profile.defaultFob === "destination" ? "destination" : "origin",
              shippingCost: profile.noFreightAdder ? "noFreight" : "ppa",
              authorizedSignature: profile.contactPerson || "",
              lineItems: lineItemResponses,
            }));
          }
        }
      } catch (profileError) {
        console.error("Error auto-filling profile:", profileError);
        setFormData(prev => ({ ...prev, lineItems: lineItemResponses }));
      }

      // Set default prices firm until date (30 days from now)
      const firmUntil = new Date();
      firmUntil.setDate(firmUntil.getDate() + 30);
      setFormData(prev => ({
        ...prev,
        pricesFirmUntil: firmUntil.toISOString().split("T")[0],
      }));

      setLoading(false);
    } catch (error) {
      console.error("Error fetching RFQ:", error);
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index: number, field: keyof LineItemResponse, value: any) => {
    setFormData(prev => {
      const newLineItems = [...prev.lineItems];
      newLineItems[index] = { ...newLineItems[index], [field]: value };
      return { ...prev, lineItems: newLineItems };
    });
  };

  const handlePriceBreakChange = (itemIndex: number, breakIndex: number, field: keyof PriceBreak, value: any) => {
    setFormData(prev => {
      const newLineItems = [...prev.lineItems];
      const newPriceBreaks = [...newLineItems[itemIndex].priceBreaks];
      newPriceBreaks[breakIndex] = { ...newPriceBreaks[breakIndex], [field]: value };
      newLineItems[itemIndex] = { ...newLineItems[itemIndex], priceBreaks: newPriceBreaks };
      return { ...prev, lineItems: newLineItems };
    });
  };

  const addPriceBreak = (itemIndex: number) => {
    setFormData(prev => {
      const newLineItems = [...prev.lineItems];
      const lastBreak = newLineItems[itemIndex].priceBreaks[newLineItems[itemIndex].priceBreaks.length - 1];
      newLineItems[itemIndex].priceBreaks.push({
        fromQty: (lastBreak?.toQty || 0) + 1,
        toQty: (lastBreak?.toQty || 0) + 100,
        unitCost: "",
        deliveryDays: "",
      });
      return { ...prev, lineItems: newLineItems };
    });
  };

  const removePriceBreak = (itemIndex: number, breakIndex: number) => {
    setFormData(prev => {
      const newLineItems = [...prev.lineItems];
      newLineItems[itemIndex].priceBreaks.splice(breakIndex, 1);
      return { ...prev, lineItems: newLineItems };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/rfq/${rfqId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseData: formData }),
      });

      if (!response.ok) throw new Error("Failed to save response");

      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center gap-2";
      toast.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Draft saved!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (error) {
      console.error("Error saving response:", error);
      alert("Failed to save response");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/rfq/${rfqId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseData: formData }),
      });

      if (!response.ok) throw new Error("Failed to generate PDF");

      const { pdfUrl } = await response.json();
      window.open(pdfUrl, "_blank");

      setTimeout(() => {
        router.push("/history");
      }, 1000);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!rfqData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p>RFQ not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const extracted = rfqData.extractedFields || {};

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* RFQ Quick Summary - For Boss to Decide on Bid */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">RFQ #{extracted.rfqNumber || rfqData.fileName}</CardTitle>
                  <CardDescription>{extracted.contractingOffice || "ASRC Federal"}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                {extracted.requestedReplyDate && (
                  <Badge variant="destructive" className="text-sm px-3 py-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    Due: {extracted.requestedReplyDate}
                  </Badge>
                )}
                {rfqData.s3Url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={rfqData.s3Url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Items Summary - The Key Info */}
            {extracted.items && extracted.items.length > 0 && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  ITEMS REQUESTED ({extracted.items.length})
                </h3>
                <div className="space-y-3">
                  {extracted.items.map((item: any, idx: number) => (
                    <div key={idx} className="border-l-4 border-blue-500 pl-3 py-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">Item {item.itemNumber || idx + 1}</Badge>
                            {item.nsn && <Badge variant="secondary" className="text-xs">NSN: {item.nsn}</Badge>}
                            {item.hazmat && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                HAZMAT
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm">{item.description?.substring(0, 150)}{item.description?.length > 150 ? "..." : ""}</p>
                          {item.manufacturerPartNumber && (
                            <p className="text-xs text-muted-foreground mt-1">MFR P/N: {item.manufacturerPartNumber}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-lg text-blue-600">{item.quantity} {item.unit}</p>
                          {item.unitOfIssue && item.unitOfIssue !== item.unit && (
                            <p className="text-xs text-muted-foreground">Unit: {item.unitOfIssue}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">RFQ Date</p>
                <p className="font-semibold text-sm">{extracted.rfqDate || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Deliver Before</p>
                <p className="font-semibold text-sm">{extracted.deliveryBeforeDate || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Quote Firm Until</p>
                <p className="font-semibold text-sm">{extracted.quoteFirmUntil || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Default FOB</p>
                <p className="font-semibold text-sm">{extracted.defaultFob || "Origin"}</p>
              </div>
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Payment</p>
                <p className="font-semibold text-sm">{extracted.defaultPaymentTerms || "Net 45"}</p>
              </div>
            </div>

            {/* Buyer Contact */}
            <div className="flex items-center justify-between bg-white rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-full">
                  <Building2 className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{extracted.pocName || "Buyer Contact"}</p>
                  <p className="text-xs text-muted-foreground">{extracted.pocEmail} {extracted.pocPhone && `• ${extracted.pocPhone}`}</p>
                </div>
              </div>
              {extracted.pocFax && (
                <p className="text-xs text-muted-foreground">Fax: {extracted.pocFax}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quote Header - Your Response */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Quote Header
            </CardTitle>
            <CardDescription>Fill in your quote terms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="pricesFirmUntil">Prices Firm Until *</Label>
                <Input
                  id="pricesFirmUntil"
                  type="date"
                  value={formData.pricesFirmUntil}
                  onChange={(e) => handleInputChange("pricesFirmUntil", e.target.value)}
                />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <div className="flex gap-2">
                  <Select value={formData.paymentTerms} onValueChange={(v) => handleInputChange("paymentTerms", v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="net45">Net 45</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.paymentTerms === "other" && (
                    <Input
                      value={formData.paymentTermsOther}
                      onChange={(e) => handleInputChange("paymentTermsOther", e.target.value)}
                      placeholder="Net 30"
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
              <div>
                <Label>Shipping Cost</Label>
                <Select value={formData.shippingCost} onValueChange={(v: "noFreight" | "ppa") => handleInputChange("shippingCost", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noFreight">No Freight Adder</SelectItem>
                    <SelectItem value="ppa">Pre Pay and Add (PPA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>FOB</Label>
                <Select value={formData.fob} onValueChange={(v: "origin" | "destination") => handleInputChange("fob", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="origin">Origin</SelectItem>
                    <SelectItem value="destination">Destination</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Info - Collapsible, Auto-filled */}
        <Collapsible open={companyInfoOpen} onOpenChange={setCompanyInfoOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {companyInfoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Building2 className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg">Company Information</CardTitle>
                    {companyProfile && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Auto-filled
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{companyInfoOpen ? "Click to collapse" : "Click to expand"}</span>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>SAM UEI</Label>
                    <Input value={formData.samUei} onChange={(e) => handleInputChange("samUei", e.target.value)} />
                  </div>
                  <div>
                    <Label>CAGE Code *</Label>
                    <Input value={formData.cageCode} onChange={(e) => handleInputChange("cageCode", e.target.value)} />
                  </div>
                  <div>
                    <Label>Registered with SAM?</Label>
                    <Select value={formData.samRegistered ? "yes" : "no"} onValueChange={(v) => handleInputChange("samRegistered", v === "yes")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>NAICS Code</Label>
                    <Input value={formData.naicsCode} onChange={(e) => handleInputChange("naicsCode", e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Business Type *</Label>
                    <Select value={formData.businessType} onValueChange={(v: "large" | "small") => handleInputChange("businessType", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="small">Small</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Employee Count</Label>
                    <Select value={formData.employeeCount} onValueChange={(v) => handleInputChange("employeeCount", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<500">&lt;500</SelectItem>
                        <SelectItem value="501-750">501-750</SelectItem>
                        <SelectItem value="751-1000">751-1000</SelectItem>
                        <SelectItem value="1001-1500">1001-1500</SelectItem>
                        <SelectItem value=">1500">&gt;1500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Certifications - Collapsible */}
        <Collapsible open={certificationsOpen} onOpenChange={setCertificationsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {certificationsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-lg">Small Business Certifications</CardTitle>
                    {(formData.smallDisadvantaged || formData.womanOwned) && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                        {[formData.smallDisadvantaged && "SDB", formData.womanOwned && "WOSB"].filter(Boolean).join(", ")}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{certificationsOpen ? "Click to collapse" : "Click to expand"}</span>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="sdb" checked={formData.smallDisadvantaged} onCheckedChange={(c) => handleInputChange("smallDisadvantaged", c)} />
                    <Label htmlFor="sdb" className="text-sm">Small Disadvantaged Business</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="wosb" checked={formData.womanOwned} onCheckedChange={(c) => handleInputChange("womanOwned", c)} />
                    <Label htmlFor="wosb" className="text-sm">Woman-owned Small Business</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="vosb" checked={formData.veteranOwned} onCheckedChange={(c) => handleInputChange("veteranOwned", c)} />
                    <Label htmlFor="vosb" className="text-sm">Veteran-owned Small Business</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="sdvosb" checked={formData.serviceDisabledVetOwned} onCheckedChange={(c) => handleInputChange("serviceDisabledVetOwned", c)} />
                    <Label htmlFor="sdvosb" className="text-sm">Service-Disabled Veteran-owned</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hubzone" checked={formData.hubZone} onCheckedChange={(c) => handleInputChange("hubZone", c)} />
                    <Label htmlFor="hubzone" className="text-sm">HUBZone Small Business</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hbcu" checked={formData.hbcu} onCheckedChange={(c) => handleInputChange("hbcu", c)} />
                    <Label htmlFor="hbcu" className="text-sm">HBCU / Minority Institution</Label>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Line Items */}
        {formData.lineItems.map((item, itemIndex) => {
          const extractedItem = extracted.items?.[itemIndex];

          return (
            <Card key={itemIndex} className="border-orange-200">
              <CardHeader className="bg-orange-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-orange-600" />
                      Item {item.itemNumber}
                    </CardTitle>
                    {extractedItem && (
                      <CardDescription className="mt-1">
                        <span className="font-medium">{extractedItem.quantity} {extractedItem.unit}</span> - {extractedItem.description?.substring(0, 100)}...
                      </CardDescription>
                    )}
                  </div>
                  {extractedItem?.nsn && (
                    <Badge variant="outline">NSN: {extractedItem.nsn}</Badge>
                  )}
                </div>
                {extractedItem?.hazmat && (
                  <div className="flex items-center gap-2 mt-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">HAZMAT - UN{extractedItem.unNumber}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Main pricing row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <Label className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Unit Cost *
                    </Label>
                    <Input
                      value={item.unitCost}
                      onChange={(e) => handleLineItemChange(itemIndex, "unitCost", e.target.value)}
                      placeholder="$0.00"
                      className="text-lg font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Delivery Days *
                    </Label>
                    <Input
                      value={item.deliveryDays}
                      onChange={(e) => handleLineItemChange(itemIndex, "deliveryDays", e.target.value)}
                      placeholder="45"
                      className="text-lg font-semibold"
                    />
                  </div>
                  <div>
                    <Label>Country of Origin</Label>
                    <Select value={item.countryOfOrigin} onValueChange={(v) => handleLineItemChange(itemIndex, "countryOfOrigin", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USA">USA</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Manufacturer</Label>
                    <Input
                      value={item.manufacturer}
                      onChange={(e) => handleLineItemChange(itemIndex, "manufacturer", e.target.value)}
                      placeholder="MFR: Company Name"
                    />
                  </div>
                </div>

                {/* Additional fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`iaw-${itemIndex}`}
                      checked={item.isIawNsn}
                      onCheckedChange={(c) => handleLineItemChange(itemIndex, "isIawNsn", c)}
                    />
                    <Label htmlFor={`iaw-${itemIndex}`} className="text-sm">IAW NSN/PID?</Label>
                  </div>
                  <div>
                    <Label>Minimum Qty Run</Label>
                    <Input
                      value={item.minimumQty}
                      onChange={(e) => handleLineItemChange(itemIndex, "minimumQty", e.target.value)}
                      placeholder={`${extractedItem?.quantity || ""} ${extractedItem?.unit || ""}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Qty Unit Pack</Label>
                    <Input
                      value={item.qtyUnitPack}
                      onChange={(e) => handleLineItemChange(itemIndex, "qtyUnitPack", e.target.value)}
                      placeholder="e.g., 100 LBS PER DRUM"
                    />
                  </div>
                </div>

                <div>
                  <Label>Exception Note</Label>
                  <Input
                    value={item.exceptionNote}
                    onChange={(e) => handleLineItemChange(itemIndex, "exceptionNote", e.target.value)}
                    placeholder="Any exceptions or notes..."
                  />
                </div>

                {/* Price Breaks */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold">Quantity Price Breaks</Label>
                    <Button variant="outline" size="sm" onClick={() => addPriceBreak(itemIndex)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Break
                    </Button>
                  </div>

                  {item.priceBreaks.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground px-2">
                        <span>From Qty</span>
                        <span>To Qty</span>
                        <span>Unit Cost</span>
                        <span>Del Days</span>
                        <span></span>
                      </div>
                      {item.priceBreaks.map((pb, breakIndex) => (
                        <div key={breakIndex} className="grid grid-cols-5 gap-2 items-center">
                          <Input
                            type="number"
                            value={pb.fromQty}
                            onChange={(e) => handlePriceBreakChange(itemIndex, breakIndex, "fromQty", parseInt(e.target.value))}
                            className="h-8"
                          />
                          <Input
                            type="number"
                            value={pb.toQty}
                            onChange={(e) => handlePriceBreakChange(itemIndex, breakIndex, "toQty", parseInt(e.target.value))}
                            className="h-8"
                          />
                          <Input
                            value={pb.unitCost}
                            onChange={(e) => handlePriceBreakChange(itemIndex, breakIndex, "unitCost", e.target.value)}
                            placeholder="$0.00"
                            className="h-8"
                          />
                          <Input
                            value={pb.deliveryDays}
                            onChange={(e) => handlePriceBreakChange(itemIndex, breakIndex, "deliveryDays", e.target.value)}
                            placeholder="Days"
                            className="h-8"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePriceBreak(itemIndex, breakIndex)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No price breaks added</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Signature */}
        <Card>
          <CardHeader>
            <CardTitle>Authorization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Authorized Signature *</Label>
                <Input
                  value={formData.authorizedSignature}
                  onChange={(e) => handleInputChange("authorizedSignature", e.target.value)}
                  placeholder="H. TAKI"
                  className="font-semibold"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.signatureDate}
                  onChange={(e) => handleInputChange("signatureDate", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 sticky bottom-4 bg-background/95 backdrop-blur p-4 rounded-lg border shadow-lg">
          <Button onClick={handleSave} disabled={saving} variant="outline" className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Draft
          </Button>
          <Button onClick={handleGenerate} disabled={generating} className="flex-[2] bg-blue-600 hover:bg-blue-700">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Generate Filled PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
