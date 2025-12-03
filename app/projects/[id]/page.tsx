"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Package,
  Upload,
  CheckCircle,
  ChevronRight,
  Phone,
  Mail,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Project {
  id: number;
  name: string;
  customerName: string | null;
  rfqNumber: string | null;
  status: string;
}

interface ExtractedItem {
  itemNumber: string;
  quantity: number;
  unit: string;
  description: string;
  nsn?: string;
  hazmat?: boolean;
}

interface ExtractedFields {
  rfqNumber?: string;
  requestedReplyDate?: string;
  contractingOffice?: string;
  pocName?: string;
  pocEmail?: string;
  pocPhone?: string;
  items?: ExtractedItem[];
}

interface RfqDocument {
  id: number;
  fileName: string;
  rfqNumber: string | null;
  s3Url?: string;
  extractedFields: ExtractedFields | null;
}

interface GovernmentOrder {
  id: number;
  poNumber: string;
  productName: string;
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
      const uploadUrlResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "application/pdf" }),
      });

      if (!uploadUrlResponse.ok) {
        toast({ variant: "destructive", title: "Upload failed" });
        return;
      }

      const { url: presignedUrl, key: s3Key } = await uploadUrlResponse.json();

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!uploadResponse.ok) {
        toast({ variant: "destructive", title: "Upload failed" });
        return;
      }

      const processResponse = await fetch("/api/rfq/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Key, fileName: file.name, fileSize: file.size, mimeType: file.type || "application/pdf" }),
      });

      if (!processResponse.ok) {
        toast({ variant: "destructive", title: "Processing failed" });
        return;
      }

      const data = await processResponse.json();

      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqDocumentId: data.rfqId,
          rfqNumber: data.extractedFields?.rfqNumber,
          customerName: data.extractedFields?.contractingOffice,
          status: "rfq_received",
        }),
      });

      toast({ title: "RFQ uploaded!" });
      await fetchProject();
    } catch (error) {
      console.error("Upload failed:", error);
      toast({ variant: "destructive", title: "Upload failed" });
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

      const response = await fetch("/api/orders/upload", { method: "POST", body: formData });

      if (response.ok) {
        const data = await response.json();
        await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            governmentOrderId: data.orderId,
            poNumber: data.order?.poNumber,
            status: "po_received",
          }),
        });
        toast({ title: "PO uploaded!" });
        fetchProject();
      } else {
        toast({ variant: "destructive", title: "Upload failed" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploadingPo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  const extracted = rfqDocument?.extractedFields;
  const firstItem = extracted?.items?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <div className="bg-white border-b px-6 py-4">
        <Link href="/projects" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Projects
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">
          {extracted?.rfqNumber ? `RFQ #${extracted.rfqNumber}` : project.name}
        </h1>
        {extracted?.contractingOffice && (
          <p className="text-gray-500">{extracted.contractingOffice}</p>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Step 1: RFQ */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {rfqDocument ? (
            <>
              {/* RFQ Header - Green success state */}
              <div className="p-6 border-b bg-green-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-green-900">RFQ Received</p>
                    <p className="text-sm text-green-700">{rfqDocument.fileName}</p>
                  </div>
                  {rfqDocument.s3Url && (
                    <a href={rfqDocument.s3Url} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:text-green-900">
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  )}
                </div>
              </div>

              {/* What they're asking for - THE KEY INFO */}
              {firstItem && (
                <div className="p-6 border-b">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">They need</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">
                    {firstItem.quantity} {firstItem.unit}
                  </p>
                  <p className="text-gray-600">{firstItem.description?.substring(0, 100)}</p>
                  {firstItem.nsn && (
                    <p className="text-sm text-gray-500 mt-2">NSN: {firstItem.nsn}</p>
                  )}
                  {firstItem.hazmat && (
                    <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                      ⚠️ HAZMAT
                    </span>
                  )}
                </div>
              )}

              {/* Due date + Contact - Secondary info */}
              <div className="p-6 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Response Due</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {extracted?.requestedReplyDate || "Not specified"}
                    </p>
                  </div>
                  {extracted?.pocName && (
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{extracted.pocName}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {extracted.pocEmail && (
                          <a href={`mailto:${extracted.pocEmail}`} className="hover:text-blue-600 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            Email
                          </a>
                        )}
                        {extracted.pocPhone && (
                          <a href={`tel:${extracted.pocPhone}`} className="hover:text-blue-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Big Action Button */}
              <div className="p-6">
                <Link href={`/rfq/${rfqDocument.id}/fill`} className="block">
                  <Button className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700">
                    Respond to RFQ
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            /* Upload RFQ state */
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload RFQ</h3>
              <p className="text-gray-500 mb-6">Start by uploading the RFQ document</p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleRfqUpload}
                className="hidden"
                id="rfq-upload"
                disabled={uploadingRfq}
              />
              <label htmlFor="rfq-upload">
                <Button asChild disabled={uploadingRfq} size="lg" className="cursor-pointer">
                  <span>
                    {uploadingRfq ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> Choose File</>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          )}
        </div>

        {/* Step 2: PO (only show after RFQ) */}
        {rfqDocument && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {governmentOrder ? (
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">PO Received</p>
                    <p className="text-sm text-gray-500">PO# {governmentOrder.poNumber}</p>
                  </div>
                  <Link href={`/orders/${governmentOrder.id}`}>
                    <Button variant="outline">
                      View Order
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Waiting for PO</p>
                    <p className="text-sm text-gray-500">Upload when received</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePoUpload}
                    className="hidden"
                    id="po-upload"
                    disabled={uploadingPo}
                  />
                  <label htmlFor="po-upload">
                    <Button asChild variant="outline" disabled={uploadingPo} className="cursor-pointer">
                      <span>
                        {uploadingPo ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                        ) : (
                          <><Upload className="h-4 w-4 mr-2" /> Upload PO</>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
