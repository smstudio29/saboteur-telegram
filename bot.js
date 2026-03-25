// bot.js
const { Telegraf, Markup } = require("telegraf")

// Токен бота берём из переменных окружения
const bot = new Telegraf(process.env.BOT_TOKEN)

// Храним все игры
let games = {}

// ======= Функции для игры =======

// Создание игрового поля 9x9
function createBoard() {
    const size = 9
    let board = []
    for (let y = 0; y < size; y++) {
        board[y] = []
        for (let x = 0; x < size; x++) {
            board[y][x] = "⬛"  // пустая клетка
        }
    }
    board[4][4] = "🏠" // стартовая клетка
    return board
}

// Преобразуем поле в текст для Telegram
function boardToText(board) {
    let text = ""
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            text += board[y][x]
        }
        text += "\n"
    }
    return text
}

// Создаем колоду карт туннелей
function createDeck() {
    let deck = [
        "⬜","⬜","⬜","⬜", // прямые туннели
        "🟫","🟫","🟫",       // углы
        "🟦","🟦",           // крест
        "❌","❌"            // тупик
    ]
    return deck.sort(() => Math.random() - 0.5)
}

// Отправка хода игроку
function sendTurn(game, gameId) {
    const player = game.players[game.turn]
    bot.telegram.sendMessage(
        player.id,
        "🎲 Твой ход! Выбери действие:",
        Markup.inlineKeyboard([
            [Markup.button.callback("⛏ Поставить туннель", "place_" + gameId)]
        ])
    )
}

// Распределение ролей гном/вредитель
function assignRoles(players) {
    let roles = []
    let saboteurs = Math.max(1, Math.floor(players.length / 3))
    for (let i = 0; i < saboteurs; i++) roles.push("saboteur")
    while (roles.length < players.length) roles.push("miner")
    return roles.sort(() => Math.random() - 0.5)
}

// ======= Команды бота =======

bot.start((ctx) => {
    ctx.reply(
        "⛏ Saboteur\n\nСоздать новую игру?",
        Markup.inlineKeyboard([
            Markup.button.callback("🎮 Создать игру", "create_game")
        ])
    )
})

// Создание комнаты
bot.action("create_game", (ctx) => {
    const gameId = Math.random().toString(36).substring(2,8)
    games[gameId] = {
        players: [ctx.from],
        started: false
    }

    ctx.reply(
        `🎮 Игра создана!\n\nID: ${gameId}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("➕ Присоединиться", "join_" + gameId)],
            [Markup.button.callback("▶ Начать игру", "start_" + gameId)]
        ])
    )
})

// Присоединение к игре
bot.action(/join_(.+)/, (ctx) => {
    const gameId = ctx.match[1]
    const game = games[gameId]
    if (!game) return ctx.reply("❌ Игра не найдена")

    game.players.push(ctx.from)

    const playerList = game.players.map(p => p.first_name).join("\n")
    ctx.reply(`👥 Игрок присоединился\n\nИгроки:\n${playerList}`)
})

// Старт игры
bot.action(/start_(.+)/, (ctx) => {
    const gameId = ctx.match[1]
    const game = games[gameId]
    if (!game) return ctx.reply("Игра не найдена")

    if (game.players.length < 3) return ctx.reply("❗ Нужно минимум 3 игрока")

    game.started = true
    game.board = createBoard()
    game.deck = createDeck()
    game.turn = 0

    const roles = assignRoles(game.players)
    game.roles = roles

    // Показываем поле всем игрокам
    ctx.reply("🗺 Игровое поле:\n\n" + boardToText(game.board))

    // Отправляем роли каждому игроку
    game.players.forEach((player, i) => {
        let roleText = roles[i] === "miner"
            ? "⛏ Ты ГНОМ. Строй туннель к золоту."
            : "💣 Ты ВРЕДИТЕЛЬ. Помешай гномам."
        bot.telegram.sendMessage(player.id, roleText)
    })

    // Начинаем первый ход
    sendTurn(game, gameId)
})

// Игрок выбирает поставить туннель
bot.action(/place_(.+)/, (ctx) => {
    const gameId = ctx.match[1]
    const game = games[gameId]
    if (!game) return

    const player = game.players[game.turn]
    if (ctx.from.id !== player.id) {
        ctx.answerCbQuery("❌ Не твой ход")
        return
    }

    // Простое предложение клеток для прототипа
    ctx.reply(
        "Выбери координаты для туннеля:",
        Markup.inlineKeyboard([
            [
                Markup.button.callback("X4 Y3", "put_" + gameId + "_4_3"),
                Markup.button.callback("X4 Y5", "put_" + gameId + "_4_5")
            ]
        ])
    )
})

// Игрок ставит туннель на поле
bot.action(/put_(.+)_(\d+)_(\d+)/, (ctx) => {
    const gameId = ctx.match[1]
    const x = parseInt(ctx.match[2])
    const y = parseInt(ctx.match[3])
    const game = games[gameId]
    if (!game) return

    game.board[y][x] = "⬜" // ставим туннель

    ctx.reply("⛏ Игрок поставил туннель\n\n" + boardToText(game.board))

    // Переход хода
    game.turn = (game.turn + 1) % game.players.length
    sendTurn(game, gameId)
})

bot.launch()
console.log("🚀 Saboteur bot started")
