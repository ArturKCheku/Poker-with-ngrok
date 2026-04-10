sidePotStyles.textContent = `
  .side-pot-info {
    background: rgba(52, 152, 219, 0.1);
    border: 1px solid #3498db;
    border-radius: 5px;
    padding: 10px;
    margin: 10px 0;
    font-size: 0.9em;
  }
  
  .side-pot-item {
    margin: 5px 0;
    padding: 5px;
    background: rgba(52, 152, 219, 0.05);
    border-radius: 3px;
  }
  
  .player-bet-info {
    font-size: 0.8em;
    color: #7f8c8d;
    margin-top: 2px;
  }
`;
pokerStyles.textContent = `
        .message.poker-action {
            border-left: 4px solid #e74c3c;
            background: rgba(231, 76, 60, 0.1) !important;
        }
        
        .player-card.dealer {
            background: rgba(241, 196, 15, 0.2) !important;
            border: 2px solid #f1c40f !important;
        }
        
        .player-card.small-blind {
            background: rgba(52, 152, 219, 0.2) !important;
            border: 2px solid #3498db !important;
        }
        
        .player-card.big-blind {
            background: rgba(231, 76, 60, 0.2) !important;
            border: 2px solid #e74c3c !important;
        }
    `;
style.textContent = `
        .confirm-bet-btn:disabled {
            background: linear-gradient(to bottom, #95a5a6, #7f8c8d) !important;
            cursor: not-allowed;
        }
        
        .chip.pulse {
            animation: pulse 0.5s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
    `;
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', function () {
    const value = parseInt(this.getAttribute('data-value'));
    document.querySelectorAll('.chip').forEach(c => {
      c.classList.remove('selected');
    });
    this.classList.add('selected');
    addToTempBet(value);
  });
});

/**
 * Función principal interna: initializeRoundDisplay. Reacciona y ejecuta la lógica estandarizada.
 */
function initializeRoundDisplay() {
  updateRoundDisplay();
}

/**
 * Función principal interna: filterActivePlayers. Reacciona y ejecuta la lógica estandarizada.
 */
function filterActivePlayers(playersList) {
  if (!playersList || !Array.isArray(playersList)) {
    console.warn('❌ playersList no es un array válido:', playersList);
    return [];
  }
  console.log('🔍 FILTERING PLAYERS - Total:', playersList.length);
  const filteredPlayers = playersList.filter(player => {
    if (!player || typeof player !== 'object') {
      console.warn('❌ Player inválido:', player);
      return false;
    }
    console.log(`🔍 Analizando: ${player.name}`, {
      isSpectator: player.isSpectator,
      bankrupt: player.bankrupt,
      folded: player.folded,
      chips: player.chips,
      bet: player.bet
    });
    if (player.isSpectator === true) {
      console.log(`   🚫 EXCLUIDO: ${player.name} - ES ESPECTADOR`);
      return false;
    }
    if (player.bankrupt === true) {
      console.log(`   🚫 EXCLUIDO: ${player.name} - ESTÁ EN BANCARROTA`);
      return false;
    }
    if (player.folded === true) {
      console.log(`   🚫 EXCLUIDO: ${player.name} - SE RETIRÓ`);
      return false;
    }
    if (player.chips === 0 && player.bet === 0) {
      console.log(`   🚫 EXCLUIDO: ${player.name} - SIN FICHAS NI APUESTA`);
      return false;
    }
    console.log(`   ✅ INCLUIDO: ${player.name} - JUGADOR ACTIVO`);
    return true;
  });
  console.log('🔍 RESULTADO FILTRADO:', filteredPlayers.map(p => p.name));
  return filteredPlayers;
}

/**
 * Inicia la petición al servidor para fundar una nueva sala como anfitrión.
 */
function createRoom() {
  console.log('🎯 CREATE ROOM CLICKED - Estado del socket:', socket.connected);
  console.log('🎯 CREATE ROOM CLICKED - Socket ID:', socket.id);
  if (!socket.connected) {
    console.log('🔄 Socket no conectado, intentando reconectar...');
    socket.connect();
    setTimeout(() => {
      if (!socket.connected) {
        alert('No hay conexión con el servidor. Intenta recargar la página.');
        return;
      } else {
        executeCreateRoom();
      }
    }, 1000);
    return;
  }
  executeCreateRoom();
}

/**
 * Función principal interna: executeCreateRoom. Reacciona y ejecuta la lógica estandarizada.
 */
function executeCreateRoom() {
  clearGameState();
  players = [];
  currentPlayerTurn = 0;
  currentBet = 0;
  potTotal = 0;
  playerChips = 1500;
  playerBet = 0;
  tempBet = 0;
  currentRound = 'preflop';
  currentDealerIndex = -1;
  currentSmallBlindIndex = -1;
  currentBigBlindIndex = -1;
  blindsPosted = false;
  gameStarted = false;
  reconnectOptionShown = true;
  const initialMoneyElement = document.getElementById('initial-money');
  const playerNameElement = document.getElementById('player-name');
  if (!playerNameElement || !initialMoneyElement) {
    alert('Error: No se pudieron encontrar los campos de entrada.');
    setTimeout(() => {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Crear Sala';
    }, 1000);
    return;
  }
  const initialMoney = parseInt(initialMoneyElement.value);
  const rawPlayerName = playerNameElement.value;
  playerName = String(rawPlayerName).trim();
  console.log('🔍 DEBUG createRoom - playerName después de trim:', playerName);
  if (!playerName || playerName.trim().length === 0) {
    alert('Por favor, ingresa tu nombre');
    playerNameElement.focus();
    setTimeout(() => {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Crear Sala';
    }, 1000);
    return;
  }
  if (playerName.replace(/\s/g, '').length === 0) {
    alert('El nombre no puede contener solo espacios');
    playerNameElement.focus();
    setTimeout(() => {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Crear Sala';
    }, 1000);
    return;
  }
  if (playerName.length < 1 || playerName.length > 15) {
    alert('El nombre debe tener entre 1 y 15 caracteres');
    playerNameElement.focus();
    setTimeout(() => {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Crear Sala';
    }, 1000);
    return;
  }
  const nameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/;
  if (!nameRegex.test(playerName)) {
    alert('El nombre solo puede contener letras, números y espacios');
    playerNameElement.focus();
    setTimeout(() => {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Crear Sala';
    }, 1000);
    return;
  }
  if (isNaN(initialMoney) || initialMoney < 100 || initialMoney > 10000) {
    alert('El dinero inicial debe estar entre $100 y $10,000');
    initialMoneyElement.focus();
    setTimeout(() => {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Crear Sala';
    }, 1000);
    return;
  }
  console.log('🎯 Creando NUEVA sala para:', playerName, 'con $', initialMoney);
  createRoomBtn.disabled = true;
  createRoomBtn.textContent = 'Creando...';
  createRoomBtn.classList.add('creating');
  console.log('🎯 ENVIANDO AL SERVIDOR - playerName:', playerName, 'initialMoney:', initialMoney);
  const creationTimeout = setTimeout(() => {
    console.log('⏰ Timeout de creación de sala - rehabilitando botón');
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = 'Crear Sala';
    alert('El servidor no respondió. Intenta nuevamente.');
  }, 10000);
  socket.emit('create-room', {
    playerName: playerName,
    initialMoney: initialMoney
  });

  /**
   * Función principal interna: handleRoomCreated. Reacciona y ejecuta la lógica estandarizada.
   */

  const handleRoomCreated = () => {
    clearTimeout(creationTimeout);
  };
  /**
   * Función principal interna: handleCreateError. Reacciona y ejecuta la lógica estandarizada.
   */
  const handleCreateError = () => {
    clearTimeout(creationTimeout);
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = 'Crear Sala';
  };
  socket.once('room-created', handleRoomCreated);
  socket.once('error', handleCreateError);
  socket.once('create-room-error', handleCreateError);
  setTimeout(() => {
    if (createRoomBtn.disabled) {
      console.log('🔄 Fallback: rehabilitando botón después de 5 segundos');
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Crear Sala';
    }
  }, 5000);
}

/**
 * Función principal interna: initializeGameState. Reacciona y ejecuta la lógica estandarizada.
 */
function initializeGameState() {
  if (currentRoomCode && playerName) {
    console.log('🎯 Ya estamos en una sala activa, omitiendo reconexión automática');
    return false;
  }
  const savedState = loadGameState();
  if (savedState && savedState.roomCode) {
    const isStateValid = savedState.playerName && savedState.playerName.trim() !== '';
    const isStateTooOld = Date.now() - savedState.timestamp > 10 * 60 * 1000;
    if (!isStateValid || isStateTooOld) {
      console.log('❌ Estado inválido o muy antiguo, descartando...');
      clearInvalidGameState();
      return false;
    }
    currentRoomCode = savedState.roomCode;
    myPlayerId = savedState.playerId;
    playerName = savedState.playerName;
    isSpectator = savedState.isSpectator || false;
    gameStarted = savedState.gameStarted || false;
    console.log('🎮 Estado válido encontrado para reconexión MANUAL:', {
      roomCode: currentRoomCode,
      playerName: playerName,
      isSpectator: isSpectator,
      gameStarted: gameStarted
    });
    return true;
  }
  return false;
}

/**
 * Renderiza en pantalla central un modal anunciando el salto de una fase a otra (Ej. Flop -> Turn).
 */
function showRoundModal(round, currentPlayerTurn) {
  if (!roundModal) return;
  const phases = {
    preflop: 'PREFLOP - Primera ronda de apuestas',
    flop: 'FLOP - Se muestran 3 cartas comunitarias',
    turn: 'TURN - Se muestra la 4ta carta comunitaria',
    river: 'RIVER - Se muestra la última carta comunitaria'
  };
  roundTitle.textContent = `Ronda ${roundNames[round]}`;
  roundPhase.textContent = roundNames[round];
  roundDescription.textContent = phases[round];
  roundModal.style.display = 'flex';
  setTimeout(() => {
    roundModal.style.display = 'none';
    console.log(`�?Modal de ${round} cerrado`);
    updateBettingControls();
    if (currentPlayerTurn !== -1) {
      setPlayerTurn(currentPlayerTurn);
    }
  }, 3000);
}

/**
 * Inyecta en LocalStorage las credenciales de la partida para resistir cierres del navegador accidental.
 */
function saveGameState() {
  if (currentRoomCode && playerName && playerName.trim() !== '') {
    const gameState = {
      roomCode: currentRoomCode,
      playerId: myPlayerId || socket.id,
      playerName: playerName,
      timestamp: Date.now(),
      isSpectator: isSpectator,
      gameStarted: gameStarted
    };
    localStorage.setItem('pokerGameState', JSON.stringify(gameState));
    localStorage.setItem('pokerRoomCode', currentRoomCode);
    localStorage.setItem('pokerPlayerId', myPlayerId || socket.id);
    localStorage.setItem('pokerPlayerName', playerName);
  } else {
    console.log('⚠️ No se guardó estado: información incompleta', {
      roomCode: currentRoomCode,
      playerName: playerName
    });
  }
}

/**
 * Función principal interna: loadGameState. Reacciona y ejecuta la lógica estandarizada.
 */
function loadGameState() {
  try {
    const savedState = localStorage.getItem('pokerGameState');
    if (savedState) {
      const state = JSON.parse(savedState);
      if (Date.now() - state.timestamp < 2 * 60 * 60 * 1000) {
        console.log('💾 Estado cargado:', state);
        return state;
      } else {
        console.log('🕒 Estado muy antiguo, limpiando...');
        clearGameState();
      }
    }
  } catch (e) {
    console.error('❌ Error cargando estado guardado:', e);
    clearGameState();
  }
  return null;
}

