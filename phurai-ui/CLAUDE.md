# GIỚI THIỆU CHUNG (CONTEXT)
- **Tên dự án:** Phūrai - Restaurant Management System.
- **Loại dự án:** Đồ án môn học SWP391.
- **Mục tiêu hệ thống:** Quản lý toàn diện các hoạt động của nhà hàng bao gồm đặt bàn, gọi món, quản lý kho, nhân sự và thống kê doanh thu.
- **Người dùng mục tiêu (Role):** Quản lý (Manager), Nhân viên phục vụ (Staff), Đầu bếp (Chef), Khách hàng (Customer).

# TÌNH TRẠNG HIỆN TẠI (CURRENT STATUS)
- **Đang tập trung làm:** Xây dựng bộ khung Frontend (React/Vite) và thiết kế UI/UX cho Dashboard của Quản lý.
- **Tiến độ:** Đã khởi tạo xong project cơ bản, đang trong giai đoạn cấu trúc thư mục và component.

# HỆ THỐNG THIẾT KẾ UI/UX (DESIGN SYSTEM)
- **Màu sắc chủ đạo (Primary):** [Ví dụ: #E63946 (Đỏ thẫm cho F&B)]
- **Màu nền (Background):** [Ví dụ: #FAFAFA (Sáng, sạch sẽ)]
- **Font chữ:** [Ví dụ: Inter hoặc Roboto]
- **Quy tắc UI:** 
  - Giao diện phải mang phong cách hiện đại, tối giản (Minimalist).
  - Sử dụng Tailwind CSS để style. Hạn chế tối đa việc viết file CSS thuần.
  - Các nút bấm (Button) Call-to-Action quan trọng phải có độ tương phản cao và hiệu ứng hover rõ ràng.

# QUY TẮC VIẾT CODE FRONTEND
- **Công nghệ:** React (Vite), JavaScript/JSX, Tailwind CSS.
- **Cấu trúc Thư mục:**
  - `src/components/`: Chứa các component dùng chung (Button, Modal, Table).
  - `src/pages/`: Chứa các trang chính (Dashboard, Menu, Order).
  - `src/assets/`: Chứa hình ảnh, icon.
- **Clean Code:**
  - Luôn sử dụng Functional Components và Hooks. Không dùng Class Components.
  - Đặt tên file theo chuẩn PascalCase (VD: `OrderList.jsx`).
  - Chia nhỏ các component lớn thành các phần dễ quản lý để dễ tái sử dụng.

# YÊU CẦU ĐỐI VỚI AI ASSISTANT (QUAN TRỌNG)
1. **Giải thích rõ ràng:** Phải luôn giải thích logic cụ thể từng bước một trước khi cung cấp code, vì tôi cần hiểu bản chất để trình bày đồ án.
2. **Ưu tiên chạy Local:** Khi làm việc với React/Vite hoặc Node.js, luôn ưu tiên cung cấp hướng dẫn và các thiết lập để chạy thử nghiệm thành công trên môi trường localhost trước tiên.
3. **Lệnh Terminal chính xác:** Môi trường làm việc là **macOS**. Khi cung cấp lệnh Terminal (đặc biệt là các thao tác Git, GitHub, cài đặt npm), phải cung cấp lệnh đầy đủ, chuẩn xác cho macOS và giải thích tác dụng của lệnh đó.
4. **Không tự ý phá vỡ cấu trúc:** Chỉ chỉnh sửa trong phạm vi file được yêu cầu. Tuyệt đối không tự ý xóa, sửa đổi các file cấu hình quan trọng như `vite.config.js` hay `package.json` mà chưa hỏi ý kiến.