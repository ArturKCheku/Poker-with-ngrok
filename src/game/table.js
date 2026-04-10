const {
  getIO
} = require('../config/socket');
const {
  rooms,
  reconnectTimers,
  roundPlayerActions,
  playerTimeouts
} = require('./state');
const os = require('os');

/**
 * Genera un código alfanumérico único de 6 dígitos para crear una nueva sala.
 */
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  if (rooms.has(result)) {
    return generateRoomCode();
  }
  return result;
}
/**
 * Sincroniza el estado actual del juego exclusivamente hacia un jugador que se acaba de reconectar.
 */
function syncGameStateToPlayer(socket, room, player) {
  socket.emit('game-state-sync', {
    players: room.players,
    potTotal: room.potTotal,
    currentBet: room.currentBet,
    currentPlayerTurn: room.currentPlayerTurn,
    currentRound: room.currentRound,
    dealerPosition: room.dealerPosition,
    smallBlindIndex: room.smallBlindIndex,
    bigBlindIndex: room.bigBlindIndex,
    gameStarted: room.gameStarted,
    gameFinished: room.gameFinished,
    isReconnect: true
  });
}

/**
 * Controla el flujo de turnos, saltando a jugadores desconectados o retirados e identificando el final de la vuelta.
 */
function advanceToNextPlayer(room, roomCode) {
  if (checkAndHandleLastActivePlayer(room, roomCode)) {
    return;
  }
  const activePlayers = room.players.filter(p => !p.folded && !p.bankrupt && !p.isSpectator && !p.disconnected && p.chips > 0);
  if (activePlayers.length <= 1) {
    room.currentPlayerTurn = -1;
    checkAndHandleGameContinuation(room, roomCode);
    return;
  }
  const allActivePlayersActed = activePlayers.every(p => p.hasActed);
  if (allActivePlayersActed) {
    console.log(`   🎯 Todos los jugadores activos han actuado - terminando ronda`);
    room.currentPlayerTurn = -1;
    getIO().to(roomCode).emit('game-state-sync', {
      players: room.players,
      potTotal: room.potTotal,
      currentBet: room.currentBet,
      currentPlayerTurn: room.currentPlayerTurn,
      currentRound: room.currentRound,
      dealerPosition: room.dealerPosition,
      smallBlindIndex: room.smallBlindIndex,
      bigBlindIndex: room.bigBlindIndex
    });
    setTimeout(() => {
      advanceToNextRound(room, roomCode);
    }, 1000);
    return;
  }
  let nextIndex = (room.currentPlayerTurn + 1) % room.players.length;
  let attempts = 0;
  while (attempts < room.players.length) {
    const player = room.players[nextIndex];
    if (!player.folded && !player.bankrupt && !player.isSpectator && !player.disconnected && player.chips > 0 && !player.hasActed) {
      room.currentPlayerTurn = nextIndex;
      break;
    }
    nextIndex = (nextIndex + 1) % room.players.length;
    attempts++;
  }
  if (attempts >= room.players.length) {
    console.log(`   🎯 No se encontraron jugadores que no hayan actuado - terminando ronda`);
    room.currentPlayerTurn = -1;
    getIO().to(roomCode).emit('game-state-sync', {
      players: room.players,
      potTotal: room.potTotal,
      currentBet: room.currentBet,
      currentPlayerTurn: room.currentPlayerTurn,
      currentRound: room.currentRound,
      dealerPosition: room.dealerPosition,
      smallBlindIndex: room.smallBlindIndex,
      bigBlindIndex: room.bigBlindIndex
    });
    setTimeout(() => {
      advanceToNextRound(room, roomCode);
    }, 1000);
    return;
  }
  getIO().to(roomCode).emit('game-state-sync', {
    players: room.players,
    potTotal: room.potTotal,
    currentBet: room.currentBet,
    currentPlayerTurn: room.currentPlayerTurn,
    currentRound: room.currentRound,
    dealerPosition: room.dealerPosition,
    smallBlindIndex: room.smallBlindIndex,
    bigBlindIndex: room.bigBlindIndex
  });
  if (shouldRoundEnd(room, roomCode)) {
    console.log(`🎯 Ronda ${room.currentRound} completada después de auto-fold`);
    setTimeout(() => {
      advanceToNextRound(room, roomCode);
    }, 1000);
  }
}

/**
 * Función principal interna: resetHasActedForActivePlayers. Reacciona y ejecuta la lógica estandarizada.
 */
function resetHasActedForActivePlayers(room) {
  room.players.forEach(p => {
    if (!p.folded && !p.bankrupt && !p.isSpectator && !p.disconnected && p.chips > 0) {
      p.hasActed = false;
    }
  });
}

/**
 * Determina bajo el ciclo de poker si todos los jugadores completaron sus acciones obligatorias en la mesa.
 */
