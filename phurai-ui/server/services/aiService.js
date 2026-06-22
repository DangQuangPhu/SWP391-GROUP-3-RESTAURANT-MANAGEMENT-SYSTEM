import { GoogleGenAI } from "@google/generative-ai";

// Khởi tạo SDK với API Key từ file env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateAIResponse = async (userPrompt) => {
    try {
        // Sử dụng mô hình gemini-2.5-flash (Nhanh, mượt, phù hợp cho Web app)
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: userPrompt,
        });

        return response.text;
    } catch (error) {
        console.error("Lỗi kết nối Gemini API:", error);
        throw new Error("Không thể kết nối với trí tuệ nhân tạo.");
    }
};