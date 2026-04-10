socket.on('connect', () => {
  console.log('✅ Conectado al servidor');
  connectionStatus.textContent = 'Conectado';
  connectionStatus.className = 'connection-status connected';
  if (isMobileDevice && !isPageReloaded && shouldAttemptAutoReconnect()) {
    if (mainGame && mainGame.style.display === 'flex' && initialModal.style.display !== 'flex') {
      console.log('📱 Reconexión automática (dispositivo móvil/tablet en pantalla de juego)...');
      attemptAutoReconnect();
    } else {
      console.log('🔒 No reconectar automáticamente: Estamos en pantalla inicial');
    }
  }
  if (isPageReloaded && !currentRoomCode && !reconnectOptionShown) {
    if (initializeGameState()) {
      console.log('🔄 Mostrando opción de reconexión manual...');
      showReconnectOption();
    } else {
      console.log('💾 No hay estado guardado para reconectar');
    }
  }
  isPageReloaded = false;
});
socket.on('reconnect-success', data => {
  console.log('✅ Reconexión exitosa - Datos completos:', data);
  addMessage('Sistema', '✅ Reconexión exitosa - Sincronizando estado actual...', 'system');
  clearReconnectSafetyTimeout();
  players = data.players;
  gameStarted = data.gameStarted;
  currentPlayerTurn = data.currentPlayerTurn;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  isHost = data.isHost;
  currentRound = data.currentRound || 'preflop';
  isHost = data.isHost;
  console.log(`👑 Estado de host después de reconexión: ${isHost}`);
  const myPlayer = players.find(p => p.socketId === socket.id);
  if (myPlayer) {
    isHost = myPlayer.isHost;
    console.log(`👑 Host sincronizado con jugador: ${isHost}`);
  }
  console.log(`👑 Estado de host después de reconexión: ${isHost} (verificado: ${data.hostVerified || false})`);
  currentDealerIndex = data.dealerPosition;
  currentSmallBlindIndex = data.smallBlindIndex;
  currentBigBlindIndex = data.bigBlindIndex;
  console.log('🎯 Índices actualizados en reconexión:', {
    dealer: currentDealerIndex,
    smallBlind: currentSmallBlindIndex,
    bigBlind: currentBigBlindIndex
  });
  if (waitingScreen) {
    waitingScreen.style.display = 'none';
    console.log('🔒 Pantalla de reconexión ocultada');
  }
  updatePlayerInfo();
  updatePlayerList();
  updateBettingControls();
  updateHostControls();
  updateRoundDisplay();
  setTimeout(() => {
    updateHostControls();
  }, 100);
  debugHostState();
  if (isMobileDevice) {
    addMessage('Sistema', '✅ Reconexión exitosa - Estado sincronizado', 'system');
  } else {
    console.log('💻 Reconexión exitosa en PC (sin mensaje)');
  }
  console.log('🎮 Interfaz normal restaurada después de reconexión');
});
socket.on('disconnect', reason => {
  console.log('🔌 Desconectado:', reason);
  connectionStatus.textContent = 'Desconectado';
  connectionStatus.className = 'connection-status disconnected';
  saveGameState();
  if (isMobileDevice) {
    addMessage('Sistema', `🔌 Desconectado: ${reason}. Reconectando automáticamente...`, 'warning');
  } else {
    if (reason === 'transport close' || reason === 'ping timeout') {
      addMessage('Sistema', `🔌 Conexión perdida. Reconectando...`, 'warning');
    }
  }
  startPersistentReconnect();
});
socket.on('force-disconnect', data => {
  console.log('🔌 Desconexión forzada:', data.reason);
  addMessage('Sistema', `Sesión duplicada detectada: ${data.reason}`, 'warning');
  localStorage.removeItem('pokerRoomCode');
  localStorage.removeItem('pokerPlayerId');
  localStorage.removeItem('pokerPlayerName');
  setTimeout(() => {
    initialModal.style.display = 'flex';
    mainGame.style.display = 'none';
  }, 2000);
});
socket.on('clear-game-state', () => {
  console.log('🧹 Limpiando estado del juego por indicación del servidor');
  localStorage.removeItem('pokerGameState');
  localStorage.removeItem('pokerRoomCode');
  localStorage.removeItem('pokerPlayerId');
  localStorage.removeItem('pokerPlayerName');
});
socket.on('redirect-to-lobby', () => {
  console.log('🚀 Redirigiendo al lobby por indicación del servidor');
  initialModal.style.display = 'flex';
  mainGame.style.display = 'none';
  currentRoomCode = '';
  myPlayerId = '';
  players = [];
  gameStarted = false;
});
socket.on('connect_error', error => {
  console.error('❌ Error de conexión:', error);
  connectionStatus.textContent = 'Error de conexión';
  connectionStatus.className = 'connection-status error';
  addMessage('Sistema', 'Error de conexión. Intentando reconectar...', 'warning');
});
socket.on('error', message => {
  console.error('❌ Error del servidor:', message);
  if (message.includes('nombre válido')) {
    console.error('🔍 DEBUG - Problema de validación de nombre:');
    console.error('   - playerName:', playerName);
    console.error('   - Tipo:', typeof playerName);
    console.error('   - Trimmed length:', playerName ? playerName.trim().length : 'null');
  }
  alert('Error: ' + message);
});
socket.on('game-started', data => {
  console.log('🎮 Juego iniciado/REINICIADO recibido del servidor');
  players = data.players;
  gameStarted = true;
  waitingScreen.style.display = 'none';
  currentRound = data.currentRound || 'preflop';
  console.log(`🎯 Ronda inicial: ${currentRound}`);
  if (isHost) {
    if (startGameBtn) startGameBtn.style.display = 'none';
    if (roundEndBtn) roundEndBtn.style.display = 'block';
  } else {
    if (startGameBtn) startGameBtn.style.display = 'none';
    if (roundEndBtn) roundEndBtn.style.display = 'none';
  }
  roomCodeDisplay.style.display = 'none';
  updateHostControls();
  playerMessageCount = 0;
  tempBet = 0;
  blindsPosted = false;
  allInBtn.style.display = 'flex';
  currentDealerIndex = data.dealerPosition;
  currentSmallBlindIndex = data.smallBlindIndex;
  currentBigBlindIndex = data.bigBlindIndex;
  currentPlayerTurn = data.currentPlayerTurn;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  console.log(`🎯 Roles asignados - Dealer: ${players[currentDealerIndex]?.name}, SB: ${players[currentSmallBlindIndex]?.name}, BB: ${players[currentBigBlindIndex]?.name}`);
  console.log(`💰 Estado inicial - Pot: $${potTotal}, CurrentBet: $${currentBet}, Ronda: ${currentRound}`);
  updatePlayerInfo();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updatePlayerList();
  updateBettingControls();
  updateHostControls();
  updateRoundDisplay();
  addMessage('Sistema', '¡Nueva partida iniciada! Todos los jugadores han sido reiniciados.', 'system');
  setTimeout(() => {
    updateBettingControls();
    setPlayerTurn(currentPlayerTurn);
  }, 1000);
});
socket.on('game-state-sync', data => {
  players = data.players;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  currentPlayerTurn = data.currentPlayerTurn;
  roundStarterIndex = data.roundStarterIndex || roundStarterIndex;
  currentRound = data.currentRound || currentRound;
  currentMaxBet = data.currentMaxBet || currentMaxBet;
  currentDealerIndex = data.dealerPosition;
  currentSmallBlindIndex = data.smallBlindIndex;
  currentBigBlindIndex = data.bigBlindIndex;
  console.log('🎯 Índices sincronizados:', {
    dealer: currentDealerIndex,
    sb: currentSmallBlindIndex,
    bb: currentBigBlindIndex
  });
  updatePlayerInfo();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updatePlayerList();
  updateBettingControls();
  updateRoundDisplay();
  setPlayerTurn(currentPlayerTurn);
  saveGameState();
});
socket.on('conversion-starting', data => {
  console.log(`🔄 Conversión iniciando en ${data.delay}ms`);
  if (isSpectator && waitingScreen) {
    waitingScreen.innerHTML = `
				<h2>🎮 Convirtiendo a jugador...</h2>
				<p>Espera ${data.delay / 1000} segundos</p>
				<div class="players-needed" style="font-size: 2rem; color: #f1c40f;">${data.delay / 1000}</div>
				<p>Recibirás $${getRoomInitialMoney()} fichas iniciales</p>
			`;
  }
});
socket.on('spectators-converted', data => {
  console.log(`�?Espectadores convertidos: ${data.convertedCount}, Total jugadores: ${data.totalPlayers}`);
  addMessage('Sistema', `�?${data.convertedCount} espectador(es) convertidos a jugadores. Total: ${data.totalPlayers} jugadores.`, 'system');
});
socket.on('joined-as-spectator', data => {
  console.log('👀 Unido como espectador - Datos:', data);
  currentRoomCode = data.roomCode;
  players = data.players;
  gameStarted = data.gameStarted;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  currentPlayerTurn = data.currentPlayerTurn;
  isSpectator = true;
  isHost = false;
  initialModal.style.display = 'none';
  mainGame.style.display = 'flex';
  waitingScreen.style.display = 'flex';
  waitingScreen.innerHTML = `
    <h2>👀 Modo Espectador</h2>
    <p>Estás observando la partida en la sala ${currentRoomCode}</p>
    <div class="players-needed">Jugadores: ${players.filter(p => !p.isSpectator).length}/6 + ${players.filter(p => p.isSpectator).length} espectador(es)</div>
    <p>💡 <strong>Serás convertido automáticamente a jugador</strong> cuando el host termine esta ronda.</p>
    <div style="margin-top: 20px; padding: 15px; background: rgba(46, 204, 113, 0.2); border-radius: 8px; border: 2px solid #2ecc71;">
      <p><strong>No necesitas hacer nada</strong></p>
      <p>Cuando el host pulse "Terminar Ronda", te unirás automáticamente con $${data.initialMoney} fichas</p>
    </div>
  `;
  updatePlayerList();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  disableAllControls();
  if (startGameBtn) startGameBtn.style.display = 'none';
  if (roundEndBtn) roundEndBtn.style.display = 'none';
  addMessage('Sistema', 'Te has unido como espectador. Unión automática al terminar la ronda.', 'system');
  saveGameState();
  console.log('🔍 Verificando mi presencia en la lista:');
  const myPlayerInList = players.find(p => p.socketId === socket.id);
  console.log('   - Encontrado en lista:', myPlayerInList);
  console.log('   - Mi socketId:', socket.id);
  reconnectOptionShown = false;
});
socket.on('players-updated', data => {
  console.log('?? Lista de jugadores actualizada');
  players = data.players;
  const myNewPlayer = players.find(p => p.socketId === socket.id);
  if (myNewPlayer) {
    console.log('?? Encontrado en lista:', myNewPlayer.name, '- Espectador:', myNewPlayer.isSpectator);
    const isSelectingWinner = winnerModal && winnerModal.style.display === 'flex';
    const isHandFinished = !gameStarted;
    if (isSpectator && !myNewPlayer.isSpectator) {
      if (isSelectingWinner || isHandFinished) {
        isSpectator = false;
        updatePlayerList();
        updatePlayerInfo();
      } else {
        console.log('🔄 Conversión automática detectada!');
        completePlayerConversion(myNewPlayer);
      }
    }
  } else {
    console.log('? No encontrado en la lista. Mi socketId:', socket.id);
  }
  updatePlayerList();
  updatePlayerInfo();
});
socket.on('round-advanced', data => {
  console.log(`🔄 ROUND-ADVANCED RECIBIDO: ${data.previousRound} �?${data.currentRound}`);
  currentRound = data.currentRound;
  players = data.players;
  currentPlayerTurn = data.currentPlayerTurn;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  updatePlayerList();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updatePlayerInfo();
  updateRoundDisplay();
  showRoundModal(data.currentRound, data.currentPlayerTurn);
  addMessage('Sistema', `🔄 NUEVA RONDA: ${roundNames[data.currentRound]} - Comienza ${players[data.currentPlayerTurn]?.name}`, 'system');
  setTimeout(() => {
    updateBettingControls();
    if (currentPlayerTurn !== -1) {
      setPlayerTurn(currentPlayerTurn);
    }
  }, 100);
});
socket.on('new-hand-started', data => {
  console.log(`🎲 NUEVA MANO INICIADA - Ronda: ${data.currentRound}`);
  currentRound = data.currentRound;
  players = data.players;
  currentPlayerTurn = data.currentPlayerTurn;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  currentDealerIndex = data.dealerPosition;
  currentSmallBlindIndex = data.smallBlindIndex;
  currentBigBlindIndex = data.bigBlindIndex;
  console.log('🎯 Nuevos índices en nueva mano:', {
    dealer: currentDealerIndex,
    sb: currentSmallBlindIndex,
    bb: currentBigBlindIndex
  });
  updatePlayerList();
  updatePlayerInfo();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updateRoundDisplay();
  addMessage('Sistema', `🎲 NUEVA MANO! Ronda: ${roundNames[data.currentRound]}`, 'system');
  setTimeout(() => {
    updateBettingControls();
    if (currentPlayerTurn !== -1) {
      setPlayerTurn(currentPlayerTurn);
    }
  }, 1000);
});
socket.on('hand-finished', data => {
  console.log('🏁 MANO TERMINADA - Todas las rondas completadas');
  players = data.players;
  potTotal = data.potTotal;
  if (data.dealerPosition !== undefined) currentDealerIndex = data.dealerPosition;
  if (data.smallBlindIndex !== undefined) currentSmallBlindIndex = data.smallBlindIndex;
  if (data.bigBlindIndex !== undefined) currentBigBlindIndex = data.bigBlindIndex;
  addMessage('Sistema', '🏁 MANO TERMINADA - Todas las rondas de apuestas completadas', 'system');
  disablePlayerControls();
  console.log('⏳ Esperando selección de ganador - NO convertir espectadores aún');
  if (isHost) {
    addMessage('Sistema', 'Selecciona al ganador del bote', 'system');
  }
});
socket.on('round-finished-new-players-welcome', data => {
  console.log('🔄 Ronda terminada - Nuevos jugadores pueden unirse', data);
  addMessage('Sistema', `🏆 ${data.winner} ganó $${data.potAmount}!`, 'win');
  addMessage('Sistema', '🔄 Ronda terminada. Nueva ronda comenzará pronto...', 'system');
  if (isHost) {
    startGameBtn.style.display = 'block';
    startGameBtn.textContent = 'Iniciar Siguiente Ronda';
    startGameBtn.onclick = function () {
      socket.emit('start-next-round', {
        roomCode: currentRoomCode
      });
    };
    roundEndBtn.style.display = 'none';
    addMessage('Sistema', '�?Como anfitrión, puedes iniciar la siguiente ronda cuando estés listo', 'system');
  }
  if (isSpectator) {
    console.log('🔄 Convirtiendo espectador a jugador automáticamente...');
    socket.emit('convert-to-player', {
      roomCode: currentRoomCode,
      playerName: playerName
    });
    waitingScreen.style.display = 'flex';
    waitingScreen.innerHTML = `
				<h2>Uniéndose a la partida...</h2>
				<p>Estás siendo agregado como jugador para la siguiente ronda</p>
				<div class="players-needed">Por favor espera...</div>
			`;
  }
});
socket.on('round-finished-new-players-welcome', data => {
  console.log('🔄 Ronda terminada - Nuevos jugadores pueden unirse');
  addMessage('Sistema', `🏆 ${data.winner} ganó la ronda! Nuevos jugadores pueden unirse para la siguiente ronda.`, 'win');
  if (isHost) {
    startGameBtn.style.display = 'block';
    startGameBtn.textContent = 'Iniciar Siguiente Ronda';
    startGameBtn.onclick = function () {
      socket.emit('start-next-round', {
        roomCode: currentRoomCode
      });
    };
    roundEndBtn.style.display = 'none';
  }
  if (isSpectator) {
    addMessage('Sistema', '🔄 La ronda terminó. Puedes unirte como jugador para la siguiente ronda.', 'system');
  }
});
socket.on('player-reconnected', data => {
  console.log(`✅ ${data.playerName} se ha reconectado`);
  if (data.players) {
    players = data.players;
    updatePlayerList();
  }
});
socket.on('new-round-started', data => {
  console.log('🎲 Nueva ronda iniciada - Datos:', data);
  players = data.players;
  currentDealerIndex = data.dealerPosition;
  currentSmallBlindIndex = data.smallBlindIndex;
  currentBigBlindIndex = data.bigBlindIndex;
  currentPlayerTurn = data.currentPlayerTurn;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  gameStarted = true;
  if (isSpectator) {
    const myNewPlayer = players.find(p => p.socketId === socket.id && !p.isSpectator);
    if (myNewPlayer) {
      console.log('🔄 Conversión tardía en nueva ronda');
      completePlayerConversion(myNewPlayer);
    }
  }
  updatePlayerList();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updatePlayerInfo();
  updateBettingControls();
  addMessage('Sistema', `🎲 Nueva ronda! Dealer: ${players[currentDealerIndex]?.name}, SB: ${players[currentSmallBlindIndex]?.name}, BB: ${players[currentBigBlindIndex]?.name}`, 'system');
  setTimeout(() => {
    updateBettingControls();
    if (currentPlayerTurn !== -1) {
      setPlayerTurn(currentPlayerTurn);
    }
  }, 1500);
});
socket.on('player-left', data => {
  addMessage('Sistema', `🚪 ${data.playerName} abandonó la partida`, 'system');
  players = data.players;
  updatePlayerList();
});
socket.on('round-ended-by-host', data => {
  console.log('⏹️ Ronda terminada por el host:', data.hostName);
  if (data.players) {
    players = data.players;
    console.log(`🔄 Lista inicial recibida: ${players.length} jugadores`);
    updatePlayerList();
    updatePlayerInfo();
  }
  if (data.convertingSpectators) {
    addMessage('Sistema', `🔄 El host ${data.hostName} ha terminado la ronda. Convirtiendo ${data.spectatorsCount} espectador(es) a jugadores...`, 'system');
    if (isSpectator) {
      showConversionCountdown(data.delay);
    }
  } else {
    addMessage('Sistema', `⏹️ El host ${data.hostName} ha terminado la ronda.`, 'waiting');
  }
  disablePlayerControls();
  if (!isHost && roundEndBtn) {
    roundEndBtn.style.display = 'none';
  }
});
socket.on('player-kicked', data => {
  addMessage('Sistema', `🚪 ${data.playerName} ha sido expulsado de la sala`, 'system');
  players = data.players;
  currentPlayerTurn = data.currentPlayerTurn;
  updatePlayerList();
  updatePlayersNeeded();
  if (data.gameStarted) {
    updateBettingControls();
    if (currentPlayerTurn !== -1) {
      setPlayerTurn(currentPlayerTurn);
    } else {
      disablePlayerControls();
      if (isHost) {
        addMessage('Sistema', 'La ronda ha terminado. Selecciona al ganador.', 'system');
      }
    }
  }
  console.log(`🔄 Jugador expulsado. Nuevo turno: ${currentPlayerTurn}`);
});
socket.on('you-were-kicked', data => {
  alert(`Has sido expulsado de la sala: ${data.reason}`);
  leaveRoom();
});
socket.on('new-host', data => {
  addMessage('Sistema', `👑 ${data.newHost} es ahora el anfitri��n`, 'system');
  if (data.newHost === playerName) {
    isHost = true;
    if (gameStarted) {
      startGameBtn.style.display = 'none';
      roundEndBtn.style.display = 'block';
    } else {
      startGameBtn.style.display = 'block';
      roundEndBtn.style.display = 'none';
    }
  }
});
socket.on('reconnect-failed', data => {
  clearReconnectSafetyTimeout();
  const message = typeof data === 'string' ? data : data.message;
  const allowNewJoin = data.allowNewJoin || false;
  const roomCode = data.roomCode || currentRoomCode;
  console.error('❌ Reconexión fallida:', message);
  if (waitingScreen) {
    waitingScreen.style.display = 'none';
    console.log('🔒 Pantalla de reconexión ocultada por fallo');
  }
  if (waitingScreen) {
    waitingScreen.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <h2 style="color: #e74c3c;">❌ Error de Reconexión</h2>
        <p style="margin: 15px 0; font-size: 1.1em;">${message}</p>
        <div style="margin-top: 30px;">
          ${allowNewJoin ? `
            <button id="join-as-new-btn" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; font-size: 1em;">
              🎮 Unirse como Nuevo Jugador
            </button>
          ` : ''}
          <button id="reload-page-btn" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; font-size: 1em;">
            🔄 Recargar Página
          </button>
          <button id="new-game-btn" style="padding: 12px 24px; background: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; font-size: 1em;">
            🎮 Nueva Partida
          </button>
        </div>
      </div>
    `;
    if (allowNewJoin) {
      document.getElementById('join-as-new-btn').addEventListener('click', function () {
        socket.emit('join-room', {
          roomCode: roomCode,
          playerName: playerName + ' (Nuevo)'
        });
      });
    }
    document.getElementById('reload-page-btn').addEventListener('click', function () {
      location.reload();
    });
    document.getElementById('new-game-btn').addEventListener('click', function () {
      fullReset();
    });
  }
  addMessage('Sistema', `❌ Error de reconexión: ${message}`, 'warning');
});
socket.on('reconnect', attemptNumber => {
  console.log(`🔄 Reconectado después de ${attemptNumber} intentos`);
  connectionStatus.textContent = 'Conectado';
  connectionStatus.className = 'connection-status connected';
  addMessage('Sistema', 'Conexión restaurada', 'system');
});
socket.on('reconnect_attempt', attemptNumber => {
  console.log(`🔄 Intento de reconexión #${attemptNumber}`);
  connectionStatus.textContent = `Reconectando... (${attemptNumber})`;
});
socket.on('reconnect_failed', () => {
  console.error('❌ Reconexión fallida');
  connectionStatus.textContent = 'Reconexión fallida';
  connectionStatus.className = 'connection-status error';
  addMessage('Sistema', 'No se pudo reconectar. Recarga la página.', 'warning');
});
socket.on('player-disconnected', data => {
  addMessage('Sistema', `🔴 ${data.playerName} se desconectó.`, 'reconnect');
  updatePlayerList();
});
socket.on('player-action-update', data => {
  console.log('🎯 Acción recibida del servidor:', data.action, 'de:', data.playerName);
  players = data.players;
  potTotal = data.potTotal;
  currentBet = data.currentBet;
  currentPlayerTurn = data.currentPlayerTurn;
  currentRound = data.currentRound || currentRound;
  updatePlayerInfo();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updatePlayerList();
  updateRoundDisplay();
  if (data.action !== 'system' && data.playerName) {
    addMessage(data.playerName, getActionMessage(data.action, data.amount), getActionType(data.action));
  }
  if (currentPlayerTurn !== -1 && currentPlayerTurn < players.length) {
    console.log(`🔄 Actualizando turno a jugador índice: ${currentPlayerTurn}`);
    setPlayerTurn(currentPlayerTurn);
  } else {
    console.log('🏁 Ronda terminada - deshabilitando todos los controles');
    disableAllPlayerControls();
    if (isHost) {
      addMessage('Sistema', 'La ronda ha terminado. Selecciona al ganador.', 'system');
      if (roundEndBtn) roundEndBtn.style.display = 'block';
    }
  }
});
socket.on('system-message-receive', data => {
  addMessage('Sistema', data.message, data.type);
});
socket.on('converted-to-player', data => {
  console.log('✅ Conversión exitosa - Datos:', data);
  players = data.players;
  isSpectator = false;
  gameStarted = data.gameStarted;
  const myPlayer = players.find(p => p.socketId === socket.id);
  if (myPlayer) {
    playerName = myPlayer.name;
    playerChips = myPlayer.chips;
    myPlayerId = myPlayer.id;
    saveGameState();
    console.log(`🎯 Jugador local sincronizado: ${playerName} con $${playerChips}`);
  }
  if (waitingScreen) {
    waitingScreen.style.display = 'none';
  }
  updatePlayerList();
  updatePlayerInfo();
  updateBettingControls();
  updateHostControls();
  addMessage('Sistema', `✅ ${playerName} se ha unido como jugador`, 'system');
  playerMessageCount = 0;
  updateMessageCounters();
  if (chatInput) chatInput.disabled = false;
  if (sendMessageButton) sendMessageButton.disabled = false;
  console.log('🎮 Conversión a jugador completada exitosamente');
  reconnectOptionShown = false;
});
socket.on('winner-announced', data => {
  console.log('🏆 Evento de ganador recibido:', data);
  if (data.sidePots && data.sidePots.length > 1) {
    data.sidePots.forEach((pot, index) => {
      if (pot.winners && pot.winners.length > 0) {
        const winnerNames = pot.winners.map(w => `${w.name} ($${w.amount})`).join(', ');
        addMessage('Sistema', `🎯 Side Pot ${index + 1} ($${pot.amount}): ${winnerNames}`, 'system');
      }
    });
  }
  const waitingWinnerModal = document.getElementById('waiting-winner-modal');
  if (waitingWinnerModal) {
    waitingWinnerModal.style.display = 'none';
  }
  players = data.players;
  if (data.winners) {
    console.log('🏆 Múltiples ganadores anunciados:', data.winners);
    data.winners.forEach(winner => {
      addMessage('Sistema', `🏆 ${winner.name} gana $${winner.amount}!`, 'win');
    });
  } else {
    console.log('🏆 Ganador único anunciado:', data.winnerName);
    addMessage('Sistema', `🏆 ${data.winnerName} gana $${data.potAmount}!`, 'win');
  }
  updatePlayerList();
  updatePlayerInfo();
  potTotal = 0;
  potTotalElement.textContent = '0';
});
socket.on('convert-to-player', data => {
  console.log('🔄 Respuesta de convert-to-player recibida');
});
socket.on('new-round-starting', data => {
  if (isSpectator) {
    players = data.players;
    currentDealerIndex = data.dealerPosition;
    currentSmallBlindIndex = data.smallBlindIndex;
    currentBigBlindIndex = data.bigBlindIndex;
    currentPlayerTurn = data.currentPlayerTurn;
    potTotal = 0;
    currentBet = 0;
    updatePlayerList();
    potTotalElement.textContent = '0';
    currentBetAmount.textContent = '0';
    addMessage('Sistema', '¡Nueva ronda iniciada!', 'system');
    if (isHost) {
      roundEndBtn.style.display = 'block';
    } else {
      roundEndBtn.style.display = 'none';
    }
    addMessage('Sistema', '¡Nueva ronda iniciada!', 'system');
    if (isHost) {
      setTimeout(() => {
        postBlinds();
      }, 1000);
    }
  }
});
socket.on('game-finished', data => {
  addMessage('Sistema', `¡${data.winner.name} es el ganador final!`, 'win');
  if (isSpectator) {
    addMessage('Sistema', 'La partida ha terminado. Espera a que el host inicie una nueva partida para unirte.', 'system');
  } else {
    endGame(data.winner);
  }
});
socket.on('show-winner-selection', data => {
  console.log('🎯 Mostrando selección de ganador para host - Datos COMPLETOS:', data);
  console.log('🔍 DEBUG DETALLADO DE JUGADORES:');
  if (data.players && Array.isArray(data.players)) {
    data.players.forEach((p, i) => {
      console.log(`   [${i}] ${p.name} - isSpectator: ${p.isSpectator}, bankrupt: ${p.bankrupt}, folded: ${p.folded}, chips: ${p.chips}, bet: ${p.bet}`);
    });
  } else {
    console.log('❌ data.players no es un array válido:', data.players);
  }
  const waitingWinnerModal = document.getElementById('waiting-winner-modal');
  if (waitingWinnerModal) {
    waitingWinnerModal.style.display = 'none';
  }
  showWinnerSelection(data.potTotal, data.players);
});
socket.on('host-selecting-winner', data => {
  console.log('? Esperando a que el host seleccione al ganador...');
  if (!isHost) {
    const waitingWinnerModal = document.getElementById('waiting-winner-modal');
    const hostNameWaiting = document.getElementById('host-name-waiting');
    const waitingPotTotal = document.getElementById('waiting-pot-total');
    if (waitingWinnerModal && hostNameWaiting && waitingPotTotal) {
      hostNameWaiting.textContent = data.hostName;
      waitingPotTotal.textContent = data.potTotal;
      let reasonMessage = 'El anfitri��n est�� seleccionando al ganador...';
      if (data.reason === 'all-in') {
        reasonMessage = '?Todos los jugadores est��n ALL-IN! El anfitri��n est�� seleccionando al ganador...';
      }
      const messageElement = waitingWinnerModal.querySelector('.waiting-message p:first-child');
      if (messageElement) {
        messageElement.innerHTML = reasonMessage;
      }
      waitingWinnerModal.style.display = 'flex';
    }
    disableAllControls();
    let systemMessage = `?? ${data.hostName} est�� seleccionando al ganador del bote de $${data.potTotal}...`;
    if (data.reason === 'all-in') {
      systemMessage = `?? ?TODOS ALL-IN! ${data.hostName} est�� seleccionando al ganador del bote de $${data.potTotal}...`;
    }
    addMessage('Sistema', systemMessage, 'system');
  }
});
socket.on('player-joined', data => {
  players = data.players;
  updatePlayerList();
  updatePlayersNeeded();
  playerCount.textContent = `Jugadores: ${players.length}`;
  if (data.player.name !== playerName) {
    addMessage('Sistema', `${data.player.name} se ha unido a la sala`, 'join');
  }
  saveGameState();
});
socket.on('room-created', data => {
  console.log('Sala creada:', data);
  reconnectOptionShown = true;
  handleRoomCreated(data);
  saveGameState();
});
socket.on('joined-room', data => {
  console.log('Unido a sala:', data);
  if (waitingScreen) {
    waitingScreen.style.display = 'none';
  }
  reconnectOptionShown = true;
  handleJoinedRoom(data);
  saveGameState();
});
socket.on('error', message => {
  console.error('Error del servidor:', message);
  if (message.includes('No puedes unirte durante una ronda activa') && isSpectator) {
    console.log('🔄 Reintentando conversión en 2 segundos...');
    setTimeout(() => {
      convertToPlayerAuto();
    }, 2000);
    return;
  }
  if (!message.includes('ronda activa')) {
    alert('Error: ' + message);
  }
});
socket.on('new-message', data => {
  if (data.playerName !== playerName) {
    addMessage(data.playerName, data.message, '');
  }
});
socket.on('winner-announced', data => {
  addMessage('Sistema', `¡${data.winnerName} gana el bote de $${data.potAmount}!`, 'win');
  const winner = players.find(p => p.id === data.winnerId);
  if (winner) {
    winner.chips += data.potAmount;
  }
  potTotal = 0;
  potTotalElement.textContent = '0';
  updatePlayerList();
  updatePlayerInfo();
});

socket.on('players-shuffled', (data) => {
  console.log("🔄 Recibido nuevo orden de jugadores:", data.newOrder);
  players = data.newOrder;

  updatePlayerList();
  addMessage('Sistema', '🃏 Los asientos han sido mezclados.', 'system');
});