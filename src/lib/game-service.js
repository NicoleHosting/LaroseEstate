import {
  availableCharacters,
  characters,
  discoveryEvidenceIds,
  evidence as evidenceCatalog,
  getCharacter,
  getDiscovery,
  getEvidence,
  getHotspot,
  getRoom,
  hotspotRoomId,
  hotspots,
  murdererId,
  privateCharacter,
  privateEvidence,
  publicCharacter,
  publicHotspot,
  publicRoom,
  rooms,
  solutionSummary,
  story,
} from './content-api.js';
import { hashToken, issueToken, randomId, randomRoomCode } from './auth.js';
import { AppError, asInteger, assert, cleanText, optionalText } from './errors.js';

const ROOM_CODE_LENGTH = 6;
const MESSAGE_TYPES = new Set(['lobby', 'room', 'direct', 'anonymous']);
const GAME_STATUSES = new Set(['lobby', 'running', 'paused', 'accusation', 'complete']);
const MAX_MESSAGES_PER_SESSION = 2500;

function now() {
  return new Date().toISOString();
}

function playerEvidenceIds(player) {
  return new Set((player.evidence ?? []).map((record) => record.evidenceId));
}

function hasRoomAccess(session, player, roomId) {
  return session.unlockedRooms.includes(roomId) || (player.personalUnlockedRooms ?? []).includes(roomId);
}

function timerView(timer) {
  if (!timer) return { status: 'idle', durationSeconds: 0, remainingSeconds: 0, endsAt: null };
  const calculated = timer.status === 'running' && timer.endsAt
    ? Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - Date.now()) / 1000))
    : Math.max(0, timer.remainingSeconds ?? 0);
  return { ...timer, status: timer.status === 'running' && calculated === 0 ? 'expired' : timer.status, remainingSeconds: calculated };
}

function publicSession(session) {
  return {
    id: session.id,
    code: session.code,
    name: session.name,
    status: session.status,
    phase: session.phase,
    round: session.round,
    unlockedRooms: [...session.unlockedRooms],
    releasedClues: [...session.releasedClues],
    finalAccusationOpen: session.finalAccusationOpen,
    timer: timerView(session.timer),
    maxPlayers: session.maxPlayers,
    createdAt: session.createdAt,
    reveal: session.reveal ?? null,
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    displayName: player.displayName,
    avatarUrl: player.avatarUrl,
    character: publicCharacter(getCharacter(player.characterId)),
    isHost: player.isHost,
    connected: Boolean(player.connected),
    evidenceCount: player.evidence?.length ?? 0,
    joinedAt: player.joinedAt,
    lastSeenAt: player.lastSeenAt,
  };
}

function addEvidence(player, evidenceId, metadata = {}) {
  player.evidence ??= [];
  const current = player.evidence.find((record) => record.evidenceId === evidenceId);
  if (current) return { record: current, added: false };
  const record = { evidenceId, discoveredAt: now(), ...metadata };
  player.evidence.push(record);
  return { record, added: true };
}

function addStartingEvidence(player, characterId) {
  const character = getCharacter(characterId);
  for (const evidenceId of character?.startingEvidenceIds ?? character?.startingEvidence ?? []) {
    if (getEvidence(evidenceId)) addEvidence(player, evidenceId, { startingCharacterId: characterId });
  }
}

function serializeEvidence(record) {
  const definition = privateEvidence(getEvidence(record.evidenceId));
  return definition ? { ...definition, acquired: { ...record } } : null;
}

function assertSession(state, sessionId) {
  const session = state.sessions[sessionId];
  assert(session, 404, 'SESSION_NOT_FOUND', 'This game session no longer exists.');
  return session;
}

function assertPlayer(state, playerId) {
  const player = state.players[playerId];
  assert(player, 401, 'SESSION_INVALID', 'Your player session is no longer valid.');
  return player;
}

function addAudit(state, event) {
  state.audit.push({ id: randomId(), createdAt: now(), ...event });
  if (state.audit.length > 2000) state.audit.splice(0, state.audit.length - 2000);
}

export class GameService {
  constructor(store, { sessionSecret, uploadMaxBytes = 2 * 1024 * 1024 }) {
    this.store = store;
    this.sessionSecret = sessionSecret;
    this.uploadMaxBytes = uploadMaxBytes;
  }

