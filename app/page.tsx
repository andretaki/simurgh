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
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  TrendingUp,
  Users,
  Award,
  BarChart3,
  Brain,
  Rocket,
  Target,
} from "lucide-react";
import type { ActivityItem, SystemHealth, DashboardStats } from "@/lib/types";

export default function HomePage() {
  const [systemStatus, setSystemStatus] = useState<SystemHealth>({
    database: "checking",
    s3: "checking",
    openai: "checking",
    server: "online"
  });

  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    documentsToday: 0,
    pendingActions: 0,
    processingQueue: 0,
    successRate: 0,
  });

  useEffect(() => {
    checkSystemHealth();
    fetchRecentActivity();
    fetchStats();
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

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats");
      if (response.ok) {
        const data = await response.json();
        setStats({
          documentsToday: data.overview.recentRFQs || 0,
          pendingActions: data.overview.pendingRFQs || 0,
          processingQueue: 0, // TODO: Add processing queue count to API
          successRate: data.overview.successRate || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "online":
      case "configured":
        return <CheckCircle className="h-4 w-4 text-green-500 animate-pulse" />;
      case "error":
      case "not configured":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
  };


  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Simurgh Dashboard</h1>
          <p className="text-black">RFQ and Purchase Order Processing</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-black">
                    {stats.documentsToday.toLocaleString()}
                  </p>
                  <p className="text-sm text-black">Documents Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-black">
                    {stats.pendingActions.toLocaleString()}
                  </p>
                  <p className="text-sm text-black">Pending Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-black">
                    {stats.processingQueue.toLocaleString()}
                  </p>
                  <p className="text-sm text-black">Processing Queue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-black">
                    {stats.successRate}%
                  </p>
                  <p className="text-sm text-black">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Quick Actions */}
          <Card className="border border-gray-200">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="flex items-center gap-2 text-black">
                <Zap className="h-5 w-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <Link href="/rfq-pro" className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Upload className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-black">Process New RFQ</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
              
              <Link href="/rfq-done" className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-black">View All RFQs</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
              
              <Link href="/rfq-fill" className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-black">Fill RFQ Response</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
              
              <Link href="/settings" className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-black">Company Settings</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border border-gray-200">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="flex items-center gap-2 text-black">
                <Activity className="h-5 w-5 text-blue-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((rfq: any) => (
                      <div key={rfq.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-black">
                              {rfq.fileName || `RFQ #${rfq.id}`}
                            </p>
                            <p className="text-xs text-black">
                              {rfq.rfqNumber || "Processing..."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                            rfq.status === 'processed' 
                              ? 'bg-green-100 text-green-700' 
                              : rfq.status === 'processing' 
                              ? 'bg-yellow-100 text-yellow-700 animate-pulse' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {rfq.status}
                          </span>
                          {rfq.hasResponse && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <Link href="/rfq-done">
                      <Button variant="ghost" className="w-full mt-2">
                        View All History
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 rounded-full bg-gray-100 mb-4">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-black mb-4">No recent activity</p>
                    <div className="space-y-2">
                      <Link href="/rfq-done">
                        <Button variant="outline" size="sm" className="w-full">
                          View All RFQs
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href="/rfq-pro">
                        <Button size="sm" className="w-full">
                          Process New RFQ
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
        </div>

        {/* System Status */}
        <Card className="border border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Activity className="h-5 w-5 text-blue-600" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-black">Database</span>
                </div>
                {getStatusIcon(systemStatus.database)}
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-black">Storage</span>
                </div>
                {getStatusIcon(systemStatus.s3)}
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-black">AI Engine</span>
                </div>
                {getStatusIcon(systemStatus.openai)}
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-black">Server</span>
                </div>
                {getStatusIcon(systemStatus.server)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}