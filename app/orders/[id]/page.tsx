"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Download, Check } from "lucide-react";

interface Order {
  id: number;
  poNumber: string;
  productName: string;
  nsn: string | null;
  nsnBarcode: string | null;
  quantity: number;
  unitOfMeasure: string | null;
  unitPrice: string | null;
  spec: string | null;
  grade: string | null;
  shipToName: string | null;
  shipToAddress: string | null;
  status: string;
}

interface QualitySheet {
  lotNumber: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

interface GeneratedLabel {
  id: number;
  labelType: string;
}

const HAZARD_SYMBOLS = [
  { id: "flamme", name: "Flammable", image: "/hazard-symbols/flamme.png" },
  { id: "acid_red", name: "Corrosive", image: "/hazard-symbols/acid_red.png" },
  { id: "exclam", name: "Irritant", image: "/hazard-symbols/exclam.png" },
  { id: "skull", name: "Toxic", image: "/hazard-symbols/skull.png" },
  { id: "silhouete", name: "Health Hazard", image: "/hazard-symbols/silhouete.png" },
  { id: "rondflam", name: "Oxidizer", image: "/hazard-symbols/rondflam.png" },
  { id: "aquatic", name: "Environmental", image: "/hazard-symbols/Aquatic-pollut-red.png" },
];

const CHECKLIST_ITEMS = [
  "PO Number verified",
  "Product name matches",
  "NSN is correct",
  "Quantity verified",
  "Lot number assigned",
  "Ship to address verified",
  "Box label reviewed",
  "Bottle label reviewed",
  "Hazard symbols correct",
];

export default function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const orderId = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [qualitySheet, setQualitySheet] = useState<QualitySheet | null>(null);
  const [labels, setLabels] = useState<GeneratedLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  // Form data
  const [lotNumber, setLotNumber] = useState("");
  const [containerType, setContainerType] = useState("");
  const [assemblyDate, setAssemblyDate] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [mhmDate, setMhmDate] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [boxQuantity, setBoxQuantity] = useState("");
  const [boxWeight, setBoxWeight] = useState("");
  const [bottleQuantity, setBottleQuantity] = useState("");
  const [bottleWeight, setBottleWeight] = useState("");
  const [hazardSymbols, setHazardSymbols] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<boolean[]>(new Array(CHECKLIST_ITEMS.length).fill(false));
  const [verifierName, setVerifierName] = useState("");

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data.order);
        setQualitySheet(data.qualitySheet);
        setLabels(data.labels || []);
        if (data.qualitySheet) {
          setLotNumber(data.qualitySheet.lotNumber || "");
          if (data.labels?.length > 0) setCurrentStep(4);
          else setCurrentStep(3);
        }
        if (data.order) {
          setShipTo(`${data.order.shipToName || ""}\n${data.order.shipToAddress || ""}`.trim());
        }
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  const saveQualitySheet = async () => {
    if (!order) return;
    const res = await fetch(`/api/orders/${orderId}/quality-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poNumber: order.poNumber,
        lotNumber,
        nsn: order.nsn,
        quantity: order.quantity,
        productType: order.productName,
        shipTo,
        assemblyDate,
        inspectionDate,
        mhmDate,
        cageCode: "1LT50",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setQualitySheet(data.qualitySheet);
      setCurrentStep(3);
    }
  };

  const generateLabel = async (type: "box" | "bottle") => {
    if (!order) return;
    const res = await fetch(`/api/orders/${orderId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labelType: type,
        labelSize: type === "box" ? "4x6" : "3x4",
        productName: order.productName,
        grade: order.grade,
        spec: order.spec,
        nsn: order.nsn,
        nsnBarcode: order.nsnBarcode,
        cageCode: "1LT50",
        poNumber: order.poNumber,
        lotNumber,
        quantity: type === "box" ? boxQuantity : bottleQuantity,
        weight: type === "box" ? boxWeight : bottleWeight,
        assemblyDate,
        inspectionDate,
        mhmDate,
        containerType,
        hazardSymbols,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.pdfBase64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${data.pdfBase64}`;
        link.download = `${type}-label-${order.poNumber}.pdf`;
        link.click();
      }
      setLabels((prev) => [...prev, { id: Date.now(), labelType: type }]);
    }
  };

  const handleVerify = async () => {
    if (!checklist.every(Boolean) || !verifierName.trim()) return;
    await fetch(`/api/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...order, status: "verified" }),
    });
    await fetch(`/api/orders/${orderId}/quality-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poNumber: order?.poNumber,
        lotNumber,
        nsn: order?.nsn,
        quantity: order?.quantity,
        productType: order?.productName,
        shipTo,
        assemblyDate,
        inspectionDate,
        mhmDate,
        cageCode: "1LT50",
        verifiedBy: verifierName,
        verifiedAt: new Date().toISOString(),
      }),
    });
    window.location.reload();
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!order) return <div className="p-8">Order not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-xl font-bold">PO# {order.poNumber}</h1>
        <span className={`px-2 py-1 text-xs rounded ${
          order.status === "verified" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
        }`}>
          {order.status}
        </span>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {["Review PO", "Quality Sheet", "Labels", "Verify"].map((step, i) => (
          <React.Fragment key={step}>
            <button
              onClick={() => setCurrentStep(i + 1)}
              className={`px-3 py-1 rounded text-sm ${
                currentStep === i + 1
                  ? "bg-blue-600 text-white"
                  : currentStep > i + 1
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {i + 1}. {step}
            </button>
            {i < 3 && <span className="text-gray-300">→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Review PO */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 1: Review Purchase Order</h2>
          <div className="border rounded p-4 space-y-2 bg-gray-50">
            <Row label="PO Number" value={order.poNumber} />
            <Row label="Product" value={order.productName} />
            <Row label="NSN" value={order.nsn || "—"} />
            <Row label="Quantity" value={`${order.quantity} ${order.unitOfMeasure || ""}`} />
            <Row label="Unit Price" value={order.unitPrice ? `$${order.unitPrice}` : "—"} />
            <Row label="Spec" value={order.spec || "—"} />
            <Row label="Ship To" value={`${order.shipToName || ""} ${order.shipToAddress || ""}`.trim() || "—"} />
          </div>
          <Button onClick={() => setCurrentStep(2)}>Continue →</Button>
        </div>
      )}

      {/* Step 2: Quality Sheet */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 2: SAIC Quality Sheet</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lot Number *" value={lotNumber} onChange={setLotNumber} placeholder="e.g., 50415AL" />
            <Field label="CAGE Code" value="1LT50" disabled />
            <Field label="Container Type" value={containerType} onChange={setContainerType} placeholder="e.g., 12 X 1 QT BOTTLES" />
            <Field label="Assembly Date" value={assemblyDate} onChange={setAssemblyDate} placeholder="MM/DD" />
            <Field label="Inspection Date" value={inspectionDate} onChange={setInspectionDate} placeholder="MM/DD" />
            <Field label="MHM Date" value={mhmDate} onChange={setMhmDate} placeholder="MM/DD" />
            <div className="col-span-2">
              <Label className="text-sm">Ship To</Label>
              <Textarea value={shipTo} onChange={(e) => setShipTo(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>← Back</Button>
            <Button onClick={saveQualitySheet} disabled={!lotNumber}>Save & Continue →</Button>
          </div>
        </div>
      )}

      {/* Step 3: Labels */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Step 3: Generate Labels</h2>

          {/* Box Label */}
          <div className="border rounded p-4">
            <h3 className="font-medium mb-3">Box Label (4×6)</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Quantity" value={boxQuantity} onChange={setBoxQuantity} placeholder="e.g., 12 QTS" />
              <Field label="Weight" value={boxWeight} onChange={setBoxWeight} placeholder="e.g., 24.0 LBS" />
            </div>
            <Button onClick={() => generateLabel("box")} size="sm">
              <Download className="h-4 w-4 mr-1" /> Generate Box Label
            </Button>
            {labels.some((l) => l.labelType === "box") && (
              <span className="ml-2 text-green-600 text-sm">✓ Generated</span>
            )}
          </div>

          {/* Bottle Label */}
          <div className="border rounded p-4">
            <h3 className="font-medium mb-3">Bottle Label (3×4)</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Quantity" value={bottleQuantity} onChange={setBottleQuantity} placeholder="e.g., ONE QT" />
              <Field label="Weight" value={bottleWeight} onChange={setBottleWeight} placeholder="e.g., 2.0 LBS" />
            </div>
            <Button onClick={() => generateLabel("bottle")} size="sm">
              <Download className="h-4 w-4 mr-1" /> Generate Bottle Label
            </Button>
            {labels.some((l) => l.labelType === "bottle") && (
              <span className="ml-2 text-green-600 text-sm">✓ Generated</span>
            )}
          </div>

          {/* Hazard Symbols */}
          <div className="border rounded p-4">
            <h3 className="font-medium mb-3">GHS Hazard Symbols</h3>
            <div className="flex flex-wrap gap-2">
              {HAZARD_SYMBOLS.map((symbol) => {
                const selected = hazardSymbols.includes(symbol.id);
                return (
                  <button
                    key={symbol.id}
                    onClick={() => {
                      setHazardSymbols(selected
                        ? hazardSymbols.filter((s) => s !== symbol.id)
                        : [...hazardSymbols, symbol.id]
                      );
                    }}
                    className={`p-2 border rounded ${selected ? "border-red-500 bg-red-50" : "border-gray-200"}`}
                  >
                    <Image src={symbol.image} alt={symbol.name} width={48} height={48} />
                    <p className="text-xs text-center mt-1">{symbol.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>← Back</Button>
            <Button onClick={() => setCurrentStep(4)} disabled={labels.length === 0}>
              Continue to Verify →
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Verify */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Step 4: Verify & Approve</h2>

          {order.status === "verified" ? (
            <div className="border rounded p-6 text-center bg-green-50">
              <Check className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-700">Order Verified</p>
              <p className="text-sm text-gray-600">by {qualitySheet?.verifiedBy}</p>
            </div>
          ) : (
            <>
              <div className="border rounded p-4">
                <h3 className="font-medium mb-3">Checklist</h3>
                <div className="space-y-2">
                  {CHECKLIST_ITEMS.map((item, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklist[i]}
                        onChange={() => {
                          const next = [...checklist];
                          next[i] = !next[i];
                          setChecklist(next);
                        }}
                        className="w-4 h-4"
                      />
                      <span className={checklist[i] ? "text-green-700" : ""}>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border rounded p-4">
                <Label className="text-sm font-medium">Signature (Your Name) *</Label>
                <Input
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>← Back</Button>
                <Button
                  onClick={handleVerify}
                  disabled={!checklist.every(Boolean) || !verifierName.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ✓ Approve & Sign
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-32 text-gray-500 text-sm">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1"
      />
    </div>
  );
}
