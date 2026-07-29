# PHŪRAI RESTAURANT OPERATIONS MANAGEMENT SYSTEM
## BUSINESS LOGIC, STATUS FLOWS & API SPECIFICATIONS
**Tác giả / Sinh viên:** Đặng Quang Phú (DE190951)  
**Dự án:** SWP391 - Group 3 - Phūrai Restaurant Management System  
**Cập nhật mới nhất:** 28/07/2026 (Đồng bộ 100% với Codebase MSSQL, Socket.IO & API Specs)

---

## 1. MỤC ĐÍCH TÀI LIỆU
Tài liệu này quy định chi tiết:
1. **Luồng chuyển đổi trạng thái (Status Lifecycles)** của Đơn đặt bàn, Bàn ăn, Đơn hàng và Thẻ chế biến Bếp (KDS) giữa 5 phân hệ người dùng: **Customer**, **Restaurant Staff**, **Kitchen Staff**, **Manager** và **Admin**.
2. **Quy chuẩn API Specs (Request Payload & Response Structure)** của từng hành động trên hệ thống.
3. **Cơ chế xử lý tự động ngầm (Automated Sweeper & Real-time Sockets)**.

---

## 2. CHUYỂN ĐỔI TRẠNG THÁI (STATUS LIFECYCLES) THEO TỪNG VAI TRÒ

### 2.1. Ma Trận Trạng Thái Đặt Bàn (Reservation Status Matrix)

| Trạng thái Backend (`reservation_status`) | Giao diện Customer hiển thị | Giao diện Staff / Manager hiển thị | Điều kiện / Hành động kích hoạt | Tác động tới Bàn (`table_status`) |
| :--- | :--- | :--- | :--- | :--- |
| `Pending Request` | `Pending Approval` | `Pending Approval` | Khách tạo đơn cần Manager duyệt (đơn đông người / khu vực đặc biệt). | Bàn giữ tạm 15m (`Booked`) |
| `Awaiting Deposit` | `Awaiting Deposit` | `Awaiting Deposit` | Khách đặt bàn yêu cầu đặt cọc tiền trước. | Bàn giữ tạm 15m (`Booked`) |
| `Await Check-in` / `Confirmed` | `Confirmed (Await Check-in)` | `Await Check-in` | Đơn đã được xác nhận, gán bàn sẵn sàng đón khách. | Bàn chuyển `Reserved` (Xanh dương) |
| `Dining` / `Check-in` | `Dining` | `Dining / Checked-in` | Staff bấm **Check-in** khi khách đến nhà hàng. | Bàn chuyển `Occupied` (Đỏ) |
| `Completed` | `Completed` | `Completed` | Khách ăn xong, hóa đơn đã được thanh toán tiền. | Bàn chuyển `Cleaning` → `Available` |
| `Cancelled` | `Cancelled` | `Cancelled` | Khách hủy đơn, Manager từ chối hoặc hết 15m cọc. | Giải phóng Bàn về `Available` |
| `No Show` | `No Show` | `No Show` | Quá **30 phút** so với giờ `Start Time` mà chưa Check-in (`sweepNoShows()`) hoặc Staff chọn Mark No Show. | Giải phóng Bàn về `Available` |
| `has_pending_request = 1` | `Edit Requested` / `Cancellation Requested` | `Pending Edit/Cancel Request` | Khách gửi yêu cầu Hủy/Sửa đơn từ `/my-reservations`. | Giữ trạng thái cũ tới khi Manager duyệt |

---

### 2.2. Quy Tắc Nút Edit & Đếm Nước Real-time (Customer Edit & Countdown Rules)

1. **Thiết Kế Card Đặt Bàn Khách Hàng (`/my-reservations`)**:
   - Ẩn nhãn `Table ID` và Ca ăn khỏi dòng tổng quan bên ngoài card. Dòng bên ngoài chỉ hiển thị mã `Reservation #100121`, Bộ đếm thời gian Check-in, Trạng thái đơn và Nút hành động.
   - Toàn bộ thông tin chi tiết Bàn và Ca ăn được hiển thị đầy đủ bên trong Modal **View Details**.

