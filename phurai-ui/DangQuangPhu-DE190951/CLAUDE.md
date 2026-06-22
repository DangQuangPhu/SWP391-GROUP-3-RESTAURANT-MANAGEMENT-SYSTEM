# GIỚI THIỆU CHUNG (CONTEXT)
Tên dự án: Phūrai - Restaurant Management System.
Loại dự án: Đồ án môn học SWP391.
Mục tiêu hệ thống: Quản lý toàn diện các hoạt động của nhà hàng bao gồm đặt bàn, gọi món, quản lý kho, nhân sự và thống kê doanh thu.
Người dùng mục tiêu (Role): Quản lý (Manager), Nhân viên phục vụ (Staff), Đầu bếp (Chef), Khách hàng (Customer).

# TECH STACK & CONSTRAINTS (LUẬT CODE FRONEND & BACKEND)
1. **Frontend**: React 19 (Vite), JavaScript/JSX, Pure CSS.
   - **Tối kỵ**: Tuyệt đối **KHÔNG cài Tailwind CSS** hay bất kỳ CSS Framework nào khác. Style mọi thứ bằng file CSS thuần.
2. **Backend**: Node.js, Express, mssql (Microsoft SQL Server).
3. **Clean Code**:
   - Chỉ dùng Functional Components & Hooks. Đặt tên PascalCase cho file Component.
   - Luôn sử dụng `async/await`.

# BẢNG CANONICAL - NGUỒN CHÂN LÝ DATABASE
Tuyệt đối chỉ dùng các bảng được định nghĩa sẵn trong `server/database/System_Restaurant.sql`. **CẤM** tự ý tạo bảng mới, **CẤM** đổi tên cột, **CẤM** đổi logic quan hệ nếu không được cho phép.
Các bảng chính: `UserAccounts`, `Roles`, `CustomerProfiles`, `StaffProfiles`, `Reservations`, `RestaurantTables`, `RestaurantAreas`, `ReservationTables`, `PreorderItems`, `Dishes`, `MenuCategories`, `Orders`, `OrderItems`, `KitchenTickets`, `Payments`, `PaymentMethods`, `Promotions`, `Vouchers`, `AuditLogs`, `Notifications`, `Shifts`, `StaffSchedules`, `ShiftLogs`.

# CRITICAL LESSONS LEARNED (BÀI HỌC XƯƠNG MÁU TỪ DỰ ÁN NÀY)
1. Mọi sự kiện đổi trạng thái/duyệt/hủy đơn phải log vào `dbo.AuditLogs`. **KHÔNG** được tạo bảng History table riêng.
2. Cột `dbo.Reservations.customer_id` có thể **NULL** (đối với khách vãng lai) — luôn fallback sử dụng các cột `contact_name` / `contact_phone` / `guest_name` thay vì inner join bắt buộc.
3. Cấu trúc Payload (req.body) phải trùng khớp 100% giữa Frontend và Backend.
4. Mọi thao tác Ghi dữ liệu vào nhiều bảng (vd: Đổi trạng thái đơn + Trừ kho + Giải phóng bàn) **BẮT BUỘC** nằm trong `sql.Transaction` với khối `try/catch + rollback` và trả về thông báo lỗi rõ ràng.
5. **Cấm tuyệt đối** việc viết migration scripts rời rạc hay chạy lệnh `ALTER TABLE` lén lút bên ngoài `System_Restaurant.sql`.
6. **Cấm tuyệt đối** việc tạo các script `.cjs` để patch/replace chuỗi string của file source code khác. Phải mở file đó ra và sửa trực tiếp bằng tính năng diff/edit code.

# YÊU CẦU ĐỐI VỚI AI ASSISTANT (QUY TẮC NỘP PROMPT)
1. **Không code kiểu đoán mò**: Khi user yêu cầu code logic nghiệp vụ, AI PHẢI đi qua 3 bước: Phân tích ngoại lệ $\\rightarrow$ Đặt câu hỏi xử lý rủi ro $\\rightarrow$ Chờ user xác nhận rồi mới được code.
2. **Không phá cấu trúc**: Chỉ chỉnh sửa file được giao. Không đụng chạm vào `App.jsx`, `vite.config.js` hay `package.json` trừ khi task bắt buộc.
3. **Format Báo cáo khi xong task**:
   - **Files changed**: Liệt kê file sửa.
   - **What changed**: Sửa cái gì.
   - **How to test**: Hướng dẫn chạy thử ở Local (ghi rõ lệnh Terminal macOS).
   - **Risks / Notes**: Ghi chú rủi ro nếu có.

# ƯU TIÊN ĐỌC FILE (THỨ TỰ BẮT BUỘC KHI BẮT ĐẦU TASK)
Đây là thứ tự agent PHẢI tuân thủ khi đọc mã nguồn:
1. `CLAUDE.md` — đọc đầu tiên, luôn luôn.
2. `server/database/System_Restaurant.sql` — schema thật, bắt buộc đọc trước khi đụng tới bất kỳ câu SQL query nào.
3. `ARCHITECTURE.md` — hiểu tổng quan hệ thống thực tế đang ở đâu.
4. `PROJECT_REQUIREMENTS.md` — biết task đang làm thuộc phạm vi nào, logic edge cases ra sao.
5. `[file/folder liên quan trực tiếp đến task hiện tại]` — Đọc component cha + controller trước khi thêm hàm.
6. `PROJECT_ARCHITECTURE_TEMPLATE.md` — CHỈ đọc khi cần tham khảo pattern tổng quát (không thường xuyên).
7. `STS_TEMPLATE.md` — CHỈ đọc khi task liên quan đến viết Test Plan.