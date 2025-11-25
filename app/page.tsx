"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, ArrowRight, Plus, CheckCircle, Clock } from "lucide-react";

interface Order {
  id: number;
  poNumber: string;
  productName: string;
  quantity: number;
  status: string;
  createdAt: string;
}

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  const pendingCount = orders.filter(o => o.status !== "verified").length;
  const verifiedCount = orders.filter(o => o.status === "verified").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-gray-500">Government Order Verification</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-sm text-gray-500">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{verifiedCount}</p>
                <p className="text-sm text-gray-500">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action */}
      <Link href="/orders">
        <Button className="w-full mb-8" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Order
        </Button>
      </Link>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 py-4">Loading...</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No orders yet</p>
              <Link href="/orders">
                <Button>Upload Your First PO</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 5).map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="flex items-center justify-between p-3 rounded hover:bg-gray-50 border">
                    <div>
                      <p className="font-medium">PO# {order.poNumber}</p>
                      <p className="text-sm text-gray-500">{order.productName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        order.status === "verified"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {order.status}
                      </span>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}

              {orders.length > 5 && (
                <Link href="/orders">
                  <Button variant="ghost" className="w-full mt-2">
                    View All Orders
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
