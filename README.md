# kiot-sales-bot

Bot Telegram noi bo de hoi nhanh doanh thu tu Google Sheets. Bot doc du lieu ban hang trong sheet, tu tong hop doanh thu theo ngay, liet ke don hang theo ngay, va dung Claude API de tra loi cac cau hoi tong hop khac.

## Yeu cau

- Node.js 18 tro len
- Mot Telegram bot token
- Mot Anthropic Claude API key
- Mot Google Sheet co tab `daily_sales`
- Google service account co quyen doc Google Sheet

## Cai dat

1. Cai dependencies:

```bash
npm install
```

2. Tao file `.env` o thu muc goc project:

```env
TELEGRAM_TOKEN=your_telegram_bot_token
CLAUDE_API_KEY=your_claude_api_key
SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
PORT=3000
```

`PORT` la tuy chon. Neu khong khai bao, bot se chay o port `3000`.

3. Chia se Google Sheet cho email cua service account.

## Cau truc Google Sheet

Bot doc range `daily_sales!A:D`, bo qua dong dau tien va xem cac cot nhu sau:

| Cot | Noi dung |
| --- | --- |
| A | Ma don hang |
| B | Ma khach hang |
| C | Doanh thu |
| D | Ngay |

Ngay co the la dang `dd/mm/yyyy` hoac serial number cua Google Sheets. Bot se chuan hoa ve `dd/mm/yyyy`.

## Chay bot

Chay truc tiep:

```bash
node bot.js
```

Khi thanh cong, terminal se hien:

```text
Bot running on port 3000
```

Co the kiem tra server bang endpoint:

```text
GET /
```

Ket qua mong doi:

```text
Bot running
```

## Webhook Telegram

Bot nhan tin nhan tu Telegram qua endpoint:

```text
POST /webhook
```

Khi deploy len server public, cau hinh Telegram webhook tro den:

```text
https://your-domain.example/webhook
```

## Cau hoi bot ho tro tot

Bot co logic rieng cho cac cau hoi doanh thu theo ngay, vi du:

- `Doanh thu hom nay`
- `Doanh thu ngay 14/05/2026`
- `Liet ke don ngay 14/05/2026`
- `Chi tiet cac don ngay 14/05/2026`

Neu cau hoi khong khop logic co san, bot se gui bang tong hop doanh thu gan nhat cho Claude de tra loi ngan gon bang tieng Viet.

## Cau truc project

```text
.
|-- bot.js                 # Express server, webhook Telegram, doc Google Sheets, goi Claude
|-- package.json           # Thong tin package va dependencies
|-- package-lock.json      # Lockfile npm
|-- .env                   # Bien moi truong, khong commit
|-- .gitignore             # Danh sach file bo qua khi commit
`-- service-account.json   # Thong tin service account local, khong nen commit
```

## Bien moi truong

| Bien | Bat buoc | Mo ta |
| --- | --- | --- |
| `TELEGRAM_TOKEN` | Co | Token cua Telegram bot |
| `CLAUDE_API_KEY` | Co | API key Anthropic Claude |
| `SHEET_ID` | Co | ID cua Google Sheet |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Co | JSON credentials cua Google service account |
| `PORT` | Khong | Port server Express, mac dinh `3000` |

## Scripts

Hien tai `package.json` chi co script `test` mac dinh va script nay luon bao loi. De chay bot, dung:

```bash
node bot.js
```

Neu sau nay them script `dev`, co the chay:

```bash
npm run dev
```
