import crypto from 'node:crypto';

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
  privateCharacter,
  privateEvidence,
  publicCharacter,
  publicHotspot,
  publicRoom,
  rooms,
  story,
} from './content-api.js';
import {
  ACTS,
  MANSION_INTERACTIONS,
  actDefinition,
  actDurationSeconds,
  confessionalQuestion,
  getInteraction,
  npcConfessional,
  publicInteraction,
  ruleBasedNpcReply,
  selectMystery,
  stageDurationSeconds,
} from './director.js';
import { hashToken, issueToken, randomId, randomRoomCode } from './auth.js';
import { AppError, asInteger, assert, cleanText, optionalText } from './errors.js';

const ROOM_CODE_LENGTH = 6;
const MESSAGE_TYPES = new Set(['lobby', 'room', 'direct', 'anonymous']);
const GAME_STATUSES = new Set(['lobby', 'running', 'paused', 'accusation', 'reveal', 'reunion', 'awards', 'complete']);
const MAX_MESSAGES_PER_SESSION = 2500;
const AWARD_CATEGORIES = Object.freeze([
  ['best-detective', 'Best Detective'],
  ['biggest-snake', 'Biggest Snake'],
  ['best-liar', 'Best Liar'],
  ['most-betrayed', 'Most Betrayed'],
  ['messiest-family-member', 'Messiest Family Member'],
  ['most-suspicious', 'Most Suspicious'],
  ['best-npc-performance', 'Best NPC Performance'],
  ['drama-queen-king', 'Drama Queen / King'],
]);

function iso(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function millis(value) {
  const result = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(result) ? result : Date.now();
}

function playerEvidenceIds(player) {
  return new Set((player.evidence ?? []).map((record) => record.evidenceId));
}

function hasRoomAccess(session, player, roomId) {
  return session.unlockedRooms.includes(roomId) || (player.personalUnlockedRooms ?? []).includes(roomId);
}

function timerView(timer, at = Date.now()) {
  if (!timer) return { status: 'idle', durationSeconds: 0, remainingSeconds: 0, endsAt: null };
  const calculated = timer.status === 'running' && timer.endsAt
    ? Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - millis(at)) / 1000))
    : Math.max(0, timer.remainingSeconds ?? 0);
  return { ...timer, status: timer.status === 'running' && calculated === 0 ? 'expired' : timer.status, remainingSeconds: calculated };
}

function publicSession(session, at = Date.now()) {
  const duration = session.actStartedAt && session.nextBeatAt
    ? Math.max(1, millis(session.nextBeatAt) - millis(session.actStartedAt))
    : 1;
  const elapsed = session.actStartedAt ? Math.max(0, millis(at) - millis(session.actStartedAt)) : 0;
  const percent = session.status === 'lobby' ? 0 : Math.min(100, Math.round((elapsed / duration) * 100));
  return {
    id: session.id,
    code: session.code,
    name: session.name,
    status: session.status,
    phase: session.phase,
    stage: session.postgameStage ?? (session.actSlug || 'lobby'),
    round: session.round,
    mode: session.mode ?? 'standard',
    actIndex: session.actIndex ?? 0,
    actTitle: session.actTitle?.replace(/^Act\s+[IVX]+\s+—\s+/, '') ?? null,
    actStartedAt: session.actStartedAt ?? null,
    nextBeatAt: session.nextBeatAt ?? null,
    progress: { percent, current: session.actIndex ?? 0, total: ACTS.length },
    narrator: session.narrator ?? null,
    unlockedRooms: [...session.unlockedRooms],
    releasedClues: [...session.releasedClues],
    finalAccusationOpen: Boolean(session.finalAccusationOpen),
    timer: timerView(session.timer, at),
    maxPlayers: session.maxPlayers,
    createdAt: session.createdAt,
    reveal: session.reveal ?? null,
    reunion: session.reunion ?? null,
    awards: session.awards ?? null,
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    displayName: player.displayName,
    avatarUrl: player.avatarUrl,
    character: publicCharacter(getCharacter(player.characterId)),
    isHost: Boolean(player.isHost),
    isNpc: false,
    connected: Boolean(player.connected),
    evidenceCount: player.evidence?.length ?? 0,
    joinedAt: player.joinedAt,
    lastSeenAt: player.lastSeenAt,
  };
}

function publicNpc(npc) {
  return {
    id: npc.id,
    npcId: npc.id,
    displayName: npc.displayName,
    avatarUrl: null,
    character: publicCharacter(getCharacter(npc.characterId)),
    isHost: false,
    isNpc: true,
    interactive: true,
    canMessage: true,
    connected: true,
    evidenceCount: npc.evidence?.length ?? 0,
    joinedAt: npc.joinedAt,
    lastSeenAt: npc.lastSeenAt,
  };
}

function addEvidence(player, evidenceId, metadata = {}, at = Date.now()) {
  player.evidence ??= [];
  const current = player.evidence.find((record) => record.evidenceId === evidenceId);
  if (current) return { record: current, added: false };
  const record = { evidenceId, discoveredAt: iso(at), ...metadata };
  player.evidence.push(record);
  return { record, added: true };
}

function addStartingEvidence(player, characterId, at = Date.now()) {
  const character = getCharacter(characterId);
  for (const evidenceId of character?.startingEvidenceIds ?? character?.startingEvidence ?? []) {
    if (getEvidence(evidenceId)) addEvidence(player, evidenceId, { startingCharacterId: character?.id ?? characterId }, at);
  }
}

function serializeEvidence(record, mystery, { actions = true } = {}) {
  const base = privateEvidence(getEvidence(record.evidenceId));
  if (!base) return null;
  const override = mystery?.evidenceOverrides?.[record.evidenceId] ?? {};
  return {
    ...base,
    ...override,
    acquired: { ...record },
    availableActions: actions ? ['conceal', 'reveal', 'plant'] : [],
  };
}

function latestEvidenceActions(state, sessionId) {
  const latest = new Map();
  for (const record of state.evidenceActions?.[sessionId] ?? []) {
    latest.set(`${record.playerId}:${record.evidenceId}`, record);
  }
  return [...latest.values()];
}

