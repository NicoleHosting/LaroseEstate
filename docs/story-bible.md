# The LaRose Files: Blood Is Thicker Than Water

## Game-master story bible — spoilers

This document contains every possible murderer, method, private character secret, and final proof. It is a development reference. The live game is hostless, and neither Nicole nor the normal administrator view may read the selected solution before the reveal.

## Canon

- Victim: Madame Vivienne LaRose, matriarch and trustee.
- Sealed scenarios: the server selects `trust-audit` (Lucien), `physicians-reckoning` (Celeste), or `vintners-debt` (Dominic) independently for each session.
- Shared method: oleander concentrate is added to Vivienne's blackcurrant cordial, and a rough duplicate key creates the locked-room illusion.
- Scenario motive: the morning audit exposes trust theft, an unauthorized cardiac trial, or fraudulent vineyard loans.
- Cover-up: the selected culprit alters their 19:18 arrival to 19:48 and burns the ledger page tied to their scandal.
- Final proof: altered arrival establishes opportunity; scenario-specific audit and ledger records establish motive; glass and phial establish means; duplicate-key damage plus scenario-specific wax and filings identify the culprit.
- Nicole LaRose is never eligible to be the murderer.

No single discovery should solve the case. The intended solution requires at least one item from each of motive, opportunity, means, and identity.

## The fair-play chain

The table below shows the `trust-audit` wording. The other two scenarios use the same evidence graph with server-only overlays for the physician or vineyard trail. No client receives unused variants.

| Question | Early lead | Corroboration | Decisive proof |
| --- | --- | --- | --- |
| Why kill Vivienne? | `portrait-warning` | `sealed-audit-letter` | `scorched-ledger-fragment` + `revised-codicil` |
| Could Lucien be there? | `altered-arrival-record` | `doorman-time-note` or `porte-cochere-clock-slip` | `corridor-audio-clip` fixes the study-door window |
| What killed her? | `floral-oil-trace` | `conservatory-cutting-log` | `cordial-glass-residue` + `oleander-phial` |
| How was the room locked? | untouched `brass-study-key` | `duplicate-key-scratches` | `brass-key-filings` from Lucien's cane |
| Who handled the poison/key? | `black-seal-wax` | Lucien's starting `lucien-black-seal` | phial wax and lock wax match the same private seal compound |

The `portrait-warning` phrase “the sword hides behind the rose” points to Lucien's private emblem only after a player sees the wax. Before then it should read as atmosphere, not a direct accusation.

## Canonical timeline — `trust-audit`

`physicians-reckoning` and `vintners-debt` replace the named culprit, arrival artifact, audit target, ledger, duplicate-key provenance, and wax trail while preserving the 20:21–20:26 murder window.

| Time | Event | What players may prove |
| --- | --- | --- |
| 18:45 | Simone hides the emergency brass study key in *The Count of Monte Cristo* on Vivienne's order. | The bookplate is initialed and timed; the original key was not used for the murder. |
| 19:18 | Lucien arrives through the east entrance carrying his black walking cane. | Darius's clock slip and the guest-book impression agree. |
| 19:24 | Lucien changes 19:18 to 19:48 in the guest book. | New ink and pressure marks expose the change. |
| 19:36 | Lucien removes the prepared oleander phial from his cane. | Conservatory records and later cane evidence reconstruct preparation. |
| 20:08 | Vivienne announces that the inheritance and executorship will change. | All characters hear it; it creates many apparent motives. |
| 20:13 | Vivienne takes the codicil and audit letter to her study. | Beatrice can authenticate both documents. |
| 20:17 | Celeste gives Vivienne a prescribed hawthorn tonic in the hall. | Valentina and lab evidence eventually clear the tonic. |
| 20:21 | Lucien enters the study using the rough duplicate. | Lock scoring and Iris's audio fix the entry time. |
| 20:23 | During an argument, Lucien doses Vivienne's cordial. | Glass residue, phial residue, and wax establish the act. |
| 20:26 | Lucien locks the study and burns a ledger page in the hall brazier. | A scorched fragment survives. Iris records the lock click. |
| 20:34 | Vivienne collapses, knocking a silver tray to the floor. | The crash defines the latest possible death time. |
| 20:38 | Guests see Vivienne through the inset glass. The investigation begins in the foyer. | The study remains locked until a player finds the emergency key. |

Times are fixed canon. Character improvisation may fill gaps but must not move the murder outside 20:21–20:26.

## `trust-audit` red herrings and their resolutions

