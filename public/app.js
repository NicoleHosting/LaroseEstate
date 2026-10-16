(() => {
  "use strict";

  const STORAGE_KEY = "larose.session.v1";
  const SUSPICION_KEY = "larose.suspicions.v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    token: null,
    snapshot: null,
    socket: null,
    currentView: "mansion",
    currentChannel: { type: "lobby", targetId: null, label: "All Guests" },
    hostDashboard: null,
    selectedSuspect: null,
    suspicion: {},
    journalEntryId: null,
    journalLoadedKey: null,
    journalTimer: null,
    refreshTimer: null,
    timerTicker: null,
    simpleActions: new Map(),
    revealShownAt: null,
  };

  const hotspotFallback = {
    "family-portrait": {
      title: "The LaRose Family Portrait",
      description: "A formal oil portrait dominates the west wall. The frame sits slightly away from the paneling.",
      icon: "♚",
    },
    "guest-book": {
      title: "The Evening's Guest Book",
      description: "Each arrival is recorded in black ink. One entry looks darker than the rest.",
      icon: "▤",
    },
    "rose-arrangement": {
      title: "The Red Rose Arrangement",
      description: "Crimson roses conceal more than thorns. A cream envelope rests beneath the lowest stems.",
      icon: "❦",
    },
    "marble-statue": {
      title: "The Marble Statue",
      description: "The marble muse wears an empty velvet setting where the Widow's Ruby should be displayed.",
      icon: "♕",
    },
    books: {
      title: "Leather-Bound Books",
      description: "One volume bears a pressed-rose bookmark. Its pages sound hollow when the cover moves.",
      icon: "▥",
    },
    "study-door": {
      title: "The Private Study Door",
      description: "The brass lock is newly scored. Beyond it lies the room where Vivienne was found.",
      icon: "♙",
    },
  };

  const evidenceIcons = {
    key: "⚿",
    document: "▤",
    record: "▧",
    object: "◇",
    observation: "⌕",
    trace: "✦",
    clue: "◇",
    medical: "✚",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function text(selector, value, root = document) {
    const element = $(selector, root);
    if (element) element.textContent = value ?? "";
  }

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  }

  function safeStorageGet(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private browsing or storage quotas should not stop a live game.
    }
  }

  function safeStorageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const isForm = options.body instanceof FormData;
    if (options.body && !isForm && typeof options.body !== "string") {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(options.body);
    }
    if (options.auth !== false && state.token) headers.set("Authorization", `Bearer ${state.token}`);
    headers.set("Accept", "application/json");
    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const failure = payload?.error || payload || {};
      const error = new Error(failure.message || `The estate returned an error (${response.status}).`);
      error.code = failure.code || `HTTP_${response.status}`;
      error.status = response.status;
      error.details = failure.details;
      throw error;
    }
    return payload;
  }

  function setBusy(form, busy, busyText = "Please wait…") {
    const button = $("button[type='submit']", form);
    if (!button) return;
    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.innerHTML = button.dataset.originalHtml || button.textContent;
      button.disabled = false;
    }
  }

  function showAuthError(message) {
    const error = $("#auth-error");
    error.textContent = message;
    error.hidden = !message;
  }

  function toast(title, detail = "", type = "info") {
    const region = $("#toast-region");
    const item = document.createElement("div");
    item.className = `toast${type === "error" ? " is-error" : ""}`;
    item.innerHTML = `<span aria-hidden="true">${type === "error" ? "!" : "✦"}</span><div><strong>${escapeHtml(title)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</div>`;
    region.append(item);
    window.setTimeout(() => item.remove(), 4800);
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function openSimple({ kicker = "LaRose Estate", title: titleValue, content = "", actions = [] }) {
    const dialog = $("#simple-dialog");
    text("#simple-kicker", kicker);
    text("#simple-title", titleValue);
    $("#simple-content").innerHTML = content;
    const actionBox = $("#simple-actions");
    actionBox.replaceChildren();
    state.simpleActions.clear();
    const finalActions = actions.length ? actions : [{ label: "Close", className: "button-outline", close: true }];
    finalActions.forEach((action, index) => {
      const button = document.createElement("button");
      const key = `action-${index}`;
      button.type = "button";
      button.className = `button ${action.className || "button-outline"}`;
      button.dataset.simpleAction = key;
      button.textContent = action.label;
      state.simpleActions.set(key, action);
      actionBox.append(button);
    });
    showDialog(dialog);
    return dialog;
  }

  async function copyRoomCode() {
    const code = state.snapshot?.session?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast("Invitation copied", `Room ${code} is ready to share.`);
    } catch {
      openSimple({
        title: "Private room code",
        content: `<p>Select and copy this code:</p><p class="large-code">${escapeHtml(code)}</p>`,
      });
    }
  }

  function rememberSession() {
    if (!state.token || !state.snapshot) return;
    safeStorageSet(STORAGE_KEY, {
      token: state.token,
      code: state.snapshot.session?.code,
      displayName: state.snapshot.me?.displayName,
      savedAt: new Date().toISOString(),
    });
  }

  function clearRememberedSession() {
    safeStorageRemove(STORAGE_KEY);
    state.token = null;
  }

  function renderReconnectCard() {
    const saved = safeStorageGet(STORAGE_KEY);
    const card = $("#reconnect-card");
    if (!saved?.token) {
      card.hidden = true;
      return null;
    }
    card.hidden = false;
    text("#reconnect-summary", `${saved.displayName || "Guest"} · room ${saved.code || "private"}`);
    return saved;
  }

  async function restoreSession({ automatic = false } = {}) {
    const saved = safeStorageGet(STORAGE_KEY);
    if (!saved?.token) return false;
    state.token = saved.token;
    const button = $("#reconnect-button");
    if (!automatic) {
      button.disabled = true;
      button.textContent = "Opening the doors…";
    }
    try {
      const snapshot = await api("/api/bootstrap");
      enterGame(snapshot);
      return true;
    } catch (error) {
      clearRememberedSession();
      renderReconnectCard();
      if (!automatic) showAuthError(error.message);
      return false;
    } finally {
      button.disabled = false;
      button.textContent = "Re-enter estate";
    }
  }

  async function createSession(event) {
    event.preventDefault();
    const form = event.currentTarget;
    showAuthError("");
    setBusy(form, true, "Opening the house…");
    const values = new FormData(form);
    const body = new FormData();
    body.append("displayName", values.get("hostName"));
    body.append("eventName", values.get("eventName"));
    body.append("maxPlayers", "20");
    try {
      const result = await api("/api/sessions", { method: "POST", body, auth: false });
      state.token = result.token;
      enterGame(result.state);
      toast("The house is open", `Share room code ${result.state?.session?.code || ""} with your guests.`);
    } catch (error) {
      showAuthError(error.message);
    } finally {
      setBusy(form, false);
    }
  }

  async function joinSession(event) {
    event.preventDefault();
    const form = event.currentTarget;
    showAuthError("");
    setBusy(form, true, "Presenting invitation…");
    const code = String($("#room-code").value || "").trim().toUpperCase();
    const formData = new FormData(form);
    formData.delete("code");
    try {
      const result = await api(`/api/sessions/${encodeURIComponent(code)}/join`, { method: "POST", body: formData, auth: false });
      state.token = result.token;
      enterGame(result.state);
      toast("Welcome to LaRose Estate", "Your private dossier is waiting in the case file.");
    } catch (error) {
      showAuthError(error.message);
    } finally {
      setBusy(form, false);
    }
  }

  function enterGame(snapshot) {
    state.snapshot = snapshot;
    rememberSession();
    $("#auth-screen").hidden = true;
    $("#game-shell").hidden = false;
    document.body.classList.add("is-in-game");
    renderAll();
    connectSocket();
    switchView("mansion", { focus: false });
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(() => refreshState({ quiet: true }), 30000);
  }

  async function leaveSession() {
    const oldToken = state.token;
    if (state.socket) state.socket.disconnect();
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    if (state.timerTicker) clearInterval(state.timerTicker);
    try {
      if (oldToken) await api("/api/auth/logout", { method: "POST" });
    } catch {
      // Local sign-out still proceeds if the server is unavailable.
    }
    clearRememberedSession();
    state.snapshot = null;
    state.socket = null;
    $("#game-shell").hidden = true;
    $("#auth-screen").hidden = false;
    document.body.classList.remove("is-in-game");
    renderReconnectCard();
    toast("You left the estate", "This device no longer holds an active invitation.");
  }

  async function refreshState({ quiet = false } = {}) {
    if (!state.token) return;
    try {
      const snapshot = await api("/api/bootstrap");
      state.snapshot = snapshot;
      rememberSession();
      renderAll();
    } catch (error) {
      if (error.status === 401) {
        clearRememberedSession();
        if (state.socket) state.socket.disconnect();
        $("#game-shell").hidden = true;
        $("#auth-screen").hidden = false;
        showAuthError("Your invitation has expired. Ask the host for the room code to rejoin.");
      } else if (!quiet) toast("Could not refresh the estate", error.message, "error");
    }
  }

  function connectSocket() {
    if (state.socket) state.socket.disconnect();
    const status = $("#connection-status");
    if (typeof window.io !== "function") {
      status.innerHTML = "<i></i> Syncing";
      status.classList.add("is-offline");
      return;
    }
    const socket = window.io({ auth: { token: state.token }, reconnection: true, reconnectionDelayMax: 5000 });
    state.socket = socket;
    socket.on("connect", () => {
      status.innerHTML = "<i></i> Live";
      status.classList.remove("is-offline");
    });
    socket.on("disconnect", () => {
      status.innerHTML = "<i></i> Reconnecting";
      status.classList.add("is-offline");
    });
    socket.on("connect_error", () => {
      status.innerHTML = "<i></i> Syncing";
      status.classList.add("is-offline");
    });
    socket.on("state:init", receiveSnapshot);
    socket.on("state:update", receiveSnapshot);
    socket.on("message:new", (message) => {
      const messages = state.snapshot?.messages;
      if (messages && !messages.some((item) => item.id === message.id)) messages.push(message);
      renderMessages();
      if (!message.isMine) {
        const badge = $("#message-badge");
        badge.hidden = false;
        badge.textContent = String(Number(badge.textContent || 0) + 1);
        if (state.currentView !== "messages") toast("A message arrived", message.anonymous ? "An anonymous note was slipped under the door." : `From ${message.sender?.displayName || "a guest"}.`);
      }
    });
    socket.on("game:error", (error) => toast("The estate refused that action", error?.message || "Try again.", "error"));
  }

  function receiveSnapshot(snapshot) {
    state.snapshot = snapshot;
    rememberSession();
    renderAll();
  }

  function renderAll() {
    if (!state.snapshot) return;
    renderHeader();
    renderPhase();
    renderMansion();
    renderDossier();
    renderEvidence();
    renderPlayers();
    renderSuspects();
    renderConversations();
    renderMessages();
    renderJournal();
    renderHostShell();
    maybeShowReveal();
  }

  function avatarStyle(player) {
    return player?.avatarUrl ? `style="background-image:url('${escapeHtml(player.avatarUrl)}')"` : "";
  }

  function renderHeader() {
    const { me, session } = state.snapshot;
    const character = me.character;
    ["#header-room-code", "#lobby-room-code", "#host-room-code"].forEach((selector) => text(selector, session.code));
    text("#profile-name", me.displayName);
    text("#profile-role", me.isHost ? "Game Master" : character?.name || "Awaiting role");
    const avatar = $("#profile-avatar");
    avatar.textContent = me.avatarUrl ? "" : initials(me.displayName);
    avatar.style.backgroundImage = me.avatarUrl ? `url("${me.avatarUrl}")` : "";
    $("#host-nav-button").hidden = !me.isHost;
  }

  function phaseIndex() {
    const session = state.snapshot.session;
    if (session.status === "complete" || /reveal/i.test(session.phase)) return 4;
    if (session.finalAccusationOpen || session.status === "accusation" || /accus/i.test(session.phase)) return 3;
    if (/interrog/i.test(session.phase) || session.round >= 3) return 2;
    if (session.status === "running" || session.status === "paused" || /invest/i.test(session.phase)) return 1;
    return 0;
  }

  function renderPhase() {
    const session = state.snapshot.session;
    text("#phase-name", session.phase || (session.status === "lobby" ? "Waiting Room" : "Investigation"));
    const descriptions = {
      lobby: "The guests are assembling. Review your dossier while the host prepares the evening.",
      running: "Explore the estate, collect evidence, and decide which confidences are worth keeping.",
      paused: "The host has paused the investigation. Use this moment to compare notes.",
      accusation: "Final accusations are open. Review the evidence before naming Vivienne's killer.",
      complete: "The truth has been revealed, but the secrets of LaRose Estate will not be forgotten.",
    };
    text("#phase-description", descriptions[session.status] || descriptions.running);
    const index = phaseIndex();
    $$("#phase-track li").forEach((item, itemIndex) => {
      item.classList.toggle("is-complete", itemIndex < index);
      item.classList.toggle("is-current", itemIndex === index);
    });
    renderTimer();
  }

  function renderTimer() {
    if (state.timerTicker) clearInterval(state.timerTicker);
    const timer = state.snapshot.session?.timer || {};
    const box = $("#round-timer");
    const hostDisplay = $("#host-timer-display");
    const tick = () => {
      let remaining = Number(timer.remainingSeconds || 0);
      if (timer.status === "running" && timer.endsAt) remaining = Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - Date.now()) / 1000));
      const formatted = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
      if ($("strong", box)) $("strong", box).textContent = formatted;
      if (hostDisplay) hostDisplay.textContent = formatted;
      box.hidden = timer.status === "idle";
    };
    tick();
    if (timer.status === "running") state.timerTicker = window.setInterval(tick, 1000);
  }

  function roomIsUnlocked(roomId) {
    const room = state.snapshot.rooms?.find((item) => item.id === roomId);
    return Boolean(room?.unlocked || state.snapshot.session?.unlockedRooms?.includes(roomId) || state.snapshot.me?.personalUnlockedRooms?.includes(roomId));
  }

  function hasEvidence(evidenceId) {
    return Boolean(state.snapshot.me?.evidence?.some((item) => item.id === evidenceId));
  }

  function renderMansion() {
    const discoveries = new Set(state.snapshot.me?.discoveries || []);
    $$("[data-hotspot]").forEach((button) => button.classList.toggle("is-investigated", discoveries.has(button.dataset.hotspot)));
    const studyUnlocked = roomIsUnlocked("study");
    const studyHotspot = $("[data-hotspot='study-door']");
    studyHotspot.classList.toggle("is-locked", !studyUnlocked);
    text("#study-door-status", studyUnlocked ? "Unlocked" : hasEvidence("brass-study-key") ? "Key found" : "Locked");

    const roomAliases = { foyer: "grand-foyer", dining: "dining-room", library: "library", study: "study", ballroom: "ballroom", conservatory: "conservatory" };
    $$(".room-card").forEach((card) => {
      const id = roomAliases[card.dataset.room];
      const unlocked = roomIsUnlocked(id);
      if (id !== "grand-foyer") card.classList.toggle("is-locked", !unlocked);
      const status = $("small", card);
      if (status && id !== "grand-foyer") status.textContent = unlocked ? "Unlocked" : id === "study" ? "Requires key" : "Locked";
    });

    const evidence = state.snapshot.me?.evidence || [];
    const inventory = $("#inventory-slots");
    inventory.replaceChildren();
    evidence.slice(0, 8).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-slot";
      button.dataset.evidenceId = item.id;
      button.title = item.title;
      button.innerHTML = `<span aria-hidden="true">${escapeHtml(evidenceIcons[item.type] || evidenceIcons.clue)}</span><small>${escapeHtml(item.title)}</small>`;
      inventory.append(button);
    });
    const emptyCount = Math.max(0, 7 - evidence.slice(0, 8).length);
    for (let index = 0; index < emptyCount; index += 1) {
      const slot = document.createElement("span");
      slot.className = "inventory-slot is-empty";
      slot.setAttribute("aria-hidden", "true");
      slot.textContent = "+";
      inventory.append(slot);
    }

    const inspectedCount = [...discoveries].filter((id) => id !== "study-door").length;
    const completed = {
      inspect: inspectedCount >= 3,
      key: hasEvidence("brass-study-key") || studyUnlocked,
      secret: state.snapshot.session.status === "complete",
    };
    let total = 0;
    Object.entries(completed).forEach(([name, value]) => {
      const item = $(`[data-objective='${name}']`);
      item?.classList.toggle("is-complete", value);
      if (value) total += 1;
    });
    text("#objective-count", `${total}/3`);
  }

  function renderDossier() {
    const { me } = state.snapshot;
    const character = me.character;
    const avatar = $("#dossier-avatar");
    const image = character?.portrait || me.avatarUrl;
    avatar.textContent = image ? "" : initials(character?.name || me.displayName);
    avatar.style.backgroundImage = image ? `url("${image}")` : "";
    text("#dossier-name", character?.name || "Awaiting assignment");
    text("#dossier-archetype", character?.title || (me.isHost ? "Game Master" : "Your host will assign your role."));
    const relationships = character?.relationships;
    let relationshipText = "—";
    if (typeof relationships === "string") relationshipText = relationships;
    else if (Array.isArray(relationships)) relationshipText = relationships.slice(0, 2).map((item) => typeof item === "string" ? item : item.description || item.name).filter(Boolean).join(" · ") || "—";
    else if (relationships && typeof relationships === "object") relationshipText = Object.values(relationships).slice(0, 2).join(" · ");
    text("#dossier-relationship", relationshipText);
    text("#dossier-alibi", character?.alibi || "—");
    text("#dossier-secret", character?.secret || (me.isHost ? "You hold the complete solution. Reveal it only when the accusations are locked." : "No secret has been revealed yet."));
    const list = $("#personal-objectives");
    const objectives = character?.objectives?.length ? character.objectives : [me.isHost ? "Guide the evening without revealing the solution." : "Stay observant. Trust no one."];
    list.innerHTML = objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function evidenceType(item) {
    return item.type || (item.isKey ? "key" : "clue");
  }

  function renderEvidence() {
    const query = String($("#evidence-search")?.value || "").trim().toLowerCase();
    const filter = $("#evidence-filter")?.value || "all";
    const evidence = state.snapshot.me?.evidence || [];
    const visible = evidence.filter((item) => {
      const type = evidenceType(item);
      const matchesType = filter === "all" || type === filter || (filter === "object" && type === "key");
      const haystack = `${item.title || ""} ${item.description || ""} ${item.detail || ""}`.toLowerCase();
      return matchesType && (!query || haystack.includes(query));
    });
    text("#evidence-total", `${evidence.length} item${evidence.length === 1 ? "" : "s"}`);
    const grid = $("#evidence-grid");
    grid.innerHTML = visible.map((item) => {
      const type = evidenceType(item);
      return `<button class="evidence-card" type="button" data-evidence-id="${escapeHtml(item.id)}">
        <span class="evidence-card-icon"><span aria-hidden="true">${escapeHtml(evidenceIcons[type] || evidenceIcons.clue)}</span></span>
        <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || item.detail || "Examine this evidence in your private file.")}</p>
        <footer><span>${escapeHtml(type)}</span><span>${item.isKey ? "Access item" : "Private evidence"}</span></footer>
      </button>`;
    }).join("");
    $("#evidence-empty").hidden = evidence.length > 0 || Boolean(query) || filter !== "all";
    grid.hidden = visible.length === 0;
    if (evidence.length > 0 && visible.length === 0) {
      grid.hidden = false;
      grid.innerHTML = `<div class="empty-state"><span aria-hidden="true">⌕</span><h3>No matching evidence</h3><p>Try another word or evidence type.</p></div>`;
    }
  }

  function renderPlayers() {
    const players = state.snapshot.players || [];
    const connected = players.filter((player) => player.connected).length;
    text("#player-count", players.length);
    text("#ready-count", `${connected} online`);
    const grid = $("#player-grid");
    grid.innerHTML = players.map((player) => `<article class="player-card">
      <span class="player-avatar" ${avatarStyle(player)}>${player.avatarUrl ? "" : escapeHtml(initials(player.displayName))}<i class="${player.connected ? "" : "is-offline"}"></i></span>
      <div><strong>${escapeHtml(player.displayName)}${player.id === state.snapshot.me.id ? " (you)" : ""}</strong><small>${escapeHtml(player.isHost ? "Game Master" : player.character?.name || "Unassigned guest")}</small></div>
    </article>`).join("");
    text("#host-player-count", `${connected} online`);
  }

  function suspicionStorageKey() {
    return `${SUSPICION_KEY}.${state.snapshot?.session?.id || "unknown"}.${state.snapshot?.me?.id || "unknown"}`;
  }

  function loadSuspicion() {
    state.suspicion = safeStorageGet(suspicionStorageKey()) || {};
  }

  function saveSuspicion() {
    safeStorageSet(suspicionStorageKey(), state.suspicion);
  }

  function renderSuspects() {
    if (!state.snapshot) return;
    loadSuspicion();
    const characters = (state.snapshot.characters || []).filter((character) => character?.id && character.name && character.id !== "vivienne-larose");
    const grid = $("#suspect-grid");
    grid.innerHTML = characters.map((character) => {
      const record = state.suspicion[character.id] || {};
      const player = state.snapshot.players?.find((item) => item.character?.id === character.id);
      const selected = state.selectedSuspect === character.id;
      return `<article class="suspect-card${selected ? " is-selected" : ""}" data-suspect-card="${escapeHtml(character.id)}">
        <div class="suspect-card-header"><span class="suspect-avatar" ${avatarStyle({ avatarUrl: character.portrait || player?.avatarUrl })}>${character.portrait || player?.avatarUrl ? "" : escapeHtml(initials(character.name))}</span><div><h2>${escapeHtml(character.name)}</h2><p>${escapeHtml(character.title || player?.displayName || "Guest of the estate")}</p></div></div>
        <div class="suspicion-control" aria-label="Suspicion level for ${escapeHtml(character.name)}">
          <button type="button" data-suspect="${escapeHtml(character.id)}" data-level="1" class="${record.level === 1 ? "is-active" : ""}">Watch</button>
          <button type="button" data-suspect="${escapeHtml(character.id)}" data-level="2" class="${record.level === 2 ? "is-active" : ""}">Suspicious</button>
          <button type="button" data-suspect="${escapeHtml(character.id)}" data-level="3" class="${record.level === 3 ? "is-active" : ""}">Prime</button>
        </div>
        <label class="sr-only" for="notes-${escapeHtml(character.id)}">Private notes about ${escapeHtml(character.name)}</label>
        <textarea id="notes-${escapeHtml(character.id)}" class="suspect-notes" maxlength="600" data-suspect-notes="${escapeHtml(character.id)}" placeholder="Add private observations…">${escapeHtml(record.notes || "")}</textarea>
        <button class="accuse-select" type="button" data-select-suspect="${escapeHtml(character.id)}">${selected ? "Selected for accusation" : "Select as final suspect"}</button>
      </article>`;
    }).join("");
    const panel = $("#final-vote-panel");
    panel.hidden = !state.snapshot.session.finalAccusationOpen && state.snapshot.session.status !== "accusation";
    const vote = $("#cast-vote-button");
    vote.disabled = !state.selectedSuspect || Boolean(state.snapshot.accusation);
    vote.textContent = state.snapshot.accusation ? "Accusation submitted" : "Accuse selected suspect";
  }

  function renderConversations() {
    const peers = (state.snapshot.players || []).filter((player) => player.id !== state.snapshot.me.id);
    const container = $("#direct-conversations");
    container.innerHTML = peers.map((player) => `<button class="conversation-item${state.currentChannel.type === "direct" && state.currentChannel.targetId === player.id ? " is-active" : ""}" type="button" data-channel="direct" data-player-id="${escapeHtml(player.id)}">
      <span class="conversation-avatar" ${avatarStyle(player)}>${player.avatarUrl ? "" : escapeHtml(initials(player.displayName))}</span><span><strong>${escapeHtml(player.displayName)}</strong><small>${escapeHtml(player.connected ? "Online now" : "Away from the estate")}</small></span>
    </button>`).join("");
    const group = $("[data-channel='group']");
    group?.classList.toggle("is-active", state.currentChannel.type === "lobby");
  }

  function messagesForChannel() {
    const messages = state.snapshot.messages || [];
    if (state.currentChannel.type === "lobby") {
      return messages.filter((message) => message.type === "lobby" || (message.type === "anonymous" && (!message.recipientPlayerId || !message.isMine)));
    }
    const target = state.currentChannel.targetId;
      return messages.filter((message) => {
      if (!['direct', 'anonymous'].includes(message.type)) return false;
        if (message.isMine) return message.recipientPlayerId === target;
        return !message.anonymous && message.sender?.id === target;
    });
  }

  function renderMessages() {
    if (!state.snapshot) return;
    const messages = messagesForChannel();
    const target = state.snapshot.players?.find((player) => player.id === state.currentChannel.targetId);
    text("#thread-name", state.currentChannel.type === "lobby" ? "All Guests" : target?.displayName || state.currentChannel.label || "Private conversation");
    text("#thread-status", state.currentChannel.type === "lobby" ? "Group conversation" : target?.connected ? "Online now" : "Private correspondence");
    const avatar = $("#thread-avatar");
    if (state.currentChannel.type === "lobby") {
      avatar.textContent = "♜";
      avatar.style.backgroundImage = "";
    } else {
      avatar.textContent = target?.avatarUrl ? "" : initials(target?.displayName);
      avatar.style.backgroundImage = target?.avatarUrl ? `url("${target.avatarUrl}")` : "";
    }
    const thread = $("#message-thread");
    if (!messages.length) {
      thread.innerHTML = `<div class="message-empty"><span aria-hidden="true">✉</span><p>No messages here yet.<br />The first words are yours.</p></div>`;
      return;
    }
    thread.innerHTML = messages.map((message) => {
      const system = message.type === "system";
      const sender = message.anonymous && !message.isMine ? "Anonymous" : message.isMine ? "You" : message.sender?.displayName || "Unknown guest";
      const timeValue = new Date(message.createdAt);
      const readable = Number.isNaN(timeValue.getTime()) ? "" : timeValue.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return `<article class="message-bubble${message.isMine ? " is-mine" : ""}${system ? " is-system" : ""}"><strong>${escapeHtml(sender)}</strong><p>${escapeHtml(message.content)}</p><time datetime="${escapeHtml(message.createdAt)}">${escapeHtml(readable)}</time></article>`;
    }).join("");
    requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  }

  function journalBackupKey() {
    return `larose.journal.${state.snapshot?.session?.id}.${state.snapshot?.me?.id}`;
  }

  function renderJournal() {
    const date = new Date();
    text("#journal-date", date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
    const entries = state.snapshot.me?.journal || [];
    const entry = entries[0] || null;
    const loadedKey = `${state.snapshot.session.id}:${entry?.id || "new"}`;
    if (state.journalLoadedKey !== loadedKey) {
      state.journalLoadedKey = loadedKey;
      state.journalEntryId = entry?.id || null;
      const backup = safeStorageGet(journalBackupKey());
      $("#journal-text").value = entry?.text || backup?.text || "";
    }
  }

  function renderHostShell() {
    if (!state.snapshot.me?.isHost) return;
    const session = state.snapshot.session;
    text("#host-phase-pill", session.status === "lobby" ? "Waiting" : session.phase || session.status);
    const rows = $("#host-player-list");
    rows.innerHTML = (state.snapshot.players || []).map((player) => `<div class="host-player-row"><span class="player-avatar" ${avatarStyle(player)}>${player.avatarUrl ? "" : escapeHtml(initials(player.displayName))}<i class="${player.connected ? "" : "is-offline"}"></i></span><span><strong>${escapeHtml(player.displayName)}</strong><small>${escapeHtml(player.isHost ? "Game Master" : player.character?.name || "Unassigned")}</small></span></div>`).join("");
  }

  async function loadHostDashboard() {
    if (!state.snapshot?.me?.isHost) return;
    try {
      state.hostDashboard = await api("/api/host/dashboard");
      renderHostDashboard();
    } catch (error) {
      toast("Host dashboard unavailable", error.message, "error");
    }
  }

  function renderHostDashboard() {
    const dashboard = state.hostDashboard;
    if (!dashboard) return;
    const players = dashboard.players || [];
    const characters = dashboard.characters || [];
    const assignedElsewhere = (characterId, playerId) => players.some((player) => player.id !== playerId && player.characterId === characterId);
    const list = $("#host-player-list");
    list.innerHTML = players.map((player) => `<div class="host-player-row">
      <span class="player-avatar" ${avatarStyle(player)}>${player.avatarUrl ? "" : escapeHtml(initials(player.displayName))}<i class="${player.connected ? "" : "is-offline"}"></i></span>
      <span><strong>${escapeHtml(player.displayName)}</strong><small>${player.discoveries?.length || 0} objects · ${player.evidenceIds?.length || 0} clues</small>
        ${player.isHost ? "" : `<select data-character-player="${escapeHtml(player.id)}" aria-label="Character for ${escapeHtml(player.displayName)}"><option value="">Unassigned</option>${characters.map((character) => `<option value="${escapeHtml(character.id)}"${player.characterId === character.id ? " selected" : ""}${assignedElsewhere(character.id, player.id) ? " disabled" : ""}>${escapeHtml(character.name)}</option>`).join("")}</select>`}
      </span>
    </div>`).join("");
    text("#host-player-count", `${players.filter((player) => player.connected).length} online`);
  }

  function maybeShowReveal() {
    const reveal = state.snapshot.session?.reveal;
    if (!reveal?.revealedAt || reveal.revealedAt === state.revealShownAt) return;
    state.revealShownAt = reveal.revealedAt;
    const murderer = reveal.murderer;
    openSimple({
      kicker: "The truth, at last",
      title: murderer?.name ? `${murderer.name} killed Vivienne` : "The murderer is revealed",
      content: `<p>${escapeHtml(reveal.summary || "The LaRose mystery has reached its conclusion.")}</p><p><strong>${escapeHtml(murderer?.title || "")}</strong></p>`,
      actions: [{ label: "Review the final case", className: "button-gold", close: true }],
    });
  }

  function switchView(name, { focus = true } = {}) {
    const target = $(`[data-view='${name}']`);
    if (!target || (name === "host" && !state.snapshot?.me?.isHost)) return;
    state.currentView = name;
    $$(".view").forEach((view) => {
      const active = view === target;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    $$(".nav-item").forEach((item) => {
      const active = item.dataset.viewTarget === name;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    if (name === "messages") {
      $("#message-badge").hidden = true;
      $("#message-badge").textContent = "0";
    }
    if (name === "host") loadHostDashboard();
    if (focus) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      $("#main-content").focus({ preventScroll: true });
    }
    $("#mobile-menu-button").setAttribute("aria-expanded", "false");
  }

  async function investigateHotspot(hotspotId, button) {
    if (!state.snapshot) return;
    if (hotspotId === "study-door" && hasEvidence("brass-study-key") && !roomIsUnlocked("study")) {
      const meta = hotspotFallback[hotspotId];
      showInspection({ hotspot: { name: meta.title }, narrative: "The heavy brass key is cold in your hand. It fits the private study lock exactly.", evidence: [], alreadyInvestigated: false }, hotspotId, { showUnlock: true });
      return;
    }
    button?.classList.add("is-loading");
    button?.setAttribute("aria-busy", "true");
    text("#scene-status", "Investigating…");
    try {
      const result = await api("/api/game/investigate", { method: "POST", body: { hotspotId } });
      showInspection(result, hotspotId);
      if (result.evidence?.length) toast("Evidence discovered", result.evidence.length === 1 ? result.evidence[0].title : `${result.evidence.length} items were added to your case file.`);
      await refreshState({ quiet: true });
    } catch (error) {
      const inactive = error.code === "GAME_NOT_ACTIVE";
      const missing = error.code === "REQUIRED_EVIDENCE_MISSING";
      openSimple({
        kicker: inactive ? "The evening has not begun" : missing ? "A locked secret" : "Investigation interrupted",
        title: inactive ? "Wait for your host" : missing ? "You need the right key" : "This object resists inspection",
        content: `<p>${escapeHtml(error.message)}</p>`,
        actions: inactive && state.snapshot.me.isHost ? [
          { label: "Start the game", className: "button-gold", onClick: () => runHostAction("start"), close: true },
          { label: "Close", className: "button-ghost", close: true },
        ] : [],
      });
    } finally {
      button?.classList.remove("is-loading");
      button?.removeAttribute("aria-busy");
      text("#scene-status", "✦ Select an object to investigate");
    }
  }

  function showInspection(result, hotspotId, options = {}) {
    const fallback = hotspotFallback[hotspotId] || {};
    const hotspot = result.hotspot || {};
    const evidence = result.evidence?.[0] || null;
    text("#inspection-kicker", result.alreadyInvestigated ? "Previously inspected" : "Close inspection");
    text("#inspection-title", hotspot.name || fallback.title || "Discovered object");
    text("#inspection-description", result.narrative || hotspot.description || fallback.description || "You examine the object carefully.");
    text("#inspection-icon", fallback.icon || hotspot.icon || "◇");
    const found = $("#evidence-found");
    found.hidden = !evidence;
    if (evidence) {
      text("#evidence-title", evidence.title);
      text("#evidence-description", evidence.description || evidence.detail || "This has been added to your case file.");
      text("#evidence-type", evidenceType(evidence));
      text("#evidence-visibility", "Private to you");
    }
    $("#inspection-already").hidden = !result.alreadyInvestigated;
    const unlock = $("#study-unlock-button");
    unlock.hidden = !options.showUnlock;
    unlock.dataset.hotspotId = hotspotId;
    const burst = $("#evidence-reveal-burst");
    burst.classList.toggle("is-active", Boolean(evidence));
    showDialog($("#evidence-dialog"));
    if (evidence) window.setTimeout(() => burst.classList.remove("is-active"), 1250);
  }

  async function unlockStudy() {
    const button = $("#study-unlock-button");
    button.disabled = true;
    button.textContent = "Turning the key…";
    try {
      await api("/api/game/unlock-room", { method: "POST", body: { roomId: "study", evidenceId: "brass-study-key" } });
      closeDialog($("#evidence-dialog"));
      toast("Private study unlocked", "The lock yields. Fresh scoring is visible inside the brass mechanism.");
      await refreshState({ quiet: true });
      await investigateHotspot("study-door", $("[data-hotspot='study-door']"));
    } catch (error) {
      toast("The key would not turn", error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Use brass key";
    }
  }

  function showEvidenceDetail(evidenceId) {
    const item = state.snapshot.me?.evidence?.find((entry) => entry.id === evidenceId);
    if (!item) return;
    const peers = (state.snapshot.players || []).filter((player) => player.id !== state.snapshot.me.id);
    const shareMarkup = peers.length ? `<label for="share-recipient">Share a copy with</label><select id="share-recipient"><option value="">Choose a guest…</option>${peers.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.displayName)}</option>`).join("")}</select>` : "";
    openSimple({
      kicker: evidenceType(item),
      title: item.title,
      content: `<p>${escapeHtml(item.description || item.detail || "No further notes are available.")}</p>${item.detail && item.detail !== item.description ? `<p>${escapeHtml(item.detail)}</p>` : ""}${shareMarkup}<p class="micro-label">Sharing creates a copy. Your original remains in your inventory.</p>`,
      actions: peers.length ? [
        { label: "Share evidence", className: "button-gold", onClick: () => shareEvidence(item.id) },
        { label: "Keep private", className: "button-outline", close: true },
      ] : [{ label: "Return to case file", className: "button-outline", close: true }],
    });
  }

  async function shareEvidence(evidenceId) {
    const playerId = $("#share-recipient")?.value;
    if (!playerId) {
      toast("Choose a guest", "Select who should receive the evidence copy.", "error");
      return;
    }
    try {
      await api(`/api/game/evidence/${encodeURIComponent(evidenceId)}/share`, { method: "POST", body: { playerId } });
      const player = state.snapshot.players.find((item) => item.id === playerId);
      closeDialog($("#simple-dialog"));
      toast("Evidence shared", `${player?.displayName || "The guest"} now has a copy.`);
    } catch (error) {
      toast("Evidence was not shared", error.message, "error");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const input = $("#message-input");
    const content = input.value.trim();
    if (!content) return;
    const payload = state.currentChannel.type === "direct"
      ? { type: "direct", content, recipientPlayerId: state.currentChannel.targetId }
      : { type: "lobby", content };
    input.disabled = true;
    try {
      const result = await api("/api/messages", { method: "POST", body: payload });
      if (result && !state.snapshot.messages.some((message) => message.id === result.id)) state.snapshot.messages.push(result);
      input.value = "";
      renderMessages();
    } catch (error) {
      toast("Message not sent", error.message, "error");
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function openDirectMessageChooser() {
    const peers = (state.snapshot.players || []).filter((player) => player.id !== state.snapshot.me.id);
    if (!peers.length) {
      toast("The estate is quiet", "Invite another guest before starting a private conversation.");
      return;
    }
    openSimple({
      kicker: "Private correspondence",
      title: "Start a conversation",
      content: `<label for="new-message-recipient">Guest</label><select id="new-message-recipient">${peers.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.displayName)}</option>`).join("")}</select>`,
      actions: [{ label: "Open conversation", className: "button-gold", onClick: () => {
        const id = $("#new-message-recipient").value;
        const player = peers.find((item) => item.id === id);
        state.currentChannel = { type: "direct", targetId: id, label: player?.displayName };
        closeDialog($("#simple-dialog"));
        renderConversations();
        renderMessages();
        $("#message-input").focus();
      } }],
    });
  }

  function openAnonymousTip() {
    const peers = (state.snapshot.players || []).filter((player) => player.id !== state.snapshot.me.id);
    openSimple({
      kicker: "No signature. No trace.",
      title: "Send an anonymous tip",
      content: `<label for="tip-recipient">Recipient</label><select id="tip-recipient"><option value="">All guests</option>${peers.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.displayName)}</option>`).join("")}</select><label for="tip-content">Message</label><textarea id="tip-content" rows="4" maxlength="1000" placeholder="What should they know?"></textarea>`,
      actions: [
        { label: "Slip the note", className: "button-gold", onClick: sendAnonymousTip },
        { label: "Cancel", className: "button-ghost", close: true },
      ],
    });
  }

  async function sendAnonymousTip() {
    const recipientPlayerId = $("#tip-recipient")?.value || null;
    const content = $("#tip-content")?.value.trim();
    if (!content) {
      toast("The note is blank", "Write something before sending it.", "error");
      return;
    }
    try {
      const result = await api("/api/messages", { method: "POST", body: { type: "anonymous", content, recipientPlayerId } });
      if (result && !state.snapshot.messages.some((message) => message.id === result.id)) state.snapshot.messages.push(result);
      closeDialog($("#simple-dialog"));
      renderMessages();
      toast("Anonymous tip delivered", recipientPlayerId ? "Only the chosen guest can read it." : "Every guest can read it.");
    } catch (error) {
      toast("Tip not delivered", error.message, "error");
    }
  }

  async function saveJournal() {
    if (!state.snapshot) return;
    const field = $("#journal-text");
    const value = field.value.trim().slice(0, 2000);
    safeStorageSet(journalBackupKey(), { text: field.value, savedAt: new Date().toISOString() });
    text("#journal-save-state", "Saving…");
    if (!value && !state.journalEntryId) {
      text("#journal-save-state", "All changes saved");
      return;
    }
    try {
      let result;
      if (state.journalEntryId) result = await api(`/api/journal/${encodeURIComponent(state.journalEntryId)}`, { method: "PATCH", body: { text: value || "—" } });
      else result = await api("/api/journal", { method: "POST", body: { text: value } });
      state.journalEntryId = result.id;
      if (state.snapshot.me.journal?.length) state.snapshot.me.journal[0] = result;
      else state.snapshot.me.journal = [result];
      text("#journal-save-state", "All changes saved");
    } catch (error) {
      text("#journal-save-state", "Saved on this device");
      toast("Journal sync delayed", error.message, "error");
    }
  }

  function queueJournalSave() {
    text("#journal-save-state", "Saving…");
    clearTimeout(state.journalTimer);
    state.journalTimer = window.setTimeout(saveJournal, 850);
  }

  async function castAccusation() {
    if (!state.selectedSuspect || state.snapshot.accusation) return;
    const character = state.snapshot.characters.find((item) => item.id === state.selectedSuspect);
    const theory = state.suspicion[state.selectedSuspect]?.notes || "";
    openSimple({
      kicker: "A permanent decision",
      title: `Accuse ${character?.name || "this suspect"}?`,
      content: `<p>Your accusation cannot be changed after it is submitted.</p>${theory ? `<p><strong>Your theory:</strong> ${escapeHtml(theory)}</p>` : ""}`,
      actions: [
        { label: "Submit accusation", className: "button-danger", onClick: async () => {
          try {
            await api("/api/game/accusation", { method: "POST", body: { suspectCharacterId: state.selectedSuspect, theory } });
            closeDialog($("#simple-dialog"));
            toast("Accusation sealed", "Your vote is now locked.");
            await refreshState({ quiet: true });
          } catch (error) {
            toast("Accusation not submitted", error.message, "error");
          }
        } },
        { label: "Review again", className: "button-ghost", close: true },
      ],
    });
  }

  async function runHostAction(action) {
    if (!state.snapshot?.me?.isHost) return;
    const session = state.snapshot.session;
    try {
      if (action === "start") {
        await api("/api/host/game", { method: "PATCH", body: { action: session.status === "paused" ? "resume" : "start" } });
        toast("Investigation started", "The Grand Foyer is now open for discovery.");
      } else if (action === "pause") {
        await api("/api/host/game", { method: "PATCH", body: { action: session.status === "paused" ? "resume" : "pause" } });
        toast(session.status === "paused" ? "Investigation resumed" : "Investigation paused");
      } else if (action === "next_round") {
        const round = Number(session.round || 0) + 1;
        await api("/api/host/game", { method: "PATCH", body: { round, phase: round >= 3 ? "Interrogation" : "Investigation", ...(session.status === "lobby" ? { action: "start" } : {}) } });
        toast("The story advances", `Round ${round} is now active.`);
      } else if (action === "unlock_study") {
        await api("/api/host/rooms/study/unlock", { method: "POST", body: {} });
        toast("Private Study unlocked", "Every guest may now enter the crime scene.");
      } else if (action === "begin_accusation") {
        await api("/api/host/game", { method: "PATCH", body: { action: "open-accusations", phase: "Final Accusations" } });
        toast("Final accusations are open", "Every guest must now name a suspect.");
      } else if (action === "start_timer") {
        const minutes = Math.max(1, Math.min(120, Number($("#timer-minutes").value || 15)));
        await api("/api/host/timer", { method: "PUT", body: { action: "start", durationSeconds: minutes * 60 } });
        toast("Round timer started", `${minutes} minutes remain.`);
      } else if (action === "stop_timer") {
        await api("/api/host/timer", { method: "PUT", body: { action: "clear" } });
        toast("Round timer cleared");
      } else if (action === "release_clue") {
        openClueRelease();
        return;
      } else if (action === "reveal") {
        confirmReveal();
        return;
      }
      closeDialog($("#simple-dialog"));
      await refreshState({ quiet: true });
      if (state.currentView === "host") loadHostDashboard();
    } catch (error) {
      toast("Host action failed", error.message, "error");
    }
  }

  function openClueRelease() {
    const players = (state.snapshot.players || []).filter((player) => !player.isHost);
    openSimple({
      kicker: "Game master clue",
      title: "Release a clue",
      content: `<label for="clue-id">Clue or evidence ID</label><input id="clue-id" value="sealed-audit-letter" /><label for="clue-player">Grant evidence copy to</label><select id="clue-player"><option value="">Release globally only</option>${players.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.displayName)}</option>`).join("")}</select><p>Known foyer IDs include sealed-audit-letter, altered-arrival-record, and statue-brass-dust.</p>`,
      actions: [
        { label: "Release clue", className: "button-gold", onClick: releaseClue },
        { label: "Cancel", className: "button-ghost", close: true },
      ],
    });
  }

  async function releaseClue() {
    const clueId = $("#clue-id")?.value.trim();
    const playerId = $("#clue-player")?.value || null;
    if (!clueId) return;
    try {
      await api(`/api/host/clues/${encodeURIComponent(clueId)}/release`, { method: "POST", body: { playerId } });
      closeDialog($("#simple-dialog"));
      toast("Clue released", playerId ? "The selected guest received a private copy." : "The clue is now globally available.");
      await refreshState({ quiet: true });
    } catch (error) {
      toast("Clue not released", error.message, "error");
    }
  }

  function confirmReveal() {
    openSimple({
      kicker: "End the mystery",
      title: "Reveal Vivienne's murderer?",
      content: "<p>This ends the active game and shows the complete solution to every guest. Accusations should be locked first.</p>",
      actions: [
        { label: "Reveal the truth", className: "button-danger", onClick: async () => {
          try {
            await api("/api/host/reveal", { method: "POST", body: {} });
            closeDialog($("#simple-dialog"));
            await refreshState({ quiet: true });
          } catch (error) {
            toast("Reveal failed", error.message, "error");
          }
        } },
        { label: "Not yet", className: "button-ghost", close: true },
      ],
    });
  }

  async function assignCharacter(playerId, characterId) {
    try {
      await api(`/api/host/players/${encodeURIComponent(playerId)}/character`, { method: "PATCH", body: { characterId: characterId || null } });
      toast("Character assignment updated");
      await refreshState({ quiet: true });
      await loadHostDashboard();
    } catch (error) {
      toast("Role not assigned", error.message, "error");
      await loadHostDashboard();
    }
  }

  function bindEntry() {
    const activateTab = (name) => {
      const join = name === "join";
      $("#join-tab").classList.toggle("is-active", join);
      $("#join-tab").setAttribute("aria-selected", String(join));
      $("#host-tab").classList.toggle("is-active", !join);
      $("#host-tab").setAttribute("aria-selected", String(!join));
      $("#join-form").hidden = !join;
      $("#host-form").hidden = join;
      showAuthError("");
    };
    $("#join-tab").addEventListener("click", () => activateTab("join"));
    $("#host-tab").addEventListener("click", () => activateTab("host"));
    $("#join-form").addEventListener("submit", joinSession);
    $("#host-form").addEventListener("submit", createSession);
    $("#room-code").addEventListener("input", (event) => { event.target.value = event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(); });
    $("#avatar-upload").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      const preview = $("#avatar-preview");
      if (!file) {
        preview.style.backgroundImage = "";
        preview.textContent = "+";
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        event.target.value = "";
        showAuthError("Portraits must be 2 MB or smaller.");
        return;
      }
      const url = URL.createObjectURL(file);
      preview.style.backgroundImage = `url("${url}")`;
      preview.textContent = "";
    });
    $("#reconnect-button").addEventListener("click", () => restoreSession());
    $("#forget-session-button").addEventListener("click", () => {
      clearRememberedSession();
      renderReconnectCard();
    });
  }

  function bindGame() {
    document.addEventListener("click", async (event) => {
      const viewButton = event.target.closest("[data-view-target]");
      if (viewButton) {
        switchView(viewButton.dataset.viewTarget);
        $("#profile-menu").hidden = true;
        return;
      }
      const closeButton = event.target.closest("[data-close-dialog]");
      if (closeButton) {
        closeDialog(closeButton.closest("dialog"));
        return;
      }
      const simpleButton = event.target.closest("[data-simple-action]");
      if (simpleButton) {
        const action = state.simpleActions.get(simpleButton.dataset.simpleAction);
        if (action?.close) closeDialog($("#simple-dialog"));
        if (action?.onClick) await action.onClick();
        return;
      }
      const hotspot = event.target.closest("[data-hotspot]");
      if (hotspot) {
        await investigateHotspot(hotspot.dataset.hotspot, hotspot);
        return;
      }
      const evidenceButton = event.target.closest("[data-evidence-id]");
      if (evidenceButton) {
        showEvidenceDetail(evidenceButton.dataset.evidenceId);
        return;
      }
      const roomButton = event.target.closest("[data-room]");
      if (roomButton) {
        const labels = { foyer: "Grand Foyer", dining: "Dining Room", library: "Library", study: "Private Study", ballroom: "Ballroom", conservatory: "Conservatory" };
        const alias = { foyer: "grand-foyer", dining: "dining-room", library: "library", study: "study", ballroom: "ballroom", conservatory: "conservatory" };
        if (roomButton.classList.contains("is-locked")) {
          openSimple({ title: `${labels[roomButton.dataset.room]} is locked`, content: `<p>${roomButton.dataset.room === "study" ? "A brass key is hidden somewhere in the foyer." : "This room opens later in the investigation."}</p>` });
        } else if (roomButton.dataset.room !== "foyer") {
          openSimple({ kicker: "Room unlocked", title: labels[roomButton.dataset.room], content: "<p>You have secured access. Full scene exploration continues beyond the playable Grand Foyer milestone.</p>" });
        }
        return;
      }
      const conversation = event.target.closest("[data-channel]");
      if (conversation) {
        if (conversation.dataset.channel === "group") state.currentChannel = { type: "lobby", targetId: null, label: "All Guests" };
        else {
          const player = state.snapshot.players.find((item) => item.id === conversation.dataset.playerId);
          state.currentChannel = { type: "direct", targetId: conversation.dataset.playerId, label: player?.displayName };
        }
        renderConversations();
        renderMessages();
        return;
      }
      const suspicionButton = event.target.closest("[data-suspect][data-level]");
      if (suspicionButton) {
        const id = suspicionButton.dataset.suspect;
        state.suspicion[id] = { ...(state.suspicion[id] || {}), level: Number(suspicionButton.dataset.level) };
        saveSuspicion();
        renderSuspects();
        return;
      }
      const selectSuspect = event.target.closest("[data-select-suspect]");
      if (selectSuspect) {
        state.selectedSuspect = selectSuspect.dataset.selectSuspect;
        renderSuspects();
        return;
      }
      const hostAction = event.target.closest("[data-host-action]");
      if (hostAction) {
        await runHostAction(hostAction.dataset.hostAction);
        return;
      }
      if (event.target.closest("[data-copy-code]")) {
        await copyRoomCode();
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.matches("[data-suspect-notes]")) {
        const id = event.target.dataset.suspectNotes;
        state.suspicion[id] = { ...(state.suspicion[id] || {}), notes: event.target.value };
        saveSuspicion();
      }
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches("[data-character-player]")) assignCharacter(event.target.dataset.characterPlayer, event.target.value);
    });

    $("#profile-button").addEventListener("click", () => {
      const menu = $("#profile-menu");
      menu.hidden = !menu.hidden;
      $("#profile-button").setAttribute("aria-expanded", String(!menu.hidden));
    });
    $("#leave-session-button").addEventListener("click", () => {
      openSimple({
        title: "Leave LaRose Estate?",
        content: "<p>This removes the saved invitation from this device. You can still rejoin later with the private room code while the game is active.</p>",
        actions: [
          { label: "Leave session", className: "button-danger", onClick: async () => { closeDialog($("#simple-dialog")); await leaveSession(); } },
          { label: "Stay", className: "button-ghost", close: true },
        ],
      });
    });
    $("#copy-code-button").addEventListener("click", copyRoomCode);
    $("#mobile-menu-button").addEventListener("click", () => {
      const nav = $("#primary-nav");
      nav.scrollIntoView({ behavior: "smooth", block: "nearest" });
      $("#mobile-menu-button").setAttribute("aria-expanded", "true");
      $(".nav-item", nav)?.focus();
    });
    $("#study-unlock-button").addEventListener("click", unlockStudy);
    $("#message-form").addEventListener("submit", sendMessage);
    $("#refresh-messages-button").addEventListener("click", async () => {
      try {
        const result = await api("/api/messages");
        state.snapshot.messages = result.messages || [];
        renderMessages();
      } catch (error) {
        toast("Messages not refreshed", error.message, "error");
      }
    });
    $("#new-message-button").addEventListener("click", openDirectMessageChooser);
    $("#anonymous-tip-button").addEventListener("click", openAnonymousTip);
    $("#evidence-search").addEventListener("input", renderEvidence);
    $("#evidence-filter").addEventListener("change", renderEvidence);
    $("#journal-text").setAttribute("maxlength", "2000");
    $("#journal-text").addEventListener("input", queueJournalSave);
    $$("[data-prompt]").forEach((button) => button.addEventListener("click", () => {
      const field = $("#journal-text");
      const prefix = field.value && !field.value.endsWith("\n") ? "\n\n" : "";
      field.value += `${prefix}${button.dataset.prompt}\n`;
      field.focus();
      queueJournalSave();
    }));
    $("#cast-vote-button").addEventListener("click", castAccusation);

    $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (outside) closeDialog(dialog);
      }
    }));
  }

  async function initialize() {
    bindEntry();
    bindGame();
    const saved = renderReconnectCard();
    if (saved?.token) await restoreSession({ automatic: true });
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
