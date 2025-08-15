"use client";

import React, { useState, ChangeEvent, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import Link from "next/link";

// Interface for processed results (as returned by the DB/API)
interface ProcessedResult {
  id: number;
  filename: string;
  s3Url: string;
  summary: string;
  s3Key: string;
  createdAt: string;
  presignedGetUrl?: string;
  message?: string;
}

// Enum for progress status
enum ProgressStatus {
  Pending = "pending",
  Uploading = "uploading",
  Processing = "processing",
  Complete = "complete",
  Error = "error",
}

// Interface for each file's progress
interface FileProgress {
  status: ProgressStatus;
  message?: string;
}

const RFQProcessor = () => {
  const { toast } = useToast();

  // State variables
  const [files, setFiles] = useState<File[]>([]);
  const [fileProgress, setFileProgress] = useState<{
    [key: string]: FileProgress;
  }>({});
  const [existingSummaries, setExistingSummaries] = useState<ProcessedResult[]>(
    [],
  );
  const [isFetchingSummaries, setIsFetchingSummaries] =
    useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [expandedRFQId, setExpandedRFQId] = useState<number | null>(null);

  // Handle file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file) => file.type === "application/pdf",
      );

      if (selectedFiles.length !== e.target.files.length) {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description:
            "Only PDF files are allowed. Non-PDF files were ignored.",
        });
      }

      if (selectedFiles.length === 0) {
        setError("Please select one or more PDF files.");
        return;
      }

      // Check for duplicate filenames *within the new selection*
      const currentFilenames = files.map((f) => f.name);
      const newFilenames = selectedFiles.map((file) => file.name);
      const combinedFilenames = [...currentFilenames, ...newFilenames];
      const duplicates = newFilenames.filter(
        (name, index, self) =>
          self.indexOf(name) !== index || currentFilenames.includes(name),
      );

      if (duplicates.length > 0) {
        const uniqueDuplicates = [...new Set(duplicates)];
        setError(
          `Duplicate filenames detected: ${uniqueDuplicates.join(", ")}. Please ensure all filenames are unique.`,
        );
        toast({
          variant: "destructive",
          title: "Duplicate Files",
          description: `Duplicate filenames detected: ${uniqueDuplicates.join(", ")}.`,
        });
        return;
      }

      // Add new files and initialize progress
      const newFiles = [...files, ...selectedFiles];
      setFiles(newFiles);

      const newProgress: { [key: string]: FileProgress } = {};
      selectedFiles.forEach((file) => {
        newProgress[file.name] = {
          status: ProgressStatus.Pending,
          message: "Ready to upload",
        };
      });
      setFileProgress((prev) => ({ ...prev, ...newProgress }));
      setError("");
      e.target.value = ""; // Reset file input
    }
  };

  // Add these new handlers for drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add("border-blue-500", "bg-blue-50");
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-blue-500", "bg-blue-50");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-blue-500", "bg-blue-50");

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf",
    );

    if (droppedFiles.length === 0) {
      setError("Please drop PDF files only.");
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Only PDF files were dropped.",
      });
      return;
    }

    // Use the same duplicate check logic as in handleFileChange
    const currentFilenames = files.map((f) => f.name);
    const newFilenames = droppedFiles.map((file) => file.name);
    const combinedFilenames = [...currentFilenames, ...newFilenames];
    const duplicates = newFilenames.filter(
      (name, index, self) =>
        self.indexOf(name) !== index || currentFilenames.includes(name),
    );

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      setError(
        `Duplicate filenames detected: ${uniqueDuplicates.join(", ")}. Please ensure all filenames are unique.`,
      );
      toast({
        variant: "destructive",
        title: "Duplicate Files",
        description: `Duplicate filenames detected: ${uniqueDuplicates.join(", ")}.`,
      });
      return;
    }

    // Add new files and initialize progress
    const newFiles = [...files, ...droppedFiles];
    setFiles(newFiles);

    const newProgress: { [key: string]: FileProgress } = {};
    droppedFiles.forEach((file) => {
      newProgress[file.name] = {
        status: ProgressStatus.Pending,
        message: "Ready to upload",
      };
    });
    setFileProgress((prev) => ({ ...prev, ...newProgress }));
    setError("");
  };

  // Helper function to fetch existing summaries
  const fetchSummaries = async () => {
    setIsFetchingSummaries(true);
    setError("");
    try {
      const response = await fetch("/api/rfq-summary");
      if (!response.ok) {
        throw new Error(
          `Failed to fetch existing summaries (${response.status}).`,
        );
      }
      let data: ProcessedResult[] = await response.json();

      // Sort by creation date descending
      data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Fetch presigned GET URLs for *all* summaries
      const summariesWithUrls = await Promise.all(
        data.map(async (summary) => {
          try {
            if (!summary.s3Key) {
              console.warn(
                `RFQ ID ${summary.id} (${summary.filename}) is missing s3Key. Cannot fetch presigned URL.`,
              );
              return {
                ...summary,
                presignedGetUrl: "#",
                message: "Original file key missing",
              };
            }
            const presignedResponse = await fetch(
              `/api/s3/download?rfqId=${summary.id}`,
            );
            if (!presignedResponse.ok) {
              const errorText = await presignedResponse.text();
              console.error(
                `Failed to get presigned URL for RFQ ID ${summary.id} (${response.status}): ${errorText}`,
              );
              throw new Error(`Failed to get URL (${response.status})`);
            }
            const presignedData = await presignedResponse.json();
            return { ...summary, presignedGetUrl: presignedData.url };
          } catch (err) {
            console.error(
              `Error fetching presigned URL for RFQ ID ${summary.id}:`,
              err,
            );
            return {
              ...summary,
              presignedGetUrl: "#",
              message: "Could not get view link",
            };
          }
        }),
      );

      setExistingSummaries(summariesWithUrls);
    } catch (err: any) {
      console.error("Error fetching summaries:", err);
      setError(`Failed to load existing summaries: ${err.message}`);
      toast({
        variant: "destructive",
        title: "Error Loading Summaries",
        description: err.message || "Could not fetch existing RFQ summaries.",
      });
    } finally {
      setIsFetchingSummaries(false);
    }
  };

  // Fetch existing summaries on component mount
  useEffect(() => {
    fetchSummaries();
  }, []);

  // Upload file to S3 and return the S3 URL and Key
  const uploadToS3 = async (
    file: File,
  ): Promise<{ s3Url: string; key: string }> => {
    // Generate a temporary rfqId for new uploads
    const tempRfqId = `temp_${Date.now()}`;

    const response = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        rfqId: tempRfqId,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Failed to get S3 upload URL" }));
      throw new Error(errorData.error || "Failed to get upload URL");
    }

    const { url: presignedPutUrl, key } = await response.json();

    // Upload the file to S3 using the presigned URL
    const uploadResponse = await fetch(presignedPutUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/pdf" },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("S3 Upload Error Status:", uploadResponse.status);
      console.error("S3 Upload Error Text:", errorText);
      throw new Error(
        `Failed to upload ${file.name} to S3 (${uploadResponse.status}). Check CORS configuration and permissions.`,
      );
    }

    return { s3Url: presignedPutUrl.split("?")[0], key };
  };

  // Trigger backend processing
  const triggerBackendProcessing = async (
    s3Key: string,
    filename: string,
  ): Promise<ProcessedResult> => {
    console.log(`Triggering backend processing for key: ${s3Key}`);
    const response = await fetch("/api/rfq/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key, filename }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Processing failed with non-JSON response" }));
      console.error(
        `Backend processing failed (${response.status}):`,
        errorData.error,
      );
      throw new Error(
        errorData.error || `Backend processing failed for ${filename}`,
      );
    }

    const result = await response.json();
    console.log(`Backend processing successful for key: ${s3Key}`);
    
    // Log extracted fields if available
    if (result.extractedFields) {
      console.log(`Extracted fields for ${filename}:`, result.extractedFields);
    }
    
    return result.summary as ProcessedResult;
  };

  // Modified handleSubmit
  const handleSubmit = async () => {
    const filesToProcess = files.filter(
      (file) =>
        fileProgress[file.name]?.status === ProgressStatus.Pending ||
        fileProgress[file.name]?.status === ProgressStatus.Error,
    );

    if (filesToProcess.length === 0) {
      toast({
        title: "No Files to Process",
        description: "Please select new PDF files to upload.",
      });
      return;
    }

    setError("");
    setIsProcessing(true);

    const processingPromises = filesToProcess.map(async (file) => {
      try {
        // Update status to Uploading
        setFileProgress((prev) => ({
          ...prev,
          [file.name]: {
            status: ProgressStatus.Uploading,
            message: "Uploading...",
          },
        }));

        // 1. Upload to S3
        const { key } = await uploadToS3(file);
        toast({
          title: `📤 Uploaded ${file.name}`,
          description: "Starting analysis...",
        });

        // Update status to Processing
        setFileProgress((prev) => ({
          ...prev,
          [file.name]: {
            status: ProgressStatus.Processing,
            message: "Analyzing...",
          },
        }));

        // 2. Trigger Backend Processing
        await triggerBackendProcessing(key, file.name);

        // Update status to Complete
        setFileProgress((prev) => ({
          ...prev,
          [file.name]: {
            status: ProgressStatus.Complete,
            message: "Analysis complete",
          },
        }));
        toast({
          variant: "default",
          title: `✅ Processed ${file.name}`,
          description: "Summary generated successfully.",
        });
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        const errorMessage = err.message || `Failed to process ${file.name}`;
        setFileProgress((prev) => ({
          ...prev,
          [file.name]: { status: ProgressStatus.Error, message: errorMessage },
        }));
        toast({
          variant: "destructive",
          title: `❌ Error processing ${file.name}`,
          description: errorMessage,
        });
      }
    });

    // Wait for all processing attempts to settle
    await Promise.allSettled(processingPromises);

    setIsProcessing(false);

    // Refresh the list of summaries after processing is done
    console.log("Refreshing summaries list after processing...");
    await fetchSummaries();
  };

  // Function to get the appropriate icon based on status
  const getProgressIcon = (status: ProgressStatus) => {
    switch (status) {
      case ProgressStatus.Uploading:
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case ProgressStatus.Processing:
        return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />;
      case ProgressStatus.Complete:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case ProgressStatus.Error:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case ProgressStatus.Pending:
      default:
        return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  // Function to get status text
  const getProgressText = (status: ProgressStatus) => {
    switch (status) {
      case ProgressStatus.Uploading:
        return "Uploading";
      case ProgressStatus.Processing:
        return "Processing";
      case ProgressStatus.Complete:
        return "Complete";
      case ProgressStatus.Error:
        return "Error";
      case ProgressStatus.Pending:
        return "Pending";
      default:
        return "Waiting";
    }
  };

  // Toggle expansion of RFQ summary card
  const toggleExpansion = (id: number) => {
    setExpandedRFQId((prev) => (prev === id ? null : id));
  };

  // Function to remove a file before upload
  const removeFile = (fileNameToRemove: string) => {
    setFiles((prevFiles) =>
      prevFiles.filter((file) => file.name !== fileNameToRemove),
    );
    setFileProgress((prevProgress) => {
      const { [fileNameToRemove]: _, ...rest } = prevProgress;
      return rest;
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Navigation Buttons */}
      <div className="flex gap-4 mb-6">
        <Button variant="default" asChild>
          <Link href="/rfq">Upload New RFQ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rfq-fill">Fill RFQ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rfq-done">View Completed RFQs</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/settings">Company Settings</Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            RFQ Document Processor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* File Upload Section */}
            <div
              className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors duration-200 ${files.length > 0 ? "bg-gray-50" : "hover:border-blue-400 hover:bg-blue-50"}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".pdf"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-2 text-gray-600"
              >
                <Upload className="h-10 w-10 text-gray-400" />
                <span className="text-sm font-medium">
                  Click to upload or drag & drop PDF files here
                </span>
                <span className="text-xs text-gray-500">
                  Maximum file size: 50MB each
                </span>
              </label>
            </div>

            {/* Global Error Alert */}
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Selected Files and Progress */}
            {files.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold mb-2">
                  Selected Files ({files.length}):
                </h3>
                {files.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md shadow-sm"
                  >
                    <div className="flex items-center space-x-3 flex-grow min-w-0">
                      {getProgressIcon(
                        fileProgress[file.name]?.status ||
                          ProgressStatus.Pending,
                      )}
                      <div className="flex flex-col min-w-0">
                        <span
                          className="text-sm font-medium text-gray-800 truncate"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                        <span
                          className={`text-xs ${fileProgress[file.name]?.status === ProgressStatus.Error ? "text-red-600" : "text-gray-500"}`}
                        >
                          {fileProgress[file.name]?.message ||
                            getProgressText(
                              fileProgress[file.name]?.status ||
                                ProgressStatus.Pending,
                            )}
                        </span>
                      </div>
                    </div>
                    {/* Remove Button - only show if file is pending or has errored */}
                    {(fileProgress[file.name]?.status ===
                      ProgressStatus.Pending ||
                      fileProgress[file.name]?.status ===
                        ProgressStatus.Error) &&
                      !isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-red-600 hover:bg-red-100 ml-2 px-2"
                          onClick={() => removeFile(file.name)}
                          aria-label={`Remove ${file.name}`}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                ))}
              </div>
            )}

            {/* Process Documents Button */}
            {files.length > 0 && (
              <Button
                onClick={handleSubmit}
                disabled={
                  isProcessing ||
                  files.every(
                    (f) =>
                      fileProgress[f.name]?.status === ProgressStatus.Complete,
                  )
                }
                className="w-full py-3 text-base font-semibold"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Files...
                  </>
                ) : files.some(
                    (f) =>
                      fileProgress[f.name]?.status === ProgressStatus.Error,
                  ) ? (
                  "Retry Processing Errored Files"
                ) : (
                  `Process ${files.filter((f) => fileProgress[f.name]?.status === ProgressStatus.Pending).length} New File(s)`
                )}
              </Button>
            )}

            {/* Existing Summaries Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-xl font-bold mb-4">Existing RFQ Summaries</h3>
              {isFetchingSummaries ? (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                  <span className="ml-3 text-gray-600">
                    Loading summaries...
                  </span>
                </div>
              ) : existingSummaries.length === 0 && !error ? (
                <p className="text-center text-gray-500 py-4">
                  No existing RFQ summaries found.
                </p>
              ) : (
                <div className="space-y-4">
                  {existingSummaries.map((result) => (
                    <Card
                      key={result.id}
                      className="overflow-hidden border rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardHeader
                        className="bg-gray-50 p-4 cursor-pointer flex justify-between items-center"
                        onClick={() => toggleExpansion(result.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                          <div className="flex-grow min-w-0">
                            <CardTitle
                              className="text-base font-semibold text-gray-800 truncate"
                              title={result.filename}
                            >
                              {result.filename}
                            </CardTitle>
                            <p className="text-xs text-gray-500 mt-1">
                              Uploaded:{" "}
                              {new Date(result.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {expandedRFQId === result.id ? (
                            <ChevronUp className="h-5 w-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-600" />
                          )}
                        </div>
                      </CardHeader>
                      {expandedRFQId === result.id && (
                        <CardContent className="p-6 border-t bg-white">
                          {/* Improved Summary Display */}
                          <div className="prose prose-sm max-w-none text-gray-700 mb-4">
                            {result.summary
                              .split("\n")
                              .map((paragraph, idx) => {
                                const trimmed = paragraph.trim();
                                if (!trimmed) return null;

                                if (
                                  trimmed.startsWith("**") &&
                                  trimmed.endsWith("**")
                                ) {
                                  return (
                                    <h4
                                      key={idx}
                                      className="text-sm font-semibold text-gray-900 mt-3 mb-1"
                                    >
                                      {trimmed.slice(2, -2)}
                                    </h4>
                                  );
                                } else if (/^[\w\s-]+:/.test(trimmed)) {
                                  const [key, ...valueParts] =
                                    trimmed.split(":");
                                  const value = valueParts.join(":").trim();
                                  return (
                                    <div
                                      key={idx}
                                      className="flex text-xs mb-1"
                                    >
                                      <span className="font-medium text-gray-600 w-28 flex-shrink-0">
                                        {key}:
                                      </span>
                                      <span className="text-gray-800">
                                        {value}
                                      </span>
                                    </div>
                                  );
                                } else if (trimmed.startsWith("- ")) {
                                  return (
                                    <p
                                      key={idx}
                                      className="text-xs my-1 ml-4 before:content-['•'] before:mr-2"
                                    >
                                      {trimmed.substring(2)}
                                    </p>
                                  );
                                }
                                return (
                                  <p key={idx} className="text-xs my-2">
                                    {trimmed}
                                  </p>
                                );
                              })}
                          </div>
                          {/* View PDF Link */}
                          {result.presignedGetUrl &&
                          result.presignedGetUrl !== "#" ? (
                            <a
                              href={result.presignedGetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                              View Original PDF
                            </a>
                          ) : (
                            <span className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600">
                              {result.message || "Cannot view PDF"}
                            </span>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RFQProcessor;
