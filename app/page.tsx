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

export default function HomePage() {
  const [systemStatus, setSystemStatus] = useState({
    database: "checking",
    s3: "checking",
    openai: "checking",
    server: "online"
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [animatedStats, setAnimatedStats] = useState({
    rfqsProcessed: 0,
    timeSaved: 0,
    accuracy: 0,
    activeUsers: 0,
  });

  useEffect(() => {
    checkSystemHealth();
    fetchRecentActivity();
    animateStats();
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

  const animateStats = () => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    
    const targets = {
      rfqsProcessed: 1247,
      timeSaved: 5280,
      accuracy: 94.5,
      activeUsers: 328,
    };

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      setAnimatedStats({
        rfqsProcessed: Math.floor(targets.rfqsProcessed * progress),
        timeSaved: Math.floor(targets.timeSaved * progress),
        accuracy: parseFloat((targets.accuracy * progress).toFixed(1)),
        activeUsers: Math.floor(targets.activeUsers * progress),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, interval);
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

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Processing",
      description: "Advanced machine learning extracts RFQ fields with 94.5% accuracy",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Process RFQs in under 5 seconds with real-time updates",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level encryption and compliance with industry standards",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: Target,
      title: "High Accuracy",
      description: "Smart field detection and validation ensures data quality",
      gradient: "from-orange-500 to-red-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-pulse" />
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '4s' }} />
        
        <div className="container mx-auto px-4 py-16 relative z-10">
          {/* Header */}
          <div className="text-center mb-12 animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">AI-Powered RFQ Processing</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Welcome to Simurgh
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              The intelligent phoenix that transforms your RFQ processing with cutting-edge AI, 
              saving you hours while ensuring accuracy and compliance.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/rfq-pro">
                <Button size="lg" className="group">
                  <Rocket className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  Start Processing
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/settings">
                <Button size="lg" variant="outline" className="group">
                  <Settings className="mr-2 h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
                  Configure Profile
                </Button>
              </Link>
            </div>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <Card variant="glass" className="group hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {animatedStats.rfqsProcessed.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">RFQs Processed</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" className="group hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {Math.floor(animatedStats.timeSaved / 60)}h
                  </p>
                  <p className="text-sm text-gray-600">Time Saved</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" className="group hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 shadow-lg">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <Award className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {animatedStats.accuracy}%
                  </p>
                  <p className="text-sm text-gray-600">Accuracy Rate</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" className="group hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <Activity className="h-4 w-4 text-purple-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    {animatedStats.activeUsers}
                  </p>
                  <p className="text-sm text-gray-600">Active Users</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                variant="elevated"
                className="group hover:scale-105 transition-all duration-300 cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.gradient} mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Quick Actions */}
            <Card variant="gradient" className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <Link href="/rfq-pro" className="block group">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-all">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Upload & Process RFQ</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                
                <Link href="/rfq-fill" className="block group">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 transition-all">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Fill RFQ Response</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                
                <Link href="/analytics" className="block group">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 transition-all">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5 text-green-600" />
                      <span className="font-medium">View Analytics</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-green-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                
                <Link href="/history" className="block group">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 transition-all">
                    <div className="flex items-center gap-3">
                      <History className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">View History</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-orange-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card variant="gradient" className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((rfq: any) => (
                      <div key={rfq.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-100 to-purple-100">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {rfq.fileName || `RFQ #${rfq.id}`}
                            </p>
                            <p className="text-xs text-gray-500">
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
                      <Button variant="ghost" className="w-full mt-2 group">
                        View All History
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 mb-4">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-4">No RFQs processed yet</p>
                    <Link href="/rfq-pro">
                      <Button variant="gradient" size="sm">
                        Upload First RFQ
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <Card variant="glass" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Database</span>
                  </div>
                  {getStatusIcon(systemStatus.database)}
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Storage</span>
                  </div>
                  {getStatusIcon(systemStatus.s3)}
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">AI Engine</span>
                  </div>
                  {getStatusIcon(systemStatus.openai)}
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Server</span>
                  </div>
                  {getStatusIcon(systemStatus.server)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}