/**
 * Función principal interna: clearGameState. Reacciona y ejecuta la lógica estandarizada.
 */

function clearGameState() {
  console.log('🧹 Limpiando estado del juego completamente...');
  const keysToRemove = ['pokerGameState', 'pokerRoomCode', 'pokerPlayerId', 'pokerPlayerName', 'pokerReconnectAttempted'];
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Eliminado: ${key}`);
  });
  currentRoomCode = '';
  myPlayerId = '';
  playerName = '';
  isSpectator = false;
  isHost = false;
  gameStarted = false;
  players = [];
  currentPlayerTurn = 0;
  currentBet = 0;
  potTotal = 0;
  playerChips = 0;
  playerBet = 0;
  tempBet = 0;
  currentRound = 'preflop';
  currentDealerIndex = -1;
  currentSmallBlindIndex = -1;
  currentBigBlindIndex = -1;
  playerMessageCount = 0;
  blindsPosted = false;
  reconnectOptionShown = true;
  socket.off('reconnect-success');
  socket.off('reconnect-failed');
  socket.off('reconnect-player');
  if (potTotalElement) potTotalElement.textContent = '0';
  if (currentBetAmount) currentBetAmount.textContent = '0';
  if (playerChipsElement) playerChipsElement.textContent = '0';
  if (playerBetElement) playerBetElement.textContent = '0';
  console.log('✅ Estado del juego completamente limpiado');
}

/**
 * Función principal interna: fullReset. Reacciona y ejecuta la lógica estandarizada.
 */
function fullReset() {
  console.log('🔄 Reinicio completo de la aplicación');
  clearGameState();
  initialModal.style.display = 'flex';
  mainGame.style.display = 'none';
  if (playerNameInput) playerNameInput.value = '';
  if (joinPlayerNameInput) joinPlayerNameInput.value = '';
  if (roomCodeInput) roomCodeInput.value = '';
  if (document.getElementById('initial-money')) document.getElementById('initial-money').value = '300';
  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="message system">
        <div class="message-header">
          <span>Sistema</span>
          <span>Ahora</span>
        </div>
        <div class="message-content">
          Bienvenido a la sala de Poker. Esperando jugadores...
        </div>
      </div>
    `;
  }
  updateMessageCounters();
  updateCharCount();
  socket.disconnect();
  setTimeout(() => {
    socket.connect();
  }, 500);
  console.log('✅ Reinicio completo completado');
}

/**
 * Función principal interna: initializeGameState. Reacciona y ejecuta la lógica estandarizada.
 */
function initializeGameState() {
  if (currentRoomCode && playerName) {
    console.log('🎯 Ya estamos en una sala activa, omitiendo reconexión automática');
    return false;
  }
  const savedState = loadGameState();
  if (savedState && savedState.roomCode) {
    const isStateValid = savedState.playerName && savedState.playerName.trim() !== '';
    const isStateTooOld = Date.now() - savedState.timestamp > 10 * 60 * 1000;
    if (!isStateValid || isStateTooOld) {
      console.log('❌ Estado inválido o muy antiguo, descartando...');
      clearInvalidGameState();
      return false;
    }
    currentRoomCode = savedState.roomCode;
    myPlayerId = savedState.playerId;
    playerName = savedState.playerName;
    isSpectator = savedState.isSpectator || false;
    gameStarted = savedState.gameStarted || false;
    console.log('🎮 Estado válido encontrado para reconexión:', {
      roomCode: currentRoomCode,
      playerName: playerName,
      isSpectator: isSpectator,
      gameStarted: gameStarted
    });
    return true;
  }
  return false;
}

/**
 * Función principal interna: clearInvalidGameState. Reacciona y ejecuta la lógica estandarizada.
 */