function shouldRoundEnd(room, roomCode) {
  if (checkAndHandleLastActivePlayer(room, roomCode)) {
    return true;
  }
  const validPlayers = room.players.filter(p => p && typeof p === 'object');
  const activePlayers = validPlayers.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
  console.log(`   Jugadores activos: ${activePlayers.length}`);
  if (activePlayers.length === 1) {
    console.log(`   ✅ Solo queda un jugador activo: ${activePlayers[0].name}`);
    return true;
  }
  if (shouldEndRoundDueToAllIn(room)) {
    console.log('   ✅ Condición ALL-IN cumplida - terminando ronda');
    return true;
  }
  const maxBet = Math.max(...validPlayers.map(p => p.bet).filter(bet => typeof bet === 'number'));
  const allPlayersMatched = activePlayers.every(p => p.bet === maxBet || p.chips === 0);
  activePlayers.forEach(player => {
    const status = player.bet === maxBet || player.chips === 0 ? '✅' : '❌';
    console.log(`   ${status} ${player.name} ${player.bet === maxBet ? 'ha igualado' : player.chips === 0 ? 'ALL-IN' : 'NO ha igualado'} (apuesta: $${player.bet} vs máxima: $${maxBet})`);
  });
  if (room.currentRound === 'preflop') {
    const bbPlayer = room.players[room.bigBlindIndex];
    const bbHasActed = bbPlayer ? bbPlayer.hasActed || bbPlayer.folded || bbPlayer.chips === 0 : false;
    console.log(`   BB ha actuado: ${bbHasActed}`);
    console.log(`   Todos han igualado: ${allPlayersMatched}`);
    let hasCompletedRound = false;
    const playersWhoCanAct = activePlayers.filter(p => p.chips > 0);
    const playersWhoActed = playersWhoCanAct.filter(p => p.hasActed).length;
    if (playersWhoActed === playersWhoCanAct.length) {
      hasCompletedRound = true;
      console.log(`   ✅ Vuelta completa - Todos los ${playersWhoCanAct.length} jugadores que pueden actuar han actuado`);
    } else {
      console.log(`   ❌ Vuelta incompleta - ${playersWhoActed}/${playersWhoCanAct.length} jugadores han actuado`);
    }
    return bbHasActed && allPlayersMatched && hasCompletedRound;
  } else {
    console.log(`   🔄 Verificando ronda ${room.currentRound}:`);
    const playersWhoCanAct = activePlayers.filter(p => p.chips > 0);
    const allPlayersActed = playersWhoCanAct.every(p => p.hasActed);
    console.log(`   Todos han actuado: ${allPlayersActed}`);
    console.log(`   Todos han igualado/apuesta completa: ${allPlayersMatched}`);
    const shouldEnd = allPlayersActed && allPlayersMatched;
    console.log(`   ✅ Ronda ${room.currentRound} debe terminar: ${shouldEnd}`);
    return shouldEnd;
  }
}

/**
 * Función principal interna: shouldEndRoundDueToAllIn. Reacciona y ejecuta la lógica estandarizada.
 */
function shouldEndRoundDueToAllIn(room) {
  const validPlayers = room.players.filter(p => p && typeof p === 'object');
  const activePlayers = validPlayers.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
  const allInPlayers = activePlayers.filter(p => p.chips === 0);
  const playersWithChips = activePlayers.filter(p => p.chips > 0);
  console.log(`🔍 shouldEndRoundDueToAllIn - Con fichas: ${playersWithChips.length}, ALL-IN: ${allInPlayers.length}`);
  if (playersWithChips.length === 1 && allInPlayers.length >= 1) {
    const lastPlayerWithChips = playersWithChips[0];
    const maxBet = Math.max(...validPlayers.map(p => p.bet).filter(bet => typeof bet === 'number'));
    if (lastPlayerWithChips.bet === maxBet) {
      console.log(`🎯 Condición ALL-IN detectada en shouldEndRoundDueToAllIn: ${lastPlayerWithChips.name} ha igualado ($${maxBet}) vs ${allInPlayers.length} all-in`);
      return true;
    } else {
      console.log(`🎯 Condición ALL-IN pendiente en shouldEndRoundDueToAllIn: ${lastPlayerWithChips.name} no ha igualado (apuesta: $${lastPlayerWithChips.bet} vs máxima: $${maxBet})`);
      return false;
    }
  }
  return false;
}

/**
 * Fracciona el bote maestro en sub-botes vinculando a los contribuyentes activos que igualaron apuestas.
 */

