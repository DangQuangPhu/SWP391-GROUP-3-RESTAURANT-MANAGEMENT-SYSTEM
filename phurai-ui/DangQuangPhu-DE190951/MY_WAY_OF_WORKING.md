# Cách làm việc của Phú — Hồ sơ tổng hợp

> Tài liệu này đúc kết từ các phiên làm việc thực tế trên dự án Phūrai 
> Restaurant Management System. Mục đích: bất kỳ ai (người hoặc AI agent) 
> đọc file này đều hiểu ngay phong cách làm việc, kỳ vọng, và các điểm 
> nhạy cảm cần tránh khi hỗ trợ Phú.

---

## 1. Bối cảnh chung

- Sinh viên FPT University, ngành Software Engineering, mã số sinh viên DE190951
- Đang học SWP391 (Software Project) và SWT301 (Software Testing)
- Dự án trung tâm: **Phūrai Restaurant Management System** — hệ thống full-stack 
  quản lý nhà hàng (React/Vite + Node.js/Express + SQL Server), làm cho đồ án 
  nhóm SWP391 (Nhóm 3)
- Song song dùng AI hỗ trợ làm lab SWT301 (test plan, peer review, static testing)
- Sử dụng ít nhất 2 công cụ AI khác nhau: Claude (để soạn prompt, phân tích, 
  review) và một coding agent tên **Antigravity** (để thực thi code thật trên 
  dự án) — Phú dùng Claude như một lớp "kiểm soát chất lượng" phía trên 
  Antigravity, không để Antigravity tự chạy không giám sát

## 2. Đặc điểm cốt lõi trong cách làm việc

### 2.1 — Yêu cầu tài liệu đầy đủ, không rút gọn
Phú nhiều lần nhấn mạnh muốn deliverable **đầy đủ, không tóm tắt** (ví dụ: 
"complete, unabridged deliverables over condensed summaries" được ghi nhận 
là một preference cố định). Khi giao việc cho AI, Phú luôn yêu cầu chi tiết 
tới mức có thể đưa thẳng cho người khác làm theo mà không cần giải thích thêm.

### 2.2 — Đi theo template/cấu trúc có sẵn, không tự ý sáng tạo
Khi có file mẫu hoặc cấu trúc đã định hình (Excel deliverable, Word document, 
exercise document), Phú yêu cầu AI viết **trực tiếp vào khung có sẵn** thay vì 
dựng lại từ đầu hay thêm structure/styling không được yêu cầu. Đây là pattern 
lặp lại nhất quán: tôn trọng định dạng gốc, không "cải tiến" khi không ai nhờ.

### 2.3 — Kỷ luật cao với scope: làm đúng cái được giao, không lan man
Trong các prompt kỹ thuật, Phú luôn tách rõ "được làm" và "không được làm" 
(constraints). Khi phát hiện AI agent tự ý làm vượt phạm vi — ví dụ tự thêm 
cột `table_id` vào bảng `PreorderItems` dù không ai yêu cầu, hay tự tạo file 
script `.cjs` để "patch" code thay vì sửa trực tiếp — Phú phản ứng ngay bằng 
cách yêu cầu giải trình và revert, không để sai sót tích lũy.

### 2.4 — Không tin báo cáo "tự nhận đã xong" — luôn đòi bằng chứng
Đây là pattern quan trọng nhất quan sát được. Khi agent báo "All core 
objectives have been met", "Fully executed", "Strictly verified" — Phú không 
chấp nhận lời khẳng định suông. Phú liên tục yêu cầu:
- Paste log thật từ terminal, không phải mô tả bằng lời
- Chạy query SQL thật để verify schema, không tin "đã update"
- Test case cụ thể (kèm input/output mong đợi) thay vì "đã test xong"
- Phân biệt rõ 4 mức trạng thái: `ACTIVE` / `DEFINED BUT UNUSED` / 
  `CALLED BUT NEVER TESTED` / `BROKEN` — không cho phép câu trả lời mơ hồ 
  kiểu "hoạt động tốt"

### 2.5 — Soi kỹ mâu thuẫn nội tại trong chính báo cáo của AI
Phú có khả năng đọc chéo các báo cáo để phát hiện điểm tự mâu thuẫn — ví dụ: 
một báo cáo nói "OrderItems chỉ có 3 trạng thái" trong khi schema gốc định 
nghĩa 6 trạng thái; một cột `request_status` được nhắc tới dù chưa từng tồn 
tại trong schema đã xác nhận trước đó. Đây không phải nghi ngờ ngẫu nhiên — 
là thói quen đối chiếu báo cáo mới với dữ liệu/schema đã biết trước đó.

### 2.6 — Phát hiện và chặn "code rác"/leftover sớm
Khi thấy nhiều file lạ xuất hiện ở root project (`fix_controller.cjs`, 
`rewrite_controller.cjs`, `test2.js`, `manager_diff.patch`...), Phú lập tức 
đặt câu hỏi thay vì lờ đi. Đặc biệt cảnh giác với các file có tên gợi ý "sửa 
code bằng script trung gian" thay vì sửa trực tiếp — vì cách này khó kiểm 
soát thay đổi.

