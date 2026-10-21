# PostgreSQL cho local dev

`compose.dev.yml` tạo PostgreSQL 17 riêng cho Radar bằng Docker bridge thông thường, publish `127.0.0.1:5434` tới port 5432 trong container. Named volume giữ dữ liệu khi container dừng hoặc được tạo lại.

`.env` trên máy hiện tại có `DATABASE_URL` và `POSTGRES_*` tương ứng với container Radar. Không in nội dung file này vào log. Cấu hình chỉ phục vụ local dev; không dùng credentials này cho production.

```sh
docker compose -f compose.dev.yml up -d --wait postgres
docker compose -f compose.dev.yml ps
docker compose -f compose.dev.yml exec postgres psql -U radar -d radar_dev
npm run db:migrate
```

Ứng dụng chạy trên host dùng `DATABASE_URL` với `127.0.0.1:5434`. Khi chạy cả app bằng `compose.app.yml`, app và worker kết nối `postgres:5432` bên trong bridge network, còn port 5434 vẫn dành cho host.

Nếu WARP làm lỗi kết nối PostgreSQL, **báo người dùng tắt WARP**. Không tự sửa route, cấu hình VPN, network mode hoặc áp dụng cách vòng qua WARP. Cấu hình host networking từng thử trước đây đã được gỡ theo yêu cầu người dùng.

Các biến môi trường:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: khởi tạo PostgreSQL và cấu hình app container.
- `DATABASE_URL`: kết nối từ ứng dụng chạy trực tiếp trên host.
- `TRANSLATION_PROVIDER=disabled`: dịch đang hoãn.
- `GEMINI_API_KEY`: dành cho giai đoạn tóm tắt theo yêu cầu sau này; bản MVP không sử dụng.

Tạm dừng mà giữ dữ liệu:

```sh
docker compose -f compose.dev.yml stop postgres
```

Không dùng `down -v` nếu còn cần dữ liệu. Sửa biến `POSTGRES_*` không tự đổi tài khoản của database đã được tạo trên volume. Xem [README](../README.md) để chạy web, crawl và worker.