function calculateSidePots(room) {
  if (!room || !room.players || !Array.isArray(room.players)) {
    console.error('❌ Room o players no válidos para calcular side pots');
    return [{
      amount: room?.potTotal || 0,
      players: []
    }];
  }
  const activePlayers = room.players.filter(p => p && !p.folded && !p.bankrupt && !p.isSpectator && p.bet > 0);
  if (activePlayers.length === 0) {
    return [{
      amount: room.potTotal,
      players: []
    }];
  }
  const sortedPlayers = [...activePlayers].sort((a, b) => (a.bet || 0) - (b.bet || 0));
  const sidePots = [];
  let previousBet = 0;
  console.log('🔍 Calculando side pots para apuestas:', sortedPlayers.map(p => `${p.name}: $${p.bet}`));
  for (let i = 0; i < sortedPlayers.length; i++) {
    const currentPlayer = sortedPlayers[i];
    if (!currentPlayer) continue;
    const currentBet = currentPlayer.bet || 0;
    if (currentBet > previousBet) {
      const betDifference = currentBet - previousBet;
      const contributingPlayers = sortedPlayers.filter(p => p && (p.bet || 0) >= currentBet);
      const potAmount = betDifference * contributingPlayers.length;
      if (potAmount > 0) {
        sidePots.push({
          amount: potAmount,
          level: currentBet,
          players: contributingPlayers.map(p => ({
            id: p.id,
            name: p.name,
            bet: p.bet,
            chips: p.chips
          }))
        });
      }
      previousBet = currentBet;
    }
  }
  const calculatedTotal = sidePots.reduce((sum, pot) => sum + pot.amount, 0);
  const actualTotal = room.potTotal;
  if (calculatedTotal !== actualTotal) {
    console.log(`🔍 Ajustando side pots: calculado $${calculatedTotal} vs real $${actualTotal}`);
    if (sidePots.length > 0) {
      const difference = actualTotal - calculatedTotal;
      sidePots[sidePots.length - 1].amount += difference;
      console.log(`🔍 Ajustado último side pot por $${difference}`);
    }
  }
  console.log('🔍 Side pots calculados:', sidePots.map((pot, index) => ({
    potIndex: index + 1,
    amount: pot.amount,
    level: pot.level,
    players: pot.players.map(p => p?.name || 'Unknown')
  })));
  return sidePots;
}

/**
 * Lógica principal de partición de botes. Reparte el dinero a los ganadores según sus contribuciones por All-In.
 */

function distributeSidePots(room, winners, sidePots) {
  console.log('💰 Distribuyendo side pots...');
  console.log('🎯 Ganadores seleccionados:', winners.map(w => w.name));
  if (!sidePots || !Array.isArray(sidePots)) {
    console.error('❌ sidePots no es un array válido:', sidePots);
    return;
  }
  console.log('💰 Estado inicial de fichas (después de apuestas):');
  room.players.forEach(player => {
    if (player) {
      console.log(`   ${player.name}: $${player.chips} (apuesta: $${player.bet})`);
    }
  });
  const originalPlayerMap = new Map();
  room.players.forEach(player => {
    if (player && player.id) {
      originalPlayerMap.set(player.id, player);
    }
  });
  const originalWinners = winners.map(winner => originalPlayerMap.get(winner.id)).filter(winner => winner);
  console.log('🎯 Ganadores originales:', originalWinners.map(w => w.name));
  let totalDistributed = 0;
  sidePots.forEach((pot, potIndex) => {
    if (!pot || typeof pot !== 'object') {
      console.error(`❌ Side pot ${potIndex} no es válido:`, pot);
      return;
    }
    console.log(`\n🎯 Procesando side pot ${potIndex + 1}: $${pot.amount} (nivel: $${pot.level})`);
    const potPlayers = Array.isArray(pot.players) ? pot.players : [];
    const originalPotPlayers = potPlayers.map(potPlayer => originalPlayerMap.get(potPlayer.id)).filter(player => player);
    const eligibleWinners = originalWinners.filter(winner => winner && winner.id && originalPotPlayers.some(potPlayer => potPlayer && potPlayer.id === winner.id));
    console.log(`   ✅ Ganadores elegibles para side pot ${potIndex + 1}:`, eligibleWinners.map(w => w.name));
    if (eligibleWinners.length === 0) {
      console.log(`⚠️ No hay ganadores elegibles para el side pot ${potIndex + 1}`);
      console.log(`   💰 Distribuyendo $${pot.amount} exactamente a los contribuyentes...`);
      const previousLevel = potIndex > 0 ? sidePots[potIndex - 1].level : 0;
      const contributionPerPlayer = pot.level - previousLevel;
      console.log(`   🔍 Nivel anterior: $${previousLevel}, Contribución por jugador: $${contributionPerPlayer}`);
      originalPotPlayers.forEach(player => {
        if (player && typeof player === 'object') {
          player.chips += contributionPerPlayer;
          totalDistributed += contributionPerPlayer;
          console.log(`   💰 ${player.name} recibe $${contributionPerPlayer} de devolución (ahora tiene $${player.chips})`);
        }
      });
      pot.winners = [];
      return;
    }
    const splitAmount = Math.floor(pot.amount / eligibleWinners.length);
    const remainder = pot.amount % eligibleWinners.length;
    console.log(`   💰 Dividiendo $${pot.amount} entre ${eligibleWinners.length} ganadores`);
    eligibleWinners.forEach((winner, index) => {
      if (winner && typeof winner === 'object') {
        const amountWon = splitAmount + (index === 0 ? remainder : 0);
        winner.chips += amountWon;
        totalDistributed += amountWon;
        console.log(`   ✅ ${winner.name} gana $${amountWon} del side pot ${potIndex + 1} (ahora tiene $${winner.chips})`);
      }
    });
    pot.winners = eligibleWinners.map((winner, index) => ({
      name: winner.name,
      amount: splitAmount + (index === 0 ? remainder : 0)
    }));
  });
  console.log(`\n💰 Resumen de distribución:`);
  console.log(`   Bote total: $${room.potTotal}`);
  console.log(`   Total distribuido: $${totalDistributed}`);
  console.log('💰 Estado después de distribución:');
  room.players.forEach(player => {
    if (player) {
      console.log(`   ${player.name}: $${player.chips} fichas`);
    }
  });
  room.potTotal = 0;
}

