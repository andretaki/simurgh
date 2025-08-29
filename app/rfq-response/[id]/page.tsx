"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Send,
  Save,
  Calculator,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  Package,
  Truck,
  Calendar,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface RFQDocument {
  id: number;
  fileName: string;
  rfqNumber: string;
  status: string;
  createdAt: string;
  extractedFields: any;
}

interface CompanyInfo {
  companyName: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactFax: string;
  address: string;
  samUei: string;
  cageCode: string;
  businessType: string;
  naicsCode: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  partNumber?: string;
  unitPrice: number;
  extendedPrice: number;
  deliveryDays: number;
  notes?: string;
}

export default function RFQResponsePage() {
  const params = useParams();
  const router = useRouter();
  const [rfq, setRfq] = useState<RFQDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Company Information - Prefilled for Alliance Chemicals
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: "ALLIANCE CHEMICALS",
    contactName: "HOSSEIN TAKI",
    contactTitle: "Sales Manager",
    contactEmail: "alliance@alliancechemical.com",
    contactPhone: "(512) 365-6838",
    contactFax: "(512) 365-6833",
    address: "204 S Edmond St, Taylor, TX, 76574-0721, United States",
    samUei: "", // To be filled from settings
    cageCode: "", // To be filled from settings
    businessType: "Small Business",
    naicsCode: "325998", // Chemical Manufacturing
  });

  // Response Details
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [paymentTerms] = useState("Net 30");
  const [fobTerms, setFobTerms] = useState("Destination");
  const [shippingMethod, setShippingMethod] = useState("Best Method");
  const [validityPeriod, setValidityPeriod] = useState("30");
  const [notes, setNotes] = useState("");
  const [minimumOrder, setMinimumOrder] = useState("");

  useEffect(() => {
    fetchRFQDetails();
    loadCompanySettings();
  }, [params.id]);

  const fetchRFQDetails = async () => {
    try {
      const response = await fetch("/api/rfq/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { id: params.id },
          includeExtractedFields: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const rfqData = data.results[0];
          setRfq(rfqData);
          
          // Initialize line items from RFQ
          const items = rfqData.extractedFields?.items || [];
          setLineItems(
            items.map((item: any) => ({
              description: item.description || "",
              quantity: parseFloat(item.quantity) || 0,
              unit: item.unit || "EA",
              partNumber: item.partNumber || "",
              unitPrice: 0,
              extendedPrice: 0,
              deliveryDays: 14, // Default 14 days
              notes: "",
            }))
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch RFQ:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const response = await fetch("/api/settings/company");
      if (response.ok) {
        const settings = await response.json();
        setCompanyInfo((prev) => ({
          ...prev,
          samUei: settings.samUei || "",
          cageCode: settings.cageCode || "",
        }));
      }
    } catch (error) {
      console.error("Failed to load company settings:", error);
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    
    // Calculate extended price
    if (field === "unitPrice" || field === "quantity") {
      updatedItems[index].extendedPrice = 
        updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    
    setLineItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.extendedPrice, 0);
    const tax = 0; // No tax for B2B
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      // Prepare response data
      const responseData = {
        rfqId: rfq?.id,
        rfqNumber: rfq?.rfqNumber,
        companyInfo,
        lineItems,
        paymentTerms,
        fobTerms,
        shippingMethod,
        validityPeriod,
        notes,
        minimumOrder,
        totals: calculateTotals(),
        submittedAt: new Date().toISOString(),
      };
      
      // Save response to database
      const saveResponse = await fetch("/api/rfq/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(responseData),
      });
      
      if (saveResponse.ok) {
        const result = await saveResponse.json();
        
        // Generate PDF
        const pdfResponse = await fetch("/api/rfq/response/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseId: result.id }),
        });
        
        if (pdfResponse.ok) {
          const pdfBlob = await pdfResponse.blob();
          const pdfUrl = URL.createObjectURL(pdfBlob);
          
          // Download PDF
          const a = document.createElement("a");
          a.href = pdfUrl;
          a.download = `RFQ_Response_${rfq?.rfqNumber}.pdf`;
          a.click();
          
          // Navigate to success page or back to RFQ list
          router.push(`/rfq-done?response=success&id=${result.id}`);
        }
      }
    } catch (error) {
      console.error("Failed to submit response:", error);
      alert("Failed to submit response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">RFQ Not Found</h2>
            <Link href="/rfq-done">
              <Button>Back to RFQ List</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/rfq/${rfq.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to RFQ
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            Response to RFQ #{rfq.rfqNumber}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => console.log("Save draft")}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <Send className="mr-2 h-4 w-4" />
            {submitting ? "Submitting..." : "Submit Response"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Your Company Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={companyInfo.companyName}
                  onChange={(e) =>
                    setCompanyInfo({ ...companyInfo, companyName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Contact Name</Label>
                <Input
                  value={companyInfo.contactName}
                  onChange={(e) =>
                    setCompanyInfo({ ...companyInfo, contactName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={companyInfo.contactEmail}
                  onChange={(e) =>
                    setCompanyInfo({ ...companyInfo, contactEmail: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={companyInfo.contactPhone}
                  onChange={(e) =>
                    setCompanyInfo({ ...companyInfo, contactPhone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>SAM UEI</Label>
                <Input
                  value={companyInfo.samUei}
                  onChange={(e) =>
                    setCompanyInfo({ ...companyInfo, samUei: e.target.value })
                  }
                  placeholder="Enter your SAM UEI"
                />
              </div>
              <div>
                <Label>CAGE Code</Label>
                <Input
                  value={companyInfo.cageCode}
                  onChange={(e) =>
                    setCompanyInfo({ ...companyInfo, cageCode: e.target.value })
                  }
                  placeholder="Enter your CAGE Code"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Pricing & Delivery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2">Item</th>
                    <th className="text-left py-3 px-2">Description</th>
                    <th className="text-center py-3 px-2">Qty</th>
                    <th className="text-center py-3 px-2">Unit</th>
                    <th className="text-center py-3 px-2">Unit Price ($)</th>
                    <th className="text-center py-3 px-2">Extended ($)</th>
                    <th className="text-center py-3 px-2">Delivery (Days)</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-2">{index + 1}</td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.partNumber && (
                            <p className="text-sm text-gray-600">
                              P/N: {item.partNumber}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">{item.quantity}</td>
                      <td className="text-center py-3 px-2">{item.unit}</td>
                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="w-24 text-right"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleLineItemChange(
                              index,
                              "unitPrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                        />
                      </td>
                      <td className="text-right py-3 px-2 font-medium">
                        ${item.extendedPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          className="w-20 text-center"
                          value={item.deliveryDays}
                          onChange={(e) =>
                            handleLineItemChange(
                              index,
                              "deliveryDays",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={5} className="text-right py-3 px-2 font-medium">
                      Subtotal:
                    </td>
                    <td className="text-right py-3 px-2 font-bold text-lg">
                      ${totals.subtotal.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Quantity Price Breaks */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Volume Discounts Available
              </h4>
              <p className="text-sm text-gray-600">
                Quantity price breaks available for orders over 500 units. 
                Contact us for custom pricing on large orders.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Terms & Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Terms</Label>
                <Input value={paymentTerms} disabled className="bg-gray-50" />
              </div>
              <div>
                <Label>FOB Terms</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={fobTerms}
                  onChange={(e) => setFobTerms(e.target.value)}
                >
                  <option value="Origin">FOB Origin</option>
                  <option value="Destination">FOB Destination</option>
                </select>
              </div>
              <div>
                <Label>Shipping Method</Label>
                <Input
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                />
              </div>
              <div>
                <Label>Quote Valid For (Days)</Label>
                <Input
                  type="number"
                  value={validityPeriod}
                  onChange={(e) => setValidityPeriod(e.target.value)}
                />
              </div>
              <div>
                <Label>Minimum Order Value</Label>
                <Input
                  placeholder="No minimum"
                  value={minimumOrder}
                  onChange={(e) => setMinimumOrder(e.target.value)}
                />
              </div>
            </div>
            
            <div className="mt-4">
              <Label>Additional Notes / Special Conditions</Label>
              <Textarea
                className="mt-2"
                rows={4}
                placeholder="Enter any additional notes, certifications, or special conditions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Standard Certifications */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Standard Certifications</h4>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span>Products meet all applicable safety and quality standards</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span>Certificate of Conformance available upon request</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span>Safety Data Sheets (SDS) provided with shipment</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span>Products are mercury-free as per P107 requirement</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Section */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Ready to Submit?</h3>
                <p className="text-sm text-gray-600">
                  Your response will be generated as a PDF and can be emailed to the buyer.
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || totals.subtotal === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="mr-2 h-5 w-5" />
                {submitting ? "Generating PDF..." : "Submit Response"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}