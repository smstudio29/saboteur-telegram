const { Telegraf, Markup } = require("telegraf")

const bot = new Telegraf(process.env.BOT_TOKEN)

let games = {}

bot.start((ctx) => {

    ctx.reply(
        "⛏ Saboteur\n\nСоздать новую игру?",
        Markup.inlineKeyboard([
            Markup.button.callback("🎮 Создать игру", "create_game")
        ])
    )

})

// создание комнаты
bot.action("create_game", (ctx) => {

    const gameId = Math.random().toString(36).substring(2,8)

    games[gameId] = {
        players: [ctx.from],
        started: false
    }

    ctx.reply(
        `🎮 Игра создана!\n\nID: ${gameId}`,
        Markup.inlineKeyboard([
            Markup.button.callback("➕ Присоединиться", "join_" + gameId)
        ])
    )

})

// вход в игру
bot.action(/join_(.+)/, (ctx) => {

    const gameId = ctx.match[1]

    const game = games[gameId]

    if (!game) {
        ctx.reply("❌ Игра не найдена")
        return
    }

    game.players.push(ctx.from)

    const playerList = game.players.map(p => p.first_name).join("\n")

    ctx.reply(
        `👥 Игрок присоединился\n\nИгроки:\n${playerList}`
    )

})

bot.launch()

console.log("🚀 Saboteur bot started")
