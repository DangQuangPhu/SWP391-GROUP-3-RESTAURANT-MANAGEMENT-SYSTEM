import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the SDK with the API Key from env file
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateAIResponse = async (userPrompt) => {
    // List of models to try, prioritizing the latest active models working in 2026
    const modelsToTry = [
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash"
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const model = ai.getGenerativeModel({ model: modelName });
            const response = await model.generateContent(userPrompt);
            return response.response.text();
        } catch (error) {
            console.warn(`Connection error with model ${modelName}:`, error.message || error);
            lastError = error;
        }
    }

    console.error("All Gemini API models failed to connect:", lastError);
    throw new Error("Unable to connect to artificial intelligence service.");
};