function clearInvalidGameState() {
  console.log('🧹 Limpiando solo estado inválido...');
  const keysToRemove = ['pokerGameState', 'pokerRoomCode', 'pokerPlayerId', 'pokerPlayerName'];
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Eliminado: ${key}`);
  });
  console.log('✅ Estado inválido limpiado, variables en memoria mantenidas');
}

/**
 * Intento de recuperación automática de conexión cuando el Socket se interrumpe y restaura inesperadamente.
 */

function attemptAutoReconnect() {
  if (initialModal && initialModal.style.display === 'flex') {
    console.log('🔒 No reconectar: Estamos en pantalla inicial');
    return;
  }
  if (mainGame && mainGame.style.display !== 'flex') {
    console.log('🔒 No reconectar: No estamos en pantalla de juego');
    return;
  }
  const savedState = loadGameState();
  if (savedState && savedState.roomCode && socket.connected) {
    console.log('🔄 Intentando reconexión automática a sala:', savedState.roomCode);
    startReconnectSafetyTimeout();
    if (initialModal) initialModal.style.display = 'none';
    if (mainGame) mainGame.style.display = 'flex';
    if (waitingScreen) {
      waitingScreen.style.display = 'flex';
      waitingScreen.innerHTML = `
        <h2>🔄 Reconectando...</h2>
        <p>Intentando reconectar a la sala ${savedState.roomCode}</p>
        <div class="players-needed">Por favor espera...</div>
        <div class="loading-spinner"></div>
      `;
    }
    setTimeout(() => {
      socket.emit('reconnect-player', {
        roomCode: savedState.roomCode,
        playerId: savedState.playerId,
        playerName: savedState.playerName
      });
    }, 1000);
  } else {
    console.log('💾 No hay estado válido para reconectar');
  }
  if (waitingScreen) {
    waitingScreen.style.display = 'none';
  }
}
/**
 * Función principal interna: cleanupDuplicatePlayers. Reacciona y ejecuta la lógica estandarizada.
 */

function cleanupDuplicatePlayers(room, playerName) {
  const playersWithSameName = room.players.filter(p => p.name === playerName);
  if (playersWithSameName.length > 1) {
    console.log(`🧹 Limpiando jugadores duplicados para: ${playerName}`);
    const mostRecentPlayer = playersWithSameName.reduce((latest, current) => {
      return !latest.disconnectedAt || current.disconnectedAt && current.disconnectedAt > latest.disconnectedAt ? current : latest;
    });
    room.players = room.players.filter(p => p.name !== playerName || p.socketId === mostRecentPlayer.socketId);
    console.log(`✅ Jugadores duplicados eliminados. Queda: ${mostRecentPlayer.name}`);
  }
}

/**
 * Función principal interna: cleanupOldGameState. Reacciona y ejecuta la lógica estandarizada.
 */
function cleanupOldGameState() {
  const savedState = loadGameState();
  if (savedState && savedState.timestamp) {
    const isTooOld = Date.now() - savedState.timestamp > 30 * 60 * 1000;
    if (isTooOld) {
      console.log('🕒 Estado anterior muy antiguo, limpiando automáticamente...');
      clearInvalidGameState();
    }
    if (!savedState.playerName || savedState.playerName.trim() === '') {
      console.log('❌ Estado con nombre vacío, limpiando...');
      clearInvalidGameState();
    }
  }
}

/**
 * Función principal interna: handleRoomCreated. Reacciona y ejecuta la lógica estandarizada.
 */
function handleRoomCreated(data) {
  console.log('✅ NUEVA sala creada exitosamente:', data.roomCode);
  currentRoomCode = data.roomCode;
  isHost = true;
  players = data.players;
  const localPlayer = players.find(p => p.isHost && p.socketId === socket.id);
  if (localPlayer) {
    myPlayerId = localPlayer.id;
    playerChips = localPlayer.chips;
  }
  initialModal.style.display = 'none';
  mainGame.style.display = 'flex';
  saveGameState();
  roomCodeDisplay.style.display = 'block';
  roomCodeElement.textContent = currentRoomCode;
  roomInfo.style.display = 'block';
  playerCount.textContent = `Jugadores: ${players.length}`;
  roomCodeInfo.textContent = `Código: ${currentRoomCode}`;
  updatePlayerList();
  updatePlayersNeeded();
  updateHostControls();
  updateRoundDisplay();
  setTimeout(updateRoundDisplay, 100);
  initializeRoundDisplay();
  addMessage('Sistema', `Sala creada: ${currentRoomCode}. Comparte este código.`, 'system');
  disableAllControls();
  if (roundEndBtn) {
    roundEndBtn.style.display = 'none';
  }
  if (startGameBtn) {
    startGameBtn.style.display = 'block';
  }
  console.log('✅ Sala NUEVA creada exitosamente. Mi ID:', myPlayerId);
  reconnectOptionShown = false;
}

/**
 * Función principal interna: handleJoinedRoom. Reacciona y ejecuta la lógica estandarizada.
 */
function handleJoinedRoom(data) {
  console.log('✅ Unido a sala exitosamente:', data.roomCode);
  currentRoomCode = data.roomCode;
  isHost = data.isHost;
  players = data.players;
  const localPlayer = players.find(p => p.socketId === socket.id);
  if (localPlayer) {
    myPlayerId = localPlayer.id;
    playerChips = localPlayer.chips;
    isSpectator = localPlayer.isSpectator || false;
  }
  initialModal.style.display = 'none';
  mainGame.style.display = 'flex';
  saveGameState();
  roomInfo.style.display = 'block';
  playerCount.textContent = `Jugadores: ${players.length}`;
  roomCodeInfo.textContent = `Código: ${currentRoomCode}`;
  updatePlayerList();
  updatePlayersNeeded();
  updateHostControls();
  updateRoundDisplay();
  setTimeout(updateRoundDisplay, 100);
  initializeRoundDisplay();
  addMessage('Sistema', `Te has unido a la sala ${currentRoomCode}`, 'system');
  if (roundEndBtn) {
    roundEndBtn.style.display = 'none';
  }
  if (startGameBtn) {
    startGameBtn.style.display = 'none';
  }
  disableAllControls();
  console.log('✅ Unido a sala exitosamente. Mi ID:', myPlayerId, 'Es host:', isHost, 'Es espectador:', isSpectator);
  reconnectOptionShown = false;
}

/**
 * Función principal interna: verifyHostPermission. Reacciona y ejecuta la lógica estandarizada.
 */
function verifyHostPermission(action = 'realizar esta acción') {
  const myPlayer = players.find(p => p.socketId === socket.id);
  if (!myPlayer) {
    console.log('❌ Jugador no encontrado para verificar permisos');
    return false;
  }
  if (!myPlayer.isHost) {
    console.log(`❌ Intento de acción de host por no-host: ${myPlayer.name}`);
    addMessage('Sistema', `Solo el anfitrión puede ${action}`, 'warning');
    return false;
  }
  console.log(`✅ Permisos de host verificados para: ${myPlayer.name}`);
  return true;
}


/**
 * Función principal interna: getMyPlayer. Reacciona y ejecuta la lógica estandarizada.
 */
function getMyPlayer() {
  let player = players.find(p => p.socketId === socket.id);
  if (player) {
    if (myPlayerId !== player.id) {
      console.log(`🔄 Actualizando myPlayerId: ${myPlayerId} -> ${player.id}`);
      myPlayerId = player.id;
    }
    return player;
  }
  if (myPlayerId) {
    player = players.find(p => p.id === myPlayerId);
    if (player) {
      return player;
    }
  }
  if (playerName) {
    player = players.find(p => p.name === playerName);
    if (player) {
      myPlayerId = player.id;
      return player;
    }
  }
  console.log('🔍 Jugador local no encontrado. Búsqueda fallida.');
  console.log('   Socket ID:', socket.id);
  console.log('   myPlayerId:', myPlayerId);
  console.log('   playerName:', playerName);
  console.log('   Jugadores disponibles:', players.map(p => ({
    name: p.name,
    id: p.id,
    socketId: p.socketId,
    isSpectator: p.isSpectator
  })));
  return null;
}

/**
 * Función principal interna: disableAllPlayerControls. Reacciona y ejecuta la lógica estandarizada.
 */
function disableAllPlayerControls() {
  console.log('🚫 Deshabilitando TODOS los controles del jugador');
  disablePlayerControls();
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.add('disabled');
    chip.style.pointerEvents = 'none';
  });
  if (allInBtn) {
    allInBtn.classList.add('disabled');
    allInBtn.style.pointerEvents = 'none';
  }
}

/**
 * Función principal interna: disableAllControls. Reacciona y ejecuta la lógica estandarizada.
 */
function disableAllControls() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.add('disabled');
  });
  allInBtn.style.display = 'none';
  allInBtn.classList.add('disabled');
  allInBtn.style.pointerEvents = 'none';
  foldBtn.disabled = true;
  foldBtn.classList.add('disabled');
  checkBtn.disabled = true;
  checkBtn.classList.add('disabled');
  callBtn.disabled = true;
  callBtn.classList.add('disabled');
  tempBetDisplay.style.display = 'none';
  tempBet = 0;
  confirmBetBtn.disabled = true;
  confirmBetBtn.classList.add('disabled');
  cancelBetBtn.disabled = false;
  cancelBetBtn.classList.remove('disabled');
}

/**
 * Renderiza en pantalla central un modal anunciando el salto de una fase a otra (Ej. Flop -> Turn).
 */
function showRoundModal(phase) {
  console.log(`🔄 Mostrando modal para fase: ${phase}`);
  const phaseConfig = {
    preflop: {
      title: 'Ronda Preflop',
      phase: 'PREFLOP',
      description: 'Primera ronda de apuestas - Cartas iniciales repartidas'
    },
    flop: {
      title: 'Ronda Flop',
      phase: 'FLOP',
      description: 'Se revelan 3 cartas comunitarias - Segunda ronda de apuestas'
    },
    turn: {
      title: 'Ronda Turn',
      phase: 'TURN',
      description: 'Se revela la 4ta carta comunitaria - Tercera ronda de apuestas'
    },
    river: {
      title: 'Ronda River',
      phase: 'RIVER',
      description: 'Se revela la 5ta carta comunitaria - Ronda final de apuestas'
    }
  };
  const config = phaseConfig[phase];
  if (!config) return;
  roundTitle.textContent = config.title;
  roundPhase.textContent = config.phase;
  roundDescription.textContent = config.description;
  roundModal.style.display = 'flex';
  setTimeout(() => {
    roundModal.style.display = 'none';
  }, 3000);
}

/**
 * Función principal interna: showNewRoundModal. Reacciona y ejecuta la lógica estandarizada.
 */
function showNewRoundModal(newRound, currentPlayerTurn) {
  if (!roundModal) {
    console.error('�?roundModal no encontrado');
    return;
  }
  console.log(`🎯 Mostrando modal para ronda: ${newRound}`);
  roundTitle.textContent = `Ronda ${safeGetRoundName(newRound)}`;
  roundPhase.textContent = safeGetRoundName(newRound);
  roundDescription.textContent = safeGetRoundDescription(newRound);
  roundPhase.style.color = '#f1c40f';
  roundPhase.style.fontSize = '2.5rem';
  roundModal.style.display = 'flex';
  setTimeout(() => {
    if (roundModal) {
      roundModal.style.display = 'none';
      console.log(`�?Modal de ${newRound} cerrado`);
      setTimeout(() => {
        updateBettingControls();
        if (currentPlayerTurn !== -1) {
          setPlayerTurn(currentPlayerTurn);
        }
      }, 100);
    }
  }, 3000);
}

/**
 * Función principal interna: isNewRoundBeginning. Reacciona y ejecuta la lógica estandarizada.
 */
function isNewRoundBeginning(previousRound, currentRound) {
  const rounds = ['preflop', 'flop', 'turn', 'river'];
  const prevIndex = rounds.indexOf(previousRound);
  const currIndex = rounds.indexOf(currentRound);
  return currIndex === prevIndex + 1;
}

/**
 * Función principal interna: disablePlayerControls. Reacciona y ejecuta la lógica estandarizada.
 */
function disablePlayerControls() {
  console.log('Deshabilitando controles del jugador');
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.add('disabled');
    chip.style.pointerEvents = 'none';
  });
  if (allInBtn) {
    allInBtn.classList.add('disabled');
    allInBtn.style.pointerEvents = 'none';
  }
  foldBtn.disabled = true;
  foldBtn.classList.add('disabled');
  checkBtn.disabled = true;
  checkBtn.classList.add('disabled');
  callBtn.disabled = true;
  callBtn.classList.add('disabled');
  tempBetDisplay.style.display = 'none';
  tempBet = 0;
  tempBetValue.textContent = '0';
  confirmBetBtn.disabled = true;
  confirmBetBtn.classList.add('disabled');
  cancelBetBtn.disabled = false;
  cancelBetBtn.classList.remove('disabled');
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.remove('selected');
  });
}

/**
 * Función principal interna: updatePlayersNeeded. Reacciona y ejecuta la lógica estandarizada.
 */
function updatePlayersNeeded() {
  const needed = Math.max(0, 2 - players.length);
  playersNeeded.textContent = `${players.length}/6 jugadores`;
  if (players.length >= 2 && isHost) {
    startGameBtn.disabled = false;
    startGameBtn.classList.remove('disabled');
  } else {
    startGameBtn.disabled = true;
    startGameBtn.classList.add('disabled');
  }
}

/**
 * Función principal interna: cancelWinnerSelection. Reacciona y ejecuta la lógica estandarizada.
 */
function cancelWinnerSelection() {
  winnerModal.style.display = 'none';
  selectedWinner = null;
  socket.emit('system-message', {
    roomCode: currentRoomCode,
    message: 'Selecci��n de ganador cancelada por el host',
    type: 'system'
  });
  addMessage('Sistema', 'Selecci��n de ganador cancelada. Puedes volver a abrirla con "Terminar Ronda".', 'warning');
  console.log('? Selecci��n de ganador cancelada por el usuario');
}

/**
 * Función principal interna: startGame. Reacciona y ejecuta la lógica estandarizada.
 */
function startGame() {
  if (players.length < 2) {
    addMessage('Sistema', 'Se necesitan al menos 2 jugadores para comenzar.', 'warning');
    return;
  }
  gameStarted = true;
  waitingScreen.style.display = 'none';
  startGameBtn.style.display = 'none';
  roundEndBtn.style.display = 'block';
  roomCodeDisplay.style.display = 'none';
  playerMessageCount = 0;
  updateMessageCounters();
  allInBtn.style.display = 'flex';
  currentRound = 'preflop';
  currentMaxBet = 0;
  blindsPosted = false;
  socket.emit('start-game', currentRoomCode);
  console.log(`🎮 Juego iniciado - Ronda: ${currentRound}`);
}

/**
 * Función principal interna: startNewGame. Reacciona y ejecuta la lógica estandarizada.
 */
function startNewGame() {
  console.log('🎮 Iniciando nueva partida desde cero...');
  fullReset();
  initialModal.style.display = 'flex';
  mainGame.style.display = 'none';
  setTimeout(() => {
    reconnectOptionShown = false;
  }, 1000);
  console.log('✅ Nueva partida lista para comenzar');
}

/**
 * Función principal interna: getActionMessage. Reacciona y ejecuta la lógica estandarizada.
 */
function getActionMessage(action, amount) {
  switch (action) {
    case 'fold':
      return 'se retira';
    case 'check':
      return 'pasa';
    case 'call':
      return `iguala $${amount}`;
    case 'bet':
      return `apuesta $${amount}`;
    case 'all-in':
      return `va ALL IN con $${amount}`;
    default:
      return `realiza ${action}`;
  }
}

/**
 * Función principal interna: getActionType. Reacciona y ejecuta la lógica estandarizada.
 */
function getActionType(action) {
  switch (action) {
    case 'fold':
      return 'fold';
    case 'check':
      return 'waiting';
    case 'call':
      return 'bet';
    case 'bet':
      return 'bet';
    case 'all-in':
      return 'all-in';
    default:
      return '';
  }
}

/**
 * Función principal interna: postBlinds. Reacciona y ejecuta la lógica estandarizada.
 */
function postBlinds() {
  if (blindsPosted) {
    console.log('Ciegas ya publicadas, omitiendo...');
    return;
  }
  const activePlayers = players.filter(p => !p.folded && !p.bankrupt && !isPlayerAllIn(p));
  if (activePlayers.length < 2) {
    addMessage('Sistema', 'No hay suficientes jugadores activos para publicar ciegas', 'warning');
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      addMessage('Sistema', `¡${winner.name} gana por ser el único jugador activo!`, 'win');
      endGame(winner);
    }
    return;
  }
  blindsPosted = true;
  console.log(`Publicando ciegas - Dealer: ${players[currentDealerIndex]?.name}, Small Blind: ${players[currentSmallBlindIndex]?.name}, Big Blind: ${players[currentBigBlindIndex]?.name}`);
  if (players[currentSmallBlindIndex].chips >= smallBlind) {
    players[currentSmallBlindIndex].chips -= smallBlind;
    players[currentSmallBlindIndex].bet = smallBlind;
    potTotal += smallBlind;
    console.log(`${players[currentSmallBlindIndex].name} publica Small Blind: $${smallBlind}`);
  } else {
    const allInAmount = players[currentSmallBlindIndex].chips;
    players[currentSmallBlindIndex].chips = 0;
    players[currentSmallBlindIndex].bet = allInAmount;
    potTotal += allInAmount;
    console.log(`${players[currentSmallBlindIndex].name} publica Small Blind ALL-IN: $${allInAmount}`);
  }
  if (players[currentBigBlindIndex].chips >= bigBlind) {
    players[currentBigBlindIndex].chips -= bigBlind;
    players[currentBigBlindIndex].bet = bigBlind;
    potTotal += bigBlind;
    console.log(`${players[currentBigBlindIndex].name} publica Big Blind: $${bigBlind}`);
  } else {
    const allInAmount = players[currentBigBlindIndex].chips;
    players[currentBigBlindIndex].chips = 0;
    players[currentBigBlindIndex].bet = allInAmount;
    potTotal += allInAmount;
    console.log(`${players[currentBigBlindIndex].name} publica Big Blind ALL-IN: $${allInAmount}`);
  }
  currentMaxBet = bigBlind;
  currentBet = bigBlind;
  currentPlayerTurn = (currentBigBlindIndex + 1) % players.length;
  let attempts = 0;
  while ((players[currentPlayerTurn].folded || players[currentPlayerTurn].bankrupt || players[currentPlayerTurn].isSpectator) && attempts < players.length) {
    currentPlayerTurn = (currentPlayerTurn + 1) % players.length;
    attempts++;
  }
  console.log(`➡️ Primer turno después de BB: ${players[currentPlayerTurn].name}`);
  socket.emit('system-message', {
    roomCode: currentRoomCode,
    message: `${players[currentSmallBlindIndex].name} apuesta Small Blind: $${smallBlind}`,
    type: 'blind'
  });
  socket.emit('system-message', {
    roomCode: currentRoomCode,
    message: `${players[currentBigBlindIndex].name} apuesta Big Blind: $${bigBlind}`,
    type: 'blind'
  });
  updatePlayerList();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updatePlayerInfo();
  socket.emit('game-state-update', {
    roomCode: currentRoomCode,
    players: players,
    potTotal: potTotal,
    currentBet: currentBet,
    currentPlayerTurn: currentPlayerTurn,
    currentRound: currentRound
  });
  startBettingRound();
}

/**
 * Función principal interna: resetPlayerState. Reacciona y ejecuta la lógica estandarizada.
 */
function resetPlayerState() {
  console.log('🔄 Reseteando estado del jugador...');
  if (isSpectator) {
    localStorage.removeItem('pokerPlayerId');
  }
  playerChips = 0;
  playerBet = 0;
  tempBet = 0;
  updatePlayerInfo();
  if (tempBetDisplay) tempBetDisplay.style.display = 'none';
}

/**
 * Petición cliente para conectarse a una sala existente usando un Room Code.
 */
function joinRoom() {
  reconnectOptionShown = true;
  const reconnectSection = document.querySelector('.reconnect-section');
  if (reconnectSection) {
    reconnectSection.remove();
    console.log('🧹 Sección de reconexión eliminada al unirse a sala');
  }
  const roomCodeElement = document.getElementById('room-code-input');
  const playerNameElement = document.getElementById('join-player-name');
  if (!roomCodeElement || !playerNameElement) {
    alert('Error: No se pudieron encontrar los campos de entrada.');
    return;
  }
  const roomCode = roomCodeElement.value.trim().toUpperCase();
  const rawPlayerName = playerNameElement.value;
  playerName = String(rawPlayerName).trim();
  console.log('🔍 DEBUG joinRoom - playerName después de trim:', playerName);
  if (!socket.connected) {
    alert('No hay conexión con el servidor. Intenta recargar la página.');
    return;
  }
  if (!playerName) {
    alert('Por favor, ingresa tu nombre');
    playerNameElement.focus();
    return;
  }
  if (playerName.replace(/\s/g, '').length === 0) {
    alert('El nombre no puede contener solo espacios');
    playerNameElement.focus();
    return;
  }
  if (playerName.length < 1 || playerName.length > 15) {
    alert('El nombre debe tener entre 1 y 15 caracteres');
    playerNameElement.focus();
    return;
  }
  const nameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/;
  if (!nameRegex.test(playerName)) {
    alert('El nombre solo puede contener letras, números y espacios');
    playerNameElement.focus();
    return;
  }
  if (!roomCode || roomCode.length !== 6) {
    alert('Por favor, ingresa un código de sala válido de 6 caracteres');
    roomCodeElement.focus();
    return;
  }
  console.log('🎯 Uniéndose a sala NUEVA:', roomCode, 'como:', playerName);
  joinRoomBtn.disabled = true;
  joinRoomBtn.textContent = 'Uniendo...';
  socket.off('reconnect-success');
  socket.off('reconnect-failed');
  socket.emit('join-room', {
    roomCode: roomCode,
    playerName: playerName
  });
  setTimeout(() => {
    joinRoomBtn.disabled = false;
    joinRoomBtn.textContent = 'Unirse';
  }, 3000);
}

/**
 * Función principal interna: completePlayerConversion. Reacciona y ejecuta la lógica estandarizada.
 */
function completePlayerConversion(myPlayer) {
  console.log('🎮 COMPLETE CONVERSION para:', myPlayer.name);
  isSpectator = false;
  myPlayerId = myPlayer.id;
  playerName = myPlayer.name;
  playerChips = myPlayer.chips;
  saveGameState();
  if (waitingScreen) {
    waitingScreen.style.display = 'none';
  }
  updatePlayerList();
  updatePlayerInfo();
  updateBettingControls();
  if (chatInput) chatInput.disabled = false;
  if (sendMessageButton) sendMessageButton.disabled = false;
  addMessage('Sistema', `🎉 ${playerName} ahora es jugador con $${playerChips} fichas!`, 'system');
  console.log('✅ CONVERSIÓN COMPLETADA');
  reconnectOptionShown = false;
}

/**
 * Función principal interna: findNextActivePlayer. Reacciona y ejecuta la lógica estandarizada.
 */
function findNextActivePlayer(startIndex) {
  let nextIndex = (startIndex + 1) % players.length;
  let attempts = 0;
  let player = players[nextIndex];
  while (attempts < players.length) {
    if (!player.folded && !player.bankrupt && !player.isSpectator && !(player.chips === 0 && player.bet > 0)) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % players.length;
    attempts++;
  }
  return -1;
}

/**
 * Función principal interna: isPlayerAllIn. Reacciona y ejecuta la lógica estandarizada.
 */
function isPlayerAllIn(player) {
  return player && player.chips === 0 && player.bet > 0;
}

/**
 * Función principal interna: amIAllIn. Reacciona y ejecuta la lógica estandarizada.
 */

function amIAllIn() {
  const player = getMyPlayer();
  return isPlayerAllIn(player);
}

/**
 * Función principal interna: showTransitionCountdown. Reacciona y ejecuta la lógica estandarizada.
 */
function showTransitionCountdown(countdown, nextRound) {
  if (!roundModal) return;
  roundTitle.textContent = `Avanzando a ${roundNames[nextRound]}`;
  roundPhase.textContent = countdown > 0 ? countdown : '¡YA!';
  roundDescription.textContent = `Nueva ronda comenzando en...`;
  if (countdown > 0) {
    roundPhase.style.color = '#f1c40f';
    roundPhase.style.fontSize = '4rem';
  } else {
    roundPhase.style.color = '#2ecc71';
    roundPhase.style.fontSize = '3rem';
  }
  roundModal.style.display = 'flex';
  if (countdown <= 0) {
    setTimeout(() => {
      roundModal.style.display = 'none';
    }, 1000);
  }
}

/**
 * Función principal interna: showConversionCountdown. Reacciona y ejecuta la lógica estandarizada.
 */
function showConversionCountdown(delay) {
  if (waitingScreen) {
    const seconds = delay / 1000;
    waitingScreen.style.display = 'flex';
    waitingScreen.innerHTML = `
				<h2>🎮 Uniéndote a la partida...</h2>
				<p>Serás convertido a jugador automáticamente en:</p>
				<div class="players-needed" id="conversion-countdown" style="font-size: 2rem; color: #f1c40f;">${seconds}</div>
				<div style="margin-top: 20px; padding: 15px; background: rgba(46, 204, 113, 0.2); border-radius: 8px; border: 2px solid #2ecc71;">
					<p><strong>💰 Recibirás: $${getRoomInitialMoney()} fichas iniciales</strong></p>
					<p>Podrás jugar en la siguiente ronda como jugador completo</p>
				</div>
			`;
    let countdown = seconds;
    const countdownElement = document.getElementById('conversion-countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        countdownElement.textContent = '¡Listo!';
      }
    }, 1000);
  }
}

/**
 * Función principal interna: getRoomInitialMoney. Reacciona y ejecuta la lógica estandarizada.
 */
function getRoomInitialMoney() {
  const anyPlayer = players.find(p => !p.isSpectator);
  return anyPlayer ? anyPlayer.chips : 300;
}

/**
 * Actualiza la interfaz del cliente renderizando saldo, apuestas y estatus.
 */
function updatePlayerInfo() {
  const player = getMyPlayer();
  if (!player) return;
  playerChipsElement.textContent = player.chips;
  playerBetElement.textContent = player.bet;
  const statusElement = document.getElementById('player-status');
  const actionIndicator = document.getElementById('action-indicator');
  let statusText = 'ACTIVO';
  let statusClass = 'player-status';
  if (player.bankrupt) {
    statusText = 'BANCARROTA';
    statusClass = 'player-status bankrupt';
  } else if (player.folded) {
    statusText = 'RETIRADO';
    statusClass = 'player-status folded';
  } else if (player.chips === 0 && player.bet > 0) {
    statusText = 'ALL IN';
    statusClass = 'player-status all-in';
  }
  statusElement.textContent = statusText;
  statusElement.className = statusClass;
  const isMyTurn = players[currentPlayerTurn]?.socketId === socket.id;
  if (isMyTurn && !player.folded && !player.bankrupt) {
    actionIndicator.classList.add('active');
  } else {
    actionIndicator.classList.remove('active');
  }
  if (allInBtn) {
    allInBtn.textContent = `All In $${player.chips}`;
  }
  const callAmount = Math.max(0, currentBet - player.bet);
  if (callBtn) {
    callBtn.textContent = callAmount === 0 ? 'Igualar $0' : `Igualar $${callAmount}`;
  }
}

/**
 * Función principal interna: checkForSinglePlayerWin. Reacciona y ejecuta la lógica estandarizada.
 */
function checkForSinglePlayerWin() {
  const activePlayers = players.filter(p => !p.bankrupt);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    addMessage('Sistema', `¡${winner.name} es el ganador por ser el único jugador con fichas!`, 'win');
    endGame(winner);
  }
}

/**
 * Función principal interna: endGame. Reacciona y ejecuta la lógica estandarizada.
 */
function endGame(winner) {
  winnerModal.style.display = 'none';
  if (winner) {
    addMessage('Sistema', `¡${winner.name} ha ganado la partida!`, 'win');
  } else {
    addMessage('Sistema', '¡La partida ha terminado!', 'win');
  }
  gameStarted = false;
  currentBet = 0;
  potTotal = 0;
  tempBet = 0;
  blindsPosted = false;
  potTotalElement.textContent = '0';
  currentBetAmount.textContent = '0';
  roundEndBtn.style.display = 'none';
  startGameBtn.style.display = 'block';
  startGameBtn.textContent = 'Jugar Otra Partida';
  startGameBtn.disabled = false;
  startGameBtn.classList.remove('disabled');
  disableAllControls();
  addMessage('Sistema', '--- ESTADÍSTICAS FINALES ---', 'system');
  players.forEach(player => {
    const status = player.bankrupt ? ' (Bancarrota)' : player.folded ? ' (Retirado)' : '';
    addMessage('Sistema', `${player.name}: $${player.chips} fichas${status}`, 'system');
  });
  addMessage('Sistema', '----------------------------', 'system');
  console.log('🎮 Partida terminada - Estado reiniciado');
}

/**
 * Inicializa los preparativos gráficos requeridos en la interfaz cliente cuando inicia a apostar.
 */
function startBettingRound() {
  updatePlayerList();
  updateBettingControls();
  setPlayerTurn(currentPlayerTurn);
}

/**
 * Función principal interna: startReconnectSafetyTimeout. Reacciona y ejecuta la lógica estandarizada.
 */
function startReconnectSafetyTimeout() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  reconnectTimeout = setTimeout(() => {
    console.log('⏰ Timeout de seguridad: Ocultando waitingScreen');
    if (waitingScreen) {
      waitingScreen.style.display = 'none';
    }
  }, 10000);
}

/**
 * Función principal interna: clearReconnectSafetyTimeout. Reacciona y ejecuta la lógica estandarizada.
 */
function clearReconnectSafetyTimeout() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

/**
 * Función principal interna: safeGetRoundName. Reacciona y ejecuta la lógica estandarizada.
 */
function safeGetRoundName(round) {
  if (!round) {
    console.warn('⚠️  round es undefined, usando preflop por defecto');
    return 'PREFLOP';
  }
  return roundNames[round] || round.toUpperCase();
}

/**
 * Función principal interna: safeGetRoundDescription. Reacciona y ejecuta la lógica estandarizada.
 */
function safeGetRoundDescription(round) {
  if (!round) {
    return 'Primera ronda de apuestas - Cartas iniciales repartidas';
  }
  return roundDescriptions[round] || 'Ronda de apuestas';
}

/**
 * Función principal interna: debugClientState. Reacciona y ejecuta la lógica estandarizada.
 */
function debugClientState() {
  console.log('\n=== DEBUG CLIENT STATE ===');
  console.log(`Ronda: ${currentRound}`);
  console.log(`Turno actual: ${currentPlayerTurn}`);
  console.log(`Mi socket ID: ${socket.id}`);
  console.log(`Mi nombre: ${playerName}`);
  console.log(`Mi ID: ${myPlayerId}`);
  const myPlayer = getMyPlayer();
  console.log(`Mi jugador encontrado:`, myPlayer);
  if (currentPlayerTurn >= 0 && currentPlayerTurn < players.length) {
    const currentPlayer = players[currentPlayerTurn];
    console.log(`Jugador actual:`, currentPlayer);
    console.log(`¿Es mi turno? ${currentPlayer.socketId === socket.id}`);
  }
  console.log('Todos los jugadores:');
  players.forEach((player, index) => {
    console.log(`  [${index}] ${player.name} - socket:${player.socketId} - id:${player.id} - folded:${player.folded}`);
  });
  console.log('=== FIN DEBUG CLIENT ===\n');
}

/**
 * Función principal interna: setPlayerTurn. Reacciona y ejecuta la lógica estandarizada.
 */
function setPlayerTurn(playerIndex) {
  document.querySelectorAll('.player-card').forEach(card => {
    card.classList.remove('active-turn');
  });
  if (playerIndex === -1 || playerIndex >= players.length || !players[playerIndex] || isPlayerAllIn(players[playerIndex])) {
    console.log(`🏁 No hay turno activo o jugador ALL-IN - deshabilitando controles`);
    disablePlayerControls();
    return;
  }
  const currentPlayer = players[playerIndex];
  if (!currentPlayer) {
    console.log(`❌ Jugador no encontrado en índice: ${playerIndex}`);
    disablePlayerControls();
    return;
  }
  const playerCards = document.querySelectorAll('.player-card');
  if (playerCards[playerIndex]) {
    playerCards[playerIndex].classList.add('active-turn');
  }
  const isMyTurn = currentPlayer.socketId === socket.id;
  if (isMyTurn) {
    enablePlayerControls();
    if (gameStarted && currentPlayerTurn !== -1) {
      vibrateForTurn();
      if (window.isMobileDevice) {
        showMobileTurnNotification();
      }
    }
  } else {
    disablePlayerControls();
  }
}

/**
 * Función principal interna: vibrateForTurn. Reacciona y ejecuta la lógica estandarizada.
 */
function vibrateForTurn() {
  if (!window.isMobileDevice || !vibrationEnabled) return;
  if (vibrationTimeout) {
    clearTimeout(vibrationTimeout);
  }
  if ('vibrate' in navigator) {
    navigator.vibrate(300);
    console.log('📳 Vibración única activada para turno');
    vibrationEnabled = false;
    vibrationTimeout = setTimeout(() => {
      vibrationEnabled = true;
    }, 2000);
  }
}

/**
 * Función principal interna: requestNotificationPermission. Reacciona y ejecuta la lógica estandarizada.
 */
function requestNotificationPermission() {
  if (!window.isMobileDevice) return;
  if ('Notification' in window && Notification.permission === 'default') {
    const permissionButton = document.createElement('button');
    permissionButton.textContent = '🔔 Activar Notificaciones';
    permissionButton.onclick = function () {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showMobileToast('Notificaciones activadas');
        }
      });
    };
  }
}

/**
 * Función principal interna: debugGameState. Reacciona y ejecuta la lógica estandarizada.
 */
function debugGameState() {
  console.log('🐛 DEBUG DEL ESTADO ACTUAL:');
  console.log(`- Ronda: ${currentRound}`);
  console.log(`- Turno actual: ${currentPlayerTurn} (${players[currentPlayerTurn]?.name})`);
  console.log(`- RoundStarter: ${roundStarterIndex} (${players[roundStarterIndex]?.name})`);
  console.log(`- Apuesta actual: $${currentBet}`);
  console.log(`- Apuesta máxima: $${currentMaxBet}`);
  console.log(`- Bote: $${potTotal}`);
  const activePlayers = players.filter(p => !p.folded && !p.bankrupt);
  console.log(`- Jugadores activos: ${activePlayers.length}`);
  activePlayers.forEach((player, index) => {
    console.log(`  ${index + 1}. ${player.name} - $${player.chips} (apuesta: $${player.bet})`);
  });
  console.log('--- FIN DEBUG ---');
}

/**
 * Función principal interna: showMobileTurnNotification. Reacciona y ejecuta la lógica estandarizada.
 */

function showMobileTurnNotification() {
  if (!window.isMobileDevice) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('¡Es tu turno!', {
      body: 'Te toca jugar en la partida de poker',
      icon: '/favicon.ico',
      tag: 'poker-turn'
    });
  }
  showMobileToast('¡Es tu turno!');
}

/**
 * Función principal interna: showMobileToast. Reacciona y ejecuta la lógica estandarizada.
 */

function showMobileToast(message) {
  if (!window.isMobileDevice) return;
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        z-index: 10000;
        font-size: 16px;
        font-weight: bold;
        animation: fadeInOut 3s ease-in-out;
    `;
  if (!document.querySelector('#mobile-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'mobile-toast-styles';
    style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

/**
 * Función principal interna: showReconnectOption. Reacciona y ejecuta la lógica estandarizada.
 */

function showReconnectOption() {
  if (reconnectOptionShown) {
    console.log('🔄 Opción de reconexión ya mostrada');
    return;
  }
  const savedState = loadGameState();
  if (!savedState || !savedState.roomCode) {
    console.log('💾 No hay estado guardado para reconectar');
    return;
  }
  console.log('🔄 Mostrando opción de reconexión MANUAL (recarga de página)...');
  const existingReconnectSection = document.querySelector('.reconnect-section');
  if (existingReconnectSection) {
    console.log('🔄 Sección de reconexión ya existe');
    return;
  }
  const reconnectSection = document.createElement('div');
  reconnectSection.className = 'reconnect-section';
  reconnectSection.innerHTML = `
    <div style="background: rgba(241, 196, 15, 0.2); padding: 15px; border-radius: 10px; margin: 15px 0; border: 2px solid #f1c40f;">
      <h3 style="color: #f1c40f; margin-bottom: 10px;">🔄 Partida en Curso Detectada</h3>
      <p style="margin-bottom: 10px;">
        Tienes una partida en curso como <strong>${savedState.playerName}</strong> 
        en la sala <strong>${savedState.roomCode}</strong>
        ${savedState.isSpectator ? ' (como espectador)' : ''}
      </p>
      <div style="display: flex; gap: 10px; margin-bottom: 10px;">
        <button id="reconnect-btn" style="padding: 10px 20px; background: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer; flex: 1;">
          ✅ Reconectar
        </button>
        <button id="new-session-btn" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer; flex: 1;">
          🎮 Nueva Partida
        </button>
      </div>
      <p style="margin-top: 10px; font-size: 0.9em; color: #f39c12;">
        ⚡ Selecciona una opción para continuar
      </p>
    </div>
  `;
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) {
    modalContent.insertBefore(reconnectSection, modalContent.firstChild);
    reconnectOptionShown = true;
    document.getElementById('reconnect-btn').addEventListener('click', function () {
      console.log('🎯 Usuario eligió RECONECTAR manualmente');
      triggerAutoReconnect(savedState);
    });
    document.getElementById('new-session-btn').addEventListener('click', function () {
      console.log('🎯 Usuario eligió NUEVA PARTIDA');
      reconnectOptionShown = false;
      clearGameState();
      reconnectSection.remove();
      if (playerNameInput) playerNameInput.value = '';
      if (joinPlayerNameInput) joinPlayerNameInput.value = '';
      if (roomCodeInput) roomCodeInput.value = '';
      console.log('🎮 Usuario eligió nueva partida - Estado limpiado');
    });
  }
}

/**
 * Función principal interna: triggerAutoReconnect. Reacciona y ejecuta la lógica estandarizada.
 */

function triggerAutoReconnect(savedState) {
  console.log('🚀 Iniciando reconexión automática...');
  currentRoomCode = savedState.roomCode;
  myPlayerId = savedState.playerId;
  playerName = savedState.playerName;
  isSpectator = savedState.isSpectator || false;
  initialModal.style.display = 'none';
  mainGame.style.display = 'flex';
  waitingScreen.style.display = 'flex';
  waitingScreen.innerHTML = `
    <h2>🔄 Reconectando...</h2>
    <p>Conectando a la sala ${savedState.roomCode}...</p>
    <div class="players-needed">Por favor espera</div>
    <div class="loading-spinner"></div>
  `;
  const reconnectSection = document.querySelector('.reconnect-section');
  if (reconnectSection) {
    reconnectSection.remove();
  }
  if (socket.connected) {
    socket.emit('reconnect-player', {
      roomCode: savedState.roomCode,
      playerId: savedState.playerId,
      playerName: savedState.playerName
    });
  } else {
    socket.once('connect', () => {
      socket.emit('reconnect-player', {
        roomCode: savedState.roomCode,
        playerId: savedState.playerId,
        playerName: savedState.playerName
      });
    });
  }
}

/**
 * Función principal interna: leaveRoom. Reacciona y ejecuta la lógica estandarizada.
 */

function leaveRoom() {
  console.log('🚪 Saliendo de la sala...');
  fullReset();
  addMessage('Sistema', 'Has salido de la sala', 'system');
}

/**
 * Función principal interna: startConnectionMonitor. Reacciona y ejecuta la lógica estandarizada.
 */
function startConnectionMonitor() {
  setInterval(() => {
    if (socket.disconnected && currentRoomCode) {
      console.log('🔍 Verificando conexión...');
      if (!socket.connected) {
        socket.connect();
      }
    }
  }, 10000);
}

/**
 * Función principal interna: shouldAttemptAutoReconnect. Reacciona y ejecuta la lógica estandarizada.
 */
function shouldAttemptAutoReconnect() {
  if (!window.isMobileDevice) return false;
  if (!currentRoomCode || !playerName) return false;
  if (initialModal && initialModal.style.display === 'flex') return false;
  if (mainGame && mainGame.style.display !== 'flex') return false;
  return true;
}

/**
 * Función principal interna: startPersistentReconnect. Reacciona y ejecuta la lógica estandarizada.
 */
function startPersistentReconnect() {
  let reconnectAttempts = 0;
  const maxReconnectAttempts = window.isMobileDevice ? 20 : 5;
  console.log(`🔄 Iniciando reconexión persistente (${window.isMobileDevice ? 'móvil' : 'desktop'})...`);
  const reconnectInterval = setInterval(() => {
    if (socket.connected) {
      console.log('✅ Reconexión exitosa');
      clearInterval(reconnectInterval);
      if (window.isMobileDevice && currentRoomCode && playerName) {
        if (mainGame && mainGame.style.display === 'flex' && initialModal.style.display !== 'flex') {
          setTimeout(() => {
            attemptAutoReconnect();
          }, 500);
        } else {
          console.log('🔒 No reconectar automáticamente: No estamos en pantalla de juego');
        }
      }
      return;
    }
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('❌ Máximo de intentos de reconexión alcanzado');
      clearInterval(reconnectInterval);
      const message = window.isMobileDevice ? '❌ No se pudo reconectar después de múltiples intentos' : '❌ Conexión perdida. Recarga la página para reconectar';
      addMessage('Sistema', message, 'warning');
      return;
    }
    reconnectAttempts++;
    console.log(`🔄 Intento de reconexión ${reconnectAttempts}/${maxReconnectAttempts} (${window.isMobileDevice ? 'móvil' : 'desktop'})`);
    if (!socket.connected) {
      socket.connect();
    }
  }, window.isMobileDevice ? 3000 : 5000);
}

/**
 * Función principal interna: enablePlayerControls. Reacciona y ejecuta la lógica estandarizada.
 */
function enablePlayerControls() {
  const player = getMyPlayer();
  if (!player) {
    console.log('Jugador no encontrado al habilitar controles');
    disablePlayerControls();
    return;
  }
  if (player.chips === 0 && player.bet > 0) {
    console.log('💰 Jugador ALL-IN - controles deshabilitados');
    disableAllControls();
    return;
  }
  if (player.folded || player.bankrupt) {
    console.log('Jugador retirado o en bancarrota');
    disablePlayerControls();
    return;
  }
  const callAmount = Math.max(0, (currentBet || 0) - (player.bet || 0));
  foldBtn.disabled = false;
  foldBtn.classList.remove('disabled');
  if (callAmount === 0) {
    checkBtn.disabled = false;
    checkBtn.classList.remove('disabled');
    callBtn.disabled = true;
    callBtn.classList.add('disabled');
    callBtn.textContent = `Igualar $0`;
  } else {
    checkBtn.disabled = true;
    checkBtn.classList.add('disabled');
    callBtn.disabled = false;
    callBtn.classList.remove('disabled');
    callBtn.textContent = `Igualar $${callAmount}`;
  }
  const canBet = player.chips > 0;
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('disabled', !canBet);
    chip.style.pointerEvents = canBet ? 'auto' : 'none';
  });
  if (allInBtn) {
    allInBtn.classList.toggle('disabled', !canBet);
    allInBtn.style.pointerEvents = canBet ? 'auto' : 'none';
    allInBtn.style.display = canBet ? 'flex' : 'none';
    allInBtn.textContent = `All In $${player.chips}`;
  }
}

