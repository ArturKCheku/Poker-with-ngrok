document.head.appendChild(sidePotStyles);
document.head.appendChild(pokerStyles);
document.head.appendChild(style);
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
startGameBtn.addEventListener('click', startGame);
sendMessageButton.addEventListener('click', sendMessage);
leaveRoomBtn.addEventListener('click', leaveRoom);
cancelWinnerBtn.addEventListener('click', cancelWinnerSelection);
startGameBtn.addEventListener('click', startGame);
document.addEventListener('DOMContentLoaded', function () {
  if (window.isMobileDevice && 'Notification' in window && Notification.permission === 'default') {
    console.log('📱 Permiso de notificaciones disponible para solicitar');
  }
});
document.addEventListener('DOMContentLoaded', function () {
  console.log('🎮 Inicializando Poker Multijugador...');
  isPageReloaded = true;
  cleanupOldGameState();
  startConnectionMonitor();
  if (isPageReloaded && !reconnectOptionShown) {
    if (initializeGameState()) {
      showReconnectOption();
    }
  }
  verifyDOMElements();
});
document.addEventListener('visibilitychange', function () {
  if (!window.isMobileDevice) return;
  if (!document.hidden && socket.connected && shouldAttemptAutoReconnect()) {
    console.log('👀 Pestaña vuelta a ser visible en móvil - Verificando estado...');
    setTimeout(() => {
      if (socket.connected && shouldAttemptAutoReconnect()) {
        console.log('📱 Reconexión automática por visibilidad en móvil');
        attemptAutoReconnect();
      }
    }, 1000);
  }
});
window.addEventListener('pagehide', function () {
  console.log('📄 Página oculta - Guardando estado...');
  saveGameState();
});
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    console.log('👁️ Pestaña oculta - Guardando estado...');
    saveGameState();
  }
});
closeRoundModal.addEventListener('click', function () {
  roundModal.style.display = 'none';
  setTimeout(() => {
    updateBettingControls();
    if (currentPlayerTurn !== -1) {
      setPlayerTurn(currentPlayerTurn);
    }
  }, 100);
});
closeRoundModal.addEventListener('click', function () {
  roundModal.style.display = 'none';
  updateBettingControls();
});
if (roundEndBtn) {
  roundEndBtn.addEventListener('click', endRound);
} else {
  console.error('�?roundEndBtn no encontrado en el DOM');
}
if (sendMessageButton) {
  sendMessageButton.addEventListener('click', sendMessage);
} else {
  console.error("❌ ERROR: No encontré el elemento con ID 'send-message'");
}
window.addEventListener('error', function (event) {
  console.error('�?Error global:', event.error);
  addMessage('Sistema', '�?Error en la aplicación. Revisa la consola.', 'warning');
});
if (typeof io === 'undefined') {
  console.error('�?Socket.IO no está cargado');
  alert('Error: Socket.IO no está cargado. Recarga la página.');
} else {
  console.log('�?Socket.IO cargado correctamente');
}
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && winnerModal.style.display === 'flex') {
    cancelWinnerSelection();
  }
});
closeRoundModal.addEventListener('click', () => {
  roundModal.style.display = 'none';
});
winnerModal.addEventListener('click', function (event) {
  if (event.target === winnerModal) {
    cancelWinnerSelection();
  }
});
chatInput.addEventListener('keyup', function (event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
});
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && winnerModal.style.display === 'flex') {
    winnerModal.style.display = 'none';
    addMessage('Sistema', 'Modal cerrado con ESC', 'warning');
  }
});
winnerModal.addEventListener('click', function (event) {
  if (event.target === winnerModal) {
    winnerModal.style.display = 'none';
    addMessage('Sistema', 'Modal cerrado haciendo clic fuera', 'warning');
  }
});
chatInput.addEventListener('input', updateCharCount);
allInBtn.addEventListener('click', allIn);
foldBtn.addEventListener('click', fold);
checkBtn.addEventListener('click', check);
callBtn.addEventListener('click', call);
confirmWinnerBtn.addEventListener('click', confirmWinner);
confirmBetBtn.addEventListener('click', confirmBet);
cancelBetBtn.addEventListener('click', cancelBet);
setInterval(() => {
  if (currentRoomCode && gameStarted) {
    saveGameState();
  }
}, 30000);
if (document.getElementById('close-round-modal')) {
  document.getElementById('close-round-modal').addEventListener('click', function () {
    roundModal.style.display = 'none';
    updateBettingControls();
  });
}
if (shuffleBtn) {
  shuffleBtn.addEventListener('click', () => {
    console.log("🎲 Solicitando mezcla de jugadores...");
    socket.emit('shuffle-players', { roomCode: currentRoomCode });
  });
}