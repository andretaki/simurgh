"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import Link from "next/link";

interface RFQSubmission {
  id: number;
  filename: string;
  completedPdfUrl?: string;
  s3Key: string;
  createdAt: string;
  formData: any;
}

export default function RFQDownloadsPage() {
  const [submissions, setSubmissions] = useState<RFQSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/rfqSubmissions");
      if (!response.ok) throw new Error("Failed to fetch submissions");
      const data = await response.json();
      setSubmissions(data);
    } catch (err) {
      console.error("Error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load submissions",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (submission: RFQSubmission) => {
    try {
      // Get a fresh presigned URL for the completed PDF
      const response = await fetch(
        `/api/s3/download?rfqId=${submission.id}&type=submission`,
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get download URL");
      }

      const { url } = await response.json();

      // Open in new tab
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error downloading:", err);
      alert("Failed to download PDF. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex gap-4 mb-6">
        <Button variant="outline" asChild>
          <Link href="/rfq">Upload New RFQ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rfq-fill">Fill RFQ</Link>
        </Button>
        <Button variant="default" asChild>
          <Link href="/rfq-done">View Completed RFQs</Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Completed RFQs</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {submissions.map((submission) => (
          <Card
            key={submission.id}
            className="hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <CardTitle className="text-lg">
                {submission.formData?.companyName || "Unnamed Company"}
              </CardTitle>
              <p className="text-sm text-gray-500">
                {new Date(submission.createdAt).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <strong>File:</strong> {submission.filename}
                </p>
                {submission.formData?.contactPerson && (
                  <p>
                    <strong>Contact:</strong>{" "}
                    {submission.formData.contactPerson}
                  </p>
                )}
                {submission.formData?.email && (
                  <p>
                    <strong>Email:</strong> {submission.formData.email}
                  </p>
                )}

                <Button
                  onClick={() => handleDownload(submission)}
                  className="w-full mt-4"
                  variant="outline"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download Filled RFQ
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {submissions.length === 0 && !error && (
        <div className="text-center text-gray-500 mt-8">
          No RFQ submissions found
        </div>
      )}
    </div>
  );
}
