// ==========================================
// MANEJO DE CONEXIONES Y DESCONEXIONES
// ==========================================

const { registerActions } = require('./actions');

const setupConnection = (io) => {
  io.on('connection', (socket) => {
    console.log('👤 Usuario conectado:', socket.id);

    // Registra todas las acciones y eventos custom
    registerActions(io, socket);

    // Nota: El evento 'disconnect' se gestiona ahora dentro de actions.js
    // por la magnitud de la lógica referente al abandono de sala y reconexión.
  });
};

module.exports = setupConnection;
