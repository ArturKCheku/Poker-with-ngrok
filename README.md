🃏 Poker Multiplayer - Real-Time Web Game

¡Bienvenido a Poker Multiplayer! Una aplicación de póker estilo Texas Hold'em diseñada para jugar con amigos en tiempo real. Este proyecto utiliza Node.js y Socket.io para gestionar una comunicación fluida y rápida entre jugadores, con integración nativa de Ngrok para facilitar el juego online sin complicaciones de red.
🚀 Características Principales

  - Multijugador en tiempo real: Gracias a WebSockets (Socket.io).

  - Sistema de Salas: Crea o únete a partidas mediante códigos de sala únicos.

  - Gestión Automática: Control de turnos, ciegas (Small/Big Blind) y repartición de fichas.

  - Mezcla de Asientos: El host puede barajar la posición de los jugadores antes de empezar.

  - Chat Integrado: Comunicación en vivo con filtros para espectadores y jugadores.

  - Túnel Ngrok Automático: Comparte tu partida local con el mundo con un solo comando.

  - Diseño Responsivo: Interfaz adaptada para jugar desde el navegador o dispositivos móviles.

🛠️ Stack Tecnológico

  - Backend: Node.js, Express.

  - Comunicación: Socket.io (WebSockets).

  - Frontend: HTML5, CSS3, JavaScript (Vanilla).

- Herramientas: Ngrok (Túnel), Nodemon (Desarrollo), Concurrently.

📦 Instalación y Configuración

Sigue estos pasos para tener tu mesa de póker lista en menos de 2 minutos:

  1. Clona el repositorio:

          git clone https://github.com/ArturKCheku/Poker-with-ngrok.git
          cd Poker-with-ngrok

  2. Instala las dependencias:

          npm install

  3. Configura tu Token de Ngrok:
    Crea un archivo .env en la raíz del proyecto y añade tu token de ngrok.com:
    Fragmento de código

          NGROK_AUTHTOKEN=tu_token_aqui
          PORT=3000

🎮 Cómo Jugar?

Para arrancar tanto el servidor como el túnel público al mismo tiempo, ejecuta:
Bash

    npm run dev

Una vez ejecutado, verás en la consola:

    Local: http://localhost:3000 (Para ti).

    PÚBLICO: https://xxxx-xxxx.ngrok-free.dev (Para tus amigos).

📂 Estructura del Proyecto

    ├── public/              # Archivos estáticos (HTML, CSS, JS del cliente)
    │   ├── js/              # Lógica del frontend y Socket events
    │   └── css/             # Estilos de la mesa y componentes
    ├── src/                 # Código fuente del servidor
    │   ├── config/          # Configuración de Socket.io y Ngrok
    │   ├── game/            # Lógica pura del juego (reglas, estados, baraja)
    │   ├── sockets/         # Handlers de eventos de red (actions, connections)
    │   └── server.js        # Punto de entrada de la aplicación
    ├── .gitignore           # Archivos excluidos de Git (node_modules, .env)
    └── package.json         # Scripts y dependencias

📝 Notas de Desarrollo

  - Seguridad: Asegúrate de no compartir nunca tu archivo .env con el token de Ngrok.

  - Estilo: El proyecto utiliza Prettier para mantener un código limpio y legible. Puedes formatear todo con npm run format.

  - Turnos: La lógica de juego espera a que haya al menos 2 jugadores para permitir el inicio de la partida.

🤝 Contribuciones

¿Tienes alguna idea para mejorar el juego? ¡Los Pull Requests son bienvenidos!

  - Haz un Fork del proyecto.

  - Crea una rama para tu mejora (git checkout -b feature/MejoraIncreible).

  - Haz commit de tus cambios (git commit -m 'Añadir mejora').

  - Haz push a la rama (git push origin feature/MejoraIncreible).

  - Abre un Pull Request.
