import { GoogleGenerativeAI } from "@google/generative-ai";

// Khởi tạo SDK với API Key từ file env
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateAIResponse = async (userPrompt) => {
    // Danh sách các model để thử nghiệm, ưu tiên các model mới nhất hoạt động trong năm 2026
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
            console.warn(`Lỗi kết nối model ${modelName}:`, error.message || error);
            lastError = error;
        }
    }

    console.error("Tất cả các model Gemini API đều kết nối thất bại:", lastError);
    throw new Error("Không thể kết nối với trí tuệ nhân tạo.");
};