# Quản lý nhân sự Vùng 4

Trang web nội bộ của Tổ Kinh doanh viễn thông Đà Nẵng 4: đăng nhập bằng Mã NV, xem/đề nghị sửa thông tin cá nhân, xem KPI theo quyền,
quản trị nạp số liệu và cập nhật báo cáo.

- Kho này **chỉ chứa mã giao diện** (HTML/CSS/JS thuần, không có bước build), phục vụ bằng GitHub Pages.
- **Không có dữ liệu** nhân viên, mật khẩu hay khóa. Dữ liệu nằm trong Google Sheets/Drive và chỉ đọc được qua Web App Apps Script
  (địa chỉ trong `js/config.js`); mọi kiểm tra đăng nhập và quyền làm ở phía Apps Script.
- Thư viện: SheetJS 0.18.5 và html2canvas 1.4.1 (cdnjs, dự phòng trong `vendor/`, giấy phép Apache-2.0 / MIT).

Mã gốc, tài liệu và kiểm thử được quản lý ở kho riêng; không sửa trực tiếp tại đây.
