# Simple Automation Runner - Chrome Web Store Submission Notes

## Mo ta ngan gon

Simple Automation Runner la Chrome extension giup nguoi dung tao, luu va chay cac kich ban thao tac trinh duyet theo cau hinh. Extension ho tro cac buoc tu dong hoa co ban nhu mo URL, dien input, click nut, chon option, doi thoi gian, doi phan tu xuat hien va gui phim.

Extension duoc thiet ke cho cac tac vu lap lai tren website do nguoi dung tu cau hinh, vi du kiem tra luong dang nhap noi bo, dien form lap lai, hoac chay cac workflow web don gian.

## Muc dich duy nhat

Muc dich duy nhat cua extension la chay cac kich ban tu dong hoa trinh duyet do nguoi dung tao va quan ly truc tiep trong extension.

Extension khong chen quang cao, khong theo doi hanh vi duyet web cho muc dich marketing, khong ban du lieu, va khong gui du lieu nguoi dung ve server ben ngoai.

## Tinh nang chinh

- Tao va quan ly nhieu automation scenario.
- Chay scenario tren tab hien tai, tab moi, hoac cua so moi.
- Ho tro automation steps:
  - `open_url`: mo mot URL.
  - `fill`: dien gia tri vao input.
  - `click`: click vao phan tu tren trang.
  - `select`: chon gia tri trong dropdown.
  - `wait`: doi theo thoi gian.
  - `wait_for_element`: doi phan tu xuat hien.
  - `press`: gui phim duoc nguoi dung cau hinh.
- Pick mode de chon CSS selector tren trang hien tai.
- Record key mode de ghi nhanh phim can su dung trong step.
- Luu lich su chay gan nhat va trang thai thanh cong/loi.
- Import/export scenario de sao luu hoac chia se cau hinh.

## Quyen Chrome dang su dung

File `manifest.json` hien khai bao:

```json
{
  "permissions": ["storage", "tabs", "scripting", "activeTab", "sidePanel"],
  "host_permissions": ["<all_urls>"]
}
```

### `storage`

Dung de luu scenario, draft dang chinh sua, selector dang chon, va log chay gan nhat trong `chrome.storage.local`.

Ly do can quyen:

- Nguoi dung can luu cac kich ban automation de dung lai sau.
- Extension can luu tam draft khi nguoi dung dang tao/chinh sua scenario.
- Extension can luu ket qua chay de hien thi trang thai thanh cong hoac loi.

Du lieu duoc luu cuc bo tren may nguoi dung. Extension khong dong bo len server rieng.

### `tabs`

Dung de tao, cap nhat, truy van va dong tab trong qua trinh chay scenario.

Ly do can quyen:

- Scenario co the mo URL moi bang `chrome.tabs.create`.
- Step `open_url` can cap nhat URL cua tab bang `chrome.tabs.update`.
- Extension can lay tab dang active khi nguoi dung muon chay tren tab hien tai.
- Sau khi chay, extension co the dong cac tab ma no da tao theo yeu cau cua nguoi dung.
- Extension can theo doi trang thai load cua tab de dam bao trang da san sang truoc khi chay step tiep theo.

Quyen nay chi duoc dung de dieu khien cac tab lien quan den automation ma nguoi dung kich hoat.

### `scripting`

Dung de inject `content.js` vao tab dang duoc automation xu ly.

Ly do can quyen:

- Cac thao tac nhu click, fill, select, wait for element va pick selector phai duoc thuc thi trong context cua trang web.
- Extension can chen content script dung luc vao tab muc tieu bang `chrome.scripting.executeScript`.

Content script chi thuc hien cac hanh dong do scenario cua nguoi dung cau hinh.

### `activeTab`

Dung khi nguoi dung tuong tac voi extension tren tab hien tai, dac biet cho pick mode va record key mode.

Ly do can quyen:

- Khi nguoi dung bam extension va chon pick selector, extension can thao tac voi tab dang active.
- Khi nguoi dung ghi phim, extension can lang nghe phim tren trang hien tai trong thoi gian ngan.

Quyen nay giup extension lam viec voi tab nguoi dung dang chu dong chon.

### `sidePanel`

Dung de hien thi giao dien quan ly scenario trong Chrome Side Panel.

Ly do can quyen:

