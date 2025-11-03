require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');

// Telegram Bot Setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Google Sheets Setup
let auth;
try {
  auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} catch (error) {
  console.error('❌ Error parsing Google credentials. Make sure GOOGLE_CREDENTIALS is valid JSON.');
  console.error('Error:', error.message);
  process.exit(1);
}

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Bills';

// Validate required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}
if (!process.env.SPREADSHEET_ID) {
  console.error('❌ SPREADSHEET_ID is not set in .env file');
  process.exit(1);
}
if (!process.env.GOOGLE_CREDENTIALS) {
  console.error('❌ GOOGLE_CREDENTIALS is not set in .env file');
  process.exit(1);
}

// Initialize spreadsheet with headers if needed
async function initializeSheet() {
  try {
    console.log('🔍 Checking spreadsheet access...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:D1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      console.log('📝 Initializing sheet with headers...');
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:D1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['User', 'Bill Name', 'Price', 'Date']],
        },
      });
      console.log('✅ Sheet initialized with headers');
    } else {
      console.log('✅ Spreadsheet access verified');
    }
  } catch (error) {
    console.error('❌ Error accessing spreadsheet:', error.message);

    if (error.message.includes('permission') || error.code === 403) {
      console.error('\n⚠️  PERMISSION ERROR DETECTED!');
      console.error('Please check the following:');
      console.error('1. Make sure you\'ve shared the spreadsheet with the service account email');
      console.error('2. The email should be in your GOOGLE_CREDENTIALS JSON (client_email field)');
      console.error('3. Give the service account "Editor" permissions on the spreadsheet');
      console.error('4. Verify the SPREADSHEET_ID is correct');
      console.error('\nService account email from credentials:');
      try {
        const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        console.error(`   📧 ${creds.client_email}`);
        console.error('\n👉 Share your Google Sheet with this email address!');
      } catch (e) {
        console.error('   (Unable to parse credentials)');
      }
    }

    throw error;
  }
}

// Add bill to Google Sheet
async function addBillToSheet(username, billName, price) {
  try {
    const date = new Date().toISOString().split('T')[0];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`,
      valueInputOption: 'RAW',
      resource: {
        values: [[username, billName, price, date]],
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding to sheet:', error);
    throw error;
  }
}

// Handle /a command
bot.onText(/\/a (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || `User_${userId}`;

  try {
    // Parse the message: /a dinner 180
    const input = match[1].trim();
    const parts = input.split(/\s+/);

    if (parts.length < 2) {
      bot.sendMessage(chatId, '❌ Invalid format. Use: /a [bill_name] [price]\nExample: /a dinner 180');
      return;
    }

    // Last part is price, everything else is bill name
    const price = parts[parts.length - 1];
    const billName = parts.slice(0, -1).join(' ');

    // Validate price
    if (isNaN(price) || parseFloat(price) <= 0) {
      bot.sendMessage(chatId, '❌ Invalid price. Please enter a valid number.');
      return;
    }

    // Add to Google Sheet
    await addBillToSheet(username, billName, parseFloat(price));

    // Send confirmation
    bot.sendMessage(
      chatId,
      `✅ Bill added successfully!\n\n` +
      `👤 User: ${username}\n` +
      `📝 Bill: ${billName}\n` +
      `💰 Price: ${price}`
    );

  } catch (error) {
    console.error('Error processing bill:', error);
    
    let errorMessage = '❌ Error adding bill. ';
    
    if (error.message.includes('permission') || error.code === 403) {
      errorMessage += 'Permission denied to access Google Sheet.\n\n';
      errorMessage += '⚠️ Please share the spreadsheet with the service account email.\n';
      
      try {
        const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        errorMessage += `\n📧 Service Account: ${creds.client_email}\n`;
        errorMessage += '\n👉 Go to your Google Sheet → Share → Add this email as Editor';
      } catch (e) {
        errorMessage += '\nCheck your GOOGLE_CREDENTIALS configuration.';
      }
    } else if (error.message.includes('SPREADSHEET_ID')) {
      errorMessage += 'Invalid spreadsheet ID. Please check your .env file.';
    } else {
      errorMessage += 'Please try again later.';
    }
    
    bot.sendMessage(chatId, errorMessage);
  }
});

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    '👋 Welcome to Bill Tracker Bot!\n\n' +
    'Use /a to add a bill:\n' +
    '📌 Format: /a [bill_name] [price]\n\n' +
    'Examples:\n' +
    '• /a dinner 180\n' +
    '• /a coffee 45\n' +
    '• /a grocery shopping 350'
  );
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    '📚 Bot Commands:\n\n' +
    '/a [bill_name] [price] - Add a new bill\n' +
    '/help - Show this help message\n\n' +
    'Example: /a dinner 180'
  );
});

// Initialize and start bot
initializeSheet()
  .then(() => {
    console.log('Bot is running...');
    console.log('Listening for /a commands in group chats');
  })
  .catch(console.error);

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});