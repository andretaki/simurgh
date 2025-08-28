import { NextRequest, NextResponse } from "next/server"
import { OpenAI } from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { rfqSummary, companyProfile } = await request.json()

    if (!rfqSummary) {
      return NextResponse.json(
        { error: "RFQ summary is required" },
        { status: 400 }
      )
    }

    // Use GPT-4 to analyze RFQ and suggest field values
    const systemPrompt = `You are an expert at analyzing RFQs and extracting key information.
Given an RFQ summary and a company profile, suggest appropriate field values for the response form.
Focus on identifying:
- Delivery requirements (dates, locations)
- Quantity requirements
- Technical specifications
- Compliance requirements
- Special terms or conditions

Return suggestions as JSON with field names and values, along with confidence scores.`

    const userPrompt = `Analyze this RFQ and suggest field values:

RFQ Summary:
${rfqSummary}

Company Profile:
${JSON.stringify(companyProfile, null, 2)}

Identify any specific requirements mentioned in the RFQ that should be auto-filled.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1000,
    })

    const response = completion.choices[0].message.content
    const suggestions = response ? JSON.parse(response) : {}

    // Add confidence scores and warnings
    const result = {
      suggestedValues: suggestions.suggestedValues || {},
      confidence: suggestions.confidence || {},
      warning: suggestions.warning || null,
      extractedRequirements: suggestions.requirements || [],
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error analyzing RFQ fields:", error)
    return NextResponse.json(
      { error: "Failed to analyze RFQ fields" },
      { status: 500 }
    )
  }
}