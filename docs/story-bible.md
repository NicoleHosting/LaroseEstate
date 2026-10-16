# The LaRose Files: Blood Is Thicker Than Water

## Game-master story bible — spoilers

This document contains the murderer, method, private character secrets, and final proof. It is for the game master and development team. Do not distribute it to players.

## Canon

- Victim: Madame Vivienne LaRose, matriarch and trustee.
- Murderer: Lucien LaRose (`lucien-larose`), Vivienne's eldest son, family solicitor, and presumed executor.
- Motive: Vivienne found that Lucien had diverted charitable-trust money through account L-7 to cover private debts. A new codicil removed him as executor, and an audit at 08:00 the next morning would expose him.
- Method: Lucien concentrated oleander from the conservatory, carried the phial and a rough duplicate key inside his hollow walking cane, entered the private study, and dosed Vivienne's blackcurrant cordial. The poison caused a fatal arrhythmia.
- Locked-room device: The untouched emergency key was hidden in a foyer book. Lucien used a duplicate cut from a missing impression kit and locked the door when he left. That duplicate left a rough second track in the lock.
- Cover-up: Lucien changed his guest-book time from 19:18 to 19:48 and tried to burn the trust ledger page connecting him to L-7.
- Final proof: The altered arrival impression establishes opportunity; the audit letter, ledger fragment, and codicil establish motive; the glass and phial establish oleander as the means; and the duplicate-key scoring, brass filings, and matching black rose-and-sword wax identify Lucien.

No single discovery should solve the case. The intended solution requires at least one item from each of motive, opportunity, means, and identity.

## The fair-play chain

| Question | Early lead | Corroboration | Decisive proof |
| --- | --- | --- | --- |
| Why kill Vivienne? | `portrait-warning` | `sealed-audit-letter` | `scorched-ledger-fragment` + `revised-codicil` |
| Could Lucien be there? | `altered-arrival-record` | `doorman-time-note` or `porte-cochere-clock-slip` | `corridor-audio-clip` fixes the study-door window |
| What killed her? | `floral-oil-trace` | `conservatory-cutting-log` | `cordial-glass-residue` + `oleander-phial` |
| How was the room locked? | untouched `brass-study-key` | `duplicate-key-scratches` | `brass-key-filings` from Lucien's cane |
| Who handled the poison/key? | `black-seal-wax` | Lucien's starting `lucien-black-seal` | phial wax and lock wax match the same private seal compound |

The `portrait-warning` phrase “the sword hides behind the rose” points to Lucien's private emblem only after a player sees the wax. Before then it should read as atmosphere, not a direct accusation.

## Canonical timeline

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

## Red herrings and their resolutions

### The missing Widow's Ruby

The statue mount is empty, apparently suggesting a theft motive for Theo, Rafael, or Opal. Opal actually removed the stone with Vivienne's permission so it could be authenticated. The displayed stone was paste; the real jewel vanished years earlier. Resolve this with `vivienne-ruby-authorization` and `ruby-appraisal-card`. It is a family scandal, not part of the murder.

### Celeste's heart tonic

Celeste administered a hawthorn tonic minutes before the murder. Vivienne also had a concealed mild rhythm disorder, making a medical cover-up appear plausible. The sealed vial and prescription contain no oleander, and the poison level in the cordial cannot come from the tonic. Resolve with `hawthorn-prescription`, `sealed-tonic-vial`, and `cordial-glass-residue`.

### Dominic's threat

Dominic wrote that Vivienne would “regret cutting me out.” He meant a canceled vineyard-rescue contract, not the will. Celeste and Valentina provide his murder-window alibi, and the kitchen service card places contamination after the cordial left the kitchen.

### Genevieve and Marcus

They met secretly around the murder window to discuss an erased adoption and a possible inheritance claim. Their shared secret explains their evasiveness. The original adoption certificate and portrait registry resolve the issue without touching the murder chain.

Red herrings should cost time and provoke conversation, but each has a concrete exculpatory resolution. Do not leave an innocent character permanently dependent on “trust me.”

## Flexible cast, 5–20 players

Character order in `src/content.js` is assignment order. The first five form the minimum viable cast and always include the murderer.

