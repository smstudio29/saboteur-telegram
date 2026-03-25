const { Telegraf, Markup } = require("telegraf")

const bot = new Telegraf(process.env.BOT_TOKEN)
let games = {}

// ======= Функции игры =======
function createBoard() {
    const size = 9
    let board = []
    for (let y = 0; y < size; y++) {
        board[y] = []
        for (let x = 0; x < size; x++) board[y][x] = "⬛"
    }
    board[4][4] = "🏠"
    board[4][8] = "🪙"
    return board
}

function boardToText(board) {
    let text = ""
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) text += board[y][x]
        text += "\n"
    }
    return text
}

function createDeck() {
    let deck = []
    for (let i = 0; i < 15; i++) deck.push("⬜")
    for (let i = 0; i < 10; i++) deck.push("🟫")
    for (let i = 0; i < 5; i++) deck.push("🟦")
    for (let i = 0; i < 4; i++) deck.push("❌")
    return deck.sort(() => Math.random() - 0.5)
}

function createActionDeck() {
    let deck = []
    for(let i=0;i<6;i++) deck.push("🔨")
    for(let i=0;i<4;i++) deck.push("💣")
    return deck.sort(() => Math.random() - 0.5)
}

function assignRoles(players) {
    let roles = []
    let saboteurs = Math.max(1, Math.floor(players.length / 3))
    for (let i = 0; i < saboteurs; i++) roles.push("saboteur")
    while (roles.length < players.length) roles.push("miner")
    return roles.sort(() => Math.random() - 0.5)
}

function canPlaceTunnel(board, x, y) {
    if (x < 0 || x >= board[0].length || y < 0 || y >= board.length) return false
    if (board[y][x] !== "⬛") return false
    const directions = [[0,1],[1,0],[0,-1],[-1,0]]
    for (let [dx,dy] of directions) {
        let nx=x+dx, ny=y+dy
        if (nx>=0 && nx<board[0].length && ny>=0 && ny<board.length) {
            if (board[ny][nx]!=="⬛") return true
        }
    }
    return false
}

function getAvailableCells(board) {
    let cells = []
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (canPlaceTunnel(board, x, y)) cells.push({x, y})
        }
    }
    return cells
}

function showPlayerActions(player) {
    if(!player.actions || player.actions.length===0) return "🃏 Нет карт действий"
    return "🎴 Твои карты действий:\n" + player.actions.map((c,i)=>`${i+1}. ${c}`).join("\n")
}

function sendTurn(game, gameId) {
    const player = game.players[game.turn]
    bot.telegram.sendMessage(
        player.id,
        "🎲 Твой ход! Выбери действие:\n\n" + showPlayerActions(player),
        Markup.inlineKeyboard([
            [Markup.button.callback("⛏ Поставить туннель", "place_" + gameId)],
            [Markup.button.callback("🎴 Использовать карту действия", "action_" + gameId)]
        ])
    )
}

// ======= Команды бота =======
bot.start((ctx)=>{
    ctx.reply("⛏ Saboteur\n\nСоздать новую игру?",
        Markup.inlineKeyboard([Markup.button.callback("🎮 Создать игру","create_game")]))
})