/**
 * Función principal interna: addSecurityCheck. Reacciona y ejecuta la lógica estandarizada.
 */
function addSecurityCheck() {
  const player = getMyPlayer();
  if (!player) {
    console.log('Jugador local no encontrado. myPlayerId:', myPlayerId);
    addMessage('Sistema', 'Error: jugador no encontrado', 'warning');
    return false;
  }
  if (player.chips === 0 && player.bet > 0) {
    console.log('💰 Jugador ALL-IN intentó actuar - acción bloqueada');
    addMessage('Sistema', 'No puedes actuar porque estás ALL-IN', 'warning');
    return false;
  }
  if (!gameStarted) {
    console.log('El juego no ha comenzado aún');
    addMessage('Sistema', 'El juego no ha comenzado', 'warning');
    return false;
  }
  const currentPlayer = players[currentPlayerTurn];
  if (!currentPlayer) {
    console.log('No hay jugador actual. currentPlayerTurn:', currentPlayerTurn);
    addMessage('Sistema', 'Error: no hay jugador actual', 'warning');
    return false;
  }
  console.log(`Verificando turno - Yo: ${player.name} (${player.id}), Turno actual: ${currentPlayer.name} (${currentPlayer.id})`);
  if (currentPlayer.id !== player.id) {
    console.log(`No es mi turno. Es turno de: ${currentPlayer.name}`);
    addMessage('Sistema', `No es tu turno. Es el turno de ${currentPlayer.name}`, 'warning');
    return false;
  }
  if (player.folded || player.bankrupt) {
    addMessage('Sistema', 'No puedes actuar porque estás retirado o en bancarrota', 'warning');
    return false;
  }
  console.log('�?Verificación de seguridad pasada');
  return true;
}

