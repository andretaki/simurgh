"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import {
  Upload,
  FileText,
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Search,
  Filter,
  Plus,
  Tag,
  Printer,
  Trash2,
} from "lucide-react";

interface Order {
  id: number;
  poNumber: string;
  productName: string;
  nsn: string;
  quantity: number;
  unitOfMeasure: string;
  status: string;
  createdAt: string;
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/orders");
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await uploadFile(files[0]);
    }
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.type.includes("pdf")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF file",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/orders/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Upload successful",
          description: "Redirecting to order details...",
        });
        // Redirect to the new order's detail page
        window.location.href = `/orders/${data.orderId}`;
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: error.message || "Failed to upload file",
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { color: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" /> },
      quality_sheet_created: { color: "bg-blue-100 text-blue-700", icon: <FileText className="h-3 w-3" /> },
      labels_generated: { color: "bg-purple-100 text-purple-700", icon: <Tag className="h-3 w-3" /> },
      verified: { color: "bg-green-100 text-green-700", icon: <CheckCircle className="h-3 w-3" /> },
      shipped: { color: "bg-gray-100 text-gray-700", icon: <Package className="h-3 w-3" /> },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const deleteOrder = async (e: React.MouseEvent, orderId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this order?")) return;

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setOrders(orders.filter(o => o.id !== orderId));
        toast({
          title: "Order deleted",
          description: "The order has been removed",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "Could not delete the order",
        });
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "An unexpected error occurred",
      });
    }
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.nsn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Government Orders</h1>
            <p className="text-gray-600 mt-1">Upload POs, create quality sheets, and generate labels</p>
          </div>
        </div>

        {/* Upload Zone */}
        <Card className="mb-8 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
          <CardContent className="p-8">
            <div
              className={`flex flex-col items-center justify-center py-8 ${
                dragActive ? "bg-blue-50" : ""
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Processing PO...</p>
                </>
              ) : (
                <>
                  <div className="p-4 bg-blue-100 rounded-full mb-4">
                    <Upload className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Drop Purchase Order PDF Here
                  </h3>
                  <p className="text-gray-500 mb-4">or click to browse</p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button asChild>
                      <span>
                        <Plus className="h-4 w-4 mr-2" />
                        Upload PO
                      </span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO#, Product, or NSN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Orders ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                <p className="text-gray-500">Upload a Purchase Order PDF to get started</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            PO# {order.poNumber}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {order.productName} | NSN: {order.nsn || "N/A"} | Qty: {order.quantity} {order.unitOfMeasure}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => deleteOrder(e, order.id)}
                        className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workflow Legend */}
        <div className="mt-8 p-4 bg-white rounded-lg border">
          <h3 className="font-semibold text-gray-900 mb-3">Workflow Status</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                <Clock className="h-3 w-3" /> pending
              </span>
              <span className="text-sm text-gray-600">PO uploaded, awaiting review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                <FileText className="h-3 w-3" /> quality sheet
              </span>
              <span className="text-sm text-gray-600">Quality sheet created</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                <Tag className="h-3 w-3" /> labels generated
              </span>
              <span className="text-sm text-gray-600">Labels ready to print</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3" /> verified
              </span>
              <span className="text-sm text-gray-600">Ready for shipment</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
