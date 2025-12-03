"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Package,
  CheckCircle2,
  ChevronRight,
  Phone,
  Mail,
  ExternalLink,
  Loader2,
  Upload,
  Clock,
  AlertTriangle,
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
  partNumber?: string;
  manufacturerPartNumber?: string;
  specifications?: string;
  hazmat?: boolean;
  unNumber?: string;
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

// Progress Step Component
function ProgressStep({
  step,
  label,
  status
}: {
  step: number;
  label: string;
  status: "complete" | "current" | "upcoming"
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
        ${status === "complete" ? "bg-green-500 text-white" : ""}
        ${status === "current" ? "bg-blue-600 text-white ring-4 ring-blue-100" : ""}
        ${status === "upcoming" ? "bg-gray-100 text-gray-400" : ""}
      `}>
        {status === "complete" ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span className={`
        text-sm font-medium transition-colors duration-300
        ${status === "complete" ? "text-green-600" : ""}
        ${status === "current" ? "text-blue-600" : ""}
        ${status === "upcoming" ? "text-gray-400" : ""}
      `}>
        {label}
      </span>
    </div>
  );
}

// Drag and Drop Upload Zone
function DropZone({
  onFileSelect,
  uploading,
  label,
  sublabel,
  icon: Icon,
}: {
  onFileSelect: (file: File) => void;
  uploading: boolean;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer
        ${isDragging
          ? "border-blue-500 bg-blue-50 scale-[1.02]"
          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
        }
        ${uploading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={uploading}
      />

      <div className={`
        w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors duration-200
        ${isDragging ? "bg-blue-100" : "bg-gray-100"}
      `}>
        {uploading ? (
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        ) : (
          <Icon className={`w-8 h-8 ${isDragging ? "text-blue-600" : "text-gray-400"}`} />
        )}
      </div>

      <p className="text-lg font-semibold text-gray-900 mb-1">
        {uploading ? "Uploading..." : label}
      </p>
      <p className="text-sm text-gray-500">
        {uploading ? "Please wait" : sublabel}
      </p>
    </div>
  );
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

  const handleRfqUpload = async (file: File) => {
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

      toast({ title: "RFQ uploaded successfully!" });
      await fetchProject();
    } catch (error) {
      console.error("Upload failed:", error);
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploadingRfq(false);
    }
  };

  const handlePoUpload = async (file: File) => {
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
        toast({ title: "PO uploaded successfully!" });
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

  // Determine current step
  const getCurrentStep = () => {
    if (governmentOrder) return 3;
    if (rfqDocument) return 2;
    return 1;
  };

  const currentStep = getCurrentStep();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Project not found</p>
          <Link href="/projects">
            <Button variant="outline">Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const extracted = rfqDocument?.extractedFields;
  const firstItem = extracted?.items?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/projects"
            className="inline-flex items-center text-gray-500 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {extracted?.rfqNumber ? `RFQ #${extracted.rfqNumber}` : project.name}
              </h1>
              {extracted?.contractingOffice && (
                <p className="text-gray-500 mt-1">{extracted.contractingOffice}</p>
              )}
            </div>

            {/* Due Date Badge */}
            {extracted?.requestedReplyDate && (
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

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-10 px-4">
          <ProgressStep
            step={1}
            label="RFQ Received"
            status={currentStep > 1 ? "complete" : currentStep === 1 ? "current" : "upcoming"}
          />
          <div className={`flex-1 h-0.5 mx-4 transition-colors duration-500 ${currentStep > 1 ? "bg-green-500" : "bg-gray-200"}`} />
          <ProgressStep
            step={2}
            label="Quote Sent"
            status={currentStep > 2 ? "complete" : currentStep === 2 ? "current" : "upcoming"}
          />
          <div className={`flex-1 h-0.5 mx-4 transition-colors duration-500 ${currentStep > 2 ? "bg-green-500" : "bg-gray-200"}`} />
          <ProgressStep
            step={3}
            label="PO Received"
            status={currentStep >= 3 ? "complete" : "upcoming"}
          />
        </div>

        {/* Main Content */}
        <div className="space-y-6">

          {/* Step 1: RFQ */}
          {!rfqDocument ? (
            // Upload RFQ State
            <DropZone
              onFileSelect={handleRfqUpload}
              uploading={uploadingRfq}
              label="Drop RFQ here"
              sublabel="or click to browse"
              icon={FileText}
            />
          ) : (
            // RFQ Info Card
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              {/* Success Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-900">RFQ Received</p>
                      <p className="text-sm text-green-700">{rfqDocument.fileName}</p>
                    </div>
                  </div>
                  {rfqDocument.s3Url && (
                    <a
                      href={rfqDocument.s3Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <ExternalLink className="h-5 w-5 text-green-700" />
                    </a>
                  )}
                </div>
              </div>

              {/* The Key Info - What They Need */}
              {firstItem && (
                <div className="px-6 py-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    What they need
                  </p>

                  {/* Quantity + Product Name */}
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-bold text-gray-900">{firstItem.quantity}</span>
                    <span className="text-xl text-gray-500">{firstItem.unit}</span>
                  </div>

                  {/* Extract product name from description (first sentence or key product) */}
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    {firstItem.description?.match(/^[^.]+/)?.[0]?.replace(/CRITICAL APPLICATION ITEM\.\s*/i, '').trim() || 'Product'}
                  </p>

                  {/* Key IDs Row */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {firstItem.nsn && (
                      <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-lg font-mono">
                        NSN: {firstItem.nsn}
                      </span>
                    )}
                    {firstItem.partNumber && (
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg font-mono">
                        {firstItem.partNumber}
                      </span>
                    )}
                    {firstItem.hazmat && (
                      <span className="px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-lg font-medium flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        HAZMAT {firstItem.unNumber && `(${firstItem.unNumber})`}
                      </span>
                    )}
                  </div>

                  {/* Manufacturer P/N if different */}
                  {firstItem.manufacturerPartNumber && firstItem.manufacturerPartNumber !== firstItem.partNumber && (
                    <p className="text-sm text-gray-500 mb-2">
                      <span className="text-gray-400">Mfr P/N:</span> {firstItem.manufacturerPartNumber}
                    </p>
                  )}

                  {/* Specs */}
                  {firstItem.specifications && (
                    <p className="text-sm text-gray-500">
                      <span className="text-gray-400">Spec:</span> {firstItem.specifications}
                    </p>
                  )}
                </div>
              )}

              {/* Contact Info */}
              {extracted?.pocName && (
                <div className="px-6 py-4 bg-gray-50 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{extracted.pocName}</p>
                      <p className="text-sm text-gray-500">Buyer Contact</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {extracted.pocEmail && (
                        <a
                          href={`mailto:${extracted.pocEmail}`}
                          className="p-2.5 rounded-lg bg-white border hover:bg-gray-50 hover:border-gray-300 transition-all"
                          title={extracted.pocEmail}
                        >
                          <Mail className="h-4 w-4 text-gray-600" />
                        </a>
                      )}
                      {extracted.pocPhone && (
                        <a
                          href={`tel:${extracted.pocPhone}`}
                          className="p-2.5 rounded-lg bg-white border hover:bg-gray-50 hover:border-gray-300 transition-all"
                          title={extracted.pocPhone}
                        >
                          <Phone className="h-4 w-4 text-gray-600" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="p-6 border-t">
                <Link href={`/rfq/${rfqDocument.id}/fill`} className="block">
                  <Button className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow transition-all">
                    Respond to RFQ
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Step 2: PO (only show after RFQ) */}
          {rfqDocument && (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              {governmentOrder ? (
                // PO Received State
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">PO Received</p>
                        <p className="text-sm text-gray-500">PO# {governmentOrder.poNumber}</p>
                      </div>
                    </div>
                    <Link href={`/orders/${governmentOrder.id}`}>
                      <Button variant="outline" className="hover:bg-gray-50">
                        View Order
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                // Waiting for PO State
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Waiting for PO</p>
                      <p className="text-sm text-gray-500">Upload when you receive it</p>
                    </div>
                  </div>

                  <DropZone
                    onFileSelect={handlePoUpload}
                    uploading={uploadingPo}
                    label="Drop PO here"
                    sublabel="or click to browse"
                    icon={Upload}
                  />
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