  async createSession(input) {
    const displayName = cleanText(input.displayName, { name: 'displayName', min: 2, max: 40 });
    const eventName = optionalText(input.eventName, { name: 'eventName', min: 2, max: 80 }) ?? 'A Night at LaRose Estate';
    const maxPlayers = input.maxPlayers === undefined ? 20 : asInteger(input.maxPlayers, { name: 'maxPlayers', min: 5, max: 20 });
    const sessionId = randomId();
    const playerId = randomId();
    const issued = issueToken(this.sessionSecret);
    const result = await this.store.mutate((state) => {
      let code;
      do code = randomRoomCode(ROOM_CODE_LENGTH); while (Object.values(state.sessions).some((item) => item.code === code));
      const createdAt = now();
      const session = {
        id: sessionId,
        code,
        name: eventName,
        hostPlayerId: playerId,
        status: 'lobby',
        phase: 'Lobby',
        round: 0,
        unlockedRooms: ['grand-foyer'],
        releasedClues: [],
        finalAccusationOpen: false,
        timer: { status: 'idle', durationSeconds: 0, remainingSeconds: 0, endsAt: null },
        maxPlayers,
        createdAt,
        updatedAt: createdAt,
        reveal: null,
      };
      const player = {
        id: playerId,
        sessionId,
        displayName,
        avatarUrl: null,
        characterId: null,
        isHost: true,
        evidence: [],
        discoveries: [],
        personalUnlockedRooms: ['grand-foyer'],
        journal: [],
        connected: false,
        joinedAt: createdAt,
        lastSeenAt: createdAt,
      };
      state.sessions[sessionId] = session;
      state.players[playerId] = player;
      state.tokens[issued.hash] = { playerId, createdAt: issued.createdAt, expiresAt: issued.expiresAt, revokedAt: null };
      state.messages[sessionId] = [];
      state.investigations[sessionId] = [];
      state.accusations[sessionId] = {};
      addAudit(state, { sessionId, actorId: playerId, type: 'session.created' });
      return { session, player };
    });
    return { token: issued.token, ...result };
  }

  async joinSession(codeInput, input) {
    const code = cleanText(codeInput, { name: 'room code', min: ROOM_CODE_LENGTH, max: ROOM_CODE_LENGTH }).toUpperCase();
    const displayName = cleanText(input.displayName, { name: 'displayName', min: 2, max: 40 });
    const playerId = randomId();
    const issued = issueToken(this.sessionSecret);
    const result = await this.store.mutate((state) => {
      const session = Object.values(state.sessions).find((item) => item.code === code);
      assert(session, 404, 'ROOM_CODE_NOT_FOUND', 'No game was found for that room code.');
      assert(session.status !== 'complete', 409, 'GAME_COMPLETE', 'That game has already ended.');
      const sessionPlayers = Object.values(state.players).filter((player) => player.sessionId === session.id);
      assert(sessionPlayers.length < session.maxPlayers, 409, 'GAME_FULL', 'That game has reached its player limit.');
      assert(!sessionPlayers.some((player) => player.displayName.toLocaleLowerCase() === displayName.toLocaleLowerCase()), 409, 'NAME_IN_USE', 'That display name is already in use in this game.');
      const assignedIds = new Set(sessionPlayers.map((player) => player.characterId).filter(Boolean));
      const autoCharacter = availableCharacters().find((character) => !assignedIds.has(character.id))?.id ?? null;
      const joinedAt = now();
      const player = {
        id: playerId,
        sessionId: session.id,
        displayName,
        avatarUrl: null,
        characterId: autoCharacter,
        isHost: false,
        evidence: [],
        discoveries: [],
        personalUnlockedRooms: ['grand-foyer'],
        journal: [],
        connected: false,
        joinedAt,
        lastSeenAt: joinedAt,
      };
      addStartingEvidence(player, autoCharacter);
      state.players[playerId] = player;
      state.tokens[issued.hash] = { playerId, createdAt: issued.createdAt, expiresAt: issued.expiresAt, revokedAt: null };
      addAudit(state, { sessionId: session.id, actorId: playerId, type: 'player.joined' });
      return { session, player };
    });
    return { token: issued.token, ...result };
  }

