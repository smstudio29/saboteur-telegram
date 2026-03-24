const { Telegraf } = require("telegraf")

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.start((ctx) => {
    ctx.reply("⛏ Добро пожаловать в Saboteur!")
})

bot.launch()

console.log("Bot started")
