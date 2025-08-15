"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Upload,
  FileText,
  Settings,
  History,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  Cpu,
  Activity,
} from "lucide-react";

export default function HomePage() {
  const [systemStatus, setSystemStatus] = useState({
    database: "checking",
    s3: "checking",
    openai: "checking",
    server: "online"
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    // Check system status
    checkSystemHealth();
    fetchRecentActivity();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const response = await fetch("/api/health");
      if (response.ok) {
        const health = await response.json();
        setSystemStatus(health);
      } else {
        setSystemStatus({
          database: "error",
          s3: "error",
          openai: "error",
          server: "error"
        });
      }
    } catch (error) {
      console.error("Health check failed:", error);
      setSystemStatus({
        database: "error",
        s3: "error",
        openai: "error",
        server: "offline"
      });
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const response = await fetch("/api/rfq/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagination: { page: 1, limit: 5 },
          sort: { field: "createdAt", order: "desc" }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.results || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "online":
      case "configured":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
      case "not configured":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "online":
      case "configured":
        return "text-green-600";
      case "error": 
      case "not configured":
        return "text-red-600";
      default:
        return "text-yellow-600";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Simurgh RFQ System</h1>
          <p className="text-gray-600 mt-1">Operational Dashboard</p>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(systemStatus.database)}
                  <span className={`text-xs ${getStatusColor(systemStatus.database)}`}>
                    {systemStatus.database}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium">S3 Storage</span>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(systemStatus.s3)}
                  <span className={`text-xs ${getStatusColor(systemStatus.s3)}`}>
                    {systemStatus.s3}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium">OpenAI API</span>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(systemStatus.openai)}
                  <span className={`text-xs ${getStatusColor(systemStatus.openai)}`}>
                    {systemStatus.openai}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium">Server</span>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(systemStatus.server)}
                  <span className={`text-xs ${getStatusColor(systemStatus.server)}`}>
                    {systemStatus.server}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/rfq-pro" className="block">
                <Button className="w-full justify-start" variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process RFQ
                </Button>
              </Link>
              
              <Link href="/rfq-fill" className="block">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Fill RFQ Response
                </Button>
              </Link>
              
              <Link href="/settings" className="block">
                <Button className="w-full justify-start" variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Company Settings
                </Button>
              </Link>
              
              <Link href="/analytics" className="block">
                <Button className="w-full justify-start" variant="outline">
                  <Activity className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent RFQs</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((rfq: any) => (
                    <div key={rfq.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {rfq.fileName || `RFQ #${rfq.id}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {rfq.rfqNumber || "No RFQ number"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          rfq.status === 'processed' ? 'bg-green-100 text-green-700' :
                          rfq.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {rfq.status}
                        </span>
                        {rfq.hasResponse && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <Link href="/rfq-done">
                    <Button variant="ghost" size="sm" className="w-full">
                      View All History →
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No RFQs processed yet</p>
                  <Link href="/rfq-pro">
                    <Button variant="outline" size="sm" className="mt-3">
                      Upload First RFQ
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-semibold text-gray-700">1.</span>
                <span>Configure your company profile in Settings (CAGE code, business info, etc.)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-gray-700">2.</span>
                <span>Upload RFQ PDFs - the AI will extract all fields automatically</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-gray-700">3.</span>
                <span>Review extracted fields and click "Fill from Profile" to auto-populate</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-gray-700">4.</span>
                <span>Generate professional PDF response with one click</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Environment Info */}
        <div className="mt-8 text-xs text-gray-500 text-center">
          <p>Environment: Development | Next.js {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'} Mode</p>
        </div>
      </div>
    </div>
  );
}