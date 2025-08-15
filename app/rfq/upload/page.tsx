"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, CheckCircle } from "lucide-react";

export default function RFQUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        alert("Please upload a PDF file");
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(20);

    try {
      // Get presigned URL
      const urlResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!urlResponse.ok) throw new Error("Failed to get upload URL");

      const { uploadUrl, key } = await urlResponse.json();
      setUploadProgress(40);

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload file");
      setUploadProgress(60);

      // Process the uploaded file
      const processResponse = await fetch("/api/rfq/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key: key,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!processResponse.ok) throw new Error("Failed to process RFQ");

      const { rfqId } = await processResponse.json();
      setUploadProgress(100);

      // Redirect to fill page
      setTimeout(() => {
        router.push(`/rfq/${rfqId}/fill`);
      }, 500);

    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file. Please try again.");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Upload RFQ Document</CardTitle>
            <CardDescription>
              Upload your RFQ PDF and let AI extract the required fields
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
              } ${file ? "bg-green-50 border-green-500" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf"
                onChange={handleChange}
                disabled={uploading}
              />

              {!file ? (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg mb-2">
                    Drag and drop your RFQ PDF here
                  </p>
                  <p className="text-sm text-gray-500 mb-4">or</p>
                  <label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span>Browse Files</span>
                    </Button>
                  </label>
                  <p className="text-xs text-gray-500 mt-4">
                    Supports PDF files up to 50MB
                  </p>
                </>
              ) : (
                <>
                  {uploading ? (
                    <>
                      <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
                      <p className="text-lg mb-2">Processing RFQ...</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <FileText className="w-12 h-12 mx-auto mb-4 text-green-500" />
                      <p className="text-lg mb-2">{file.name}</p>
                      <p className="text-sm text-gray-500 mb-4">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => setFile(null)}
                        >
                          Change File
                        </Button>
                        <Button onClick={handleUpload}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Upload & Process
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Sample RFQs */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Sample RFQs for Testing
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "RFQ-36208263_2686 (1).pdf",
                  "vendorPO-45659232 (1).pdf",
                  "vendorRFQ-36206996 (1).pdf",
                  "vendorRFQ-36208263 (1).pdf",
                ].map((sample) => (
                  <button
                    key={sample}
                    className="text-xs text-blue-600 hover:text-blue-800 text-left p-2 border rounded hover:bg-gray-50"
                    onClick={() => {
                      // Load sample file
                      fetch(`/${sample}`)
                        .then((res) => res.blob())
                        .then((blob) => {
                          const sampleFile = new File([blob], sample, {
                            type: "application/pdf",
                          });
                          setFile(sampleFile);
                        });
                    }}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}