### The missing Widow's Ruby

The statue mount is empty, apparently suggesting a theft motive for Theo, Rafael, or Opal. Opal actually removed the stone with Vivienne's permission so it could be authenticated. The displayed stone was paste; the real jewel vanished years earlier. Resolve this with `vivienne-ruby-authorization` and `ruby-appraisal-card`. It is a family scandal, not part of the murder.

### Celeste's heart tonic

Celeste administered a hawthorn tonic minutes before the murder. Vivienne also had a concealed mild rhythm disorder, making a medical cover-up appear plausible. The sealed vial and prescription contain no oleander, and the poison level in the cordial cannot come from the tonic. Resolve with `hawthorn-prescription`, `sealed-tonic-vial`, and `cordial-glass-residue`.

### Dominic's threat

Dominic wrote that Vivienne would “regret cutting me out.” He meant a canceled vineyard-rescue contract, not the will. Celeste and Valentina provide his murder-window alibi, and the kitchen service card places contamination after the cordial left the kitchen.

### Genevieve and Marcus

They met secretly around the murder window to discuss an erased adoption and a possible inheritance claim. Their shared secret explains their evasiveness. The original adoption certificate and portrait registry resolve the issue without touching the murder chain.

Red herrings should cost time and provoke conversation, but each has a concrete exculpatory resolution. Do not leave an innocent character permanently dependent on “trust me.”

## Flexible cast, 5–20 humans plus NPC support

Character order in `src/content.js` is assignment order. The first five contain Nicole and all three possible culprits. Unclaimed roles can be filled by autonomous NPCs.

| Order | Character | Function in the mystery |
| ---: | --- | --- |
| 1 | Nicole LaRose | Creator-safe social observer; knows Lucien arrived early and recognizes Vivienne's forgery language. Nicole is always innocent. |
| 2 | Lucien LaRose | Possible trust-audit culprit; otherwise a major financial red herring. |
| 3 | Dr. Celeste LaRose | Possible clinical-trial culprit; otherwise medical interpretation and tonic red herring. |
| 4 | Dominic LaRose | Possible vineyard-loan culprit; otherwise debt/threat red herring. |
| 5 | Simone Baptiste | Key provenance and estate access. |
| 6 | Noelle LaRose | Trust-transfer investigation. |
| 7 | Theo Mercer | Jewel red herring and Nicole's alibi. |
| 8 | Camille Dupré | Cordial provenance and staff perspective. |
| 9 | Malcolm Graves | Bank corroboration for account L-7. |
| 10 | Beatrice Laurent | Audit letter and codicil authentication. |
| 11 | Rafael Saint-Clair | Resolves the fake ruby. |
| 12 | Genevieve LaRose | Adoption subplot and secret entrance. |
| 13 | Adrian Cross | Lock forensics and camera gap. |
| 14 | Opal LaRose | Resolves authorized ruby removal. |
| 15 | Julian Reed | Partial alibis and bank-regulation pressure. |
| 16 | Esme Baptiste | Oleander knowledge and conservatory access. |
| 17 | Valentina Cruz | Medical corroboration and Lucien's coercion. |
| 18 | Darius King | Independent 19:18 arrival proof. |
| 19 | Iris Monroe | Audio timing of the study door. |
| 20 | Marcus Reeve | Portrait compartment and adoption subplot. |

For small games, NPCs fill selected unclaimed roles and the server still exposes the complete physical evidence trail; no absent human is required for progression. Larger human groups gain more private insights and reasons to message, ally, and trade evidence.

## Character direction

All roles are suspects, but only the selected culprit receives a murderer overlay and instructions to lie about the murder. Innocent players may conceal personal secrets while treating physical evidence as fixed. The autonomous narrator rejects invented evidence, impossible timing, and accomplices.

The selected murderer may:

- deny the 19:18 arrival;
- dispute the audit or ledger interpretation;
- point toward unrelated financial, medical, vineyard, or jewel scandals;
- claim the identifying wax came from ordinary correspondence, prescriptions, or reserve bottles;
- share, withhold, or trade any evidence he legitimately owns.

The selected murderer may not:

- change the poison, victim, or murder time;
- claim the physical evidence is fabricated by the game master;
- destroy evidence already discovered by another player;
- invent an accomplice or a second killer;
- deny that the rose-and-sword seal is his once directly compared.

## Grand Foyer investigation

The foyer is a six-step investigation loop. Five objects yield clues; the sixth consumes the key and opens the next room.