/**
 * Función principal interna: sendMessage. Reacciona y ejecuta la lógica estandarizada.
 */
function sendMessage() {
  const message = chatInput.value.trim();
  if (message === '' || !currentRoomCode) return;

  if (isSpectator) {
    addMessage(playerName + ' (Espectador)', message, '');
    socket.emit('send-message', {
      roomCode: currentRoomCode,
      message: message,
      isSpectator: true,
      playerName: playerName
    });
  } else {
    if (playerMessageCount >= maxMessages) {
      addMessage('Sistema', 'Has alcanzado el límite de mensajes', 'warning');
      return;
    }

    socket.emit('send-message', {
      roomCode: currentRoomCode,
      message: message,
      playerName: playerName
    });

    addMessage('Tú', message, '');
    playerMessageCount++;
    updateMessageCounters();
  }

  chatInput.value = '';
  updateCharCount();
  scrollToBottom();
}

/**
 * Función principal interna: addToTempBet. Reacciona y ejecuta la lógica estandarizada.
 */
function addToTempBet(amount) {
  const player = getMyPlayer();
  if (!player) {
    console.log('❌ Jugador no encontrado en addToTempBet');
    return;
  }
  const newTempBet = tempBet + amount;
  console.log(`💰 addToTempBet - Nuevo: $${newTempBet}, Chips disponibles: $${player.chips}`);
  if (newTempBet > player.chips) {
    addMessage('Sistema', `No tienes suficientes fichas. Disponibles: $${player.chips}`, 'warning');
    return;
  }
  tempBet = newTempBet;
  tempBetValue.textContent = tempBet;
  tempBetDisplay.style.display = 'block';
  validateBet();
  console.log(`✅ Acumulando apuesta: $${tempBet}`);
}

