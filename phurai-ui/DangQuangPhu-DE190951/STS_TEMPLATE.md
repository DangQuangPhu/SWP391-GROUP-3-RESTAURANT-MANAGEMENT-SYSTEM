# SOFTWARE TEST SPECIFICATION (STS)
**Dự án**: Phūrai Restaurant Management System
**Tính năng**: [Điền tên tính năng cần test, ví dụ: Đặt bàn, Gọi món]

## 1. Test Plan Identifier
- **Mã Kịch Bản (ID)**: `STS-[TÊN-TÍNH-NĂNG]-[VER]`
- **Ngày lập**: YYYY-MM-DD
- **Người viết**: [Tên Tester / Developer]

## 2. Giới Thiệu (Introduction / Scope)
Mô tả ngắn gọn tính năng này làm gì, phục vụ cho Role nào (Customer, Staff, Manager, v.v.). Phạm vi (Scope) của đợt test này bao trùm những gì (Test luồng đăng nhập, test hiệu năng tải trang, hay test luồng đổi trạng thái CSDL).

## 3. Các Thành Phần Cần Test (Test Items)
Liệt kê các thành phần phần mềm sẽ chịu tác động:
- **API Endpoints**: Các Router bị tác động (vd: `PATCH /api/manager/reservations/:id/confirm`).
- **UI Components**: Các Modal, Button, View (vd: `ReservationActionModal`).
- **Database Tables**: Các bảng dữ liệu (vd: `dbo.AuditLogs`, `dbo.Reservations`).

## 4. Những Gì Được Test / Không Được Test
- **To be Tested**: Các luồng chính (Happy path), các rủi ro đã xác định (Edge cases).
- **Not to be Tested**: UI animations, Load test hệ thống, các luồng dịch vụ bên thứ 3 (Email server giả lập).

## 5. Phương Pháp Test (Test Approach)
Cách tiếp cận quy trình kiểm thử:
- **Unit Test**: Test các logic nghiệp vụ rời rạc (Hàm tính tổng tiền, Giảm giá).
- **Integration Test**: Đảm bảo API liên kết trơn tru với Database (Transaction commit/rollback).
- **E2E Test**: Test luồng UI thực tế (Mô phỏng 1 Customer click đặt bàn, 1 Staff click nhận bàn).

## 6. Tiêu Chí Đạt/Trượt (Pass/Fail Criteria)
- **Pass (Đạt)**: 
  - 100% luồng Happy Path chạy đúng kết quả mong đợi.
  - Không có lỗi `500 Internal Server Error`. 
  - Data cập nhật đúng bảng, không ghi thiếu `AuditLogs`.
- **Fail (Trượt)**: 
  - Ứng dụng bị Crash hoặc vòng lặp vô tận.
  - Tính sai số liệu tài chính (Total Amount, Discount).
  - Vượt rào phân quyền (Role A gọi được API Role B).

## 7. Tài Liệu Bàn Giao (Test Deliverables)
Sau đợt test sẽ bàn giao: Test Scripts, Test Logs, Bug Reports (Hình chụp lỗi).

## 8. Các Tác Vụ Chuẩn Bị (Testing Tasks)
- [ ] Khôi phục lại DB bằng `System_Restaurant.sql` để có data sạch.
- [ ] Chuẩn bị trước các tài khoản Test (1 Admin, 1 Staff, 1 Customer).
- [ ] Liệt kê danh sách Test Cases (TC).

## 9. Môi Trường (Environment Needs)
- **Frontend URL**: `http://localhost:5173`
- **Backend URL**: `http://localhost:5001`
- **Database**: Local SQL Server.

## 10. Trách Nhiệm (Responsibilities)
- **Tester**: Chạy kịch bản test, báo lỗi.
- **Developer**: Support môi trường test, tiếp nhận bug và fix theo log.

## 11. Lịch Trình (Schedule)
- **Ngày bắt đầu**: 
- **Ngày kết thúc dự kiến**: 

## 12. Rủi Ro & Biện Pháp Phòng Ngừa (Risks & Contingencies)
- **Rủi ro**: Lỗi mạng cục bộ làm WebSocket không gửi tín hiệu realtime.
- **Phòng ngừa**: Luôn có cơ chế Fallback (HTTP Polling hoặc Refresh lại trình duyệt).

## 13. Phê Duyệt (Approvals)
- **Người phê duyệt**: [Tên Quản lý / Giảng viên]
- **Ký nhận**: __________________________________