/**
 * Función principal interna: getInitialChips. Reacciona y ejecuta la lógica estandarizada.
 */

function getInitialChips(player, room) {
  if (!player || !room) return room?.initialMoney || 300;
  return room.initialMoney || 300;
}

/**
 * Función principal interna: notifyAllInCondition. Reacciona y ejecuta la lógica estandarizada.
 */
function notifyAllInCondition(room, roomCodeUpper) {
  const activePlayers = room.players.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
  const allInPlayers = activePlayers.filter(p => p.chips === 0);
  const playersWithChips = activePlayers.filter(p => p.chips > 0);
  if (playersWithChips.length === 1 && allInPlayers.length >= 1) {
    const lastPlayer = playersWithChips[0];
    const maxBet = Math.max(...room.players.map(p => p.bet));
    const allInNames = allInPlayers.map(p => p.name).join(', ');
    if (lastPlayer.bet < maxBet) {
      getIO().to(roomCodeUpper).emit('system-message-receive', {
        message: `🎯 Condición ALL-IN: ${lastPlayer.name} debe igualar $${maxBet} para continuar.`,
        type: 'system'
      });
    } else {
      getIO().to(roomCodeUpper).emit('system-message-receive', {
        message: `🎯 Condición ALL-IN: ${lastPlayer.name} ya igualó. Avanzando a siguiente ronda...`,
        type: 'system'
      });
    }
  }
}

/**
 * Función principal interna: checkAndHandleGameContinuation. Reacciona y ejecuta la lógica estandarizada.
 */
function checkAndHandleGameContinuation(room, roomCode) {
  const activePlayers = room.players.filter(p => !p.folded && !p.bankrupt && !p.isSpectator && !p.disconnected);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += room.potTotal;
    getIO().to(roomCode).emit('winner-announced', {
      winnerName: winner.name,
      winnerId: winner.id,
      potAmount: room.potTotal,
      players: room.players
    });
    getIO().to(roomCode).emit('system-message-receive', {
      message: `🏆 ${winner.name} gana $${room.potTotal} por ser el único jugador activo!`,
      type: 'win'
    });
    room.potTotal = 0;
    room.currentBet = 0;
    room.players.forEach(p => {
      p.bet = 0;
      if (!p.bankrupt) p.folded = false;
    });
    setTimeout(() => {
      startNewRound(room, roomCode);
    }, 3000);
  } else if (activePlayers.length === 0) {
    room.gameStarted = false;
    room.currentPlayerTurn = -1;
    getIO().to(roomCode).emit('system-message-receive', {
      message: '⏸️ Partida pausada - No hay jugadores activos',
      type: 'warning'
    });
  }
}

/**
 * Revisa si todos en la mesa se han retirado excepto uno, dándole la victoria por omisión (By Default).
 */
