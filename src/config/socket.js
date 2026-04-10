const socketIo = require('socket.io');
let ioInstance;

/**
 * Función principal interna: initSockets. Reacciona y ejecuta la lógica estandarizada.
 */
const initSockets = server => {
  ioInstance = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  const setupConnection = require('../sockets/connection');
  setupConnection(ioInstance);
  return ioInstance;
};

/**
 * Función principal interna: getIO. Reacciona y ejecuta la lógica estandarizada.
 */
const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io no ha sido inicializado!');
  }
  return ioInstance;
};
module.exports = {
  initSockets,
  getIO
};