2. **Bộ Đếm Thời Gian Real-time (Live Real-Time Countdown Timer)**:
   - **Còn thời gian (`diffMs > 0`)**: Badge màu Vàng Kim `"⏱️ Arrive in: Xh Ym left"`.
   - **Quá giờ (Grace Period 30m)**: Badge màu Đỏ nhấp nháy `"⚠️ Grace Period: Xm Ys left!"`.
   - **Hết hạn 30m Grace (`diffMs < -30m`)**: Tự động đổi trạng thái đơn thành `No Show`, phát sự kiện Socket `table:status_changed`, giải phóng bàn về `Available`.

3. **Quy Tắc Ẩn/Hiện Nút Edit (`canEditReservation`)**:
   - Nút Edit **CHỈ HIỆN** khi đơn ở trạng thái chờ (`Await Check-in` / `Confirmed`) VÀ thời gian hiện tại **phải trước ít nhất 30 PHÚT so với giờ bắt đầu (`reservation_start_at`)**.
   - Khách **KHÔNG ĐƯỢC** chọn ngày trong quá khứ (`minDate = Today`).

#### **BẢNG TEST CASES CHI TIẾT CHO CHỨC NĂNG EDIT & COUNTDOWN**:

| STT | Kịch bản Test (Test Case) | Giờ Đặt Bàn (`start_time`) | Giờ Hiện Tại (Current Time) | Trạng thái Nút Edit | Bộ Đếm Countdown & Hành động |
| :-: | :--- | :--- | :--- | :---: | :--- |
| **TC-01** | Khách đổi bàn trước giờ hẹn > 30m | 13:00 (28/07/2026) | 12:25 (Còn 35 phút) | **HIỆN (Cho phép Edit)** | `"Arrive in: 35m 0s left"` |
| **TC-02** | Khách cố đổi bàn sát giờ (< 30m) | 13:00 (28/07/2026) | 12:35 (Còn 25 phút) | **ẨN (Không được Edit)** | `"Arrive in: 25m 0s left"` |
| **TC-03** | Khách cố đổi bàn khi đã quá giờ | 13:00 (28/07/2026) | 13:57 (Quá 57 phút) | **ẨN (Không được Edit)** | `"Auto-Cancelled (No Show)"` |
| **TC-04** | Tự động hủy bàn khi quá 30m Grace | 13:00 (28/07/2026) | 13:31 (Quá 31 phút) | **ẨN (Đã No Show)** | Tự động đổi `No Show`, Giải phóng Bàn `Available` |
| **TC-05** | Chọn ngày quá khứ khi Edit | 19:00 (28/07/2026) | 14:00 (28/07/2026) | **HIỆN** | DatePicker khóa các ngày trước `28/07/2026` |

---

### 2.3. Ma Trận Trạng Thái Sơ Đồ Bàn (Table Status Matrix)

| Trạng thái (`table_status`) | Màu sắc Sơ đồ SVG | Ý nghĩa Nghiệp vụ | Hành động Chuyển trạng thái |
| :--- | :--- | :--- | :--- |
| `Available` | **Xanh Lá (`#10b981`)** | Bàn trống sẵn sàng nhận khách. | Mặc định hoặc khi Bếp/Staff dọn bàn xong. |
| `Reserved` | **Xanh Dương (`#2563eb`)** | Bàn đã gán cho đơn đặt trước (`Await Check-in`). | Khi đơn đặt được gán bàn. |
| `Occupied` | **Đỏ (`#ef4444`)** | Bàn đang có khách ngồi ăn / đang mở `TableOccupancySessions`. | Khi Staff bấm **Check-in** khách. |
| `Cleaning` | **Tím (`#06b6d4`)** | Bàn đang dọn dẹp sau khi thanh toán. | Khi Staff hoàn tất thanh toán hóa đơn. |
| `Inactive` | **Xám (`#6b7280`)** | Bàn tạm khóa bảo trì. | Admin/Manager tắt hoạt động của bàn. |

---

### 2.3. Ma Trận Trạng Thái Đơn Hàng & Bếp (Order & KDS Kitchen Matrix)