function checkAndHandleLastActivePlayer(room, roomCodeUpper) {
  const validPlayers = room.players.filter(p => p && typeof p === 'object');
  const activePlayers = validPlayers.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
  console.log(`🔍 checkAndHandleLastActivePlayer - Activos: ${activePlayers.length}`);
  if (activePlayers.length === 1) {
    console.log(`🏁 Solo queda un jugador activo: ${activePlayers[0].name}`);
    const winner = activePlayers[0];
    winner.chips += room.potTotal;
    getIO().to(roomCodeUpper).emit('winner-announced', {
      winnerName: winner.name,
      winnerId: winner.id,
      potAmount: room.potTotal,
      players: room.players
    });
    getIO().to(roomCodeUpper).emit('system-message-receive', {
      message: `🏆 ${winner.name} gana $${room.potTotal} por ser el único jugador activo!`,
      type: 'win'
    });
    room.potTotal = 0;
    room.currentBet = 0;
    validPlayers.forEach(p => {
      p.bet = 0;
      if (!p.bankrupt) p.folded = false;
    });
    setTimeout(() => {
      startNewRound(room, roomCodeUpper);
    }, 3000);
    return true;
  }
  const allPlayersAllIn = activePlayers.length > 0 && activePlayers.every(p => p.chips === 0);
  if (allPlayersAllIn) {
    console.log(`🎯 TODOS los jugadores están ALL-IN - terminando mano inmediatamente`);
    room.currentRound = 'river';
    room.currentPlayerTurn = -1;
    getIO().to(roomCodeUpper).emit('game-state-sync', {
      players: room.players,
      potTotal: room.potTotal,
      currentBet: room.currentBet,
      currentPlayerTurn: room.currentPlayerTurn,
      currentRound: room.currentRound,
      dealerPosition: room.dealerPosition,
      smallBlindIndex: room.smallBlindIndex,
      bigBlindIndex: room.bigBlindIndex
    });
    const host = validPlayers.find(p => p.isHost);
    if (host) {
      getIO().to(host.socketId).emit('show-winner-selection', {
        roomCode: roomCodeUpper,
        potTotal: room.potTotal,
        players: room.players
      });
      getIO().to(roomCodeUpper).emit('system-message-receive', {
        message: `🎯 TODOS ALL-IN! Seleccionando ganador...`,
        type: 'system'
      });
    }
    return true;
  }
  const playersWithChips = activePlayers.filter(p => p.chips > 0);
  const allInPlayers = activePlayers.filter(p => p.chips === 0);
  console.log(`🔍 Jugadores con fichas: ${playersWithChips.length}, ALL-IN: ${allInPlayers.length}`);
  if (playersWithChips.length === 1 && allInPlayers.length >= 1) {
    const lastPlayerWithChips = playersWithChips[0];
    const maxBet = Math.max(...validPlayers.map(p => p.bet).filter(bet => typeof bet === 'number'));
    if (lastPlayerWithChips.bet === maxBet) {
      console.log(`🎯 Condición ALL-IN detectada: ${lastPlayerWithChips.name} ha igualado ($${maxBet}) vs ${allInPlayers.length} all-in`);
      room.currentRound = 'river';
      room.currentPlayerTurn = -1;
      getIO().to(roomCodeUpper).emit('game-state-sync', {
        players: room.players,
        potTotal: room.potTotal,
        currentBet: room.currentBet,
        currentPlayerTurn: room.currentPlayerTurn,
        currentRound: room.currentRound,
        dealerPosition: room.dealerPosition,
        smallBlindIndex: room.smallBlindIndex,
        bigBlindIndex: room.bigBlindIndex
      });
      const host = validPlayers.find(p => p.isHost);
      if (host) {
        getIO().to(host.socketId).emit('show-winner-selection', {
          roomCode: roomCodeUpper,
          potTotal: room.potTotal,
          players: room.players
        });
        getIO().to(roomCodeUpper).emit('system-message-receive', {
          message: `🎯 Condición ALL-IN: ${lastPlayerWithChips.name} vs ${allInPlayers.length} jugador(es) ALL-IN. Seleccionando ganador...`,
          type: 'system'
        });
      }
      return true;
    } else {
      console.log(`🎯 Condición ALL-IN pendiente: ${lastPlayerWithChips.name} no ha igualado (apuesta: $${lastPlayerWithChips.bet} vs máxima: $${maxBet})`);
    }
  }
  return false;
}

/**
 * Al término de una mano, cicla las fichas de Dealer, Small Blind y Big Blind al siguiente asiento.
 */
function rotatePositions(room) {
  const activePlayers = room.players.filter(p => !p.bankrupt && !p.isSpectator && p.chips > 0);
  if (activePlayers.length < 2) {
    console.log('❌ No hay suficientes jugadores activos para rotar');
    return false;
  }
  const activePlayerIndices = room.players.map((player, index) => ({
    player,
    index
  })).filter(({
    player
  }) => !player.bankrupt && !player.isSpectator && player.chips > 0).map(({
    index
  }) => index);
  if (room.dealerPosition === undefined || room.dealerPosition === -1 || !activePlayerIndices.includes(room.dealerPosition)) {
    room.dealerPosition = activePlayerIndices[0];
  }
  let currentDealerIndexInActive = activePlayerIndices.indexOf(room.dealerPosition);
  const nextDealerIndexInActive = (currentDealerIndexInActive + 1) % activePlayerIndices.length;
  room.dealerPosition = activePlayerIndices[nextDealerIndexInActive];
  const smallBlindIndexInActive = (nextDealerIndexInActive + 1) % activePlayerIndices.length;
  room.smallBlindIndex = activePlayerIndices[smallBlindIndexInActive];
  const bigBlindIndexInActive = (smallBlindIndexInActive + 1) % activePlayerIndices.length;
  room.bigBlindIndex = activePlayerIndices[bigBlindIndexInActive];
  room.roundCount = (room.roundCount || 1) + 1;
  return true;
}

/**
 * Función principal interna: getNetworkIP. Reacciona y ejecuta la lógica estandarizada.
 */
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Determina bajo el ciclo de poker si todos los jugadores completaron sus acciones obligatorias en la mesa.
 */

