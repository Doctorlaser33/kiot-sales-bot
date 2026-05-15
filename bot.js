import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const SHEET_ID = process.env.SHEET_ID;

async function readSheet() {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'daily_sales!A:E'
    });

    const rows = res.data.values || [];
    const [header, ...dataRows] = rows;

    return dataRows.map(row => ({
        orderCode: row[0] || '',
        customerCode: row[1] || '',
        revenue: Number(String(row[2] || '0').replace(/[^\d.-]/g, '')),
        date: row[3] || '',
        lastUpdated: row[4] || ''
    }));
}

async function askClaude(question, data) {
    const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            messages: [
                {
                    role: 'user',
                    content: `
Bạn là chatbot báo cáo doanh thu nội bộ.

Dữ liệu bên dưới có cấu trúc:
- orderCode: mã đơn
- customerCode: mã khách hàng
- revenue: doanh thu của đơn
- date: NGÀY BÁN HÀNG, dùng cột này để lọc theo ngày
- lastUpdated: thời gian đồng bộ dữ liệu, KHÔNG dùng cột này để tính doanh thu

Dữ liệu:
${JSON.stringify(data)}

Câu hỏi:
${question}

Yêu cầu:
- Luôn dùng cột date để lọc ngày.
- Không dùng lastUpdated để tính doanh thu.
- Nếu hỏi doanh thu ngày nào, cộng revenue của các đơn có date đúng ngày đó.
- Trả lời ngắn gọn bằng tiếng Việt.
- Format tiền VND có dấu chấm.
`
                }
            ]
        },
        {
            headers: {
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        }
    );

    return response.data.content[0].text;
}

async function sendTelegram(chatId, text) {
    await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
            chat_id: chatId,
            text
        }
    );
}

app.post('/webhook', async (req, res) => {
    try {
        const msg = req.body.message;

        if (!msg || !msg.text) {
            return res.sendStatus(200);
        }

        const chatId = msg.chat.id;
        const question = msg.text;

        const data = await readSheet();
        const answer = await askClaude(question, data);

        await sendTelegram(chatId, answer);

        res.sendStatus(200);
    } catch (err) {
        console.error(JSON.stringify(err.response?.data || err.message, null, 2));
        res.sendStatus(200);
    }
});

app.get('/', (req, res) => {
    res.send('Bot running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Bot running on port ${PORT}`);
});