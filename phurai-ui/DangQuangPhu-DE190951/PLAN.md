## 1. Tech Stack
- **Frontend**: React 19.2.6 (Vite 8.0.12), Pure CSS (không dùng Tailwind hay bất kỳ CSS framework ngoài nào).
- **Backend**: Node.js, Express 5.2.1.
- **Database**: Microsoft SQL Server (sử dụng thư viện `mssql` 12.5.5).
- **Realtime**: Socket.IO 4.8.3.
## 2. Cấu trúc thư mục hiện tại (Thực tế)
\`\`\`text
phurai-ui/
├── server/
│   ├── database/
│   │   └── System_Restaurant.sql (Schema duy nhất - Nguồn chân lý)
│   ├── controllers/
│   │   └── managerReservationController.js, authController.js...
│   ├── routes/
│   │   └── auth.js, dev.routes.js, ...
│   ├── services/
│   │   └── shiftResolver.js
│   ├── index.js
│   ├── db.js
│   ├── email.js
│   └── socket.js
└── src/
    ├── App.jsx (God object: Xử lý routing chính, auth session, global state)
    ├── index.css
    ├── api/ (Shared HTTP fetch)
    ├── components/ (Shared UI & Domain UI cũ)
    │   ├── common/, layout/, notifications/
    ├── features/ (Kiến trúc mới đang migrate)
    │   ├── auth/, content/, gift-cards/, home/, manager-dashboard/,
    │   ├── menu/, profile/, reservations/, staff-dashboard/, table-session/
    ├── pages/ (Thin routing layer trỏ vào features)
    └── styles/
\`\`\`
## 3. Database Schema Tổng Quan
Lấy từ thực tế `System_Restaurant.sql`. Không có các bảng rác.
- **Tài khoản & Phân quyền**: `Roles`, `UserAccounts`, `CustomerProfiles`, `StaffProfiles`, `OtpTokens`.
- **Hạ tầng nhà hàng**: `RestaurantAreas`, `RestaurantTables`, `Shifts`, `StaffSchedules`, `ShiftLogs`.
- **Thực đơn**: `MenuCategories`, `Dishes`, `DishImages`.
- **Đặt bàn**: `Reservations` (cho phép customer_id NULL), `ReservationTables`, `PreorderItems`.
- **Đơn hàng & Bếp**: `QROrderSessions`, `Orders`, `OrderItems`, `KitchenTickets`.
- **Tài chính & Khuyến mãi**: `PaymentMethods`, `Payments`, `Promotions`, `Vouchers`, `VoucherRedemptions`, `BillSplits`.
- **Nhật ký & Báo cáo**: `AuditLogs` (Lưu lịch sử thay đổi quan trọng), `Notifications`, `CustomerReviews`, `RecommendationLogs`, `ReportSnapshots`.
## 4. Luồng Nghiệp Vụ Chính
1. **Đặt bàn (Booking)**: Khách hàng (Customer) gửi yêu cầu $\\rightarrow$ Lưu vào `Reservations` (Trạng thái *Pending*).
2. **Duyệt đặt bàn**: Quản lý (Manager) xác nhận $\\rightarrow$ Đổi trạng thái `Reservations` thành *Confirmed* $\\rightarrow$ Gán bàn (`ReservationTables`) $\\rightarrow$ Trạng thái bàn thành *Reserved*. (Tất cả bọc trong SQL Transaction).
3. **Nhận khách (Check-in)**: Nhân viên (Staff) đón khách $\\rightarrow$ `Reservations` thành *Checked In* $\\rightarrow$ Bàn thành *Occupied*.
4. **Gọi món**: Nhân viên nhập món $\\rightarrow$ Ghi vào `Orders` & `OrderItems` $\\rightarrow$ Phát sự kiện Send to Kitchen.
5. **Chế biến**: Bếp nhận `KitchenTickets` $\\rightarrow$ Đổi trạng thái Preparing $\\rightarrow$ Ready.
6. **Thanh toán**: Khách thanh toán $\\rightarrow$ Ghi `Payments` $\\rightarrow$ Bàn chuyển sang *Cleaning* rồi về *Available*.
## 5. Role-based Routing (Theo App.jsx)
Hệ thống sử dụng các hàm kiểm tra `isManagerUser()` và `isStaffPortalUser()` để rẽ nhánh.
- **Customer**: Truy cập các trang `/`, `/menus`, `/reservations`, `/profile`.
- **Restaurant / Kitchen Staff**: Truy cập `/staff`. Nếu Manager cố vào `/staff`, sẽ bị Redirect.
- **Manager / Admin**: Truy cập `/manager/dashboard`. Nếu Staff cố vào, sẽ bị chặn bởi Route Guard.
## 6. Realtime / Socket.IO Setup
Hệ thống chạy trên port 5001 (Server) và phát sự kiện qua các Room:
- **Rooms**: `room:staff`, `room:manager`, `customer_{id}`, `room:staff:{shift_name}`.
- **Events (Server Emit)**: 
  - `reservation:confirmed`
  - `reservation:status_updated`
  - `reservation_updated`
  - `shift_booking_update` (Đẩy dữ liệu bàn trực tiếp cho Staff thuộc ca làm việc hiện tại)
  - `kitchen:new_preorder`
## 7. Authentication Flow
- Cơ chế Token-based, lưu thông tin vào `localStorage` (`phurai_auth_user`).
- API giao tiếp qua `src/api/httpClient.js` đính kèm Header `Authorization: Bearer <token>`.
- React Hook `useUserProfile` quản lý việc đồng bộ hóa dữ liệu user từ Backend.
- Middleware backend: `requireAuth`, `requireManager`, `requireStaff` áp dụng cho từng Router.
## 8. Danh Sách API Endpoints Hiện Có
- **Xác thực (Auth)**: `/api/auth/login`, `/api/auth/register`, `/api/auth/verify`.
- **Profile**: `/api/profile/me`, `/api/profile/update`.
- **Quản lý Đặt bàn (Manager)**: 
  - `GET /api/manager/reservations/pending`
  - `PATCH /api/manager/reservations/:id/confirm`
  - `PATCH /api/manager/reservations/:id/reject`
- **Vận hành (Staff)**: 
  - `GET /api/staff/reservations/today`
  - `PATCH /api/staff/reservations/:id/checkin`
## 9. Known Issues & Technical Debt (Sự Thật Về Codebase)
- **App.jsx đang ôm đồm**: File `App.jsx` chịu trách nhiệm render Modal Auth, fetch UserProfile, handle Route, quản lý Toast, quá đồ sộ và cần tách dần các context/provider ra riêng.
- **Database Connection Pool**: Thư viện `mssql` dễ bị treo Transaction nếu trong khối `try/catch` không thực thi `transaction.rollback()` đúng chuẩn. (Đã fix ở module Manager nhưng có rủi ro nếu người mới code).
- **Rác cấu trúc cũ**: Rất nhiều file cũ nằm rải rác ở `src/components/` chưa được migrate hoàn toàn sang mô hình `features/`.
- **Dữ liệu Mock trên Dashboard**: Giao diện Overview của Manager hiện tại đang map dữ liệu stat cứng (Mock), chưa nối hoàn toàn vào bảng `ReportSnapshots` hay tính sum từ `Orders`. Mới chỉ có flow Đặt bàn là hoàn toàn xài dữ liệu thật (Real data).
No file moves should happen until you approve the wave number.
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
Không tự ý phá vỡ cấu trúc: Chỉ chỉnh sửa trong phạm vi file được yêu cầu. Tuyệt đối không tự ý xóa, sửa đổi các file cấu hình quan trọng như vite.config.js hay package.json mà chưa hỏi ý kiến.
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
PHŪRAI RESTAURANT OPERATIONS MANAGEMENT SYSTEM
BUSINESS LOGIC & AI WORKFLOW RULES
1. Mục đích tài liệu
Tài liệu này mô tả các yêu cầu nghiệp vụ cốt lõi của hệ thống Phūrai Restaurant Operations Management System và các quy tắc bắt buộc dành cho AI khi hỗ trợ phân tích, thiết kế hoặc viết code.
Mục tiêu chính:
Chuẩn hóa nghiệp vụ cho các module Menu, Tables, Orders và Dashboard.
Giúp AI không code theo kiểu đoán mò.
Bắt buộc AI phải phân tích ngoại lệ trước khi triển khai logic.
Giúp người phát triển rèn luyện tư duy phân tích nghiệp vụ, luồng dữ liệu và xử lý rủi ro.
--------------------------------------------------------------------------------
2. Phạm vi hệ thống
Hệ thống Phūrai bao gồm các nhóm chức năng chính:
Nhóm chức năng
Mô tả
Customer Portal
Khách hàng xem menu, đặt bàn, đặt món bằng QR, thanh toán mock, gửi feedback
Staff Portal
Nhân viên xử lý bàn, nhận order, gửi bếp, cập nhật trạng thái phục vụ
Manager Dashboard
Quản lý thực đơn, bàn, đơn hàng, nhân sự, khuyến mãi, thống kê doanh thu
Admin/System
Quản lý vai trò, cấu hình hệ thống, kiểm soát quyền và nhật ký hoạt động
Tài liệu này tập trung trước vào các nghiệp vụ cốt lõi:
Quản lý Thực đơn
Quản lý Bàn
Xử lý Đơn hàng
Thống kê Dashboard
Quy tắc AI khi triển khai logic
--------------------------------------------------------------------------------
3. Các Module Tính năng Cốt lõi
3.1. Quản lý Thực đơn — Menu Management
3.1.1. Mục tiêu
Module Menu dùng để quản lý toàn bộ món ăn, đồ uống và combo trong nhà hàng.
Người quản lý có thể:
Xem danh sách món ăn.
Phân loại món theo category.
Thêm món mới.
Chỉnh sửa thông tin món.
Cập nhật trạng thái món.
Ẩn hoặc ngừng bán món.
Xóa món nếu không ảnh hưởng tới dữ liệu vận hành.
--------------------------------------------------------------------------------
3.1.2. Dữ liệu cơ bản của món ăn
Mỗi món ăn nên có các trường chính:
Trường
Mô tả
dishId
ID món ăn
dishName
Tên món
categoryId
Loại món
description
Mô tả món
price
Giá bán
costPrice
Giá vốn
imageUrl
Ảnh món
isAvailable
Còn bán hay hết
isRecommended
Có phải món đề xuất không
spicyLevel
Độ cay
prepTimeMin
Thời gian chuẩn bị
status
Active / Hidden / Deleted
--------------------------------------------------------------------------------
3.1.3. Quy tắc nghiệp vụ
MENU-001 — Hiển thị món ăn
Hệ thống chỉ hiển thị cho khách hàng các món có trạng thái:
isAvailable = true
status = Active
Món bị ẩn hoặc ngừng bán không được hiển thị ở Customer Portal.
--------------------------------------------------------------------------------
MENU-002 — Thêm món mới
Khi thêm món mới, hệ thống phải kiểm tra:
Tên món không được rỗng.
Giá bán phải lớn hơn 0.
Category phải tồn tại.
Ảnh món nếu có phải đúng định dạng.
Món mới mặc định là Active.
--------------------------------------------------------------------------------
MENU-003 — Sửa món ăn
Khi sửa món ăn, hệ thống cần đảm bảo:
Không làm thay đổi lịch sử các đơn hàng cũ.
Nếu thay đổi giá món, giá mới chỉ áp dụng cho đơn hàng mới.
Đơn hàng đã tạo phải giữ giá tại thời điểm order.
Ví dụ:
Hôm qua khách gọi Sushi giá 120.000đ.
Hôm nay Manager đổi giá thành 150.000đ.
Hóa đơn hôm qua vẫn phải giữ 120.000đ.
--------------------------------------------------------------------------------
MENU-004 — Xóa món ăn
Không nên xóa cứng món ăn nếu món đó đã từng xuất hiện trong đơn hàng, hóa đơn hoặc báo cáo.
Ưu tiên dùng:
status = Hidden
hoặc:
isAvailable = false
thay vì xóa trực tiếp khỏi database.
--------------------------------------------------------------------------------
MENU-005 — Hết món
Khi món hết hàng:
Staff hoặc Manager có thể chuyển isAvailable = false.
Món không được thêm vào order mới.
Nếu món đã nằm trong order đang xử lý, hệ thống cần cảnh báo trước khi cập nhật.
--------------------------------------------------------------------------------
3.1.4. Edge cases cần chú ý
Nhân viên thêm món vào order nhưng món vừa bị Manager chuyển sang hết hàng.
Manager xóa món đang nằm trong hóa đơn chưa thanh toán.
Giá món bị sửa trong lúc khách đang đặt món.
Category bị xóa nhưng vẫn còn món thuộc category đó.
API menu lỗi nhưng giao diện vẫn đang dùng dữ liệu mock cũ.
--------------------------------------------------------------------------------
3.2. Quản lý Bàn — Table Management
3.2.1. Mục tiêu
Module Tables dùng để quản lý sơ đồ bàn, trạng thái bàn và luồng sử dụng bàn trong nhà hàng.
Các trạng thái cơ bản:
Trạng thái
Ý nghĩa
Available
Bàn trống
Reserved
Đã đặt trước
Occupied
Đang phục vụ
Cleaning
Đang dọn
Disabled
Tạm ngưng sử dụng
--------------------------------------------------------------------------------
3.2.2. Dữ liệu cơ bản của bàn
Trường
Mô tả
tableId
ID bàn
tableName
Tên bàn
capacity
Số người tối đa
area
Khu vực
status
Trạng thái bàn
isVip
Có phải bàn VIP không
currentOrderId
Đơn hàng hiện tại nếu có
reservationId
Mã đặt bàn nếu có
--------------------------------------------------------------------------------
3.2.3. Quy tắc nghiệp vụ
TABLE-001 — Bàn trống
Bàn có thể nhận khách khi:
status = Available
currentOrderId = null
--------------------------------------------------------------------------------
TABLE-002 — Bàn đã đặt trước
Bàn có trạng thái Reserved không được tự động gán cho khách walk-in nếu chưa có xác nhận từ Manager hoặc Staff.
--------------------------------------------------------------------------------
TABLE-003 — Bàn đang phục vụ
Khi khách được check-in hoặc Staff bắt đầu tạo order:
status = Occupied
Bàn đang phục vụ không được nhận thêm reservation khác trong cùng khung giờ.
--------------------------------------------------------------------------------
TABLE-004 — Thanh toán xong
Sau khi hóa đơn được thanh toán, bàn không nên chuyển ngay về Available.
Luồng đúng nên là:
Occupied → Cleaning → Available
Điều này giúp phản ánh thực tế nhà hàng cần thời gian dọn bàn.
--------------------------------------------------------------------------------
TABLE-005 — Bàn bị khóa
Bàn có trạng thái Disabled không được:
Đặt trước.
Gán khách.
Tạo order mới.
Hiển thị như bàn có thể sử dụng.
--------------------------------------------------------------------------------
3.2.4. Edge cases cần chú ý
Hai nhân viên cùng chọn một bàn trống cùng lúc.
Khách đã đặt bàn nhưng đến trễ.
Bàn đang có order chưa thanh toán nhưng Staff cố chuyển về Available.
Bàn bị Manager disabled trong khi đang có reservation.
Số khách vượt quá capacity của bàn.
--------------------------------------------------------------------------------
3.3. Xử lý Đơn hàng — Order Management
3.3.1. Mục tiêu
Module Orders xử lý toàn bộ luồng gọi món:
Chọn bàn → Thêm món → Tính tổng tiền → Gửi bếp → Phục vụ → Thanh toán
--------------------------------------------------------------------------------
3.3.2. Trạng thái đơn hàng
Trạng thái
Ý nghĩa
Draft
Đơn mới tạo, chưa gửi bếp
SentToKitchen
Đã gửi bếp
Preparing
Bếp đang chuẩn bị
Ready
Món đã sẵn sàng
Served
Đã phục vụ
PaymentPending
Chờ thanh toán
Paid
Đã thanh toán
Cancelled
Đã hủy
--------------------------------------------------------------------------------
3.3.3. Dữ liệu cơ bản của order
Trường
Mô tả
orderId
ID đơn hàng
tableId
Bàn liên kết
customerId
Khách hàng nếu có
staffId
Nhân viên tạo đơn
status
Trạng thái đơn
subtotal
Tổng tiền món
discountAmount
Số tiền giảm
taxAmount
Thuế nếu có
serviceCharge
Phí dịch vụ nếu có
totalAmount
Tổng cuối cùng
paymentStatus
Trạng thái thanh toán
createdAt
Thời gian tạo
updatedAt
Thời gian cập nhật
--------------------------------------------------------------------------------
3.3.4. Quy tắc nghiệp vụ
ORDER-001 — Tạo đơn hàng
Chỉ được tạo order khi bàn hợp lệ:
table.status = Available
hoặc:
table.status = Reserved nhưng khách đã check-in
Sau khi tạo order, bàn chuyển sang:
Occupied
--------------------------------------------------------------------------------
ORDER-002 — Thêm món vào order
Chỉ được thêm món nếu:
Order chưa bị thanh toán.
Order chưa bị hủy.
Món đang còn bán.
Số lượng lớn hơn 0.
Món tồn tại trong database.
--------------------------------------------------------------------------------
ORDER-003 — Giá món trong order
Khi thêm món vào order, hệ thống phải lưu lại giá tại thời điểm thêm món.
Không được chỉ tham chiếu giá hiện tại trong bảng Dishes.
Ví dụ nên lưu:
dishId
dishNameSnapshot
unitPriceSnapshot
quantity
lineTotal
Lý do: nếu Manager đổi giá món sau đó, hóa đơn cũ không bị sai.
--------------------------------------------------------------------------------
ORDER-004 — Tính tổng tiền
Công thức tổng quát:
subtotal = tổng lineTotal của order items
discountAmount = giảm giá từ voucher hoặc promotion
taxAmount = thuế nếu có
serviceCharge = phí dịch vụ nếu có
totalAmount = subtotal - discountAmount + taxAmount + serviceCharge
Điều kiện:
totalAmount không được nhỏ hơn 0.
Voucher không được áp dụng quá số lần cho phép.
Voucher hết hạn không được áp dụng.
Voucher chỉ áp dụng cho đơn đủ điều kiện.
--------------------------------------------------------------------------------
ORDER-005 — Gửi bếp
Khi order được gửi bếp:
status = SentToKitchen
Sau khi gửi bếp:
Không nên cho xóa order trực tiếp.
Nếu khách đổi món, cần tạo hành động update/cancel item có ghi log.
Kitchen ticket phải được tạo tương ứng.
--------------------------------------------------------------------------------
ORDER-006 — Hủy món
Một món trong order có thể bị hủy nếu:
Chưa gửi bếp.
Hoặc bếp/chế biến xác nhận chưa làm món đó.
Nếu món đã chế biến, cần Manager xác nhận hủy.
--------------------------------------------------------------------------------
ORDER-007 — Thanh toán
Chỉ được thanh toán khi:
Order chưa bị hủy.
Order có ít nhất một món hợp lệ.
Tổng tiền đã được tính chính xác.
Không còn lỗi đồng bộ dữ liệu quan trọng.
Sau khi thanh toán:
paymentStatus = Paid
order.status = Paid
table.status = Cleaning
--------------------------------------------------------------------------------
3.3.5. Edge cases cần chú ý
Nhân viên bấm thanh toán nhưng mạng bị rớt.
Hai nhân viên cùng sửa một order.
Món bị hết hàng sau khi đã thêm vào order nhưng chưa gửi bếp.
Voucher hết hạn trong lúc khách đang thanh toán.
Order đã thanh toán nhưng Staff vẫn cố thêm món.
Bàn bị đổi trong lúc order đang xử lý.
Kitchen chưa nhận được ticket nhưng order đã chuyển trạng thái.
API trả lỗi nhưng UI vẫn hiển thị thanh toán thành công.
--------------------------------------------------------------------------------
3.4. Thống kê — Dashboard
3.4.1. Mục tiêu
Dashboard giúp Manager theo dõi tình hình hoạt động nhà hàng.
Các số liệu cơ bản:
Doanh thu trong ngày.
Số đơn đã thanh toán.
Số đơn đang xử lý.
Tỷ lệ bàn đang sử dụng.
Món ăn bán chạy.
Đặt bàn hôm nay.
Doanh thu theo giờ/ngày.
Trạng thái bàn theo khu vực.
--------------------------------------------------------------------------------
3.4.2. KPI đề xuất
KPI
Mô tả
Daily Revenue
Doanh thu trong ngày
Paid Orders
Số đơn đã thanh toán
Active Orders
Số đơn đang phục vụ
Available Tables
Số bàn trống
Reserved Tables
Số bàn đã đặt
Best Sellers
Món bán chạy
Average Order Value
Giá trị trung bình mỗi đơn
--------------------------------------------------------------------------------
3.4.3. Quy tắc nghiệp vụ
DASH-001 — Doanh thu
Doanh thu chỉ tính từ các đơn có:
paymentStatus = Paid
Không tính đơn Draft, Cancelled hoặc PaymentPending.
--------------------------------------------------------------------------------
DASH-002 — Món bán chạy
Món bán chạy nên tính theo:
tổng quantity đã bán từ các order đã thanh toán
Không tính món trong order bị hủy.
--------------------------------------------------------------------------------
DASH-003 — Dữ liệu realtime
Nếu backend chưa hỗ trợ realtime, dashboard có thể dùng polling hoặc refresh thủ công.
Không được giả lập realtime nếu dữ liệu thật không cập nhật.
--------------------------------------------------------------------------------
DASH-004 — Mock data
Nếu API lỗi và dùng mock fallback, UI phải có dấu hiệu nhận biết:
source = mock
hoặc hiển thị cảnh báo nhỏ cho Developer/Manager.
Không được để người dùng hiểu nhầm mock data là dữ liệu thật.
--------------------------------------------------------------------------------
3.4.4. Edge cases cần chú ý
Backend lỗi nhưng dashboard vẫn hiển thị dữ liệu mock.
Đơn đã refund nhưng doanh thu chưa trừ lại.
Thanh toán thành công nhưng dashboard chưa cập nhật.
Múi giờ sai khiến doanh thu hôm nay bị lệch ngày.
Dashboard tính cả order chưa thanh toán.
--------------------------------------------------------------------------------
4. Role & Permission Rules
4.1. Customer
Customer được phép:
Xem menu.
Đặt bàn.
Xem lịch sử đặt bàn.
Đặt món qua QR nếu có session hợp lệ.
Thanh toán mock.
Gửi feedback.
Customer không được phép:
Vào /staff.
Vào /manager.
Sửa menu.
Sửa trạng thái bàn.
Xem doanh thu.
--------------------------------------------------------------------------------
4.2. Restaurant Staff
Restaurant Staff được phép:
Xem bàn.
Check-in reservation.
Tạo order.
Thêm món vào order.
Gửi bếp.
Cập nhật trạng thái phục vụ.
Thanh toán đơn.
Restaurant Staff không được phép:
Xem báo cáo doanh thu chi tiết.
Quản lý nhân sự.
Xóa món khỏi menu.
Sửa quyền người dùng.
Cấu hình hệ thống.
--------------------------------------------------------------------------------
4.3. Kitchen Staff
Kitchen Staff được phép:
Xem kitchen tickets.
Cập nhật trạng thái món: Preparing, Ready.
Báo hết món.
Kitchen Staff không được phép:
Thanh toán.
Sửa hóa đơn.
Xem doanh thu.
Quản lý bàn ở mức Manager.
--------------------------------------------------------------------------------
4.4. Manager
Manager được phép:
Quản lý menu.
Quản lý bàn.
Xem dashboard.
Xem báo cáo.
Quản lý voucher.
Quản lý lịch làm việc nhân viên.
Xử lý hủy món/hủy đơn cần phê duyệt.
Duyệt refund nếu hệ thống có refund flow.
--------------------------------------------------------------------------------
4.5. Admin
Admin được phép:
Quản lý role.
Quản lý permission.
Quản lý cấu hình hệ thống.
Xem logs.
Khóa/mở tài khoản.
Cấu hình hệ thống nhưng không nhất thiết xử lý nghiệp vụ hằng ngày.
--------------------------------------------------------------------------------
5. Quy tắc Route
5.1. Route đề xuất
Route
Role được truy cập
Mục đích
/
Public / Customer
Trang chủ
/menu
Public / Customer
Xem menu
/reservation
Customer
Đặt bàn
/staff
Restaurant Staff, Kitchen Staff
Vận hành nhà hàng
/manager
Manager, Admin
Dashboard quản lý
/admin
Admin
Quản trị hệ thống nếu tách riêng
--------------------------------------------------------------------------------
5.2. Route guard
Nếu user chưa đăng nhập:
redirect → /login
Nếu user không đủ quyền:
show AccessDenied
Không được chỉ ẩn nút trên UI. Backend API cũng phải kiểm tra quyền.
--------------------------------------------------------------------------------
6. Quy tắc Tương tác Bắt buộc dành cho AI
6.1. Nguyên tắc chung
Khi người dùng yêu cầu AI viết code cho bất kỳ logic nghiệp vụ nào, AI không được code ngay.
AI bắt buộc phải đi qua 3 bước:
Bước 1: Rà soát ngoại lệ
Bước 2: Đặt câu hỏi xử lý rủi ro
Bước 3: Chờ xác nhận
Chỉ sau khi người dùng trả lời rõ cách xử lý, AI mới được viết code.
--------------------------------------------------------------------------------
6.2. BƯỚC 1 — Rà soát ngoại lệ
Trước khi code, AI phải tự phân tích ít nhất 2 edge cases.
Ví dụ:
Dữ liệu thiếu hoặc sai.
Người dùng thao tác sai.
API bị lỗi.
Dữ liệu bị thay đổi bởi người khác.
Trạng thái không hợp lệ.
Quyền truy cập không đủ.
Thanh toán hoặc tính tiền bị lệch.
Order bị cập nhật đồng thời bởi nhiều nhân viên.
AI phải trình bày rõ:
Logic chính là gì?
Dữ liệu đầu vào là gì?
Dữ liệu đầu ra là gì?
Có thể lỗi ở đâu?
Trạng thái nào không được phép xảy ra?
--------------------------------------------------------------------------------
6.3. BƯỚC 2 — Đặt câu hỏi xử lý rủi ro
AI phải hỏi người dùng cách xử lý các tình huống rủi ro.
Mỗi câu hỏi nên có lựa chọn cụ thể.
Ví dụ 1:
Nếu nhân viên bấm thanh toán nhưng API bị lỗi mạng, bạn muốn:
A. Hiển thị Toast lỗi và yêu cầu bấm lại
B. Lưu tạm đơn vào LocalStorage để đồng bộ sau
C. Chuyển đơn sang trạng thái PaymentPending
Ví dụ 2:
Khi Manager xóa một món ăn nhưng món đó đang nằm trong hóa đơn chưa thanh toán, bạn muốn:
A. Cấm xóa
B. Chỉ cho chuyển món sang Hidden
C. Cho xóa nhưng giữ snapshot trong OrderItems
Ví dụ 3:
Nếu hai nhân viên cùng sửa một order, bạn muốn:
A. Lần cập nhật sau ghi đè lần trước
B. Backend kiểm tra updatedAt để chống conflict
C. Khóa order khi một nhân viên đang chỉnh sửa
--------------------------------------------------------------------------------
6.4. BƯỚC 3 — Chờ xác nhận
AI phải chờ người dùng trả lời.
Không được tự chọn phương án thay người dùng nếu logic có ảnh hưởng tới nghiệp vụ, dữ liệu hoặc quyền truy cập.
Sau khi người dùng xác nhận, AI mới được:
Viết code.
Sửa file.
Tạo component.
Tạo API.
Refactor logic.
Thêm validation.
Thêm xử lý lỗi.
--------------------------------------------------------------------------------
7. AI Coding Rules
7.1. Không sửa lan man
AI chỉ được sửa đúng phạm vi task.
Không được tự ý sửa:
Navbar
Footer
Customer Portal
Auth flow
Reservation flow
CSS global
Package dependencies
Database schema
trừ khi task yêu cầu rõ.
--------------------------------------------------------------------------------
7.2. Không cài package mới nếu chưa được phép
AI không được tự động chạy:
npm install
hoặc thêm dependency vào package.json nếu chưa được người dùng xác nhận.
--------------------------------------------------------------------------------
7.3. Không dùng mock data như dữ liệu thật
Nếu dùng mock fallback, phải ghi rõ:
source = mock
Hoặc hiển thị cảnh báo cho developer.
--------------------------------------------------------------------------------
7.4. Không phá route hiện có
Nếu thêm /manager, phải giữ /staff hoạt động bình thường.
Không được đổi route cũ nếu chưa có yêu cầu.
--------------------------------------------------------------------------------
7.5. Phải báo cáo sau khi code
Sau khi code, AI phải báo:
Files changed:
- file 1
- file 2
What changed:
- thay đổi 1
- thay đổi 2
How to test:
- bước test 1
- bước test 2
Risks / Notes:
- rủi ro còn lại nếu có
--------------------------------------------------------------------------------
8. Prompt bắt buộc khi yêu cầu AI code logic
Khi yêu cầu AI code nghiệp vụ, nên dùng mẫu sau:
Trước khi code, hãy áp dụng PHŪRAI BUSINESS LOGIC RULES.
Task:
[Mô tả task cần làm]
Bắt buộc:
1. Không code ngay.
2. Phân tích logic chính.
3. Nêu ít nhất 2 edge cases.
4. Hỏi tôi cách xử lý các edge cases đó.
5. Chờ tôi xác nhận rồi mới code.
6. Không sửa lan man ngoài phạm vi task.
--------------------------------------------------------------------------------
9. Ví dụ áp dụng
9.1. Task: Tính tổng tiền order
AI phải hỏi trước:
Nếu voucher làm tổng tiền nhỏ hơn 0 thì xử lý thế nào?
A. Ép totalAmount = 0
B. Báo lỗi voucher không hợp lệ
C. Cho phép âm để ghi nhận credit
Nếu món trong order bị đổi giá sau khi thêm vào giỏ thì xử lý thế nào?
A. Giữ giá snapshot lúc thêm món
B. Cập nhật theo giá mới nhất
C. Hỏi Staff trước khi thanh toán
--------------------------------------------------------------------------------
9.2. Task: Xóa món khỏi menu
AI phải hỏi trước:
Nếu món đã tồn tại trong order cũ thì xử lý thế nào?
A. Cấm xóa cứng, chỉ cho Hidden
B. Cho xóa cứng nếu không có order chưa thanh toán
C. Cho xóa nhưng giữ snapshot trong order item
--------------------------------------------------------------------------------
9.3. Task: Đổi trạng thái bàn
AI phải hỏi trước:
Nếu bàn đang có order chưa thanh toán mà Staff muốn chuyển về Available thì xử lý thế nào?
A. Cấm chuyển
B. Cho chuyển nếu Manager xác nhận
C. Tự động chuyển order sang cancelled
--------------------------------------------------------------------------------
10. Kết luận
Hệ thống Phūrai phải ưu tiên:
Đúng nghiệp vụ nhà hàng.
Không mất dữ liệu.
Không tính sai tiền.
Không phá lịch sử hóa đơn.
Không cho user vượt quyền.
Không để AI code khi chưa phân tích ngoại lệ.
Mọi logic quan trọng phải được xử lý theo quy trình:
Analyze → Edge Cases → Ask → Confirm → Code → Test → Report
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
