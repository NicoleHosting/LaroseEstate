import crypto from 'node:crypto';

/**
 * Server-only content and pure helpers for the autonomous LaRose director.
 * Nothing in this module should be serialized directly to a client. In
 * particular, MYSTERY_SCENARIOS contains the sealed answer for each game.
 */

export const ACTS = Object.freeze([
  Object.freeze({
    index: 1,
    slug: 'family-gathering',
    title: 'Act I — The Family Gathering',
    standardSeconds: 10 * 60,
    fastSeconds: 4,
    rooms: ['grand-foyer', 'dining-room'],
    narrator: 'Welcome to LaRose Estate. Champagne glitters, smiles sharpen, and Madame Vivienne has promised an announcement that will change the family forever.',
  }),
  Object.freeze({
    index: 2,
    slug: 'murder',
    title: 'Act II — The Murder',
    standardSeconds: 10 * 60,
    fastSeconds: 4,
    rooms: ['grand-foyer', 'dining-room', 'study', 'library'],
    narrator: 'A silver tray crashes behind the locked study door. Vivienne LaRose is dead. Nobody leaves the estate, and every alibi is now evidence.',
  }),
  Object.freeze({
    index: 3,
    slug: 'investigation',
    title: 'Act III — The Investigation',
    standardSeconds: 30 * 60,
    fastSeconds: 8,
    rooms: ['grand-foyer', 'dining-room', 'study', 'library', 'conservatory', 'wine-cellar'],
    narrator: 'The house opens its locked drawers and hidden passages. Test every story, trace every object, and remember that a polished lie can still leave fingerprints.',
  }),
  Object.freeze({
    index: 4,
    slug: 'betrayal',
    title: 'Act IV — Blood and Betrayal',
    standardSeconds: 15 * 60,
    fastSeconds: 5,
    rooms: ['grand-foyer', 'dining-room', 'study', 'library', 'conservatory', 'wine-cellar', 'ballroom', 'chapel-alcove'],
    narrator: 'Alliances fracture. Private bargains surface, planted evidence changes hands, and the family must decide which betrayals hide murder—and which merely hide shame.',
  }),
  Object.freeze({
    index: 5,
    slug: 'final-accusations',
    title: 'Act V — Final Accusations',
    standardSeconds: 10 * 60,
    fastSeconds: 5,
    rooms: ['grand-foyer', 'dining-room', 'study', 'library', 'conservatory', 'wine-cellar', 'ballroom', 'chapel-alcove'],
    narrator: 'The doors lock for the final time. Name Vivienne’s killer, explain the motive and method, and decide which evidence deserves to survive the night.',
  }),
]);

export const POSTGAME_DURATIONS = Object.freeze({
  standard: Object.freeze({ reveal: 120, reunion: 8 * 60, awards: 4 * 60 }),
  fast: Object.freeze({ reveal: 3, reunion: 4, awards: 3 }),
});

// These variants preserve the canonical fair-play trail while changing which
// part of Lucien's compound motive dominated. This keeps every authored clue
// logically true and still gives each session a separately sealed case file.
const BASE_TIMELINE = Object.freeze([
  '18:45 — Simone hides Vivienne’s emergency study key in the foyer books.',
  '19:18 — Lucien enters through the east entrance.',
  '19:24 — The guest-book arrival time is altered.',
  '20:08 — Vivienne announces a new codicil and a morning audit.',
  '20:21 — A rough duplicate key opens the study.',
  '20:23 — Oleander concentrate is added to Vivienne’s cordial.',
  '20:26 — A trust ledger page is burned and the study is locked.',
  '20:34 — Vivienne collapses behind the locked door.',
]);

const PHYSICIAN_TIMELINE = Object.freeze([
  '18:45 — Simone hides Vivienne’s emergency study key in the foyer books.',
  '19:18 — Celeste enters through the east entrance with her medical case.',
  '19:24 — Celeste’s guest-book arrival time is altered.',
  '20:08 — Vivienne announces a new codicil and a morning clinical audit.',
  '20:17 — Celeste gives Vivienne the documented, harmless hawthorn tonic.',
  '20:21 — A wax-gripped duplicate key opens the study.',
  '20:23 — Oleander concentrate is added to Vivienne’s cordial.',
  '20:26 — A clinical-payment ledger page is burned and the study is locked.',
  '20:34 — Vivienne collapses behind the locked door.',
]);

