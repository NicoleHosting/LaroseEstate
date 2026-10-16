import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { GameService } from '../src/lib/game-service.js';
import { createStore } from '../src/store.js';

const TEST_SECRET = 'test-only-session-secret-that-is-deliberately-long-123456789';

async function createFixture(t) {
  const directory = await fs.mkdtemp(path.join(process.cwd(), 'tests', '.runtime-larose-service-'));
  const dataFile = path.join(directory, 'state.json');
  const store = await createStore({ dataFile });
  const game = new GameService(store, { sessionSecret: TEST_SECRET });
  const created = await game.createSession({
    displayName: 'Game Master',
    eventName: 'Test at LaRose Estate',
    maxPlayers: 20,
  });

  t.after(async () => {
    await store.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  return { directory, dataFile, store, game, created };
}

test('public configuration and peer views do not leak private dossiers or the solution', async (t) => {
  const { game, created } = await createFixture(t);
  await game.assignCharacter(created.player.id, created.player.id, 'lucien-larose');

  const config = game.publicConfig();
  const serializedConfig = JSON.stringify(config);
  assert.equal(config.title, 'The LaRose Files');
  assert.equal(config.subtitle, 'Blood Is Thicker Than Water');
  assert.doesNotMatch(serializedConfig, /murdererId|You murdered Vivienne|oleander concentrate/i);
  assert.ok(config.characters.every((character) => !('secret' in character) && !('dossier' in character)));

  const snapshot = await game.snapshot(created.player.id);
  assert.match(snapshot.me.character.secret, /murdered Vivienne/i);
  assert.ok(snapshot.characters.every((character) => !('secret' in character) && !('objectives' in character)));
  assert.ok(snapshot.players.every((player) => !('secret' in (player.character ?? {}))));
});

test('the foyer key loop is server-authoritative, idempotent, and unlocks only the study', async (t) => {
  const { game, created } = await createFixture(t);
  await game.assignCharacter(created.player.id, created.player.id, 'amara-vale');
  await game.setGameControls(created.player.id, { action: 'start' });

  await assert.rejects(
    game.investigate(created.player.id, 'study-door'),
    (error) => error.code === 'REQUIRED_EVIDENCE_MISSING' && error.status === 403,
  );

  const bookResult = await game.investigate(created.player.id, 'books');
  assert.deepEqual(bookResult.evidence.map((item) => item.id), ['brass-study-key']);
  assert.deepEqual(bookResult.unlockedRooms, []);

  const repeatedBookResult = await game.investigate(created.player.id, 'books');
  assert.equal(repeatedBookResult.alreadyInvestigated, true);
  assert.deepEqual(repeatedBookResult.evidence, []);

  const doorResult = await game.investigate(created.player.id, 'study-door');
  assert.ok(doorResult.evidence.some((item) => item.id === 'duplicate-key-scratches'));
  assert.deepEqual(doorResult.unlockedRooms, ['study']);

  const snapshot = await game.snapshot(created.player.id);
  assert.equal(snapshot.rooms.find((room) => room.id === 'study').unlocked, true);
  assert.equal(snapshot.rooms.find((room) => room.id === 'library').unlocked, false);
  assert.equal(snapshot.me.evidence.filter((item) => item.id === 'brass-study-key').length, 1);
  assert.equal(snapshot.me.evidence.filter((item) => item.id === 'duplicate-key-scratches').length, 1);
});

test('character-specific discoveries are private and award only that role bonus', async (t) => {
  const { game, created } = await createFixture(t);
  await game.assignCharacter(created.player.id, created.player.id, 'darius-king');
  await game.setGameControls(created.player.id, { action: 'start' });

  await game.investigate(created.player.id, 'books');
  const doorResult = await game.investigate(created.player.id, 'study-door');
  assert.match(doorResult.narrative, /cane case/i);
  assert.deepEqual(
    new Set(doorResult.evidence.map((item) => item.id)),
    new Set(['duplicate-key-scratches', 'black-seal-wax']),
  );
});

test('sharing evidence copies it without removing or duplicating the original', async (t) => {
  const { game, created } = await createFixture(t);
  await game.assignCharacter(created.player.id, created.player.id, 'amara-vale');
  const joined = await game.joinSession(created.session.code, { displayName: 'Second Player' });
  await game.setGameControls(created.player.id, { action: 'start' });
  await game.investigate(created.player.id, 'books');

  const firstShare = await game.shareEvidence(created.player.id, 'brass-study-key', joined.player.id);
  assert.equal(firstShare.added, true);
  const secondShare = await game.shareEvidence(created.player.id, 'brass-study-key', joined.player.id);
  assert.equal(secondShare.added, false);

  const sender = await game.snapshot(created.player.id);
  const recipient = await game.snapshot(joined.player.id);
  assert.equal(sender.me.evidence.filter((item) => item.id === 'brass-study-key').length, 1);
  assert.equal(recipient.me.evidence.filter((item) => item.id === 'brass-study-key').length, 1);
  assert.equal(recipient.me.evidence.find((item) => item.id === 'brass-study-key').acquired.sharedByPlayerId, created.player.id);
});

test('saved progress and bearer sessions survive a store restart', async (t) => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), 'tests', '.runtime-larose-reconnect-'));
  const dataFile = path.join(directory, 'state.json');
  let store = await createStore({ dataFile });
  let game = new GameService(store, { sessionSecret: TEST_SECRET });
  const created = await game.createSession({ displayName: 'Returning Host' });
  await game.assignCharacter(created.player.id, created.player.id, 'amara-vale');
  await game.setGameControls(created.player.id, { action: 'start' });
  await game.investigate(created.player.id, 'books');
  await game.addJournalEntry(created.player.id, 'The study key was hidden in the books.');
  await store.close();

  store = await createStore({ dataFile });
  game = new GameService(store, { sessionSecret: TEST_SECRET });
  const authenticated = await game.authenticate(created.token);
  assert.equal(authenticated.player.id, created.player.id);
  const snapshot = await game.snapshot(authenticated.player.id);
  assert.ok(snapshot.me.evidence.some((item) => item.id === 'brass-study-key'));
  assert.equal(snapshot.me.journal[0].text, 'The study key was hidden in the books.');

  t.after(async () => {
    await store.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
});

test('final accusations reveal the predetermined murderer and a complete solution', async (t) => {
  const { game, created } = await createFixture(t);
  await game.assignCharacter(created.player.id, created.player.id, 'amara-vale');
  await game.setGameControls(created.player.id, { action: 'start' });
  await game.setGameControls(created.player.id, { action: 'open-accusations' });
  await game.submitAccusation(created.player.id, {
    suspectCharacterId: 'lucien-larose',
    theory: 'The audit, oleander, altered arrival, and duplicate key point to Lucien.',
  });

  const reveal = await game.revealSolution(created.player.id);
  assert.equal(reveal.murderer.id, 'lucien-larose');
  assert.match(reveal.summary, /audit/i);
  assert.match(reveal.summary, /oleander/i);
  assert.deepEqual(reveal.correctPlayerIds, [created.player.id]);
  assert.equal(reveal.tally['lucien-larose'], 1);
});

