const express = require('express');
const http = require('http');
const { initSockets } = require('./config/socket');
const { rooms } = require('./game/state');
const path = require('path');
const os = require('os');
const app = express();
const server = http.createServer(app);

initSockets(server);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const table = require('./game/table');


async function getNgrokUrl() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.tunnels[0]?.public_url || null);
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const localIP = table.getNetworkIP();

server.listen(PORT, HOST, async () => {
  const ngrokUrl = await new Promise(r => setTimeout(async () => r(await getNgrokUrl()), 1500));

  console.log('\n🎮 POKER MULTIJUGADOR - SERVIDOR LISTO 🎮');
  console.log('=========================================');
  console.log(`📍 Local:      http://localhost:${PORT}`);
  console.log(`🌐 Red local:  http://${localIP}:${PORT}`);

  if (ngrokUrl) {
    console.log(`🌍 PÚBLICO:    ${ngrokUrl}`);
  } else {
    console.log(`🌍 PÚBLICO:    (Túnel ngrok no detectado)`);
  }

  console.log('-----------------------------------------');
  console.log('📱 Para móviles en la misma WiFi:');
  console.log(`   Usa: http://${localIP}:${PORT}`);
  console.log('-----------------------------------------');
  console.log('⏳ Esperando conexiones...');
  console.log('=========================================\n');
});

app.get('/status', (req, res) => {
  const roomsArray = Array.from(rooms.entries()).map(([code, room]) => ({
    code: code,
    players: room.players.map(p => p.name),
    playerCount: room.players.length,
    gameStarted: room.gameStarted
  }));
  res.json({
    server: 'running',
    timestamp: new Date().toISOString(),
    rooms: roomsArray,
    totalRooms: rooms.size,
    totalPlayers: Array.from(rooms.values()).reduce((sum, room) => sum + room.players.length, 0)
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), rooms: rooms.size });
});