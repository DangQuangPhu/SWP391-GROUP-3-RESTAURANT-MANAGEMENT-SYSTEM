# TỔNG QUAN KIẾN TRÚC DỰ ÁN FULL-STACK (FEATURE-BASED TEMPLATE)

Tài liệu này là một Khung Kiến Trúc Chuẩn (Template) để thiết kế các dự án Full-stack (React + Node.js) theo mô hình Feature-based. Template này mang tính khái quát, có thể tái sử dụng cho mọi dự án phần mềm tương tự mà không chứa chi tiết cụ thể (không tên bảng, không tên biến riêng) của một sản phẩm nhất định.

## 1. Cấu Trúc Thư Mục (Feature-First)
Thay vì gom nhóm theo loại file (gom tất cả API, gom tất cả components), hãy gom mã nguồn theo **nghiệp vụ (Domain/Feature)** để đảm bảo tính đóng gói (Encapsulation).

\`\`\`text
src/
├── core/               # Hạ tầng dùng chung: http client, constants, configs
├── components/         # Design System: UI primitives (Button, Modal), Layout (Navbar)
├── features/           # Chứa tất cả Feature Domains
│   ├── [domain_name]/  # Ví dụ: auth, billing, inventory
│   │   ├── components/ # Các component giao diện chuyên biệt cho feature này
│   │   ├── hooks/      # Business logic hooks
│   │   ├── services/   # Tầng gọi API (fetch, axios)
│   │   ├── utils/      # Hàm helper chỉ dùng trong feature
│   │   └── pages/      # Route entry points (Tổ hợp layout và logic)
│   └── index.js        # File xuất (export) công khai của feature
└── pages/              # Routing entry (Thực hiện điều hướng lazy-load tới feature pages)
\`\`\`

## 2. Nguyên Tắc Quản Lý Schema (Single Source of Truth)
- Duy trì **MỘT** file SQL/Schema định nghĩa dữ liệu duy nhất làm "Nguồn chân lý" (Source of Truth) ngay từ đầu dự án để toàn team tham chiếu.
- Không cho phép viết các đoạn script migration phân tán lộn xộn trong quá trình dev cục bộ nếu chưa có công cụ quản lý versioning (như Prisma, Flyway) thiết lập chặt chẽ.

## 3. Nguyên Tắc Phân Quyền (Role-Based Access Control)
- **Shared Shell**: Các giao diện người dùng chia sẻ chung một bộ khung (Shell/App) nhưng điều hướng vào các Branch (Nhánh) khác nhau tùy thuộc vào Role.
- Các Route nhạy cảm trên Frontend không chỉ ẩn UI mà phải chặn ngay tại tầng Router (Guards).
- **Backend Protection**: Luôn bọc các API nhạy cảm bằng Middleware xác thực Token và Phân quyền Role. Bất kể Frontend làm gì, Backend là chốt chặn cuối cùng.

## 4. Nguyên Tắc Cập Nhật Trạng Thái & Dữ Liệu
- **Database Transactions**: Bất kỳ hành động nào thay đổi nhiều hơn 1 bảng dữ liệu (Multi-table writes) đều **BẮT BUỘC** nằm trong khối Transaction. Nếu bảng 2 thất bại, bảng 1 phải được Rollback.
- **Audit Logging**: Mọi trạng thái quan trọng bị thay đổi (Duyệt, Hủy, Sửa) đều phải chèn một record vào bảng Nhật ký Audit (Log), lưu lại `old_value` và `new_value`. Không tạo ra các bảng "History" riêng lẻ lặp đi lặp lại thiết kế cho từng thực thể.

## 5. Checklist Bắt Buộc Trước Khi Merge Code
Mỗi Pull Request (PR) phải thỏa mãn:
- [ ] Không Hardcode thông tin nhạy cảm, URL hoặc Text hiển thị sai ngữ cảnh.
- [ ] Xử lý triệt để nhánh Catch (Error) trong các Promise. Phải có UI báo lỗi rõ ràng cho User (Toast/Alert), không im lặng nuốt lỗi.
- [ ] Form Input phải được Validate kỹ (Rỗng, vượt quá độ dài, số âm).
- [ ] Đã test kỹ lưỡng 2 luồng: Happy Path (Chạy đúng) và Edge Case (Lỗi mạng, thao tác sai rẽ nhánh).
