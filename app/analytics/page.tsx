"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Clock,
  FileText,
  Users,
  DollarSign,
  Calendar,
  Award,
  Target,
  Activity,
  Zap,
  PieChart,
  ArrowUp,
  ArrowDown,
  Filter,
  Download,
} from "lucide-react";
import Link from "next/link";

interface Analytics {
  overview: {
    totalRFQs: number;
    completedRFQs: number;
    pendingRFQs: number;
    successRate: number;
    averageResponseTime: number;
    totalValueQuoted: number;
    timeSaved: number;
    accuracy: number;
  };
  trends: {
    daily: Array<{ date: string; count: number; value: number }>;
    weekly: Array<{ week: string; count: number; avgTime: number }>;
    monthly: Array<{ month: string; count: number; successRate: number }>;
  };
  performance: {
    processingSpeed: number;
    extractionAccuracy: number;
    automationRate: number;
    errorRate: number;
  };
  topMetrics: {
    mostCommonFields: Array<{ field: string; count: number; confidence: number }>;
    contractingOffices: Array<{ office: string; count: number }>;
    documentTypes: Array<{ type: string; count: number; percentage: number }>;
  };
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics>({
    overview: {
      totalRFQs: 127,
      completedRFQs: 118,
      pendingRFQs: 9,
      successRate: 92.9,
      averageResponseTime: 4.2,
      totalValueQuoted: 2847500,
      timeSaved: 5080,
      accuracy: 94.5,
    },
    trends: {
      daily: [
        { date: "Mon", count: 12, value: 145000 },
        { date: "Tue", count: 18, value: 287000 },
        { date: "Wed", count: 15, value: 198000 },
        { date: "Thu", count: 22, value: 412000 },
        { date: "Fri", count: 28, value: 523000 },
        { date: "Sat", count: 8, value: 87000 },
        { date: "Sun", count: 5, value: 45000 },
      ],
      weekly: [
        { week: "Week 1", count: 35, avgTime: 5.2 },
        { week: "Week 2", count: 42, avgTime: 4.8 },
        { week: "Week 3", count: 38, avgTime: 4.1 },
        { week: "Week 4", count: 45, avgTime: 3.9 },
      ],
      monthly: [
        { month: "Jan", count: 98, successRate: 89 },
        { month: "Feb", count: 112, successRate: 91 },
        { month: "Mar", count: 127, successRate: 93 },
      ],
    },
    performance: {
      processingSpeed: 3.8,
      extractionAccuracy: 94.5,
      automationRate: 87.3,
      errorRate: 2.1,
    },
    topMetrics: {
      mostCommonFields: [
        { field: "Payment Terms", count: 124, confidence: 95 },
        { field: "Delivery Date", count: 118, confidence: 92 },
        { field: "CAGE Code", count: 115, confidence: 98 },
        { field: "Unit Price", count: 108, confidence: 90 },
        { field: "Quantity", count: 105, confidence: 96 },
      ],
      contractingOffices: [
        { office: "NAVSUP FLC Norfolk", count: 42 },
        { office: "DLA Aviation", count: 38 },
        { office: "Army Contracting Command", count: 31 },
        { office: "Air Force Material Command", count: 16 },
      ],
      documentTypes: [
        { type: "RFQ", count: 78, percentage: 61.4 },
        { type: "RFP", count: 32, percentage: 25.2 },
        { type: "RFI", count: 17, percentage: 13.4 },
      ],
    },
  });

  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  const MetricCard = ({ 
    title, 
    value, 
    unit, 
    change, 
    icon: Icon, 
    color = "blue" 
  }: { 
    title: string; 
    value: string | number; 
    unit?: string; 
    change?: number; 
    icon: any; 
    color?: string;
  }) => {
    const colorClasses = {
      blue: "from-blue-50 to-blue-100 border-blue-200",
      green: "from-green-50 to-green-100 border-green-200",
      purple: "from-purple-50 to-purple-100 border-purple-200",
      amber: "from-amber-50 to-amber-100 border-amber-200",
    };

    return (
      <Card className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{title}</span>
            <Icon className={`h-5 w-5 text-${color}-500`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{value}</span>
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </div>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0 ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${change > 0 ? "text-green-600" : "text-red-600"}`}>
                {Math.abs(change)}%
              </span>
              <span className="text-sm text-gray-500">vs last period</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const ProgressBar = ({ label, value, max = 100 }: { label: string; value: number; max?: number }) => (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-medium text-gray-900">{value}/{max}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Analytics Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Real-time insights into your RFQ processing performance
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as "7d" | "30d" | "90d")}
              className="px-4 py-2 border rounded-lg text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total RFQs Processed"
            value={analytics.overview.totalRFQs}
            change={12.5}
            icon={FileText}
            color="blue"
          />
          <MetricCard
            title="Success Rate"
            value={`${analytics.overview.successRate}%`}
            change={3.2}
            icon={Award}
            color="green"
          />
          <MetricCard
            title="Time Saved"
            value={`${Math.floor(analytics.overview.timeSaved / 60)}h`}
            unit={`${analytics.overview.timeSaved % 60}m`}
            change={18.7}
            icon={Clock}
            color="purple"
          />
          <MetricCard
            title="Total Value Quoted"
            value={`$${(analytics.overview.totalValueQuoted / 1000000).toFixed(1)}M`}
            change={24.3}
            icon={DollarSign}
            color="amber"
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Processing Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-2">
              {analytics.trends.daily.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-gray-200 rounded-t flex flex-col justify-end" style={{ height: "200px" }}>
                    <div 
                      className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-500 hover:from-blue-700 hover:to-blue-500"
                      style={{ height: `${(day.count / 30) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 mt-2">{day.date}</span>
                  <span className="text-xs font-semibold">{day.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-center mb-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">94.5</div>
                <div className="text-sm text-gray-500">Overall Score</div>
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="40%"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="40%"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 40 * 0.945} ${2 * Math.PI * 40}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Processing Speed</span>
                <span className="font-semibold">{analytics.performance.processingSpeed}s avg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Extraction Accuracy</span>
                <span className="font-semibold">{analytics.performance.extractionAccuracy}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Automation Rate</span>
                <span className="font-semibold">{analytics.performance.automationRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Error Rate</span>
                <span className="font-semibold text-green-600">{analytics.performance.errorRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Most Extracted Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topMetrics.mostCommonFields.map((field, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700">{field.field}</span>
                    <span className="text-xs text-gray-500">{field.confidence}% conf</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                      style={{ width: `${(field.count / 127) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Contracting Offices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topMetrics.contractingOffices.map((office, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{office.office}</div>
                    <div className="text-xs text-gray-500">{office.count} RFQs</div>
                  </div>
                  <div className="text-lg font-semibold text-blue-600">
                    #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Document Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topMetrics.documentTypes.map((type, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{type.type}</span>
                    <span className="text-sm text-gray-900">{type.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-purple-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${type.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{type.count} documents</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}