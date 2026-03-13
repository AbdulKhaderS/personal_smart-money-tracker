import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getSpendingInsights(
  income: number,
  expenses: { category: string; amount: number }[],
  currency: string = "KD"
) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      As a financial advisor for workers in Kuwait, analyze this monthly budget:
      Monthly Income: ${income} ${currency}
      Expenses: ${JSON.stringify(expenses)}
      
      Provide 3 concise, actionable tips for saving money and managing this specific budget better. 
      Keep the tone encouraging and professional.
      Format the response as a JSON array of strings.
    `,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    const result = await model;
    return JSON.parse(result.text || "[]");
  } catch (error) {
    console.error("AI Insight Error:", error);
    return ["Track your daily small spends to find hidden savings.", "Consider setting a strict limit for personal shopping.", "Look for cheaper food sharing options if possible."];
  }
}