- Giao dien tao, sua, luu, chay, import/export scenario duoc hien thi trong side panel.
- Side panel giup nguoi dung vua xem trang web, vua cau hinh automation.

### `host_permissions`: `<all_urls>`

Dung de extension co the chay automation tren cac website ma nguoi dung tu cau hinh.

Ly do can quyen:

- Extension la cong cu automation tong quat, khong bi gioi han vao mot domain co dinh.
- Nguoi dung co the tao scenario cho nhieu website khac nhau.
- Content script can duoc inject vao URL muc tieu de thuc hien click, fill, select, wait va pick selector.

Neu ban chi muon submit extension cho mot nhom website cu the, nen thay `<all_urls>` bang danh sach domain can thiet de giam muc do quyen, vi `<all_urls>` la quyen nhay cam va co the bi Chrome Web Store review ky hon.

Vi du neu chi dung cho domain noi bo:

```json
"host_permissions": [
  "https://example.com/*",
  "https://*.example.com/*"
]
```

## Web accessible resources

Manifest khai bao:

```json
"web_accessible_resources": [
  {
    "resources": ["content.js"],
    "matches": ["<all_urls>"]
  }
]
```

`content.js` can duoc truy cap de extension inject vao trang web khi nguoi dung chay automation, pick selector, hoac record key. File nay khong duoc dung de tai noi dung tu server ngoai.

## Giai thich quyen de dien vao Chrome Web Store

Ban co the dung noi dung duoi day khi Chrome Web Store yeu cau giai thich permission:

### Storage permission justification

Extension uses `storage` to save user-created automation scenarios, edit drafts, selected CSS selectors, and recent run logs locally in `chrome.storage.local`. This data is required so users can reuse and manage their automation workflows. The extension does not send this data to any external server.

### Tabs permission justification

Extension uses `tabs` to create tabs, update tab URLs, read the active tab selected by the user, wait for page loading, and close tabs created by automation runs. These actions are necessary to execute user-configured browser automation scenarios.

### Scripting permission justification

Extension uses `scripting` to inject its content script into the user-selected target tab. The content script performs the configured automation actions such as clicking elements, filling inputs, selecting dropdown options, waiting for elements, and picking CSS selectors.

### ActiveTab permission justification

Extension uses `activeTab` when the user explicitly starts pick mode, key recording, or runs automation against the current tab. This allows the extension to interact with the active page chosen by the user.

### SidePanel permission justification

Extension uses `sidePanel` to provide the main scenario editor and runner UI next to the current web page, allowing users to configure and run automation while viewing the target site.

### Host permission justification

Extension uses host access so user-created automation scenarios can run on the websites selected by the user. The extension must inject a content script into target pages to perform configured actions such as fill, click, select, wait for element, and selector picking. If the extension is intended for specific domains only, host permissions should be restricted to those domains.

## Xu ly du lieu va privacy

Extension co the luu cac loai du lieu sau tren may nguoi dung:

- Ten scenario.
- URL bat dau cua scenario.
- CSS selector.
- Gia tri nguoi dung nhap trong cac automation step.
- Phim duoc cau hinh trong step `press`.
- Log chay gan nhat, bao gom trang thai thanh cong/loi.

Extension khong tu dong gui du lieu nay den server ben ngoai. Tuy nhien, khi nguoi dung cau hinh step `fill`, `click`, `select`, `press` hoac `open_url`, cac hanh dong do se duoc thuc hien tren website muc tieu va website do co the xu ly du lieu theo chinh sach rieng cua website.

Khuyen nghi privacy disclosure:

- Data is stored locally using Chrome extension storage.
- Data is not sold or shared with third parties.
- Data is not used for advertising or analytics.
- Users control which websites and actions are included in each automation scenario.

## Luu y truoc khi submit

- Kiem tra lai `host_permissions`. Neu khong bat buoc chay tren moi website, nen thay `<all_urls>` bang domain cu the.
- Khong luu mat khau production hoac thong tin nhay cam trong scenario, vi scenario duoc luu local plain text.
- Dam bao file build trong `dist/` khop voi `manifest.json`.
- Neu Chrome Web Store hoi ve single purpose, hay mo ta extension la cong cu automation theo cau hinh cua nguoi dung, khong phai cong cu tracking hay scraping an.
- Neu extension dung cho noi bo cong ty, nen noi ro cac domain noi bo va gioi han host permissions theo cac domain do.