| Trạng thái Đơn (`order_status`) | Trạng thái Bếp (`ticket_status`) | Vai trò Tác động | Chi tiết Hành động |
| :--- | :--- | :--- | :--- |
| `Draft` | — | Staff / Customer QR | Mới chọn món vào giỏ, chưa gửi bếp. |
| `SentToKitchen` | `Pending` | Staff / System Pre-order | Bấm **Send to Kitchen** hoặc tự động đẩy Preorder khi Check-in (`processPreordersToKds`). |
| `Preparing` | `Preparing` | Kitchen Staff | Đầu bếp bấm **Bắt đầu chế biến** trên màn hình KDS. |
| `Ready` | `Ready` | Kitchen Staff | Món nấu xong, báo Staff lên món. |
| `Served` | `Served` | Staff | Staff đem món ra bàn và đánh dấu đã phục vụ. |
| `PaymentPending` | — | Staff | Khách yêu cầu tính tiền. |
| `Paid` | — | Staff | Thanh toán thành công, in hóa đơn. |

---

## 3. CHI TIẾT API SPECIFICATIONS (REQUEST & RESPONSE SCHEMAS)

### 3.1. CUSTOMER PORTAL APIs

#### 1. Kiểm tra Khả dụng Bàn (Check Table Availability)
- **Endpoint**: `GET /api/reservations/availability`
- **Query Parameters**:
  ```json
  {
    "date": "2026-07-28",
    "time": "19:00",
    "durationMinutes": 120,
    "guestCount": 4
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "tables": [
      {
        "table_id": 1,
        "table_number": "WIN-A",
        "capacity": 2,
        "area_name": "Window Area",
        "current_status": "Available",
        "availability_at_slot": "Available",
        "is_bookable": true,
        "is_too_small": true
      },
      {
        "table_id": 4,
        "table_number": "WIN-D",
        "capacity": 8,
        "area_name": "Window Area",
        "current_status": "Reserved",
        "availability_at_slot": "Reserved",
        "is_bookable": false,
        "is_too_small": false
      }
    ]
  }
  ```

#### 2. Tạo Đơn Đặt Bàn (Create Reservation)
- **Endpoint**: `POST /api/reservations`
- **Request Payload**:
  ```json
  {
    "date": "2026-07-28",
    "time": "19:00",
    "guestCount": 4,
    "selectedTableId": 2,
    "fullName": "Nguyên Văn A",
    "email": "nguyenvana@gmail.com",
    "phone": "0901234567",
    "diningPurpose": "Casual Dinner",
    "specialRequest": "Khu vực yên tĩnh",
    "preorderedDishes": [
      { "dish_id": 10, "quantity": 2 }
    ]
  }
  ```
- **Response Output Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Reservation created successfully.",
    "reservation": {
      "reservation_id": 100201,
      "order_code": "RES100201",
      "reservation_status": "Await Check-in",
      "deposit_amount": 0,
      "dining_session": "Dinner Session (6:00 PM → 11:00 PM)"
    }
  }
  ```

#### 3. Khách hàng Gửi Yêu cầu Đổi / Hủy Đơn (Submit Change Request)
- **Endpoint**: `POST /api/reservations/:id/request-change`
- **Headers**: `Authorization: Bearer <token>`
- **Request Payload**:
  ```json
  {
    "request_type": "edit",
    "reason": "Muốn đổi sang bàn lớn hơn 6 người",
    "new_date": "2026-07-29",
    "new_time": "19:30",
    "new_table_id": 6
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Request submitted successfully. Pending Manager approval.",
    "request_id": 501
  }
  ```

---

### 3.2. STAFF PORTAL APIs

#### 1. Lấy Danh sách Đơn Đặt Ca Hôm Nay (Get Today Shift Reservations)
- **Endpoint**: `GET /api/staff/reservations/today`
- **Headers**: `Authorization: Bearer <staff_token>`
- **Query Parameters**: `page=1&limit=20&status=all`
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "reservations": [
      {
        "reservation_id": 100103,
        "contact_name": "Lan Anh",
        "contact_phone": "0908000004",
        "reservation_start_at": "2026-07-28T19:00:00.000Z",
        "reservation_status": "Await Check-in",
        "assigned_tables": "PR-01",
        "guest_count": 6
      }
    ]
  }
  ```

#### 2. Check-in Đón Khách Nhận Bàn (Staff Check-in)
- **Endpoint**: `POST /api/staff/reservations/:id/checkin`
- **Headers**: `Authorization: Bearer <staff_token>`
- **Request Payload**:
  ```json
  {
    "table_id": 24
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Check-in successful! Table is now Occupied.",
    "session_id": 88,
    "qr_session_token": "qr-session-pr01-20260728",
    "kds_items_pushed": 2
  }
  ```