const VINTNER_TIMELINE = Object.freeze([
  '18:45 — Simone hides Vivienne’s emergency study key in the foyer books.',
  '19:18 — Dominic enters through the east entrance carrying a tasting cane.',
  '19:24 — Dominic’s guest-book arrival time is altered.',
  '20:08 — Vivienne announces a new codicil and a morning vineyard-loan audit.',
  '20:18 — Dominic signs for a separate tasting glass after kitchen service.',
  '20:21 — A cellar-cut duplicate key opens the study.',
  '20:23 — Oleander concentrate is added to Vivienne’s cordial.',
  '20:26 — A vineyard-loan ledger page is burned and the study is locked.',
  '20:34 — Vivienne collapses behind the locked door.',
]);

const GENUINE_EVIDENCE = Object.freeze([
  'sealed-audit-letter',
  'scorched-ledger-fragment',
  'revised-codicil',
  'altered-arrival-record',
  'doorman-time-note',
  'cordial-glass-residue',
  'oleander-phial',
  'duplicate-key-scratches',
  'brass-key-filings',
  'black-seal-wax',
]);

export const MYSTERY_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'trust-audit',
    murdererId: 'lucien-larose',
    weapon: 'Oleander concentrate in Vivienne’s blackcurrant cordial',
    motive: 'Vivienne’s morning audit would expose Lucien’s theft from the LaRose charitable trust.',
    method: 'Lucien used a rough duplicate key, poisoned the cordial, altered his arrival time, and burned part of the trust ledger.',
    timeline: BASE_TIMELINE,
    genuineEvidenceIds: GENUINE_EVIDENCE,
    summary: 'Lucien LaRose killed Vivienne with oleander to stop the morning audit from exposing his theft. The altered arrival record, poisoned cordial, duplicate-key trail, burned ledger, and black rose-and-sword wax form the complete case.',
    characterOverlays: Object.freeze({}),
    evidenceOverrides: Object.freeze({}),
    hotspotNarratives: Object.freeze({}),
  }),
  Object.freeze({
    id: 'physicians-reckoning',
    murdererId: 'celeste-larose',
    weapon: 'Oleander concentrate in Vivienne’s blackcurrant cordial',
    motive: 'Vivienne planned to expose Celeste’s diversion of trust money into an unauthorized cardiac trial and remove her from the family foundation.',
    method: 'Celeste used a wax-gripped duplicate key, dosed the cordial with oleander to imitate Vivienne’s known arrhythmia, changed her arrival time, and burned the clinical-payment ledger.',
    timeline: PHYSICIAN_TIMELINE,
    genuineEvidenceIds: GENUINE_EVIDENCE,
    summary: 'Dr. Celeste LaRose killed Vivienne with oleander to conceal an unauthorized cardiac trial funded through the trust. Her altered arrival, clinical-payment ledger, poisoned cordial, duplicate-key damage, prescription wax, and medical access establish the case.',
    characterOverlays: Object.freeze({
      'celeste-larose': Object.freeze({
        alignment: 'murderer',
        dossier: 'Vivienne discovered that you diverted trust funds into an unauthorized cardiac trial. Tonight she intended to remove you from the foundation and report you.',
        secret: 'You murdered Vivienne with oleander, using her known arrhythmia as camouflage. You changed your arrival time, used a wax-gripped duplicate key, and burned the clinical-payment ledger.',
        alibi: 'You claim you arrived at 19:48 and remained with Valentina after giving Vivienne a harmless tonic. The tonic was harmless; the claim about your arrival is not.',
        objectives: ['Keep the unauthorized trial hidden.', 'Separate the harmless tonic from the later poison.', 'Push investigators toward Lucien’s genuine but unrelated trust theft.'],
        knowledge: ['The duplicate key carries crimson prescription wax.', 'The altered arrival record, clinical ledger, and oleander residue can identify you.'],
      }),
      'lucien-larose': Object.freeze({
        alignment: 'innocent',
        dossier: 'Vivienne planned to expose your genuine trust theft, giving you an obvious motive you did not act upon. Somebody is using your scandal as cover for murder.',
        secret: 'You diverted trust funds and changed one account label, but you did not poison Vivienne or enter the study. You saw Celeste at the east entrance before her claimed arrival.',
        alibi: 'You were in a recorded call with the family auditor during the murder window, but producing it confirms the audit was aimed partly at you.',
        objectives: ['Prove the murder trail is separate from your financial misconduct.', 'Authenticate the call that clears the murder window.', 'Identify who repurposed the audit scandal as cover.'],
        knowledge: ['Celeste was inside the estate before 19:30.', 'Her prescription seals use a distinctive crimson wax.'],
      }),
    }),
    evidenceOverrides: Object.freeze({
      'portrait-warning': Object.freeze({ title: 'Vivienne’s Clinical Warning', description: 'The inscription points to falsified clinical accounts and says to follow the medical seal rather than the inheritance quarrel.', tags: ['motive', 'trial', 'celeste'] }),
      'altered-arrival-record': Object.freeze({ title: 'Altered Physician Arrival Record', shortDescription: 'Celeste’s arrival was changed from 19:18 to 19:48.', description: 'Pressure marks show “Dr. C. LaRose — 19:18” beneath a fresh 19:48 entry. The correction ink matches a pen in Celeste’s medical case.', tags: ['opportunity', 'alibi', 'celeste'] }),
      'doorman-time-note': Object.freeze({ title: 'Doorman’s Physician Note', description: 'Darius’s pressure-clock slip reads “Dr. C. LaRose — east entrance — 19:18,” independently defeating Celeste’s claimed arrival.' }),
      'sealed-audit-letter': Object.freeze({ title: 'Sealed Clinical Audit Letter', shortDescription: 'The morning audit targets unauthorized cardiac-trial payments.', description: 'Vivienne’s attorney confirms an 08:00 audit of clinical account C-4 and her instruction to remove “the foundation physician” immediately.', tags: ['motive', 'trial', 'celeste'] }),
      'duplicate-key-scratches': Object.freeze({ description: 'A rough duplicate scored the study lock. Crimson wax lodged in the newest track matches Celeste’s prescription seals.' }),
      'black-seal-wax': Object.freeze({ title: 'Crimson Prescription Wax', shortDescription: 'A wax flake bears part of Celeste’s medical seal.', description: 'The lock holds crimson wax impressed with a broken caduceus. Celeste uses the same compound and matrix to seal controlled prescriptions.', tags: ['identity', 'celeste', 'seal'] }),
      'lucien-black-seal': Object.freeze({ title: 'Lucien’s Unrelated Seal Ring', shortDescription: 'Lucien’s black seal does not match the crimson lock wax.', description: 'The matrix and compound exclude Lucien’s ring from the wax in the study lock, despite his separate financial motive.', tags: ['exculpatory', 'lucien', 'seal'] }),
      'cordial-glass-residue': Object.freeze({ description: 'Oleander residue establishes poisoning after kitchen service. Its measured concentration suggests someone with clinical dosing experience.' }),
      'oleander-phial': Object.freeze({ title: 'Prescription-Wax Oleander Phial', description: 'The poison matches the study glass. Crimson wax and a caduceus impression match Celeste’s controlled-prescription seals.', tags: ['means', 'oleander', 'celeste', 'seal'] }),
      'scorched-ledger-fragment': Object.freeze({ title: 'Scorched Clinical-Payment Ledger', shortDescription: 'A fragment records trust transfers into trial account C-4.', description: 'The surviving entries carry Celeste’s authorization code and payments to an unregistered cardiac study.', tags: ['motive', 'trial', 'celeste'] }),
      'revised-codicil': Object.freeze({ description: 'The signed codicil removes Celeste from the foundation and orders an independent audit of her clinical program.', tags: ['motive', 'foundation', 'celeste'] }),
      'brass-key-filings': Object.freeze({ title: 'Brass Filings from the Medical Case', shortDescription: 'Dust in Celeste’s instrument roll matches the study lock alloy.', description: 'Filings and a waxed blank in a false seam show where Celeste hid the duplicate key.', tags: ['identity', 'duplicate-key', 'celeste'] }),
      'reporters-transfer-notes': Object.freeze({ description: 'Noelle’s dates connect trust transfers both to Lucien’s unrelated debt and to Celeste’s unregistered trial, requiring the clinical ledger to distinguish them.' }),
      'bank-override-receipt': Object.freeze({ title: 'Clinical Transfer Override', description: 'The transfer override routes trust funds to trial account C-4 under Celeste’s foundation credentials.', tags: ['motive', 'trial', 'celeste'] }),
      'codicil-carbon-copy': Object.freeze({ description: 'Beatrice’s copy confirms Vivienne ordered Celeste removed from the foundation pending a clinical audit.', tags: ['motive', 'beatrice', 'celeste'] }),
      'sealed-tonic-vial': Object.freeze({ shortDescription: 'The tonic was harmless, but it does not account for Celeste’s later access.', description: 'The sealed hawthorn dose did not kill Vivienne. It also gave Celeste a credible medical reason to approach her before the separate poisoning.', redHerring: false }),
      'porte-cochere-clock-slip': Object.freeze({ title: 'Porte-Cochere Physician Slip', shortDescription: 'The vehicle clock records Celeste at 19:18.', description: 'Darius’s retained slip independently confirms Celeste’s arrival before the time she wrote in the guest book.', tags: ['opportunity', 'darius', 'celeste'] }),
      'corridor-audio-clip': Object.freeze({ description: 'The recording captures the lock at 20:21 and 20:26; between them, Celeste’s distinctive metal medical-case clasp snaps shut.', tags: ['opportunity', 'celeste', 'timeline'] }),
      'camera-maintenance-log': Object.freeze({ description: 'The east camera outage overlaps Celeste’s concealed early arrival, though the maintenance log does not name her.', tags: ['opportunity', 'camera', 'celeste'] }),
    }),
    hotspotNarratives: Object.freeze({
      'family-portrait': 'Vivienne’s warning points to falsified clinical accounts and a distinctive medical seal hidden “behind the rose.”',
      'guest-book': 'Celeste’s entry reads 19:48, but the sheet beneath preserves “Dr. C. LaRose — 19:18” in sharp pressure marks.',
      'rose-arrangement': 'The false base holds an attorney’s letter ordering an audit of clinical account C-4 and removal of the foundation physician.',
      'marble-statue': 'The missing ruby is an unrelated scandal. Beneath its mount, fresh brass swarf suggests recent duplicate-key work.',
      'books': 'The hollowed novel contains Vivienne’s untouched emergency study key, proving another key made the rough lock track.',
      'study-door': 'The original key opens the study. A newer rough track contains crimson wax impressed with part of a caduceus.',
    }),
  }),
  Object.freeze({
    id: 'vintners-debt',
    murdererId: 'dominic-larose',
    weapon: 'Oleander concentrate in Vivienne’s blackcurrant cordial',
    motive: 'Vivienne planned to expose Dominic’s fraudulent vineyard loans, cancel the rescue, and turn over the trust accounts at dawn.',
    method: 'Dominic carried oleander in a tasting vial, entered with a cellar-cut duplicate key, poisoned the cordial, altered his arrival time, and burned the vineyard loan page.',
    timeline: VINTNER_TIMELINE,
    genuineEvidenceIds: GENUINE_EVIDENCE,
    summary: 'Dominic LaRose killed Vivienne with oleander to stop exposure of his fraudulent vineyard loans. His altered arrival, threatening note, poisoned cordial, cellar-cut key, burgundy vine wax, and scorched loan ledger establish the case.',
    characterOverlays: Object.freeze({
      'dominic-larose': Object.freeze({
        alignment: 'murderer',
        dossier: 'Vivienne discovered that you pledged wine reserves you did not own and diverted trust money into the vineyard. She planned to expose you after dessert.',
        secret: 'You murdered Vivienne with oleander from a tasting vial. You used a cellar-cut duplicate key, altered your arrival time, and burned the loan ledger after poisoning her cordial.',
        alibi: 'You claim you arrived at 19:48 and stayed in the dining room. The pressure clock and a gap in wine-cellar service destroy that story.',
        objectives: ['Make the threat note look like anger over a contract.', 'Keep investigators away from the cane rack and loan ledger.', 'Encourage suspicion of Lucien’s unrelated trust theft.'],
        knowledge: ['The burgundy vine wax on the duplicate key matches your reserve seals.', 'The altered arrival, poison vial, and vineyard ledger can expose you.'],
      }),
      'lucien-larose': Object.freeze({
        alignment: 'innocent',
        dossier: 'Your theft from the trust makes you the obvious suspect, but you did not kill Vivienne. Dominic asked you to conceal a vineyard loan and you refused.',
        secret: 'You moved trust money and expected Vivienne’s audit to ruin you. During the murder window, you were confronting Malcolm on a recorded bank line.',
        alibi: 'The bank recording clears the murder window but confirms your financial crimes.',
        objectives: ['Separate your theft from Vivienne’s murder.', 'Recover the recorded bank call.', 'Prove Dominic used your scandal as cover.'],
        knowledge: ['Dominic’s reserve wax is burgundy and embossed with a vine.', 'He knew the cordial route and had access to tasting vials.'],
      }),
    }),
    evidenceOverrides: Object.freeze({
      'portrait-warning': Object.freeze({ title: 'Vivienne’s Vineyard Warning', description: 'The inscription points to forged vineyard collateral and says to follow the loan ledger rather than the inheritance quarrel.', tags: ['motive', 'vineyard', 'dominic'] }),
      'altered-arrival-record': Object.freeze({ title: 'Altered Vintner Arrival Record', shortDescription: 'Dominic’s arrival was changed from 19:18 to 19:48.', description: 'Pressure marks preserve “D. LaRose — 19:18” beneath a fresh 19:48 entry. The correction ink matches Dominic’s cellar pen.', tags: ['opportunity', 'alibi', 'dominic'] }),
      'doorman-time-note': Object.freeze({ title: 'Doorman’s Vintner Note', description: 'Darius’s slip reads “D. LaRose — east entrance — 19:18,” defeating Dominic’s claimed arrival.' }),
      'sealed-audit-letter': Object.freeze({ title: 'Sealed Vineyard Audit Letter', shortDescription: 'The morning audit targets fraudulent vineyard loans.', description: 'Vivienne’s attorney confirms an 08:00 review of vineyard account V-7 and her instruction to cancel Dominic’s rescue agreement.', tags: ['motive', 'vineyard', 'dominic'] }),
      'duplicate-key-scratches': Object.freeze({ description: 'A rough duplicate scored the study lock. Burgundy wax in the track matches the seals on Dominic’s reserve bottles.' }),
      'black-seal-wax': Object.freeze({ title: 'Burgundy Vine-Stamped Wax', shortDescription: 'A wax flake bears Dominic’s vineyard emblem.', description: 'The lock holds burgundy wax impressed with a curling vine. The same compound seals Dominic’s private reserve.', tags: ['identity', 'dominic', 'seal'] }),
      'lucien-black-seal': Object.freeze({ title: 'Lucien’s Unrelated Seal Ring', shortDescription: 'Lucien’s black wax does not match the burgundy lock wax.', description: 'The compound and matrix exclude Lucien’s seal from the study lock despite his separate financial motive.', tags: ['exculpatory', 'lucien', 'seal'] }),
      'dominic-threat-note': Object.freeze({ title: 'Dominic’s Murderous Threat', shortDescription: 'Dominic warns Vivienne she will regret exposing the vineyard loans.', description: 'Ink dating places the note after Vivienne canceled the rescue and demanded the V-7 records. Its phrasing matches a threat overheard in the cellar.', tags: ['motive', 'dominic', 'threat'], redHerring: false, points: 3 }),
      'cordial-glass-residue': Object.freeze({ description: 'Oleander in the glass was added after kitchen service. A trace of vineyard fining clay clings to the stem.' }),
      'oleander-phial': Object.freeze({ title: 'Vine-Wax Oleander Tasting Vial', description: 'The poison matches the study glass. Burgundy wax and a vine stamp connect the vial to Dominic’s private reserve kit.', tags: ['means', 'oleander', 'dominic', 'seal'] }),
      'scorched-ledger-fragment': Object.freeze({ title: 'Scorched Vineyard Loan Ledger', shortDescription: 'A fragment records fraudulent borrowing against family reserves.', description: 'The entries carry Dominic’s authorization and match the collateral schedule Vivienne planned to expose.', tags: ['motive', 'vineyard', 'dominic'] }),
      'revised-codicil': Object.freeze({ description: 'The codicil cancels Dominic’s rescue, removes his vineyard from family backing, and orders an audit of V-7.', tags: ['motive', 'vineyard', 'dominic'] }),
      'brass-key-filings': Object.freeze({ title: 'Brass Filings from the Cellar Cane Rack', shortDescription: 'Metal dust beside Dominic’s tasting cane matches the study lock.', description: 'Filings and a waxed key blank show the duplicate was cut and hidden among Dominic’s cellar tools.', tags: ['identity', 'duplicate-key', 'dominic'] }),
      'cordial-service-card': Object.freeze({ description: 'The kitchen batch was clean. Dominic signed for a separate tasting glass after it left service, placing him on the cordial route.', tags: ['means', 'dominic', 'service'] }),
      'reporters-transfer-notes': Object.freeze({ description: 'Noelle’s dates separate Lucien’s unrelated theft from Dominic’s later V-7 collateral fraud; the vineyard ledger identifies the murder motive.', tags: ['motive', 'vineyard', 'dominic'] }),
      'bank-override-receipt': Object.freeze({ title: 'Vineyard Loan Override', description: 'The override routes trust collateral into Dominic’s unauthorized V-7 loan.', tags: ['motive', 'vineyard', 'dominic'] }),
      'codicil-carbon-copy': Object.freeze({ description: 'Beatrice’s copy confirms Vivienne canceled Dominic’s rescue and ordered the vineyard loan audit.', tags: ['motive', 'beatrice', 'dominic'] }),
      'porte-cochere-clock-slip': Object.freeze({ title: 'Porte-Cochere Vintner Slip', shortDescription: 'The vehicle clock records Dominic at 19:18.', description: 'Darius’s retained slip independently confirms Dominic’s early arrival.', tags: ['opportunity', 'darius', 'dominic'] }),
      'corridor-audio-clip': Object.freeze({ description: 'The recorder captures the lock at 20:21 and 20:26; a metal-tipped tasting cane strikes the skirting between them.', tags: ['opportunity', 'dominic', 'timeline'] }),
      'camera-maintenance-log': Object.freeze({ description: 'The east camera outage overlaps Dominic’s concealed early arrival with his tasting cane, though the log itself does not identify him.', tags: ['opportunity', 'camera', 'dominic'] }),
    }),
    hotspotNarratives: Object.freeze({
      'family-portrait': 'Vivienne’s warning points to forged vineyard collateral and tells investigators to follow the ledger rather than the will.',
      'guest-book': 'Dominic’s entry reads 19:48, but the sheet beneath preserves “D. LaRose — 19:18” in sharp pressure marks.',
      'rose-arrangement': 'The false base holds an attorney’s letter ordering an audit of vineyard account V-7 and cancellation of Dominic’s rescue.',
      'marble-statue': 'The missing ruby is unrelated. Burgundy wax and curled brass swarf beneath the mount suggest duplicate-key work.',
      'books': 'The hollowed novel contains Vivienne’s untouched emergency key, proving a rough duplicate made the second lock track.',
      'study-door': 'The original key opens the study. A rougher track contains burgundy wax stamped with part of a vineyard emblem.',
    }),
  }),
]);

