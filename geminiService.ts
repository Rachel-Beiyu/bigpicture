import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateProjectIdeas = async (title: string, content: string): Promise<string> => {
  if (!apiKey) {
    return "API Key is missing. Please check your configuration.";
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      You are a project management assistant. 
      The user has a project note titled "${title}" with the following content: "${content}".
      
      Please analyze this input and provide:
      1. A brief summary of the project goal (1 sentence).
      2. A checklist of 3-5 actionable next steps to move this project forward.
      
      Output format: 
      **Goal:** [Goal]
      
      **Next Steps:**
      - [Step 1]
      - [Step 2]
      ...
      
      Keep it concise and helpful.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Failed to generate ideas. Please try again.";
  }
};

export const expandNoteContent = async (currentContent: string): Promise<string> => {
  if (!apiKey) return "API Key missing.";

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Please continue writing and expanding on the following text. Keep the tone professional but creative:\n\n${currentContent}`;
    
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error expanding content.";
  }
};