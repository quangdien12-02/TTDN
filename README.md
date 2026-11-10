# Công ty TNHH Bình Minh Số — Hệ thống quản lý nhân sự doanh nghiệp

- **Node.js**: môi trường chạy JavaScript phía máy chủ.
- **Express.js**: định tuyến và xử lý yêu cầu HTTP.
- **EJS**: render giao diện từ dữ liệu phía máy chủ.
- **PostgreSQL**: hệ quản trị cơ sở dữ liệu quan hệ.
- **Bootstrap 5 + CSS + JavaScript**: giao diện đáp ứng và tương tác.

## Chức năng hiện có

1. Đăng nhập/đăng xuất, CAPTCHA ảnh ký tự ngẫu nhiên sau lần đăng nhập sai đầu tiên, session, mật khẩu băm bằng bcrypt.
2. Dashboard thống kê tổng nhân viên, phòng ban, chức vụ và hợp đồng hiệu lực.
3. Quản lý nhân viên: danh sách, tìm kiếm theo mã/tên/email/số điện thoại/phòng ban/chức vụ, lọc theo phòng ban/chức vụ/trạng thái, thêm, sửa, xóa (quản trị viên).
4. Quản lý phòng ban: danh sách, tìm kiếm theo mã/tên/mô tả, thêm, sửa, xóa.
5. Quản lý chức vụ: danh sách, tìm kiếm theo mã/tên/mô tả, thêm, sửa, xóa.
6. Quản lý hợp đồng lao động: danh sách, tìm kiếm theo mã hợp đồng/mã hoặc tên nhân viên/loại hợp đồng, lọc theo trạng thái/loại hợp đồng, thêm, sửa, xóa.
7. Quản lý tài khoản: tìm kiếm theo tên đăng nhập/mã hoặc tên nhân viên, lọc theo vai trò/trạng thái, tạo tài khoản, liên kết hồ sơ nhân viên, khóa/mở khóa, xử lý yêu cầu đặt lại mật khẩu.
8. Nhân viên thường chỉ xem hồ sơ được liên kết với tài khoản.
9. Prepared statements cho truy vấn có dữ liệu đầu vào.

> Đây là bản nền tảng học tập. Trước khi triển khai thực tế cần bổ sung CSRF token, giới hạn đăng nhập, session store dùng PostgreSQL/Redis, logging, kiểm thử tích hợp và quy trình sao lưu.

## Yêu cầu

- Node.js 20 trở lên (khuyến nghị bản LTS).
- PostgreSQL 14 trở lên.
- npm.

## Cài đặt trên Windows

### 1. Tạo cơ sở dữ liệu PostgreSQL

Cài PostgreSQL và mở pgAdmin hoặc SQL Shell (psql). Tạo database tên `binh_minh_so_hrm`:

```sql
CREATE DATABASE binh_minh_so_hrm;
```

### 2. Cấu hình biến môi trường

