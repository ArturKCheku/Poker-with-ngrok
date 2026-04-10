const rooms = new Map();
const reconnectTimers = new Map();
const roundPlayerActions = new Map();
const playerTimeouts = new Map();
module.exports = {
  rooms,
  reconnectTimers,
  roundPlayerActions,
  playerTimeouts
};