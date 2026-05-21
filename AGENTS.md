# AGENTS.md

Huong dan cho AI/coding agent khi lam viec voi project nay.

## Nguyen tac bat buoc

- Luon doc `package.json` va `bot.js` truoc khi sua code.
- Khong xoa file neu chua hoi va duoc nguoi dung dong y ro rang.
- Khong revert, reset, checkout lai thay doi san co neu nguoi dung chua yeu cau.
- Khong commit file chua secrets nhu `.env` hoac service account credentials.
- Giu thay doi nho gon, dung voi yeu cau hien tai.

## Cach hieu project

- Entry point hien tai la `bot.js`.
- Project dung ES module vi `package.json` co `"type": "module"`.
- Bot chay Express server va nhan Telegram update tai `POST /webhook`.
- Bot doc Google Sheets qua bien `SHEET_ID` va `GOOGLE_SERVICE_ACCOUNT_JSON`.
- Bot goi Claude API khi khong tra loi duoc bang logic co san trong code.

## Truoc khi sua

1. Doc `package.json` de biet dependencies, scripts va module type.
2. Doc `bot.js` de nam flow hien tai.
3. Kiem tra file dang co trong repo neu thay doi lien quan den cau truc project.
4. Neu can xoa, doi ten, hoac di chuyen file, hoi nguoi dung truoc.

## Sau khi sua

Chay lenh kiem tra phu hop:

```bash
node bot.js
```

Neu sau nay project co script `dev` trong `package.json`, co the chay:

```bash
npm run dev
```

Neu lenh can secrets hoac ket noi ngoai nen khong chay duoc trong moi truong hien tai, ghi ro trong phan tra loi cuoi cung.

## Luu y khi sua code

- Khong sua format toan file neu khong can thiet.
- Khong doi ten bien moi truong neu khong cap nhat README va huong dan deploy.
- Khi them logic cau hoi moi, uu tien tach thanh function nho de de doc.
- Khi dung API ngoai, giu xu ly loi trong webhook de Telegram khong retry qua nhieu.
- Neu them scripts vao `package.json`, cap nhat README.
