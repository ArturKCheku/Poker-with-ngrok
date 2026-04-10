const {
  rooms,
  reconnectTimers,
  roundPlayerActions,
  playerTimeouts
} = require('../game/state');
const table = require('../game/table');

/**
 * Vincula y registra todos los eventos IO de un socket (jugador) recién conectado al hub central.
 */
const registerActions = (io, socket) => {
  socket.on('create-room', data => {
    try {
      const {
        playerName,
        initialMoney
      } = data;
      if (!playerName || typeof playerName !== 'string') {
        socket.emit('error', 'Por favor ingresa un nombre válido');
        return;
      }
      const trimmedName = playerName.trim();
      if (trimmedName.length === 0) {
        socket.emit('error', 'El nombre no puede estar vacío');
        return;
      }
      if (trimmedName.replace(/\s/g, '').length === 0) {
        socket.emit('error', 'El nombre no puede contener solo espacios');
        return;
      }
      if (trimmedName.length < 1 || trimmedName.length > 15) {
        socket.emit('error', 'El nombre debe tener entre 1 y 15 caracteres');
        return;
      }
      const nameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/;
      if (!nameRegex.test(trimmedName)) {
        socket.emit('error', 'El nombre solo puede contener letras, números y espacios');
        return;
      }
      const money = parseInt(initialMoney);
      if (isNaN(money) || money < 100 || money > 10000) {
        socket.emit('error', 'El dinero inicial debe ser un número entre 100 y 10000');
        return;
      }
      const roomCode = table.generateRoomCode();
      const room = {
        code: roomCode,
        players: [{
          id: socket.id,
          name: trimmedName,
          chips: money,
          bet: 0,
          folded: false,
          isHost: true,
          bankrupt: false,
          socketId: socket.id
        }],
        gameStarted: false,
        gameFinished: false,
        host: socket.id,
        currentPlayerTurn: 0,
        currentBet: 0,
        potTotal: 0,
        dealerPosition: 0,
        smallBlind: 10,
        bigBlind: 20,
        initialMoney: money,
        createdAt: new Date(),
        currentRound: 'preflop',
        roundsCompleted: 0,
        minRaise: 0
      };
      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.emit('room-created', {
        roomCode: roomCode,
        players: room.players,
        isHost: true,
        initialMoney: room.initialMoney
      });
      console.log(`🎪 Sala creada: ${roomCode} por ${trimmedName} con dinero inicial: $${room.initialMoney}`);
    } catch (error) {
      console.error('❌ Error en create-room:', error);
      socket.emit('error', 'Error interno al crear la sala: ' + error.message);
    }
  });
  socket.on('join-room', data => {
    try {
      const {
        roomCode,
        playerName
      } = data;
      const roomCodeUpper = roomCode.toUpperCase().trim();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('error', `Sala "${roomCodeUpper}" no encontrada`);
        return;
      }
      if (!playerName || typeof playerName !== 'string') {
        socket.emit('error', 'Por favor ingresa un nombre válido');
        return;
      }
      const trimmedName = playerName.trim();
      if (trimmedName.length === 0) {
        socket.emit('error', 'El nombre no puede estar vacío');
        return;
      }
      if (trimmedName.replace(/\s/g, '').length === 0) {
        socket.emit('error', 'El nombre no puede contener solo espacios');
        return;
      }
      if (trimmedName.length < 1 || trimmedName.length > 15) {
        socket.emit('error', 'El nombre debe tener entre 1 y 15 caracteres');
        return;
      }
      const nameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/;
      if (!nameRegex.test(trimmedName)) {
        socket.emit('error', 'El nombre solo puede contener letras, números y espacios');
        return;
      }
      if (!room.gameStarted || room.gameFinished) {
        if (room.players.length >= 6) {
          socket.emit('error', 'La sala está llena (máximo 6 jugadores)');
          return;
        }
        const existingPlayerIndex = room.players.findIndex(p => p.name === trimmedName && p.disconnected);
        if (existingPlayerIndex !== -1) {
          room.players[existingPlayerIndex].socketId = socket.id;
          room.players[existingPlayerIndex].disconnected = false;
          room.players[existingPlayerIndex].isSpectator = false;
          delete room.players[existingPlayerIndex].disconnectedAt;
          console.log(`🔄 ${trimmedName} reconectado`);
        } else {
          const initialChips = room.initialMoney || 300;
          const newPlayer = {
            id: socket.id,
            name: trimmedName,
            chips: initialChips,
            bet: 0,
            folded: false,
            isPlayer: true,
            isHost: false,
            bankrupt: false,
            socketId: socket.id,
            isSpectator: false,
            disconnected: false
          };
          room.players.push(newPlayer);
          console.log(`➕ ${trimmedName} se unió como jugador a ${roomCodeUpper}`);
        }
        socket.join(roomCodeUpper);
        socket.emit('joined-room', {
          roomCode: roomCodeUpper,
          players: room.players,
          isHost: false,
          gameStarted: room.gameStarted,
          gameFinished: room.gameFinished,
          initialMoney: room.initialMoney || 300
        });
        io.to(roomCodeUpper).emit('player-joined', {
          player: room.players.find(p => p.socketId === socket.id),
          players: room.players,
          roomCode: roomCodeUpper
        });
        return;
      }
      if (room.gameStarted && !room.gameFinished) {
        const disconnectedPlayer = room.players.find(p => p.name === playerName && p.disconnected);
        if (disconnectedPlayer) {
          disconnectedPlayer.socketId = socket.id;
          disconnectedPlayer.disconnected = false;
          disconnectedPlayer.isSpectator = false;
          delete disconnectedPlayer.disconnectedAt;
          socket.join(roomCodeUpper);
          socket.emit('reconnect-success', {
            players: room.players,
            roomCode: roomCodeUpper,
            gameStarted: room.gameStarted,
            currentPlayerTurn: room.currentPlayerTurn,
            potTotal: room.potTotal,
            currentBet: room.currentBet,
            isHost: disconnectedPlayer.isHost
          });
          io.to(roomCodeUpper).emit('player-reconnected', {
            playerId: disconnectedPlayer.id,
            playerName: disconnectedPlayer.name,
            players: room.players
          });
          console.log(`✅ ${playerName} reconectado durante partida activa`);
          return;
        }
        const spectatorPlayer = {
          id: socket.id,
          name: playerName,
          chips: 0,
          bet: 0,
          folded: true,
          isPlayer: false,
          isHost: false,
          bankrupt: false,
          socketId: socket.id,
          isSpectator: true,
          disconnected: false
        };
        room.players.push(spectatorPlayer);
        socket.join(roomCodeUpper);
        socket.emit('joined-as-spectator', {
          roomCode: roomCodeUpper,
          players: room.players,
          gameStarted: room.gameStarted,
          potTotal: room.potTotal,
          currentBet: room.currentBet,
          currentPlayerTurn: room.currentPlayerTurn,
          initialMoney: room.initialMoney || 300
        });
        io.to(roomCodeUpper).emit('player-joined', {
          player: spectatorPlayer,
          players: room.players,
          roomCode: roomCodeUpper
        });
        console.log(`👀 ${playerName} se unió como espectador a ${roomCodeUpper}. Total jugadores: ${room.players.length}`);
        return;
      }
      socket.emit('error', 'No se puede unir en este momento');
    } catch (error) {
      console.error('❌ Error en join-room:', error);
      socket.emit('error', 'Error interno al unirse a la sala');
    }
  });
  socket.on('start-game', roomCode => {
    try {
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('error', 'Sala no encontrada');
        return;
      }
      if (socket.id !== room.host) {
        socket.emit('error', 'Solo el anfitrión puede iniciar la partida');
        return;
      }
      if (room.players.length < 2) {
        socket.emit('error', 'Se necesitan al menos 2 jugadores para comenzar');
        return;
      }
      room.players.forEach(player => {
        player.chips = room.initialMoney || 300;
        player.bet = 0;
        player.folded = false;
        player.bankrupt = false;
      });
      room.gameStarted = true;
      room.currentBet = 0;
      room.potTotal = 0;
      room.currentPlayerTurn = 0;
      room.dealerPosition = 0;
      room.currentRound = 'preflop';
      room.bbHasActed = false;
      room.smallBlindIndex = (room.dealerPosition + 1) % room.players.length;
      room.bigBlindIndex = (room.dealerPosition + 2) % room.players.length;
      room.currentPlayerTurn = (room.bigBlindIndex + 1) % room.players.length;
      const smallBlindAmount = 10;
      const bigBlindAmount = 20;
      const sbPlayer = room.players[room.smallBlindIndex];
      sbPlayer.chips -= smallBlindAmount;
      sbPlayer.bet = smallBlindAmount;
      room.potTotal += smallBlindAmount;
      const bbPlayer = room.players[room.bigBlindIndex];
      bbPlayer.chips -= bigBlindAmount;
      bbPlayer.bet = bigBlindAmount;
      room.potTotal += bigBlindAmount;
      room.currentBet = bigBlindAmount;
      io.to(roomCodeUpper).emit('game-started', {
        players: room.players,
        roomCode: roomCodeUpper,
        smallBlind: smallBlindAmount,
        bigBlind: bigBlindAmount,
        dealerPosition: room.dealerPosition,
        smallBlindIndex: room.smallBlindIndex,
        bigBlindIndex: room.bigBlindIndex,
        currentPlayerTurn: room.currentPlayerTurn,
        potTotal: room.potTotal,
        currentBet: room.currentBet,
        currentRound: room.currentRound
      });
    } catch (error) {
      console.error('❌ Error en start-game:', error);
      socket.emit('error', 'Error al iniciar la partida');
    }
  });
  socket.on('round-ended', data => {
    try {
      const {
        roomCode
      } = data;
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('error', 'Sala no encontrada');
        return;
      }
      if (socket.id !== room.host) {
        socket.emit('error', 'Solo el anfitrión puede terminar la partida');
        return;
      }
      console.log(`⏹️ Ronda terminada por host en sala: ${roomCodeUpper}`);
      const spectatorsCount = room.players.filter(p => p.isSpectator).length;
      console.log(`👀 Espectadores encontrados: ${spectatorsCount}`);
      io.to(roomCodeUpper).emit('round-ended-by-host', {
        hostName: room.players.find(p => p.socketId === socket.id)?.name,
        players: room.players,
        convertingSpectators: spectatorsCount > 0,
        spectatorsCount: spectatorsCount
      });
      if (spectatorsCount > 0) {
        console.log(`⏰ Esperando 2 segundos para convertir ${spectatorsCount} espectadores...`);
        io.to(roomCodeUpper).emit('system-message-receive', {
          message: `🔄 Convirtiendo ${spectatorsCount} espectador(es) a jugadores en 2 segundos...`,
          type: 'system'
        });
        setTimeout(() => {
          convertSpectatorsToPlayers(room, roomCodeUpper, socket.id);
        }, 2000);
      } else {
        console.log('✅ No hay espectadores para convertir, procediendo inmediatamente');
        finishRoundForHost(room, roomCodeUpper, socket.id);
      }
    } catch (error) {
      console.error('❌ Error en round-ended:', error);
      socket.emit('error', 'Error al terminar la ronda');
    }
  });

  /**
   * Función principal interna: convertSpectatorsToPlayers. Reacciona y ejecuta la lógica estandarizada.
   */
  function convertSpectatorsToPlayers(room, roomCodeUpper, hostSocketId) {
    try {
      console.log(`🎮 Iniciando conversión de espectadores en ${roomCodeUpper}`);
      let convertedCount = 0;
      room.players = room.players.map(player => {
        if (player.isSpectator) {
          console.log(`🔄 Convirtiendo espectador: ${player.name}`);
          convertedCount++;
          return {
            ...player,
            id: player.socketId,
            chips: room.initialMoney || 300,
            bet: 0,
            folded: false,
            isPlayer: true,
            isHost: false,
            bankrupt: false,
            isSpectator: false,
            disconnected: false
          };
        }
        return player;
      });
      console.log(`✅ Convertidos ${convertedCount} espectadores a jugadores reales`);
      io.to(roomCodeUpper).emit('players-updated', {
        players: room.players,
        roomCode: roomCodeUpper,
        gameStarted: room.gameStarted,
        conversionCompleted: true
      });
      io.to(roomCodeUpper).emit('system-message-receive', {
        message: `✅ ${convertedCount} espectador(es) convertidos a jugadores exitosamente!`,
        type: 'system'
      });
      console.log(`🔄 Enviando players-updated a ${roomCodeUpper}. Total jugadores: ${room.players.length}`);
      setTimeout(() => {
        finishRoundForHost(room, roomCodeUpper, hostSocketId);
      }, 1000);
    } catch (error) {
      console.error('❌ Error en convertSpectatorsToPlayers:', error);
    }
  }

  /**
   * Función principal interna: finishRoundForHost. Reacciona y ejecuta la lógica estandarizada.
   */
  function finishRoundForHost(room, roomCodeUpper, hostSocketId) {
    try {
      room.gameStarted = false;
      room.currentPlayerTurn = -1;
      room.currentBet = 0;
      room.potTotal = 0;
      console.log(`🏁 Ronda finalizada completamente. Jugadores totales: ${room.players.length}`);
      io.to(hostSocketId).emit('show-winner-selection', {
        roomCode: roomCodeUpper,
        potTotal: room.potTotal,
        players: room.players
      });
      console.log(`🏆 Enviando selección de ganador al host: ${hostSocketId}`);
    } catch (error) {
      console.error('❌ Error en finishRoundForHost:', error);
    }
  }
  socket.on('winner-selected', data => {
    try {
      const {
        roomCode,
        winnerId,
        winnerIds,
        potAmount
      } = data;
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('error', 'Sala no encontrada');
        return;
      }
      if (socket.id !== room.host) {
        socket.emit('error', 'Solo el anfitrión puede seleccionar ganador');
        return;
      }
      const currentPlayer = room.players.find(p => p.socketId === socket.id);
      console.log(`🔍 Verificación de host en winner-selected:`, {
        socketId: socket.id,
        roomHost: room.host,
        currentPlayer: currentPlayer ? currentPlayer.name : 'no encontrado',
        currentPlayerIsHost: currentPlayer ? currentPlayer.isHost : false,
        players: room.players.map(p => ({
          name: p.name,
          socketId: p.socketId,
          isHost: p.isHost
        }))
      });
      const isSocketHost = socket.id === room.host;
      const isPlayerHost = currentPlayer && currentPlayer.isHost;
      if (!isSocketHost || !isPlayerHost || !currentPlayer) {
        console.log(`❌ Acción de host rechazada:`, {
          isSocketHost,
          isPlayerHost,
          currentPlayerExists: !!currentPlayer,
          socketId: socket.id,
          roomHost: room.host
        });
        socket.emit('error', 'Solo el anfitrión puede seleccionar ganador');
        return;
      }
      console.log(`✅ Verificación de host pasada para: ${currentPlayer.name}`);
      let winners = [];
      if (winnerIds && Array.isArray(winnerIds) && winnerIds.length > 0) {
        winners = room.players.filter(p => p && p.id && winnerIds.includes(p.id) && !p.isSpectator && !p.bankrupt && !p.folded);
        if (winners.length !== winnerIds.length) {
          const invalidIds = winnerIds.filter(id => !room.players.some(p => p && p.id === id && !p.isSpectator && !p.bankrupt && !p.folded));
          if (invalidIds.length > 0) {
            const invalidNames = invalidIds.map(id => {
              const player = room.players.find(p => p && p.id === id);
              return player ? player.name : 'Desconocido';
            }).join(', ');
            console.log(`⚠️ Algunos ganadores seleccionados eran inválidos: ${invalidNames}`);
            socket.emit('error', `Algunos jugadores seleccionados no pueden ganar: ${invalidNames}`);
            return;
          }
        }
        if (winners.length === 0) {
          socket.emit('error', 'No se encontraron ganadores válidos');
          return;
        }
      } else if (winnerId) {
        const winner = room.players.find(p => p && p.id === winnerId && !p.isSpectator && !p.bankrupt && !p.folded);
        if (!winner) {
          socket.emit('error', 'Ganador no encontrado o no es válido');
          return;
        }
        winners = [winner];
      } else {
        socket.emit('error', 'No se proporcionaron ganadores válidos');
        return;
      }
      console.log(`🏆 ${winners.length} ganador(es) válido(s) seleccionado(s) en ${roomCodeUpper}`);
      console.log('💰 Estado de fichas antes de distribución:');
      room.players.forEach(player => {
        if (player) {
          console.log(`   ${player.name}: $${player.chips} (apuesta: $${player.bet})`);
        }
      });
      const sidePots = table.calculateSidePots(room) || [];
      console.log('🎯 Side pots calculados:', sidePots);
      table.distributeSidePots(room, winners, sidePots);
      console.log('💰 Estado después de distribución:');
      room.players.forEach(player => {
        if (player) {
          console.log(`   ${player.name}: $${player.chips} fichas`);
          if (!player.bankrupt) {
            player.folded = false;
          }
        }
      });
      room.potTotal = 0;
      room.currentBet = 0;
      room.players.forEach(player => {
        if (player) {
          player.bet = 0;
          if (!player.bankrupt) {
            player.folded = false;
          }
        }
      });
      io.to(roomCodeUpper).emit('players-updated', {
        players: room.players,
        roomCode: roomCodeUpper
      });
      if (sidePots.length > 1) {
        const sidePotMessages = sidePots.map((pot, index) => {
          const potWinners = Array.isArray(pot.winners) ? pot.winners : [];
          return `Bote ${index + 1}: $${pot.amount} para ${potWinners.map(w => w?.name || 'Unknown').join(', ')}`;
        }).join(' | ');
        io.to(roomCodeUpper).emit('system-message-receive', {
          message: `🎯 Side pots distribuidos: ${sidePotMessages}`,
          type: 'system'
        });
      }
      if (winners.length > 1) {
        const winnersData = winners.map(w => ({
          name: w.name,
          id: w.id,
          amount: w.chips - table.getInitialChips(w, room)
        }));
        io.to(roomCodeUpper).emit('winner-announced', {
          winners: winnersData,
          potAmount: room.potTotal,
          players: room.players,
          sidePots: sidePots
        });
        const winnerNames = winners.map(w => w.name).join(', ');
        io.to(roomCodeUpper).emit('system-message-receive', {
          message: `🏆 Bote dividido entre: ${winnerNames}`,
          type: 'win'
        });
      } else {
        io.to(roomCodeUpper).emit('winner-announced', {
          winnerName: winners[0].name,
          winnerId: winners[0].id,
          potAmount: room.potTotal,
          players: room.players,
          sidePots: sidePots
        });
      }
      const activePlayers = room.players.filter(p => p && !p.bankrupt && p.chips > 0 && !p.isSpectator);
      if (activePlayers.length >= 2) {
        console.log('🔄 Iniciando nueva mano después de ganador...');
        table.startNewRound(room, roomCodeUpper);
      } else {
        console.log('❌ No hay suficientes jugadores activos para nueva mano');
        room.gameStarted = false;
        if (activePlayers.length === 1) {
          io.to(roomCodeUpper).emit('game-finished', {
            winner: activePlayers[0]
          });
        }
      }
    } catch (error) {
      console.error('❌ Error en winner-selected:', error);
      socket.emit('error', 'Error al procesar ganador: ' + error.message);
    }
  });
  socket.on('player-action', data => {
    try {
      console.log(`🎯 player-action: ${data.action} por ${data.playerId}, room: ${data.roomCode}`);
      const {
        roomCode,
        action,
        amount,
        playerId
      } = data;
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('error', 'Sala no encontrada');
        return;
      }
      if (!room.currentRound) {
        console.log('⚠️  room.currentRound era undefined, estableciendo a preflop');
        room.currentRound = 'preflop';
      }
      console.log(`   Turno actual: ${room.currentPlayerTurn}`);
      if (!room.players || !Array.isArray(room.players)) {
        console.error('❌ room.players no es un array válido');
        socket.emit('error', 'Error interno del servidor');
        return;
      }
      if (room.currentPlayerTurn === -1) {
        console.log(`❌ No hay turno actual - acción rechazada para ${playerId}`);
        socket.emit('error', 'La ronda ha terminado, no se pueden realizar más acciones');
        return;
      }
      const playerIndex = room.players.findIndex(p => p.socketId === playerId);
      if (playerIndex === -1) {
        console.log(`❌ Jugador no encontrado para socket: ${playerId}`);
        socket.emit('error', 'Jugador no encontrado en la sala');
        return;
      }
      const player = room.players[playerIndex];
      if (room.currentPlayerTurn !== playerIndex) {
        const currentPlayerName = room.players[room.currentPlayerTurn]?.name || 'Desconocido';
        console.log(`❌ NO ES EL TURNO: ${player.name} intentó actuar, pero es turno de ${currentPlayerName}`);
        socket.emit('error', `No es tu turno. Es el turno de ${currentPlayerName}`);
        return;
      }
      if (action === 'fold') {
        if (player.bankrupt) {
          socket.emit('error', 'No puedes actuar porque estás en bancarrota');
          return;
        }
      } else {
        if (player.folded || player.bankrupt) {
          socket.emit('error', 'No puedes actuar porque estás retirado o en bancarrota');
          return;
        }
      }
      let actionProcessed = true;
      player.hasActed = true;
      switch (action) {
        case 'fold':
          if (room.currentRound === 'preflop' && playerIndex === room.bigBlindIndex) {
            room.bbHasActed = true;
            console.log(`   🎯 BB ha actuado (fold), estableciendo bbHasActed a true`);
          }
          console.log(`   🃏 ${player.name} se retira`);
          player.folded = true;
          if (table.checkAndHandleLastActivePlayer(room, roomCodeUpper)) {
            return;
          }
          break;
        case 'check':
          if (room.currentBet > player.bet) {
            socket.emit('error', 'No puedes pasar cuando hay una apuesta pendiente');
            return;
          }
          if (room.currentRound === 'preflop' && playerIndex === room.bigBlindIndex) {
            room.bbHasActed = true;
            console.log(`   🎯 BB ha actuado (check), estableciendo bbHasActed a true`);
          }
          if (playerIndex === room.lastBettor) {
            room.lastBettor = null;
          }
          console.log(`   ✅ ${player.name} pasa`);
          break;
        case 'call':
          const callAmount = room.currentBet - player.bet;
          console.log(`   📞 ${player.name} intenta igualar: $${callAmount}`);
          if (callAmount === 0) {
            console.log(`   🔄 ${player.name} no necesita igualar, haciendo check`);
            break;
          }
          if (room.currentRound === 'preflop' && playerIndex === room.bigBlindIndex) {
            room.bbHasActed = true;
            console.log(`   🎯 BB ha actuado (call), estableciendo bbHasActed a true`);
          }
          if (callAmount > player.chips) {
            const allInAmount = player.chips;
            player.chips = 0;
            player.bet += allInAmount;
            room.potTotal += allInAmount;
            console.log(`   🎯 ${player.name} ALL IN: $${allInAmount}`);
          } else {
            player.chips -= callAmount;
            player.bet += callAmount;
            room.potTotal += callAmount;
            console.log(`   ✅ ${player.name} iguala: $${callAmount}`);
          }
          break;
        case 'bet':
          if (amount > player.chips) {
            socket.emit('error', 'No tienes suficientes fichas para esa apuesta');
            return;
          }
          if (room.currentRound === 'preflop' && playerIndex === room.bigBlindIndex) {
            room.bbHasActed = true;
            console.log(`   🎯 BB ha actuado (bet), estableciendo bbHasActed a true`);
          }
          const totalBetAfter = player.bet + amount;
          if (totalBetAfter < room.currentBet) {
            socket.emit('error', 'No puedes apostar menos de la apuesta a igualar');
            return;
          }
          table.resetHasActedForActivePlayers(room);
          player.hasActed = true;
          player.chips -= amount;
          player.bet += amount;
          room.potTotal += amount;
          if (player.bet > room.currentBet) {
            room.currentBet = player.bet;
            room.lastBettor = playerIndex;
            console.log(`   💰 Nueva apuesta máxima: $${room.currentBet} por ${player.name}`);
          }
          console.log(`   💵 ${player.name} apuesta: $${amount} (total bet: $${player.bet})`);
          break;
        case 'all-in':
          const allInAmount = player.chips;
          player.chips = 0;
          player.bet += allInAmount;
          room.potTotal += allInAmount;
          if (room.currentRound === 'preflop' && playerIndex === room.bigBlindIndex) {
            room.bbHasActed = true;
            console.log(`   🎯 BB ha actuado (all-in), estableciendo bbHasActed a true`);
          }
          if (player.bet > room.currentBet) {
            room.currentBet = player.bet;
            room.lastBettor = playerIndex;
          }
          table.resetHasActedForActivePlayers(room);
          player.hasActed = true;
          table.notifyAllInCondition(room, roomCodeUpper);
          const activePlayersAfterAllIn = room.players.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
          const playersWithChipsAfter = activePlayersAfterAllIn.filter(p => p.chips > 0);
          const allInPlayersAfter = activePlayersAfterAllIn.filter(p => p.chips === 0);
          console.log(`🔍 Después de ALL-IN - Con fichas: ${playersWithChipsAfter.length}, ALL-IN: ${allInPlayersAfter.length}`);
          if (playersWithChipsAfter.length === 1 && allInPlayersAfter.length >= 1) {
            const lastPlayer = playersWithChipsAfter[0];
            const maxBet = Math.max(...room.players.map(p => p.bet));
            if (lastPlayer.bet === maxBet) {
              console.log(`🎯 Condición ALL-IN detectada después de acción - terminando ronda`);
              room.currentPlayerTurn = -1;
              io.to(roomCodeUpper).emit('game-state-sync', {
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
                table.advanceToNextRound(room, roomCodeUpper);
              }, 1000);
              return;
            }
          }
          console.log(`   🎯 ${player.name} ALL IN: $${allInAmount}`);
          break;
        default:
          actionProcessed = false;
          break;
      }
      if (!actionProcessed) {
        return;
      }
      const roundKey = `${roomCodeUpper}-${room.currentRound}`;
      let roundActions = roundPlayerActions.get(roundKey);
      if (!roundActions) {
        roundActions = new Set();
        roundPlayerActions.set(roundKey, roundActions);
      }
      roundActions.add(playerIndex);
      console.log(`   🔄 Calculando siguiente turno desde índice ${room.currentPlayerTurn}...`);
      table.notifyAllInCondition(room, roomCodeUpper);
      const validPlayers = room.players.filter(p => p && typeof p === 'object');
      const activePlayers = validPlayers.filter(p => !p.folded && !p.bankrupt && !p.isSpectator);
      const allPlayersAllIn = activePlayers.length > 0 && activePlayers.every(p => p.chips === 0);
      if (allPlayersAllIn) {
        console.log('🎯 TODOS ALL-IN detectado después de acción - terminando ronda');
        room.currentPlayerTurn = -1;
        io.to(roomCodeUpper).emit('game-state-sync', {
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
          table.finishHand(room, roomCodeUpper);
        }, 1000);
        return;
      }
      if (activePlayers.length <= 1) {
        room.currentPlayerTurn = -1;
        console.log(`   🏁 Solo queda 1 jugador activo`);
      } else {
        let nextPlayerIndex = (room.currentPlayerTurn + 1) % room.players.length;
        let attempts = 0;
        while (attempts < room.players.length) {
          const nextPlayer = room.players[nextPlayerIndex];
          if (!nextPlayer.folded && !nextPlayer.bankrupt && !nextPlayer.isSpectator) {
            break;
          }
          nextPlayerIndex = (nextPlayerIndex + 1) % room.players.length;
          attempts++;
        }
        room.currentPlayerTurn = nextPlayerIndex;
        console.log(`   ➡️ Nuevo turno: ${room.players[nextPlayerIndex].name} (índice: ${nextPlayerIndex})`);
      }
      const updateData = {
        action: action,
        amount: amount,
        playerId: player.socketId,
        playerName: player.name,
        players: JSON.parse(JSON.stringify(room.players)),
        potTotal: room.potTotal,
        currentBet: room.currentBet,
        currentPlayerTurn: room.currentPlayerTurn,
        currentRound: room.currentRound
      };
      io.to(roomCodeUpper).emit('player-action-update', updateData);
      io.to(roomCodeUpper).emit('game-state-sync', {
        players: room.players,
        potTotal: room.potTotal,
        currentBet: room.currentBet,
        currentPlayerTurn: room.currentPlayerTurn,
        currentRound: room.currentRound,
        dealerPosition: room.dealerPosition,
        smallBlindIndex: room.smallBlindIndex,
        bigBlindIndex: room.bigBlindIndex
      });
      console.log(`   📊 Estado actualizado - Ronda: ${room.currentRound}, Bote: $${room.potTotal}, Turno: ${room.currentPlayerTurn}`);
      console.log(`🔍 Verificando si la ronda ${room.currentRound} debe terminar...`);
      if (table.shouldRoundEnd(room, roomCodeUpper)) {
        if (activePlayers.length === 1 || activePlayers.every(p => p.chips === 0)) {
          return;
        }
        console.log(`\n🎯 RONDA ${room.currentRound.toUpperCase()} COMPLETADA - AVANZANDO A SIGUIENTE RONDA`);
        room.currentPlayerTurn = -1;
        io.to(roomCodeUpper).emit('game-state-sync', {
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
          table.advanceToNextRound(room, roomCodeUpper);
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error crítico en player-action:', error);
      socket.emit('error', 'Error interno del servidor al procesar acción');
    }
  });
  socket.on('convert-to-player', data => {
    try {
      const {
        roomCode,
        playerName
      } = data;
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('error', 'Sala no encontrada');
        return;
      }
      if (!playerName || typeof playerName !== 'string') {
        socket.emit('error', 'Por favor ingresa un nombre válido');
        return;
      }
      const trimmedName = playerName.trim();
      if (trimmedName.length === 0) {
        socket.emit('error', 'El nombre no puede estar vacío');
        return;
      }
      if (trimmedName.replace(/\s/g, '').length === 0) {
        socket.emit('error', 'El nombre no puede contener solo espacios');
        return;
      }
      if (trimmedName.length < 1 || trimmedName.length > 15) {
        socket.emit('error', 'El nombre debe tener entre 1 y 15 caracteres');
        return;
      }
      const nameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/;
      if (!nameRegex.test(trimmedName)) {
        socket.emit('error', 'El nombre solo puede contener letras, números y espacios');
        return;
      }
      const isRoundActive = room.gameStarted && room.currentPlayerTurn !== -1 && room.potTotal > 0;
      if (isRoundActive) {
        socket.emit('error', 'No puedes unirte durante una ronda activa. Espera a que termine.');
        return;
      }
      if (room.players.length >= 6) {
        socket.emit('error', 'La sala está llena (máximo 6 jugadores)');
        return;
      }
      const existingPlayerIndex = room.players.findIndex(p => p.name === trimmedName);
      if (existingPlayerIndex !== -1) {
        room.players[existingPlayerIndex].socketId = socket.id;
        room.players[existingPlayerIndex].disconnected = false;
        room.players[existingPlayerIndex].isSpectator = false;
        room.players[existingPlayerIndex].chips = room.initialMoney || 300;
        room.players[existingPlayerIndex].bet = 0;
        room.players[existingPlayerIndex].folded = false;
        room.players[existingPlayerIndex].bankrupt = false;
        delete room.players[existingPlayerIndex].disconnectedAt;
        console.log(`🔄 ${trimmedName} reconectado como jugador`);
      } else {
        const initialChips = room.initialMoney || 300;
        const newPlayer = {
          id: socket.id,
          name: trimmedName,
          chips: initialChips,
          bet: 0,
          folded: false,
          isPlayer: true,
          isHost: false,
          bankrupt: false,
          socketId: socket.id,
          isSpectator: false,
          disconnected: false
        };
        room.players.push(newPlayer);
        console.log(`🎮 ${trimmedName} convertido de espectador a jugador`);
      }
      rooms.set(roomCodeUpper, room);
      socket.emit('converted-to-player', {
        roomCode: roomCodeUpper,
        players: room.players,
        isHost: false,
        gameStarted: room.gameStarted
      });
      io.to(roomCodeUpper).emit('player-joined', {
        player: room.players.find(p => p.socketId === socket.id),
        players: room.players,
        roomCode: roomCodeUpper
      });
      console.log(`✅ ${trimmedName} ahora es jugador. Total jugadores: ${room.players.length}`);
    } catch (error) {
      console.error('❌ Error en convert-to-player:', error);
      socket.emit('error', 'Error al convertir a jugador');
    }
  });
  socket.on('disconnect', reason => {
    console.log(`🔌 Usuario desconectado: ${socket.id} - Razón: ${reason}`);
    for (let [roomCode, room] of rooms) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        console.log(`📱 ${player.name} desconectado de ${roomCode}`);
        if (room.gameStarted && !room.gameFinished) {
          player.disconnected = true;
          player.disconnectedAt = new Date();
          io.to(roomCode).emit('player-disconnected', {
            playerName: player.name,
            players: room.players,
            timeout: 0
          });
        }
        break;
      }
    }
  });
  socket.on('reconnect-player', data => {
    try {
      const {
        roomCode,
        playerId,
        playerName
      } = data;
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('reconnect-failed', 'Sala no encontrada o ha expirado');
        return;
      }
      console.log(`🔄 Intentando reconexión para: ${playerName || playerId} en sala: ${roomCodeUpper}`);
      let player = null;
      let playerIndex = -1;
      if (playerId) {
        playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
          player = room.players[playerIndex];
          console.log(`🔍 Jugador encontrado por ID: ${player.name}`);
        }
      }
      if (!player && playerName) {
        playerIndex = room.players.findIndex(p => p.name === playerName);
        if (playerIndex !== -1) {
          player = room.players[playerIndex];
          console.log(`🔍 Jugador encontrado por nombre: ${player.name}`);
        }
      }
      if (!player) {
        playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
          player = room.players[playerIndex];
          console.log(`🔍 Jugador encontrado por socket antiguo: ${player.name}`);
        }
      }
      if (!player) {
        console.log(`❌ Jugador no encontrado. Búsqueda con:`, {
          playerId,
          playerName,
          socketId: socket.id
        });
        console.log(`🔍 Jugadores en sala:`, room.players.map(p => ({
          name: p.name,
          id: p.id,
          socketId: p.socketId,
          isHost: p.isHost
        })));
        socket.emit('reconnect-failed', 'Jugador no encontrado en la sala');
        return;
      }
      const wasHost = player.isHost;
      const oldSocketId = player.socketId;
      console.log(`🔍 Estado antes de reconexión:`, {
        name: player.name,
        wasHost: wasHost,
        oldSocketId: oldSocketId,
        roomHost: room.host,
        playerIsHost: player.isHost
      });
      player.socketId = socket.id;
      player.disconnected = false;
      delete player.disconnectedAt;
      if (wasHost) {
        room.host = socket.id;
        console.log(`👑 Host actualizado: ${oldSocketId} -> ${socket.id} (${player.name})`);
        if (room.host !== socket.id) {
          console.error(`❌ ERROR: room.host no se actualizó correctamente`);
          room.host = socket.id;
        }
      }
      console.log(`✅ ${player.name} reconectado.`, {
        nuevoSocketId: socket.id,
        esHost: player.isHost,
        roomHost: room.host
      });
      socket.join(roomCodeUpper);
      socket.emit('reconnect-success', {
        players: room.players,
        roomCode: roomCodeUpper,
        gameStarted: room.gameStarted,
        currentPlayerTurn: room.currentPlayerTurn,
        potTotal: room.potTotal,
        currentBet: room.currentBet,
        isHost: player.isHost,
        currentRound: room.currentRound,
        dealerPosition: room.dealerPosition,
        smallBlindIndex: room.smallBlindIndex,
        bigBlindIndex: room.bigBlindIndex,
        playerId: player.id,
        hostVerified: true
      });
      socket.to(roomCodeUpper).emit('system-message-receive', {
        message: `✅ ${player.name} se ha reconectado`,
        type: 'system'
      });
      io.to(roomCodeUpper).emit('game-state-sync', {
        players: room.players,
        potTotal: room.potTotal,
        currentBet: room.currentBet,
        currentPlayerTurn: room.currentPlayerTurn,
        currentRound: room.currentRound,
        dealerPosition: room.dealerPosition,
        smallBlindIndex: room.smallBlindIndex,
        bigBlindIndex: room.bigBlindIndex
      });
      console.log(`🔍 Estado después de reconexión:`, {
        roomHost: room.host,
        playerIsHost: player.isHost,
        playerSocketId: player.socketId
      });
    } catch (error) {
      console.error('❌ Error crítico en reconnect-player:', error);
      socket.emit('reconnect-failed', `Error interno del servidor: ${error.message}`);
    }
  });
  socket.on('reconnect-failed', message => {
    console.error('❌ Reconexión fallida:', message);
    socket.emit('clear-game-state');
    socket.emit('system-message-receive', {
      message: `❌ Reconexión fallida: ${message}. Serás redirigido a la pantalla inicial.`,
      type: 'warning'
    });
    setTimeout(() => {
      socket.emit('redirect-to-lobby');
    }, 3000);
  });
  socket.on('kick-player', data => {
    try {
      const {
        roomCode,
        playerId
      } = data;
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (!room) {
        socket.emit('error', 'Sala no encontrada');
        return;
      }
      if (socket.id !== room.host) {
        socket.emit('error', 'Solo el anfitrión puede expulsar jugadores');
        return;
      }
      if (playerId === socket.id) {
        socket.emit('error', 'No puedes expulsarte a ti mismo');
        return;
      }
      const playerIndex = room.players.findIndex(p => p.socketId === playerId);
      if (playerIndex === -1) {
        socket.emit('error', 'Jugador no encontrado');
        return;
      }
      const kickedPlayer = room.players[playerIndex];
      const wasCurrentTurn = room.currentPlayerTurn === playerIndex;
      console.log(`🚪 Expulsando a ${kickedPlayer.name} (índice: ${playerIndex}), era el turno actual: ${wasCurrentTurn}`);
      room.players.splice(playerIndex, 1);
      const activePlayers = room.players.filter(p => !p.bankrupt && !p.isSpectator && p.chips > 0 && !p.folded);
      console.log(`ℹ️ Jugadores activos después de expulsión: ${activePlayers.length}`);
      if (room.dealerPosition > playerIndex) {
        room.dealerPosition--;
      }
      if (room.smallBlindIndex > playerIndex) {
        room.smallBlindIndex--;
      }
      if (room.bigBlindIndex > playerIndex) {
        room.bigBlindIndex--;
      }
      if (wasCurrentTurn) {
        let nextPlayerIndex = table.findNextActivePlayerIndex(room, playerIndex);
        if (nextPlayerIndex !== -1) {
          room.currentPlayerTurn = nextPlayerIndex;
          console.log(`➡️ Turno pasado a: ${room.players[nextPlayerIndex].name} (índice: ${nextPlayerIndex})`);
        } else {
          room.currentPlayerTurn = -1;
          console.log('⏹️ No hay jugadores activos, terminando ronda');
        }
      } else if (playerIndex < room.currentPlayerTurn) {
        room.currentPlayerTurn--;
        console.log(`🔁 Ajustando turno actual de ${room.currentPlayerTurn + 1} a ${room.currentPlayerTurn}`);
      }
      if (activePlayers.length < 2) {
        console.log('⚠️ No hay suficientes jugadores activos, terminando ronda');
        room.currentPlayerTurn = -1;
        room.gameStarted = false;
        if (activePlayers.length === 1) {
          const winner = activePlayers[0];
          winner.chips += room.potTotal;
          io.to(roomCodeUpper).emit('winner-announced', {
            winnerName: winner.name,
            winnerId: winner.id,
            potAmount: room.potTotal,
            players: room.players
          });
          room.potTotal = 0;
          room.currentBet = 0;
        }
      }
      io.to(roomCodeUpper).emit('player-kicked', {
        playerName: kickedPlayer.name,
        players: room.players,
        currentPlayerTurn: room.currentPlayerTurn,
        gameStarted: room.gameStarted,
        activePlayers: activePlayers.length
      });
      io.to(playerId).emit('you-were-kicked', {
        reason: 'Expulsado por el anfitrión'
      });
      console.log(`🚪 Jugador ${kickedPlayer.name} expulsado. Jugadores activos: ${activePlayers.length}, Turno actual: ${room.currentPlayerTurn}`);
    } catch (error) {
      console.error('❌ Error en kick-player:', error);
      socket.emit('error', 'Error al expulsar jugador');
    }
  });
  socket.on('game-state-update', data => {
    try {
      const {
        roomCode,
        players,
        potTotal,
        currentBet,
        currentPlayerTurn,
        roundStarterIndex,
        currentRound,
        currentMaxBet
      } = data;
      const roomCodeUpper = roomCode.toUpperCase();
      const room = rooms.get(roomCodeUpper);
      if (room) {
        if (socket.id === room.host) {
          room.players = players;
          room.potTotal = potTotal;
          room.currentBet = currentBet;
          room.currentPlayerTurn = currentPlayerTurn;
          room.roundStarterIndex = roundStarterIndex;
          room.currentRound = currentRound || 'preflop';
          room.currentMaxBet = currentMaxBet;
          console.log(`🔄 Estado sincronizado por host - Ronda: ${room.currentRound}, Turno: ${currentPlayerTurn}, RoundStarter: ${roundStarterIndex}`);
          io.to(roomCodeUpper).emit('game-state-sync', {
            players: players,
            potTotal: potTotal,
            currentBet: currentBet,
            currentPlayerTurn: currentPlayerTurn,
            roundStarterIndex: roundStarterIndex,
            currentRound: room.currentRound,
            currentMaxBet: currentMaxBet
          });
        }
      }
    } catch (error) {
      console.error('❌ Error en game-state-update:', error);
    }
  });
  socket.on('send-message', (data) => {
    const { roomCode, message, playerName, isSpectator } = data;
    const roomCodeUpper = roomCode.toUpperCase();

    const finalName = isSpectator ? `${playerName} (Espectador)` : playerName;

    console.log(`💬 [${roomCodeUpper}] ${finalName}: ${message}`);

    io.to(roomCodeUpper).emit('new-message', {
      playerName: finalName,
      message: message
    });
  });
  socket.on('shuffle-players', (data) => {
    console.log("🎲 Recibida petición de mezcla para sala:", data.roomCode);

    if (!data || !data.roomCode) return;

    const roomCode = data.roomCode.toUpperCase();
    const room = rooms.get(roomCode);

    if (room && socket.id === room.host && !room.gameStarted) {

      let playersArray = room.players;
      for (let i = playersArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playersArray[i], playersArray[j]] = [playersArray[j], playersArray[i]];
      }

      console.log(`✅ Sala ${roomCode}: Asientos mezclados con éxito.`);

      io.to(roomCode).emit('players-shuffled', {
        newOrder: playersArray
      });

    } else {
      console.log("⚠️ Mezcla rechazada: No eres el host o la partida ya empezó.");
    }
  });
  socket.on('new-hand-started', data => {
    console.log('🔄 Nueva mano iniciada en el servidor');
  });
  socket.on('round-advanced', data => {
    console.log('🔄 Ronda avanzada en el servidor');
  });
  socket.on('hand-finished', data => {
    console.log('🏁 Mano terminada en el servidor');
  });
};
module.exports = {
  registerActions
};