/**
 * Función principal interna: validateBet. Reacciona y ejecuta la lógica estandarizada.
 */
function validateBet() {
  const player = getMyPlayer();
  if (!player) {
    console.log('❌ Jugador no encontrado en validateBet');
    return;
  }
  const totalBetAfter = player.bet + tempBet;
  const amountToCall = Math.max(0, currentBet - player.bet);
  console.log(`🎯 VALIDAR APUESTA - Temp: $${tempBet}, PlayerBet: $${player.bet}, TotalAfter: $${totalBetAfter}, CurrentBet: $${currentBet}, ToCall: $${amountToCall}`);
  confirmBetBtn.disabled = false;
  confirmBetBtn.classList.remove('disabled');
  if (tempBet >= player.chips) {
    confirmBetBtn.textContent = `All In $${player.chips}`;
    return;
  }
  if (totalBetAfter === currentBet) {
    confirmBetBtn.textContent = `Igualar $${tempBet}`;
    return;
  }
  if (totalBetAfter > currentBet) {
    const raiseAmount = totalBetAfter - currentBet;
    confirmBetBtn.textContent = `Subir $${raiseAmount}`;
    return;
  }
  if (tempBet > 0 && totalBetAfter < currentBet) {
    const remaining = amountToCall - tempBet;
    confirmBetBtn.disabled = true;
    confirmBetBtn.classList.add('disabled');
    confirmBetBtn.textContent = `Falta $${remaining}`;
    return;
  }
  confirmBetBtn.textContent = tempBet > 0 ? `Apostar $${tempBet}` : 'Apostar';
}

/**
 * Función principal interna: convertToPlayerAuto. Reacciona y ejecuta la lógica estandarizada.
 */
function convertToPlayerAuto() {
  console.log('🔄 Intentando conversión a jugador...');
  reconnectOptionShown = true;
  const reconnectSection = document.querySelector('.reconnect-section');
  if (reconnectSection) {
    reconnectSection.remove();
  }
  const playerNameElement = document.getElementById('join-player-name') || document.getElementById('player-name');
  let playerNameValue = '';
  if (playerNameElement) {
    playerNameValue = String(playerNameElement.value).trim();
  }
  if (!playerNameValue && playerName) {
    playerNameValue = playerName;
  }
  console.log('🔍 DEBUG convertToPlayerAuto - playerName:', playerNameValue);
  if (!playerNameValue) {
    console.error('❌ No se pudo obtener el nombre del jugador');
    return;
  }
  socket.off('reconnect-success');
  socket.off('reconnect-failed');
  socket.emit('convert-to-player', {
    roomCode: currentRoomCode,
    playerName: playerNameValue
  });
}

/**
 * Función principal interna: confirmBet. Reacciona y ejecuta la lógica estandarizada.
 */
function confirmBet() {
  const player = getMyPlayer();
  if (!player) {
    console.log('❌ Jugador no encontrado en confirmBet');
    return;
  }
  const totalBetAfter = player.bet + tempBet;
  const amountToCall = Math.max(0, currentBet - player.bet);
  console.log(`💵 CONFIRMAR APUESTA - Temp: $${tempBet}, PlayerBet: $${player.bet}, TotalAfter: $${totalBetAfter}, CurrentBet: $${currentBet}, ToCall: $${amountToCall}, Chips: $${player.chips}`);
  if (tempBet > 0 && totalBetAfter < currentBet) {
    const remaining = currentBet - totalBetAfter;
    addMessage('Sistema', `Debes apostar al menos $${remaining} más para igualar`, 'warning');
    return;
  }
  if (tempBet > player.chips) {
    addMessage('Sistema', 'No tienes suficientes fichas para esa apuesta', 'warning');
    return;
  }
  console.log(`✅ Apuesta CONFIRMADA: $${tempBet}`);
  socket.emit('player-action', {
    roomCode: currentRoomCode,
    action: 'bet',
    amount: tempBet,
    playerId: socket.id
  });
  tempBet = 0;
  tempBetDisplay.style.display = 'none';
  tempBetValue.textContent = '0';
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.remove('selected');
  });
  disablePlayerControls();
  console.log('📤 Acción de apuesta enviada al servidor');
}

/**
 * Función principal interna: cancelBet. Reacciona y ejecuta la lógica estandarizada.
 */
function cancelBet() {
  console.log('Cancelando apuesta temporal');
  tempBet = 0;
  tempBetDisplay.style.display = 'none';
  tempBetValue.textContent = '0';
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.remove('selected');
    chip.classList.remove('pulse');
  });
  confirmBetBtn.textContent = 'Apostar';
  validateBet();
}

/**
 * Opción de la partida: El jugador empeña su reserva total de fichas en un movimiento riesgoso.
 */
function allIn() {
  if (!addSecurityCheck()) return;
  const player = getMyPlayer();
  const allInAmount = player.chips;
  console.log(`Intentando All In - Fichas: $${allInAmount}, Apuesta actual: $${currentBet}, Mi apuesta: $${player.bet}`);
  if (allInAmount <= 0) {
    addMessage('Sistema', 'No tienes fichas para hacer All In', 'warning');
    return;
  }
  player.chips = 0;
  player.bet += allInAmount;
  potTotal += allInAmount;
  if (player.bet > currentBet) {
    currentBet = player.bet;
  }
  updatePlayerInfo();
  potTotalElement.textContent = potTotal;
  currentBetAmount.textContent = currentBet;
  updatePlayerList();
  socket.emit('player-action', {
    roomCode: currentRoomCode,
    action: 'all-in',
    amount: allInAmount,
    playerId: player.id
  });
  disablePlayerControls();
  console.log(`All In realizado: $${allInAmount}`);
}