export const MANSION_INTERACTIONS = Object.freeze([
  Object.freeze({
    id: 'study-writing-desk', roomId: 'study', name: 'Vivienne’s Writing Desk', minAct: 2,
    description: 'A writing desk with one drawer sitting slightly proud of its frame.',
    actions: ['examine', 'open'], requiredSequence: ['examine', 'open'], evidenceIds: ['scorched-ledger-fragment'],
  }),
  Object.freeze({
    id: 'study-wall-safe', roomId: 'study', name: 'Portrait Safe', minAct: 2,
    description: 'A four-digit dial hides behind Vivienne’s portrait. The guest book may supply the right time.',
    actions: ['examine', 'dial'], requiredSequence: ['examine', 'dial'], solution: '1918', evidenceIds: ['revised-codicil'],
  }),
  Object.freeze({
    id: 'study-cordial-tray', roomId: 'study', name: 'Silver Cordial Tray', minAct: 2,
    description: 'The glass, decanter, and sugar rim can be sampled separately.',
    actions: ['examine', 'swab'], requiredSequence: ['examine', 'swab'], evidenceIds: ['cordial-glass-residue'],
  }),
  Object.freeze({
    id: 'library-ledger-index', roomId: 'library', name: 'Trust Ledger Index', minAct: 2,
    description: 'Cross-references in the index connect account codes, dates, and authorization initials.',
    actions: ['examine', 'cross-reference'], requiredSequence: ['examine', 'cross-reference'], evidenceIds: ['bank-override-receipt'],
  }),
  Object.freeze({
    id: 'library-secret-drawer', roomId: 'library', name: 'Rolling-Ladder Compartment', minAct: 2,
    description: 'A brass catch beneath the rolling ladder looks newer than the wood around it.',
    actions: ['examine', 'slide'], requiredSequence: ['examine', 'slide'], evidenceIds: ['camera-maintenance-log'],
  }),
  Object.freeze({
    id: 'dining-place-cards', roomId: 'dining-room', name: 'Dinner Service Records', minAct: 1,
    description: 'Place cards, a service card, and the retained cordial sample do not quite agree.',
    actions: ['examine', 'compare'], requiredSequence: ['examine', 'compare'], evidenceIds: ['cordial-service-card'],
  }),
  Object.freeze({
    id: 'dining-medical-case', roomId: 'dining-room', name: 'Celeste’s Medical Case', minAct: 2,
    description: 'The case seal and dosage record can be checked without disturbing the contents.',
    actions: ['examine', 'verify-seal'], requiredSequence: ['examine', 'verify-seal'], evidenceIds: ['sealed-tonic-vial'],
  }),
  Object.freeze({
    id: 'conservatory-potting-bench', roomId: 'conservatory', name: 'Potting Bench', minAct: 3,
    description: 'Fresh cuttings, wax flakes, and a false-bottom tray demand a careful search.',
    actions: ['examine', 'lift-tray'], requiredSequence: ['examine', 'lift-tray'], evidenceIds: ['oleander-phial'],
  }),
  Object.freeze({
    id: 'conservatory-cutting-book', roomId: 'conservatory', name: 'Cutting Register', minAct: 3,
    description: 'One line in the botanical register has been scraped away.',
    actions: ['examine', 'shade-page'], requiredSequence: ['examine', 'shade-page'], evidenceIds: ['conservatory-cutting-log'],
  }),
  Object.freeze({
    id: 'wine-cellar-cane-rack', roomId: 'wine-cellar', name: 'Cellar Tool Alcove', minAct: 3,
    description: 'Metal dust glints inside a velvet-lined alcove used for canes, medical cases, and tasting tools.',
    actions: ['examine', 'collect-filings'], requiredSequence: ['examine', 'collect-filings'], evidenceIds: ['brass-key-filings'],
  }),
  Object.freeze({
    id: 'ballroom-phonograph', roomId: 'ballroom', name: 'Hidden Phonograph Disc', minAct: 4,
    description: 'A wax disc in the phonograph cabinet is labeled only with the time 20:21.',
    actions: ['examine', 'play'], requiredSequence: ['examine', 'play'], evidenceIds: ['corridor-audio-clip'],
  }),
  Object.freeze({
    id: 'chapel-kneeler', roomId: 'chapel-alcove', name: 'Hollow Kneeler', minAct: 4,
    description: 'The kneeler shifts under pressure, revealing a document pocket.',
    actions: ['examine', 'open-compartment'], requiredSequence: ['examine', 'open-compartment'], evidenceIds: ['original-adoption-certificate'],
  }),
]);

