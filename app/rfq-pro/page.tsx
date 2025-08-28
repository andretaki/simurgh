"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Brain,
  Zap,
  Shield,
  TrendingUp,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Search,
  Filter,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface ExtractedField {
  value: any;
  confidence: number;
}

interface ProcessingResult {
  rfqId: number;
  extractedFields: {
    fields: Record<string, ExtractedField>;
    documentType: string;
    complexity: string;
    estimatedResponseTime: string;
  };
}

interface FileProcessingStatus {
  fileName: string;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  result?: ProcessingResult;
  startTime?: number;
  endTime?: number;
  processingSteps?: Array<{
    step: string;
    timestamp: number;
    duration?: number;
  }>;
}

export default function RFQProPage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [processingStatus, setProcessingStatus] = useState<Record<string, FileProcessingStatus>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState({
    totalProcessed: 0,
    averageTime: 0,
    successRate: 100,
    timeSaved: 0,
  });

  // Calculate stats
  useEffect(() => {
    const completed = Object.values(processingStatus).filter(s => s.status === 'complete');
    const failed = Object.values(processingStatus).filter(s => s.status === 'error');
    const totalTime = completed.reduce((acc, s) => {
      if (s.startTime && s.endTime) {
        return acc + (s.endTime - s.startTime);
      }
      return acc;
    }, 0);

    setStats({
      totalProcessed: completed.length,
      averageTime: completed.length > 0 ? Math.round(totalTime / completed.length / 1000) : 0,
      successRate: completed.length + failed.length > 0 
        ? Math.round((completed.length / (completed.length + failed.length)) * 100)
        : 100,
      timeSaved: completed.length * 40, // 40 minutes saved per RFQ
    });
  }, [processingStatus]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );

    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid files",
        description: "Please upload PDF files only"
      });
    }
  }, []);

  const processFiles = async (filesToProcess: File[]) => {
    for (const file of filesToProcess) {
      const startTime = Date.now();
      
      // Initialize status
      setProcessingStatus(prev => ({
        ...prev,
        [file.name]: {
          fileName: file.name,
          status: 'uploading',
          progress: 0,
          message: 'Preparing upload...',
          startTime,
          processingSteps: [{ step: 'Started', timestamp: startTime }]
        }
      }));

      try {
        // Get presigned URL
        const uploadResponse = await fetch('/api/s3/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            rfqId: `temp_${Date.now()}`
          })
        });

        if (!uploadResponse.ok) throw new Error('Failed to get upload URL');
        const { url: presignedUrl, key } = await uploadResponse.json();

        // Upload file
        setProcessingStatus(prev => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            progress: 20,
            message: 'Uploading to cloud storage...',
            processingSteps: [
              ...(prev[file.name].processingSteps || []),
              { step: 'Uploading', timestamp: Date.now() }
            ]
          }
        }));

        const uploadResult = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'application/pdf' }
        });

        if (!uploadResult.ok) throw new Error('Failed to upload file');

        // Process with SSE
        setProcessingStatus(prev => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            status: 'processing',
            progress: 40,
            message: 'AI analyzing document...'
          }
        }));

        const response = await fetch('/api/rfq/process-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            s3Key: key,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type
          })
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.status === 'complete') {
                    setProcessingStatus(prev => ({
                      ...prev,
                      [file.name]: {
                        ...prev[file.name],
                        status: 'complete',
                        progress: 100,
                        message: 'Processing complete!',
                        result: {
                          rfqId: data.rfqId,
                          extractedFields: data.extractedFields
                        },
                        endTime: Date.now(),
                        processingSteps: [
                          ...(prev[file.name].processingSteps || []),
                          { step: 'Completed', timestamp: Date.now() }
                        ]
                      }
                    }));

                    toast({
                      title: "✅ RFQ Processed",
                      description: `${file.name} - ${data.documentType} (${data.complexity} complexity)`,
                    });
                  } else if (data.status === 'error') {
                    throw new Error(data.message);
                  } else {
                    setProcessingStatus(prev => ({
                      ...prev,
                      [file.name]: {
                        ...prev[file.name],
                        progress: data.progress || prev[file.name].progress,
                        message: data.message,
                        processingSteps: [
                          ...(prev[file.name].processingSteps || []),
                          { step: data.message, timestamp: Date.now() }
                        ]
                      }
                    }));
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        }
      } catch (error) {
        setProcessingStatus(prev => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            status: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : 'Processing failed',
            endTime: Date.now()
          }
        }));

        toast({
          variant: "destructive",
          title: "Processing Failed",
          description: file.name
        });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf'
    );
    
    if (selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const exportToExcel = async (rfqId: number) => {
    toast({
      title: "Export Started",
      description: "Generating Excel file..."
    });
    // Implementation would go here
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/20">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Enhanced Header with Floating Elements */}
        <div className="relative mb-8">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-float" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-400 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
          
          <div className="relative flex justify-between items-center mb-6 animate-fadeIn">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 mb-4">
                <Zap className="h-4 w-4 text-purple-600 animate-pulse" />
                <span className="text-sm font-semibold text-purple-900">Advanced AI Processing</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold mb-3 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                RFQ Pro Processing Center
              </h1>
              <p className="text-lg text-gray-600">
                Transform your RFQs with cutting-edge AI technology
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="glass" className="group" asChild>
                <Link href="/settings">
                  <Shield className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                  Settings
                </Link>
              </Button>
              <Button variant="secondary" className="group" asChild>
                <Link href="/rfq-done">
                  <Clock className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
                  History
                </Link>
              </Button>
            </div>
          </div>

          {/* Enhanced Live Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card variant="glass" glow="primary" className="group hover:scale-105 transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Documents Processed</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                      {stats.totalProcessed}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">+12% today</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg group-hover:shadow-xl transition-shadow">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" glow="success" className="group hover:scale-105 transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Success Rate</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {stats.successRate}%
                    </p>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${stats.successRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg group-hover:shadow-xl transition-shadow">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" glow="secondary" className="group hover:scale-105 transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Processing Speed</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {stats.averageTime}s
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Zap className="h-3 w-3 text-purple-500 animate-pulse" />
                      <span className="text-xs text-purple-600 font-medium">Lightning fast</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg group-hover:shadow-xl transition-shadow">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" glow="warning" className="group hover:scale-105 transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Time Saved</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                      {Math.floor(stats.timeSaved / 60)}h
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="h-3 w-3 text-orange-500" />
                      <span className="text-xs text-orange-600 font-medium">{stats.timeSaved % 60}m today</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 shadow-lg group-hover:shadow-xl transition-shadow">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced Main Upload Area */}
        <Card variant="elevated" className="shadow-2xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 animate-pulse" />
          <CardContent className="p-8">
            {/* Enhanced Drop Zone with Animations */}
            <div
              className={`relative border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                isDragging 
                  ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-blue-50 scale-105 shadow-xl' 
                  : 'border-gray-300 hover:border-purple-400 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/30'
              }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload-pro"
            />
              <label htmlFor="file-upload-pro" className="cursor-pointer">
                <div className="flex flex-col items-center space-y-6">
                  <div className="relative">
                    <div className={`p-6 rounded-full bg-gradient-to-r ${isDragging ? 'from-purple-500 to-blue-500' : 'from-gray-200 to-gray-300'} transition-all duration-300 group-hover:from-purple-400 group-hover:to-blue-400`}>
                      <Upload className={`h-12 w-12 ${isDragging ? 'text-white' : 'text-gray-600'} transition-colors group-hover:text-white`} />
                    </div>
                    {isDragging && (
                      <div className="absolute inset-0 animate-ping">
                        <div className="p-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 opacity-50">
                          <Upload className="h-12 w-12 text-transparent" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      Drop RFQ PDFs Here
                    </p>
                    <p className="text-gray-600">
                      or click to browse your files
                    </p>
                    <p className="text-sm text-gray-500 mt-3">
                      Supports multiple files • PDF format • Max 50MB each
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 px-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-blue-200">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Bank-Level Security</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-purple-200">
                      <Brain className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">GPT-5 Powered</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-100 to-green-200">
                      <Zap className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Real-time Processing</span>
                    </div>
                  </div>
                </div>
              </label>
            </div>

            {/* Enhanced Processing Status */}
            {Object.keys(processingStatus).length > 0 && (
              <div className="mt-10 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Processing Queue</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Active Tasks:</span>
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-bold">
                      {Object.keys(processingStatus).length}
                    </span>
                  </div>
                </div>
              
                {Object.values(processingStatus).map((status, index) => (
                  <Card 
                    key={status.fileName} 
                    variant="elevated" 
                    className="overflow-hidden animate-fadeIn"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="bg-gradient-to-r from-white via-purple-50/30 to-blue-50/30 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${
                            status.status === 'complete' ? 'from-green-500 to-emerald-500' :
                            status.status === 'error' ? 'from-red-500 to-pink-500' :
                            status.status === 'processing' ? 'from-blue-500 to-purple-500' :
                            'from-gray-400 to-gray-500'
                          } shadow-lg`}>
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-900">{status.fileName}</span>
                            {status.status === 'complete' && status.result && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 text-xs rounded-full font-medium">
                                  {status.result.extractedFields?.documentType || 'RFQ'}
                                </span>
                                <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 text-xs rounded-full font-medium">
                                  {status.result.extractedFields?.complexity || 'Standard'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      <div className="flex items-center gap-2">
                        {status.status === 'processing' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {status.status === 'complete' && (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => exportToExcel(status.result?.rfqId || 0)}
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {status.status === 'error' && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{status.message}</span>
                        <span>{status.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            status.status === 'error' 
                              ? 'bg-red-500' 
                              : status.status === 'complete'
                              ? 'bg-green-500'
                              : 'bg-blue-500 animate-pulse'
                          }`}
                          style={{ width: `${status.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Extracted Fields Preview */}
                    {status.status === 'complete' && status.result?.extractedFields?.fields && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Extracted Fields (with confidence)
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(status.result.extractedFields.fields)
                            .slice(0, 6)
                            .map(([key, field]: [string, any]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-600">{key}:</span>
                                <span className={`font-medium ${getConfidenceColor(field.confidence)}`}>
                                  {field.confidence}%
                                </span>
                              </div>
                            ))}
                        </div>
                        {status.result.extractedFields.estimatedResponseTime && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <span className="text-xs text-gray-600">
                              Estimated response time: {status.result.extractedFields.estimatedResponseTime}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Processing Time */}
                    {status.endTime && status.startTime && (
                      <div className="mt-2 text-xs text-gray-500">
                        Processed in {((status.endTime - status.startTime) / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}