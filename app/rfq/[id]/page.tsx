"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Eye,
  ArrowLeft,
  Calendar,
  Building,
  Package,
  DollarSign,
  Truck,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
} from "lucide-react";
import Link from "next/link";

interface RFQDocument {
  id: number;
  fileName: string;
  rfqNumber: string;
  status: string;
  createdAt: string;
  extractedFields: any;
  s3Key: string;
}

export default function RFQDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [rfq, setRfq] = useState<RFQDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchRFQDetails();
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
          setRfq(data.results[0]);
          // Set PDF URL to use our proxy endpoint
          setPdfUrl(`/api/rfq/document/${data.results[0].id}`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch RFQ:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
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
            <p className="text-gray-600 mb-4">
              The requested RFQ could not be found.
            </p>
            <Link href="/rfq-done">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to RFQ List
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const extractedFields = rfq.extractedFields || {};
  const documentType = extractedFields.documentType || "Document";
  const items = extractedFields.items || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/rfq-done">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {documentType} #{rfq.rfqNumber || "N/A"}
          </h1>
          <Badge
            variant={
              rfq.status === "processed"
                ? "success"
                : rfq.status === "pending"
                ? "warning"
                : "destructive"
            }
          >
            {getStatusIcon(rfq.status)}
            <span className="ml-1">{rfq.status}</span>
          </Badge>
        </div>
        <div className="flex gap-2">
          {documentType === "RFQ" && (
            <Link href={`/rfq-response/${rfq.id}`}>
              <Button className="bg-green-600 hover:bg-green-700">
                <Send className="mr-2 h-4 w-4" />
                Respond to RFQ
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            onClick={() => window.open(pdfUrl || "", "_blank")}
          >
            <Eye className="mr-2 h-4 w-4" />
            View PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - RFQ Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">File Name</p>
                  <p className="font-medium">{rfq.fileName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Document Type</p>
                  <p className="font-medium">{documentType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Document Number</p>
                  <p className="font-medium">
                    {extractedFields.documentNumber || rfq.rfqNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created Date</p>
                  <p className="font-medium">
                    {new Date(rfq.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          {(extractedFields.companyName ||
            extractedFields.vendorName ||
            extractedFields.buyerName) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {extractedFields.companyName && (
                  <div>
                    <p className="text-sm text-gray-600">Requesting Company</p>
                    <p className="font-medium">{extractedFields.companyName}</p>
                  </div>
                )}
                {extractedFields.contactName && (
                  <div>
                    <p className="text-sm text-gray-600">Contact Person</p>
                    <p className="font-medium">{extractedFields.contactName}</p>
                  </div>
                )}
                {extractedFields.contactEmail && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{extractedFields.contactEmail}</p>
                  </div>
                )}
                {extractedFields.contactPhone && (
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{extractedFields.contactPhone}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Items/Line Items */}
          {items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Items Requested ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Description</th>
                        <th className="text-right py-2 px-2">Quantity</th>
                        <th className="text-left py-2 px-2">Unit</th>
                        {items[0]?.partNumber && (
                          <th className="text-left py-2 px-2">Part #</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="py-2 px-2">{index + 1}</td>
                          <td className="py-2 px-2">
                            {item.description || "N/A"}
                          </td>
                          <td className="text-right py-2 px-2">
                            {item.quantity || "N/A"}
                          </td>
                          <td className="py-2 px-2">{item.unit || "N/A"}</td>
                          {item.partNumber && (
                            <td className="py-2 px-2">{item.partNumber}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Additional Details */}
        <div className="space-y-6">
          {/* Delivery Information */}
          {(extractedFields.deliveryDate || extractedFields.deliveryLocation) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Delivery Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {extractedFields.deliveryDate && (
                  <div>
                    <p className="text-sm text-gray-600">Required By</p>
                    <p className="font-medium">
                      {new Date(extractedFields.deliveryDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {extractedFields.deliveryLocation && (
                  <div>
                    <p className="text-sm text-gray-600">Delivery Location</p>
                    <p className="font-medium text-sm">
                      {extractedFields.deliveryLocation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Terms & Requirements */}
          {(extractedFields.paymentTerms ||
            extractedFields.specialRequirements) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Terms & Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {extractedFields.paymentTerms && (
                  <div>
                    <p className="text-sm text-gray-600">Payment Terms</p>
                    <p className="font-medium">{extractedFields.paymentTerms}</p>
                  </div>
                )}
                {extractedFields.specialRequirements && (
                  <div>
                    <p className="text-sm text-gray-600">Special Requirements</p>
                    <p className="text-sm">
                      {extractedFields.specialRequirements}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documentType === "RFQ" && (
                <Link href={`/rfq-response/${rfq.id}`} className="block">
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <Send className="mr-2 h-4 w-4" />
                    Create Response
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(pdfUrl || "", "_blank")}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Original PDF
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = pdfUrl || "";
                  a.download = rfq.fileName;
                  a.click();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}