"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import dynamic from "next/dynamic";
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FormData } from "@/types/form";
import { generatePDFWithOverlay } from "../../utils/overlayPDFText";
import { cleanSummary } from "@/utils/cleanSummary";
import Link from "next/link";
import { Loader2, Download, Zap, Settings } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// The shape of each RFQ from /api/rfq-summary
interface RFQSummary {
  id: number;
  filename: string;
  summary: string;
  createdAt: string;
  s3Key: string;
}

// Updated form state based on formfields.txt
const defaultFormState: FormData = {
  priceFirmUntil: "",
  quoteRefNum: "",
  paymentTerms: "",
  paymentTermsOther: "",
  complimentaryFreight: "Off",
  ppaByVender: "Off",
  fob: "",
  purchaseOrderMinimum: "",
  // priceBreaks: "", // <-- Incorrect: This is a string
  priceBreaks: [], // <-- Correct: Initialize as an empty array
  SAMUEI: "",
  CAGE: "",
  SAM: "",
  NAICS: "",
  NAICSSIZE: "",
  BT: "",
  smalldisad: "Off",
  HubZone: "Off",
  womenowned: "Off",
  vetowned: "Off",
  sdvet: "Off",
  hist: "Off",
  ANC: "Off",
  other: "Off",
  size: "",
  noBidCode: "",
  noBidReason: "",
  "unitCost-1": "",
  "deliveryDays-1": "",
  "madeIn-1": "",
  "madeInOther-1": "",
  "exceptionNote-1": "",
  "noBidReason-1": "",
  "noBidOther-1": "",
  "polchemQuestion1-1": "",
  "polchemQuestion2-1": "",
  "polchemQuestion3-1": "",
};
export default function RFQFormEnhanced() {
  const [availableRFQs, setAvailableRFQs] = useState<RFQSummary[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQSummary | null>(null);
  const [originalPdfPresignedUrl, setOriginalPdfPresignedUrl] = useState<
    string | null
  >(null);
  const [filledPdfDownloadUrl, setFilledPdfDownloadUrl] = useState<
    string | null
  >(null);
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>(defaultFormState);
  const [isFetchingRFQs, setIsFetchingRFQs] = useState(false);
  const [isFetchingOrigUrl, setIsFetchingOrigUrl] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // 1) Fetch list of available RFQs from /api/rfq-summary
  useEffect(() => {
    const fetchRFQs = async () => {
      setIsFetchingRFQs(true);
      try {
        const response = await fetch("/api/rfq-summary");
        if (response.ok) {
          const data: RFQSummary[] = await response.json();
          data.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setAvailableRFQs(data);
        } else {
          console.error("Failed to fetch RFQs:", response.statusText);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load available RFQs.",
          });
        }
      } catch (error) {
        console.error("Error fetching RFQs:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not connect to fetch RFQs.",
        });
      } finally {
        setIsFetchingRFQs(false);
      }
    };
    fetchRFQs();
  }, []);

  // Fetch presigned GET URL for the *original* PDF whenever selectedRFQ changes
  useEffect(() => {
    const fetchPresignedUrl = async () => {
      if (selectedRFQ) {
        setIsFetchingOrigUrl(true);
        setOriginalPdfPresignedUrl(null);
        setFilledPdfDownloadUrl(null);
        try {
          console.log(
            "Fetching presigned URL for original RFQ:",
            selectedRFQ.id,
          );
          const presignedUrlResp = await fetch(
            `/api/s3/download?rfqId=${selectedRFQ.id}`,
          );

          if (!presignedUrlResp.ok) {
            const errorText = await presignedUrlResp.text();
            console.error("Failed to fetch presigned URL for original PDF:", {
              status: presignedUrlResp.status,
              error: errorText,
            });
            throw new Error(
              `Failed to fetch original PDF URL: ${errorText || presignedUrlResp.statusText}`,
            );
          }

          const { url: presignedGetUrl } = await presignedUrlResp.json();
          console.log("Successfully received presigned URL for original PDF");

          try {
            new URL(presignedGetUrl);
            setOriginalPdfPresignedUrl(presignedGetUrl);
          } catch (e) {
            console.error("Received invalid URL:", presignedGetUrl);
            throw new Error("Received invalid presigned URL from server");
          }
        } catch (error: any) {
          console.error("Error in fetchPresignedUrl:", error);
          setOriginalPdfPresignedUrl(null);
          toast({
            variant: "destructive",
            title: "Error",
            description: `Error fetching the original RFQ document: ${error.message}`,
          });
        } finally {
          setIsFetchingOrigUrl(false);
        }
      } else {
        setOriginalPdfPresignedUrl(null);
      }
    };

    fetchPresignedUrl();
  }, [selectedRFQ, toast]);

  // Handle changes for text/checkbox/radio inputs
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, type, value } = e.target;

    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked ? "On" : "Off",
      }));
    } else if (type === "radio") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Function to generate and save the filled PDF
  const generateAndSaveFilledPdf = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Client: Starting PDF generation and saving process");

    if (!selectedRFQ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No RFQ selected.",
      });
      return;
    }

    if (!formData.priceFirmUntil || !formData.CAGE) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill in at least Price Firm Until and CAGE code.",
      });
      return;
    }

    setIsGeneratingPdf(true);
    setFilledPdfDownloadUrl(null);

    try {
      console.log("Calling /api/generate-filled-pdf...");
      const response = await fetch("/api/generate-filled-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqId: selectedRFQ.id,
          formData: formData,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({
            error: `HTTP ${response.status} - ${response.statusText}`,
          }));
        console.error("PDF Generation Error:", errorData);
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      const { url, submissionId } = await response.json();
      setFilledPdfDownloadUrl(url);
      console.log(
        `PDF generated and saved. Submission ID: ${submissionId}, Download URL ready.`,
      );

      toast({
        title: "✅ Success!",
        description: `Filled RFQ "${selectedRFQ.filename}" generated and saved successfully.`,
        action: (
          <Button variant="outline" size="sm" asChild>
            <Link href="/rfq-done">View Completed</Link>
          </Button>
        ),
      });
    } catch (error: any) {
      console.error("Error during PDF generation/saving:", error);
      toast({
        variant: "destructive",
        title: "PDF Generation Failed",
        description: error.message || "An unknown error occurred.",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Updated fillTestData function for relevant fields
  const fillTestData = () => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    setFormData({
      ...defaultFormState,
      priceFirmUntil: thirtyDaysFromNow.toISOString().split("T")[0],
      paymentTermsOther: "Net 30",
      quoteRefNum: `TEST-${Math.floor(Math.random() * 10000)}`,
      fob: "Destination",
      purchaseOrderMinimum: "100",
      complimentaryFreight: "Off",
      ppaByVender: "On",
      SAMUEI: "TESTSAMUEI123",
      CAGE: "1LT50",
      SAM: "Yes",
      NAICS: "424690",
      NAICSSIZE: "150",
      BT: "Small",
      smalldisad: "On",
      womenowned: "On",
      vetowned: "Off",
      sdvet: "Off",
      hist: "Off",
      ANC: "Off",
      HubZone: "Off",
      other: "Off",
      size: "Option2",
      noBidCode: "",
      noBidReason: "",
      "noBidReason-1": "",
      "noBidOther-1": "",
      "unitCost-1": "123.45",
      "deliveryDays-1": "30",
      "madeIn-1": "USA",
    });
    toast({
      title: "Test Data Filled",
      description: "Form populated with sample data.",
    });
  };

  // Auto-fill from company profile
  const fillFromProfile = async () => {
    try {
      // Fetch company profile
      const profileResponse = await fetch("/api/company-profile");
      if (!profileResponse.ok) {
        if (profileResponse.status === 404) {
          toast({
            variant: "destructive",
            title: "No Company Profile",
            description: "Please set up your company profile first.",
            action: (
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="w-4 h-4 mr-1" />
                  Go to Settings
                </Link>
              </Button>
            ),
          });
          return;
        }
        throw new Error("Failed to fetch company profile");
      }

      const profile = await profileResponse.json();
      
      if (!profile) {
        toast({
          variant: "destructive",
          title: "Profile Not Found",
          description: "Please set up your company profile in settings.",
        });
        return;
      }

      // Calculate price firm until (30 days from now)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Auto-fill form with company profile data
      setFormData(prev => ({
        ...prev,
        // Quote details
        priceFirmUntil: thirtyDaysFromNow.toISOString().split("T")[0],
        paymentTerms: profile.defaultPaymentTerms || prev.paymentTerms,
        paymentTermsOther: profile.defaultPaymentTermsOther || prev.paymentTermsOther,
        
        // Shipping
        fob: profile.defaultFob || prev.fob,
        purchaseOrderMinimum: profile.defaultPurchaseOrderMin || prev.purchaseOrderMinimum,
        complimentaryFreight: profile.defaultComplimentaryFreight ? "On" : "Off",
        ppaByVender: profile.defaultPpaByVendor ? "On" : "Off",
        
        // Business info
        CAGE: profile.cageCode || prev.CAGE,
        SAMUEI: profile.samUei || prev.SAMUEI,
        SAM: profile.samRegistered ? "Yes" : "No",
        NAICS: profile.naicsCode || prev.NAICS,
        NAICSSIZE: profile.naicsSize || prev.NAICSSIZE,
        BT: profile.businessType || prev.BT,
        
        // Classifications
        smalldisad: profile.smallDisadvantaged ? "On" : "Off",
        womenowned: profile.womanOwned ? "On" : "Off",
        vetowned: profile.veteranOwned ? "On" : "Off",
        sdvet: profile.serviceDisabledVetOwned ? "On" : "Off",
        HubZone: profile.hubZone ? "On" : "Off",
        hist: profile.historicallyUnderutilized ? "On" : "Off",
        ANC: profile.alaskaNativeCorp ? "On" : "Off",
        
        // Keep existing values for fields not in profile
        quoteRefNum: `AC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
      }));

      toast({
        title: "✅ Profile Data Loaded",
        description: `Auto-filled from ${profile.companyName} profile. Just add pricing!`,
      });
    } catch (error) {
      console.error("Error loading company profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load company profile data.",
      });
    }
  };

  // Render the full form if an RFQ is selected
  const renderForm = () => (
    <div className="container mx-auto p-4 bg-white min-h-screen">
      {/* Navigation and Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <Button variant="outline" size="sm" asChild>
          <Link href="/rfq">Upload New RFQ</Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link href="/rfq-fill">Fill RFQ</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/rfq-done">View Completed RFQs</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings">
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </Link>
        </Button>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedRFQ(null)}
          >
            Select Different RFQ
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={fillFromProfile}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Zap className="w-4 h-4 mr-1" />
            Fill From Profile
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fillTestData}
            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300"
          >
            Fill Test Data
          </Button>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-4">
        Fill RFQ:{" "}
        <span className="font-normal text-gray-700">
          {selectedRFQ?.filename}
        </span>
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* RFQ Summary Panel */}
        <div className="lg:w-1/3 p-4 border bg-gray-50 rounded-lg shadow-sm sticky top-4 h-fit">
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h2 className="text-lg font-semibold text-gray-800">RFQ Summary</h2>
            {isFetchingOrigUrl ? (
              <span className="text-sm text-gray-500 flex items-center">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Link...
              </span>
            ) : originalPdfPresignedUrl ? (
              <a
                href={originalPdfPresignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                View Original
              </a>
            ) : (
              <span className="text-sm text-red-500">No view link</span>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 mb-4 max-h-96 overflow-y-auto">
            {selectedRFQ?.summary ? (
              cleanSummary(selectedRFQ.summary)
                .cleanedSummary.split("\n")
                .map((line: string, index: number) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
                    return (
                      <h4
                        key={index}
                        className="text-sm font-semibold text-gray-900 mt-3 mb-1"
                      >
                        {trimmed.slice(2, -2)}
                      </h4>
                    );
                  } else if (/^[\w\s-]+:/.test(trimmed)) {
                    const [key, ...valueParts] = trimmed.split(":");
                    const value = valueParts.join(":").trim();
                    return (
                      <div key={index} className="flex text-xs mb-1">
                        <span className="font-medium text-gray-600 w-24 flex-shrink-0">
                          {key}:
                        </span>
                        <span className="text-gray-800">{value}</span>
                      </div>
                    );
                  } else if (trimmed.startsWith("- ")) {
                    return (
                      <p
                        key={index}
                        className="text-xs my-1 ml-4 before:content-['•'] before:mr-2"
                      >
                        {trimmed.substring(2)}
                      </p>
                    );
                  }
                  return (
                    <p key={index} className="text-xs my-2">
                      {trimmed}
                    </p>
                  );
                })
            ) : (
              <p className="text-gray-500 italic text-sm">
                No summary available
              </p>
            )}
          </div>
        </div>

        {/* RFQ Form */}
        <form
          className="lg:w-2/3 space-y-6"
          onSubmit={generateAndSaveFilledPdf}
        >
          {/* Quote Details */}
          <section className="border rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Quote Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="priceFirmUntil"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  Price Firm Until
                </label>
                <input
                  type="date"
                  id="priceFirmUntil"
                  name="priceFirmUntil"
                  value={formData.priceFirmUntil}
                  onChange={handleChange}
                  className="border p-2 rounded w-full text-sm"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="quoteRefNum"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  Quote Reference #
                </label>
                <input
                  type="text"
                  id="quoteRefNum"
                  name="quoteRefNum"
                  value={formData.quoteRefNum}
                  onChange={handleChange}
                  className="border p-2 rounded w-full text-sm"
                  placeholder="Optional internal ref"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Payment Terms
                </label>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="paymentTerms"
                      value="Net 30"
                      checked={formData.paymentTerms === "Net 30"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Net 30</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="paymentTerms"
                      value="Net 15"
                      checked={formData.paymentTerms === "Net 15"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Net 15</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="paymentTerms"
                      value="Other"
                      checked={formData.paymentTerms === "Other"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Other:</span>
                  </label>
                </div>
                <input
                  type="text"
                  id="paymentTermsOther"
                  name="paymentTermsOther"
                  value={formData.paymentTermsOther}
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-2 text-sm disabled:bg-gray-100"
                  placeholder="Specify other terms"
                  disabled={formData.paymentTerms !== "Other"}
                />
              </div>
            </div>
          </section>

          {/* Shipping & Handling */}
          <section className="border rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Shipping & Handling
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="complimentaryFreight"
                    checked={formData.complimentaryFreight === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Complimentary Freight</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="ppaByVender"
                    checked={formData.ppaByVender === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Prepay & Add by Vendor</span>
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  FOB
                </label>
                <div className="flex gap-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="fob"
                      value="Origin"
                      checked={formData.fob === "Origin"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Origin</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="fob"
                      value="Destination"
                      checked={formData.fob === "Destination"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Destination</span>
                  </label>
                </div>
              </div>
              <div>
                <label
                  htmlFor="purchaseOrderMinimum"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  Purchase Order Minimum ($)
                </label>
                <input
                  type="number"
                  id="purchaseOrderMinimum"
                  name="purchaseOrderMinimum"
                  value={formData.purchaseOrderMinimum}
                  onChange={handleChange}
                  className="border p-2 rounded w-full text-sm"
                  placeholder="e.g., 100"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </section>

          {/* Business Information */}
          <section className="border rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Business Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="CAGE"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  CAGE Code
                </label>
                <input
                  type="text"
                  id="CAGE"
                  name="CAGE"
                  value={formData.CAGE}
                  onChange={handleChange}
                  className="border p-2 rounded w-full text-sm"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="SAMUEI"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  SAM UEI
                </label>
                <input
                  type="text"
                  id="SAMUEI"
                  name="SAMUEI"
                  value={formData.SAMUEI}
                  onChange={handleChange}
                  className="border p-2 rounded w-full text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-600">
                  SAM Registered
                </label>
                <div className="flex gap-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="SAM"
                      value="Yes"
                      checked={formData.SAM === "Yes"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="SAM"
                      value="No"
                      checked={formData.SAM === "No"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>
              <div>
                <label
                  htmlFor="NAICS"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  NAICS Code
                </label>
                <input
                  type="text"
                  id="NAICS"
                  name="NAICS"
                  value={formData.NAICS}
                  onChange={handleChange}
                  className="border p-2 rounded w-full text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="NAICSSIZE"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  NAICS Size ($M / Employees)
                </label>
                <input
                  type="text"
                  id="NAICSSIZE"
                  name="NAICSSIZE"
                  value={formData.NAICSSIZE}
                  onChange={handleChange}
                  className="border p-2 rounded w-full text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-600">
                  Business Type
                </label>
                <div className="flex gap-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="BT"
                      value="Small"
                      checked={formData.BT === "Small"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Small</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="BT"
                      value="Large"
                      checked={formData.BT === "Large"}
                      onChange={handleChange}
                    />
                    <span className="text-sm">Large</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Business Classifications */}
          <section className="border rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Business Classifications
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="smalldisad"
                    checked={formData.smalldisad === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Small Disadvantaged</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="womenowned"
                    checked={formData.womenowned === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Woman-Owned</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="sdvet"
                    checked={formData.sdvet === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Service-Disabled Vet-Owned</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="ANC"
                    checked={formData.ANC === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Alaska Native Corp.</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="HubZone"
                    checked={formData.HubZone === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">HUBZone</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="vetowned"
                    checked={formData.vetowned === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Veteran-Owned</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="hist"
                    checked={formData.hist === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Historically Underutilized</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="other"
                    checked={formData.other === "On"}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Other</span>
                </div>
              </div>
              <div className="space-y-1 col-span-2 md:col-span-1">
                <div className="block text-sm font-medium text-gray-600 mb-1">
                  Size Standard
                </div>
                <div className="flex flex-col space-y-1">
                  {["Option1", "Option2", "Option3", "Option4", "Option5"].map(
                    (option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="size"
                          value={option}
                          checked={formData.size === option}
                          onChange={handleChange}
                        />
                        <span className="text-sm">{`${option} Text`}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            {filledPdfDownloadUrl && (
              <Button
                type="button"
                onClick={() => window.open(filledPdfDownloadUrl, "_blank")}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Generated PDF
              </Button>
            )}
            <Button
              type="submit"
              disabled={isGeneratingPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                "Generate & Save Filled RFQ"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render the RFQ selection screen if none is chosen
  const renderSelection = () => (
    <div className="container mx-auto p-4">
      {/* Navigation Buttons */}
      <div className="flex gap-4 mb-6">
        <Button variant="outline" asChild>
          <Link href="/rfq">Upload New RFQ</Link>
        </Button>
        <Button variant="default" asChild>
          <Link href="/rfq-fill">Fill RFQ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rfq-done">View Completed RFQs</Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Select an RFQ to Fill</h1>
      {isFetchingRFQs ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
          <span className="ml-3 text-gray-600">Loading available RFQs...</span>
        </div>
      ) : availableRFQs.length === 0 ? (
        <p className="text-center text-gray-500 mt-8">
          No RFQs available to fill.{" "}
          <Link href="/rfq" className="text-blue-600 hover:underline">
            Upload a new RFQ
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableRFQs.map((rfq) => (
            <Card
              key={rfq.id}
              className="cursor-pointer hover:shadow-lg transition-shadow duration-150"
              onClick={() => setSelectedRFQ(rfq)}
            >
              <CardHeader>
                <CardTitle
                  className="text-base font-semibold truncate"
                  title={rfq.filename}
                >
                  {rfq.filename}
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Uploaded: {new Date(rfq.createdAt).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 pt-0 pb-4 px-4">
                <p className="line-clamp-3">
                  {cleanSummary(rfq.summary).cleanedSummary || (
                    <span className="italic">No summary preview.</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return selectedRFQ ? renderForm() : renderSelection();
}