function shouldRoundEnd(room, roomCode) {
  if (checkAndHandleLastActivePlayer(room, roomCode)) {
    return true;
  }
  const validPlayers = room.players.filter(p => p && typeof p === 'object');
  const activePlayers = validPlayers.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
  console.log(`   Jugadores activos: ${activePlayers.length}`);
  if (activePlayers.length === 1) {
    console.log(`   ✅ Solo queda un jugador activo: ${activePlayers[0].name}`);
    return true;
  }
  const allPlayersAllIn = activePlayers.length > 0 && activePlayers.every(p => p.chips === 0);
  if (allPlayersAllIn) {
    console.log('   ✅ TODOS los jugadores están ALL-IN - terminando ronda');
    return true;
  }
  if (shouldEndRoundDueToAllIn(room)) {
    console.log('   ✅ Condición ALL-IN cumplida - terminando ronda');
    return true;
  }
  const maxBet = Math.max(...validPlayers.map(p => p.bet).filter(bet => typeof bet === 'number'));
  const allPlayersMatched = activePlayers.every(p => p.bet === maxBet || p.chips === 0);
  activePlayers.forEach(player => {
    const status = player.bet === maxBet || player.chips === 0 ? '✅' : '❌';
    console.log(`   ${status} ${player.name} ${player.bet === maxBet ? 'ha igualado' : player.chips === 0 ? 'ALL-IN' : 'NO ha igualado'} (apuesta: $${player.bet} vs máxima: $${maxBet})`);
  });
  if (room.currentRound === 'preflop') {
    const bbPlayer = room.players[room.bigBlindIndex];
    const bbHasActed = bbPlayer ? bbPlayer.hasActed || bbPlayer.folded || bbPlayer.chips === 0 : false;
    console.log(`   BB ha actuado: ${bbHasActed}`);
    console.log(`   Todos han igualado: ${allPlayersMatched}`);
    const playersWhoCanAct = activePlayers.filter(p => p.chips > 0);
    const playersWhoActed = playersWhoCanAct.filter(p => p.hasActed).length;
    console.log(`   Jugadores que pueden actuar: ${playersWhoCanAct.length}`);
    console.log(`   Jugadores que han actuado: ${playersWhoActed}`);
    const hasCompletedRound = playersWhoActed === playersWhoCanAct.length;
    if (hasCompletedRound) {
      console.log(`   ✅ Vuelta completa - Todos los ${playersWhoCanAct.length} jugadores que pueden actuar han actuado`);
    } else {
      console.log(`   ❌ Vuelta incompleta - ${playersWhoActed}/${playersWhoCanAct.length} jugadores han actuado`);
    }
    return bbHasActed && allPlayersMatched && hasCompletedRound;
  } else {
    console.log(`   🔄 Verificando ronda ${room.currentRound}:`);
    const playersWhoCanAct = activePlayers.filter(p => p.chips > 0);
    const allPlayersActed = playersWhoCanAct.every(p => p.hasActed);
    console.log(`   Todos han actuado: ${allPlayersActed}`);
    console.log(`   Todos han igualado/apuesta completa: ${allPlayersMatched}`);
    const shouldEnd = allPlayersActed && allPlayersMatched;
    console.log(`   ✅ Ronda ${room.currentRound} debe terminar: ${shouldEnd}`);
    return shouldEnd;
  }
}

/**
 * Función principal interna: allPlayersActed. Reacciona y ejecuta la lógica estandarizada.
 */
function allPlayersActed(room) {
  const activePlayers = room.players.filter(p => !p.folded && !p.bankrupt && !p.isSpectator && p.chips > 0);
  if (activePlayers.length <= 1) {
    return true;
  }
  let maxBet = 0;
  room.players.forEach(player => {
    if (player.bet > maxBet) {
      maxBet = player.bet;
    }
  });
  console.log(`🔍 Verificando si todos han actuado - MaxBet: ${maxBet}, ActivePlayers: ${activePlayers.length}`);
  let playersWhoMatched = 0;
  activePlayers.forEach(player => {
    if (player.bet === maxBet || player.chips === 0) {
      playersWhoMatched++;
    }
  });
  const allActed = playersWhoMatched === activePlayers.length;
  console.log(`📊 Jugadores que han igualado: ${playersWhoMatched}/${activePlayers.length} - Todos actuaron: ${allActed}`);
  return allActed;
}

/**
 * Función principal interna: debugRoundState. Reacciona y ejecuta la lógica estandarizada.
 */
function debugRoundState(room) {}

/**
 * Finaliza abruptamente la jugada, anunciando a los clientes que el Host debe seleccionar ganadores.
 */
function finishHand(room, roomCodeUpper) {
  room.currentPlayerTurn = -1;
  room.gameStarted = false;
  console.log(`🏁 MANO TERMINADA - Bote total: $${room.potTotal}`);
  getIO().to(roomCodeUpper).emit('hand-finished', {
    players: room.players,
    potTotal: room.potTotal,
    dealerPosition: room.dealerPosition,
    smallBlindIndex: room.smallBlindIndex,
    bigBlindIndex: room.bigBlindIndex
  });
  const host = room.players.find(p => p.isHost);
  if (host) {
    getIO().to(roomCodeUpper).emit('host-selecting-winner', {
      hostName: host.name,
      potTotal: room.potTotal
    });
    setTimeout(() => {
      getIO().to(host.socketId).emit('show-winner-selection', {
        roomCode: roomCodeUpper,
        potTotal: room.potTotal,
        players: room.players.filter(p => !p.isSpectator)
      });
    }, 1000);
  }
  getIO().to(roomCodeUpper).emit('system-message-receive', {
    message: `🏁 MANO TERMINADA - Selecciona al ganador del bote de $${room.potTotal}`,
    type: 'system'
  });
}

