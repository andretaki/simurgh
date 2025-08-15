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
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header with Stats */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-blue-600" />
              Simurgh Pro - AI-Powered RFQ Processor
            </h1>
            <p className="text-gray-600 mt-2">
              Process RFQs 10x faster with advanced AI analysis
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/rfq-done">History</Link>
            </Button>
          </div>
        </div>

        {/* Live Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Processed</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalProcessed}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Success Rate</p>
                  <p className="text-2xl font-bold text-green-900">{stats.successRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-medium">Avg. Time</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.averageTime}s</p>
                </div>
                <Zap className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-600 text-sm font-medium">Time Saved</p>
                  <p className="text-2xl font-bold text-amber-900">{stats.timeSaved}m</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Upload Area */}
      <Card className="shadow-xl">
        <CardContent className="p-8">
          {/* Drop Zone */}
          <div
            className={`relative border-3 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              isDragging 
                ? 'border-blue-500 bg-blue-50 scale-102' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
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
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Upload className={`h-16 w-16 ${isDragging ? 'text-blue-500' : 'text-gray-400'} transition-colors`} />
                  {isDragging && (
                    <div className="absolute inset-0 animate-ping">
                      <Upload className="h-16 w-16 text-blue-500 opacity-75" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-700">
                    Drop RFQ PDFs here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Advanced AI will extract all fields with confidence scoring
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Secure Processing
                  </span>
                  <span className="flex items-center gap-1">
                    <Brain className="h-3 w-3" /> AI-Powered
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Real-time Updates
                  </span>
                </div>
              </div>
            </label>
          </div>

          {/* Processing Status */}
          {Object.keys(processingStatus).length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Processing Queue</h3>
              
              {Object.values(processingStatus).map((status) => (
                <Card key={status.fileName} className="overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-600" />
                        <span className="font-medium text-gray-900">{status.fileName}</span>
                        {status.status === 'complete' && status.result && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {status.result.extractedFields?.documentType || 'RFQ'}
                          </span>
                        )}
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
  );
}