1. Trong Terminal, chuyển đến thư mục dự án rồi sao chép file mẫu thành `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

   Nếu bạn dùng File Explorer, có thể sao chép `.env.example` rồi đổi tên bản sao thành `.env`. Hãy kiểm tra để tên file không bị thành `.env.txt`.

2. Mở `.env` bằng trình soạn thảo văn bản, chẳng hạn VS Code. Cập nhật các giá trị:

   - `PORT=3000`: cổng ứng dụng web sử dụng; có thể giữ nguyên `3000`.
   - `SESSION_SECRET=...`: thay bằng một chuỗi bí mật dài, khó đoán. Đây không phải mật khẩu PostgreSQL.
   - `DATABASE_URL=...`: điền thông tin kết nối PostgreSQL như ví dụ bên dưới.
   - `PGSSL=false`: giữ nguyên khi PostgreSQL chạy trên máy tính của bạn. Chỉ đổi thành `true` nếu nhà cung cấp PostgreSQL yêu cầu SSL.

Ví dụ, nếu tên người dùng PostgreSQL là `postgres`, mật khẩu là `MatKhauCuaBan`, PostgreSQL chạy trên máy tính này ở cổng `5432`, và database đã tạo ở bước trước có tên `binh_minh_so_hrm`, đặt `DATABASE_URL` như sau:

```env
PORT=3000
SESSION_SECRET=thay-bang-mot-chuoi-bi-mat-dai
DATABASE_URL=postgresql://postgres:MatKhauCuaBan@localhost:5432/binh_minh_so_hrm
PGSSL=false
```

Trong URL trên, thay `MatKhauCuaBan` bằng **mật khẩu PostgreSQL bạn đã đặt khi cài PostgreSQL** (không phải mật khẩu Windows). Nếu bạn dùng tên người dùng khác `postgres`, hãy thay phần `postgres` đứng trước dấu `:`. Nếu đổi tên database hoặc cổng PostgreSQL, hãy cập nhật `binh_minh_so_hrm` hoặc `5432` tương ứng. Giữ nguyên `postgresql://`, `@localhost:` và không thêm dấu ngoặc kép vào giá trị.

Nếu mật khẩu có ký tự đặc biệt, hãy URL-encode ký tự đó **chỉ trong phần mật khẩu**. Ví dụ: `@` thành `%40`, `#` thành `%23`, `/` thành `%2F`, và `%` thành `%25`. Chẳng hạn, mật khẩu `abc@123` được ghi là `abc%40123` trong URL:

```env
DATABASE_URL=postgresql://postgres:abc%40123@localhost:5432/binh_minh_so_hrm
```

Lưu file `.env` trước khi chạy ứng dụng. Không chia sẻ hoặc đưa file `.env` lên Git vì file này chứa mật khẩu và khóa bí mật.

### 3. Cài thư viện và khởi tạo dữ liệu

Mở Terminal trong thư mục dự án:

```bash
npm install
npm run db:init
npm start
```

Mở trình duyệt tại `http://localhost:3000`.

### Tài khoản mẫu

- Tên đăng nhập: `admin`
- Mật khẩu: `123456`

Lệnh `npm run db:init` tạo bảng nếu chưa có, thêm một số phòng ban/chức vụ mẫu và tạo tài khoản admin nếu tài khoản đó chưa tồn tại. Không dùng mật khẩu mẫu khi triển khai thật.
Sau khi cập nhật dự án hiện có, chạy lại `npm run db:init` để tạo bảng yêu cầu đặt lại mật khẩu mới.

### Đặt lại mật khẩu

Người dùng gửi yêu cầu từ liên kết **Quên mật khẩu?** tại trang đăng nhập. Quản trị viên mở **Yêu cầu đặt lại mật khẩu**, đặt mật khẩu mới và gửi mật khẩu đó cho người dùng qua kênh liên hệ an toàn. Hệ thống không gửi email; thông báo xác nhận không tiết lộ tên đăng nhập có tồn tại hay không.

## Cấu trúc thư mục

```text
RBC_HRM_Node_PostgreSQL/
├── app.js                 # Express app, routes và middleware
├── db/schema.sql          # Schema PostgreSQL
├── scripts/init-db.js     # Tạo bảng và dữ liệu mẫu
├── views/                 # EJS pages/partials
├── public/css/style.css   # Giao diện
├── public/js/app.js       # Tương tác trình duyệt
├── .env.example           # Mẫu cấu hình
└── package.json
```

## Mô hình dữ liệu

- `departments` — phòng ban.
- `positions` — chức vụ.
- `employees` — hồ sơ nhân viên, liên kết phòng ban/chức vụ.
- `contracts` — hợp đồng lao động, liên kết nhân viên.
- `accounts` — tài khoản đăng nhập, vai trò và liên kết hồ sơ nhân viên.
# TTDN
dienvu120204
