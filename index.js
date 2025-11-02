import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import "dotenv/config";

// Define the commands
const commands = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Get help" },
  { command: "info", description: "Get information" },
  { command: "create", description: "Create something new" },
];

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4,
    },
  },
});

// Set commands for your bot
bot
  .setMyCommands(commands)
  .then(() => {
    console.log("Commands set successfully");
  })
  .catch((error) => {
    console.error("Error setting commands:", error);
  });

/// Handlers for each command
bot.onText(/\/start/, (msg) => {
  // console.log(msg);
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.username || msg.from.first_name;

  bot.sendMessage(chatId, `Hello ${userName}, your user ID is ${userId}`);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, "Help message");
});

bot.onText(/\/info/, (msg) => {
  bot.sendMessage(msg.chat.id, "Information about the bot");
});

bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;

  if (!match[1].includes("|")) {
    bot.sendMessage(chatId, "Vui lòng nhập đúng định dạng." + "\n\n" + "Ví dụ:\n```\n/add name|email\n```", {
      parse_mode: "Markdown",
    });
    return;
  }

  bot.sendChatAction(chatId, "typing");

  const resp = match[1];
  const values = resp.split("|");

  const url = new URL(process.env.WEBHOOK_URL);
  url.searchParams.append("name", values[0]);
  url.searchParams.append("email", values[1]);

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        bot.sendMessage(chatId, "✅ Đã thêm thành công.");
      } else {
        bot.sendMessage(chatId, "Không thể thêm. Vui lòng thử lại sau!");
      }
    })
    .catch((err) => {
      bot.sendMessage(chatId, "Đã có lỗi xảy ra. Vui lòng thử lại sau!");
    });
});

bot.onText(/\/append_node (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendChatAction(chatId, "typing");

  const resp = match[1];
  const values = resp.split("|");

  const url = new URL(process.env.API_HOST + "/guidetree/append-node");
  url.searchParams.append("telegramID", userId);

  // Create the data object
  const data = {
    flowId: "14159fd7cf964f9689116fd759a860d6",
    previousNodeId: "rs-66e1c6707be04cf882a9c36887716c7c",
    node: {
      label: values[0],
      name: "name",
      type: "default",
    },
  };

  fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 0) {
        bot.sendMessage(chatId, "✅ Đã thêm thành công.");
      } else {
        bot.sendMessage(chatId, "Không thể thêm. Vui lòng thử lại sau!");
      }
    })
    .catch((err) => {
      bot.sendMessage(chatId, "Đã có lỗi xảy ra. Vui lòng thử lại sau!");
    });
});

bot.onText(/\/add_node (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendChatAction(chatId, "typing");

  const resp = match[1];
  const values = resp.split("|");

  const url = new URL(process.env.API_HOST + "/guidetree/add-node");
  url.searchParams.append("telegramID", userId);

  // Create the data object
  const data = {
    flowId: "14159fd7cf964f9689116fd759a860d6",
    node: {
      label: values[0],
      name: "name",
      type: "default",
    },
  };

  // fetch(url)
  //   .then((res) => res.json())
  fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 0) {
        bot.sendMessage(chatId, "✅ Đã thêm thành công.");
      } else {
        bot.sendMessage(chatId, "Không thể thêm. Vui lòng thử lại sau!");
      }
    })
    .catch((err) => {
      bot.sendMessage(chatId, "Đã có lỗi xảy ra. Vui lòng thử lại sau!");
    });
});

// Handler for /create command
bot.onText(/\/create/, (msg) => {
  const chatId = msg.chat.id;

  // Reply with message and inline keyboard
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Add New", callback_data: "add_new" },
          { text: "Update", callback_data: "update" },
          { text: "Delete", callback_data: "delete" },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, "Item created. What would you like to do next?", options);
});

// Handle button clicks
bot.on("callback_query", (callbackQuery) => {
  const message = callbackQuery.message;
  const action = callbackQuery.data;

  if (action === "add_new") {
    bot.sendMessage(message.chat.id, "You chose to add a new item.");
  } else if (action === "update") {
    bot.sendMessage(message.chat.id, "You chose to update the item.");
  } else if (action === "delete") {
    bot.sendMessage(message.chat.id, "You chose to delete the item.");
  }

  // Acknowledge the callback query
  bot.answerCallbackQuery(callbackQuery.id);
});

// Default message handler
bot.on("message", (msg) => {
  if (!msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, "Please use a command starting with /");
  }

  const chatId = msg.chat.id;
  if (msg.text.toLocaleLowerCase() === "menu") {
    const keyboard = {
      reply_markup: {
        keyboard: [["/create", "/help"], ["/start"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
    bot.sendMessage(chatId, "Choose a command:", keyboard);
  }
});

console.log("Bot is running...");
