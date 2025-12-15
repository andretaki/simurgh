import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { downloadFromS3 } from "@/lib/aws/s3";
import { PDFCheckBox, PDFDocument, PDFRadioGroup, PDFTextField } from "pdf-lib";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Safety: do not expose PDF field details in production unless explicitly enabled.
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_PDF_FIELDS_DEBUG !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rfqId = parseInt(params.id);
    if (isNaN(rfqId)) {
      return NextResponse.json({ error: "Invalid RFQ ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeGeometry = searchParams.get("includeGeometry") === "true";

    const [rfqDoc] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId))
      .limit(1);

    if (!rfqDoc?.s3Key) {
      return NextResponse.json(
        { error: "RFQ PDF not found" },
        { status: 404 }
      );
    }

    const bytes = await downloadFromS3(rfqDoc.s3Key);
    const pdfDoc = await PDFDocument.load(bytes);

    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      return NextResponse.json({
        rfqId,
        pageCount: pdfDoc.getPageCount(),
        acroForm: false,
        fields: [],
      });
    }

    const fields = form.getFields().map((f: any) => {
      const name = f.getName();
      const base: any = { name };
      if (f instanceof PDFTextField) base.type = "text";
      else if (f instanceof PDFCheckBox) base.type = "checkbox";
      else if (f instanceof PDFRadioGroup) {
        base.type = "radio";
        try {
          base.options = f.getOptions();
        } catch {
          base.options = [];
        }
      } else {
        base.type = "other";
      }

      if (includeGeometry) {
        try {
          const widgets = (f as any).acroField?.getWidgets?.() || [];
          base.widgets = widgets.map((w: any) => {
            const rect = w.getRectangle?.();
            const pageRef = w.P?.();
            const rectObj = rect
              ? {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                }
              : null;
            return {
              rect: rectObj,
              pageRef: pageRef ? String(pageRef) : null,
            };
          });
        } catch {
          base.widgets = [];
        }
      }
      return base;
    });

    return NextResponse.json({
      rfqId,
      fileName: rfqDoc.fileName,
      pageCount: pdfDoc.getPageCount(),
      acroForm: true,
      includeGeometry,
      fields,
    });
  } catch (error) {
    console.error("Error extracting PDF fields:", error);
    return NextResponse.json(
      { error: "Failed to extract PDF fields" },
      { status: 500 }
    );
  }
}
