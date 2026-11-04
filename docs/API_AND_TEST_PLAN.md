# Danh sách endpoint và kế hoạch kiểm thử

## Endpoint giao diện

| Phương thức | Đường dẫn | Mục đích | Quyền |
|---|---|---|---|
| GET | `/login` | Hiển thị đăng nhập | Công khai |
| POST | `/login` | Xác thực tài khoản | Công khai |
| POST | `/logout` | Đăng xuất | Đã đăng nhập |
| GET | `/` | Dashboard | Đã đăng nhập |
| GET/POST | `/employees`, `/employees/new` | Danh sách/tạo nhân viên | Admin; nhân viên chỉ xem hồ sơ liên kết |
| GET/POST/PUT/DELETE | `/employees/:id` và `/employees/:id/edit` | Sửa/xóa nhân viên | Admin |
| GET/POST/PUT/DELETE | `/departments` và `/departments/:id` | CRUD phòng ban | Admin |
| GET/POST/PUT/DELETE | `/positions` và `/positions/:id` | CRUD chức vụ | Admin |
| GET/POST/PUT/DELETE | `/contracts` và `/contracts/:id` | CRUD hợp đồng | Admin |
| GET/POST | `/accounts`, `/accounts/new` | Danh sách/tạo tài khoản | Admin |
| POST | `/accounts/:id/toggle` | Khóa/mở khóa tài khoản | Admin |
| GET | `/health` | Kiểm tra tiến trình web | Công khai |

## Kiểm thử thủ công

1. Mở `/login`; đăng nhập sai phải hiện thông báo lỗi.
2. Đăng nhập `admin` / `123456`; kiểm tra dashboard và menu quản trị.
3. Thêm, sửa, tìm kiếm, xóa một phòng ban thử nghiệm.
4. Thêm nhân viên; kiểm tra mã nhân viên trùng bị cơ sở dữ liệu từ chối.
5. Thêm chức vụ, sau đó tạo hợp đồng cho nhân viên đã có.
6. Tạo tài khoản vai trò nhân viên và liên kết với hồ sơ nhân viên.
7. Đăng xuất rồi đăng nhập bằng tài khoản nhân viên; xác nhận không thấy menu phòng ban/chức vụ/hợp đồng/tài khoản và chỉ xem được hồ sơ được liên kết.
8. Khóa tài khoản nhân viên; xác nhận tài khoản không đăng nhập được.
9. Thử nhập dấu nháy trong ô tìm kiếm; truy vấn phải được xử lý như dữ liệu, không phải SQL.
10. Khởi động lại máy chủ; kiểm tra trang `/health` trả về `{"status":"ok"}`.

## Lưu ý về bảo mật

Bản nền tảng dùng session memory store mặc định của Express, phù hợp phát triển cục bộ chứ không phù hợp nhiều tiến trình/production. Cần thêm CSRF protection, rate limiting cho đăng nhập, cookie secure sau HTTPS, session store bền vững, kiểm thử tự động và quản lý lỗi/nhật ký trước khi triển khai.
