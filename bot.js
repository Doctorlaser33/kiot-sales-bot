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
    const credentials = JSON.parse(
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    );

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
        range: 'daily_sales!A:G'
    });

    return res.data.values || [];
}

async function askClaude(question, data) {
    const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model: 'claude-3-haiku-20240307',
            max_tokens: 300,
            messages: [
                {
                    role: 'user',
                    content: `
Dữ liệu doanh số:
${JSON.stringify(data)}

Câu hỏi:
${question}

Trả lời ngắn gọn tiếng Việt.
`
                }
            ]
        },
        {
            headers: {
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
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
        console.error(err.response?.data || err.message);
        res.sendStatus(200);
    }
});
app.get('/', (req, res) => {
    res.send('Bot running');
});
app.listen(3000, () => {
    console.log('Bot running on port 3000');
});