bot.action("create_game",(ctx)=>{
    const gameId = Math.random().toString(36).substring(2,8)
    games[gameId] = {players:[ctx.from], started:false}
    ctx.reply(`🎮 Игра создана!\n\nID: ${gameId}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("➕ Присоединиться","join_"+gameId)],
            [Markup.button.callback("▶ Начать игру","start_"+gameId)]
        ]))
})

bot.action(/join_(.+)/,(ctx)=>{
    const gameId = ctx.match[1], game=games[gameId]
    if(!game) return ctx.reply("❌ Игра не найдена")
    game.players.push(ctx.from)
    const playerList=game.players.map(p=>p.first_name).join("\n")
    ctx.reply(`👥 Игрок присоединился\n\nИгроки:\n${playerList}`)
})

bot.action(/start_(.+)/,(ctx)=>{
    const gameId=ctx.match[1], game=games[gameId]
    if(!game) return ctx.reply("Игра не найдена")
    if(game.players.length<3) return ctx.reply("❗ Нужно минимум 3 игрока")
    game.started=true
    game.board=createBoard()
    game.deck=createDeck()
    game.turn=0
    const roles=assignRoles(game.players)
    game.roles=roles
    game.players.forEach(player=>{
        player.actions = createActionDeck().slice(0,3)
    })
    ctx.reply("🗺 Игровое поле:\n\n"+boardToText(game.board))
    game.players.forEach((player,i)=>{
        const roleText=roles[i]==="miner"?"⛏ Ты ГНОМ. Строй туннель к золоту.":"💣 Ты ВРЕДИТЕЛЬ. Помешай гномам."
        bot.telegram.sendMessage(player.id,roleText)
    })
    sendTurn(game,gameId)
})

bot.action(/place_(.+)/,(ctx)=>{
    const gameId = ctx.match[1]
    const game = games[gameId]
    if(!game) return
    const player = game.players[game.turn]
    if(ctx.from.id!==player.id){ctx.answerCbQuery("❌ Не твой ход");return}

    const available = getAvailableCells(game.board)
    if(available.length===0){ctx.reply("⚠ Нет доступных клеток для размещения туннеля."); return}

    const buttons=[]
    for(let i=0;i<available.length;i+=3){
        const row=available.slice(i,i+3).map(c=>
            Markup.button.callback(`X${c.x} Y${c.y}`,`put_${gameId}_${c.x}_${c.y}`)
        )
        buttons.push(row)
    }
    ctx.reply("Выбери клетку для туннеля:",Markup.inlineKeyboard(buttons))
})

bot.action(/put_(.+)_(\d+)_(\d+)/,(ctx)=>{
    const gameId=ctx.match[1], x=parseInt(ctx.match[2]), y=parseInt(ctx.match[3]), game=games[gameId]
    if(!game) return
    if(!canPlaceTunnel(game.board,x,y)){ctx.answerCbQuery("❌ Нельзя ставить сюда карту!");return}

    let card=game.deck.pop()||"⬜"
    game.board[y][x]=card
    ctx.reply("⛏ Игрок поставил туннель\n\n"+boardToText(game.board))

    if(game.board[y][x]==="🪙" && card!=="❌"){
        ctx.reply("🎉 ГНОМЫ достигли золота! Победа гномов!")
        game.players.forEach(p=>{
            const msg=game.roles[game.players.indexOf(p)]==="miner"?"🏆 Ты выиграл!":"💀 Ты проиграл!"
            bot.telegram.sendMessage(p.id,msg)
        })
        delete games[gameId]; return
    }

    if(game.deck.length===0){
        ctx.reply("💣 Колода закончилась! Победа ВРЕДИТЕЛЕЙ!")
        game.players.forEach(p=>{
            const msg=game.roles[game.players.indexOf(p)]==="saboteur"?"🏆 Ты выиграл!":"💀 Ты проиграл!"
            bot.telegram.sendMessage(p.id,msg)
        })
        delete games[gameId]; return
    }

    game.turn=(game.turn+1)%game.players.length
    sendTurn(game,gameId)
})

bot.action(/action_(.+)/,(ctx)=>{
    const gameId=ctx.match[1]
    const game = games[gameId]
    if(!game) return
    const player = game.players[game.turn]
    if(ctx.from.id !== player.id){ctx.answerCbQuery("❌ Не твой ход");return}

    const buttons=[]
    for(let y=0;y<game.board.length;y++){
        const row=[]
        for(let x=0;x<game.board[y].length;x++){
            if(game.board[y][x]!=="⬛" && game.board[y][x]!=="🏠" && game.board[y][x]!=="🪙"){
                row.push(Markup.button.callback(`X${x} Y${y}`,`useaction_${gameId}_${x}_${y}`))
            }
        }
        if(row.length>0) buttons.push(row)
    }
    if(buttons.length===0){ctx.reply("⚠ Нет клеток для действия."); return}

    ctx.reply("Выбери клетку для применения карты действия:", Markup.inlineKeyboard(buttons))
})

bot.action(/useaction_(.+)_(\d+)_(\d+)/,(ctx)=>{
    const gameId=ctx.match[1], x=parseInt(ctx.match[2]), y=parseInt(ctx.match[3])
    const game = games[gameId]
    if(!game) return
    const player = game.players[game.turn]
    if(!player.actions || player.actions.length===0){ctx.reply("🃏 У тебя нет карт действий"); return}
    const card = player.actions.shift()

    if(card==="💣"){
        game.board[y][x]="❌"
        ctx.reply(`💣 Игрок сломал туннель!\n\n`+boardToText(game.board))
    }else if(card==="🔨"){
        game.board[y][x]="⬜"
        ctx.reply(`🔨 Игрок починил туннель!\n\n`+boardToText(game.board))
    }

    game.turn = (game.turn+1)%game.players.length
    sendTurn(game,gameId)
})

bot.launch()
console.log("🚀 Saboteur bot with action cards started")
