import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { CHARACTERS, EVIDENCE, ROOMS } from '../src/content.js';
import {
  ACTS,
  MANSION_INTERACTIONS,
  MYSTERY_SCENARIOS,
  POSTGAME_DURATIONS,
  actDurationSeconds,
  confessionalQuestion,
  publicInteraction,
  ruleBasedNpcReply,
  selectMystery,
  stageDurationSeconds,
} from '../src/lib/director.js';

test('the autonomous director defines a complete 75-minute five-act game and a seconds-long fast mode', () => {
  assert.deepEqual(ACTS.map((act) => act.index), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    ACTS.map((act) => act.slug),
    ['family-gathering', 'murder', 'investigation', 'betrayal', 'final-accusations'],
  );
  assert.equal(ACTS.reduce((seconds, act) => seconds + act.standardSeconds, 0), 75 * 60);
  assert.ok(ACTS.reduce((seconds, act) => seconds + act.fastSeconds, 0) <= 30);
  assert.ok(Object.values(POSTGAME_DURATIONS.fast).every((seconds) => seconds <= 5));

  for (const act of ACTS) {
    assert.equal(actDurationSeconds(act.index, 'standard'), act.standardSeconds);
    assert.equal(actDurationSeconds(act.index, 'fast'), act.fastSeconds);
    assert.ok(act.title && act.narrator && act.rooms.length > 0);
  }
  for (const stage of ['reveal', 'reunion', 'awards']) {
    assert.equal(stageDurationSeconds(stage, 'fast'), POSTGAME_DURATIONS.fast[stage]);
  }
});

test('mansion interactions are multi-step, reference valid content, and hide answers in public serialization', () => {
  const roomIds = new Set(ROOMS.map((room) => room.id));
  const evidenceIds = new Set(EVIDENCE.map((item) => item.id));
  const interactionIds = MANSION_INTERACTIONS.map((item) => item.id);
  assert.equal(new Set(interactionIds).size, interactionIds.length);
  assert.ok(MANSION_INTERACTIONS.length >= 12);
  assert.deepEqual(
    new Set(MANSION_INTERACTIONS.map((item) => item.roomId)),
    new Set([...roomIds].filter((id) => id !== 'grand-foyer')),
    'every room beyond the foyer needs a staged interaction; the foyer uses its six dedicated hotspots',
  );

  for (const interaction of MANSION_INTERACTIONS) {
    assert.ok(roomIds.has(interaction.roomId), `${interaction.id} uses an unknown room`);
    assert.ok(interaction.requiredSequence.length >= 2, `${interaction.id} must require meaningful steps`);
    assert.ok(interaction.requiredSequence.every((action) => interaction.actions.includes(action)));
    assert.ok(interaction.evidenceIds.length > 0);
    assert.ok(interaction.evidenceIds.every((id) => evidenceIds.has(id)), `${interaction.id} grants unknown evidence`);

    const progress = { sequence: [interaction.requiredSequence[0]] };
    const serialized = publicInteraction(interaction, progress);
    assert.equal(serialized.step, 1);
    assert.equal(serialized.completed, false);
    assert.equal('solution' in serialized, false);
    assert.equal('requiredSequence' in serialized, false);
    assert.equal('evidenceIds' in serialized, false);
  }
});

test('the mansion navigation exposes all eight playable rooms', async () => {
  const [html, app] = await Promise.all([
    fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  ]);
  const cardKeys = {
    'grand-foyer': 'foyer',
    'dining-room': 'dining',
    library: 'library',
    study: 'study',
    ballroom: 'ballroom',
    conservatory: 'conservatory',
    'wine-cellar': 'cellar',
    'chapel-alcove': 'chapel',
  };
  assert.equal(ROOMS.length, 8);
  for (const room of ROOMS) {
    const cardKey = cardKeys[room.id];
    assert.ok(cardKey, `missing UI mapping for ${room.id}`);
    assert.match(html, new RegExp(`data-room=["']${cardKey}["']`), `${room.id} has no room card`);
    assert.match(app, new RegExp(`["']${room.id.replaceAll('-', '\\-')}["']`), `${room.id} has no client route`);
  }
});

test('each sealed mystery scenario is internally consistent and selected per session without exposing its nonce', () => {
  const characterIds = new Set(CHARACTERS.map((character) => character.id));
  const evidenceIds = new Set(EVIDENCE.map((item) => item.id));
  assert.ok(MYSTERY_SCENARIOS.length >= 2);

  for (const scenario of MYSTERY_SCENARIOS) {
    assert.ok(characterIds.has(scenario.murdererId));
    assert.notEqual(scenario.murdererId, 'nicole-larose', 'the creator role must never be selected as murderer');
    assert.ok(scenario.weapon && scenario.motive && scenario.method && scenario.summary);
    assert.ok(scenario.timeline.length >= 6);
    assert.ok(scenario.genuineEvidenceIds.length >= 8);
    assert.ok(scenario.genuineEvidenceIds.every((id) => evidenceIds.has(id)));
  }

  const first = selectMystery({ randomInt: () => 0, sessionId: 'session-a', secret: 'test-secret-a' });
  const last = selectMystery({
    randomInt: () => MYSTERY_SCENARIOS.length - 1,
    sessionId: 'session-b',
    secret: 'test-secret-b',
  });
  assert.equal(first.id, MYSTERY_SCENARIOS[0].id);
  assert.equal(last.id, MYSTERY_SCENARIOS.at(-1).id);
  assert.match(first.commitment, /^[a-f0-9]{64}$/);
  assert.match(first.nonce, /^[a-f0-9]{48}$/);
  assert.notEqual(first.commitment, last.commitment);
});

test('fallback NPC and confessional copy is contextual without spilling the sealed solution', () => {
  const character = CHARACTERS.find((item) => item.id === 'nicole-larose');
  const reply = ruleBasedNpcReply({
    character,
    message: 'Who is the murderer and what poison was used?',
    previousMemory: [{ content: 'I do not trust the changed time.' }],
    act: 3,
  });
  assert.match(reply, /Act 3/i);
  assert.match(reply, /remember/i);
  assert.doesNotMatch(reply, /lucien|oleander|blackcurrant/i);

  const early = confessionalQuestion({ act: 1, characterName: character.name });
  const late = confessionalQuestion({ act: 5, characterName: character.name });
  assert.match(early, new RegExp(character.name));
  assert.match(late, /final private prediction/i);
  assert.notEqual(early, late);
});