#### 3. Đánh dấu No Show hoặc Từ chối Check-in (Mark No Show)
- **Endpoint**: `POST /api/staff/reservations/:id/reject`
- **Headers**: `Authorization: Bearer <staff_token>`
- **Request Payload**:
  ```json
  {
    "reason": "Customer did not arrive after 30 mins",
    "new_status": "No Show"
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Marked as No Show. Table released to Available."
  }
  ```

#### 4. Thanh toán Hóa đơn & Áp Voucher (Staff Process Payment)
- **Endpoint**: `POST /api/staff/orders/:orderId/pay`
- **Headers**: `Authorization: Bearer <staff_token>`
- **Request Payload**:
  ```json
  {
    "payment_method": "Cash",
    "voucher_code": "SUMMER2026"
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "payment_id": 905,
    "subtotal": 1200000,
    "discount_amount": 100000,
    "total_amount": 1100000,
    "order_status": "Paid",
    "table_status": "Cleaning"
  }
  ```

---

### 3.3. KITCHEN DISPLAY SYSTEM (KDS) APIs

#### 1. Lấy Danh sách Món Cần Chế Biến (Get Kitchen Tickets)
- **Endpoint**: `GET /api/kitchen/tickets`
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "tickets": [
      {
        "ticket_id": 401,
        "order_id": 302,
        "table_number": "S-03",
        "dish_id": 12,
        "dish_name": "Japanese Sweet Corn Grill",
        "quantity": 2,
        "ticket_status": "Pending",
        "notes": "No butter",
        "created_at": "2026-07-28T19:05:00.000Z"
      }
    ]
  }
  ```

#### 2. Cập nhật Trạng thái Chế biến Món (Update Kitchen Ticket Status)
- **Endpoint**: `PUT /api/kitchen/tickets/:id/status`
- **Request Payload**:
  ```json
  {
    "status": "Ready"
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Ticket status updated to Ready.",
    "ticket_id": 401,
    "status": "Ready"
  }
  ```

---

### 3.4. MANAGER PORTAL APIs

#### 1. Duyệt Yêu cầu Đổi / Hủy Đơn của Khách (Manager Approve Request)
- **Endpoint**: `POST /api/manager/reservations/:id/requests/:requestId/approve`
- **Headers**: `Authorization: Bearer <manager_token>`
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Customer request approved successfully. Reservation updated."
  }
  ```

#### 2. Thêm Món ăn Mới vào Menu (Manager Create Dish)
- **Endpoint**: `POST /api/manager/dishes`
- **Request Payload**:
  ```json
  {
    "dish_name": "Charcoal Squid Shio Yaki",
    "category_id": 2,
    "price": 250000,
    "cost_price": 110000,
    "description": "Mực nướng than hoa muối biển",
    "image_url": "/images/dishes/squid.jpg",
    "is_available": true,
    "is_recommended": true,
    "spicy_level": 1,
    "prep_time_min": 15
  }
  ```
- **Response Output Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Dish created successfully.",
    "dish_id": 55
  }
  ```

---

### 3.5. ADMIN CONTROL APIs

#### 1. Đổi Vai trò Tài khoản (Admin Change User Role)
- **Endpoint**: `PUT /api/admin/users/:id/role`
- **Headers**: `Authorization: Bearer <admin_token>`
- **Request Payload**:
  ```json
  {
    "role_name": "Restaurant Staff"
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User role updated successfully."
  }
  ```

#### 2. Cấu hình Tham số Hệ thống (Admin Update Settings)
- **Endpoint**: `PUT /api/admin/settings`
- **Request Payload**:
  ```json
  {
    "no_show_grace_default_min": 30,
    "open_time": "10:00",
    "close_time": "22:00"
  }
  ```
- **Response Output Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "System settings updated successfully."
  }
  ```

---

## 4. BẢNG TRẠNG THÁI TRIỂN KHAI THỰC TẾ TRONG CODEBASE (100% REAL-CODE STATUS)

