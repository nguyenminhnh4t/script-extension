# Setup Guide — Simple Automation Runner

## Prerequisites

- Node.js >= 22.12.0
- npm >= 10
- Google Chrome

---

## Build

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

Output is written to `dist/`.

To rebuild automatically on file change:
```bash
npm run dev
```

---

## Load vào Chrome

1. Mở Chrome, vào địa chỉ: `chrome://extensions`

2. Bật **Developer mode** (góc trên bên phải)

3. Click **Load unpacked**

4. Chọn thư mục `dist/` trong project

5. Extension **Simple Automation Runner** xuất hiện trong danh sách — done.

> Sau mỗi lần chạy `npm run build`, click nút **↻ (reload)** trên card extension để áp dụng thay đổi mới nhất.

---

## Sử dụng nhanh

1. Click icon extension trên toolbar Chrome
2. Click **+ New** để tạo scenario mới
3. Nhập tên và URL bắt đầu (ví dụ: `https://example.com/login`)
4. Thêm các step:
   - `fill` → nhập CSS selector + giá trị (ví dụ: `#UserName`, `admin`)
   - `click` → nhập CSS selector của nút (ví dụ: `button[type='submit']`)
   - `wait` → delay tính bằng milliseconds
5. Click **Save**, rồi click **Run**

---

## Step types

| Type | Tham số |
|---|---|
| `open_url` | `url` |
| `fill` | `selector`, `value` |
| `click` | `selector` |
| `select` | `selector`, `value` (option value) |
| `wait` | `duration` (ms) |
| `wait_for_element` | `selector`, `timeout` (ms) |

---

## Import / Export

- **Export** — tải toàn bộ scenarios ra file `scenarios.json`
- **Import** — load file JSON để restore hoặc chia sẻ scenarios

---

## Lưu ý bảo mật

Config được lưu dưới dạng **plaintext** trong `chrome.storage.local`. Không lưu mật khẩu production vào extension.
