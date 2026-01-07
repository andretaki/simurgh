import "server-only";
import OpenAI from "openai";

// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embeddings for text content
 * @param text Text to generate embeddings for
 * @returns Array of embedding values
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Trim and normalize text
    const normalizedText = text.replace(/\s+/g, " ").trim();

    // Truncate to a reasonable length (8k tokens ~= 32k chars)
    const truncatedText = normalizedText.substring(0, 32000);

    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002", // or the latest embedding model
      input: truncatedText,
    });

    if (!response.data[0]?.embedding) {
      throw new Error("Failed to generate embedding");
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Generate a chat completion with GPT
 * @param systemPrompt System instructions
 * @param userPrompt User query or content
 * @param context Optional context to provide
 * @returns Generated text response
 */
export async function generateChatCompletion(
  systemPrompt: string,
  userPrompt: string,
  context?: string,
): Promise<string> {
  try {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: context ? `${userPrompt}\n\nContext:\n${context}` : userPrompt,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Adjust based on your needs
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3, // Lower for more consistent, factual responses
    });

    return response.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    console.error("Error generating chat completion:", error);
    throw error;
  }
}

/**
 * Extract structured data from text using GPT
 * @param text Text to extract data from
 * @param schema Description of the schema to extract
 * @returns Extracted JSON object
 */
export async function extractStructuredData<T>(
  text: string,
  schema: string,
): Promise<T> {
  try {
    const systemPrompt = `
      You are a data extraction assistant. Extract structured data from the provided text.
      Return ONLY a valid JSON object matching the following schema:
      ${schema}
      
      Do not include any explanations, just the JSON object.
    `;

    const response = await generateChatCompletion(systemPrompt, text);

    // Extract JSON from response
    const jsonMatch =
      response.match(/```json\n([\s\S]*?)\n```/) ||
      response.match(/({[\s\S]*})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    return JSON.parse(jsonStr.trim()) as T;
  } catch (error) {
    console.error("Error extracting structured data:", error);
    throw error;
  }
}