| Phân hệ | Tính năng | Trạng thái | Ghi chú Kỹ thuật Thực tế |
| :--- | :--- | :---: | :--- |
| **Customer** | Xem Menu & Tìm kiếm AI | **DONE** | Tải danh sách món động từ DB, lọc loại món, tìm kiếm ảnh AI (`AIVisualSearchModal`). |
| **Customer** | Đặt bàn trực tuyến (Reservation) | **DONE** | Sơ đồ SVG chọn bàn realtime, tính ca ăn 100% tiếng Anh, tự động gán ngày Today realtime. |
| **Customer** | Pre-order món ăn | **DONE** | Chọn món trước khi tới, lưu snapshot giá trong `PreorderItems`. |
| **Customer** | Quản lý Đơn (`/my-reservations`) | **DONE** | Modal Invoice hiệu ứng Apple, gửi yêu cầu Hủy/Sửa (`Pending Request`). |
| **Customer** | Mở Session gọi món QR | **DONE** | Đã tạo token session `QROrderSessions` khi Check-in. |
| **Staff** | Sơ đồ bàn Real-time (`/staff/tables`) | **DONE** | Đồng bộ Socket.IO 100% (`Available`, `Occupied`, `Reserved`, `Cleaning`). |
| **Staff** | Check-in nhận bàn | **DONE** | Bấm Check-in chuyển bàn sang `Occupied`, tự động đẩy Pre-order vào KDS Bếp. |
| **Staff** | Quản lý Đơn ca làm (`/staff/reservations`) | **DONE** | Lọc theo ca hôm nay, Check-in, Mark No Show (kèm `sweepNoShows()` ngầm). |
| **Staff** | Tạo Order & Thêm món | **DONE** | Giao diện chọn món, ghi nhận snapshot giá `unit_price`, chuyển trạng thái đơn. |
| **Staff** | Phục vụ Bếp (Kitchen KDS Display) | **DONE** | Hiển thị danh sách vé bếp, cập nhật `Preparing` → `Ready` → `Served`. |
| **Staff** | Thanh toán & Giải phóng bàn | **DONE** | Áp mã voucher, tính tổng tiền, thanh toán và tự động giải phóng bàn về `Cleaning`. |
| **Manager** | Dashboard KPI & Biểu đồ | **DONE** | Thống kê doanh thu ngày, tổng đơn paid, occupancy rate, best seller, biểu đồ doanh thu. |
| **Manager** | Duyệt Đặt bàn & Yêu cầu | **DONE** | Phê duyệt/Từ chối đơn đặt bàn & yêu cầu Hủy/Sửa từ khách (`Pending Request`). |
| **Manager** | Quản lý Thực đơn (CRUD Món) | **DONE** | Thêm/sửa/xóa mềm món ăn (`is_available`, `status`), upload ảnh, phân loại. |
| **Manager** | Quản lý Nhân sự & Phân ca | **DONE** | Quản lý hồ sơ nhân viên (`EmployeeProfiles`), lịch phân ca (`StaffSchedules`), ca làm (`WorkShifts`). |
| **Manager** | Quản lý Mã giảm giá (Vouchers) | **DONE** | CRUD Voucher, thiết lập giảm giá theo %, số tiền cố định, giới hạn lượt dùng. |
| **Admin** | Quản trị Tài khoản & Phân quyền | **DONE** | Quản lý người dùng (`UserAccounts`), phân vai trò, khóa/mở tài khoản (`is_active`). |
| **Admin** | Cấu hình Tham số Hệ thống | **DONE** | Cấu hình giờ mở/đóng cửa, No-show grace period, tích hợp SePay API. |
| **Admin** | Thiết lập Sơ đồ Bàn (`Floor Plan`) | **DONE** | Cấu hình khu vực (`RestaurantAreas`) và tọa độ bàn (`RestaurantTables`). |

---

## 5. KẾT LUẬN & CAM KẾT HỆ THỐNG
Hệ thống **Phūrai Restaurant Management System** đảm bảo:
- **Chuẩn hóa API Specs 100%**: Mọi endpoint đều có cấu trúc Request/Response JSON rõ ràng.
- **Minh bạch Luồng Trạng Thái**: Tất cả trạng thái của Đơn đặt bàn, Bàn ăn, Order và Bếp chuyển đổi nhất quán giữa 5 vai trò.
- **Thời gian thực tuyệt đối**: Đồng bộ ngay lập tức qua WebSocket Socket.IO trên mọi phân hệ.
