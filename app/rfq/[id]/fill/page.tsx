"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Save, ChevronDown, ChevronRight, Building2, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RFQData {
  id: number;
  fileName: string;
  extractedFields: any;
  s3Url: string;
}

interface FormData {
  companyName: string;
  cageCode: string;
  dunsNumber: string;
  address: string;
  pocName: string;
  pocEmail: string;
  pocPhone: string;
  unitCost: string;
  deliveryTime: string;
  paymentTerms: string;
  shippingTerms: string;
  technicalCapabilities: string;
  [key: string]: string;
}

export default function RFQFillPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.id as string;

  const [rfqData, setRfqData] = useState<RFQData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    cageCode: "",
    dunsNumber: "",
    address: "",
    pocName: "",
    pocEmail: "",
    pocPhone: "",
    unitCost: "",
    deliveryTime: "",
    paymentTerms: "",
    shippingTerms: "",
    technicalCapabilities: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [companyInfoOpen, setCompanyInfoOpen] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    fetchRFQData();
  }, [rfqId]);

  const fetchRFQData = async () => {
    try {
      const response = await fetch(`/api/rfq/${rfqId}`);
      if (!response.ok) throw new Error("Failed to fetch RFQ data");
      const data = await response.json();
      setRfqData(data);

      // Auto-fill from company profile
      try {
        const profileResponse = await fetch("/api/company-profile");
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          if (profile) {
            setHasProfile(true);
            setFormData(prev => ({
              ...prev,
              companyName: profile.companyName || prev.companyName,
              cageCode: profile.cageCode || prev.cageCode,
              dunsNumber: profile.samUei || prev.dunsNumber,
              address: profile.address || prev.address,
              pocName: profile.contactPerson || prev.pocName,
              pocEmail: profile.contactEmail || prev.pocEmail,
              pocPhone: profile.contactPhone || prev.pocPhone,
              paymentTerms: profile.defaultPaymentTerms || prev.paymentTerms,
              shippingTerms: profile.defaultFob || prev.shippingTerms,
            }));
          }
        }
      } catch (profileError) {
        console.error("Error auto-filling profile:", profileError);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching RFQ:", error);
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

      // Show success message
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50";
      toast.textContent = "Response saved!";
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
      
      // Open PDF in new tab
      window.open(pdfUrl, "_blank");

      // Redirect to history
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Fill RFQ Response</CardTitle>
            <CardDescription>
              {rfqData.fileName} - {rfqData.extractedFields?.rfqNumber || "No RFQ Number"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
              <h3 className="font-semibold mb-2">Extracted Information:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Due Date:</span> {rfqData.extractedFields?.dueDate || "Not specified"}</div>
                <div><span className="font-medium">Office:</span> {rfqData.extractedFields?.contractingOffice || "Not specified"}</div>
                <div><span className="font-medium">POC:</span> {rfqData.extractedFields?.pocName || "Not specified"}</div>
                <div><span className="font-medium">Email:</span> {rfqData.extractedFields?.pocEmail || "Not specified"}</div>
              </div>
            </div>

            {/* Quote Details Section - Primary focus, always expanded */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-lg">Quote Details</h3>
                <span className="text-xs text-muted-foreground ml-auto">Fill these for each RFQ</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unitCost">Unit Cost *</Label>
                  <Input
                    id="unitCost"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={handleInputChange}
                    placeholder="e.g., $25.00"
                    className="text-lg font-medium"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryTime">Delivery Time *</Label>
                  <Input
                    id="deliveryTime"
                    name="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={handleInputChange}
                    placeholder="e.g., 30 days ARO"
                    className="text-lg font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleInputChange}
                    placeholder="e.g., Net 30"
                  />
                </div>
                <div>
                  <Label htmlFor="shippingTerms">Shipping Terms (FOB)</Label>
                  <Input
                    id="shippingTerms"
                    name="shippingTerms"
                    value={formData.shippingTerms}
                    onChange={handleInputChange}
                    placeholder="e.g., FOB Destination"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="technicalCapabilities">Notes / Exceptions</Label>
                <Textarea
                  id="technicalCapabilities"
                  name="technicalCapabilities"
                  value={formData.technicalCapabilities}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Any special notes, exceptions, or technical details for this quote..."
                />
              </div>
            </div>

            {/* Company Info Section - Collapsible, auto-filled */}
            <Collapsible open={companyInfoOpen} onOpenChange={setCompanyInfoOpen} className="mt-6">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 w-full p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                  {companyInfoOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Company Information</span>
                  {hasProfile && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-2">
                      Auto-filled from profile
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {companyInfoOpen ? "Click to collapse" : "Click to edit"}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cageCode">CAGE Code</Label>
                    <Input
                      id="cageCode"
                      name="cageCode"
                      value={formData.cageCode}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dunsNumber">SAM UEI</Label>
                    <Input
                      id="dunsNumber"
                      name="dunsNumber"
                      value={formData.dunsNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pocName">Point of Contact</Label>
                    <Input
                      id="pocName"
                      name="pocName"
                      value={formData.pocName}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pocEmail">Contact Email</Label>
                    <Input
                      id="pocEmail"
                      name="pocEmail"
                      type="email"
                      value={formData.pocEmail}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pocPhone">Contact Phone</Label>
                    <Input
                      id="pocPhone"
                      name="pocPhone"
                      value={formData.pocPhone}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={2}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex gap-4 mt-6">
              <Button onClick={handleSave} disabled={saving} variant="outline">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Draft
              </Button>
              <Button onClick={handleGenerate} disabled={generating} className="flex-1">
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Generate Response PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}