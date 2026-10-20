import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARACTERS,
  EVIDENCE,
  GAME,
  HOTSPOTS,
  ROOMS,
  STORY,
  getCharacter,
  getDiscoveryForRole,
  getEvidence,
  getHotspot,
  getPublicCharacter,
  selectRoster,
} from '../src/content.js';

function assertUniqueIds(items, label) {
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`);
  assert.ok(ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)), `${label} IDs must be stable slugs`);
}

test('the flexible roster has twenty complete, unique characters and no Hassan', () => {
  assert.equal(CHARACTERS.length, GAME.maxPlayers);
  assert.equal(GAME.minPlayers, 5);
  assert.equal(GAME.maxPlayers, 20);
  assertUniqueIds(CHARACTERS, 'character');
  assert.doesNotMatch(JSON.stringify(CHARACTERS), /hassan/i);
  assert.ok(CHARACTERS.some((character) => character.id === 'nicole-larose'));
  assert.ok(CHARACTERS.every((character) => character.id !== 'amara-vale'));
  assert.equal(getCharacter('amara-vale').id, 'nicole-larose', 'legacy Amara saves must resolve to Nicole');

  const characterIds = new Set(CHARACTERS.map((character) => character.id));
  const evidenceIds = new Set(EVIDENCE.map((item) => item.id));
  for (const character of CHARACTERS) {
    assert.ok(character.name && character.title && character.publicBio, `${character.id} needs public identity`);
    assert.ok(character.dossier && character.secret && character.alibi, `${character.id} needs a private dossier`);
    assert.ok(character.objectives.length >= 3, `${character.id} needs at least three objectives`);
    assert.ok(Object.keys(character.relationships).length >= 2, `${character.id} needs relationships`);
    for (const relatedId of Object.keys(character.relationships)) {
      assert.ok(
        characterIds.has(relatedId) || relatedId === STORY.victim.id,
        `${character.id} has unknown relationship ${relatedId}`,
      );
    }
    for (const evidenceId of character.startingEvidenceIds) {
      assert.ok(evidenceIds.has(evidenceId), `${character.id} starts with unknown evidence ${evidenceId}`);
    }
  }
});

test('the murderer is predetermined, unique, and present in every legal roster', () => {
  const murderers = CHARACTERS.filter((character) => character.alignment === 'murderer');
  assert.equal(murderers.length, 1);
  assert.equal(murderers[0].id, STORY.murdererId);
  assert.notEqual(STORY.murdererId, 'nicole-larose');
  assert.ok(CHARACTERS.slice(0, GAME.minPlayers).some((character) => character.id === STORY.murdererId));

  for (let count = GAME.minPlayers; count <= GAME.maxPlayers; count += 1) {
    const roster = selectRoster(count);
    assert.equal(roster.length, count);
    assert.ok(roster.some((character) => character.id === STORY.murdererId));
  }

  assert.throws(() => selectRoster(4), RangeError);
  assert.throws(() => selectRoster(21), RangeError);
  assert.throws(() => selectRoster(5.5), RangeError);
});

test('the story timeline is ordered and contains setup, murder, cover-up, and discovery', () => {
  const minutes = STORY.timeline.map(({ time }) => {
    assert.match(time, /^\d{2}:\d{2}$/);
    const [hour, minute] = time.split(':').map(Number);
    return (hour * 60) + minute;
  });
  assert.deepEqual(minutes, [...minutes].sort((left, right) => left - right));

  const kinds = new Set(STORY.timeline.map((event) => event.kind));
  for (const requiredKind of ['setup', 'murder', 'cover-up', 'discovery']) {
    assert.ok(kinds.has(requiredKind), `timeline needs ${requiredKind}`);
  }
  assert.match(STORY.motive, /audit/i);
  assert.match(STORY.method, /oleander/i);
  assert.match(STORY.finalSolution, /Lucien LaRose/i);
});

test('rooms, hotspots, and evidence form a closed reference graph', () => {
  assertUniqueIds(ROOMS, 'room');
  assertUniqueIds(HOTSPOTS, 'hotspot');
  assertUniqueIds(EVIDENCE, 'evidence');

  const roomIds = new Set(ROOMS.map((room) => room.id));
  const hotspotIds = new Set(HOTSPOTS.map((hotspot) => hotspot.id));
  const evidenceIds = new Set(EVIDENCE.map((item) => item.id));
  const characterIds = new Set(CHARACTERS.map((character) => character.id));

  assert.equal(ROOMS.find((room) => room.id === 'grand-foyer').initiallyUnlocked, true);
  assert.equal(ROOMS.find((room) => room.id === 'study').initiallyUnlocked, false);

  for (const hotspot of HOTSPOTS) {
    assert.ok(roomIds.has(hotspot.roomId), `${hotspot.id} points to an unknown room`);
    assert.ok(hotspot.discoveries?.default?.narrative, `${hotspot.id} needs a default discovery`);
    if (hotspot.grantsEvidenceId) {
      assert.ok(evidenceIds.has(hotspot.grantsEvidenceId), `${hotspot.id} grants unknown evidence`);
    }
    if (hotspot.requiredEvidenceId) {
      const key = getEvidence(hotspot.requiredEvidenceId);
      assert.ok(key, `${hotspot.id} requires unknown evidence`);
      assert.equal(key.isKey, true, `${hotspot.id} prerequisite must be a key`);
    }
    if (hotspot.unlocksRoomId) {
      assert.ok(roomIds.has(hotspot.unlocksRoomId), `${hotspot.id} unlocks an unknown room`);
    }
    for (const [roleId, discovery] of Object.entries(hotspot.discoveries)) {
      if (roleId !== 'default') assert.ok(characterIds.has(roleId), `${hotspot.id} has unknown role ${roleId}`);
      for (const evidenceId of discovery.evidenceIds ?? []) {
        assert.ok(evidenceIds.has(evidenceId), `${hotspot.id}/${roleId} reveals unknown evidence ${evidenceId}`);
      }
    }
  }

  for (const item of EVIDENCE) {
    if (item.roomId) assert.ok(roomIds.has(item.roomId), `${item.id} points to an unknown room`);
    if (item.sourceHotspotId) assert.ok(hotspotIds.has(item.sourceHotspotId), `${item.id} points to an unknown hotspot`);
    for (const resolutionId of item.resolutionEvidenceIds ?? []) {
      assert.ok(evidenceIds.has(resolutionId), `${item.id} resolves with unknown evidence ${resolutionId}`);
    }
  }
});

test('all six required foyer interactions exist and the study door uses the discovered key', () => {
  const expected = [
    'family-portrait',
    'guest-book',
    'rose-arrangement',
    'marble-statue',
    'books',
    'study-door',
  ];
  assert.deepEqual(HOTSPOTS.map((hotspot) => hotspot.id), expected);
  assert.ok(HOTSPOTS.every((hotspot) => hotspot.roomId === 'grand-foyer'));

  const key = getEvidence('brass-study-key');
  assert.equal(key.isKey, true);
  assert.equal(key.sourceHotspotId, 'books');
  const door = getHotspot('study-door');
  assert.equal(door.requiredEvidenceId, key.id);
  assert.equal(door.unlocksRoomId, 'study');
});

test('every character gets at least one private hotspot insight without seeing another role\'s text', () => {
  const coveredRoles = new Set();
  for (const hotspot of HOTSPOTS) {
    for (const roleId of Object.keys(hotspot.discoveries)) {
      if (roleId !== 'default') coveredRoles.add(roleId);
    }
  }
  assert.deepEqual(coveredRoles, new Set(CHARACTERS.map((character) => character.id)));

  const darius = getDiscoveryForRole('study-door', 'darius-king');
  assert.equal(darius.isRoleSpecific, true);
  assert.deepEqual(darius.evidenceIds.sort(), ['black-seal-wax', 'duplicate-key-scratches']);
  assert.match(darius.narrative, /wax flake/i);

  const nicole = getDiscoveryForRole('study-door', 'nicole-larose');
  assert.equal(nicole.isRoleSpecific, false);
  assert.deepEqual(nicole.evidenceIds, ['duplicate-key-scratches']);
  assert.doesNotMatch(nicole.narrative, /Darius|cane case/i);
  assert.equal(getDiscoveryForRole('not-a-hotspot', 'nicole-larose'), null);
});

test('the evidence catalog supports a solvable case and clearly labels red herrings', () => {
  const evidenceIds = new Set(EVIDENCE.map((item) => item.id));
  for (const [element, ids] of Object.entries(STORY.fairPlayTrail)) {
    assert.ok(ids.length >= 2, `${element} needs corroborating evidence`);
    for (const id of ids) assert.ok(evidenceIds.has(id), `${element} references missing evidence ${id}`);
  }
  assert.ok(EVIDENCE.filter((item) => item.redHerring).length >= 3);
  assert.ok(EVIDENCE.filter((item) => item.tags.includes('lucien')).length >= 5);
});

test('public character serialization excludes secrets and objectives', () => {
  const lucien = getCharacter('lucien-larose');
  const publicLucien = getPublicCharacter(lucien);
  assert.deepEqual(Object.keys(publicLucien), ['id', 'name', 'title', 'pronouns', 'tier', 'publicBio']);
  assert.equal('secret' in publicLucien, false);
  assert.equal('alignment' in publicLucien, false);
  assert.equal('objectives' in publicLucien, false);
});