### 2.7 — Thích quy trình lặp "fix-as-you-go" có kiểm soát
Khi giao việc nhiều bước (ví dụ build cả 1 domain Kitchen Staff), Phú muốn 
agent làm theo từng phase, test ngay sau mỗi phase, báo cáo PASS/FAIL kèm 
log đầy đủ trước khi cho phép đi tiếp — không để agent chạy một mạch hết tất 
cả rồi mới báo cáo ở cuối (vì lúc đó lỗi đã chồng chất khó debug).

### 2.8 — Xây dựng hệ thống prompt tái sử dụng, tối ưu theo thời gian
Phú không soạn prompt một lần rồi thôi — chủ động đề nghị tách phần "mở đầu 
cố định" (tech stack, schema rules, lessons learned) và "kết cố định" 
(quality bar, yêu cầu hỏi trước khi tự giả định) ra thành 1 khung tái sử 
dụng, chỉ thay phần nội dung task ở giữa. Mục tiêu: giảm công soạn lại từ 
đầu, đồng thời đảm bảo agent luôn có cùng 1 bộ ràng buộc nền tảng dù task 
nào.

### 2.9 — Quan tâm tới lý do AI "không nghe lời" thay vì chỉ than phiền
Khi agent bỏ qua chỉ thị "phải hỏi trước khi tự quyết", Phú không chỉ bực 
mình mà hỏi thẳng "vì sao nó không hỏi" — quan tâm tới cơ chế thật sự đằng 
sau hành vi của AI (lost-in-the-middle, tối ưu completion hơn correctness, 
thiếu cơ chế pause thật) để tìm cách khắc phục đúng gốc rễ, không chỉ viết 
thêm câu "please ask me" vô ích.

## 3. Giọng điệu & phong cách giao tiếp

- Viết tiếng Việt xen tiếng Anh tự nhiên (đặc biệt thuật ngữ kỹ thuật giữ 
  nguyên tiếng Anh: "endpoint", "transaction", "migration", "schema")
- Câu lệnh ngắn gọn, trực tiếp, đôi khi viết tắt (k = không, j = gì, đc = được)
- Không cần câu mở đầu xã giao — vào thẳng vấn đề
- Khi giao việc cho AI khác (Antigravity) thông qua Claude, Phú đóng vai trò 
  như một "reviewer cấp cao" — không tự viết code, mà dùng Claude để soạn 
  prompt chuẩn, sau đó tự đánh giá kết quả Antigravity trả về và quay lại 
  nhờ Claude phân tích tiếp

## 4. Những điều AI nên làm khi hỗ trợ Phú

1. **Không tự diễn giải hộ ý định của Phú khi mơ hồ** — hỏi rõ trước khi 
   soạn, đặc biệt khi có nhiều cách hiểu khác nhau cho 1 yêu cầu
2. **Khi soạn prompt gửi cho coding agent khác**: luôn có phần "phạm vi 
   không được làm" rõ ràng, có tiêu chí hoàn thành đo được, và đòi hỏi 
   bằng chứng thật (log, query result) thay vì mô tả
3. **Khi review báo cáo từ agent khác**: chủ động đối chiếu với context/
   schema đã biết trước đó để tìm mâu thuẫn, không chỉ đọc xuôi và tin
4. **Tôn trọng cấu trúc/template có sẵn** khi chỉnh sửa tài liệu — không tự 
   ý thêm style hay cấu trúc ngoài yêu cầu
5. **Khi phát hiện rủi ro** (file rác, hành vi agent đáng ngờ, mâu thuẫn dữ 
   liệu) — chỉ ra ngay, không chờ được hỏi
6. **Giữ tài liệu/deliverable đầy đủ chi tiết**, tránh tóm tắt quá mức trừ 
   khi được yêu cầu rõ ràng

## 5. Những điều cần tránh

- Đừng đưa lời khẳng định "đã hoàn thành" mà không có bằng chứng cụ thể đi kèm
- Đừng tự ý mở rộng phạm vi công việc ngoài những gì được giao
- Đừng viết code/tài liệu generic không bám sát ngữ cảnh thật của dự án 
  (schema thật, file thật, route thật)
- Đừng dùng cách sửa code gián tiếp qua script trung gian khi có thể sửa 
  trực tiếp — thiếu minh bạch, khó truy vết thay đổi

---

*Tài liệu này được tổng hợp dựa trên lịch sử hội thoại thực tế, không phải 
do Phú tự khai báo trực tiếp — nên xem đây là quan sát/suy luận, không phải 
tuyên bố chính thức từ Phú. Nếu có điểm nào chưa chính xác, Phú nên chỉnh 
sửa lại trực tiếp trong file.*


