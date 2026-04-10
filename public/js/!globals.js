let players = [];
let myPlayerId = '';
let currentPlayerIndex = 0;
let currentBet = 0;
let potTotal = 0;
let gameStarted = false;
let currentPlayerTurn = 0;
let playerChips = 1500;
let playerBet = 0;
let playerMessageCount = 0;
let smallBlind = 10;
let bigBlind = 20;
let dealerPosition = 0;
let currentPhase = 'preflop';
let selectedWinner = null;
let currentRoomCode = '';
let isHost = false;
let maxMessages = 3;
let playerName = '';
let tempBet = 0;
let blindsPosted = false;
let isSpectator = false;
let reconnectOptionShown = false;
let currentMaxBet = 0;
let isPageReloaded = true;
let currentSmallBlindIndex = -1;
let currentBigBlindIndex = -1;
let currentDealerIndex = -1;
let currentRound = 'preflop';
let transitionCountdown = 0;
let nextRoundName = '';
let roundStarterIndex = 0;
let currentRoundComplete = false;
let activePlayersCount = 0;
let reconnectTimeout = null;
let vibrationEnabled = true;
let vibrationTimeout = null;
window.isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const roundNames = {
  preflop: 'PREFLOP',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER'
};
const roundDescriptions = {
  preflop: 'Primera ronda de apuestas - Cartas iniciales repartidas',
  flop: 'Se revelan 3 cartas comunitarias - Segunda ronda de apuestas',
  turn: 'Se revela la 4ta carta comunitaria - Tercera ronda de apuestas',
  river: 'Se revela la 5ta carta comunitaria - Ronda final de apuestas'
};