function publicEvidenceViews(state, session, mystery) {
  const revealed = new Map();
  const planted = new Map();
  for (const action of latestEvidenceActions(state, session.id)) {
    if (action.action === 'reveal' && !revealed.has(action.evidenceId)) {
      const view = serializeEvidence({
        evidenceId: action.evidenceId,
        visibility: 'public',
        revealedAt: action.createdAt,
        source: 'public-reveal',
      }, mystery, { actions: false });
      if (view) revealed.set(action.evidenceId, view);
    }
    if (action.action === 'plant' && action.roomId) {
      const key = `${action.roomId}:${action.evidenceId}`;
      if (!planted.has(key)) {
        const view = serializeEvidence({
          evidenceId: action.evidenceId,
          visibility: 'planted',
          roomId: action.roomId,
          hotspotId: action.hotspotId ?? null,
          plantedAt: action.createdAt,
          source: 'room-discovery',
        }, mystery, { actions: false });
        if (view) planted.set(key, view);
      }
    }
  }
  return { revealed: [...revealed.values()], planted: [...planted.values()] };
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

function addAudit(state, event, at = Date.now()) {
  state.audit.push({ id: randomId(), createdAt: iso(at), ...event });
  if (state.audit.length > 2000) state.audit.splice(0, state.audit.length - 2000);
}

function sessionPlayers(state, sessionId) {
  return Object.values(state.players).filter((player) => player.sessionId === sessionId);
}

function sessionNpcs(state, sessionId) {
  return Object.values(state.npcs?.[sessionId] ?? {});
}

function adaptText(value, mystery) {
  if (mystery?.id === 'trust-audit' || typeof value !== 'string') return value;
  const culprit = getCharacter(mystery?.murdererId)?.name ?? 'the culprit';
  const first = culprit.replace(/^Dr\.\s+/, '').split(' ')[0];
  return value.replaceAll('Lucien LaRose', culprit).replaceAll('Lucien’s', `${first}’s`).replaceAll("Lucien's", `${first}’s`).replaceAll('Lucien', first);
}

function privateCharacterFor(state, session, characterId) {
  const base = privateCharacter(getCharacter(characterId));
  if (!base) return null;
  const mystery = state.mysteries?.[session.id];
  const overlay = mystery?.characterOverlays?.[base.id] ?? null;
  if (overlay) return { ...base, ...structuredClone(overlay) };
  if (!mystery || mystery.id === 'trust-audit') return base;
  return {
    ...base,
    dossier: adaptText(base.dossier, mystery),
    secret: adaptText(base.secret, mystery),
    alibi: adaptText(base.alibi, mystery),
    objectives: (base.objectives ?? []).map((item) => adaptText(item, mystery)),
    knowledge: (base.knowledge ?? []).map((item) => adaptText(item, mystery)),
  };
}

function ensureCollections(state, sessionId) {
  state.messages[sessionId] ??= [];
  state.investigations[sessionId] ??= [];
  state.accusations[sessionId] ??= {};
  state.npcs[sessionId] ??= {};
  state.confessionals[sessionId] ??= {};
  state.evidenceActions[sessionId] ??= [];
  state.interactionProgress[sessionId] ??= {};
  state.engineEvents[sessionId] ??= [];
}

function addEngineEvent(state, session, event, at = Date.now()) {
  ensureCollections(state, session.id);
  const record = {
    id: randomId(),
    type: event.type ?? 'narrator.event',
    actIndex: session.actIndex ?? 0,
    title: event.title ?? session.actTitle ?? 'The Estate Narrator',
    text: event.text ?? event.message ?? '',
    message: event.message ?? event.text ?? '',
    actions: event.actions ?? [],
    createdAt: iso(at),
  };
  state.engineEvents[session.id].push(record);
  if (state.engineEvents[session.id].length > 300) state.engineEvents[session.id].splice(0, state.engineEvents[session.id].length - 300);
  session.narrator = record;
  return record;
}

export class GameService {
  constructor(store, { sessionSecret, uploadMaxBytes = 2 * 1024 * 1024, randomInt = crypto.randomInt, allowFastMode } = {}) {
    this.store = store;
    this.sessionSecret = sessionSecret;
    this.uploadMaxBytes = uploadMaxBytes;
    this.randomInt = randomInt;
    this.allowFastMode = allowFastMode ?? process.env.ENABLE_FAST_MODE !== 'false';
  }

  #ensureMystery(state, session) {
    ensureCollections(state, session.id);
    if (!state.mysteries[session.id]) {
      // Pre-upgrade sessions used the original Lucien audit case. Preserve that
      // continuity while adding the new sealed-case envelope around old state.
      state.mysteries[session.id] = selectMystery({
        sessionId: session.id,
        secret: this.sessionSecret,
        randomInt: () => 0,
      });
      addAudit(state, { sessionId: session.id, actorId: null, type: 'mystery.migrated' });
    }
    return state.mysteries[session.id];
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
      const createdAt = iso();
      const session = {
        id: sessionId, code, name: eventName, hostPlayerId: playerId,
        status: 'lobby', phase: 'Lobby', round: 0, mode: 'standard',
        actIndex: 0, actSlug: null, actTitle: null, actStartedAt: null, nextBeatAt: null,
        postgameStage: null, postgameEndsAt: null,
        unlockedRooms: ['grand-foyer'], releasedClues: [], finalAccusationOpen: false,
        timer: { status: 'idle', durationSeconds: 0, remainingSeconds: 0, endsAt: null },
        maxPlayers, createdAt, updatedAt: createdAt, reveal: null, reunion: null, awards: null, narrator: null,
      };
      const player = {
        id: playerId, sessionId, displayName, avatarUrl: null, characterId: 'nicole-larose', isHost: true,
        evidence: [], discoveries: [], personalUnlockedRooms: ['grand-foyer'], journal: [],
        connected: false, joinedAt: createdAt, lastSeenAt: createdAt,
      };
      addStartingEvidence(player, player.characterId);
      state.sessions[sessionId] = session;
      state.players[playerId] = player;
      state.tokens[issued.hash] = { playerId, createdAt: issued.createdAt, expiresAt: issued.expiresAt, revokedAt: null };
      ensureCollections(state, sessionId);
      state.mysteries[sessionId] = selectMystery({ sessionId, secret: this.sessionSecret, randomInt: this.randomInt });
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
      ensureCollections(state, session.id);
      const players = sessionPlayers(state, session.id);
      assert(players.length < session.maxPlayers, 409, 'GAME_FULL', 'That game has reached its player limit.');
      assert(!players.some((player) => player.displayName.toLocaleLowerCase() === displayName.toLocaleLowerCase()), 409, 'NAME_IN_USE', 'That display name is already in use in this game.');
      const humanIds = new Set(players.map((player) => player.characterId).filter(Boolean));
      let autoCharacter = availableCharacters().find((character) => !humanIds.has(character.id) && character.id !== 'nicole-larose')?.id ?? null;
      if (session.status !== 'lobby') {
        const npc = sessionNpcs(state, session.id).find((item) => item.characterId === autoCharacter) ?? sessionNpcs(state, session.id)[0];
        if (npc) {
          autoCharacter = npc.characterId;
          delete state.npcs[session.id][npc.id];
        }
      }
      const joinedAt = iso();
      const player = {
        id: playerId, sessionId: session.id, displayName, avatarUrl: null, characterId: autoCharacter, isHost: false,
        evidence: [], discoveries: [], personalUnlockedRooms: ['grand-foyer'], journal: [],
        connected: false, joinedAt, lastSeenAt: joinedAt,
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
    return { tokenHash, player, session: assertSession(state, player.sessionId) };
  }

  async revokeToken(tokenHash) {
    await this.store.mutate((state) => { if (state.tokens[tokenHash]) state.tokens[tokenHash].revokedAt = iso(); });
  }

  async setAvatar(playerId, avatar) {
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      if (typeof avatar === 'string') {
        player.avatarUrl = avatar;
        delete player.avatarAsset;
      } else {
        assert(avatar && typeof avatar.data === 'string' && typeof avatar.mimeType === 'string', 400, 'INVALID_AVATAR', 'Avatar data is invalid.');
        player.avatarAsset = { mimeType: avatar.mimeType, data: avatar.data };
        player.avatarUrl = `/api/avatars/${encodeURIComponent(player.id)}?v=${crypto.createHash('sha256').update(avatar.data).digest('hex').slice(0, 12)}`;
      }
      player.lastSeenAt = iso();
      return publicPlayer(player);
    });
  }

  async avatarAsset(playerId) {
    const state = await this.store.read();
    const player = state.players[playerId];
    assert(player?.avatarAsset?.data && player.avatarAsset?.mimeType, 404, 'AVATAR_NOT_FOUND', 'That avatar is no longer available.');
    return structuredClone(player.avatarAsset);
  }

  async snapshot(playerId) {
    const state = await this.store.read();
    const player = assertPlayer(state, playerId);
    const session = assertSession(state, player.sessionId);
    ensureCollections(state, session.id);
    const mystery = state.mysteries[session.id];
    const evidenceViews = publicEvidenceViews(state, session, mystery);
    const progressByInteraction = state.interactionProgress[session.id]?.[player.id] ?? {};
    const interactions = MANSION_INTERACTIONS.map((definition) => ({
      ...publicInteraction(definition, progressByInteraction[definition.id]),
      available: (session.actIndex ?? 0) >= definition.minAct && hasRoomAccess(session, player, definition.roomId),
      locked: (session.actIndex ?? 0) < definition.minAct || !hasRoomAccess(session, player, definition.roomId),
      requiresInput: Boolean(definition.solution
        && (progressByInteraction[definition.id]?.sequence?.length ?? 0) === definition.requiredSequence.length - 1
        && !(progressByInteraction[definition.id]?.completedAt)),
    }));
    return {
      session: publicSession(session),
      me: {
        ...publicPlayer(player),
        character: privateCharacterFor(state, session, player.characterId),
        evidence: (player.evidence ?? []).map((record) => serializeEvidence(record, mystery)).filter(Boolean),
        discoveries: [...(player.discoveries ?? [])],
        personalUnlockedRooms: [...(player.personalUnlockedRooms ?? [])],
        journal: [...(player.journal ?? [])],
        confessionals: structuredClone(state.confessionals[session.id]?.[player.id] ?? []),
      },
      players: sessionPlayers(state, session.id).map(publicPlayer),
      npcs: sessionNpcs(state, session.id).map(publicNpc),
      rooms: rooms.map((room) => {
        const unlocked = hasRoomAccess(session, player, room.id);
        return {
          ...publicRoom(room),
          unlocked,
          interactions: interactions.filter((item) => item.roomId === room.id),
          plantedEvidence: unlocked ? evidenceViews.planted.filter((item) => item.acquired?.roomId === room.id) : [],
        };
      }),
      interactions,
      publicEvidence: evidenceViews.revealed,
      hotspots: hotspots.map(publicHotspot),
      characters: characters.map(publicCharacter),
      timeline: structuredClone(state.engineEvents[session.id] ?? []),
      messages: this.#visibleMessages(state, player).slice(-150),
      accusation: state.accusations[session.id]?.[player.id] ?? null,
      serverTime: iso(),
    };
  }

  async hostDashboard(playerId) {
    const state = await this.store.read();
    const host = assertPlayer(state, playerId);
    assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can use this control.');
    const session = assertSession(state, host.sessionId);
    return {
      session: publicSession(session),
      players: sessionPlayers(state, session.id).map((player) => ({
        ...publicPlayer(player), characterId: player.characterId,
        discoveryCount: player.discoveries?.length ?? 0,
      })),
      characters: availableCharacters().map(publicCharacter),
      npcCount: sessionNpcs(state, session.id).length,
      accusationCount: Object.keys(state.accusations[session.id] ?? {}).length,
      recentActivity: state.audit.filter((event) => event.sessionId === session.id).slice(-100).reverse().map((event) => ({
        id: event.id, type: event.type, actorId: event.actorId ?? null, createdAt: event.createdAt,
      })),
      messageCount: state.messages[session.id]?.length ?? 0,
    };
  }

  async assignCharacter(hostId, targetPlayerId, characterIdInput) {
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can assign characters.');
      const session = assertSession(state, host.sessionId);
      assert(session.status === 'lobby', 409, 'GAME_ALREADY_STARTED', 'Character assignments lock when the story begins.');
      const target = assertPlayer(state, targetPlayerId);
      assert(target.sessionId === session.id, 404, 'PLAYER_NOT_FOUND', 'Player not found in this game.');
      const requested = characterIdInput === null ? null : cleanText(characterIdInput, { name: 'characterId', max: 80 });
      const definition = requested ? getCharacter(requested) : null;
      assert(!requested || definition, 400, 'UNKNOWN_CHARACTER', 'That character does not exist.');
      const characterId = definition?.id ?? null;
      assert(!target.isHost || characterId === 'nicole-larose', 409, 'CREATOR_ROLE_LOCKED', 'The session creator always plays Nicole LaRose.');
      assert(characterId !== 'nicole-larose' || target.isHost, 409, 'CREATOR_ROLE_LOCKED', 'Nicole LaRose belongs to the session creator.');
      if (characterId) {
        const used = sessionPlayers(state, session.id).find((player) => player.id !== target.id && player.characterId === characterId);
        assert(!used, 409, 'CHARACTER_ASSIGNED', 'That character is already assigned to another player.');
      }
      target.evidence = (target.evidence ?? []).filter((item) => !item.startingCharacterId);
      target.characterId = characterId;
      addStartingEvidence(target, characterId);
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'character.assigned', payload: { targetPlayerId, characterId } });
      return publicPlayer(target);
    });
  }

  #populateNpcs(state, session, requestedCount, at) {
    ensureCollections(state, session.id);
    const existing = sessionNpcs(state, session.id);
    if (existing.length) return existing;
    const humans = sessionPlayers(state, session.id);
    const assigned = new Set(humans.map((player) => player.characterId).filter(Boolean));
    const candidates = availableCharacters().filter((character) => !assigned.has(character.id));
    const defaultCount = Math.max(0, Math.min(candidates.length, 12 - humans.length));
    const count = requestedCount === undefined ? defaultCount : Math.max(0, Math.min(candidates.length, Number(requestedCount) || 0));
    for (const character of candidates.slice(0, count)) {
      const id = `npc-${randomId()}`;
      state.npcs[session.id][id] = {
        id, npcId: id, participantId: id, sessionId: session.id, characterId: character.id, displayName: character.name,
        memory: [], evidence: [], joinedAt: iso(at), lastSeenAt: iso(at),
      };
    }
    return sessionNpcs(state, session.id);
  }

  #promptConfessionals(state, session, at) {
    ensureCollections(state, session.id);
    const latest = state.engineEvents[session.id].at(-1)?.text ?? null;
    const actions = state.evidenceActions[session.id] ?? [];
    for (const player of sessionPlayers(state, session.id)) {
      const records = state.confessionals[session.id][player.id] ??= [];
      if (records.some((item) => item.actIndex === session.actIndex)) continue;
      const character = privateCharacterFor(state, session, player.characterId);
      records.push({
        id: randomId(), participantId: player.id, playerId: player.id, actIndex: session.actIndex,
        prompt: confessionalQuestion({
          act: session.actIndex,
          characterName: character?.name ?? player.displayName,
          latestPublicEvent: latest,
          hasManipulatedEvidence: actions.some((item) => item.playerId === player.id),
        }),
        response: null, private: true, createdAt: iso(at), sealedAt: null,
      });
    }
    for (const npc of sessionNpcs(state, session.id)) {
      const records = state.confessionals[session.id][npc.id] ??= [];
      if (records.some((item) => item.actIndex === session.actIndex)) continue;
      const character = getCharacter(npc.characterId);
      records.push({
        id: randomId(), participantId: npc.id, npcId: npc.id, actIndex: session.actIndex,
        prompt: confessionalQuestion({ act: session.actIndex, characterName: character?.name ?? npc.displayName, latestPublicEvent: latest, hasManipulatedEvidence: false }),
        response: npcConfessional({ character, act: session.actIndex }), private: true,
        createdAt: iso(at), sealedAt: iso(at),
      });
    }
  }

  #runNpcBeat(state, session, at) {
    const mystery = this.#ensureMystery(state, session);
    const roster = availableCharacters().filter((character) => character.id !== 'nicole-larose');
    sessionNpcs(state, session.id).forEach((npc, index) => {
      const activity = session.actIndex === 1 ? 'alliance' : session.actIndex === 2 ? 'investigated' : session.actIndex === 3 ? 'theory' : session.actIndex === 4 ? 'betrayal' : 'vote';
      npc.memory ??= [];
      npc.memory.push({ type: activity, actIndex: session.actIndex, createdAt: iso(at) });
      if (npc.memory.length > 30) npc.memory.shift();
      addAudit(state, { sessionId: session.id, actorId: npc.id, type: `npc.${activity}` }, at);
      if (session.actIndex === 5 && !state.accusations[session.id][npc.id]) {
        const suspect = index % 3 === 0
          ? mystery.murdererId
          : roster[(index + session.actIndex) % roster.length]?.id ?? mystery.murdererId;
        state.accusations[session.id][npc.id] = {
          playerId: npc.id, npcId: npc.id, suspectCharacterId: suspect,
          theory: 'My vote follows the timeline, access, and corroborated physical evidence.', submittedAt: iso(at),
        };
      }
    });
  }

  #enterAct(state, session, index, at) {
    const act = actDefinition(index);
    assert(act, 500, 'ACT_NOT_CONFIGURED', 'The autonomous story act is missing.');
    session.actIndex = index;
    session.actSlug = act.slug;
    session.actTitle = act.title;
    session.phase = act.title;
    session.round = index;
    session.status = index === 5 ? 'accusation' : 'running';
    session.finalAccusationOpen = index === 5;
    session.postgameStage = null;
    session.actStartedAt = iso(at);
    const durationSeconds = actDurationSeconds(index, session.mode);
    session.nextBeatAt = iso(millis(at) + durationSeconds * 1000);
    session.timer = { status: 'running', durationSeconds, remainingSeconds: durationSeconds, endsAt: session.nextBeatAt };
    session.unlockedRooms = [...new Set([...session.unlockedRooms, ...act.rooms])];
    addEngineEvent(state, session, {
      type: 'act.changed', title: act.title, text: act.narrator,
      actions: [{ label: index < 3 ? 'Enter the mansion' : 'Review the evidence', view: index < 3 ? 'mansion' : 'case' }],
    }, at);
    this.#promptConfessionals(state, session, at);
    this.#runNpcBeat(state, session, at);
    addAudit(state, { sessionId: session.id, actorId: null, type: 'engine.act.changed', payload: { actIndex: index } }, at);
  }

  async startAutonomous(hostId, input = {}) {
    const mode = input.mode === 'fast' && this.allowFastMode ? 'fast' : 'standard';
    const npcCount = input.npcCount === undefined ? undefined : asInteger(input.npcCount, { name: 'npcCount', min: 0, max: 20 });
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the session creator can begin the experience.');
      const session = assertSession(state, host.sessionId);
      if (session.actIndex > 0) return publicSession(session);
      session.mode = mode;
      const startedAt = Date.now();
      session.startedAt = iso(startedAt);
      this.#populateNpcs(state, session, npcCount, startedAt);
      this.#enterAct(state, session, 1, startedAt);
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'game.autonomous.started', payload: { mode, npcCount: sessionNpcs(state, session.id).length } }, startedAt);
      return publicSession(session, startedAt);
    });
  }

  #participant(state, sessionId, participantId) {
    const player = state.players[participantId];
    if (player?.sessionId === sessionId) return { ...publicPlayer(player), participantId: player.id };
    const npc = state.npcs[sessionId]?.[participantId];
    if (npc) return { ...publicNpc(npc), participantId: npc.id };
    return null;
  }

  #beginReveal(state, session, at) {
    const mystery = this.#ensureMystery(state, session);
    const accusations = Object.values(state.accusations[session.id] ?? {});
    const tally = accusations.reduce((result, item) => {
      result[item.suspectCharacterId] = (result[item.suspectCharacterId] ?? 0) + 1;
      return result;
    }, {});
    session.reveal = {
      murderer: publicCharacter(getCharacter(mystery.murdererId)),
      weapon: mystery.weapon,
      motive: mystery.motive,
      method: mystery.method,
      timeline: [...mystery.timeline],
      summary: mystery.summary,
      tally,
      correctPlayerIds: accusations.filter((item) => state.players[item.playerId]?.sessionId === session.id && item.suspectCharacterId === mystery.murdererId).map((item) => item.playerId),
      correctNpcIds: accusations.filter((item) => state.npcs[session.id]?.[item.playerId] && item.suspectCharacterId === mystery.murdererId).map((item) => item.playerId),
      revealedAt: iso(at),
    };
    session.status = 'reveal';
    session.phase = 'The Truth Revealed';
    session.postgameStage = 'reveal';
    session.finalAccusationOpen = false;
    session.actStartedAt = iso(at);
    const durationSeconds = stageDurationSeconds('reveal', session.mode);
    session.nextBeatAt = iso(millis(at) + durationSeconds * 1000);
    session.timer = { status: 'running', durationSeconds, remainingSeconds: durationSeconds, endsAt: session.nextBeatAt };
    addEngineEvent(state, session, {
      type: 'solution.revealed', title: `${session.reveal.murderer.name} killed Vivienne`, text: mystery.summary,
      actions: [{ label: 'Review the final case', view: 'case' }],
    }, at);
    addAudit(state, { sessionId: session.id, actorId: null, type: 'engine.solution.revealed' }, at);
  }

  #buildReunion(state, session, at) {
    const receipts = [];
    const participants = [
      ...sessionPlayers(state, session.id).map((player) => ({ id: player.id, name: player.displayName, characterId: player.characterId, isNpc: false })),
      ...sessionNpcs(state, session.id).map((npc) => ({ id: npc.id, name: npc.displayName, characterId: npc.characterId, isNpc: true })),
    ];
    for (const participant of participants) {
      const records = state.confessionals[session.id]?.[participant.id] ?? [];
      const answered = [...records].reverse().find((item) => item.response);
      const activityCount = state.audit.filter((event) => event.sessionId === session.id && event.actorId === participant.id).length;
      receipts.push({
        participantId: participant.id,
        playerId: participant.isNpc ? undefined : participant.id,
        npcId: participant.isNpc ? participant.id : undefined,
        participantName: participant.name,
        characterName: getCharacter(participant.characterId)?.name ?? participant.name,
        quote: answered?.response ?? 'I kept my private counsel when the producer called.',
        receipt: `${activityCount} verified game action${activityCount === 1 ? '' : 's'} recorded.`,
        actIndex: answered?.actIndex ?? null,
      });
    }
    return {
      title: 'The LaRose Reunion: Receipts on the Table',
      introduction: 'Every guest faces a private confession and a server-verified receipt from the night.',
      receipts,
      segments: receipts,
      startedAt: iso(at),
    };
  }

  #scoreParticipant(state, session, participant, category) {
    const audit = state.audit.filter((event) => event.sessionId === session.id && event.actorId === participant.id);
    const actions = (state.evidenceActions[session.id] ?? []).filter((item) => item.playerId === participant.id);
    const messages = (state.messages[session.id] ?? []).filter((item) => item.senderPlayerId === participant.id);
    const accusations = Object.values(state.accusations[session.id] ?? {});
    const ownAccusation = state.accusations[session.id]?.[participant.id];
    const characterId = participant.characterId;
    const confessionLength = (state.confessionals[session.id]?.[participant.id] ?? []).reduce((sum, item) => sum + (item.response?.length ?? 0), 0);
    const scores = {
      'best-detective': (ownAccusation?.suspectCharacterId === state.mysteries[session.id].murdererId ? 50 : 0) + audit.filter((item) => /investigated/.test(item.type)).length * 3,
      'biggest-snake': actions.filter((item) => ['conceal', 'plant'].includes(item.action)).length * 8 + messages.filter((item) => item.type === 'anonymous').length * 3,
      'best-liar': messages.filter((item) => item.type === 'anonymous').length * 5 + (characterId === state.mysteries[session.id].murdererId ? 10 : 0),
      'most-betrayed': (state.messages[session.id] ?? []).filter((item) => item.recipientPlayerId === participant.id).length + audit.filter((item) => /betrayal/.test(item.type)).length,
      'messiest-family-member': audit.length + actions.length * 2 + messages.length,
      'most-suspicious': accusations.filter((item) => item.suspectCharacterId === characterId).length * 10,
      'best-npc-performance': participant.isNpc ? (participant.memory?.length ?? 0) * 5 + messages.length : -1,
      'drama-queen-king': confessionLength + messages.length * 20,
    };
    return scores[category] ?? 0;
  }

  #buildAwards(state, session, at) {
    const participants = [
      ...sessionPlayers(state, session.id).map((player) => ({ id: player.id, name: player.displayName, characterId: player.characterId, isNpc: false })),
      ...sessionNpcs(state, session.id).map((npc) => ({ ...npc, name: npc.displayName, isNpc: true })),
    ];
    const winners = AWARD_CATEGORIES.map(([category, title]) => {
      const eligible = category === 'best-npc-performance' ? participants.filter((item) => item.isNpc) : participants;
      const ranked = (eligible.length ? eligible : participants).map((participant) => ({ participant, score: this.#scoreParticipant(state, session, participant, category) }))
        .sort((left, right) => right.score - left.score || left.participant.name.localeCompare(right.participant.name));
      const top = ranked[0];
      const winner = top?.participant ?? participants[0];
      const score = top?.score ?? 0;
      return {
        id: category, category, title,
        participantId: winner.id,
        winner: { participantId: winner.id, playerId: winner.isNpc ? undefined : winner.id, npcId: winner.isNpc ? winner.id : undefined, name: winner.name, characterName: getCharacter(winner.characterId)?.name, isNpc: winner.isNpc },
        winnerName: winner.name,
        reason: `${score} points from verified messages, discoveries, votes, confessionals, and evidence actions.`,
        receipt: `Server receipt: ${score} category points.`,
        score,
      };
    });
    return { title: 'The Golden Rose Awards', winners, categories: winners, revealedAt: iso(at) };
  }

  #advanceOne(state, session, at) {
    this.#ensureMystery(state, session);
    if (!session.actIndex) return false;
    if (!session.postgameStage) {
      if (session.actIndex < ACTS.length) this.#enterAct(state, session, session.actIndex + 1, at);
      else this.#beginReveal(state, session, at);
      return true;
    }
    if (session.postgameStage === 'reveal') {
      session.reunion = this.#buildReunion(state, session, at);
      session.status = 'reunion';
      session.phase = 'The Reunion';
      session.postgameStage = 'reunion';
      session.actStartedAt = iso(at);
      const durationSeconds = stageDurationSeconds('reunion', session.mode);
      session.nextBeatAt = iso(millis(at) + durationSeconds * 1000);
      session.timer = { status: 'running', durationSeconds, remainingSeconds: durationSeconds, endsAt: session.nextBeatAt };
      addEngineEvent(state, session, { type: 'reunion.started', title: session.reunion.title, text: session.reunion.introduction, actions: [{ label: 'Watch the receipts', view: 'live' }] }, at);
      addAudit(state, { sessionId: session.id, actorId: null, type: 'engine.reunion.started' }, at);
      return true;
    }
    if (session.postgameStage === 'reunion') {
      session.awards = this.#buildAwards(state, session, at);
      session.status = 'awards';
      session.phase = 'The Golden Rose Awards';
      session.postgameStage = 'awards';
      session.actStartedAt = iso(at);
      const durationSeconds = stageDurationSeconds('awards', session.mode);
      session.nextBeatAt = iso(millis(at) + durationSeconds * 1000);
      session.timer = { status: 'running', durationSeconds, remainingSeconds: durationSeconds, endsAt: session.nextBeatAt };
      addEngineEvent(state, session, { type: 'awards.revealed', title: session.awards.title, text: 'The server has counted every receipt and crowned the night’s most memorable players.', actions: [{ label: 'See the winners', view: 'live' }] }, at);
      addAudit(state, { sessionId: session.id, actorId: null, type: 'engine.awards.revealed' }, at);
      return true;
    }
    if (session.postgameStage === 'awards') {
      session.status = 'complete';
      session.phase = 'Case Closed';
      session.postgameStage = 'complete';
      session.nextBeatAt = null;
      session.timer = { status: 'idle', durationSeconds: 0, remainingSeconds: 0, endsAt: null };
      addEngineEvent(state, session, { type: 'game.complete', title: 'Case Closed', text: 'The LaRose Estate releases its guests—but never their secrets.' }, at);
      addAudit(state, { sessionId: session.id, actorId: null, type: 'engine.complete' }, at);
      return true;
    }
    return false;
  }

  async advanceEngine(sessionId, options = {}) {
    const at = millis(options.now ?? Date.now());
    return this.store.mutate((state) => {
      const session = assertSession(state, sessionId);
      if (!session.actIndex || session.status === 'complete' || session.status === 'paused') return { changed: false, sessionId, session: publicSession(session, at), events: [] };
      const due = options.force || (session.nextBeatAt && millis(session.nextBeatAt) <= at);
      if (!due) return { changed: false, sessionId, session: publicSession(session, at), events: [] };
      const before = state.engineEvents[session.id]?.length ?? 0;
      let changed = false;
      let transitions = 0;
      const maximumTransitions = ACTS.length + 4;
      if (options.force) {
        changed = this.#advanceOne(state, session, at);
        transitions = changed ? 1 : 0;
      } else {
        while (
          transitions < maximumTransitions
          && session.status !== 'complete'
          && session.status !== 'paused'
          && session.nextBeatAt
          && millis(session.nextBeatAt) <= at
        ) {
          const scheduledAt = millis(session.nextBeatAt);
          const advanced = this.#advanceOne(state, session, scheduledAt);
          if (!advanced) break;
          changed = true;
          transitions += 1;
        }
      }
      session.updatedAt = iso(at);
      return { changed, transitions, sessionId, session: publicSession(session, at), events: structuredClone((state.engineEvents[session.id] ?? []).slice(before)) };
    });
  }

  async tick(at = Date.now()) {
    const state = await this.store.read();
    const due = Object.values(state.sessions).filter((session) => session.actIndex && session.status !== 'complete' && session.status !== 'paused' && session.nextBeatAt && millis(session.nextBeatAt) <= millis(at));
    const results = [];
    for (const session of due) results.push(await this.advanceEngine(session.id, { now: at }));
    return { changed: results.some((item) => item.changed), sessionIds: results.filter((item) => item.changed).map((item) => item.sessionId), results };
  }

  async investigate(playerId, hotspotIdInput) {
    const hotspotId = cleanText(hotspotIdInput, { name: 'hotspotId', max: 100 });
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const session = assertSession(state, player.sessionId);
      assert(['running', 'accusation'].includes(session.status), 409, 'GAME_NOT_ACTIVE', session.status === 'paused' ? 'The investigation is paused for an emergency.' : 'The investigation has not started.');
      const hotspot = getHotspot(hotspotId);
      assert(hotspot, 404, 'HOTSPOT_NOT_FOUND', 'That object cannot be investigated.');
      const roomId = hotspotRoomId(hotspot);
      assert(hasRoomAccess(session, player, roomId), 403, 'ROOM_LOCKED', 'That room is still locked.');
      if (hotspot.requiresRelease || hotspot.releasedClueId) {
        const clueId = hotspot.releasedClueId ?? hotspot.id;
        assert(session.releasedClues.includes(clueId), 403, 'CLUE_NOT_RELEASED', 'That clue has not entered play yet.');
      }
      const requiredEvidenceId = hotspot.requiredEvidenceId ?? hotspot.requiresEvidenceId;
      if (requiredEvidenceId) assert(playerEvidenceIds(player).has(requiredEvidenceId), 403, 'REQUIRED_EVIDENCE_MISSING', 'You do not have the item needed to investigate this object.');
      const alreadyFound = player.discoveries.includes(hotspotId);
      const discovery = getDiscovery(hotspot, player.characterId);
      const mystery = state.mysteries[session.id];
      const granted = [];
      if (!alreadyFound || hotspot.repeatable) {
        for (const evidenceId of discoveryEvidenceIds(hotspot, discovery)) {
          const evidenceItem = getEvidence(evidenceId);
          const availableRound = Number(evidenceItem?.availabilityRound ?? 1);
          if (availableRound > session.round && !session.releasedClues.includes(evidenceId)) continue;
          const addition = addEvidence(player, evidenceId, { sourceHotspotId: hotspotId });
          if (addition.added) granted.push(serializeEvidence(addition.record, mystery));
        }
        if (!alreadyFound) player.discoveries.push(hotspotId);
      }
      const unlockedRooms = [];
      const roomToUnlock = discovery.unlocksRoomId ?? hotspot.unlocksRoomId;
      if (roomToUnlock && !player.personalUnlockedRooms.includes(roomToUnlock)) {
        player.personalUnlockedRooms.push(roomToUnlock);
        unlockedRooms.push(roomToUnlock);
      }
      if (!alreadyFound || hotspot.repeatable) {
        const record = { id: randomId(), playerId, hotspotId, roomId, characterId: player.characterId, evidenceIds: granted.map((item) => item.id), createdAt: iso() };
        state.investigations[session.id].push(record);
        addAudit(state, { sessionId: session.id, actorId: player.id, type: 'hotspot.investigated', payload: { hotspotId, evidenceCount: record.evidenceIds.length } });
      }
      player.lastSeenAt = iso();
      const scenarioNarrative = mystery?.hotspotNarratives?.[hotspotId];
      const roleNarrative = discovery.narrative ?? discovery.text ?? discovery.description;
      const narrative = discovery.isRoleSpecific
        ? `${scenarioNarrative ?? hotspot.inspectionText ?? hotspot.description ?? ''} ${adaptText(roleNarrative, mystery)}`.trim()
        : scenarioNarrative ?? roleNarrative ?? hotspot.inspectionText ?? hotspot.description;
      return {
        hotspot: publicHotspot(hotspot),
        narrative: alreadyFound && !hotspot.repeatable ? `You already documented this lead. ${narrative}` : narrative,
        journalPrompt: discovery.journalPrompt ?? null,
        roleSpecific: Boolean(discovery.isRoleSpecific),
        closeup: discovery.closeup ?? hotspot.closeup ?? hotspot.image,
        evidence: granted,
        unlockedRooms,
        alreadyInvestigated: alreadyFound,
      };
    });
  }

  async interact(playerId, input = {}) {
    const interactionId = cleanText(input.hotspotId ?? input.interactionId, { name: 'hotspotId', max: 100 });
    if (getHotspot(interactionId)) return this.investigate(playerId, interactionId);
    const action = cleanText(input.action ?? 'examine', { name: 'action', max: 60 }).toLowerCase();
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const session = assertSession(state, player.sessionId);
      assert(['running', 'accusation'].includes(session.status), 409, 'GAME_NOT_ACTIVE', 'The investigation is not active.');
      const definition = getInteraction(interactionId);
      assert(definition, 404, 'INTERACTION_NOT_FOUND', 'That mansion interaction does not exist.');
      assert(hasRoomAccess(session, player, definition.roomId), 403, 'ROOM_LOCKED', 'That room is still locked.');
      assert(session.actIndex >= definition.minAct, 409, 'INTERACTION_NOT_READY', `This lead becomes active in Act ${definition.minAct}.`);
      state.interactionProgress[session.id][player.id] ??= {};
      const progress = state.interactionProgress[session.id][player.id][interactionId] ??= { sequence: [], completedAt: null };
      if (progress.completedAt) return { interaction: publicInteraction(definition, progress), evidence: [], completed: true, alreadyCompleted: true };
      const expected = definition.requiredSequence[progress.sequence.length];
      assert(action === expected, 409, 'WRONG_INTERACTION_STEP', `Try “${expected}” next.`);
      if (definition.solution && action === definition.requiredSequence.at(-1)) {
        const answer = String(input.input ?? input.answer ?? '').trim().replace(/\D/g, '');
        assert(answer === definition.solution, 409, 'PUZZLE_INCORRECT', 'The dial clicks back into place. That combination is not correct.');
      }
      progress.sequence.push(action);
      progress.updatedAt = iso();
      const granted = [];
      if (progress.sequence.length === definition.requiredSequence.length) {
        progress.completedAt = iso();
        for (const evidenceId of definition.evidenceIds ?? []) {
          const addition = addEvidence(player, evidenceId, { sourceInteractionId: interactionId });
          if (addition.added) granted.push(serializeEvidence(addition.record, state.mysteries[session.id]));
        }
      }
      addAudit(state, { sessionId: session.id, actorId: player.id, type: progress.completedAt ? 'interaction.completed' : 'interaction.progressed', payload: { interactionId, step: progress.sequence.length } });
      return {
        interaction: publicInteraction(definition, progress), evidence: granted,
        completed: Boolean(progress.completedAt), alreadyCompleted: false,
        narrative: progress.completedAt ? `${definition.name} yields a documented clue.` : `${definition.name}: the first layer gives way, but another step remains.`,
      };
    });
  }

  async evidenceAction(playerId, evidenceIdInput, input = {}) {
    const evidenceId = cleanText(evidenceIdInput, { name: 'evidenceId', max: 100 });
    const action = cleanText(input.action, { name: 'action', max: 20 }).toLowerCase();
    assert(['conceal', 'reveal', 'plant'].includes(action), 400, 'INVALID_EVIDENCE_ACTION', 'Action must be conceal, reveal, or plant.');
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const session = assertSession(state, player.sessionId);
      const owned = player.evidence.find((item) => item.evidenceId === evidenceId);
      assert(owned, 403, 'EVIDENCE_NOT_OWNED', 'You cannot manipulate evidence you do not possess.');
      let roomId = input.roomId ?? null;
      let hotspotId = input.hotspotId ?? null;
      if (action === 'plant') {
        roomId = cleanText(roomId, { name: 'roomId', max: 80 });
        assert(getRoom(roomId), 404, 'ROOM_NOT_FOUND', 'That room does not exist.');
        assert(hasRoomAccess(session, player, roomId), 403, 'ROOM_LOCKED', 'You cannot plant evidence in a locked room.');
        if (hotspotId) {
          hotspotId = cleanText(hotspotId, { name: 'hotspotId', max: 100 });
          const hotspot = getHotspot(hotspotId);
          assert(hotspot && hotspotRoomId(hotspot) === roomId, 400, 'INVALID_PLANT_LOCATION', 'That object is not in the selected room.');
        }
      }
      const record = {
        id: randomId(), sessionId: session.id, playerId: player.id, evidenceId, action,
        roomId, hotspotId, createdAt: iso(),
      };
      state.evidenceActions[session.id].push(record);
      owned.visibility = action === 'conceal' ? 'concealed' : action === 'reveal' ? 'revealed' : 'planted';
      if (action === 'plant') owned.plantedAt = { roomId, hotspotId: record.hotspotId, createdAt: record.createdAt };
      addAudit(state, { sessionId: session.id, actorId: player.id, type: `evidence.${action}`, payload: { evidenceId, roomId } });
      return { action, evidence: serializeEvidence(owned, state.mysteries[session.id]), receipt: record };
    });
  }

  async actOnEvidence(playerId, evidenceId, input) {
    return this.evidenceAction(playerId, evidenceId, input);
  }

  async getConfessionals(playerId) {
    const state = await this.store.read();
    const player = assertPlayer(state, playerId);
    return structuredClone(state.confessionals[player.sessionId]?.[player.id] ?? []);
  }

  async respondConfessional(playerId, confessionalId, responseInput) {
    const response = cleanText(responseInput, { name: 'response', min: 2, max: 1500 });
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const records = state.confessionals[player.sessionId]?.[player.id] ?? [];
      const record = records.find((item) => item.id === confessionalId);
      assert(record, 404, 'CONFESSIONAL_NOT_FOUND', 'That private prompt was not found.');
      assert(!record.response, 409, 'CONFESSIONAL_SEALED', 'That response is already sealed.');
      record.response = response;
      record.sealedAt = iso();
      addAudit(state, { sessionId: player.sessionId, actorId: player.id, type: 'confessional.sealed', payload: { actIndex: record.actIndex } });
      return structuredClone(record);
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
      addAudit(state, { sessionId: session.id, actorId: player.id, type: 'room.unlocked.personal', payload: { roomId } });
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
      addAudit(state, { sessionId: sender.sessionId, actorId: sender.id, type: 'evidence.shared', payload: { targetPlayerId } });
      return { targetPlayerId, evidence: serializeEvidence(addition.record, state.mysteries[sender.sessionId]), added: addition.added };
    });
  }

  async addJournalEntry(playerId, textInput) {
    const text = cleanText(textInput, { name: 'text', max: 2000 });
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const timestamp = iso();
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
      entry.updatedAt = iso();
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
      ensureCollections(state, session.id);
      let recipientPlayerId = input.recipientPlayerId ?? null;
      let roomId = input.roomId ?? null;
      let npcRecipient = null;
      if (type === 'direct' || (type === 'anonymous' && recipientPlayerId)) {
        const humanRecipient = state.players[recipientPlayerId];
        npcRecipient = state.npcs[session.id]?.[recipientPlayerId] ?? null;
        assert((humanRecipient?.sessionId === session.id || npcRecipient) && recipientPlayerId !== sender.id, 404, 'PLAYER_NOT_FOUND', 'Message recipient not found in this game.');
      } else recipientPlayerId = null;
      if (type === 'room') {
        roomId = cleanText(roomId, { name: 'roomId', max: 80 });
        assert(getRoom(roomId), 404, 'ROOM_NOT_FOUND', 'That room does not exist.');
        assert(hasRoomAccess(session, sender, roomId), 403, 'ROOM_LOCKED', 'You cannot message from a locked room.');
      } else roomId = null;
      const timestamp = iso();
      const message = { id: randomId(), sessionId: session.id, type, senderPlayerId: sender.id, recipientPlayerId, roomId, content, createdAt: timestamp };
      state.messages[session.id].push(message);
      if (npcRecipient && type === 'direct') {
        npcRecipient.memory ??= [];
        const previousMemory = npcRecipient.memory.filter((item) => item.fromPlayerId === sender.id);
        npcRecipient.memory.push({ fromPlayerId: sender.id, content, createdAt: timestamp });
        const reply = ruleBasedNpcReply({ character: getCharacter(npcRecipient.characterId), message: content, previousMemory, act: session.actIndex || 1 });
        const npcMessage = { id: randomId(), sessionId: session.id, type: 'direct', senderPlayerId: npcRecipient.id, recipientPlayerId: sender.id, roomId: null, content: reply, createdAt: iso(Date.now() + 1) };
        state.messages[session.id].push(npcMessage);
        npcRecipient.lastSeenAt = npcMessage.createdAt;
        message.generatedMessageIds = [npcMessage.id];
        addAudit(state, { sessionId: session.id, actorId: npcRecipient.id, type: 'npc.conversation' });
      }
      if (state.messages[session.id].length > MAX_MESSAGES_PER_SESSION) state.messages[session.id].splice(0, state.messages[session.id].length - MAX_MESSAGES_PER_SESSION);
      sender.lastSeenAt = timestamp;
      addAudit(state, { sessionId: session.id, actorId: sender.id, type: 'message.sent', payload: { type } });
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
    return (state.messages[viewer.sessionId] ?? []).filter((message) => {
      if (message.type === 'direct') return message.senderPlayerId === viewer.id || message.recipientPlayerId === viewer.id;
      if (message.type === 'anonymous' && message.recipientPlayerId) return message.senderPlayerId === viewer.id || message.recipientPlayerId === viewer.id || viewer.isHost;
      if (message.type === 'room') return hasRoomAccess(state.sessions[viewer.sessionId], viewer, message.roomId);
      return true;
    }).map((message) => this.serializeMessage(message, viewer, state));
  }

  serializeMessage(message, viewer, state) {
    const anonymousToViewer = message.type === 'anonymous' && message.senderPlayerId !== viewer.id;
    const sender = state.players[message.senderPlayerId];
    const npc = state.npcs[viewer.sessionId]?.[message.senderPlayerId];
    const senderView = sender ? publicPlayer(sender) : npc ? publicNpc(npc) : null;
    return {
      id: message.id, type: message.type, content: message.content, roomId: message.roomId,
      recipientPlayerId: message.recipientPlayerId,
      sender: anonymousToViewer ? null : senderView,
      anonymous: message.type === 'anonymous', isMine: message.senderPlayerId === viewer.id,
      createdAt: message.createdAt,
      ...(viewer.isHost && anonymousToViewer ? { moderationSender: senderView } : {}),
    };
  }

  async setGameControls(hostId, input) {
    const action = input.action ? cleanText(input.action, { name: 'action', max: 30 }).toLowerCase() : null;
    if (action === 'start') return this.startAutonomous(hostId, { mode: input.mode, npcCount: input.npcCount });
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can change game controls.');
      const session = assertSession(state, host.sessionId);
      if (action === 'resume') {
        assert(session.actIndex > 0, 409, 'GAME_NOT_STARTED', 'Start the autonomous story first.');
        const seconds = Math.max(1, session.pausedRemainingSeconds ?? actDurationSeconds(session.actIndex, session.mode));
        session.status = session.pausedFromStatus
          ?? (session.postgameStage === 'reveal' ? 'reveal'
            : session.postgameStage === 'reunion' ? 'reunion'
              : session.postgameStage === 'awards' ? 'awards'
                : session.actIndex === 5 ? 'accusation' : 'running');
        session.nextBeatAt = iso(Date.now() + seconds * 1000);
        session.timer = { status: 'running', durationSeconds: seconds, remainingSeconds: seconds, endsAt: session.nextBeatAt };
        delete session.pausedFromStatus;
        delete session.pausedRemainingSeconds;
      } else if (action === 'pause') {
        assert(session.actIndex > 0 && session.status !== 'complete', 409, 'GAME_NOT_ACTIVE', 'Only an active story can be paused.');
        session.pausedRemainingSeconds = session.nextBeatAt ? Math.max(1, Math.ceil((millis(session.nextBeatAt) - Date.now()) / 1000)) : 1;
        session.pausedFromStatus = session.status;
        session.status = 'paused';
        session.timer = { ...session.timer, status: 'paused', remainingSeconds: session.pausedRemainingSeconds, endsAt: null };
      } else if (action === 'open-accusations') {
        if (session.actIndex < 5) this.#enterAct(state, session, 5, Date.now());
        session.status = 'accusation';
        session.finalAccusationOpen = true;
      } else if (action) {
        throw new AppError(400, 'INVALID_ACTION', 'Action must be start, pause, resume, or open-accusations.');
      }
      if (input.status !== undefined) {
        assert(GAME_STATUSES.has(input.status), 400, 'INVALID_STATUS', 'Invalid game status.');
        session.status = input.status;
      }
      if (input.phase !== undefined) session.phase = cleanText(input.phase, { name: 'phase', max: 80 });
      if (input.round !== undefined) session.round = asInteger(input.round, { name: 'round', min: 0, max: 99 });
      if (input.finalAccusationOpen !== undefined) session.finalAccusationOpen = Boolean(input.finalAccusationOpen);
      session.updatedAt = iso();
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'game.emergency.override', payload: { action, status: session.status } });
      return publicSession(session);
    });
  }

  async adminOverride(hostId, input) {
    const action = cleanText(input?.action, { name: 'action', max: 30 }).toLowerCase();
    const state = await this.store.read();
    const host = assertPlayer(state, hostId);
    assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can trigger an override.');
    const session = assertSession(state, host.sessionId);
    if (action === 'advance' || action === 'advance-act') {
      if (!session.actIndex) return this.startAutonomous(hostId, input);
      return this.advanceEngine(session.id, { force: true });
    }
    if (action === 'trigger-beat') {
      return this.store.mutate((next) => {
        const currentHost = assertPlayer(next, hostId);
        const currentSession = assertSession(next, currentHost.sessionId);
        const event = addEngineEvent(next, currentSession, {
          type: 'narrator.beat',
          title: currentSession.actTitle ?? 'The Estate Narrator',
          text: 'A bell sounds somewhere deeper in the estate. Recheck your strongest theory—and the person who benefits from it.',
          actions: [{ label: 'Review the evidence', view: 'case' }],
        });
        addAudit(next, { sessionId: currentSession.id, actorId: currentHost.id, type: 'game.emergency.beat' });
        return { session: publicSession(currentSession), event };
      });
    }
    return this.setGameControls(hostId, input);
  }

  async hostUnlockRoom(hostId, roomIdInput) {
    const roomId = cleanText(roomIdInput, { name: 'roomId', max: 80 });
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can unlock rooms.');
      const session = assertSession(state, host.sessionId);
      assert(getRoom(roomId), 404, 'ROOM_NOT_FOUND', 'That room does not exist.');
      if (!session.unlockedRooms.includes(roomId)) session.unlockedRooms.push(roomId);
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'room.unlocked.emergency', payload: { roomId } });
      return { roomId, unlocked: true };
    });
  }

  async releaseClue(hostId, clueIdInput, targetPlayerId = null) {
    const clueId = cleanText(clueIdInput, { name: 'clueId', max: 100 });
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can release clues.');
      const session = assertSession(state, host.sessionId);
      const evidenceItem = getEvidence(clueId);
      assert(evidenceItem || getHotspot(clueId), 404, 'CLUE_NOT_FOUND', 'That clue does not exist.');
      if (!session.releasedClues.includes(clueId)) session.releasedClues.push(clueId);
      let grant = null;
      if (targetPlayerId && evidenceItem) {
        const target = assertPlayer(state, targetPlayerId);
        assert(target.sessionId === session.id, 404, 'PLAYER_NOT_FOUND', 'Player not found in this game.');
        const addition = addEvidence(target, clueId, { releasedByEmergencyAdmin: true });
        grant = { playerId: target.id, evidence: serializeEvidence(addition.record, state.mysteries[session.id]), added: addition.added };
      }
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'clue.released.emergency', payload: { clueId, targetPlayerId } });
      return { clueId, released: true, grant };
    });
  }

  async setTimer(hostId, input) {
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can control the timer.');
      const session = assertSession(state, host.sessionId);
      const action = cleanText(input.action ?? 'start', { name: 'action', max: 20 }).toLowerCase();
      const current = timerView(session.timer);
      if (action === 'start') {
        const durationSeconds = asInteger(input.durationSeconds, { name: 'durationSeconds', min: 1, max: 24 * 60 * 60 });
        session.timer = { status: 'running', durationSeconds, remainingSeconds: durationSeconds, endsAt: iso(Date.now() + durationSeconds * 1000) };
      } else if (action === 'pause') session.timer = { ...session.timer, status: 'paused', remainingSeconds: current.remainingSeconds, endsAt: null };
      else if (action === 'resume') {
        assert(current.remainingSeconds > 0, 409, 'TIMER_EXPIRED', 'The timer has no time remaining.');
        session.timer = { ...session.timer, status: 'running', remainingSeconds: current.remainingSeconds, endsAt: iso(Date.now() + current.remainingSeconds * 1000) };
      } else if (action === 'clear') session.timer = { status: 'idle', durationSeconds: 0, remainingSeconds: 0, endsAt: null };
      else throw new AppError(400, 'INVALID_TIMER_ACTION', 'Timer action must be start, pause, resume, or clear.');
      addAudit(state, { sessionId: session.id, actorId: host.id, type: 'timer.emergency.changed', payload: { action } });
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
      assert(!session.reveal, 409, 'GAME_COMPLETE', 'The solution has already been revealed.');
      const accusation = { playerId, suspectCharacterId: getCharacter(suspectCharacterId).id, theory, submittedAt: iso() };
      state.accusations[session.id][player.id] = accusation;
      addAudit(state, { sessionId: session.id, actorId: player.id, type: 'accusation.submitted' });
      return accusation;
    });
  }

  async revealSolution(hostId) {
    return this.store.mutate((state) => {
      const host = assertPlayer(state, hostId);
      assert(host.isHost, 403, 'HOST_ONLY', 'Only the emergency administrator can trigger an early reveal.');
      const session = assertSession(state, host.sessionId);
      if (!session.reveal) this.#beginReveal(state, session, Date.now());
      return structuredClone(session.reveal);
    });
  }

  async setPresence(playerId, connected) {
    return this.store.mutate((state) => {
      const player = assertPlayer(state, playerId);
      const session = assertSession(state, player.sessionId);
      player.connected = Boolean(connected);
      player.lastSeenAt = iso();
      if (!player.connected && session.actIndex > 0 && session.status !== 'complete') {
        addEngineEvent(state, session, {
          type: 'player.inactive', title: 'The story continues',
          message: `${player.displayName} disconnected or became inactive; the Estate Narrator will not pause the game.`,
        });
        addAudit(state, { sessionId: session.id, actorId: player.id, type: 'player.inactive' });
      }
      return { playerId, connected: player.connected, sessionId: player.sessionId };
    });
  }

  publicConfig() {
    return {
      title: story.title ?? 'The LaRose Files: Blood Is Thicker Than Water',
      subtitle: story.subtitle ?? 'A murder mystery experience',
      maxPlayers: 20,
      autonomous: { acts: ACTS.map(({ index, slug, title, standardSeconds }) => ({ index, slug, title, minutes: standardSeconds / 60 })), standardMinutes: ACTS.reduce((sum, act) => sum + act.standardSeconds, 0) / 60 },
      upload: { maxBytes: this.uploadMaxBytes, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      messageTypes: [...MESSAGE_TYPES],
      characters: characters.map(publicCharacter),
      rooms: rooms.map(publicRoom),
      hotspots: hotspots.map(publicHotspot),
      evidenceCount: evidenceCatalog.length,
    };
  }
}
