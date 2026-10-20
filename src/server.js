import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import multer from 'multer';
import { Server as SocketIOServer } from 'socket.io';
import { bearerToken } from './lib/auth.js';
import { AppError, assert } from './lib/errors.js';
import { GameService } from './lib/game-service.js';
import { createStore } from './store.js';

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SOURCE_DIR, '..');
const configuredUploadMaxMb = Number(process.env.UPLOAD_MAX_MB ?? 2);
const AVATAR_MAX_MB = Number.isFinite(configuredUploadMaxMb) && configuredUploadMaxMb > 0
  ? Math.min(configuredUploadMaxMb, 25)
  : 2;
const AVATAR_MAX_BYTES = Math.floor(AVATAR_MAX_MB * 1024 * 1024);
const AVATAR_TYPES = {
  'image/jpeg': { extension: '.jpg', check: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: '.png', check: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/gif': { extension: '.gif', check: (buffer) => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')) },
  'image/webp': { extension: '.webp', check: (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP' },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 20 },
  fileFilter(_request, file, callback) {
    if (!AVATAR_TYPES[file.mimetype]) {
      callback(new AppError(415, 'UNSUPPORTED_AVATAR', 'Avatar must be a JPEG, PNG, WebP, or GIF image.'));
      return;
    }
    callback(null, true);
  },
});

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function parseAllowedOrigins(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function createRateLimiter({ limit, windowMs }) {
  const clients = new Map();
  return (request, _response, next) => {
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const currentTime = Date.now();
    const record = clients.get(key);
    if (!record || record.resetAt <= currentTime) {
      clients.set(key, { count: 1, resetAt: currentTime + windowMs });
      next();
      return;
    }
    record.count += 1;
    if (record.count > limit) {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.'));
      return;
    }
    next();
  };
}

function persistentAvatar(file) {
  if (!file) return null;
  const type = AVATAR_TYPES[file.mimetype];
  assert(type?.check(file.buffer), 415, 'INVALID_AVATAR', 'The uploaded file contents do not match a supported image type.');
  return { mimeType: file.mimetype, data: file.buffer.toString('base64') };
}

function apiIndex() {
  return {
    name: 'The LaRose Files API',
    version: 1,
    authentication: 'Use Authorization: Bearer <sessionToken>. Socket.IO clients pass auth.token.',
    endpoints: {
      public: [
        'GET /api',
        'GET /api/config',
        'GET /api/avatars/:playerId',
        'POST /api/sessions',
        'POST /api/sessions/:code/join',
      ],
      player: [
        'GET /api/bootstrap',
        'POST /api/auth/logout',
        'POST /api/me/avatar',
        'POST /api/game/investigate',
        'POST /api/game/interact',
        'POST /api/game/unlock-room',
        'POST /api/game/evidence/:evidenceId/share',
        'POST /api/game/evidence/:evidenceId/action',
        'GET /api/game/confessionals',
        'POST /api/game/confessionals/:confessionalId/respond',
        'POST /api/game/accusation',
        'GET|POST /api/journal',
        'PATCH|DELETE /api/journal/:entryId',
        'GET|POST /api/messages',
      ],
      host: [
        'GET /api/host/dashboard',
        'PATCH /api/host/players/:playerId/character',
        'PATCH /api/host/game',
        'POST /api/host/override',
        'POST /api/host/rooms/:roomId/unlock',
        'POST /api/host/clues/:clueId/release',
        'PUT /api/host/timer',
        'POST /api/host/reveal',
      ],
      socketEvents: {
        clientToServer: ['state:refresh', 'hotspot:investigate', 'message:send', 'evidence:share', 'accusation:submit', 'host:controls'],
        serverToClient: ['state:init', 'state:update', 'narrator:event', 'act:changed', 'confessional:prompt', 'reunion:started', 'awards:revealed', 'message:new', 'game:error'],
      },
    },
  };
}

export async function createApp(options = {}) {
  const production = (options.nodeEnv ?? process.env.NODE_ENV) === 'production';
  const configuredSecret = options.sessionSecret ?? process.env.SESSION_SECRET;
  if (production && (!configuredSecret || configuredSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production.');
  }
  const sessionSecret = configuredSecret ?? 'larose-local-development-secret-change-me';
  const publicDirectory = path.resolve(options.publicDirectory ?? path.join(PROJECT_DIR, 'public'));
  const uploadDirectory = path.resolve(options.uploadDirectory ?? process.env.UPLOAD_DIR ?? path.join(PROJECT_DIR, 'data', 'uploads'));
  const store = options.store ?? await createStore(options.storeOptions);
  const game = new GameService(store, { sessionSecret, uploadMaxBytes: AVATAR_MAX_BYTES, allowFastMode: options.allowFastMode });
  const app = express();
  const httpServer = http.createServer(app);
  const allowedOrigins = parseAllowedOrigins(options.allowedOrigins ?? process.env.ALLOWED_ORIGINS);
  const io = new SocketIOServer(httpServer, {
    maxHttpBufferSize: 64 * 1024,
    cors: allowedOrigins.length ? { origin: allowedOrigins, credentials: true } : undefined,
  });

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (production) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use('/uploads', express.static(uploadDirectory, { fallthrough: false, immutable: true, maxAge: '7d' }));

  const registrationLimiter = createRateLimiter({ limit: 25, windowMs: 10 * 60 * 1000 });

  const requireAuth = asyncRoute(async (request, _response, next) => {
    const token = bearerToken(request.headers.authorization);
    request.auth = await game.authenticate(token);
    next();
  });

  async function applyAvatar(file, playerId) {
    const avatar = persistentAvatar(file);
    if (avatar) return game.setAvatar(playerId, avatar);
    return null;
  }

  async function broadcastSession(sessionId, event = 'state:update') {
    const sockets = await io.in(`session:${sessionId}`).fetchSockets();
    await Promise.all(sockets.map(async (socket) => {
      try {
        socket.emit(event, await game.snapshot(socket.data.playerId));
      } catch (error) {
        socket.emit('game:error', { code: error.code ?? 'STATE_ERROR', message: error.message });
      }
    }));
  }

  async function publishMessage(rawMessage) {
    const sockets = await io.in(`session:${rawMessage.sessionId}`).fetchSockets();
    await Promise.all(sockets.map(async (socket) => {
      const visible = await game.messages(socket.data.playerId, { limit: 250 });
      const message = visible.find((item) => item.id === rawMessage.id);
      if (message) socket.emit('message:new', message);
    }));
  }

  app.get('/healthz', (_request, response) => response.json({ ok: true, store: store.kind, time: new Date().toISOString() }));
  app.get('/api/health', (_request, response) => response.json({ ok: true, store: store.kind, time: new Date().toISOString() }));
  app.get('/api', (_request, response) => response.json(apiIndex()));
  app.get('/api/config', (_request, response) => response.json(game.publicConfig()));
  app.get('/api/avatars/:playerId', asyncRoute(async (request, response) => {
    const avatar = await game.avatarAsset(request.params.playerId);
    const contents = Buffer.from(avatar.data, 'base64');
    response.setHeader('Content-Type', avatar.mimeType);
    response.setHeader('Content-Length', String(contents.length));
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.send(contents);
  }));

  app.post('/api/sessions', registrationLimiter, upload.single('avatar'), asyncRoute(async (request, response) => {
    const result = await game.createSession(request.body ?? {});
    await applyAvatar(request.file, result.player.id);
    response.status(201).json({ token: result.token, state: await game.snapshot(result.player.id) });
  }));

  app.post('/api/sessions/:code/join', registrationLimiter, upload.single('avatar'), asyncRoute(async (request, response) => {
    const result = await game.joinSession(request.params.code, request.body ?? {});
    await applyAvatar(request.file, result.player.id);
    await broadcastSession(result.session.id);
    response.status(201).json({ token: result.token, state: await game.snapshot(result.player.id) });
  }));

  app.get('/api/bootstrap', requireAuth, asyncRoute(async (request, response) => {
    response.json(await game.snapshot(request.auth.player.id));
  }));

  app.post('/api/auth/logout', requireAuth, asyncRoute(async (request, response) => {
    await game.revokeToken(request.auth.tokenHash);
    response.status(204).end();
  }));

  app.post('/api/me/avatar', requireAuth, upload.single('avatar'), asyncRoute(async (request, response) => {
    assert(request.file, 400, 'AVATAR_REQUIRED', 'Choose an avatar image to upload.');
    await applyAvatar(request.file, request.auth.player.id);
    await broadcastSession(request.auth.session.id);
    response.json({ avatarUrl: (await game.snapshot(request.auth.player.id)).me.avatarUrl });
  }));

  app.post('/api/game/investigate', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.investigate(request.auth.player.id, request.body?.hotspotId);
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/game/interact', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.interact(request.auth.player.id, request.body ?? {});
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/game/unlock-room', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.unlockRoom(request.auth.player.id, request.body?.roomId, request.body?.evidenceId);
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/game/evidence/:evidenceId/share', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.shareEvidence(request.auth.player.id, request.params.evidenceId, request.body?.playerId);
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/game/evidence/:evidenceId/action', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.evidenceAction(request.auth.player.id, request.params.evidenceId, request.body ?? {});
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.get('/api/game/confessionals', requireAuth, asyncRoute(async (request, response) => {
    response.json({ confessionals: await game.getConfessionals(request.auth.player.id) });
  }));

  app.post('/api/game/confessionals/:confessionalId/respond', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.respondConfessional(request.auth.player.id, request.params.confessionalId, request.body?.response);
    response.json(result);
  }));

  app.get('/api/journal', requireAuth, asyncRoute(async (request, response) => {
    response.json({ entries: (await game.snapshot(request.auth.player.id)).me.journal });
  }));

  app.post('/api/journal', requireAuth, asyncRoute(async (request, response) => {
    response.status(201).json(await game.addJournalEntry(request.auth.player.id, request.body?.text));
  }));

  app.patch('/api/journal/:entryId', requireAuth, asyncRoute(async (request, response) => {
    response.json(await game.updateJournalEntry(request.auth.player.id, request.params.entryId, request.body?.text));
  }));

  app.delete('/api/journal/:entryId', requireAuth, asyncRoute(async (request, response) => {
    await game.deleteJournalEntry(request.auth.player.id, request.params.entryId);
    response.status(204).end();
  }));

  app.get('/api/messages', requireAuth, asyncRoute(async (request, response) => {
    response.json({ messages: await game.messages(request.auth.player.id, request.query) });
  }));

  app.post('/api/messages', requireAuth, asyncRoute(async (request, response) => {
    const rawMessage = await game.sendMessage(request.auth.player.id, request.body ?? {});
    await publishMessage(rawMessage);
    const serialized = (await game.messages(request.auth.player.id, { limit: 250 })).find((item) => item.id === rawMessage.id);
    await broadcastSession(request.auth.session.id);
    response.status(201).json(serialized);
  }));

  app.post('/api/game/accusation', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.submitAccusation(request.auth.player.id, request.body ?? {});
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.get('/api/host/dashboard', requireAuth, asyncRoute(async (request, response) => {
    response.json(await game.hostDashboard(request.auth.player.id));
  }));

  app.patch('/api/host/players/:playerId/character', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.assignCharacter(request.auth.player.id, request.params.playerId, request.body?.characterId ?? null);
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.patch('/api/host/game', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.setGameControls(request.auth.player.id, request.body ?? {});
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/host/override', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.adminOverride(request.auth.player.id, request.body ?? {});
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/host/rooms/:roomId/unlock', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.hostUnlockRoom(request.auth.player.id, request.params.roomId);
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/host/clues/:clueId/release', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.releaseClue(request.auth.player.id, request.params.clueId, request.body?.playerId ?? null);
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.put('/api/host/timer', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.setTimer(request.auth.player.id, request.body ?? {});
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  app.post('/api/host/reveal', requireAuth, asyncRoute(async (request, response) => {
    const result = await game.revealSolution(request.auth.player.id);
    await broadcastSession(request.auth.session.id);
    response.json(result);
  }));

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ?? bearerToken(socket.handshake.headers.authorization);
      socket.data.auth = await game.authenticate(token);
      socket.data.playerId = socket.data.auth.player.id;
      socket.data.sessionId = socket.data.auth.session.id;
      next();
    } catch (error) {
      const failure = new Error(error.message);
      failure.data = { code: error.code ?? 'AUTH_FAILED' };
      next(failure);
    }
  });

  io.on('connection', async (socket) => {
    const { playerId, sessionId } = socket.data;
    socket.join(`session:${sessionId}`);
    socket.join(`player:${playerId}`);
    try {
      await game.setPresence(playerId, true);
      socket.emit('state:init', await game.snapshot(playerId));
      await broadcastSession(sessionId);
    } catch (error) {
      socket.emit('game:error', { code: error.code ?? 'CONNECTION_ERROR', message: error.message });
    }

    const handle = (work, { broadcast = true } = {}) => async (payload = {}, acknowledgement = () => {}) => {
      try {
        const result = await work(payload);
        acknowledgement({ ok: true, data: result });
        if (broadcast) await broadcastSession(sessionId);
      } catch (error) {
        const failure = { code: error.code ?? 'GAME_ERROR', message: error.message, details: error.details };
        acknowledgement({ ok: false, error: failure });
        socket.emit('game:error', failure);
      }
    };

    socket.on('state:refresh', handle(() => game.snapshot(playerId), { broadcast: false }));
    socket.on('hotspot:investigate', handle((payload) => game.investigate(playerId, payload.hotspotId)));
    socket.on('evidence:share', handle((payload) => game.shareEvidence(playerId, payload.evidenceId, payload.playerId)));
    socket.on('accusation:submit', handle((payload) => game.submitAccusation(playerId, payload)));
    socket.on('host:controls', handle((payload) => game.setGameControls(playerId, payload)));
    socket.on('message:send', async (payload = {}, acknowledgement = () => {}) => {
      try {
        const rawMessage = await game.sendMessage(playerId, payload);
        const ownMessage = (await game.messages(playerId, { limit: 250 })).find((item) => item.id === rawMessage.id);
        acknowledgement({ ok: true, data: ownMessage });
        await publishMessage(rawMessage);
        await broadcastSession(sessionId);
      } catch (error) {
        const failure = { code: error.code ?? 'MESSAGE_ERROR', message: error.message, details: error.details };
        acknowledgement({ ok: false, error: failure });
        socket.emit('game:error', failure);
      }
    });

    socket.on('disconnect', () => {
      setTimeout(async () => {
        try {
          const remaining = await io.in(`player:${playerId}`).fetchSockets();
          if (remaining.length === 0) {
            await game.setPresence(playerId, false);
            await broadcastSession(sessionId);
          }
        } catch {
          // The server may be shutting down; presence is advisory and repaired on reconnect.
        }
      }, 250);
    });
  });

  let directorTicking = false;
  const directorInterval = options.disableDirectorInterval ? null : setInterval(async () => {
    if (directorTicking) return;
    directorTicking = true;
    try {
      const result = await game.tick();
      for (const item of result.results ?? []) {
        if (!item.changed) continue;
        for (const event of item.events ?? []) {
          io.to(`session:${item.sessionId}`).emit('narrator:event', event);
          if (event.type === 'act.changed') {
            io.to(`session:${item.sessionId}`).emit('act:changed', event);
            io.to(`session:${item.sessionId}`).emit('confessional:prompt', { actIndex: event.actIndex });
          }
          if (event.type === 'reunion.started') io.to(`session:${item.sessionId}`).emit('reunion:started', event);
          if (event.type === 'awards.revealed') io.to(`session:${item.sessionId}`).emit('awards:revealed', event);
        }
        await broadcastSession(item.sessionId);
      }
    } catch (error) {
      console.error('Autonomous director tick failed:', error);
    } finally {
      directorTicking = false;
    }
  }, Number(options.directorIntervalMs ?? process.env.DIRECTOR_INTERVAL_MS ?? 1000));
  directorInterval?.unref?.();

  app.use('/api', (request, _response, next) => next(new AppError(404, 'API_NOT_FOUND', `No API route matches ${request.method} ${request.originalUrl}.`)));
  app.use(express.static(publicDirectory, { maxAge: production ? '1h' : 0 }));
  app.use(asyncRoute(async (request, response, next) => {
    if (request.method !== 'GET' || !request.accepts('html')) {
      next(new AppError(404, 'NOT_FOUND', 'Not found.'));
      return;
    }
    try {
      await fs.access(path.join(publicDirectory, 'index.html'));
      response.sendFile(path.join(publicDirectory, 'index.html'));
    } catch {
      next(new AppError(404, 'NOT_FOUND', 'Frontend assets have not been built.'));
    }
  }));

  app.use((error, _request, response, _next) => {
    let status = error.status ?? 500;
    let code = error.code ?? 'INTERNAL_ERROR';
    let message = error.message ?? 'An unexpected error occurred.';
    if (error instanceof multer.MulterError) {
      status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      code = error.code;
      message = error.code === 'LIMIT_FILE_SIZE' ? `Avatar files must be ${AVATAR_MAX_MB} MB or smaller.` : error.message;
    }
    if (status >= 500) {
      console.error(error);
      if (production) message = 'An unexpected server error occurred.';
    }
    response.status(status).json({ error: { code, message, ...(error.details ? { details: error.details } : {}) } });
  });

  let listening = false;
  return {
    app,
    httpServer,
    io,
    store,
    game,
    async start(port = Number(options.port ?? process.env.PORT ?? 3000), host = options.host ?? '0.0.0.0') {
      await fs.mkdir(uploadDirectory, { recursive: true });
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          httpServer.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          httpServer.off('error', onError);
          listening = true;
          resolve();
        };
        httpServer.once('error', onError);
        httpServer.once('listening', onListening);
        httpServer.listen(port, host);
      });
      return httpServer.address();
    },
    async close() {
      if (directorInterval) clearInterval(directorInterval);
      await new Promise((resolve) => io.close(resolve));
      if (httpServer.listening) await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
      listening = false;
      await store.close();
    },
  };
}

export const createServer = createApp;

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  createApp().then(async (runtime) => {
    const address = await runtime.start();
    const port = typeof address === 'object' ? address.port : process.env.PORT ?? 3000;
    console.log(`The LaRose Files is listening on port ${port} (${runtime.store.kind} persistence).`);
    const shutdown = async () => {
      await runtime.close();
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
