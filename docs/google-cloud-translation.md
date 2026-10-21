# Đăng ký Google Cloud Translation cho Dorriss Radar

> **Không còn là phương án được chọn.** Ngày 2026-10-21, người dùng từ chối bật billing. Giữ tài liệu này để tra cứu lịch sử; xem [các phương án dịch không cần billing](translation-options.md) cho hướng hiện tại. Không yêu cầu người dùng đăng ký Google Cloud Translation để tiếp tục làm MVP.

Đối chiếu tài liệu chính thức ngày 2026-10-21. Đây là hướng dẫn thiết lập; chưa có key thật và chưa gọi thử dịch vụ.

MVP dự kiến dùng **Cloud Translation Basic (v2), mô hình NMT** để dịch Anh → Việt. Bản này hỗ trợ API key; Advanced (v3) không hỗ trợ API key theo tài liệu hiện tại.

## 1. Tạo project và bật thanh toán

1. Mở [Google Cloud Console](https://console.cloud.google.com/).
2. Trong bộ chọn project, chọn **New project**, đặt tên ví dụ `Dorriss Radar`, rồi tạo project.
3. Ghi lại **Project ID**, không chỉ tên hiển thị. Chọn đúng project trong các bước tiếp theo.
4. Vào **Billing**, tạo hoặc liên kết billing account và hoàn tất thông tin thanh toán Google yêu cầu. Cloud Translation cần bật billing, kể cả khi sử dụng trong phần miễn phí.

Nguồn: [Cloud Translation setup](https://docs.cloud.google.com/translate/docs/setup).

## 2. Bật API

1. Mở [Cloud Translation API trong API Library](https://console.cloud.google.com/apis/library/translate.googleapis.com).
2. Kiểm tra đúng project Radar.
3. Bấm **Enable**. Nếu đã bật thì giao diện hiện nút quản lý dịch vụ.

Website vẫn chạy trên VPS; Google Cloud chỉ cung cấp API dịch qua HTTPS.

## 3. Tạo key dịch

1. Vào **APIs & Services → Credentials**.
2. Chọn **Create credentials → API key**.
3. Đặt tên ví dụ `radar-translation-server`.
4. Sửa key: **API restrictions → Restrict key → Cloud Translation API**, rồi lưu.
5. Với key trên VPS, chọn **Application restrictions → IP addresses**, thêm IP public mà VPS dùng để gọi ra ngoài. Nếu phát triển trên máy cá nhân, dùng key phát triển riêng với IP gọi ra ngoài tương ứng. IP Docker nội bộ hoặc domain website không thay thế cho IP gọi ra ngoài.
6. Giữ key trong cấu hình bí mật phía server, không đặt vào `PUBLIC_*`, frontend hoặc git.

Nguồn: [Xác thực](https://docs.cloud.google.com/translate/docs/authentication), [Giới hạn API key](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys).

## 4. Quota và chi phí

- Vào **APIs & Services → Cloud Translation API → Quotas & System Limits**. Hoặc mở [Quotas](https://console.cloud.google.com/iam-admin/quotas) và lọc Cloud Translation API; tên mục Console có thể thay đổi.
- Hạ quota **Characters sent to general model per project per day** theo mức ký tự muốn dịch/ngày. Mặc định quota ngày không giới hạn. Quota dùng chung cho NMT v2/v3 của project; đạt quota có thể khiến bài mới chờ dịch, trong khi bản gốc vẫn đọc được.
- Vào **Billing → Budgets & alerts**, tạo ngân sách cho project, ví dụ mức tương đương 5 USD/tháng, và các cảnh báo phù hợp. Đây là gợi ý khởi đầu, không phải giới hạn đã được người dùng chốt.
- **Ngân sách alerts-only chỉ cảnh báo, không tự ngắt dịch vụ hoặc chặn tiền.** Dùng thêm quota và giới hạn trong ứng dụng để kiểm soát sử dụng.
- NMT text translation theo mức chuẩn hiện tại: 500.000 ký tự đầu/tháng miễn dưới dạng credit tối đa 10 USD; phần vượt thường 20 USD/triệu ký tự. Credit dùng chung Basic/Advanced, không cộng dồn, và không áp dụng cho mọi loại dịch tài liệu. Kiểm tra lại giá khi bật billing.

Nguồn: [Quota](https://docs.cloud.google.com/translate/quotas), [Ngân sách](https://docs.cloud.google.com/billing/docs/how-to/budgets), [Giá dịch](https://cloud.google.com/products/translate/pricing).

## 5. Cấu hình ứng dụng dự kiến

Mẫu cấu hình ở [.env.example](../.env.example). Sao chép thành `.env` riêng rồi điền giá trị thật; `.env` đã được đưa vào `.gitignore`. Các tên biến dưới đây chưa được prototype hiện tại sử dụng:

```dotenv
GOOGLE_TRANSLATE_API_KEY=
GEMINI_API_KEY=
DATABASE_URL=
```

Giữ key dịch và Gemini tách biệt để quản lý quyền, quota và thay key độc lập. Điền giá trị thật vào file môi trường riêng hoặc Docker secrets trên máy chạy ứng dụng, không dán key vào chat. Project ID không phải secret và có thể dùng khi trao đổi cấu hình.

Tạo project/key và bật API không tự gửi nội dung bài viết đi dịch. Chưa có kiểm thử dịch phát sinh phí.

## Hành vi Gemini đã chốt

Gemini chỉ được gọi sau khi bấm **Tóm tắt**. Kết quả lưu PostgreSQL và dùng lại khi mở bài. Server ngăn yêu cầu đồng thời tạo nhiều bản cho cùng nội dung. Collection, tải trang, dịch và prefetch không gọi Gemini; lỗi không tự kích hoạt retry phát sinh phí.