/**
 * Opción de la partida: El jugador se retira y descarta sus cartas de la mano actual.
 */
function fold() {
  const player = getMyPlayer();
  if (!player) {
    console.log('�?Jugador no encontrado');
    return;
  }
  if (player.bankrupt) {
    console.log('�?Jugador en bancarrota');
    return;
  }
  if (players[currentPlayerTurn]?.socketId !== socket.id) {
    console.log('�?No es tu turno');
    return;
  }
  console.log(`🃏 Jugador se retira`);
  socket.emit('player-action', {
    roomCode: currentRoomCode,
    action: 'fold',
    playerId: socket.id
  });
  disablePlayerControls();
  console.log(`�?Acción de retiro enviada al servidor`);
}

/**
 * Opción de la partida: El jugador cede el turno sin emitir fichas porque nadie ha subido la apuesta.
 */
function check() {
  const player = getMyPlayer();
  if (!player) {
    console.log('�?Jugador no encontrado');
    return;
  }
  if (player.folded || player.bankrupt) {
    console.log('�?Jugador retirado o en bancarrota, no puede actuar');
    return;
  }
  if (currentBet > player.bet) {
    addMessage('Sistema', 'No puedes pasar cuando hay una apuesta pendiente', 'warning');
    return;
  }
  console.log(`�?Jugador pasa`);
  socket.emit('player-action', {
    roomCode: currentRoomCode,
    action: 'check',
    playerId: socket.id
  });
  disablePlayerControls();
  console.log(`�?Acción de check enviada al servidor`);
}

/**
 * Opción de la partida: El jugador iguala la apuesta máxima de la ronda para mantenerse en juego.
 */
function call() {
  const player = getMyPlayer();
  if (!player) {
    console.log('�?Jugador no encontrado');
    return;
  }
  const callAmount = currentBet - player.bet;
  if (callAmount === 0) {
    console.log('🔄 No hay nada que igualar, haciendo check');
    check();
    return;
  }
  if (player.chips < callAmount) {
    console.log('🔄 No hay suficientes fichas para igualar, haciendo All In');
    allIn();
    return;
  }
  if (player.folded || player.bankrupt) {
    console.log('�?Jugador retirado o en bancarrota, no puede actuar');
    return;
  }
  socket.emit('player-action', {
    roomCode: currentRoomCode,
    action: 'call',
    amount: callAmount,
    playerId: socket.id
  });
  disablePlayerControls();
}

/**
 * Función principal interna: verifyDOMElements. Reacciona y ejecuta la lógica estandarizada.
 */
function verifyDOMElements() {
  const criticalElements = ['start-game-btn', 'round-end-btn', 'chips-container', 'fold-btn', 'check-btn', 'call-btn', 'player-list', 'chat-messages', 'chat-input', 'send-message'];
  criticalElements.forEach(id => {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`⚠️ Elemento DOM no encontrado: ${id}`);
    }
  });
}

/**
 * Función principal interna: endRound. Reacciona y ejecuta la lógica estandarizada.
 */
function endRound() {
  if (!verifyHostPermission('terminar la ronda')) return;
  socket.emit('system-message', {
    roomCode: currentRoomCode,
    message: 'La mano ha terminado. Seleccionando ganador...',
    type: 'system'
  });
  currentRound = 'preflop';
  currentMaxBet = 0;
  showWinnerSelection();
}

/**
 * Función principal interna: debugHostState. Reacciona y ejecuta la lógica estandarizada.
 */

function debugHostState() {
  const myPlayer = players.find(p => p.socketId === socket.id);
  console.log('🔍 DEBUG Host State:', {
    isHost: isHost,
    myPlayer: myPlayer ? {
      name: myPlayer.name,
      isHost: myPlayer.isHost,
      socketId: myPlayer.socketId
    } : 'no encontrado',
    players: players.map(p => ({
      name: p.name,
      isHost: p.isHost,
      socketId: p.socketId
    }))
  });
}

/**
 * Función principal interna: showWinnerSelection. Reacciona y ejecuta la lógica estandarizada.
 */
function showWinnerSelection(potAmount, playersList = null) {
  if (!verifyHostPermission('seleccionar ganador')) return;
  if (!isHost) {
    console.log('⛔ Intento de mostrar selección de ganador por no-host');
    return;
  }
  const sidePotInfo = document.createElement('div');
  sidePotInfo.id = 'side-pot-info';
  sidePotInfo.style.marginTop = '15px';
  winnerModal.querySelector('.modal-content').insertBefore(sidePotInfo, winnerOptions);
  console.log('🔍 DEBUG showWinnerSelection - INICIO');
  const playersToUse = playersList || players;
  const activePlayers = playersToUse.filter(player => {
    if (!player || typeof player !== 'object') return false;
    const isExcluded = player.isSpectator === true || player.bankrupt === true || player.folded === true || player.chips === undefined || player.name === undefined || player.chips === 0 && player.bet === 0;
    if (isExcluded) {
      console.log(`🚫 EXCLUIDO: ${player.name || 'sin nombre'}`, {
        isSpectator: player.isSpectator,
        bankrupt: player.bankrupt,
        folded: player.folded,
        chips: player.chips,
        bet: player.bet
      });
      return false;
    }
    console.log(`✅ INCLUIDO: ${player.name}`, {
      chips: player.chips,
      bet: player.bet
    });
    return true;
  });
  console.log('🎯 Jugadores activos después del filtro:', activePlayers.map(p => p.name));
  if (activePlayers.length === 0) {
    console.log('❌ No hay jugadores activos después del filtro');
    addMessage('Sistema', '⛔ Error: No hay jugadores activos para seleccionar ganador', 'warning');
    return;
  }
  document.getElementById('pot-to-win').textContent = `$${potAmount}`;
  winnerOptions.innerHTML = '';
  selectedWinner = null;
  activePlayers.forEach(player => {
    if (player.isSpectator || player.bankrupt || player.folded) {
      console.log(`🚫 ELIMINADO EN RENDER: ${player.name} - no debería estar aquí`);
      return;
    }
    const option = document.createElement('div');
    option.className = 'winner-option';
    option.id = `winner-option-${player.id}`;
    const statusText = player.chips === 0 ? ' (All-In)' : player.disconnected ? ' (Desconectado)' : '';
    option.innerHTML = `
      <input type="checkbox" id="winner-${player.id}" data-player-id="${player.id}" data-player-name="${player.name}">
      <div class="winner-info">
        <div class="player-name">
          ${player.name}${statusText}
        </div>
        <div class="player-stats">
          Fichas: $${player.chips} | Apuesta: $${player.bet}
        </div>
        <div class="split-pot-info" id="split-${player.id}"></div>
      </div>
    `;
    const checkbox = option.querySelector('input[type="checkbox"]');
    option.addEventListener('click', e => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        option.classList.toggle('selected', checkbox.checked);
        updateSplitPotInfo(potAmount);
      }
    });
    checkbox.addEventListener('change', e => {
      option.classList.toggle('selected', e.target.checked);
      updateSplitPotInfo(potAmount);
      e.stopPropagation();
    });
    winnerOptions.appendChild(option);
  });
  winnerModal.style.display = 'flex';
  addMessage('Sistema', '🏆 Selecciona el/los ganador(es) de esta ronda', 'system');
  console.log('🔍 DEBUG showWinnerSelection - FIN');
}

/**
 * Función principal interna: updateSplitPotInfo. Reacciona y ejecuta la lógica estandarizada.
 */
function updateSplitPotInfo(potAmount) {
  document.querySelectorAll('.split-pot-info').forEach(div => {
    div.innerHTML = 'Recibirá: $0';
  });

  const selectedCheckboxes = document.querySelectorAll('.winner-option input[type="checkbox"]:checked');
  const numWinners = selectedCheckboxes.length;
  if (numWinners > 0) {
    const splitAmount = Math.floor(potAmount / numWinners);
    const remainder = potAmount % numWinners;
    selectedCheckboxes.forEach((checkbox, index) => {
      const splitInfo = document.getElementById(`split-${checkbox.dataset.playerId}`);
      if (splitInfo) {
        const playerAmount = splitAmount + (index === 0 ? remainder : 0);
        splitInfo.textContent = `Recibirá: $${playerAmount}`;
        const player = players.find(p => p.id === checkbox.dataset.playerId);
        if (player) {
          const playerBet = player.bet || 0;
          splitInfo.innerHTML += `<br><small>Apuesta: $${playerBet} | Máx a ganar: $${playerBet * numWinners}</small>`;
        }
      }
    });
  }
  const sidePotInfo = document.getElementById('side-pot-info');
  if (sidePotInfo) {
    if (numWinners > 1) {
      sidePotInfo.innerHTML = `
        <div style="margin-top: 10px; padding: 10px; background: rgba(52, 152, 219, 0.2); border-radius: 5px;">
          <strong>🎯 Sistema de Side Pots Activado</strong>
          <div style="font-size: 0.9em; margin-top: 5px;">
            Cada jugador solo puede ganar hasta su apuesta en cada bote lateral.
            Los jugadores con all-in ganan proporcionalmente a su contribución.
          </div>
        </div>
      `;
    } else {
      sidePotInfo.innerHTML = '';
    }
  }
  const confirmBtn = document.getElementById('confirm-winner');
  if (confirmBtn) {
    confirmBtn.disabled = numWinners === 0;
  }
}

/**
 * Función principal interna: confirmWinner. Reacciona y ejecuta la lógica estandarizada.
 */
function confirmWinner() {
  const selectedCheckboxes = document.querySelectorAll('.winner-option input[type="checkbox"]:checked');
  if (selectedCheckboxes.length === 0) {
    addMessage('Sistema', '⛔ Debes seleccionar al menos un ganador', 'warning');
    return;
  }
  const winners = Array.from(selectedCheckboxes).map(checkbox => {
    return {
      id: checkbox.dataset.playerId,
      name: checkbox.dataset.playerName
    };
  });
  console.log('🔍 Ganadores seleccionados:', winners);
  const invalidWinners = winners.filter(winner => {
    const player = players.find(p => p.id === winner.id);
    if (!player) {
      console.log(`❌ Ganador no encontrado: ${winner.name}`);
      return true;
    }
    if (player.isSpectator) {
      console.log(`❌ Ganador inválido: ${winner.name} es espectador`);
      return true;
    }
    if (player.bankrupt) {
      console.log(`❌ Ganador inválido: ${winner.name} está en bancarrota`);
      return true;
    }
    if (player.folded) {
      console.log(`❌ Ganador inválido: ${winner.name} se retiró`);
      return true;
    }
    return false;
  });
  if (invalidWinners.length > 0) {
    const invalidNames = invalidWinners.map(w => w.name).join(', ');
    addMessage('Sistema', `⛔ Error: Los siguientes jugadores no pueden ganar: ${invalidNames}`, 'warning');
    return;
  }
  const winnerIds = winners.map(w => w.id);
  const confirmMessage = winners.length === 1 ? `¿Confirmas que ${winners[0].name} gana el bote de $${potTotal}?` : `¿Confirmas dividir el bote de $${potTotal} entre ${winners.length} jugadores?`;
  if (!confirm(confirmMessage)) {
    addMessage('Sistema', 'Confirmación cancelada por el usuario', 'warning');
    return;
  }
  socket.emit('winner-selected', {
    roomCode: currentRoomCode,
    winnerIds: winnerIds,
    potAmount: potTotal
  });
  winnerModal.style.display = 'none';
  console.log('✅ Ganadores confirmados:', winners.map(w => w.name));
}