  async authenticate(rawToken) {
    assert(typeof rawToken === 'string' && rawToken.length >= 32, 401, 'AUTH_REQUIRED', 'A valid bearer token is required.');
    const tokenHash = hashToken(rawToken, this.sessionSecret);
    const state = await this.store.read();
    const record = state.tokens[tokenHash];
    assert(record && !record.revokedAt && new Date(record.expiresAt).getTime() > Date.now(), 401, 'SESSION_EXPIRED', 'Your session has expired. Rejoin the game to continue.');
    const player = assertPlayer(state, record.playerId);
    const session = assertSession(state, player.sessionId);
    return { tokenHash, player, session };
  }

  async revokeToken(tokenHash) {
    await this.store.mutate((state) => {
      if (state.tokens[tokenHash]) state.tokens[tokenHash].revokedAt = now();
    });
  }

  async setAvatar(playerId, avatarUrl) {
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      player.avatarUrl = avatarUrl;
      player.lastSeenAt = now();
      return publicPlayer(player);
    });
  }

  async snapshot(playerId) {
    const state = await this.store.read();
    const player = assertPlayer(state, playerId);
    const session = assertSession(state, player.sessionId);
    const peers = Object.values(state.players).filter((item) => item.sessionId === session.id);
    const ownEvidence = (player.evidence ?? []).map(serializeEvidence).filter(Boolean);
    const ownRooms = rooms.map((room) => ({
      ...publicRoom(room),
      unlocked: hasRoomAccess(session, player, room.id),
    }));
    return {
      session: publicSession(session),
      me: {
        ...publicPlayer(player),
        character: privateCharacter(getCharacter(player.characterId)),
        evidence: ownEvidence,
        discoveries: [...(player.discoveries ?? [])],
        personalUnlockedRooms: [...(player.personalUnlockedRooms ?? [])],
        journal: [...(player.journal ?? [])],
      },
      players: peers.map(publicPlayer),
      rooms: ownRooms,
      hotspots: hotspots.map(publicHotspot),
      characters: characters.map(publicCharacter),
      messages: this.#visibleMessages(state, player).slice(-150),
      accusation: state.accusations[session.id]?.[player.id] ?? null,
      serverTime: now(),
    };
  }

  async hostDashboard(playerId) {
    const state = await this.store.read();
    const host = assertPlayer(state, playerId);
    assert(host.isHost, 403, 'HOST_ONLY', 'Only the game host can use this control.');
    const session = assertSession(state, host.sessionId);
    const players = Object.values(state.players).filter((player) => player.sessionId === session.id);
    return {
      session: publicSession(session),
      players: players.map((player) => ({
        ...publicPlayer(player),
        characterId: player.characterId,
        discoveries: [...(player.discoveries ?? [])],
        evidenceIds: (player.evidence ?? []).map((item) => item.evidenceId),
      })),
      characters: availableCharacters().map(publicCharacter),
      accusations: Object.values(state.accusations[session.id] ?? {}),
      recentActivity: state.audit.filter((event) => event.sessionId === session.id).slice(-100).reverse(),
      messageCount: state.messages[session.id]?.length ?? 0,
    };
  }

  async assignCharacter(hostId, targetPlayerId, characterIdInput) {
    const characterId = characterIdInput === null ? null : cleanText(characterIdInput, { name: 'characterId', max: 80 });
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the game host can assign characters.');
      const target = assertPlayer(state, targetPlayerId);
      assert(target.sessionId === host.sessionId, 404, 'PLAYER_NOT_FOUND', 'Player not found in this game.');
      if (characterId) {
        assert(getCharacter(characterId), 400, 'UNKNOWN_CHARACTER', 'That character does not exist.');
        const used = Object.values(state.players).find((player) => player.sessionId === host.sessionId && player.id !== target.id && player.characterId === characterId);
        assert(!used, 409, 'CHARACTER_ASSIGNED', 'That character is already assigned to another player.');
      }
      target.evidence = (target.evidence ?? []).filter((item) => !item.startingCharacterId);
      target.characterId = characterId;
      addStartingEvidence(target, characterId);
      addAudit(state, { sessionId: host.sessionId, actorId: host.id, type: 'character.assigned', payload: { targetPlayerId, characterId } });
      return publicPlayer(target);
    });
  }

  async investigate(playerId, hotspotIdInput) {
    const hotspotId = cleanText(hotspotIdInput, { name: 'hotspotId', max: 100 });
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const session = assertSession(state, player.sessionId);
      assert(session.status === 'running', 409, 'GAME_NOT_ACTIVE', session.status === 'paused' ? 'The host has paused the investigation.' : 'The investigation has not started.');
      const hotspot = getHotspot(hotspotId);
      assert(hotspot, 404, 'HOTSPOT_NOT_FOUND', 'That object cannot be investigated.');
      const roomId = hotspotRoomId(hotspot);
      assert(hasRoomAccess(session, player, roomId), 403, 'ROOM_LOCKED', 'That room is still locked.');
      if (hotspot.requiresRelease || hotspot.releasedClueId) {
        const clueId = hotspot.releasedClueId ?? hotspot.id;
        assert(session.releasedClues.includes(clueId), 403, 'CLUE_NOT_RELEASED', 'The host has not released that clue yet.');
      }
      const requiredEvidenceId = hotspot.requiredEvidenceId ?? hotspot.requiresEvidenceId;
      if (requiredEvidenceId) {
        assert(playerEvidenceIds(player).has(requiredEvidenceId), 403, 'REQUIRED_EVIDENCE_MISSING', 'You do not have the item needed to investigate this object.');
      }
      const alreadyFound = player.discoveries.includes(hotspotId);
      const discovery = getDiscovery(hotspot, player.characterId);
      const granted = [];
      if (!alreadyFound || hotspot.repeatable) {
        for (const evidenceId of discoveryEvidenceIds(hotspot, discovery)) {
          const evidenceItem = getEvidence(evidenceId);
          const availableRound = Number(evidenceItem?.availabilityRound ?? 1);
          if (availableRound > session.round && !session.releasedClues.includes(evidenceId)) continue;
          const addition = addEvidence(player, evidenceId, { sourceHotspotId: hotspotId });
          if (addition.added) granted.push(serializeEvidence(addition.record));
        }
        if (!alreadyFound) player.discoveries.push(hotspotId);
      }

      const unlockedRooms = [];
      const roomToUnlock = discovery.unlocksRoomId ?? hotspot.unlocksRoomId;
      if (roomToUnlock) {
        const keyNeeded = requiredEvidenceId ?? (hotspotId === 'study-door' ? 'brass-study-key' : null);
        assert(!keyNeeded || playerEvidenceIds(player).has(keyNeeded), 403, 'REQUIRED_EVIDENCE_MISSING', 'You need the correct key first.');
        if (!player.personalUnlockedRooms.includes(roomToUnlock)) {
          player.personalUnlockedRooms.push(roomToUnlock);
          unlockedRooms.push(roomToUnlock);
        }
      }
      if (hotspotId === 'study-door' && playerEvidenceIds(player).has('brass-study-key') && !player.personalUnlockedRooms.includes('study')) {
        player.personalUnlockedRooms.push('study');
        unlockedRooms.push('study');
      }
      const record = {
        id: randomId(),
        playerId,
        hotspotId,
        roomId,
        characterId: player.characterId,
        evidenceIds: granted.map((item) => item.id),
        createdAt: now(),
      };
      state.investigations[session.id].push(record);
      player.lastSeenAt = now();
      addAudit(state, { sessionId: session.id, actorId: player.id, type: 'hotspot.investigated', payload: { hotspotId, evidenceIds: record.evidenceIds } });
      return {
        hotspot: publicHotspot(hotspot),
        narrative: discovery.narrative ?? discovery.text ?? discovery.description ?? hotspot.inspectionText ?? hotspot.description,
        journalPrompt: discovery.journalPrompt ?? null,
        roleSpecific: Boolean(discovery.isRoleSpecific),
        closeup: discovery.closeup ?? hotspot.closeup ?? hotspot.image,
        evidence: granted,
        unlockedRooms,
        alreadyInvestigated: alreadyFound,
      };
    });
  }

  async unlockRoom(playerId, roomIdInput, evidenceIdInput) {
    const roomId = cleanText(roomIdInput, { name: 'roomId', max: 80 });
    const evidenceId = cleanText(evidenceIdInput, { name: 'evidenceId', max: 100 });
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const session = assertSession(state, player.sessionId);
      assert(getRoom(roomId), 404, 'ROOM_NOT_FOUND', 'That room does not exist.');
      assert(playerEvidenceIds(player).has(evidenceId), 403, 'REQUIRED_EVIDENCE_MISSING', 'You do not possess the required item.');
      const accepted = roomId === 'study' ? evidenceId === 'brass-study-key' : getRoom(roomId)?.requiredEvidenceId === evidenceId;
      assert(accepted, 403, 'WRONG_KEY', 'That item does not unlock this room.');
      if (!player.personalUnlockedRooms.includes(roomId)) player.personalUnlockedRooms.push(roomId);
      addAudit(state, { sessionId: session.id, actorId: player.id, type: 'room.unlocked.personal', payload: { roomId, evidenceId } });
      return { roomId, unlocked: true };
    });
  }

  async shareEvidence(playerId, evidenceIdInput, targetPlayerId) {
    const evidenceId = cleanText(evidenceIdInput, { name: 'evidenceId', max: 100 });
    return this.store.mutate((state) => {
      const sender = assertPlayer(state, playerId);
      const target = assertPlayer(state, targetPlayerId);
      assert(target.sessionId === sender.sessionId && target.id !== sender.id, 404, 'PLAYER_NOT_FOUND', 'Choose another player in this game.');
      assert(playerEvidenceIds(sender).has(evidenceId), 403, 'EVIDENCE_NOT_OWNED', 'You cannot share evidence you have not discovered.');
      const addition = addEvidence(target, evidenceId, { sharedByPlayerId: sender.id });
      addAudit(state, { sessionId: sender.sessionId, actorId: sender.id, type: 'evidence.shared', payload: { targetPlayerId, evidenceId } });
      return { targetPlayerId, evidence: serializeEvidence(addition.record), added: addition.added };
    });
  }

  async addJournalEntry(playerId, textInput) {
    const text = cleanText(textInput, { name: 'text', max: 2000 });
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const timestamp = now();
      const entry = { id: randomId(), text, createdAt: timestamp, updatedAt: timestamp };
      player.journal.push(entry);
      return entry;
    });
  }

  async updateJournalEntry(playerId, entryId, textInput) {
    const text = cleanText(textInput, { name: 'text', max: 2000 });
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const entry = player.journal.find((item) => item.id === entryId);
      assert(entry, 404, 'JOURNAL_ENTRY_NOT_FOUND', 'Journal entry not found.');
      entry.text = text;
      entry.updatedAt = now();
      return entry;
    });
  }

  async deleteJournalEntry(playerId, entryId) {
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const index = player.journal.findIndex((item) => item.id === entryId);
      assert(index >= 0, 404, 'JOURNAL_ENTRY_NOT_FOUND', 'Journal entry not found.');
      player.journal.splice(index, 1);
      return { deleted: true };
    });
  }

  async sendMessage(playerId, input) {
    const type = cleanText(input.type ?? 'lobby', { name: 'type', max: 20 }).toLowerCase();
    assert(MESSAGE_TYPES.has(type), 400, 'INVALID_MESSAGE_TYPE', 'Message type must be lobby, room, direct, or anonymous.');
    const content = cleanText(input.content, { name: 'content', max: 1000 });
    return this.store.mutate((state) => {
      const sender = assertPlayer(state, playerId);
      const session = assertSession(state, sender.sessionId);
      let recipientPlayerId = input.recipientPlayerId ?? null;
      let roomId = input.roomId ?? null;
      if (type === 'direct' || (type === 'anonymous' && recipientPlayerId)) {
        const recipient = assertPlayer(state, recipientPlayerId);
        assert(recipient.sessionId === session.id && recipient.id !== sender.id, 404, 'PLAYER_NOT_FOUND', 'Message recipient not found in this game.');
      } else recipientPlayerId = null;
      if (type === 'room') {
        roomId = cleanText(roomId, { name: 'roomId', max: 80 });
        assert(getRoom(roomId), 404, 'ROOM_NOT_FOUND', 'That room does not exist.');
        assert(hasRoomAccess(session, sender, roomId), 403, 'ROOM_LOCKED', 'You cannot message from a locked room.');
      } else roomId = null;
      const message = {
        id: randomId(),
        sessionId: session.id,
        type,
        senderPlayerId: sender.id,
        recipientPlayerId,
        roomId,
        content,
        createdAt: now(),
      };
      state.messages[session.id].push(message);
      if (state.messages[session.id].length > MAX_MESSAGES_PER_SESSION) state.messages[session.id].splice(0, state.messages[session.id].length - MAX_MESSAGES_PER_SESSION);
      sender.lastSeenAt = now();
      return message;
    });
  }

  async messages(playerId, options = {}) {
    const state = await this.store.read();
    const player = assertPlayer(state, playerId);
    let result = this.#visibleMessages(state, player);
    if (options.after) result = result.filter((message) => message.createdAt > options.after);
    const limit = Math.min(250, Math.max(1, Number(options.limit) || 100));
    return result.slice(-limit);
  }

  #visibleMessages(state, viewer) {
    const messages = state.messages[viewer.sessionId] ?? [];
    return messages.filter((message) => {
      if (message.type === 'direct') return message.senderPlayerId === viewer.id || message.recipientPlayerId === viewer.id;
      if (message.type === 'anonymous' && message.recipientPlayerId) return message.senderPlayerId === viewer.id || message.recipientPlayerId === viewer.id || viewer.isHost;
      if (message.type === 'room') {
        const session = state.sessions[viewer.sessionId];
        return hasRoomAccess(session, viewer, message.roomId);
      }
      return true;
    }).map((message) => this.serializeMessage(message, viewer, state));
  }

  serializeMessage(message, viewer, state) {
    const anonymousToViewer = message.type === 'anonymous' && message.senderPlayerId !== viewer.id;
    const sender = state.players[message.senderPlayerId];
    return {
      id: message.id,
      type: message.type,
      content: message.content,
      roomId: message.roomId,
      recipientPlayerId: message.recipientPlayerId,
      sender: anonymousToViewer ? null : publicPlayer(sender),
      anonymous: message.type === 'anonymous',
      isMine: message.senderPlayerId === viewer.id,
      createdAt: message.createdAt,
      ...(viewer.isHost && anonymousToViewer ? { moderationSender: publicPlayer(sender) } : {}),
    };
  }

  async setGameControls(hostId, input) {
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the game host can change game controls.');
      const session = assertSession(state, host.sessionId);
      if (input.action) {
        const action = cleanText(input.action, { name: 'action', max: 30 }).toLowerCase();
        if (action === 'start' || action === 'resume') session.status = 'running';
        else if (action === 'pause') session.status = 'paused';
        else if (action === 'open-accusations') {
          session.status = 'accusation';
          session.finalAccusationOpen = true;
        } else throw new AppError(400, 'INVALID_ACTION', 'Action must be start, pause, resume, or open-accusations.');
      }
      if (input.status !== undefined) {
        assert(GAME_STATUSES.has(input.status), 400, 'INVALID_STATUS', 'Invalid game status.');
        session.status = input.status;
      }
      if (input.phase !== undefined) session.phase = cleanText(input.phase, { name: 'phase', max: 80 });
      if (input.round !== undefined) session.round = asInteger(input.round, { name: 'round', min: 0, max: 99 });
      if (input.finalAccusationOpen !== undefined) session.finalAccusationOpen = Boolean(input.finalAccusationOpen);
      if (session.status === 'running' && session.round === 0) session.round = 1;
      if (session.status === 'running' && session.phase === 'Lobby') session.phase = 'Investigation';
      session.updatedAt = now();
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'game.controls', payload: { action: input.action, status: session.status, phase: session.phase, round: session.round } });
      return publicSession(session);
    });
  }

  async hostUnlockRoom(hostId, roomIdInput) {
    const roomId = cleanText(roomIdInput, { name: 'roomId', max: 80 });
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the game host can unlock rooms.');
      const session = assertSession(state, host.sessionId);
      assert(getRoom(roomId), 404, 'ROOM_NOT_FOUND', 'That room does not exist.');
      if (!session.unlockedRooms.includes(roomId)) session.unlockedRooms.push(roomId);
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'room.unlocked.global', payload: { roomId } });
      return { roomId, unlocked: true };
    });
  }

  async releaseClue(hostId, clueIdInput, targetPlayerId = null) {
    const clueId = cleanText(clueIdInput, { name: 'clueId', max: 100 });
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the game host can release clues.');
      const session = assertSession(state, host.sessionId);
      const evidenceItem = getEvidence(clueId);
      const hotspot = getHotspot(clueId);
      assert(evidenceItem || hotspot, 404, 'CLUE_NOT_FOUND', 'That clue does not exist.');
      if (!session.releasedClues.includes(clueId)) session.releasedClues.push(clueId);
      let grant = null;
      if (targetPlayerId) {
        const target = assertPlayer(state, targetPlayerId);
        assert(target.sessionId === session.id, 404, 'PLAYER_NOT_FOUND', 'Player not found in this game.');
        if (evidenceItem) {
          const addition = addEvidence(target, clueId, { releasedByHost: true });
          grant = { playerId: target.id, evidence: serializeEvidence(addition.record), added: addition.added };
        }
      }
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'clue.released', payload: { clueId, targetPlayerId } });
      return { clueId, released: true, grant };
    });
  }

  async setTimer(hostId, input) {
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the game host can control the timer.');
      const session = assertSession(state, host.sessionId);
      const action = cleanText(input.action ?? 'start', { name: 'action', max: 20 }).toLowerCase();
      const current = timerView(session.timer);
      if (action === 'start') {
        const durationSeconds = asInteger(input.durationSeconds, { name: 'durationSeconds', min: 10, max: 24 * 60 * 60 });
        session.timer = { status: 'running', durationSeconds, remainingSeconds: durationSeconds, endsAt: new Date(Date.now() + durationSeconds * 1000).toISOString() };
      } else if (action === 'pause') {
        session.timer = { ...session.timer, status: 'paused', remainingSeconds: current.remainingSeconds, endsAt: null };
      } else if (action === 'resume') {
        assert(current.remainingSeconds > 0, 409, 'TIMER_EXPIRED', 'The timer has no time remaining.');
        session.timer = { ...session.timer, status: 'running', remainingSeconds: current.remainingSeconds, endsAt: new Date(Date.now() + current.remainingSeconds * 1000).toISOString() };
      } else if (action === 'clear') {
        session.timer = { status: 'idle', durationSeconds: 0, remainingSeconds: 0, endsAt: null };
      } else throw new AppError(400, 'INVALID_TIMER_ACTION', 'Timer action must be start, pause, resume, or clear.');
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'timer.changed', payload: { action, timer: session.timer } });
      return timerView(session.timer);
    });
  }

  async submitAccusation(playerId, input) {
    const suspectCharacterId = cleanText(input.suspectCharacterId, { name: 'suspectCharacterId', max: 80 });
    const theory = optionalText(input.theory, { name: 'theory', max: 1500 });
    assert(getCharacter(suspectCharacterId), 400, 'UNKNOWN_SUSPECT', 'Choose a valid suspect.');
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const session = assertSession(state, player.sessionId);
      assert(session.finalAccusationOpen || session.status === 'accusation', 409, 'ACCUSATIONS_CLOSED', 'Final accusations are not open yet.');
      assert(session.status !== 'complete', 409, 'GAME_COMPLETE', 'The solution has already been revealed.');
      const accusation = { playerId, suspectCharacterId, theory, submittedAt: now() };
      state.accusations[session.id][player.id] = accusation;
      addAudit(state, { sessionId: session.id, actorId: player.id, type: 'accusation.submitted' });
      return accusation;
    });
  }

  async revealSolution(hostId) {
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the game host can reveal the solution.');
      const session = assertSession(state, host.sessionId);
      const culpritId = murdererId();
      assert(culpritId, 500, 'SOLUTION_NOT_CONFIGURED', 'The story does not define its murderer.');
      const accusations = Object.values(state.accusations[session.id] ?? {});
      const tally = accusations.reduce((result, item) => {
        result[item.suspectCharacterId] = (result[item.suspectCharacterId] ?? 0) + 1;
        return result;
      }, {});
      session.reveal = {
        murderer: publicCharacter(getCharacter(culpritId)),
        summary: solutionSummary(),
        tally,
        correctPlayerIds: accusations.filter((item) => item.suspectCharacterId === culpritId).map((item) => item.playerId),
        revealedAt: now(),
      };
      session.status = 'complete';
      session.phase = 'Revelation';
      session.finalAccusationOpen = false;
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'solution.revealed' });
      return session.reveal;
    });
  }

  async setPresence(playerId, connected) {
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      player.connected = Boolean(connected);
      player.lastSeenAt = now();
      return { playerId, connected: player.connected, sessionId: player.sessionId };
    });
  }

  publicConfig() {
    return {
      title: story.title ?? 'The LaRose Files: Blood Is Thicker Than Water',
      subtitle: story.subtitle ?? 'A murder mystery experience',
      maxPlayers: 20,
      upload: { maxBytes: this.uploadMaxBytes, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      messageTypes: [...MESSAGE_TYPES],
      characters: characters.map(publicCharacter),
      rooms: rooms.map(publicRoom),
      hotspots: hotspots.map(publicHotspot),
      evidenceCount: evidenceCatalog.length,
    };
  }
}
