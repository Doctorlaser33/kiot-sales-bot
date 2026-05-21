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
const chatContexts = new Map();
const CONTEXT_TTL_MS = 30 * 60 * 1000;

async function readSheet() {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({
        version: 'v4',
        auth
    });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'daily_sales!A:D',
        valueRenderOption: 'UNFORMATTED_VALUE'
    });

    const rows = res.data.values || [];
    const [, ...dataRows] = rows;

    return dataRows.map(row => ({
        orderCode: String(row[0] || ''),
        customerCode: String(row[1] || ''),
        revenue: Number(row[2] || 0),
        date: normalizeDate(row[3] || '')
    }));
}

function normalizeDate(value) {
    if (!value) return '';

    // Google Sheet có thể trả ngày dạng serial number
    // Ví dụ 46156 thay vì 14/05/2026
    if (typeof value === 'number') {
        const msPerDay = 24 * 60 * 60 * 1000;
        const googleEpoch = Date.UTC(1899, 11, 30);
        const date = new Date(googleEpoch + value * msPerDay);

        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();

        return `${day}/${month}/${year}`;
    }

    const text = String(value).trim();

    const match = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);

    if (match) {
        const [d, m, y] = match[0].split('/');
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    return text;
}

function formatVND(number) {
    return Number(number || 0).toLocaleString('vi-VN') + ' VND';
}

function normalizeQuestionText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd');
}

function getChatContext(chatId) {
    const context = chatContexts.get(chatId);
    const isExpired =
        context?.lastQuestionAt &&
        Date.now() - context.lastQuestionAt > CONTEXT_TTL_MS;

    if (!context || isExpired) {
        chatContexts.set(chatId, {});
    }

    return chatContexts.get(chatId);
}

function getTodayVN() {
    const now = new Date();

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    return `${day}/${month}/${year}`;
}

function extractDateFromQuestion(question) {
    const q = normalizeQuestionText(question);

    if (
        q.includes('hôm nay') ||
        q.includes('hom nay') ||
        q.includes('today')
    ) {
        return getTodayVN();
    }

    const match = question.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);

    if (!match) return null;

    const parts = match[0].split('/');

    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];

    return `${day}/${month}/${year}`;
}

function getSalesByDate(data, targetDate) {
    const orders = data.filter(item => item.date === targetDate);

    const totalRevenue = orders.reduce(
        (sum, item) => sum + Number(item.revenue || 0),
        0
    );

    return {
        date: targetDate,
        orderCount: orders.length,
        totalRevenue,
        orders
    };
}

function buildSalesDateAnswer(report) {
    if (report.orderCount === 0) {
        return `Ngày ${report.date} chưa có dữ liệu doanh thu.`;
    }

    return [
        `📊 Doanh thu ngày ${report.date}`,
        ``,
        `Tổng doanh thu: ${formatVND(report.totalRevenue)}`,
        `Số đơn: ${report.orderCount} đơn`
    ].join('\n');
}

function buildOrderListAnswer(report) {
    if (report.orderCount === 0) {
        return `Ngày ${report.date} chưa có đơn hàng nào.`;
    }

    const lines = report.orders
        .slice(0, 30)
        .map(item => {
            const customer = item.customerCode
                ? ` - KH: ${item.customerCode}`
                : '';

            return `- ${item.orderCode}${customer}: ${formatVND(item.revenue)}`;
        });

    const more =
        report.orders.length > 30
            ? `\n\nCòn ${report.orders.length - 30} đơn khác.`
            : '';

    return [
        `📋 Danh sách đơn ngày ${report.date}`,
        ``,
        `Tổng doanh thu: ${formatVND(report.totalRevenue)}`,
        `Số đơn: ${report.orderCount} đơn`,
        ``,
        ...lines,
        more
    ].join('\n');
}

function tryAnswerByCode(question, data, context = {}) {
    const q = normalizeQuestionText(question);

    const isSalesQuestion =
        q.includes('doanh thu') ||
        q.includes('doanh số') ||
        q.includes('doanh so');

    const isOrderListQuestion =
        q.includes('cu the') ||
        q.includes('moi don') ||
        q.includes('tung don') ||
        q.includes('theo don') ||
        q.includes('don nao') ||
        q.includes('bao nhieu moi don') ||
        q.includes('liệt kê') ||
        q.includes('liet ke') ||
        q.includes('danh sách') ||
        q.includes('danh sach') ||
        q.includes('chi tiết') ||
        q.includes('chi tiet') ||
        q.includes('các đơn') ||
        q.includes('cac don');

    const explicitDate = extractDateFromQuestion(question);
    const targetDate =
        explicitDate ||
        (isOrderListQuestion ? context.lastSalesDate : null);

    if (targetDate && (isSalesQuestion || isOrderListQuestion)) {
        const report = getSalesByDate(data, targetDate);
        context.lastSalesDate = targetDate;
        context.lastQuestionAt = Date.now();

        if (isOrderListQuestion) {
            return buildOrderListAnswer(report);
        }

        return buildSalesDateAnswer(report);
    }

    if (isOrderListQuestion) {
        return 'Bạn muốn xem chi tiết từng đơn của ngày nào? Ví dụ: "Chi tiết từng đơn ngày 20/05/2026".';
    }

    return null;
}

function buildSummaryForClaude(data) {
    const byDate = {};

    data.forEach(item => {
        if (!item.date) return;

        if (!byDate[item.date]) {
            byDate[item.date] = {
                date: item.date,
                orderCount: 0,
                totalRevenue: 0
            };
        }

        byDate[item.date].orderCount += 1;
        byDate[item.date].totalRevenue += Number(item.revenue || 0);
    });

    return Object.values(byDate)
        .sort((a, b) => {
            const [da, ma, ya] = a.date.split('/').map(Number);
            const [db, mb, yb] = b.date.split('/').map(Number);

            return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
        })
        .slice(0, 60);
}

async function askClaude(question, data, chatId) {
    const context = getChatContext(chatId);
    const codeAnswer = tryAnswerByCode(question, data, context);

    if (codeAnswer) {
        return codeAnswer;
    }

    const summary = buildSummaryForClaude(data);

    const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model: 'claude-haiku-4-5',
            max_tokens: 300,
            messages: [
                {
                    role: 'user',
                    content: `
Bạn là chatbot báo cáo doanh thu nội bộ.

Dữ liệu đã được code tổng hợp sẵn:
${JSON.stringify(summary)}

Câu hỏi:
${question}

Quy tắc:
- Trả lời đúng trọng tâm câu hỏi.
- Không giải thích cấu trúc dữ liệu.
- Không tự bịa số liệu.
- Nếu không đủ dữ liệu thì nói chưa có dữ liệu.
- Trả lời ngắn gọn bằng tiếng Việt.
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
        const answer = await askClaude(question, data, chatId);

        await sendTelegram(chatId, answer);

        res.sendStatus(200);
    } catch (err) {
        console.error(
            JSON.stringify(
                err.response?.data || err.message,
                null,
                2
            )
        );

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
