import { PDFDocument, PDFForm, PDFTextField, rgb, StandardFonts } from "pdf-lib"
import { downloadFromS3 } from "@/lib/aws/s3"

interface FillData {
  companyName?: string
  cageCode?: string
  samUei?: string
  samRegistered?: boolean
  naicsCode?: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  businessType?: string
  paymentTerms?: string
  fob?: string
  [key: string]: any
}

interface FieldMapping {
  pdfFieldName: string
  dataKey: string
  transform?: (value: any) => string
}

// Common field mappings for government RFQs
const commonFieldMappings: FieldMapping[] = [
  { pdfFieldName: "Vendor Name", dataKey: "companyName" },
  { pdfFieldName: "Company Name", dataKey: "companyName" },
  { pdfFieldName: "Business Name", dataKey: "companyName" },
  { pdfFieldName: "CAGE", dataKey: "cageCode" },
  { pdfFieldName: "CAGE Code", dataKey: "cageCode" },
  { pdfFieldName: "Cage Code", dataKey: "cageCode" },
  { pdfFieldName: "SAM UEI", dataKey: "samUei" },
  { pdfFieldName: "UEI", dataKey: "samUei" },
  { pdfFieldName: "NAICS", dataKey: "naicsCode" },
  { pdfFieldName: "NAICS Code", dataKey: "naicsCode" },
  { pdfFieldName: "Contact Name", dataKey: "contactPerson" },
  { pdfFieldName: "POC", dataKey: "contactPerson" },
  { pdfFieldName: "Point of Contact", dataKey: "contactPerson" },
  { pdfFieldName: "Email", dataKey: "contactEmail" },
  { pdfFieldName: "Contact Email", dataKey: "contactEmail" },
  { pdfFieldName: "Phone", dataKey: "contactPhone" },
  { pdfFieldName: "Phone Number", dataKey: "contactPhone" },
  { pdfFieldName: "Contact Phone", dataKey: "contactPhone" },
  { pdfFieldName: "Address", dataKey: "address" },
  { pdfFieldName: "Company Address", dataKey: "address" },
  { pdfFieldName: "Business Address", dataKey: "address" },
  { pdfFieldName: "Payment Terms", dataKey: "paymentTerms" },
  { pdfFieldName: "Terms", dataKey: "paymentTerms" },
  { pdfFieldName: "FOB", dataKey: "fob" },
  { pdfFieldName: "F.O.B.", dataKey: "fob" },
  { pdfFieldName: "Business Type", dataKey: "businessType" },
  { pdfFieldName: "Business Size", dataKey: "businessType" },
]

export async function generateFilledPDF(
  originalPdfS3Key: string,
  fillData: FillData,
  customMappings?: FieldMapping[]
): Promise<Uint8Array> {
  try {
    // Download original PDF from S3
    const pdfBuffer = await downloadFromS3(originalPdfS3Key)
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    
    // Get the form
    const form = pdfDoc.getForm()
    
    // Combine custom mappings with common ones
    const allMappings = [...(customMappings || []), ...commonFieldMappings]
    
    // Get all form fields for debugging
    const fields = form.getFields()
    console.log("Available PDF form fields:", fields.map(f => f.getName()))
    
    // Fill each field based on mappings
    for (const mapping of allMappings) {
      try {
        const field = form.getTextField(mapping.pdfFieldName)
        if (field) {
          const value = fillData[mapping.dataKey]
          if (value !== undefined && value !== null) {
            const textValue = mapping.transform 
              ? mapping.transform(value)
              : String(value)
            field.setText(textValue)
            console.log(`Filled field "${mapping.pdfFieldName}" with "${textValue}"`)
          }
        }
      } catch (fieldError) {
        // Field might not be a text field, try other types
        console.log(`Could not fill field "${mapping.pdfFieldName}":`, fieldError)
      }
    }
    
    // Also try direct field name matching for any fields not in mappings
    for (const field of fields) {
      const fieldName = field.getName()
      const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "")
      
      // Check if we haven't already filled this field
      const alreadyFilled = allMappings.some(m => m.pdfFieldName === fieldName)
      if (!alreadyFilled) {
        // Try to find a matching data key
        for (const [dataKey, dataValue] of Object.entries(fillData)) {
          const normalizedDataKey = dataKey.toLowerCase().replace(/[^a-z0-9]/g, "")
          
          if (normalizedFieldName.includes(normalizedDataKey) || 
              normalizedDataKey.includes(normalizedFieldName)) {
            try {
              if (field instanceof PDFTextField) {
                field.setText(String(dataValue))
                console.log(`Auto-matched field "${fieldName}" with data key "${dataKey}"`)
              }
            } catch (error) {
              console.log(`Could not auto-fill field "${fieldName}":`, error)
            }
          }
        }
      }
    }
    
    // Flatten the form to make fields non-editable (optional)
    // form.flatten()
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save()
    return pdfBytes
    
  } catch (error) {
    console.error("Error generating filled PDF:", error)
    throw error
  }
}

