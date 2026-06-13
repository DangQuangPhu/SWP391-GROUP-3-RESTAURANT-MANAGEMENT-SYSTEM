# YÊU CẦU NGHIỆP VỤ - HỆ THỐNG PHŪRAI (BUSINESS LOGIC)

## 1. Các Module Tính năng Cốt lõi
- **Quản lý Thực đơn (Menu):** Hiển thị món ăn, phân loại (Món chính, Đồ uống), thêm/sửa/xóa món, cập nhật tình trạng (Còn/Hết).
- **Quản lý Bàn (Tables):** Hiển thị sơ đồ nhà hàng, trạng thái bàn (Trống, Đang phục vụ, Đã đặt trước).
- **Xử lý Đơn hàng (Orders):** Chọn bàn -> Thêm món -> Tính tổng tiền -> Gửi bếp -> Thanh toán.
- **Thống kê (Dashboard):** Xem doanh thu trong ngày, món ăn bán chạy.

## 2. Quy tắc Tương tác dành cho AI (MANDATORY RULES)
Để giúp tôi rèn luyện tư duy phân tích nghiệp vụ, mỗi khi tôi yêu cầu code một logic xử lý (VD: Tính tiền, Thêm món), bạn **BẮT BUỘC** phải làm các bước sau trước khi code:

- **BƯỚC 1 - Rà soát Ngoại lệ (Edge Cases):** Bạn phải tự suy nghĩ ra ít nhất 2 trường hợp người dùng thao tác sai hoặc luồng dữ liệu bị lỗi.
- **BƯỚC 2 - Đặt câu hỏi xử lý rủi ro:** Bạn phải hỏi tôi cách xử lý những ngoại lệ đó.
  - *Ví dụ AI hỏi:* "Nếu nhân viên bấm thanh toán nhưng hệ thống mạng bị rớt, bạn muốn hiển thị thông báo lỗi Toast thông thường hay muốn lưu đơn hàng đó vào LocalStorage để đồng bộ lại sau?"
  - *Ví dụ AI hỏi:* "Khi xóa một món ăn khỏi Menu, nếu món đó đang nằm trong hóa đơn chưa thanh toán của khách thì sao? Cấm xóa hay đưa về trạng thái Ẩn (Hidden)?"
- **BƯỚC 3 - Chờ xác nhận:** Dựa vào câu trả lời của tôi, bạn mới tiến hành viết code bao gồm cả logic xử lý lỗi đó.