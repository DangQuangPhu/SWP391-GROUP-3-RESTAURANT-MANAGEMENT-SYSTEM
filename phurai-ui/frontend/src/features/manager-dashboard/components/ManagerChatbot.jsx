import { useState, useRef, useEffect } from "react";
import { Star, X, ArrowRight, MessageCircle, FileSpreadsheet, FileText, ExternalLink } from "lucide-react";
import { sendChatMessage, askReportAI, exportReport } from "../services/managerApi.js";
import { formatVND } from "@/core/utils/formatCurrency.js";
import { useNavigate } from "react-router-dom";

export function ManagerChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      sender: "bot", 
      text: "Xin chào! Tôi là Trợ lý AI của Phūrai. Tôi có thể tổng hợp báo cáo doanh thu, lượt đặt bàn, món bán chạy, xuất file Excel/PDF... Bạn cần xem thông tin gì?" 
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleExportFile = async (format, intent) => {
    try {
      await exportReport(intent, format);
    } catch (err) {
      alert(err.message || "Lỗi khi xuất file");
    }
  };

  const handleNavigateToReports = (intent, data, grandTotalRow) => {
    // Broadcast event so ReportsSection syncs immediately
    window.dispatchEvent(new CustomEvent("phurai_report_updated", {
      detail: { intent, data, grandTotalRow }
    }));
    navigate("/manager/dashboard?section=reports&tab=export");
    setIsOpen(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    const userMsg = { id: Date.now(), sender: "user", text: userText };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      // 1. Try report AI intent parser first
      const aiRes = await askReportAI(userText);
      setIsTyping(false);

      if (aiRes?.success && aiRes?.intent) {
        const { intent, data, grandTotalRow } = aiRes;
        
        // Broadcast report event to sync with ReportsSection UI
        window.dispatchEvent(new CustomEvent("phurai_report_updated", {
          detail: { intent, data, grandTotalRow }
        }));

        let responseText = `📊 **Đã tổng hợp Báo cáo ${intent.report_type}** (${data?.length || 0} kết quả):\n`;
        if (intent.filters?.area_name) responseText += `• Khu vực: **${intent.filters.area_name}**\n`;
        if (intent.filters?.customer_type) responseText += `• Loại khách: **${intent.filters.customer_type}**\n`;
        if (intent.date_range?.from) responseText += `• Thời gian: **${intent.date_range.from} đến ${intent.date_range.to}**\n`;

        if (grandTotalRow?.total_amount) {
          responseText += `\n💰 **Tổng cộng: ${formatVND(grandTotalRow.total_amount)}**`;
        }

        const botMsg = {
          id: Date.now() + 1,
          sender: "bot",
          text: responseText,
          reportIntent: intent,
          reportData: data,
          grandTotalRow: grandTotalRow
        };

        setMessages(prev => [...prev, botMsg]);
        return;
      }

      // 2. Fallback to standard chat response
      const res = await sendChatMessage(userText);
      const botMsg = {
        id: Date.now() + 1,
        sender: "bot",
        text: res.success ? res.reply : (res.message || "Server connection error.")
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: "bot", text: "Xin lỗi, hiện tại tôi không thể xử lý yêu cầu này." }]);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 h-[32rem] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-[#8c764b] text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Star size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Manager Assistant AI</h3>
                <p className="text-xs text-white/80">Online • Reports & Analytics</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`px-4 py-2.5 max-w-[88%] text-sm rounded-2xl ${msg.sender === "user"
                      ? "bg-[#8c764b] text-white rounded-tr-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                    }`}
                >
                  <div 
                    dangerouslySetInnerHTML={{
                      __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
                    }} 
                  />

                  {/* Interactive Action Buttons inside Bot Message */}
                  {msg.reportIntent && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportFile("excel", msg.reportIntent)}
                          className="flex-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <FileSpreadsheet size={14} /> Xuất Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportFile("pdf", msg.reportIntent)}
                          className="flex-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <FileText size={14} /> Xuất PDF
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigateToReports(msg.reportIntent, msg.reportData, msg.grandTotalRow)}
                        className="w-full px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <ExternalLink size={14} /> Xem dữ liệu chi tiết trên Reports
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-start">
                <div className="px-4 py-3 max-w-[85%] bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
            <input
              type="text"
              placeholder="Nhập câu hỏi hoặc yêu cầu báo cáo..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-[#8c764b] focus:ring-1 focus:ring-[#8c764b] rounded-full px-4 py-2 text-sm transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="w-10 h-10 rounded-full bg-[#8c764b] hover:bg-[#7a6741] disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0 shadow-sm"
            >
              <ArrowRight size={18} className="translate-x-0.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-[#8c764b] hover:bg-[#7a6741] text-white flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-[#8c764b]/30"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
