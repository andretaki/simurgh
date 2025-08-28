import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";

interface ResponseData {
  rfqNumber?: string;
  dueDate?: string;
  contractingOffice?: string;
  companyName?: string;
  unitPrice?: string;
  totalPrice?: string;
  deliveryTime?: string;
  paymentTerms?: string;
  [key: string]: any;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rfqId = parseInt(params.id);
    const format = request.nextUrl.searchParams.get("format") || "csv";

    // Fetch RFQ document and response
    const [rfqDoc] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId))
      .limit(1);

    if (!rfqDoc) {
      return NextResponse.json(
        { error: "RFQ not found" },
        { status: 404 }
      );
    }

    const [response] = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, rfqId))
      .limit(1);

    if (format === "csv") {
      // Generate CSV
      const csvRows = [];
      
      // Header
      csvRows.push("Field,Extracted Value,Response Value,Confidence");
      
      // Document info
      const responseData = response?.responseData as ResponseData | undefined;
      csvRows.push(`RFQ Number,${rfqDoc.rfqNumber || ""},${responseData?.rfqNumber || ""},`);
      csvRows.push(`Due Date,${rfqDoc.dueDate?.toISOString() || ""},${responseData?.dueDate || ""},`);
      csvRows.push(`Contracting Office,${rfqDoc.contractingOffice || ""},${responseData?.contractingOffice || ""},`);
      
      // Extract fields if available
      if (rfqDoc.extractedFields && typeof rfqDoc.extractedFields === 'object') {
        const fields = (rfqDoc.extractedFields as any).fields || {};
        
        Object.entries(fields).forEach(([key, value]: [string, any]) => {
          const extractedValue = value?.value || "";
          const confidence = value?.confidence || "";
          const responseValue = responseData?.[key] || "";
          
          // Escape values for CSV
          const escapeCSV = (val: any) => {
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          };
          
          csvRows.push(`${escapeCSV(key)},${escapeCSV(extractedValue)},${escapeCSV(responseValue)},${confidence}`);
        });
      }
      
      // Response data
      if (responseData) {
        csvRows.push("");
        csvRows.push("Response Details");
        csvRows.push(`Company Name,${responseData.companyName || ""}`);
        csvRows.push(`Unit Price,${responseData.unitPrice || ""}`);
        csvRows.push(`Total Price,${responseData.totalPrice || ""}`);
        csvRows.push(`Delivery Time,${responseData.deliveryTime || ""}`);
        csvRows.push(`Payment Terms,${responseData.paymentTerms || ""}`);
      }
      
      const csv = csvRows.join("\n");
      
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="rfq_${rfqId}_export.csv"`,
        },
      });
      
    } else if (format === "json") {
      // Generate structured JSON
      const exportData = {
        rfq: {
          id: rfqDoc.id,
          fileName: rfqDoc.fileName,
          rfqNumber: rfqDoc.rfqNumber,
          dueDate: rfqDoc.dueDate,
          contractingOffice: rfqDoc.contractingOffice,
          status: rfqDoc.status,
          createdAt: rfqDoc.createdAt,
          extractedFields: rfqDoc.extractedFields,
        },
        response: response ? {
          id: response.id,
          responseData: response.responseData,
          pdfUrl: response.generatedPdfUrl,
          status: response.status,
          submittedAt: response.submittedAt,
        } : null,
        metadata: {
          exportedAt: new Date().toISOString(),
          format: "json",
          version: "1.0",
        },
      };
      
      return NextResponse.json(exportData, {
        headers: {
          "Content-Disposition": `attachment; filename="rfq_${rfqId}_export.json"`,
        },
      });
      
    } else if (format === "excel") {
      // For Excel, we'll return data that frontend can process with a library
      const excelData = {
        sheets: [
          {
            name: "RFQ Details",
            data: [
              ["Field", "Extracted Value", "Confidence", "Response Value"],
              ["RFQ Number", rfqDoc.rfqNumber || "", "", (response?.responseData as ResponseData)?.rfqNumber || ""],
              ["Due Date", rfqDoc.dueDate?.toLocaleDateString() || "", "", ""],
              ["Contracting Office", rfqDoc.contractingOffice || "", "", ""],
            ],
          },
          {
            name: "Extracted Fields",
            data: [],
          },
          {
            name: "Response",
            data: response ? [
              ["Field", "Value"],
              ["Company Name", (response.responseData as ResponseData)?.companyName || ""],
              ["Unit Price", (response.responseData as ResponseData)?.unitPrice || ""],
              ["Total Price", (response.responseData as ResponseData)?.totalPrice || ""],
              ["Delivery Time", (response.responseData as ResponseData)?.deliveryTime || ""],
              ["Payment Terms", (response.responseData as ResponseData)?.paymentTerms || ""],
            ] : [],
          },
        ],
      };
      
      // Add extracted fields to Excel data
      if (rfqDoc.extractedFields && typeof rfqDoc.extractedFields === 'object') {
        const fields = (rfqDoc.extractedFields as any).fields || {};
        const fieldData = [["Field", "Value", "Confidence"]];
        
        Object.entries(fields).forEach(([key, value]: [string, any]) => {
          fieldData.push([
            key,
            String(value?.value || ""),
            String(value?.confidence || "") + "%",
          ]);
        });
        
        excelData.sheets[1].data = fieldData;
      }
      
      return NextResponse.json(excelData);
    }
    
    return NextResponse.json(
      { error: "Invalid format specified" },
      { status: 400 }
    );
    
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export RFQ data" },
      { status: 500 }
    );
  }
}