/**
 * Función principal interna: advanceToNextRound. Reacciona y ejecuta la lógica estandarizada.
 */

function advanceToNextRound(room, roomCodeUpper) {
  try {
    const rounds = ['preflop', 'flop', 'turn', 'river'];
    const currentIndex = rounds.indexOf(room.currentRound);
    const activePlayers = room.players.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
    const playersWithChips = activePlayers.filter(p => p.chips > 0);
    const allInPlayers = activePlayers.filter(p => p.chips === 0);
    if (playersWithChips.length === 1 && allInPlayers.length >= 1) {
      console.log('🎯 Avanzando a river directamente por condición ALL-IN');
      room.currentRound = 'river';
      room.currentPlayerTurn = -1;
      getIO().to(roomCodeUpper).emit('game-state-sync', {
        players: room.players,
        potTotal: room.potTotal,
        currentBet: room.currentBet,
        currentPlayerTurn: room.currentPlayerTurn,
        currentRound: room.currentRound,
        dealerPosition: room.dealerPosition,
        smallBlindIndex: room.smallBlindIndex,
        bigBlindIndex: room.bigBlindIndex
      });
      setTimeout(() => {
        finishHand(room, roomCodeUpper);
      }, 1000);
      return;
    }
    if (currentIndex >= rounds.length - 1) {
      console.log('🏁 Todas las rondas completadas, terminando mano');
      finishHand(room, roomCodeUpper);
      return;
    }
    const previousRound = room.currentRound;
    const nextRound = rounds[currentIndex + 1];
    room.bbHasActed = false;
    room.lastBettor = null;
    resetHasActedForActivePlayers(room);
    let firstPlayerIndex;
    if (nextRound === 'preflop') {
      firstPlayerIndex = (room.bigBlindIndex + 1) % room.players.length;
    } else {
      firstPlayerIndex = (room.dealerPosition + 1) % room.players.length;
    }
    let attempts = 0;
    while ((room.players[firstPlayerIndex].folded || room.players[firstPlayerIndex].bankrupt || room.players[firstPlayerIndex].isSpectator) && attempts < room.players.length) {
      firstPlayerIndex = (firstPlayerIndex + 1) % room.players.length;
      attempts++;
    }
    room.currentRound = nextRound;
    room.currentPlayerTurn = firstPlayerIndex;
    getIO().to(roomCodeUpper).emit('round-advanced', {
      previousRound: previousRound,
      currentRound: nextRound,
      players: room.players,
      currentPlayerTurn: firstPlayerIndex,
      potTotal: room.potTotal,
      currentBet: room.currentBet,
      dealerPosition: room.dealerPosition
    });
  } catch (error) {
    console.error('❌ Error en advanceToNextRound:', error);
  }
}

/**
 * Limpia la mesa e inicializa la fase Preflop. Cobra las ciegas automáticas e inicia el turno.
 */

