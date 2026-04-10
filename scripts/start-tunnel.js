require('dotenv').config();
const ngrok = require('@ngrok/ngrok');

async function startTunnel() {
  try {
    console.log('🎯 Conectando con la nueva versión de Ngrok SDK...');

    // Leemos el token de manera segura
    const token = process.env.NGROK_AUTHTOKEN;

    if (!token) {
      throw new Error("No se encontró el NGROK_AUTHTOKEN en el archivo .env");
    }

    const session = await ngrok.forward({
      addr: 3000,
      authtoken: token,
    });

    const url = session.url();

    console.log('\n====================================');
    console.log('✅ TÚNEL CREADO EXITOSAMENTE');
    console.log('📍 URL PÚBLICA:', url);
    console.log('🔒 Token oculto y seguro.');
    console.log('====================================\n');

  } catch (error) {
    console.error('❌ ERROR EN EL SDK:', error.message);
  }
}

startTunnel();
