"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Save, Zap } from "lucide-react";

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

  useEffect(() => {
    fetchRFQData();
  }, [rfqId]);

  const fetchRFQData = async () => {
    try {
      const response = await fetch(`/api/rfq/${rfqId}`);
      if (!response.ok) throw new Error("Failed to fetch RFQ data");
      const data = await response.json();
      setRfqData(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching RFQ:", error);
      setLoading(false);
    }
  };

  const fillFromProfile = async () => {
    try {
      const response = await fetch("/api/company-profile");
      if (!response.ok) {
        alert("Please set up your company profile first");
        router.push("/settings");
        return;
      }

      const profile = await response.json();
      
      setFormData(prev => ({
        ...prev,
        companyName: profile.companyName || prev.companyName,
        cageCode: profile.cageCode || prev.cageCode,
        dunsNumber: profile.dunsNumber || prev.dunsNumber,
        address: `${profile.addressLine1 || ""} ${profile.addressLine2 || ""} ${profile.city || ""}, ${profile.state || ""} ${profile.zipCode || ""}`.trim(),
        pocName: profile.pocName || prev.pocName,
        pocEmail: profile.pocEmail || prev.pocEmail,
        pocPhone: profile.pocPhone || prev.pocPhone,
        paymentTerms: profile.paymentTerms || prev.paymentTerms,
        shippingTerms: profile.shippingTerms || prev.shippingTerms,
        technicalCapabilities: profile.capabilities || prev.technicalCapabilities,
      }));

      // Show success message
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50";
      toast.textContent = "Profile data loaded successfully!";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

    } catch (error) {
      console.error("Error loading profile:", error);
      alert("Failed to load company profile");
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

            <div className="mb-4">
              <Button onClick={fillFromProfile} className="w-full" variant="outline">
                <Zap className="mr-2 h-4 w-4" />
                Fill from Company Profile
              </Button>
            </div>

            <div className="space-y-4">
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
                  <Label htmlFor="dunsNumber">DUNS Number</Label>
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

              {rfqData.extractedFields?.hasUnitCost && (
                <div>
                  <Label htmlFor="unitCost">Unit Cost</Label>
                  <Input
                    id="unitCost"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={handleInputChange}
                    placeholder="Enter unit cost"
                  />
                </div>
              )}

              {rfqData.extractedFields?.hasDeliveryTime && (
                <div>
                  <Label htmlFor="deliveryTime">Delivery Time</Label>
                  <Input
                    id="deliveryTime"
                    name="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={handleInputChange}
                    placeholder="e.g., 30 days ARO"
                  />
                </div>
              )}

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
                  <Label htmlFor="shippingTerms">Shipping Terms</Label>
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
                <Label htmlFor="technicalCapabilities">Technical Capabilities</Label>
                <Textarea
                  id="technicalCapabilities"
                  name="technicalCapabilities"
                  value={formData.technicalCapabilities}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Describe your technical capabilities relevant to this RFQ"
                />
              </div>
            </div>

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