export async function createResponsePDF(
  rfqData: any,
  companyData: FillData,
  items?: any[]
): Promise<Uint8Array> {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()
    
    // Add a page
    const page = pdfDoc.addPage([612, 792]) // Letter size
    
    // Get fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    
    // Add header
    page.drawText("RFQ RESPONSE", {
      x: 50,
      y: 742,
      size: 20,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })
    
    // Add RFQ details
    let yPos = 700
    const lineHeight = 20
    
    // RFQ Information section
    page.drawText("RFQ INFORMATION", {
      x: 50,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })
    yPos -= lineHeight * 1.5
    
    if (rfqData.rfqNumber) {
      page.drawText(`RFQ Number: ${rfqData.rfqNumber}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    if (rfqData.title) {
      page.drawText(`Title: ${rfqData.title}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    if (rfqData.dueDate) {
      page.drawText(`Due Date: ${new Date(rfqData.dueDate).toLocaleDateString()}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    // Company Information section
    yPos -= lineHeight
    page.drawText("VENDOR INFORMATION", {
      x: 50,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })
    yPos -= lineHeight * 1.5
    
    page.drawText(`Company: ${companyData.companyName || ""}`, {
      x: 50,
      y: yPos,
      size: 11,
      font: helvetica,
    })
    yPos -= lineHeight
    
    if (companyData.cageCode) {
      page.drawText(`CAGE Code: ${companyData.cageCode}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    if (companyData.samUei) {
      page.drawText(`SAM UEI: ${companyData.samUei}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    if (companyData.contactPerson) {
      page.drawText(`Contact: ${companyData.contactPerson}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    if (companyData.contactEmail) {
      page.drawText(`Email: ${companyData.contactEmail}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    if (companyData.contactPhone) {
      page.drawText(`Phone: ${companyData.contactPhone}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    // Items/Line Items section if provided
    if (items && items.length > 0) {
      yPos -= lineHeight
      page.drawText("LINE ITEMS", {
        x: 50,
        y: yPos,
        size: 14,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
      yPos -= lineHeight * 1.5
      
      // Table headers
      page.drawText("Item", { x: 50, y: yPos, size: 10, font: helveticaBold })
      page.drawText("Description", { x: 100, y: yPos, size: 10, font: helveticaBold })
      page.drawText("Qty", { x: 350, y: yPos, size: 10, font: helveticaBold })
      page.drawText("Unit Price", { x: 400, y: yPos, size: 10, font: helveticaBold })
      page.drawText("Total", { x: 480, y: yPos, size: 10, font: helveticaBold })
      yPos -= lineHeight
      
      // Draw line
      page.drawLine({
        start: { x: 50, y: yPos + 5 },
        end: { x: 550, y: yPos + 5 },
        thickness: 0.5,
      })
      yPos -= 10
      
      // Add items
      let totalAmount = 0
      items.forEach((item, index) => {
        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0)
        totalAmount += itemTotal
        
        page.drawText(`${index + 1}`, { x: 50, y: yPos, size: 9, font: helvetica })
        page.drawText(item.description || "", { x: 100, y: yPos, size: 9, font: helvetica })
        page.drawText(String(item.quantity || ""), { x: 350, y: yPos, size: 9, font: helvetica })
        page.drawText(`$${(item.unitPrice || 0).toFixed(2)}`, { x: 400, y: yPos, size: 9, font: helvetica })
        page.drawText(`$${itemTotal.toFixed(2)}`, { x: 480, y: yPos, size: 9, font: helvetica })
        yPos -= lineHeight * 0.8
      })
      
      // Draw total line
      yPos -= 5
      page.drawLine({
        start: { x: 400, y: yPos + 5 },
        end: { x: 550, y: yPos + 5 },
        thickness: 0.5,
      })
      yPos -= lineHeight
      
      page.drawText("TOTAL:", { x: 400, y: yPos, size: 11, font: helveticaBold })
      page.drawText(`$${totalAmount.toFixed(2)}`, { x: 480, y: yPos, size: 11, font: helveticaBold })
    }
    
    // Terms and Conditions
    yPos -= lineHeight * 2
    page.drawText("TERMS & CONDITIONS", {
      x: 50,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })
    yPos -= lineHeight * 1.5
    
    if (companyData.paymentTerms) {
      page.drawText(`Payment Terms: ${companyData.paymentTerms}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    if (companyData.fob) {
      page.drawText(`FOB: ${companyData.fob}`, {
        x: 50,
        y: yPos,
        size: 11,
        font: helvetica,
      })
      yPos -= lineHeight
    }
    
    // Footer
    const currentDate = new Date().toLocaleDateString()
    page.drawText(`Generated on ${currentDate}`, {
      x: 50,
      y: 50,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    })
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save()
    return pdfBytes
    
  } catch (error) {
    console.error("Error creating response PDF:", error)
    throw error
  }
}