/**
 * Función principal interna: updateHostControls. Reacciona y ejecuta la lógica estandarizada.
 */
function updateHostControls() {
  console.log(`🔄 Actualizando controles de host - isHost: ${isHost}, gameStarted: ${gameStarted}`);
  if (!startGameBtn || !roundEndBtn) {
    console.warn('⚠️ Elementos de controles de host no encontrados');
    return;
  }
  if (isHost) {
    if (gameStarted) {
      if (startGameBtn) startGameBtn.style.display = 'none';
      if (roundEndBtn) roundEndBtn.style.display = 'block';
    } else {
      if (startGameBtn) startGameBtn.style.display = 'block';
      if (roundEndBtn) roundEndBtn.style.display = 'none';
    }
  } else {
    if (startGameBtn) startGameBtn.style.display = 'none';
    if (roundEndBtn) roundEndBtn.style.display = 'none';
  }
}

/**
 * Función principal interna: updatePlayerList. Reacciona y ejecuta la lógica estandarizada.
 */
function updatePlayerList() {
  if (!playerList) return;
  if (shuffleBtn) {
    shuffleBtn.style.display = (isHost && !gameStarted) ? 'block' : 'none';
  }
  playerList.classList.remove('count-4');
  const numPlayers = players.length;
  if (numPlayers == 4) {
    playerList.classList.add(`count-${numPlayers}`);
  }
  playerList.innerHTML = '';
  players.forEach((player, index) => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    if (player.folded && !player.bankrupt && !player.isSpectator) {
      playerCard.classList.add('folded');
    }
    if (player.bankrupt && !player.isSpectator) {
      playerCard.classList.add('bankrupt');
    }
    if (player.isSpectator) {
      playerCard.classList.add('spectator');
    }
    if (!player.isSpectator) {
      console.log(`   Jugador ${index}: ${player.name} - Verificando roles...`);
      if (index === currentDealerIndex) {
        playerCard.classList.add('dealer');
        console.log(`     🃏 ${player.name} es DEALER`);
      }
      if (index === currentSmallBlindIndex) {
        playerCard.classList.add('small-blind');
        console.log(`     💰 ${player.name} es SMALL BLIND`);
      }
      if (index === currentBigBlindIndex) {
        playerCard.classList.add('big-blind');
        console.log(`     💰💰 ${player.name} es BIG BLIND`);
      }
      if (index === currentPlayerTurn) {
        playerCard.classList.add('active-turn');
        console.log(`     ▶️ ${player.name} tiene el TURNO`);
      }
    }
    let roleIndicator = '';
    let statusIndicators = '';
    if (!player.isSpectator) {
      if (index === currentDealerIndex) roleIndicator = ' 🃏';
      if (player.isHost) statusIndicators += ' 👑';
      if (index === currentSmallBlindIndex) roleIndicator = ' 💰SB';
      if (index === currentBigBlindIndex) roleIndicator = ' 💰💰BB';
      if (player.folded) statusIndicators += ' 🚫';
      if (player.bankrupt) statusIndicators += ' 💀';
      if (player.chips === 0 && !player.bankrupt) statusIndicators += ' 💸';
    }
    const betInfo = !player.isSpectator ? `<div style="font-size: 0.9em; color: #f39c12; margin-top: 5px;">
           Apuesta: $${player.bet}
         </div>` : '';
    let kickButton = '';
    if (isHost && !isSpectator && player.socketId !== socket.id && !player.isHost) {
      kickButton = `
        <button class="kick-btn" data-player-id="${player.socketId}" 
                style="margin-top: 5px; padding: 5px 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
          Expulsar
        </button>
      `;
    }
    playerCard.innerHTML = `
      <div class="player-name">${player.name}${roleIndicator}${statusIndicators}</div>
      <div class="player-stack">$${player.chips}</div>
      ${betInfo}
      ${kickButton}
    `;
    playerList.appendChild(playerCard);
  });
  document.querySelectorAll('.kick-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const playerId = this.getAttribute('data-player-id');
      const playerName = players.find(p => p.socketId === playerId)?.name;
      if (confirm(`¿Estás seguro de que quieres expulsar a ${playerName}?`)) {
        socket.emit('kick-player', {
          roomCode: currentRoomCode,
          playerId: playerId
        });
      }
    });
  });
}

/**
 * Función principal interna: updateRoundDisplay. Reacciona y ejecuta la lógica estandarizada.
 */
function updateRoundDisplay() {
  let roundDisplay = document.getElementById('current-round-display');
  if (!roundDisplay) {
    roundDisplay = document.createElement('div');
    roundDisplay.id = 'current-round-display';
    roundDisplay.className = 'current-round';
    const playerInfo = document.querySelector('.player-info');
    if (playerInfo && playerInfo.parentNode) {
      playerInfo.parentNode.insertBefore(roundDisplay, playerInfo.nextSibling);
    }
  }
  const roundName = safeGetRoundName(currentRound);
  const roundDesc = safeGetRoundDescription(currentRound);
  const turnInfo = currentPlayerTurn !== -1 && players[currentPlayerTurn] ? players[currentPlayerTurn].name : '';
  roundDisplay.innerHTML = `
			<div class="round-name">RONDA: ${roundName}</div>
			<div class="round-desc">${roundDesc}</div>
			${turnInfo ? `<div class="turn-info">Turno: ${turnInfo}</div>` : ''}
		`;
}
document.querySelectorAll('.kick-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const playerId = this.getAttribute('data-player-id');
    const playerName = players.find(p => p.socketId === playerId)?.name;
    if (confirm(`¿Estás seguro de que quieres expulsar a ${playerName}?`)) {
      socket.emit('kick-player', {
        roomCode: currentRoomCode,
        playerId: playerId
      });
    }
  });
});

/**
 * Subsistema de UI para agregar notificaciones de eventos en la caja de mensajería in-game.
 */
function addMessage(sender, content, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  const now = new Date();
  const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  messageDiv.innerHTML = `
    <div class="message-header">
      <span>${sender}</span>
      <span>${timeString}</span>
    </div>
    <div class="message-content">${content}</div>
  `;
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
  const maxMessages = 100;
  const messages = chatMessages.querySelectorAll('.message');
  if (messages.length > maxMessages) {
    for (let i = 0; i < messages.length - maxMessages; i++) {
      chatMessages.removeChild(messages[i]);
    }
  }
  if (sender === 'Tú') {
    playerMessageCount++;
    updateMessageCounters();
    if (playerMessageCount >= maxMessages) {
      chatInput.disabled = true;
      chatInput.placeholder = 'Límite de mensajes alcanzado';
      sendMessageButton.disabled = true;
      charCount.textContent = '0/20 (Límite alcanzado)';
      charCount.classList.add('warning');
    }
  }
}
/**
 * Función principal interna: scrollToBottom. Reacciona y ejecuta la lógica estandarizada.
 */

function scrollToBottom() {
  setTimeout(() => {
    chatMessages.scrollTo({
      top: chatMessages.scrollHeight,
      behavior: 'smooth'
    });
  }, 50);
}

/**
 * Función principal interna: updateMessageCounters. Reacciona y ejecuta la lógica estandarizada.
 */
function updateMessageCounters() {
  if (messageCountDisplay) {
    messageCountDisplay.textContent = playerMessageCount;
  }
}

/**
 * Función principal interna: updateCharCount. Reacciona y ejecuta la lógica estandarizada.
 */
function updateCharCount() {
  const length = chatInput.value.length;
  charCount.textContent = `${length}/20`;
  if (length > 15) {
    charCount.classList.add('warning');
  } else {
    charCount.classList.remove('warning');
  }
}

/**
 * Habilita o deshabilita la zona de acciones (Fold, Check, Call, All In) según el estado o turno visual.
 */
function updateBettingControls() {
  const player = getMyPlayer();
  if (!player || isSpectator) {
    disableAllControls();
    return;
  }
  if (!gameStarted || player.folded || player.bankrupt || currentPlayerTurn === -1) {
    disablePlayerControls();
    return;
  }
  if (isPlayerAllIn(player)) {
    console.log('💰 Jugador ALL-IN - controles deshabilitados permanentemente');
    disableAllControls();
    const statusElement = document.getElementById('player-status');
    if (statusElement) {
      statusElement.textContent = 'ALL IN';
      statusElement.className = 'player-status all-in';
    }
    return;
  }
  const canBet = player.chips > 0;
  document.querySelectorAll('.chip').forEach(chip => {
    const chipValue = parseInt(chip.getAttribute('data-value'));
    const shouldDisable = !canBet || chipValue > player.chips;
    chip.classList.toggle('disabled', shouldDisable);
    chip.style.pointerEvents = shouldDisable ? 'none' : 'auto';
    console.log(`💰 Ficha $${chipValue} - Disabled: ${shouldDisable}`);
  });
  if (player.chips === 0 && player.bet > 0) {
    console.log('💰 Jugador ALL-IN - controles deshabilitados');
    disableAllControls();
    const statusElement = document.getElementById('player-status');
    if (statusElement) {
      statusElement.textContent = 'ALL IN';
      statusElement.className = 'player-status all-in';
    }
    return;
  }
  const isMyTurn = players[currentPlayerTurn]?.socketId === socket.id;
  console.log(`🎮 Verificando controles - Mi turno: ${isMyTurn}, Jugador actual: ${players[currentPlayerTurn]?.name}, Yo: ${player.name}`);
  if (currentPlayerTurn === -1 || !players[currentPlayerTurn]) {
    console.log('🏁 No hay turno activo - deshabilitando controles');
    disablePlayerControls();
    return;
  }
  if (isMyTurn) {
    console.log(`🎮 Mi turno - Chips: $${player.chips}, Apuesta actual: $${currentBet}, Mi apuesta: $${player.bet}`);
    const amountToCall = Math.max(0, currentBet - player.bet);
    if (player.chips === 0) {
      disableAllControls();
      foldBtn.disabled = true;
      checkBtn.classList.remove('disabled');
      console.log('💰 All-in: Solo puedo pasar');
      return;
    }
    foldBtn.disabled = false;
    foldBtn.classList.remove('disabled');
    const effectiveCallAmount = Math.min(amountToCall, player.chips);
    if (amountToCall === 0) {
      checkBtn.disabled = false;
      checkBtn.classList.remove('disabled');
      callBtn.disabled = true;
      callBtn.classList.add('disabled');
    } else {
      checkBtn.disabled = true;
      checkBtn.classList.add('disabled');
      callBtn.disabled = false;
      callBtn.classList.remove('disabled');
      callBtn.textContent = `Igualar $${effectiveCallAmount}`;
    }
    const canBet = player.chips > 0;
    document.querySelectorAll('.chip').forEach(chip => {
      const chipValue = parseInt(chip.getAttribute('data-value'));
      const shouldDisable = !canBet || chipValue > player.chips;
      chip.classList.toggle('disabled', shouldDisable);
      chip.style.pointerEvents = shouldDisable ? 'none' : 'auto';
    });
    if (player.chips > 0) {
      allInBtn.style.display = 'flex';
      allInBtn.classList.remove('disabled');
      allInBtn.style.pointerEvents = 'auto';
      allInBtn.textContent = `All In $${player.chips}`;
    } else {
      allInBtn.style.display = 'none';
    }
  } else {
    disablePlayerControls();
  }
}
updateCharCount();