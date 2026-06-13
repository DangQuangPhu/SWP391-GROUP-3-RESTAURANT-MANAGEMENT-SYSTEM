# KIẾN TRÚC FRONTEND - HỆ THỐNG PHŪRAI (REACT + VITE)

## 1. Sơ đồ Thư mục (Directory Structure)
Dự án sử dụng kiến trúc chia theo tính năng (Feature-based). Mọi file AI tạo ra phải nằm đúng vị trí này:
/src
  /components    # Component dùng chung (Button, Input, Modal). Chứa file .jsx tĩnh.
  /features      # Các cụm tính năng độc lập (Menu, Orders, Tables, Dashboard).
  /hooks         # Logic tái sử dụng (useAuth, useCart).
  /pages         # Các trang chính ghép từ feature và component.
  /services      # Chứa logic gọi API (Axios/Fetch) giao tiếp với Node.js.
  /store         # Quản lý State toàn cục (Zustand/Redux).
  /utils         # Các hàm helper (formatDate, formatCurrency).

## 2. Quy tắc Tương tác dành cho AI (MANDATORY RULES)
Để giúp tôi (lập trình viên) hiểu sâu về dự án, trước khi bạn (AI) tự động tạo file hoặc sinh code cấu trúc, bạn **BẮT BUỘC** phải tuân thủ luồng làm việc sau:

- **BƯỚC 1 - Phân tích Component:** Khi tôi yêu cầu tạo một giao diện (VD: Trang Order), bạn phải liệt kê ra nó sẽ được cấu thành từ những component nhỏ nào.
- **BƯỚC 2 - Hỏi ngược lại (Socratic Method):** Bạn phải đặt cho tôi 1-2 câu hỏi trắc nghiệm hoặc gợi mở về cách chia component hoặc cách quản lý State. 
  - *Ví dụ AI hỏi:* "Tôi định đặt component `OrderList` vào thư mục `features/Orders`, nhưng bạn muốn lưu dữ liệu danh sách order này ở Local State (useState) hay Global State (Store) để dùng chung cho trang khác?"
- **BƯỚC 3 - Chờ xác nhận:** Chỉ sau khi tôi trả lời câu hỏi và chốt phương án, bạn mới được phép bắt tay vào viết code.