"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Calendar, Search, Eye, Clock } from "lucide-react";
import Link from "next/link";

interface RFQHistoryItem {
  id: number;
  fileName: string;
  rfqNumber: string | null;
  status: string;
  createdAt: string;
  dueDate: string | null;
  contractingOffice: string | null;
  s3Url: string | null;
  extractedFields: any;
}

interface RFQResponse {
  id: number;
  rfqDocumentId: number;
  status: string;
  generatedPdfUrl: string | null;
  submittedAt: string | null;
}

export default function HistoryPage() {
  const [rfqs, setRfqs] = useState<RFQHistoryItem[]>([]);
  const [responses, setResponses] = useState<{ [key: number]: RFQResponse }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "processed" | "failed">("all");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/history");
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      
      setRfqs(data.rfqs || []);
      
      // Convert responses array to a map for easy lookup
      const responsesMap: { [key: number]: RFQResponse } = {};
      if (data.responses) {
        data.responses.forEach((resp: RFQResponse) => {
          responsesMap[resp.rfqDocumentId] = resp;
        });
      }
      setResponses(responsesMap);
      
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRfqs = rfqs.filter(rfq => {
    const matchesSearch = 
      rfq.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rfq.rfqNumber && rfq.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rfq.contractingOffice && rfq.contractingOffice.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = 
      filter === "all" || 
      (filter === "processed" && rfq.status === "processed") ||
      (filter === "failed" && rfq.status === "failed");
    
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed":
        return "text-green-600";
      case "processing":
        return "text-yellow-600";
      case "failed":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">RFQ History</h1>
        <p className="text-gray-600">View and manage all your processed RFQs</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by file name, RFQ number, or office..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={filter === "processed" ? "default" : "outline"}
            onClick={() => setFilter("processed")}
            size="sm"
          >
            Processed
          </Button>
          <Button
            variant={filter === "failed" ? "default" : "outline"}
            onClick={() => setFilter("failed")}
            size="sm"
          >
            Failed
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total RFQs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rfqs.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Processed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {rfqs.filter(r => r.status === "processed").length}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Generated PDFs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {Object.values(responses).filter(r => r.generatedPdfUrl).length}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Time Saved</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {rfqs.length * 40} min
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RFQ List */}
      <div className="space-y-4">
        {filteredRfqs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">No RFQs found</p>
              <Link href="/rfq/upload">
                <Button className="mt-4">Upload Your First RFQ</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          filteredRfqs.map((rfq) => {
            const response = responses[rfq.id];
            return (
              <Card key={rfq.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {rfq.fileName}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {rfq.rfqNumber && (
                          <span className="font-semibold">RFQ #{rfq.rfqNumber} • </span>
                        )}
                        {rfq.contractingOffice && (
                          <span>{rfq.contractingOffice} • </span>
                        )}
                        <span className={getStatusColor(rfq.status)}>
                          {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(rfq.createdAt)}
                      </div>
                      {rfq.dueDate && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          Due: {new Date(rfq.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {rfq.s3Url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(rfq.s3Url!, "_blank")}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Original
                      </Button>
                    )}
                    
                    {rfq.status === "processed" && (
                      <Link href={`/rfq/${rfq.id}/fill`}>
                        <Button size="sm" variant="outline">
                          <FileText className="h-4 w-4 mr-1" />
                          Fill Response
                        </Button>
                      </Link>
                    )}
                    
                    {response?.generatedPdfUrl && (
                      <Button
                        size="sm"
                        onClick={() => window.open(response.generatedPdfUrl!, "_blank")}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download Response
                      </Button>
                    )}
                  </div>
                  
                  {rfq.extractedFields && Object.keys(rfq.extractedFields).length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <p className="font-semibold mb-1">Extracted Fields:</p>
                      <div className="grid grid-cols-2 gap-1 text-gray-600">
                        {rfq.extractedFields.pocName && (
                          <span>POC: {rfq.extractedFields.pocName}</span>
                        )}
                        {rfq.extractedFields.deliveryLocation && (
                          <span>Delivery: {rfq.extractedFields.deliveryLocation}</span>
                        )}
                        {rfq.extractedFields.paymentTerms && (
                          <span>Payment: {rfq.extractedFields.paymentTerms}</span>
                        )}
                        {rfq.extractedFields.items?.length > 0 && (
                          <span>Items: {rfq.extractedFields.items.length}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}