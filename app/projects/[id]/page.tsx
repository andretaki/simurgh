"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Package,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  Tag,
  RefreshCw,
  Download,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Project {
  id: number;
  name: string;
  customerName: string | null;
  rfqNumber: string | null;
  poNumber: string | null;
  nsn: string | null;
  productName: string | null;
  quantity: number | null;
  status: string;
  comparisonResults: ComparisonResults | null;
  comparisonStatus: string | null;
}

interface ComparisonResults {
  overallStatus: string;
  summary: string;
  matches: { field: string; rfqValue: string; poValue: string }[];
  mismatches: { field: string; rfqValue: string; poValue: string; severity: string; note: string }[];
  missing: { field: string; presentIn: string; value: string }[];
  recommendations: string[];
}

interface RfqDocument {
  id: number;
  fileName: string;
  rfqNumber: string | null;
  extractedFields: Record<string, unknown> | null;
}

interface GovernmentOrder {
  id: number;
  poNumber: string;
  productName: string;
  nsn: string | null;
  quantity: number;
  status: string;
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [rfqDocument, setRfqDocument] = useState<RfqDocument | null>(null);
  const [governmentOrder, setGovernmentOrder] = useState<GovernmentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [uploadingRfq, setUploadingRfq] = useState(false);
  const [uploadingPo, setUploadingPo] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setRfqDocument(data.rfqDocument);
        setGovernmentOrder(data.governmentOrder);
      }
    } catch (error) {
      console.error("Failed to fetch project:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleRfqUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingRfq(true);
    try {
      // Step 1: Get presigned URL
      console.log("RFQ upload: step 1 getting presigned URL", { projectId, fileName: file.name });
      const uploadUrlResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/pdf",
        }),
      });

      if (!uploadUrlResponse.ok) {
        const errText = await uploadUrlResponse.text();
        console.error("RFQ upload: presign failed", errText);
        toast({ variant: "destructive", title: "Failed to get upload URL" });
        return;
      }

      const { url: presignedUrl, key: s3Key } = await uploadUrlResponse.json();
      const contentType = file.type || "application/pdf";
      console.log("RFQ upload: step 2 uploading to S3", { s3Key, contentType, presignedUrl: presignedUrl.substring(0, 100) + "..." });

      // Step 2: Upload to S3
      try {
        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });

        console.log("RFQ upload: S3 response status", uploadResponse.status, uploadResponse.statusText);

        if (!uploadResponse.ok) {
          const errText = await uploadResponse.text();
          console.error("RFQ upload: S3 upload failed", { status: uploadResponse.status, errText });
          toast({ variant: "destructive", title: "Failed to upload file to storage" });
          return;
        }
      } catch (s3Error) {
        console.error("RFQ upload: S3 PUT threw exception (likely CORS)", s3Error);
        toast({ variant: "destructive", title: "S3 upload failed - check CORS configuration" });
        return;
      }

      console.log("RFQ upload: step 2 complete, now calling step 3 /api/rfq/process", { s3Key });

      // Step 3: Process RFQ
      const processResponse = await fetch("/api/rfq/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/pdf",
        }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => null);
        console.error("RFQ upload: process failed", errorData);
        toast({ variant: "destructive", title: errorData?.error || "RFQ processing failed" });
        return;
      }

      const data = await processResponse.json();
      console.log("RFQ upload: process success", data);

      // Step 4: Update project
      const updateResponse = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqDocumentId: data.rfqId,
          rfqNumber: data.extractedFields?.rfqNumber,
          customerName: data.extractedFields?.contractingOffice,
          status: "rfq_received",
        }),
      });

      if (!updateResponse.ok) {
        const updateError = await updateResponse.json().catch(() => null);
        console.error("RFQ upload: project update failed", updateError);
        toast({ variant: "destructive", title: "Project update failed" });
        return;
      }

      console.log("RFQ upload: complete!");
      toast({ title: "RFQ uploaded successfully" });
      await fetchProject();
    } catch (error) {
      console.error("RFQ upload failed:", error);
      toast({ variant: "destructive", title: "RFQ upload failed" });
    } finally {
      setUploadingRfq(false);
    }
  };

  const handlePoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/orders/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Update project with PO reference
        await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            governmentOrderId: data.orderId,
            poNumber: data.order?.poNumber,
            nsn: data.order?.nsn,
            productName: data.order?.productName,
            quantity: data.order?.quantity,
            status: "po_received",
            poReceivedAt: new Date().toISOString(),
          }),
        });
        toast({ title: "PO uploaded successfully" });
        fetchProject();
      } else {
        toast({ variant: "destructive", title: "Upload failed" });
      }
    } catch (error) {
      console.error("PO upload failed:", error);
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploadingPo(false);
    }
  };

  const runComparison = async () => {
    setComparing(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/compare`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setProject((prev) =>
          prev
            ? {
                ...prev,
                comparisonResults: data.comparison,
                comparisonStatus: data.comparison.overallStatus,
              }
            : null
        );
        toast({ title: "Comparison complete" });
      } else {
        const error = await response.json();
        toast({ variant: "destructive", title: error.error || "Comparison failed" });
      }
    } catch (error) {
      console.error("Comparison failed:", error);
      toast({ variant: "destructive", title: "Comparison failed" });
    } finally {
      setComparing(false);
    }
  };

  const updateProjectName = async (name: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      console.error("Failed to update name:", error);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!project) return <div className="p-8">Project not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <Input
          value={project.name}
          onChange={(e) => setProject({ ...project, name: e.target.value })}
          onBlur={(e) => updateProjectName(e.target.value)}
          className="text-xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto"
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatusCard
          icon={<FileText className="h-5 w-5" />}
          label="RFQ"
          status={rfqDocument ? "uploaded" : "pending"}
          detail={rfqDocument?.rfqNumber || "Not uploaded"}
        />
        <StatusCard
          icon={<FileText className="h-5 w-5" />}
          label="Quote"
          status={project.status === "quoted" ? "sent" : "pending"}
          detail={project.status === "quoted" ? "Sent" : "Not sent"}
        />
        <StatusCard
          icon={<Package className="h-5 w-5" />}
          label="PO"
          status={governmentOrder ? "uploaded" : "pending"}
          detail={governmentOrder?.poNumber || "Not uploaded"}
        />
        <StatusCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="Verification"
          status={governmentOrder?.status === "verified" ? "complete" : "pending"}
          detail={governmentOrder?.status || "Pending"}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* RFQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              RFQ (Request for Quote)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rfqDocument ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">{rfqDocument.fileName}</span>
                  </div>
                  {rfqDocument.rfqNumber && (
                    <p className="text-sm text-gray-600 mt-1">RFQ#: {rfqDocument.rfqNumber}</p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <p>Extracted fields available for comparison</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 mb-3">Upload RFQ document</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleRfqUpload}
                  className="hidden"
                  id="rfq-upload"
                  disabled={uploadingRfq}
                />
                <label htmlFor="rfq-upload">
                  <Button asChild disabled={uploadingRfq}>
                    <span>{uploadingRfq ? "Uploading..." : "Upload RFQ"}</span>
                  </Button>
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PO Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              Purchase Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            {governmentOrder ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">PO# {governmentOrder.poNumber}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{governmentOrder.productName}</p>
                  <p className="text-sm text-gray-600">NSN: {governmentOrder.nsn || "N/A"}</p>
                </div>
                <Link href={`/orders/${governmentOrder.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Go to Order Workflow
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 mb-3">Upload PO document</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePoUpload}
                  className="hidden"
                  id="po-upload"
                  disabled={uploadingPo}
                />
                <label htmlFor="po-upload">
                  <Button asChild disabled={uploadingPo}>
                    <span>{uploadingPo ? "Uploading..." : "Upload PO"}</span>
                  </Button>
                </label>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Comparison Section */}
      {(rfqDocument || governmentOrder) && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-orange-600" />
                AI Document Comparison
              </CardTitle>
              <Button onClick={runComparison} disabled={comparing || (!rfqDocument && !governmentOrder)}>
                {comparing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Comparison
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {project.comparisonResults ? (
              <div className="space-y-4">
                {/* Summary */}
                <div
                  className={`p-4 rounded-lg border ${
                    project.comparisonStatus === "matched"
                      ? "bg-green-50 border-green-200"
                      : project.comparisonStatus === "mismatched"
                      ? "bg-red-50 border-red-200"
                      : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {project.comparisonStatus === "matched" ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className="font-semibold capitalize">{project.comparisonStatus}</span>
                  </div>
                  <p className="text-sm">{project.comparisonResults.summary}</p>
                </div>

                {/* Matches */}
                {project.comparisonResults.matches?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Matches ({project.comparisonResults.matches.length})
                    </h4>
                    <div className="space-y-1">
                      {project.comparisonResults.matches.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded">
                          <span className="font-medium w-32">{m.field}:</span>
                          <span className="text-gray-600">{m.rfqValue || m.poValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mismatches */}
                {project.comparisonResults.mismatches?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <X className="h-4 w-4 text-red-600" />
                      Mismatches ({project.comparisonResults.mismatches.length})
                    </h4>
                    <div className="space-y-2">
                      {project.comparisonResults.mismatches.map((m, i) => (
                        <div key={i} className="p-2 bg-red-50 rounded border border-red-200">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.field}</span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                m.severity === "high"
                                  ? "bg-red-200 text-red-800"
                                  : m.severity === "medium"
                                  ? "bg-yellow-200 text-yellow-800"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              {m.severity}
                            </span>
                          </div>
                          <div className="text-sm mt-1 grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-500">RFQ:</span> {m.rfqValue || "N/A"}
                            </div>
                            <div>
                              <span className="text-gray-500">PO:</span> {m.poValue || "N/A"}
                            </div>
                          </div>
                          {m.note && <p className="text-xs text-gray-600 mt-1">{m.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {project.comparisonResults.recommendations?.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="text-sm space-y-1">
                      {project.comparisonResults.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-600">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>Upload both RFQ and PO, then run comparison</p>
                <p className="text-sm">AI will identify matches and discrepancies</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusCard({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  detail: string;
}) {
  const statusColors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    uploaded: "bg-green-100 text-green-600",
    sent: "bg-purple-100 text-purple-600",
    complete: "bg-green-100 text-green-600",
  };

  return (
    <div className={`p-4 rounded-lg ${statusColors[status] || statusColors.pending}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <p className="text-sm truncate">{detail}</p>
    </div>
  );
}
