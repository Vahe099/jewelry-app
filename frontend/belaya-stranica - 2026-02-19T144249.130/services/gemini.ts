
import { GoogleGenAI, Type } from "@google/genai";
import { AIAction } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export const performAIAction = async (action: AIAction, text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let prompt = "";
  let systemInstruction = "You are a writing assistant for a minimalist writing app called 'Belaya Stranica' (White Page). Your goal is to help the user without being intrusive.";

  switch (action) {
    case 'continue':
      prompt = `Here is a text: "${text}". Please continue the story or thought naturally with just a few sentences. Do not repeat the existing text. Return ONLY the new content.`;
      systemInstruction += " Focus on maintaining the author's voice and tone.";
      break;
    case 'brainstorm':
      prompt = `Based on the following context, suggest 5 creative directions or ideas to expand this writing: "${text}"`;
      systemInstruction += " Provide concise, inspiring bullet points.";
      break;
    case 'refine':
      prompt = `Improve the clarity, flow, and grammar of this text while keeping the original meaning: "${text}"`;
      systemInstruction += " Return ONLY the refined version of the text.";
      break;
    case 'summarize':
      prompt = `Provide a very brief summary (1-2 sentences) of this writing: "${text}"`;
      systemInstruction += " Be concise and capture the core essence.";
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to the AI. Please check your connection.";
  }
};
