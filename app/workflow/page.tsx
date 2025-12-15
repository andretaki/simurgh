"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  FileText,
  Send,
  Package,
  ClipboardCheck,
  Truck,
  Search,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Filter,
  RefreshCw,
  FileDown,
  FileBadge,
} from "lucide-react";

interface LinkedPO {
  id: number;
  poNumber: string;
  productName: string;
  nsn: string | null;
  quantity: number;
  status: string;
  createdAt: string;
}

interface LinkedRFQ {
  id: number;
  fileName: string;
  rfqNumber: string | null;
  contractingOffice: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface WorkflowRecord {
  rfqNumber: string | null;
  poNumber: string | null;
  status: string;
  statusLabel: string;
  rfq: {
    id: number;
    fileName: string;
    rfqNumber: string | null;
    contractingOffice: string | null;
    dueDate: string | null;
    createdAt: string;
  } | null;
  response: {
    id: number;
    status: string;
    submittedAt: string | null;
    vendorQuoteRef: string | null;
    generatedPdfUrl: string | null;
    generatedBrandedQuoteUrl: string | null;
  } | null;
  po: {
    id: number;
    poNumber: string;
    productName: string;
    nsn: string | null;
    quantity: number;
    status: string;
    createdAt: string;
  } | null;
  qualitySheet: {
    id: number;
    lotNumber: string;
    verifiedAt: string | null;
  } | null;
  labels: Array<{ id: number; labelType: string }>;
  rfqReceivedAt: string | null;
  responseSubmittedAt: string | null;
  poReceivedAt: string | null;
  verifiedAt: string | null;
  // Many-to-many linked documents
  linkedPOs?: LinkedPO[];
  linkedRFQs?: LinkedRFQ[];
}

interface WorkflowStats {
  total: number;
  byStatus: Record<string, number>;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  description: string;
}> = {
  rfq_received: {
    label: "RFQ Received",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
    icon: <FileText className="h-4 w-4" />,
    description: "Awaiting quote response"
  },
  response_draft: {
    label: "Response Draft",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: <FileText className="h-4 w-4" />,
    description: "Quote in progress"
  },
  response_submitted: {
    label: "Quote Submitted",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    icon: <Send className="h-4 w-4" />,
    description: "Awaiting PO"
  },
  no_bid: {
    label: "No Bid",
    color: "text-slate-700",
    bgColor: "bg-slate-200",
    icon: <AlertCircle className="h-4 w-4" />,
    description: "Closed without quote"
  },
  expired: {
    label: "Expired",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: <Clock className="h-4 w-4" />,
    description: "Due date passed"
  },
  lost: {
    label: "Lost",
    color: "text-rose-700",
    bgColor: "bg-rose-100",
    icon: <AlertTriangle className="h-4 w-4" />,
    description: "Submitted, no award"
  },
  po_received: {
    label: "PO Received",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: <Package className="h-4 w-4" />,
    description: "Ready for fulfillment"
  },
  in_fulfillment: {
    label: "In Fulfillment",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: <ClipboardCheck className="h-4 w-4" />,
    description: "Quality/labels in progress"
  },
  verified: {
    label: "Verified",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: <CheckCircle className="h-4 w-4" />,
    description: "Ready to ship"
  },
  shipped: {
    label: "Shipped",
    color: "text-slate-100",
    bgColor: "bg-slate-700",
    icon: <Truck className="h-4 w-4" />,
    description: "Complete"
  },
};

export default function WorkflowDashboard() {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const statsRes = await fetch("/api/workflow?stats=true");
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch workflow stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    try {
      const url = filterStatus
        ? `/api/workflow?status=${filterStatus}&limit=100`
        : "/api/workflow?limit=100";
      const workflowsRes = await fetch(url);
      if (workflowsRes.ok) {
        const data = await workflowsRes.json();
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
    } finally {
      setWorkflowsLoading(false);
    }
  }, [filterStatus]);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchStats(), fetchWorkflows()]);
  }, [fetchStats, fetchWorkflows]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredWorkflows = workflows.filter((w) => {
    const search = searchTerm.toLowerCase();
    return (
      w.rfqNumber?.toLowerCase().includes(search) ||
      w.poNumber?.toLowerCase().includes(search) ||
      w.po?.productName?.toLowerCase().includes(search) ||
      w.po?.nsn?.toLowerCase().includes(search) ||
      w.rfq?.contractingOffice?.toLowerCase().includes(search) ||
      w.response?.vendorQuoteRef?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.rfq_received;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const getWorkflowLink = (w: WorkflowRecord) => {
    if (w.po) return `/orders/${w.po.id}`;
    if (w.rfq) return `/rfq/${w.rfq.id}/fill`;
    return "#";
  };

  // Pipeline visualization
  const pipelineStages = [
    { key: "rfq_received", label: "RFQ", icon: <FileText className="h-5 w-5" /> },
    { key: "response_draft", label: "Draft", icon: <FileText className="h-5 w-5" /> },
    { key: "response_submitted", label: "Submitted", icon: <Send className="h-5 w-5" /> },
    { key: "no_bid", label: "No Bid", icon: <AlertCircle className="h-5 w-5" /> },
    { key: "expired", label: "Expired", icon: <Clock className="h-5 w-5" /> },
    { key: "lost", label: "Lost", icon: <AlertTriangle className="h-5 w-5" /> },
    { key: "po_received", label: "PO", icon: <Package className="h-5 w-5" /> },
    { key: "in_fulfillment", label: "Fulfill", icon: <ClipboardCheck className="h-5 w-5" /> },
    { key: "verified", label: "Verify", icon: <CheckCircle className="h-5 w-5" /> },
    { key: "shipped", label: "Ship", icon: <Truck className="h-5 w-5" /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workflow Pipeline</h1>
          <p className="text-slate-500">Track RFQs from request to shipment</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${(statsLoading || workflowsLoading) ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {pipelineStages.map((stage) => {
          const count = stats ? (stats.byStatus[stage.key] || 0) : 0;
            const isActive = filterStatus === stage.key;

            return (
              <button
                key={stage.key}
                onClick={() => setFilterStatus(isActive ? null : stage.key)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg mb-2 mx-auto ${
                  STATUS_CONFIG[stage.key]?.bgColor || "bg-slate-100"
                }`}>
                  {stage.icon}
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {statsLoading ? (
                    <div className="h-7 w-10 bg-slate-200 rounded animate-pulse mx-auto" />
                  ) : (
                    count
                  )}
                </div>
                <div className="text-xs text-slate-500">{stage.label}</div>
              </button>
            );
          })}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by RFQ#, PO#, NSN, product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-300"
          />
        </div>
        {filterStatus && (
          <button
            onClick={() => setFilterStatus(null)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
          >
            <Filter className="h-4 w-4" />
            {STATUS_CONFIG[filterStatus]?.label}
            <span className="ml-1">×</span>
          </button>
        )}
      </div>

      {/* Workflows List */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 py-4">
          <CardTitle className="text-base font-semibold text-slate-700">
            {filterStatus ? STATUS_CONFIG[filterStatus]?.label : "All Workflows"} ({filteredWorkflows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {workflowsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-16">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No workflows found</h3>
              <p className="text-slate-400">
                {searchTerm ? "Try a different search term" : "Upload an RFQ to get started"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredWorkflows.map((workflow, idx) => (
                <Link
                  key={`${workflow.rfqNumber || workflow.poNumber || idx}`}
                  href={getWorkflowLink(workflow)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Status indicator */}
                    <div className={`w-1 h-12 rounded-full ${STATUS_CONFIG[workflow.status]?.bgColor || "bg-slate-200"}`} />

                    {/* Main info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* RFQ Number(s) */}
                        {workflow.rfqNumber && (
                          <span className="font-mono text-sm font-medium text-slate-900">
                            RFQ: {workflow.rfqNumber}
                          </span>
                        )}
                        {/* Show additional linked RFQs badge */}
                        {workflow.linkedRFQs && workflow.linkedRFQs.length > 1 && (
                          <span
                            className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-help"
                            title={workflow.linkedRFQs.map(r => r.rfqNumber || `RFQ #${r.id}`).join(", ")}
                          >
                            +{workflow.linkedRFQs.length - 1} RFQ{workflow.linkedRFQs.length > 2 ? "s" : ""}
                          </span>
                        )}
                        {workflow.rfqNumber && workflow.poNumber && (
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                        )}
                        {/* PO Number(s) */}
                        {workflow.poNumber && (
                          <span className="font-mono text-sm font-medium text-amber-700">
                            PO: {workflow.poNumber}
                          </span>
                        )}
                        {/* Show additional linked POs badge */}
                        {workflow.linkedPOs && workflow.linkedPOs.length > 1 && (
                          <span
                            className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded cursor-help"
                            title={workflow.linkedPOs.map(p => p.poNumber).join(", ")}
                          >
                            +{workflow.linkedPOs.length - 1} PO{workflow.linkedPOs.length > 2 ? "s" : ""}
                          </span>
                        )}
                        {getStatusBadge(workflow.status)}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                        {/* Vendor Quote Ref */}
                        {workflow.response?.vendorQuoteRef && (
                          <span className="font-mono text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <FileBadge className="h-3 w-3" />
                            {workflow.response.vendorQuoteRef}
                          </span>
                        )}
                        {workflow.po?.productName && (
                          <span className="truncate max-w-xs">{workflow.po.productName}</span>
                        )}
                        {workflow.po?.nsn && (
                          <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                            {workflow.po.nsn}
                          </span>
                        )}
                        {workflow.po?.quantity && (
                          <span>Qty: {workflow.po.quantity}</span>
                        )}
                        {workflow.rfq?.contractingOffice && !workflow.po && (
                          <span>{workflow.rfq.contractingOffice}</span>
                        )}
                        {/* PDF Links */}
                        {workflow.response?.generatedPdfUrl && (
                          <a
                            href={workflow.response.generatedPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                            title="Buyer Form PDF"
                          >
                            <FileDown className="h-3 w-3" />
                            Buyer
                          </a>
                        )}
                        {workflow.response?.generatedBrandedQuoteUrl && (
                          <a
                            href={workflow.response.generatedBrandedQuoteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-green-600 hover:text-green-800 flex items-center gap-0.5"
                            title="Branded Quote PDF"
                          >
                            <FileBadge className="h-3 w-3" />
                            Quote
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side - timeline dots */}
                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-1">
                      {/* RFQ */}
                      <div className={`w-2.5 h-2.5 rounded-full ${workflow.rfq ? "bg-slate-600" : "bg-slate-200"}`}
                           title={workflow.rfqReceivedAt ? `RFQ: ${new Date(workflow.rfqReceivedAt).toLocaleDateString()}` : "No RFQ"} />
                      <div className={`w-4 h-0.5 ${workflow.response ? "bg-slate-400" : "bg-slate-200"}`} />

                      {/* Response */}
                      <div className={`w-2.5 h-2.5 rounded-full ${workflow.response?.status === "submitted" ? "bg-indigo-500" : workflow.response ? "bg-indigo-300" : "bg-slate-200"}`}
                           title={workflow.responseSubmittedAt ? `Quote: ${new Date(workflow.responseSubmittedAt).toLocaleDateString()}` : "No quote"} />
                      <div className={`w-4 h-0.5 ${workflow.po ? "bg-slate-400" : "bg-slate-200"}`} />

                      {/* PO */}
                      <div className={`w-2.5 h-2.5 rounded-full ${workflow.po ? "bg-amber-500" : "bg-slate-200"}`}
                           title={workflow.poReceivedAt ? `PO: ${new Date(workflow.poReceivedAt).toLocaleDateString()}` : "No PO"} />
                      <div className={`w-4 h-0.5 ${workflow.qualitySheet ? "bg-slate-400" : "bg-slate-200"}`} />

                      {/* Fulfillment */}
                      <div className={`w-2.5 h-2.5 rounded-full ${workflow.qualitySheet ? "bg-orange-500" : "bg-slate-200"}`}
                           title={workflow.qualitySheet ? "Quality sheet created" : "No quality sheet"} />
                      <div className={`w-4 h-0.5 ${workflow.verifiedAt ? "bg-slate-400" : "bg-slate-200"}`} />

                      {/* Verified */}
                      <div className={`w-2.5 h-2.5 rounded-full ${workflow.verifiedAt ? "bg-green-500" : "bg-slate-200"}`}
                           title={workflow.verifiedAt ? `Verified: ${new Date(workflow.verifiedAt).toLocaleDateString()}` : "Not verified"} />
                    </div>

                    {/* Date */}
                    <div className="text-right">
                      <div className="text-xs text-slate-400">
                        {workflow.poReceivedAt
                          ? new Date(workflow.poReceivedAt).toLocaleDateString()
                          : workflow.rfqReceivedAt
                            ? new Date(workflow.rfqReceivedAt).toLocaleDateString()
                            : "—"}
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h3 className="font-semibold mb-3 text-slate-700 text-sm">Pipeline Stages</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                {config.icon}
                {config.label}
              </span>
              <span className="text-xs text-slate-400 mr-3">{config.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