function startNewRound(room, roomCodeUpper) {
  try {
    room.players.forEach(player => {
      if (player && player.chips <= 0 && !player.bankrupt && !player.isSpectator) {
        player.bankrupt = true;
        player.folded = true;
        console.log(`💀 ${player.name} eliminado por bancarrota`);
      }
    });
    const spectators = room.players.filter(p => p.isSpectator);
    if (spectators.length > 0) {
      spectators.forEach(spectator => {
        spectator.isSpectator = false;
        spectator.chips = room.initialMoney || 300;
        spectator.bet = 0;
        spectator.folded = false;
        spectator.bankrupt = false;
      });
      getIO().to(roomCodeUpper).emit('system-message-receive', {
        message: `🎮 ${spectators.length} espectador(es) convertidos a jugadores!`,
        type: 'system'
      });
      getIO().to(roomCodeUpper).emit('players-updated', {
        players: room.players,
        roomCode: roomCodeUpper
      });
    }
    room.gameStarted = true;
    room.currentRound = 'preflop';
    room.roundsCompleted = 0;
    room.minRaise = room.bigBlind;
    room.players.forEach(player => {
      player.bet = 0;
      player.hasActed = false;
      if (!player.bankrupt && !player.isSpectator) {
        player.folded = false;
      }
    });
    const activePlayers = room.players.filter(p => !p.bankrupt && !p.isSpectator && p.chips > 0);
    if (activePlayers.length < 2) {
      console.log('❌ No hay suficientes jugadores activos para nueva mano');
      room.gameStarted = false;
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        getIO().to(roomCodeUpper).emit('system-message-receive', {
          message: `🏆 ${winner.name} gana por ser el único jugador activo!`,
          type: 'win'
        });
      } else {
        getIO().to(roomCodeUpper).emit('system-message-receive', {
          message: '❌ No hay jugadores activos. Esperando más jugadores...',
          type: 'system'
        });
      }
      return;
    }
    if (!rotatePositions(room)) {
      console.log('❌ No se pudo rotar posiciones');
      room.gameStarted = false;
      return;
    }
    const smallBlindAmount = room.smallBlind;
    const bigBlindAmount = room.bigBlind;
    const sbPlayer = room.players[room.smallBlindIndex];
    if (sbPlayer && !sbPlayer.bankrupt && !sbPlayer.isSpectator) {
      if (sbPlayer.chips >= smallBlindAmount) {
        sbPlayer.chips -= smallBlindAmount;
        sbPlayer.bet = smallBlindAmount;
        room.potTotal += smallBlindAmount;
      } else {
        const allInAmount = sbPlayer.chips;
        sbPlayer.chips = 0;
        sbPlayer.bet = allInAmount;
        room.potTotal += allInAmount;
      }
    }
    const bbPlayer = room.players[room.bigBlindIndex];
    if (bbPlayer && !bbPlayer.bankrupt && !bbPlayer.isSpectator) {
      if (bbPlayer.chips >= bigBlindAmount) {
        bbPlayer.chips -= bigBlindAmount;
        bbPlayer.bet = bigBlindAmount;
        room.potTotal += bigBlindAmount;
        room.currentBet = bigBlindAmount;
        console.log(`   BB: ${bbPlayer.name} apuesta $${bigBlindAmount}`);
      } else {
        const allInAmount = bbPlayer.chips;
        bbPlayer.chips = 0;
        bbPlayer.bet = allInAmount;
        room.potTotal += allInAmount;
        room.currentBet = allInAmount;
        console.log(`   BB: ${bbPlayer.name} ALL-IN $${allInAmount}`);
      }
    }
    room.currentPlayerTurn = (room.bigBlindIndex + 1) % room.players.length;
    let attempts = 0;
    while (attempts < room.players.length * 2) {
      const player = room.players[room.currentPlayerTurn];
      if (player && !player.folded && !player.bankrupt && !player.isSpectator && player.chips > 0) {
        break;
      }
      room.currentPlayerTurn = (room.currentPlayerTurn + 1) % room.players.length;
      attempts++;
    }
    if (attempts >= room.players.length * 2) {
      console.log('❌ No se pudo encontrar jugador activo para el turno');
      room.currentPlayerTurn = -1;
      room.gameStarted = false;
      return;
    }
    getIO().to(roomCodeUpper).emit('new-hand-started', {
      players: room.players,
      dealerPosition: room.dealerPosition,
      smallBlindIndex: room.smallBlindIndex,
      bigBlindIndex: room.bigBlindIndex,
      currentPlayerTurn: room.currentPlayerTurn,
      potTotal: room.potTotal,
      currentBet: room.currentBet,
      currentRound: room.currentRound
    });
    console.log(`🎯 Nueva mano iniciada exitosamente en ${roomCodeUpper}`);
  } catch (error) {
    console.error('❌ Error en startNewRound:', error);
  }
}

/**
 * Función principal interna: findNextActivePlayerIndex. Reacciona y ejecuta la lógica estandarizada.
 */
function findNextActivePlayerIndex(room, startIndex) {
  if (!room || !room.players || room.players.length === 0) {
    console.log('❌ Room o players inválidos en findNextActivePlayerIndex');
    return -1;
  }
  console.log(`🔍 Buscando siguiente jugador activo desde índice ${startIndex}`);
  startIndex = Math.max(0, Math.min(startIndex, room.players.length - 1));
  let index = (startIndex + 1) % room.players.length;
  let attempts = 0;
  const activePlayers = room.players.filter(p => !p.folded && !p.bankrupt && !p.isSpectator && p.chips > 0);
  console.log(`   Jugadores activos totales: ${activePlayers.length}`);
  if (activePlayers.length === 0) {
    console.log('   ❌ No hay jugadores activos');
    return -1;
  }
  while (attempts < room.players.length) {
    const player = room.players[index];
    console.log(`   Verificando jugador ${player.name} (índice: ${index})`);
    if (!player.folded && !player.bankrupt && !player.isSpectator && !player.disconnected && player.chips > 0) {
      console.log(`   ✅ Jugador activo encontrado: ${player.name}`);
      return index;
    }
    index = (index + 1) % room.players.length;
    attempts++;
  }
  console.log('   ❌ No se encontró siguiente jugador activo');
  return -1;
}
module.exports = {
  generateRoomCode,
  syncGameStateToPlayer,
  advanceToNextPlayer,
  resetHasActedForActivePlayers,
  shouldRoundEnd,
  shouldEndRoundDueToAllIn,
  calculateSidePots,
  distributeSidePots,
  getInitialChips,
  notifyAllInCondition,
  checkAndHandleGameContinuation,
  checkAndHandleLastActivePlayer,
  rotatePositions,
  getNetworkIP,
  shouldRoundEnd,
  allPlayersActed,
  debugRoundState,
  finishHand,
  advanceToNextRound,
  startNewRound,
  findNextActivePlayerIndex
};