export function selectMystery({ randomInt = crypto.randomInt, sessionId, secret }) {
  const scenario = MYSTERY_SCENARIOS[randomInt(MYSTERY_SCENARIOS.length)];
  const nonce = crypto.randomBytes(24).toString('hex');
  const commitment = crypto
    .createHmac('sha256', secret)
    .update(`${sessionId}:${scenario.id}:${nonce}`)
    .digest('hex');
  return {
    ...structuredClone(scenario),
    selectedAt: new Date().toISOString(),
    nonce,
    commitment,
  };
}

export function actDefinition(index) {
  return ACTS[index - 1] ?? null;
}

export function actDurationSeconds(index, mode = 'standard') {
  const act = actDefinition(index);
  return act ? (mode === 'fast' ? act.fastSeconds : act.standardSeconds) : 0;
}

export function stageDurationSeconds(stage, mode = 'standard') {
  return POSTGAME_DURATIONS[mode === 'fast' ? 'fast' : 'standard'][stage] ?? 0;
}

export function publicInteraction(definition, progress = null) {
  const completed = Boolean(progress?.completedAt);
  const step = Math.min(progress?.sequence?.length ?? 0, definition.requiredSequence.length);
  return {
    id: definition.id,
    roomId: definition.roomId,
    name: definition.name,
    description: definition.description,
    minAct: definition.minAct,
    actions: completed ? [] : [definition.requiredSequence[step]],
    completed,
    step,
    totalSteps: definition.requiredSequence.length,
  };
}

