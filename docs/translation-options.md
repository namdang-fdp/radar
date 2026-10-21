# Dịch Anh–Việt không cần bật billing

Đối chiếu tài liệu chính thức ngày 2026-10-21. Google Cloud Translation không còn là phương án hiện tại vì người dùng từ chối yêu cầu billing. Chưa kích hoạt hoặc gọi thử provider thay thế; cấu hình local là `TRANSLATION_PROVIDER=disabled`.

## LibreTranslate tự host

- Cung cấp API dịch chạy trên VPS, dùng Argos Translate.
- Có model trực tiếp **English → Vietnamese**, version 1.9, khoảng 65 MB theo danh sách model; đây là kích thước model, không phải toàn bộ dung lượng cài đặt hoặc RAM sử dụng.
- Không có phí API theo lượt khi tự host. Máy chủ phải cung cấp CPU/RAM và chi phí vận hành.
- Cần kiểm tra chất lượng trên bài engineering có thuật ngữ, bảng và code trước khi chọn. Không khẳng định chất lượng bằng dịch vụ khác khi chưa thử.

Nguồn: [LibreTranslate](https://docs.libretranslate.com/), [Các model ngôn ngữ](https://docs.libretranslate.com/guides/supported_languages/).

## Gemini Free Tier

- Google cung cấp Free Tier cho một số model và project đủ điều kiện, với hạn mức riêng. Không phải mọi model đều có Free Tier; model/quota thực tế cần kiểm tra trước khi cấu hình.
- Có thể đề xuất thêm nút **Dịch tiếng Việt** riêng với **Tóm tắt**, rồi lưu kết quả PostgreSQL và ngăn request trùng. Đây là đề xuất, chưa được người dùng chọn và chưa thay đổi hợp đồng chỉ dùng Gemini cho tóm tắt theo nút bấm.
- Không dịch tự động bằng Gemini khi crawl hoặc mở trang. Khi hết quota, hiển thị trạng thái và chờ; không tự bật billing hay chuyển sang provider trả phí.

Nguồn: [Gemini billing và Free Tier](https://ai.google.dev/gemini-api/docs/billing), [Model pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Dịch ngay trong trình duyệt

Một lựa chọn đơn giản cho giai đoạn đầu là dùng **Translate to Vietnamese** của Chrome trên trang đọc. Không cần tích hợp Translation API hoặc đăng ký billing cho ứng dụng, nhưng cũng không tạo bản dịch lưu trong PostgreSQL và không phải một API dịch phía server.

Nguồn: [Hướng dẫn dịch trang trong Chrome](https://support.google.com/chrome/answer/173424).
