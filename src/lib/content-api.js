import * as source from '../content.js';

function list(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => (
    item && typeof item === 'object' ? { id: item.id ?? key, ...item } : { id: key, value: item }
  ));
  return [];
}

function itemId(item) {
  return item?.id ?? item?.slug ?? item?.key;
}

export const characters = list(source.CHARACTERS);
export const rooms = list(source.ROOMS);
export const hotspots = list(source.HOTSPOTS);
export const evidence = list(source.EVIDENCE);
export const story = { ...(source.GAME ?? {}), ...(source.STORY ?? {}) };

export function getCharacter(id) {
  if (!id) return null;
  return source.getCharacter?.(id) ?? characters.find((item) => itemId(item) === id) ?? null;
}

export function getRoom(id) {
  if (!id) return null;
  return rooms.find((item) => itemId(item) === id) ?? null;
}

export function getHotspot(id) {
  if (!id) return null;
  return source.getHotspot?.(id) ?? hotspots.find((item) => itemId(item) === id) ?? null;
}

export function getEvidence(id) {
  if (!id) return null;
  return source.getEvidence?.(id) ?? evidence.find((item) => itemId(item) === id) ?? null;
}

export function availableCharacters() {
  const result = source.availableCharacters?.();
  return Array.isArray(result) ? result : characters.filter((character) => character.playable !== false);
}

export function hotspotRoomId(hotspot) {
  return hotspot?.roomId ?? hotspot?.room ?? 'grand-foyer';
}

export function getDiscovery(hotspot, characterId) {
  const hotspotId = itemId(hotspot);
  let result;
  if (typeof source.getDiscoveryForRole === 'function') {
    result = source.getDiscoveryForRole(hotspotId, characterId);
  }
  if (result === undefined || result === null) {
    const map = hotspot?.discoveries ?? hotspot?.roleDiscoveries ?? hotspot?.characterDiscoveries;
    result = map?.[characterId] ?? map?.default ?? hotspot?.discovery ?? hotspot?.result;
  }
  if (typeof result === 'string') result = { narrative: result };
  return result && typeof result === 'object' ? result : {};
}

export function discoveryEvidenceIds(hotspot, discovery) {
  const values = [
    discovery?.evidenceId,
    discovery?.grantsEvidenceId,
    ...(Array.isArray(discovery?.evidenceIds) ? discovery.evidenceIds : []),
    hotspot?.evidenceId,
    hotspot?.grantsEvidenceId,
    ...(Array.isArray(hotspot?.evidenceIds) ? hotspot.evidenceIds : []),
  ];
  return [...new Set(values.filter((value) => typeof value === 'string' && getEvidence(value)))];
}

export function publicCharacter(character) {
  if (!character) return null;
  return {
    id: itemId(character),
    name: character.name,
    title: character.title ?? character.role,
    pronouns: character.pronouns,
    tier: character.tier,
    publicBio: character.publicBio ?? character.publicDescription ?? character.bio,
    portrait: character.portrait ?? character.image,
    color: character.color,
  };
}

export function privateCharacter(character) {
  if (!character) return null;
  return {
    ...publicCharacter(character),
    dossier: character.dossier ?? character.privateBio,
    secret: character.secret,
    alibi: character.alibi,
    alignment: character.alignment,
    objectives: character.objectives ?? [],
    relationships: character.relationships ?? [],
    knowledge: character.knowledge ?? [],
  };
}

export function publicRoom(room) {
  return {
    id: itemId(room),
    name: room?.name,
    description: room?.publicDescription ?? room?.description,
    image: room?.image ?? room?.background,
    milestone: room?.milestone,
  };
}

export function publicHotspot(hotspot) {
  return {
    id: itemId(hotspot),
    roomId: hotspotRoomId(hotspot),
    name: hotspot?.name ?? hotspot?.title,
    description: hotspot?.publicDescription ?? hotspot?.prompt ?? hotspot?.description,
    interaction: hotspot?.interaction,
    x: hotspot?.x,
    y: hotspot?.y,
    position: hotspot?.position,
    icon: hotspot?.icon,
  };
}

export function privateEvidence(item) {
  if (!item) return null;
  return {
    id: itemId(item),
    title: item.title ?? item.name,
    shortDescription: item.shortDescription,
    description: item.description ?? item.text,
    detail: item.detail ?? item.longDescription,
    image: item.image,
    roomId: item.roomId,
    category: item.category,
    tags: item.tags ?? [],
    points: item.points,
    redHerring: Boolean(item.redHerring),
    type: item.type ?? (item.isKey ? 'key' : 'clue'),
    isKey: Boolean(item.isKey || item.type === 'key'),
  };
}

export function murdererId() {
  return story.murdererId
    ?? story.solution?.murdererId
    ?? source.SOLUTION?.murdererId
    ?? characters.find((character) => character.isMurderer)?.id
    ?? null;
}

export function solutionSummary() {
  return story.solution?.summary ?? story.finalSolution ?? story.solutionText ?? source.SOLUTION?.summary ?? null;
}