| Order | Character | Function in the mystery |
| ---: | --- | --- |
| 1 | Amara Vale | Social observer; knows Lucien arrived early and recognizes Vivienne's forgery language. |
| 2 | Lucien LaRose | Predetermined murderer. |
| 3 | Dr. Celeste LaRose | Medical interpretation and tonic red herring. |
| 4 | Dominic LaRose | Debt/threat red herring and family conflict. |
| 5 | Simone Baptiste | Key provenance and estate access. |
| 6 | Noelle LaRose | Trust-transfer investigation. |
| 7 | Theo Mercer | Jewel red herring and Amara's alibi. |
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

For small games, the server still exposes the complete physical evidence trail; absent-role knowledge cannot be required for progression. For larger games, private insights make the same objects socially valuable and create reasons to message, ally, and trade copies of evidence.

## Character direction

All roles are suspects, but only Lucien is instructed to lie about the murder. Innocent players may conceal their personal secrets while answering direct questions about physical evidence truthfully. The game master should intervene if a player invents new evidence, changes a fixed time, claims an impossible alibi, or declares another player an accomplice.

Lucien may:

- deny the 19:18 arrival;
- argue that “current executor” is ambiguous;
- point toward Celeste's tonic, Dominic's threat, or the missing jewel;
- claim the black wax came from ordinary correspondence;
- share, withhold, or trade any evidence he legitimately owns.

Lucien may not:

- change the poison, victim, or murder time;
- claim the physical evidence is fabricated by the game master;
- destroy evidence already discovered by another player;
- invent an accomplice or a second killer;
- deny that the rose-and-sword seal is his once directly compared.

## Grand Foyer vertical slice

The foyer is a six-step investigation loop. Five objects yield clues; the sixth consumes the key and opens the next room.

| Hotspot ID | Public interaction | Base evidence | Selected private insight |
| --- | --- | --- | --- |
| `family-portrait` | Lift the loose frame latch. | `portrait-warning` | Amara recognizes forgery language; Lucien realizes the emblem reference threatens him; Genevieve and Marcus see the registry subplot. |
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

## Later-room evidence plan

The first milestone implements the foyer completely. The following evidence is canon even if its room interaction is not yet built:

- Private Study: `cordial-glass-residue`, `scorched-ledger-fragment`, and `revised-codicil`.
- Conservatory: `oleander-phial` and a comparison against `conservatory-cutting-log`.
- Library: the full transfer chain behind `reporters-transfer-notes` and Malcolm's source trail.
- Ballroom: Amara and Theo's terrace alibi plus Opal's witnesses.
- Dining Room: the announcement timeline and cordial-service handoff.
- Wine Cellar: Dominic's contract and the nonmatching beverage batch.
- Chapel Alcove: Genevieve and Marcus's adoption record, resolving their evasive alibi.

## Final accusation and reveal

Players vote for a character and may submit a written theory. A fully supported theory identifies:

1. Lucien as murderer;
2. trust theft and the morning audit as motive;
3. oleander in the cordial as method;
4. the duplicate key as the locked-room mechanism;
5. the altered guest book and burned ledger as cover-up.

The host reveal should first show the vote tally, then walk through motive, opportunity, means, and identity in that order. Resolve each red herring before the final confession so innocent players understand why their secrets mattered without making them killers.

## Information boundaries

- Public: names, titles, public biographies, room names, hotspot labels, and already discovered evidence.
- Private to an assigned player: dossier, secret, objectives, relationships, starting evidence, journal, messages, inventory, and character-specific hotspot text.
- Host only until reveal: `STORY.murdererId`, solution text, all secrets, all role discoveries, and undiscovered evidence metadata.
- Never use the client to decide whether a key unlocks a room, whether a clue was earned, or whether a final accusation is correct.
- A shared clue is a copy. Sharing never transfers ownership or deletes the source record.

## Continuity rules

- The murderer is always Lucien; there is no randomized-killer mode in this story.
- Hassan is not a character and must never be introduced as a substitute role.
- Vivienne is already dead when active investigation begins.
- Oleander is the only fatal poison. Celeste's hawthorn tonic is harmless.
- The original brass study key is hidden at 18:45 and remains unused until players find it.
- The Widow's Ruby subplot is unrelated to the murder.
- Lucien acts alone.
- Canonical IDs in `src/content.js` are stable persistence keys and should not be renamed after sessions have been created.

