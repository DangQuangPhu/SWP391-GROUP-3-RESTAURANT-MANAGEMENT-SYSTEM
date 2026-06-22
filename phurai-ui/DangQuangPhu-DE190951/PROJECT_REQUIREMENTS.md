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

--------------------------------------------------------------------------------
# 11. BẢNG TRẠNG THÁI CHỨC NĂNG THỰC TẾ TRONG CODE
Dựa trên rà soát toàn bộ source code của Phūrai-UI.

| Vai trò | Chức năng | Trạng thái | Ghi chú |
|---------|-----------|------------|---------|
| Customer | Xem Menu | Done | Tải danh sách món thành công, phân loại tốt. |
| Customer | Đặt bàn (Reservation) | Done | Flow tạo form hoạt động tốt, Database đã ghi nhận đầy đủ. |
| Customer | Pre-order món | Partial | Có giao diện thêm món lúc book bàn, tuy nhiên cần kiểm thử chéo với quy trình tính tiền. |
| Customer | Edit/Cancel request | Done | Đã phát triển luồng Pending Request. Yêu cầu đổi bàn/hủy chạy mượt qua API. |
| Customer | Gọi món tại bàn bằng QR | Not started | Chưa xây dựng quy trình scan QR mã `QROrderSessions`. |
| Customer | Thanh toán mock | Not started | Luồng thanh toán của khách chưa có màn hình. |
| Staff | Check-in khách (Nhận bàn) | Done | Đã gọi API Check-in hoàn chỉnh, kết nối Socket báo Manager realtime. |
| Staff | Quản lý sơ đồ bàn (Table Map) | Done | Staff thấy được màu sắc trạng thái bàn. |
| Staff | Tạo Order / Thêm món | Partial | Có form chọn món nhưng xử lý ghép dữ liệu `Orders` / `OrderItems` vẫn dùng mock nhiều. |
| Staff | Send to Kitchen | Partial | Mới test ở mức E2E/Socket giả lập, Kitchen Dashboard chưa thành hình đầy đủ. |
| Staff | Xử lý thanh toán | Partial | Có giao diện, thiếu tích hợp API tính tiền thật. |
| Kitchen Staff | Xem cooking queue (KDS) | Not started | Chưa có tính năng hoàn chỉnh, chỉ mới là form test. |
| Kitchen Staff | Update trạng thái món (Preparing $\\rightarrow$ Ready) | Not started | Cần logic cập nhật bảng `KitchenTickets`. |
| Manager | Xem oversight report (Dashboard) | Partial | Layout chuẩn nhưng dữ liệu biểu đồ (Revenue, Stats) đang hardcode/mocking. |
| Manager | Quản lý Đặt bàn (Duyệt/Từ chối) | Done | Phê duyệt Reservation hoàn hảo, có Notification, Email, AuditLog và Socket đầy đủ. |
| Manager | Quản lý Thực đơn (Menu) | Not started | Chưa có giao diện CRUD cho Món ăn. |
| Manager | Quản lý Nhân sự / Phân ca làm | Not started | Chưa có giao diện xử lý bảng `Shifts` và `StaffSchedules`. |
| Admin | Quản trị hệ thống, Phân quyền | Out of scope | Không xử lý trong giai đoạn này. |

