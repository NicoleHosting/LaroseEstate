import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { GameService } from '../src/lib/game-service.js';
import { createStore } from '../src/store.js';

const TEST_SECRET = 'autonomous-game-test-secret-that-is-deliberately-long-987654321';
const SEALED_FIELDS = /"(?:murdererId|weapon|motive|method|genuineEvidenceIds|nonce|commitment)"/;

function sessionCollection(state, key, sessionId) {
  const value = state[key]?.[sessionId];
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function participantKey(item) {
  return item?.participantId ?? item?.playerId ?? item?.npcId ?? item?.characterId ?? item?.id ?? null;
}

function reunionEntries(reunion) {
  if (!reunion) return [];
  for (const key of ['segments', 'clips', 'confessionals', 'receipts', 'participants']) {
    if (Array.isArray(reunion[key])) return reunion[key];
  }
  return Array.isArray(reunion) ? reunion : [];
}

function awardsEntries(awards) {
  if (!awards) return [];
  if (Array.isArray(awards)) return awards;
  if (Array.isArray(awards.winners)) return awards.winners;
  return Object.values(awards).filter((value) => value && typeof value === 'object');
}

async function createAutonomousFixture(t, { humanCount = 6 } = {}) {
  const directory = await fs.mkdtemp(path.join(process.cwd(), 'tests', '.runtime-larose-autonomous-'));
  const dataFile = path.join(directory, 'state.json');
  const store = await createStore({ dataFile });
  const game = new GameService(store, { sessionSecret: TEST_SECRET });
  const creator = await game.createSession({
    displayName: 'Nicole Player',
    eventName: 'Autonomous LaRose Simulation',
    maxPlayers: 20,
  });
  await game.assignCharacter(creator.player.id, creator.player.id, 'nicole-larose');

  const humans = [creator];
  for (let index = 1; index < humanCount; index += 1) {
    humans.push(await game.joinSession(creator.session.code, { displayName: `Human ${index + 1}` }));
  }
  for (const human of humans) await game.setPresence(human.player.id, true);

  t.after(async () => {
    await store.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  return { directory, dataFile, store, game, creator, humans, sessionId: creator.session.id };
}

async function readSession(store, sessionId) {
  const state = await store.read();
  return { state, session: state.sessions[sessionId] };
}

test('fast autonomous start creates six private NPCs beside six humans without leaking the sealed case', async (t) => {
  const { game, store, creator, humans, sessionId } = await createAutonomousFixture(t);
  await game.startAutonomous(creator.player.id, { mode: 'fast', npcCount: 6 });

  const { state, session } = await readSession(store, sessionId);
  const npcs = sessionCollection(state, 'npcs', sessionId);
  assert.equal(humans.length, 6);
  assert.equal(npcs.length, 6);
  assert.equal(session.mode, 'fast');
  assert.equal(session.actIndex, 1);
  assert.equal(session.status, 'running');
  assert.ok(state.mysteries[sessionId], 'the server must retain a sealed mystery');
  assert.notEqual(state.mysteries[sessionId].murdererId, 'nicole-larose');

  const humanCharacterIds = humans.map((human) => state.players[human.player.id].characterId);
  const npcCharacterIds = npcs.map((npc) => npc.characterId);
  assert.equal(new Set([...humanCharacterIds, ...npcCharacterIds]).size, 12, 'all human and NPC roles must be unique');

  const ordinarySnapshot = await game.snapshot(creator.player.id);
  const normalAdminView = await game.hostDashboard(creator.player.id);
  for (const [label, payload] of [
    ['public configuration', game.publicConfig()],
    ['ordinary snapshot', ordinarySnapshot],
    ['normal administrator view', normalAdminView],
  ]) {
    assert.doesNotMatch(JSON.stringify(payload), SEALED_FIELDS, `${label} exposed sealed mystery fields`);
  }
  assert.equal('mystery' in ordinarySnapshot.session, false);
  assert.equal('mystery' in normalAdminView, false);
});

test('same-object investigations stay personalized and idempotent while planted evidence cannot rewrite truth', async (t) => {
  const { game, store, creator, humans, sessionId } = await createAutonomousFixture(t);
  const dariusPlayer = humans.at(-1).player;
  await game.assignCharacter(creator.player.id, dariusPlayer.id, 'darius-king');
  await game.startAutonomous(creator.player.id, { mode: 'fast', npcCount: 6 });

  const nicoleDiscovery = await game.investigate(creator.player.id, 'guest-book');
  const dariusDiscovery = await game.investigate(dariusPlayer.id, 'guest-book');
  assert.notEqual(nicoleDiscovery.narrative, dariusDiscovery.narrative);
  assert.doesNotMatch(nicoleDiscovery.narrative, /shorthand on the discarded slip is yours/i);
  assert.match(dariusDiscovery.narrative, /shorthand on the discarded slip is yours/i);
  assert.equal(nicoleDiscovery.roleSpecific, false);
  assert.equal(dariusDiscovery.roleSpecific, true);

  const beforeRepeat = await game.snapshot(dariusPlayer.id);
  const repeated = await game.investigate(dariusPlayer.id, 'guest-book');
  const afterRepeat = await game.snapshot(dariusPlayer.id);
  assert.equal(repeated.alreadyInvestigated, true);
  assert.deepEqual(repeated.evidence, []);
  assert.equal(afterRepeat.me.evidence.length, beforeRepeat.me.evidence.length);
  assert.equal(
    afterRepeat.me.evidence.filter((item) => item.id === 'doorman-time-note').length,
    1,
    'repeat clicks must never duplicate a role-specific clue',
  );

  await game.investigate(creator.player.id, 'family-portrait');
  const beforeManipulation = structuredClone((await store.read()).mysteries[sessionId]);
  await game.evidenceAction(creator.player.id, 'portrait-warning', { action: 'conceal' });
  await game.evidenceAction(creator.player.id, 'portrait-warning', { action: 'reveal' });
  const revealedToPeer = await game.snapshot(dariusPlayer.id);
  assert.ok(revealedToPeer.publicEvidence.some((item) => item.id === 'portrait-warning'));
  assert.equal(revealedToPeer.me.evidence.some((item) => item.id === 'portrait-warning'), false, 'a public reveal must not silently grant ownership');
  await game.evidenceAction(creator.player.id, 'portrait-warning', {
    action: 'plant',
    roomId: 'grand-foyer',
    hotspotId: 'books',
  });
  const plantedForPeer = await game.snapshot(dariusPlayer.id);
  assert.equal(plantedForPeer.publicEvidence.some((item) => item.id === 'portrait-warning'), false, 'planting replaces the player\'s public reveal');
  assert.ok(plantedForPeer.rooms.find((room) => room.id === 'grand-foyer').plantedEvidence.some((item) => item.id === 'portrait-warning'));
  const afterState = await store.read();
  assert.deepEqual(afterState.mysteries[sessionId], beforeManipulation, 'player actions must not mutate sealed truth');

  const evidenceActions = sessionCollection(afterState, 'evidenceActions', sessionId)
    .filter((entry) => entry.playerId === creator.player.id && entry.evidenceId === 'portrait-warning');
  assert.deepEqual(evidenceActions.map((entry) => entry.action), ['conceal', 'reveal', 'plant']);
  assert.ok(evidenceActions.every((entry) => entry.createdAt), 'manipulation receipts need timestamps');
});

test('a complete five-act fast game advances without host controls despite inactivity, then reveals reunion and receipt-based awards', async (t) => {
  const { game, store, creator, humans, sessionId } = await createAutonomousFixture(t);
  await game.startAutonomous(creator.player.id, { mode: 'fast', npcCount: 6 });

  const privatePlayer = humans[1].player;
  const viewer = creator.player;
  const initialPrompts = await game.getConfessionals(privatePlayer.id);
  const prompt = initialPrompts.find((item) => !item.response);
  assert.ok(prompt, 'a human should receive a private Act I confessional');
  const privateResponse = 'PRIVATE RECEIPT: I moved the ledger before anybody noticed.';
  await game.respondConfessional(privatePlayer.id, prompt.id, privateResponse);

  assert.doesNotMatch(JSON.stringify(await game.getConfessionals(viewer.id)), /PRIVATE RECEIPT/);
  assert.doesNotMatch(JSON.stringify(await game.snapshot(viewer.id)), /PRIVATE RECEIPT/);
  assert.doesNotMatch(JSON.stringify(await game.hostDashboard(viewer.id)), /PRIVATE RECEIPT/);

  const inactive = humans.at(-1).player;
  await game.setPresence(inactive.id, false);
  await store.mutate((state) => {
    state.players[inactive.id].lastSeenAt = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
  });

  const seenActs = new Set([1]);
  const logicalStart = Date.now();
  let completed = false;
  for (let step = 1; step <= 40; step += 1) {
    const logicalNow = new Date(logicalStart + (step * 60 * 1000)).toISOString();
    await game.advanceEngine(sessionId, { force: true, now: logicalNow });
    const { session } = await readSession(store, sessionId);
    if (session.actIndex) seenActs.add(session.actIndex);
    if (session.status === 'complete' && session.reveal && session.reunion && session.awards) {
      completed = true;
      break;
    }
  }

  assert.equal(completed, true, 'bounded fast-mode simulation stalled before the automatic finale');
  assert.deepEqual(seenActs, new Set([1, 2, 3, 4, 5]));

  const { state, session } = await readSession(store, sessionId);
  assert.equal(session.status, 'complete');
  assert.equal(session.finalAccusationOpen, false);
  assert.ok(session.reveal?.murderer, 'automatic reveal must publish the culprit only at the finale');
  assert.equal(session.reveal.murderer.id, state.mysteries[sessionId].murdererId);
  assert.match(session.reveal.summary, /oleander|cordial|audit|codicil|ledger/i);

  const npcs = sessionCollection(state, 'npcs', sessionId);
  const expectedParticipants = new Set([
    ...humans.map((human) => human.player.id),
    ...npcs.map((npc) => participantKey(npc)),
  ]);
  const represented = new Set(reunionEntries(session.reunion).map(participantKey).filter(Boolean));
  for (const participantId of expectedParticipants) {
    assert.ok(represented.has(participantId), `reunion omitted participant ${participantId}`);
  }
  assert.match(JSON.stringify(session.reunion), /PRIVATE RECEIPT/);

  const awards = awardsEntries(session.awards);
  const categories = new Set(awards.map((award) => award.category ?? award.id));
  for (const category of [
    'best-detective',
    'biggest-snake',
    'best-liar',
    'most-betrayed',
    'messiest-family-member',
    'most-suspicious',
    'best-npc-performance',
    'drama-queen-king',
  ]) {
    assert.ok(categories.has(category), `missing Golden Rose category ${category}`);
  }
  assert.ok(awards.every((award) => participantKey(award.winner ?? award) && (award.receipt || award.receipts || award.reason)));

  const engineEvents = sessionCollection(state, 'engineEvents', sessionId);
  assert.ok(engineEvents.some((event) => /inactive|disconnect|timeout/i.test(`${event.type} ${event.message ?? ''}`)));
  assert.ok(engineEvents.filter((event) => /act/i.test(event.type)).length >= 5);
  assert.equal(
    state.audit.filter((event) => event.sessionId === sessionId && event.type === 'game.controls').length,
    0,
    'the simulation used host phase controls after autonomous start',
  );
});

test('a sleeping deployment catches up every overdue stage and migrates a legacy session with no sealed mystery', async (t) => {
  const { game, store, creator, sessionId } = await createAutonomousFixture(t);
  await game.startAutonomous(creator.player.id, { mode: 'fast', npcCount: 6 });
  const wakeTime = Date.now();
  await store.mutate((state) => {
    delete state.mysteries[sessionId];
    state.sessions[sessionId].actStartedAt = new Date(wakeTime - 130_000).toISOString();
    state.sessions[sessionId].nextBeatAt = new Date(wakeTime - 120_000).toISOString();
    state.sessions[sessionId].timer.endsAt = state.sessions[sessionId].nextBeatAt;
  });

  const result = await game.tick(wakeTime);
  const { state, session } = await readSession(store, sessionId);
  assert.equal(result.changed, true);
  assert.ok(result.results[0].transitions >= 8, 'all overdue acts and postgame stages should catch up in one wake cycle');
  assert.ok(state.mysteries[sessionId], 'legacy session received a new server-only sealed mystery');
  assert.equal(session.status, 'complete');
  assert.ok(session.reveal && session.reunion && session.awards);
  assert.equal(session.reveal.murderer.id, state.mysteries[sessionId].murdererId);
});

test('pausing and resuming the reveal preserves its postgame stage', async (t) => {
  const { game, store, creator, sessionId } = await createAutonomousFixture(t);
  await game.startAutonomous(creator.player.id, { mode: 'fast', npcCount: 2 });
  for (let index = 0; index < 5; index += 1) await game.advanceEngine(sessionId, { force: true });
  assert.equal((await readSession(store, sessionId)).session.status, 'reveal');

  await game.setGameControls(creator.player.id, { action: 'pause' });
  assert.equal((await readSession(store, sessionId)).session.status, 'paused');
  await game.setGameControls(creator.player.id, { action: 'resume' });
  const resumed = (await readSession(store, sessionId)).session;
  assert.equal(resumed.status, 'reveal');
  assert.equal(resumed.postgameStage, 'reveal');
});
