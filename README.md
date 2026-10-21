# Dorriss Radar

Góc đọc cá nhân tổng hợp bài từ 20 engineering blogs: Astro SSR, TypeScript, PostgreSQL, Crawlee, RSS/Atom và Mozilla Readability. Giao diện tiếng Việt, theme sáng, font Be Vietnam Pro được phục vụ tại chỗ. Nội dung giữ nguyên ngôn ngữ gốc; dịch và tóm tắt để giai đoạn sau. Phiên bản này không gọi API AI hay API dịch.

## Chạy trên máy dev

Yêu cầu Node.js 22.22+ hoặc 24+, Docker Compose và npm. `.env` trên máy hiện tại đã được điền kết nối PostgreSQL dev. Trên máy mới, sao chép `.env.example` thành `.env`, thay mật khẩu và cập nhật cùng mật khẩu trong `DATABASE_URL`.

```sh
npm ci --ignore-scripts
docker compose -f compose.dev.yml up -d --wait postgres
npm run db:migrate
npm run crawl
npm run dev -- --port 4321
```

Mở **http://127.0.0.1:4321**. Database được publish riêng tại `127.0.0.1:5434`; dữ liệu nằm trong named volume. Nếu WARP chặn kết nối Docker, tắt WARP rồi thử lại. Không thay route, VPN hay network mode để xử lý việc này.

Nếu bộ Compose đang chạy ở port 4321, dừng riêng web và worker bằng `docker compose -f compose.dev.yml -f compose.app.yml stop web worker` trước khi chạy dev; PostgreSQL vẫn được giữ lại.

Web có tìm kiếm theo tiêu đề/đoạn giới thiệu, lọc theo nguồn và chủ đề, phân trang, lưu bài và đánh dấu đã đọc. Mở bài 1,5 giây sẽ đánh dấu đã đọc; có thể chuyển lại thành chưa đọc ngay trên trang bài. Trạng thái này dùng chung cho thư viện cá nhân, chưa có tài khoản riêng.

## Crawl hằng ngày

```sh
npm run worker
```

Giữ worker chạy để crawl mỗi ngày lúc **07:15 giờ Việt Nam**. Worker không chạy chỉ vì mở trang web. Có thể nhấn **Cập nhật bài** trên web hoặc chạy thủ công:

```sh
npm run crawl
npm run crawl -- --source=netflix
```

Mỗi lượt kiểm tra tối đa 30 bài gần nhất mỗi nguồn, ba request đồng thời, và thử lấy toàn văn tối đa hai bài mỗi nguồn. Nguồn có RSS/Atom được ưu tiên; Uber, LinkedIn, Discord và DoorDash dùng trang danh sách. Stripe được lọc theo danh sách engineering. PostgreSQL advisory lock ngăn CLI, worker và web crawl trùng nhau. Nút cập nhật có khoảng nghỉ một phút sau mỗi lượt.

RSS có thể chỉ cung cấp trích đoạn. Trang đọc phân biệt toàn văn đã trích xuất, nội dung RSS và liên kết gốc. Khi không lấy được nội dung, vẫn có nút mở bài tại nguồn. Không bịa ngày đăng bị thiếu; bài có ngày đăng được xếp trước bài chưa rõ ngày. Chủ đề được gán bằng từ khóa, chưa dùng AI.

Mục **Nguồn đọc** hiển thị kết quả gần nhất của từng blog. HTTP 403 hoặc lỗi kết nối không làm mất bài cũ và không chặn các nguồn khác. Danh sách nguồn thực tế nằm trong [src/lib/sources.ts](src/lib/sources.ts).

## Chạy cả web và worker bằng Docker

```sh
docker compose -f compose.dev.yml -f compose.app.yml up -d --build --wait
```

Lệnh này dùng lại PostgreSQL và volume của cấu hình dev, tự chạy migration rồi khởi động web và worker. Dừng dev server trước nếu nó đang chiếm port 4321; hoặc đặt `WEB_PORT=4322` trước lệnh Compose. Với phiên bản Astro có dev daemon, dùng `npx astro dev stop` để dừng.

```sh
docker compose -f compose.dev.yml -f compose.app.yml logs -f worker
docker compose -f compose.dev.yml -f compose.app.yml exec web npm run crawl
```

Web và database dev chỉ bind loopback. Cấu hình production và CI/CD nằm trong [deployment/README.md](deployment/README.md). Khi mở ra Internet, cấu hình domain, HTTPS và quyền truy cập cá nhân tại reverse proxy; phiên bản này chưa có đăng nhập. Mật khẩu trong cấu hình Compose cần dùng ký tự URL-safe (ví dụ mật khẩu hex ngẫu nhiên); nếu dùng ký tự đặc biệt, phải mã hóa URL cho kết nối.

Khi chọn domain, thêm hostname/protocol chính xác vào `security.allowedDomains` trong `astro.config.mjs` rồi build lại image. Mặc định chỉ nhận `localhost` và `127.0.0.1` qua HTTP. Thiết lập này để Astro nhận đúng origin khi chạy standalone và kiểm tra các header từ proxy; xem [cấu hình chính thức của Astro](https://docs.astro.build/en/reference/configuration-reference/#securityalloweddomains).

## Kiểm tra

```sh
npm test
npm run check
npm run build
npm audit
```

Integration tests tạo schema tạm riêng trong database dev và xóa schema đó sau khi chạy, giữ nguyên thư viện. Tài khoản test cần quyền tạo schema. Kiểm tra trình duyệt cần web đang chạy và có bài đã crawl:

```sh
npx playwright install chromium
npx playwright test tests/e2e/reader.spec.ts
```

Nếu dùng Google Chrome đã cài, thêm `PLAYWRIGHT_CHANNEL=chrome` trước lệnh. E2E kiểm tra tìm kiếm, lưu bài qua reload, trạng thái đọc, nguồn, menu mobile, layout 320–1440px và accessibility; ảnh được lưu trong `artifacts/`. Riêng `ci-smoke.spec.ts` dùng database trống cùng fixture của `scripts/seed-smoke.ts`; không chạy seed trên thư viện thật.

## Cấu trúc

- `src/lib/`: nguồn, parser, nội dung, PostgreSQL và collector.
- `src/pages/`: thư viện, trang đọc, trạng thái nguồn và API.
- `scripts/`: migration, crawl CLI và worker theo lịch.
- `docs/mvp-spec.md`: phạm vi và tiêu chí bản MVP hiện tại.
- `deployment/`: Compose production, script deploy và hướng dẫn vận hành.

## Android app

The native Flutter app lives in [`mobile/`](mobile/README.md). It uses the same PostgreSQL-backed API for recommendations, reading and saved state. The local Android test connects over USB with `adb reverse tcp:4321 tcp:4321`; use the connection settings in the app for a future HTTPS VPS endpoint. AI and translation remain deferred.