| Hotspot ID | Public interaction | Base evidence | Selected private insight |
| --- | --- | --- | --- |
| `family-portrait` | Lift the loose frame latch. | `portrait-warning` | Nicole recognizes forgery language; Lucien realizes the emblem reference threatens him; Genevieve and Marcus see the registry subplot. |
| `guest-book` | Angle the page and reveal pressure marks. | `altered-arrival-record` | Dominic recognizes Lucien's pen; Noelle authenticates the technique; Darius gets `doorman-time-note`; Adrian connects the camera gap. |
| `rose-arrangement` | Rotate the vase collar and open the false base. | `sealed-audit-letter` | Simone knows it was a dead drop; Beatrice identifies the executor; Esme gets `floral-oil-trace`; Valentina recognizes the wax compound. |
| `marble-statue` | Inspect the empty mount and dust. | `missing-widows-ruby` | Theo/Rafael/Opal can resolve the theft story; Malcolm gets `statue-brass-dust`. |
| `books` | Follow the pressed-rose bookmark. | `brass-study-key` | Celeste reads the literary signal; Simone gets `monte-cristo-bookplate`; Camille clears the key chemically; Julian finds Lucien's prior loan. |
| `study-door` | Use the key, then inspect the lock. | `duplicate-key-scratches` | Adrian dates the damage; Valentina identifies wax; Iris matches her audio; Darius gets `black-seal-wax`; Lucien privately recognizes his mistake. |

The implementation merges the common discovery with only the assigned character's private insight. The full `discoveries` map must remain server-side.

### Expected foyer progression

1. The player investigates freely in `grand-foyer`.
2. Object discoveries are recorded once per player; repeat taps may replay text but must not duplicate evidence.
3. Evidence sharing copies a clue to another inventory and never removes the sender's copy.
4. `study-door` rejects a player who lacks `brass-study-key`.
5. A player with the key receives the lock discovery and personal access to `study`.
6. Room access and evidence remain server-authoritative across reconnects.

The five clue objects do not need to be solved in a fixed order. Only the door has a hard prerequisite.

## Mansion evidence plan

The mansion interactions implement the following evidence routes:

- Private Study: `cordial-glass-residue`, `scorched-ledger-fragment`, and `revised-codicil`.
- Conservatory: `oleander-phial` and a comparison against `conservatory-cutting-log`.
- Library: the full transfer chain behind `reporters-transfer-notes` and Malcolm's source trail.
- Ballroom: Nicole and Theo's terrace alibi plus Opal's witnesses.
- Dining Room: the announcement timeline and cordial-service handoff.
- Wine Cellar: Dominic's contract and the nonmatching beverage batch.
- Chapel Alcove: Genevieve and Marcus's adoption record, resolving their evasive alibi.

## Final accusation and reveal

Players vote for a character and may submit a written theory. A fully supported theory identifies:

1. the session's selected murderer;
2. the matching audit scandal as motive;
3. oleander in the cordial as method;
4. the duplicate key as the locked-room mechanism;
5. the altered guest book and burned ledger as cover-up.

The automatic reveal shows the vote tally, then walks through motive, opportunity, means, and identity. It is followed by a reunion receipt for every participant and log-derived Golden Rose awards.

## Information boundaries

- Public: names, titles, public biographies, room names, hotspot labels, and already discovered evidence.
- Private to an assigned player: dossier, secret, objectives, relationships, starting evidence, journal, messages, inventory, and character-specific hotspot text.
- Server only until reveal: selected scenario, murderer, motive, method, timeline, unused variants, and undiscovered evidence metadata. The normal administrator view is not an exception.
- Never use the client to decide whether a key unlocks a room, whether a clue was earned, or whether a final accusation is correct.
- A shared clue is a copy. Sharing never transfers ownership or deletes the source record.

## Continuity rules

- The murderer is selected once per session from Lucien, Celeste, or Dominic and never changes afterward.
- Hassan is not a character and must never be introduced as a substitute role.
- Vivienne is already dead when active investigation begins.
- Oleander is the only fatal poison. Celeste's hawthorn tonic is harmless.
- The original brass study key is hidden at 18:45 and remains unused until players find it.
- The Widow's Ruby subplot is unrelated to the murder.
- The selected culprit acts alone.
- Canonical IDs in `src/content.js` are stable persistence keys and should not be renamed after sessions have been created.
- `amara-vale` is a legacy persistence alias that resolves to `nicole-larose`; it is not offered as a separate public character.
- Nicole LaRose is the creator's participant role and must never be selected as the murderer.