export function getInteraction(id) {
  return MANSION_INTERACTIONS.find((item) => item.id === id) ?? null;
}

export function confessionalQuestion({ act, characterName, latestPublicEvent, hasManipulatedEvidence }) {
  const context = latestPublicEvent ? ` After ${latestPublicEvent.toLowerCase()},` : '';
  const questions = {
    1: `${characterName}, who entered this house wearing the most convincing mask—and what are you hiding from them?`,
    2: `${characterName}, Vivienne is dead. Who benefits most, and which part of your own alibi would you rather nobody test?`,
    3: `${characterName},${context} who do you think is lying, and what discovery changed your mind?`,
    4: `${characterName}, ${hasManipulatedEvidence ? 'you have moved through tonight’s evidence in ways others may question' : 'the family is turning on itself'}. Whom would you betray to protect your secret?`,
    5: `${characterName}, make your final private prediction: who killed Vivienne, and what is your biggest regret tonight?`,
  };
  return questions[act] ?? `${characterName}, what truth are you still refusing to say aloud?`;
}

export function ruleBasedNpcReply({ character, message, previousMemory = [], act = 1 }) {
  const lower = String(message).toLowerCase();
  const remembered = previousMemory.length
    ? ` I remember what you said earlier, and I have not decided whether it helps your case.`
    : '';
  if (/who|suspect|killer|murder/.test(lower)) {
    return `${character.name} lowers their voice. “In Act ${act}, certainty is a costume. Watch who benefits from the changed inheritance—and who keeps steering us toward an easier scandal.”${remembered}`;
  }
  if (/trust|alliance|help|together/.test(lower)) {
    return `${character.name} studies you carefully. “I will trade observations, not blind loyalty. Bring me something that can be checked, and we may have an alliance.”${remembered}`;
  }
  if (/evidence|clue|found|saw/.test(lower)) {
    return `${character.name} replies, “A clue without provenance is gossip wearing gloves. Tell me where it came from, and I will tell you whether it fits what I know.”${remembered}`;
  }
  return `${character.name} answers with a guarded smile. “Everyone at LaRose Estate wants something tonight. Ask yourself what they risk by telling you the truth.”${remembered}`;
}

export function npcConfessional({ character, act }) {
  const lines = {
    1: `I came prepared to observe the family, not to become part of its spectacle. The person smiling hardest worries me most.`,
    2: `Vivienne’s death made every old grievance look like motive. I am watching the people who knew the house well enough to stage a locked room.`,
    3: `Someone is curating what we discover. I trust corroborated records more than anyone’s performance—including my own.`,
    4: `An alliance is only a promise made before the next useful betrayal. I will expose anyone who tries to make me carry their lie.`,
    5: `My final vote follows the timeline, the poison, and the money. If I am wrong, it will not be because I ignored the receipts.`,
  };
  return `${character.name}: ${lines[act] ?? lines[3]}`;
}
