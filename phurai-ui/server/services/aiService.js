import { GoogleGenerativeAI } from "@google/generative-ai";

// Khởi tạo SDK với API Key từ file env
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateAIResponse = async (userPrompt) => {
    try {
        // Sử dụng mô hình gemini-1.5-flash
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const response = await model.generateContent(userPrompt);

        return response.response.text();
    } catch (error) {
        console.error("Lỗi kết nối Gemini API:", error);
        throw new Error("Không thể kết nối với trí tuệ nhân tạo.");
    }
};