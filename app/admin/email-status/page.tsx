"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Mail,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Package,
  RotateCcw
} from "lucide-react";
import Link from "next/link";

interface EmailStatus {
  timestamp: string;
  health: {
    status: "healthy" | "unhealthy";
    lastSuccessfulRun: string | null;
    consecutiveFailures: number;
    alert: string | null;
    nextLookback: {
      days: number;
      reason: string;
    };
  };
  today: {
    rfqsProcessed: number;
    posProcessed: number;
  };
  totals: {
    rfqsFromEmail: number;
    posFromEmail: number;
  };
  failures: {
    rfqs: Array<{
      id: number;
      fileName: string;
      error: string | null;
      createdAt: string;
    }>;
    pos: Array<{
      id: number;
      poNumber: string;
      error: string | null;
      createdAt: string;
    }>;
  };
}

export default function EmailStatusPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/email-status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        throw new Error("Failed to fetch status");
      }
    } catch (error) {
      console.error("Error fetching status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load email status",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handlePollNow = async () => {
    setPolling(true);
    try {
      const response = await fetch("/api/email/poll");
      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Poll Complete",
          description: data.emailsProcessed > 0
            ? `Processed ${data.emailsProcessed} email(s)`
            : data.message || "No new emails to process",
        });
        // Refresh status after poll
        await fetchStatus();
      } else {
        throw new Error(data.error || "Poll failed");
      }
    } catch (error) {
      console.error("Error polling:", error);
      toast({
        variant: "destructive",
        title: "Poll Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setPolling(false);
    }
  };

  const handleRetry = async (type: "rfq" | "po", id: number) => {
    const key = `${type}-${id}`;
    setRetrying(key);
    try {
      const response = await fetch("/api/admin/email-status/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Retry Successful",
          description: type === "rfq"
            ? `RFQ ${data.rfqNumber} extracted successfully`
            : `PO ${data.poNumber} extracted successfully`,
        });
        await fetchStatus();
      } else {
        toast({
          variant: "destructive",
          title: "Retry Failed",
          description: data.error || "Extraction failed again",
        });
      }
    } catch (error) {
      console.error("Error retrying:", error);
      toast({
        variant: "destructive",
        title: "Retry Error",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setRetrying(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getTimeSince = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ago`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    return `${minutes}m ago`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex gap-4 mb-6">
        <Button variant="outline" asChild>
          <Link href="/projects">Projects</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/orders">Orders</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/settings">Settings</Link>
        </Button>
      </div>

      <Card className="shadow-lg mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-semibold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Ingestion Status
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStatus}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={handlePollNow}
                disabled={polling}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {polling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Polling...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-1" />
                    Poll Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {status && (
            <div className="space-y-6">
              {/* Health Status */}
              <div className={`p-4 rounded-lg ${
                status.health.status === "healthy"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {status.health.status === "healthy" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-semibold ${
                    status.health.status === "healthy" ? "text-green-800" : "text-red-800"
                  }`}>
                    {status.health.status === "healthy" ? "System Healthy" : "System Unhealthy"}
                  </span>
                </div>
                {status.health.alert && (
                  <p className="text-red-700 text-sm mb-2">{status.health.alert}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-gray-500">Last Successful Run</p>
                    <p className="text-sm font-medium">{getTimeSince(status.health.lastSuccessfulRun)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Consecutive Failures</p>
                    <p className="text-sm font-medium">{status.health.consecutiveFailures}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Next Lookback</p>
                    <p className="text-sm font-medium">{status.health.nextLookback.days} days</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Reason</p>
                    <p className="text-sm font-medium truncate" title={status.health.nextLookback.reason}>
                      {status.health.nextLookback.reason}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-blue-600 font-medium">RFQs Today</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800">{status.today.rfqsProcessed}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-purple-600 font-medium">POs Today</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800">{status.today.posProcessed}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-gray-600" />
                    <span className="text-xs text-gray-600 font-medium">Total RFQs</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{status.totals.rfqsFromEmail}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-gray-600" />
                    <span className="text-xs text-gray-600 font-medium">Total POs</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{status.totals.posFromEmail}</p>
                </div>
              </div>

              {/* Failed Extractions */}
              {(status.failures.rfqs.length > 0 || status.failures.pos.length > 0) && (
                <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="h-5 w-5" />
                    Failed Extractions ({status.failures.rfqs.length + status.failures.pos.length})
                  </h3>

                  {status.failures.rfqs.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">RFQ Failures</h4>
                      <div className="space-y-2">
                        {status.failures.rfqs.map((failure) => (
                          <div key={failure.id} className="bg-white p-3 rounded border flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{failure.fileName}</p>
                              <p className="text-xs text-gray-500">{formatDate(failure.createdAt)}</p>
                              {failure.error && (
                                <p className="text-xs text-red-600 mt-1">{failure.error}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry("rfq", failure.id)}
                              disabled={retrying === `rfq-${failure.id}`}
                            >
                              {retrying === `rfq-${failure.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Retry
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {status.failures.pos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">PO Failures</h4>
                      <div className="space-y-2">
                        {status.failures.pos.map((failure) => (
                          <div key={failure.id} className="bg-white p-3 rounded border flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium">PO #{failure.poNumber}</p>
                              <p className="text-xs text-gray-500">{formatDate(failure.createdAt)}</p>
                              {failure.error && (
                                <p className="text-xs text-red-600 mt-1">{failure.error}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry("po", failure.id)}
                              disabled={retrying === `po-${failure.id}`}
                            >
                              {retrying === `po-${failure.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Retry
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Last Updated */}
              <div className="flex items-center justify-end text-xs text-gray-500">
                <Clock className="h-3 w-3 mr-1" />
                Last updated: {formatDate(status.timestamp)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
