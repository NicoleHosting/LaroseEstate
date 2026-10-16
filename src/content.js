/**
 * Canonical game content for The LaRose Files.
 *
 * This module is intentionally server-side. Character secrets, private hotspot
 * discoveries, and the solution must be filtered by the server before a client
 * receives them.
 */

export const GAME = Object.freeze({
  id: "the-larose-files",
  title: "The LaRose Files",
  subtitle: "Blood Is Thicker Than Water",
  minPlayers: 5,
  maxPlayers: 20,
  openingRoomId: "grand-foyer",
  openingPhase: "investigation",
  publicPremise:
    "Madame Vivienne LaRose has announced a change to the family inheritance. Minutes later, she is found dead behind the locked door of her private study. Every guest has a reason to fear what she planned to reveal.",
  phases: ["lobby", "arrival", "announcement", "investigation", "accusation", "reveal"],
});

export const STORY = Object.freeze({
  title: "The LaRose Files",
  subtitle: "Blood Is Thicker Than Water",
  victim: {
    id: "vivienne-larose",
    name: "Madame Vivienne LaRose",
    title: "Matriarch of the LaRose family",
  },
  murdererId: "lucien-larose",
  causeOfDeath:
    "Fatal cardiac arrhythmia caused by oleander concentrate mixed into Vivienne's blackcurrant cordial.",
  motive:
    "Vivienne discovered that Lucien had diverted money from the LaRose charitable trust to cover his private debts. Her new codicil removed him as executor, and an audit scheduled for the next morning would have exposed him.",
  method:
    "Lucien prepared an oleander concentrate, entered the study with an imperfect duplicate key, dosed Vivienne's cordial, and later altered the arrival book to support a false alibi.",
  finalSolution:
    "Lucien LaRose killed Vivienne. The audit letter and burned ledger establish motive; the corrected guest-book impression defeats his alibi; oleander residue establishes the method; and the duplicate-key scoring, brass filings, and unique black rose-and-sword sealing wax connect Lucien to the locked study and the poisoned vial.",
  solutionText:
    "Lucien LaRose killed Vivienne to stop the morning audit from exposing his theft from the family trust. He poisoned her cordial with oleander, used an imperfect duplicate key to stage the locked room, altered his arrival time, and tried to burn the account trail.",
  fairPlayTrail: Object.freeze({
    motive: ["sealed-audit-letter", "scorched-ledger-fragment", "revised-codicil"],
    opportunity: ["altered-arrival-record", "doorman-time-note"],
    means: ["cordial-glass-residue", "oleander-phial"],
    identity: ["duplicate-key-scratches", "brass-key-filings", "black-seal-wax"],
  }),
  timeline: Object.freeze([
    {
      time: "18:45",
      event: "At Vivienne's request, Simone hides the emergency brass study key inside The Count of Monte Cristo in the foyer bookcase.",
      kind: "setup",
    },
    {
      time: "19:18",
      event: "Lucien arrives through the east entrance, seen by Darius and recorded by the pressure clock in the porte-cochere.",
      kind: "fact",
    },
    {
      time: "19:24",
      event: "Lucien changes his guest-book time from 19:18 to 19:48, pressing the original figures into the sheet beneath.",
      kind: "cover-up",
    },
    {
      time: "19:36",
      event: "Lucien removes a prepared oleander phial from his hollow walking cane. Esme notices the conservatory specimen was cut earlier that afternoon.",
      kind: "preparation",
    },
    {
      time: "20:08",
      event: "Vivienne announces that the inheritance and executorship will change. She promises to name the person responsible after dessert.",
      kind: "public",
    },
    {
      time: "20:13",
      event: "Vivienne retires to the study with the revised codicil and the trust audit letter.",
      kind: "fact",
    },
    {
      time: "20:17",
      event: "Celeste gives Vivienne her prescribed, harmless hawthorn tonic in the hall, creating an apparent medical red herring.",
      kind: "red-herring",
    },
    {
      time: "20:21",
      event: "Lucien enters the study with a rough duplicate key. The duplicate leaves parallel scoring in the lock.",
      kind: "murder",
    },
    {
      time: "20:23",
      event: "While arguing about the audit, Lucien pours oleander concentrate into Vivienne's cordial and reseals the phial with his black rose-and-sword wax.",
      kind: "murder",
    },
    {
      time: "20:26",
      event: "Lucien leaves, locks the study, and burns one ledger page in the hall brazier. A fragment survives in the grate.",
      kind: "cover-up",
    },
    {
      time: "20:34",
      event: "Vivienne collapses, knocking a silver tray to the floor. Guests hear the crash but the study door remains locked.",
      kind: "discovery",
    },
    {
      time: "20:38",
      event: "The household sees Vivienne through the study's inset glass and begins the investigation in the Grand Foyer.",
      kind: "discovery",
    },
  ]),
});

export const CHARACTERS = Object.freeze([
  {
    id: "amara-vale",
    name: "Amara Vale",
    title: "The Socialite",
    pronouns: "she/her",
    tier: "core",
    alignment: "innocent",
    publicBio:
      "Vivienne's magnetic grand-niece, a society fixture who can turn a rumor into currency before the champagne goes flat.",
    dossier:
      "You were raised close enough to the LaRose name to enjoy its doors, but never close enough to inherit its protection. Vivienne recently questioned your loyalty after learning that somebody leaked a family photograph to the press.",
    secret:
      "You sold an innocuous photograph to pay a blackmailer, then lied about it. You also saw Lucien near the east entrance much earlier than the time in the guest book.",
    alibi:
      "From 20:15 until the crash, you were on the ballroom terrace in a private argument with Theo. Neither of you wants to admit it.",
    objectives: [
      "Discover why Vivienne questioned your loyalty.",
      "Find out who saw you in the private hallway.",
      "Protect your arrangement with Theo without hiding evidence of murder.",
    ],
    relationships: {
      "lucien-larose": "He treats you as decorative and therefore harmless; use that mistake.",
      "theo-mercer": "Your secret former lover and current source in the art world.",
      "noelle-larose": "A cousin and friend whose journalism makes you nervous.",
    },
    knowledge: ["Lucien was inside the estate before 19:30.", "Vivienne used the phrase 'ink denies' when discussing forged signatures."],
    startingEvidenceIds: [],
  },
  {
    id: "lucien-larose",
    name: "Lucien LaRose",
    title: "The Heir Apparent",
    pronouns: "he/him",
    tier: "core",
    alignment: "murderer",
    publicBio:
      "Vivienne's immaculate eldest son, family solicitor, and long-presumed executor of the LaRose trust.",
    dossier:
      "You built your identity around inheriting control of the family. Tonight Vivienne planned to strip that control away, expose your theft, and turn you over to the authorities.",
    secret:
      "You murdered Vivienne with oleander concentrate. You arrived at 19:18, altered the guest book, entered the study using a duplicate key, and burned part of the trust ledger. The black rose-and-sword seal on your private stationery matches wax on the poison phial.",
    alibi:
      "Your public claim is that you arrived at 19:48 and remained in the dining room until the crash. The guest-book impression and several witnesses can disprove this.",
    objectives: [
      "Keep the trust audit and revised codicil from being connected to you.",
      "Encourage scrutiny of Celeste's tonic and the missing Widow's Ruby.",
      "Learn who can place you inside the estate before 19:48.",
    ],
    relationships: {
      "celeste-larose": "Your sister knows enough medicine to make a convenient suspect.",
      "malcolm-graves": "The banker who covered one transfer and now fears exposure.",
      "beatrice-laurent": "Vivienne's secretary saw the audit letter before it was sealed.",
    },
    knowledge: [
      "The spare key is in the foyer books, but you used your duplicate.",
      "The ledger fragment, key scoring, sealing wax, and altered arrival record can form a complete case against you.",
    ],
    startingEvidenceIds: ["lucien-black-seal"],
  },
  {
    id: "celeste-larose",
    name: "Dr. Celeste LaRose",
    title: "The Physician",
    pronouns: "she/her",
    tier: "core",
    alignment: "innocent",
    publicBio:
      "Vivienne's exacting daughter, a celebrated cardiologist who had managed her mother's health for years.",
    dossier:
      "You gave Vivienne her prescribed hawthorn tonic shortly before her death. You know the symptoms do not fit that medicine, but admitting the treatment makes you look dangerously convenient.",
    secret:
      "You concealed a mild rhythm disorder from the family at Vivienne's request. Your unsigned clinical notes could be twisted into evidence of malpractice.",
    alibi:
      "After giving the tonic at 20:17, you joined Dominic and Valentina in the dining room. Valentina can confirm you never returned to the study corridor.",
    objectives: [
      "Establish the true cause of death without exposing all of Vivienne's medical history.",
      "Find and secure your unsigned clinical notes.",
      "Determine who had access to toxic estate plants.",
    ],
    relationships: {
      "lucien-larose": "Your brother resents that Vivienne trusted your judgment over his.",
      "valentina-cruz": "A trusted nurse who knows the tonic was harmless.",
      "dominic-larose": "Your younger brother; reckless, but honest when cornered.",
    },
    knowledge: ["Oleander can mimic a sudden cardiac event.", "Vivienne's prescribed tonic was sealed and correctly dosed."],
    startingEvidenceIds: ["hawthorn-prescription"],
  },
  {
    id: "dominic-larose",
    name: "Dominic LaRose",
    title: "The Vintner",
    pronouns: "he/him",
    tier: "core",
    alignment: "innocent",
    publicBio:
      "Vivienne's younger son, a gifted vintner whose charm has not saved the family vineyard from debt.",
    dossier:
      "Vivienne canceled your vineyard rescue and you sent an furious note saying she would regret cutting you out. It referred to the contract, not her will, but the distinction will be hard to sell.",
    secret:
      "You borrowed against a wine reserve you did not own. Lucien knew and offered to erase the debt if you signed a trust proxy.",
    alibi:
      "Celeste and Valentina saw you in the dining room from 20:18 onward, though you were alone in the cellar just before the announcement.",
    objectives: [
      "Recover or explain your threatening note.",
      "Expose Lucien's attempt to buy your trust proxy.",
      "Keep the unauthorized wine loan from destroying your employees' livelihoods.",
    ],
    relationships: {
      "celeste-larose": "Your sister and most reliable alibi.",
      "lucien-larose": "Your brother offered help with terms that felt like a trap.",
      "camille-dupre": "An old friend who knows the cellar better than anyone.",
    },
    knowledge: ["Trust transfers labeled L-7 were not vineyard payments.", "The family cordial was poured after dinner, not in the cellar."],
    startingEvidenceIds: ["dominic-threat-note"],
  },
  {
    id: "simone-baptiste",
    name: "Simone Baptiste",
    title: "The Estate Keeper",
    pronouns: "she/her",
    tier: "core",
    alignment: "innocent",
    publicBio:
      "Vivienne's goddaughter and unflappable estate manager, keeper of every key, schedule, and household confidence.",
    dossier:
      "Vivienne instructed you to hide the emergency study key in a foyer book and tell nobody. If the key is found, everyone may assume you enabled the locked-room murder.",
    secret:
      "You let Genevieve into the estate through the service entrance despite Vivienne's ban. You also misplaced the master-key impression kit three weeks ago.",
    alibi:
      "You supervised dessert with Camille from 20:14 to 20:30, then went to the study corridor after hearing the crash.",
    objectives: [
      "Guide investigators to the emergency key when the moment is safe.",
      "Account for the missing key-impression kit.",
      "Protect the household staff from being used as easy suspects.",
    ],
    relationships: {
      "genevieve-larose": "You secretly admitted her to the estate.",
      "camille-dupre": "Your closest friend and strongest alibi.",
      "adrian-cross": "His security audit documented the missing impression kit.",
    },
    knowledge: ["The brass key in the books is the unused emergency key.", "A duplicate key can leave a second, rougher track in the study lock."],
    startingEvidenceIds: [],
  },
  {
    id: "noelle-larose",
    name: "Noelle LaRose",
    title: "The Journalist",
    pronouns: "she/her",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "Vivienne's granddaughter, an investigative journalist who refuses to let family loyalty edit the truth.",
    dossier: "You came to dinner carrying notes for an unpublished investigation into the LaRose charitable trust.",
    secret: "Your anonymous source is Malcolm, and you promised to protect him even if the trust scandal became criminal.",
    alibi: "You recorded a voice memo alone in the library from 20:19 to 20:27; its timestamp supports you but exposes your investigation.",
    objectives: ["Prove whether trust funds were diverted.", "Protect your source until corroborating evidence exists.", "Publish the truth without sacrificing an innocent person."],
    relationships: {
      "malcolm-graves": "Your frightened source inside the family bank.",
      "amara-vale": "A cousin and friend who sometimes treats facts as accessories.",
      "lucien-larose": "Your uncle threatened legal action over your questions.",
    },
    knowledge: ["Account code L-7 appears in multiple unexplained transfers."],
    startingEvidenceIds: ["reporters-transfer-notes"],
  },
  {
    id: "theo-mercer",
    name: "Theo Mercer",
    title: "The Art Dealer",
    pronouns: "he/him",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "A polished dealer retained to catalogue the estate collection before the will changed hands.",
    dossier: "The missing Widow's Ruby makes you look like the obvious thief, especially because you recently arranged a discreet appraisal.",
    secret: "You and Amara were once lovers. Tonight she asked you to trace the blackmailer holding her photograph.",
    alibi: "You were arguing with Amara on the ballroom terrace during the murder, but confirming it exposes both of you.",
    objectives: ["Locate the Widow's Ruby or prove its authorized removal.", "Protect Amara's confidence.", "Identify who requested the secret appraisal."],
    relationships: {
      "amara-vale": "Your former lover and current confidante.",
      "rafael-saint-clair": "A professional rival who can verify your appraisal records.",
      "opal-larose": "She commissioned the appraisal under an alias." ,
    },
    knowledge: ["The Widow's Ruby was removed from its mount without force."],
    startingEvidenceIds: ["ruby-appraisal-card"],
  },
  {
    id: "camille-dupre",
    name: "Camille Dupré",
    title: "The Chef",
    pronouns: "they/them",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "The estate's celebrated chef, as protective of the household as they are exacting about the dinner service.",
    dossier: "You prepared Vivienne's cordial base but did not pour the glass found in the study.",
    secret: "You have been quietly diverting unused estate food to a neighborhood shelter against Vivienne's written policy.",
    alibi: "Simone and three servers place you in the dessert kitchen from 20:14 through 20:31.",
    objectives: ["Show that the study cordial was altered after leaving your kitchen.", "Keep the shelter program alive.", "Defend the staff from collective blame."],
    relationships: {
      "simone-baptiste": "Your closest friend and mutual alibi.",
      "dominic-larose": "A longtime friend who supplies the estate wine.",
      "valentina-cruz": "She knows Vivienne requested a nonalcoholic cordial tonight." ,
    },
    knowledge: ["Oleander was never stored or used in the kitchen.", "The study glass has the wrong sugar rim for your service."],
    startingEvidenceIds: ["cordial-service-card"],
  },
  {
    id: "malcolm-graves",
    name: "Malcolm Graves",
    title: "The Banker",
    pronouns: "he/him",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "The discreet private banker who has managed LaRose accounts for two generations.",
    dossier: "You approved one suspicious transfer after Lucien threatened to expose your own compliance failure.",
    secret: "You are Noelle's anonymous source. The transfer authorization carries Lucien's credentials, but your override helped it clear.",
    alibi: "You were on a recorded bank call in the conservatory from 20:20 to 20:29.",
    objectives: ["Get the transfer evidence to Noelle without revealing yourself too soon.", "Find proof Lucien coerced the override.", "Keep your compliance failure from eclipsing the murder."],
    relationships: {
      "noelle-larose": "The reporter you chose as your confidential outlet.",
      "lucien-larose": "He coerced you into clearing transfer L-7.",
      "julian-reed": "He once handled a regulatory inquiry for the bank." ,
    },
    knowledge: ["L-7 funds went to a shell company controlled by Lucien."],
    startingEvidenceIds: ["bank-override-receipt"],
  },
  {
    id: "beatrice-laurent",
    name: "Beatrice Laurent",
    title: "The Secretary",
    pronouns: "she/her",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "Vivienne's formidable personal secretary and the only person trusted to type the new codicil.",
    dossier: "You prepared the sealed audit letter hidden in the roses and know exactly whom it threatens.",
    secret: "You copied the codicil before sealing it because Vivienne feared it would disappear. Keeping that unauthorized copy could cost your career.",
    alibi: "You were checking place cards with Julian in the dining room from 20:16 to 20:25, then alone at the copier.",
    objectives: ["Recover the sealed audit letter.", "Preserve the codicil copy until it can be authenticated.", "Determine who searched your desk."],
    relationships: {
      "lucien-larose": "He demanded to know whether the new codicil named him.",
      "julian-reed": "He can provide a partial alibi.",
      "iris-monroe": "She has been pressuring you for access to Vivienne's papers." ,
    },
    knowledge: ["The phrase 'executor L' in the audit letter means Lucien, not a ledger category."],
    startingEvidenceIds: ["codicil-carbon-copy"],
  },
  {
    id: "rafael-saint-clair",
    name: "Rafael Saint-Clair",
    title: "The Auctioneer",
    pronouns: "he/him",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "A charismatic auctioneer who knows the provenance—and gossip—behind every object at LaRose Estate.",
    dossier: "You authenticated the Widow's Ruby last week and discovered the famous jewel had been replaced with paste years ago.",
    secret: "Vivienne paid you to keep the substitution quiet until she identified the family member responsible.",
    alibi: "Iris interviewed you in the library from 20:18 until 20:30; her recorder captured the mantel clock throughout.",
    objectives: ["Explain the missing jewel without exposing the old substitution prematurely.", "Work out who sold the original ruby.", "Protect your professional reputation."],
    relationships: {
      "theo-mercer": "A rival dealer whose paperwork is irritatingly clean.",
      "opal-larose": "She knows why the display mount is empty.",
      "iris-monroe": "Her recording is your alibi and her leverage." ,
    },
    knowledge: ["The empty mount is a red herring; its clasp was opened with the correct tool."],
    startingEvidenceIds: [],
  },
  {
    id: "genevieve-larose",
    name: "Genevieve LaRose",
    title: "The Exile",
    pronouns: "she/her",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "Vivienne's estranged younger sister, invited by nobody and welcomed by even fewer.",
    dossier: "You slipped in through the service entrance to confront Vivienne about a thirty-year-old family lie.",
    secret: "Vivienne, not you, arranged the adoption that removed Marcus's mother from the family record. You came carrying the original certificate.",
    alibi: "You were with Marcus in the chapel alcove from 20:16 to 20:28, though admitting it reveals his parentage.",
    objectives: ["Tell Marcus the truth on your terms.", "Recover the altered family registry.", "Avoid being blamed simply because you entered secretly."],
    relationships: {
      "simone-baptiste": "She risked her position to let you inside.",
      "marcus-reeve": "Your grand-nephew, though he does not yet know it.",
      "vivienne-larose": "Your late sister buried the truth you came to restore." ,
    },
    knowledge: ["The portrait backing contains an older family registry page."],
    startingEvidenceIds: ["original-adoption-certificate"],
  },
  {
    id: "adrian-cross",
    name: "Adrian Cross",
    title: "The Security Consultant",
    pronouns: "he/him",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "A former detective hired after a string of unexplained entries into the estate's private rooms.",
    dossier: "Your security audit failed to prevent the murder, and one page about the missing key-impression kit has vanished.",
    secret: "You disabled the east camera for eight minutes at Vivienne's request so she could meet a confidential investigator. Lucien exploited the gap.",
    alibi: "You were restarting the camera server in the security room from 20:19 to 20:28; the system log confirms it.",
    objectives: ["Reconstruct access to the study.", "Find the missing audit page.", "Explain the camera outage before someone weaponizes it."],
    relationships: {
      "simone-baptiste": "Her key control is meticulous, which makes the missing kit troubling.",
      "darius-king": "He reported Lucien's early arrival to you.",
      "iris-monroe": "Her questions routinely cross the line into interference." ,
    },
    knowledge: ["The study lock shows fresh scoring from an imperfect duplicate key."],
    startingEvidenceIds: ["camera-maintenance-log"],
  },
  {
    id: "opal-larose",
    name: "Opal LaRose",
    title: "The Philanthropist",
    pronouns: "she/her",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "Vivienne's widowed sister-in-law, patron of the arts and guardian of the family's polished public image.",
    dossier: "You removed the Widow's Ruby from the marble statue before dinner, with Vivienne's verbal permission, to have it authenticated.",
    secret: "The displayed ruby was paste. You feared your late husband sold the original decades ago and wanted proof before a scandal erupted.",
    alibi: "You were in the ballroom with Julian and several early dancers from 20:14 through the crash.",
    objectives: ["Recover the appraisal packet that proves Vivienne authorized the removal.", "Learn what happened to the original ruby.", "Prevent the jewel scandal from distracting from the killing."],
    relationships: {
      "rafael-saint-clair": "The auctioneer who confirmed the stone was paste.",
      "theo-mercer": "The dealer who arranged the discreet appraisal.",
      "julian-reed": "A dependable witness to your alibi." ,
    },
    knowledge: ["The missing jewel has nothing to do with Vivienne's death."],
    startingEvidenceIds: ["vivienne-ruby-authorization"],
  },
  {
    id: "julian-reed",
    name: "Julian Reed",
    title: "The Fixer",
    pronouns: "he/him",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "A political strategist engaged to Noelle and frequently retained to make LaRose problems disappear.",
    dossier: "Vivienne ordered you to end your engagement after discovering you buried a regulatory story for the family bank.",
    secret: "You suppressed a lawful but embarrassing inquiry at Malcolm's request. It is unethical, but unrelated to tonight's murder.",
    alibi: "You checked place cards with Beatrice until 20:25, then joined Opal in the ballroom.",
    objectives: ["Keep the old regulatory fix from destroying your future with Noelle.", "Corroborate Beatrice's movements.", "Find out why Vivienne opposed your marriage."],
    relationships: {
      "noelle-larose": "Your fiancée, who values truth above your instinct to contain it.",
      "malcolm-graves": "A former client whose favor compromised you.",
      "beatrice-laurent": "You can corroborate one another's partial alibis." ,
    },
    knowledge: ["Malcolm feared Lucien, not Vivienne, during the bank inquiry."],
    startingEvidenceIds: [],
  },
  {
    id: "esme-baptiste",
    name: "Esme Baptiste",
    title: "The Botanist",
    pronouns: "she/her",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "Simone's younger sister, a botanist responsible for the estate's famous—and occasionally dangerous—conservatory.",
    dossier: "A toxic oleander specimen was cut with your pruning knife, and you failed to log the missing stem.",
    secret: "You noticed the cut that afternoon but stayed quiet because you feared losing a prestigious fellowship over lax controls.",
    alibi: "Darius drove you back from the greenhouse at 20:12; from 20:15 onward you arranged roses in view of the foyer staff.",
    objectives: ["Identify who entered the conservatory tool room.", "Prove the oleander was processed outside your workspace.", "Own your logging failure before someone else reveals it."],
    relationships: {
      "simone-baptiste": "Your older sister, whose career you do not want to endanger.",
      "darius-king": "He can establish when you left the greenhouse.",
      "camille-dupre": "They understand exactly which plants never belong near food." ,
    },
    knowledge: ["Fresh oleander sap leaves a bitter green resin; the roses were harmless."],
    startingEvidenceIds: ["conservatory-cutting-log"],
  },
  {
    id: "valentina-cruz",
    name: "Valentina Cruz",
    title: "The Nurse",
    pronouns: "she/her",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "Vivienne's private nurse, observant enough to notice every changed dose and every practiced lie.",
    dossier: "You know Celeste's tonic was harmless, but you secretly changed one of Vivienne's prescriptions last month under verbal instruction.",
    secret: "The unrecorded change was medically sound but violated clinic policy. Lucien knew and used it to pressure you for Vivienne's schedule.",
    alibi: "You were with Celeste and Dominic in the dining room from 20:18 until the crash.",
    objectives: ["Clear Celeste's tonic with medical facts.", "Recover the original medication chart.", "Reveal Lucien's pressure without sacrificing patient privacy."],
    relationships: {
      "celeste-larose": "A trusted colleague whose reputation is at risk.",
      "dominic-larose": "Part of your mutual alibi.",
      "lucien-larose": "He tried to turn a policy violation into leverage." ,
    },
    knowledge: ["Vivienne's collapse was too rapid and severe for her ordinary heart condition."],
    startingEvidenceIds: ["sealed-tonic-vial"],
  },
  {
    id: "darius-king",
    name: "Darius King",
    title: "The Chauffeur",
    pronouns: "he/him",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "The estate's head chauffeur, a quiet observer of arrivals whose discretion is mistaken for invisibility.",
    dossier: "You saw Lucien arrive at 19:18, thirty minutes earlier than his guest-book entry, but accepted money to keep quiet about another guest's secret arrival.",
    secret: "Genevieve paid you to use the service drive. The payment was for discretion, not violence.",
    alibi: "Vehicle telemetry places you in the garage from 20:17 to 20:29, on a hands-free call with Esme at first.",
    objectives: ["Preserve proof of Lucien's true arrival time.", "Explain Genevieve's payment before it looks like a murder payoff.", "Find who removed one page from the vehicle log."],
    relationships: {
      "adrian-cross": "You reported Lucien's early arrival to him.",
      "genevieve-larose": "She paid for a discreet entrance.",
      "esme-baptiste": "Your call and driving record support both alibis." ,
    },
    knowledge: ["Lucien carried his black walking cane when he arrived, but not when he entered dinner."],
    startingEvidenceIds: ["porte-cochere-clock-slip"],
  },
  {
    id: "iris-monroe",
    name: "Iris Monroe",
    title: "The Chronicler",
    pronouns: "she/her",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "A true-crime documentarian invited to record the family legacy, to Vivienne's later regret.",
    dossier: "Your hidden recorder captured more than your interview with Rafael, including footsteps in the study corridor.",
    secret: "You planted a microphone in the library without consent. The recording can establish timing, but using it may expose you to charges.",
    alibi: "Your continuous interview recording places you with Rafael from 20:18 through 20:30.",
    objectives: ["Authenticate the corridor sounds on your recording.", "Protect your raw material without suppressing exculpatory evidence.", "Learn why Vivienne abruptly withdrew permission to film."],
    relationships: {
      "rafael-saint-clair": "Your interview subject and mutual alibi.",
      "beatrice-laurent": "She repeatedly denied you access to the archive.",
      "adrian-cross": "He suspects you planted unauthorized equipment." ,
    },
    knowledge: ["The study door opened at 20:21 and locked again at 20:26."],
    startingEvidenceIds: ["corridor-audio-clip"],
  },
  {
    id: "marcus-reeve",
    name: "Marcus Reeve",
    title: "The Outsider",
    pronouns: "he/him",
    tier: "expanded",
    alignment: "innocent",
    publicBio: "The estate architect's protégé, invited to discuss renovations and treated by Vivienne with puzzling familiarity.",
    dossier: "You came seeking proof that your mother belonged to the LaRose family and met Genevieve in secret before the murder.",
    secret: "Your mother was erased from the family register after an adoption. Revealing that truth may give you a claim on the estate.",
    alibi: "Genevieve was with you in the chapel alcove from 20:16 to 20:28, but neither of you can explain why without exposing the adoption.",
    objectives: ["Recover the original family registry.", "Decide whether to reveal your possible inheritance claim.", "Keep your search for identity separate from the murder."],
    relationships: {
      "genevieve-larose": "She carries the first proof of your family connection.",
      "simone-baptiste": "She noticed you measuring the portrait wall.",
      "noelle-larose": "Her archival research may prove your claim." ,
    },
    knowledge: ["The family portrait has been rehung over an older wall compartment."],
    startingEvidenceIds: [],
  },
]);

export const ROOMS = Object.freeze([
  {
    id: "grand-foyer",
    name: "Grand Foyer",
    description: "A black-marble hall of candlelight, red roses, and watchful ancestral portraits.",
    initiallyUnlocked: true,
    milestone: 1,
  },
  {
    id: "study",
    name: "Private Study",
    description: "Vivienne's locked sanctuary, now preserved as the central crime scene.",
    initiallyUnlocked: false,
    milestone: 2,
  },
  {
    id: "dining-room",
    name: "Dining Room",
    description: "A candlelit banquet room where Vivienne made her final announcement.",
    initiallyUnlocked: false,
    milestone: 2,
  },
  {
    id: "library",
    name: "Library",
    description: "Two stories of family papers, first editions, and carefully edited history.",
    initiallyUnlocked: false,
    milestone: 2,
  },
  {
    id: "ballroom",
    name: "Ballroom",
    description: "A mirrored salon with a moonlit terrace and too many places to overhear a secret.",
    initiallyUnlocked: false,
    milestone: 3,
  },
  {
    id: "conservatory",
    name: "Conservatory",
    description: "An ornate glasshouse filled with roses, rare orchids, and dangerous oleander.",
    initiallyUnlocked: false,
    milestone: 3,
  },
  {
    id: "chapel-alcove",
    name: "Chapel Alcove",
    description: "A private family chapel where old vows and older records survive.",
    initiallyUnlocked: false,
    milestone: 4,
  },
  {
    id: "wine-cellar",
    name: "Wine Cellar",
    description: "Stone vaults beneath the estate, lined with vintages and hidden accounts.",
    initiallyUnlocked: false,
    milestone: 4,
  },
]);

export const EVIDENCE = Object.freeze([
  {
    id: "portrait-warning",
    title: "Vivienne's Hidden Warning",
    shortDescription: "A coded note hidden behind the family portrait.",
    description:
      "Written in Vivienne's hand: 'Blood remembers what ink denies. Begin with the ledger, not the will. The sword hides behind the rose.'",
    roomId: "grand-foyer",
    sourceHotspotId: "family-portrait",
    category: "document",
    tags: ["motive", "cipher", "executor"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "altered-arrival-record",
    title: "Altered Arrival Record",
    shortDescription: "Pressure marks reveal that Lucien's arrival time was changed.",
    description:
      "The entry now reads 19:48, but angled light exposes an original 19:18 beneath it. The correction ink is newer than every other entry on the page.",
    roomId: "grand-foyer",
    sourceHotspotId: "guest-book",
    category: "document",
    tags: ["opportunity", "alibi", "lucien"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "doorman-time-note",
    title: "Doorman's Time Note",
    shortDescription: "A torn timing slip corroborates an early arrival.",
    description: "A pressure-clock slip reads 'L. LaRose — east entrance — 19:18' in Darius's shorthand.",
    roomId: "grand-foyer",
    sourceHotspotId: "guest-book",
    category: "record",
    tags: ["opportunity", "corroboration", "lucien"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "sealed-audit-letter",
    title: "Sealed Trust Audit Letter",
    shortDescription: "A letter hidden beneath the rose arrangement warns of criminal transfers.",
    description:
      "Vivienne's attorney confirms an 08:00 audit of account L-7 and acknowledges her instruction to remove 'the current executor' immediately.",
    roomId: "grand-foyer",
    sourceHotspotId: "rose-arrangement",
    category: "document",
    tags: ["motive", "trust", "audit"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "floral-oil-trace",
    title: "Bitter Green Smear",
    shortDescription: "A non-rose plant resin marks the letter's outer envelope.",
    description:
      "A faint bitter green smear contains oleander resin. It does not prove the letter and poison traveled together, but it links the foyer cache to the conservatory plants.",
    roomId: "grand-foyer",
    sourceHotspotId: "rose-arrangement",
    category: "trace",
    tags: ["means", "oleander", "botany"],
    points: 1,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "missing-widows-ruby",
    title: "Missing Widow's Ruby",
    shortDescription: "The ceremonial jewel is absent from the statue's display mount.",
    description:
      "The velvet mount is empty, but its clasp was opened cleanly. It suggests a theft motive until Opal's authorization and the appraisal records explain its removal.",
    roomId: "grand-foyer",
    sourceHotspotId: "marble-statue",
    category: "object",
    tags: ["jewelry", "theft", "opal", "theo"],
    points: 1,
    isKey: false,
    redHerring: true,
    resolutionEvidenceIds: ["vivienne-ruby-authorization", "ruby-appraisal-card"],
    availabilityRound: 1,
  },
  {
    id: "statue-brass-dust",
    title: "Brass Dust on the Plinth",
    shortDescription: "Fresh brass dust lies beneath an unrelated jewelry display.",
    description:
      "Fine brass filings cling to the black velvet. Their spiral shape is consistent with recent key cutting, not jewelry repair.",
    roomId: "grand-foyer",
    sourceHotspotId: "marble-statue",
    category: "trace",
    tags: ["identity", "duplicate-key", "misdirection"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "brass-study-key",
    title: "Brass Study Key",
    shortDescription: "Vivienne's emergency study key, hidden inside a hollowed novel.",
    description:
      "A heavy original key stamped V.L. It opens the private study. Its undamaged teeth show that it was not the rough key used during the murder.",
    roomId: "grand-foyer",
    sourceHotspotId: "books",
    category: "key",
    tags: ["access", "study", "progression"],
    points: 1,
    isKey: true,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "monte-cristo-bookplate",
    title: "Monte Cristo Bookplate",
    shortDescription: "A dated note proves the emergency key was hidden before the murder.",
    description: "Simone's initials and the time 18:45 appear beneath Vivienne's bookplate, documenting when the spare was cached.",
    roomId: "grand-foyer",
    sourceHotspotId: "books",
    category: "record",
    tags: ["access", "simone", "exculpatory"],
    points: 1,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "duplicate-key-scratches",
    title: "Duplicate-Key Scratches",
    shortDescription: "Fresh parallel scratches score the study lock.",
    description:
      "A rough duplicate entered the lock shortly before the original brass key. Black wax is lodged beside the newest scoring.",
    roomId: "grand-foyer",
    sourceHotspotId: "study-door",
    category: "trace",
    tags: ["identity", "locked-room", "duplicate-key"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "black-seal-wax",
    title: "Black Rose-and-Sword Wax",
    shortDescription: "A wax flake bears part of Lucien's private emblem.",
    description:
      "The lock holds black sealing wax impressed with the tip of a sword beneath a rose. The same custom compound seals Lucien's private legal correspondence.",
    roomId: "grand-foyer",
    sourceHotspotId: "study-door",
    category: "trace",
    tags: ["identity", "lucien", "seal"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "hawthorn-prescription",
    title: "Hawthorn Prescription",
    shortDescription: "Celeste's signed prescription shows Vivienne's safe dose.",
    description: "The prescribed tonic is nonlethal at the recorded dose and does not account for oleander residue.",
    roomId: "study",
    category: "medical",
    tags: ["celeste", "exculpatory", "tonic"],
    points: 1,
    isKey: false,
    redHerring: true,
    resolutionEvidenceIds: ["sealed-tonic-vial", "cordial-glass-residue"],
    availabilityRound: 1,
  },
  {
    id: "lucien-black-seal",
    title: "Lucien's Seal Ring",
    shortDescription: "A private rose-and-sword seal carried by Lucien.",
    description: "The custom matrix and black compound can be compared with wax recovered from the crime scene.",
    category: "object",
    tags: ["identity", "lucien", "private"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "dominic-threat-note",
    title: "Dominic's Threatening Note",
    shortDescription: "An angry note says Vivienne will regret cutting Dominic out.",
    description: "The line concerns a canceled vineyard contract, not the inheritance, though it initially suggests motive.",
    category: "document",
    tags: ["dominic", "threat", "vineyard"],
    points: 1,
    isKey: false,
    redHerring: true,
    resolutionEvidenceIds: ["cordial-service-card"],
    availabilityRound: 1,
  },
  {
    id: "cordial-glass-residue",
    title: "Poisoned Cordial Residue",
    shortDescription: "Oleander compounds remain in Vivienne's study glass.",
    description: "The residue establishes poisoning and shows the toxin was added after the cordial left the kitchen.",
    roomId: "study",
    category: "forensic",
    tags: ["means", "oleander", "cause-of-death"],
    points: 4,
    isKey: false,
    redHerring: false,
    availabilityRound: 2,
  },
  {
    id: "oleander-phial",
    title: "Wax-Sealed Oleander Phial",
    shortDescription: "A narrow poison phial sealed with black wax.",
    description: "Residue matches the study glass; the black seal compound matches Lucien's private correspondence.",
    roomId: "conservatory",
    category: "forensic",
    tags: ["means", "oleander", "lucien", "seal"],
    points: 4,
    isKey: false,
    redHerring: false,
    availabilityRound: 3,
  },
  {
    id: "scorched-ledger-fragment",
    title: "Scorched Trust Ledger Fragment",
    shortDescription: "A surviving fragment records transfers to account L-7.",
    description: "The fragment carries Lucien's authorization code and matches the amounts in Malcolm's override receipt.",
    roomId: "study",
    category: "document",
    tags: ["motive", "trust", "lucien"],
    points: 4,
    isKey: false,
    redHerring: false,
    availabilityRound: 2,
  },
  {
    id: "revised-codicil",
    title: "Revised LaRose Codicil",
    shortDescription: "Vivienne removes Lucien as executor and orders a forensic audit.",
    description: "Signed that afternoon and witnessed, the codicil gave Lucien both financial and reputational motive to stop Vivienne before morning.",
    roomId: "study",
    category: "document",
    tags: ["motive", "inheritance", "lucien"],
    points: 4,
    isKey: false,
    redHerring: false,
    availabilityRound: 2,
  },
  {
    id: "brass-key-filings",
    title: "Brass Filings from Lucien's Cane",
    shortDescription: "Metal dust inside Lucien's hollow cane matches the study lock alloy.",
    description: "The filings and a waxed key blank show where Lucien concealed the duplicate and poison phial.",
    roomId: "study",
    category: "forensic",
    tags: ["identity", "duplicate-key", "lucien"],
    points: 4,
    isKey: false,
    redHerring: false,
    availabilityRound: 3,
  },
  {
    id: "vivienne-ruby-authorization",
    title: "Ruby Removal Authorization",
    shortDescription: "Vivienne authorized Opal to remove the Widow's Ruby.",
    description: "The signed card clears the missing jewel as an unrelated family scandal rather than a murder motive.",
    category: "document",
    tags: ["opal", "jewelry", "exculpatory"],
    points: 1,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "ruby-appraisal-card",
    title: "Ruby Appraisal Card",
    shortDescription: "Theo's records show the display stone was removed for an authorized appraisal.",
    description: "The clasp and timestamps support Opal's account and reveal that the stone was paste.",
    category: "record",
    tags: ["theo", "opal", "jewelry", "exculpatory"],
    points: 1,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "reporters-transfer-notes",
    title: "Noelle's Transfer Notes",
    shortDescription: "A reporter's notes connect repeated L-7 transfers.",
    description: "The dates align with Lucien's private debt payments, but the notes need bank corroboration.",
    category: "document",
    tags: ["motive", "noelle", "trust"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "cordial-service-card",
    title: "Cordial Service Card",
    shortDescription: "The kitchen record proves Vivienne's glass left unpoisoned.",
    description: "Camille's batch card and retained sample contain no oleander, placing contamination after service.",
    category: "record",
    tags: ["means", "camille", "exculpatory"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "bank-override-receipt",
    title: "Bank Override Receipt",
    shortDescription: "A transfer override traces L-7 to Lucien's shell company.",
    description: "Malcolm's override and Lucien's authorization token appear on the same transaction.",
    category: "record",
    tags: ["motive", "malcolm", "lucien"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "codicil-carbon-copy",
    title: "Codicil Carbon Copy",
    shortDescription: "Beatrice's unauthorized copy preserves Vivienne's final instructions.",
    description: "It corroborates the signed codicil and records Vivienne's order to audit Lucien's executorship.",
    category: "document",
    tags: ["motive", "beatrice", "inheritance"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "original-adoption-certificate",
    title: "Original Adoption Certificate",
    shortDescription: "A sealed certificate explains Genevieve and Marcus's secret meeting.",
    description: "It proves their concealment concerned family identity, not the murder.",
    category: "document",
    tags: ["genevieve", "marcus", "exculpatory"],
    points: 1,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "camera-maintenance-log",
    title: "Camera Maintenance Log",
    shortDescription: "A documented outage explains the missing east-hall footage.",
    description: "The outage was authorized by Vivienne, but its timing created Lucien's access window.",
    category: "record",
    tags: ["opportunity", "adrian", "camera"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "conservatory-cutting-log",
    title: "Incomplete Cutting Log",
    shortDescription: "Esme's log shows an unrecorded oleander cutting.",
    description: "The missing stem establishes access to the poison but not who took it.",
    category: "record",
    tags: ["means", "esme", "oleander"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "sealed-tonic-vial",
    title: "Sealed Hawthorn Tonic Vial",
    shortDescription: "The intact seal and correct dose clear Celeste's treatment.",
    description: "Testing finds no oleander and confirms the tonic did not kill Vivienne.",
    category: "medical",
    tags: ["celeste", "valentina", "exculpatory"],
    points: 2,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "porte-cochere-clock-slip",
    title: "Porte-Cochere Clock Slip",
    shortDescription: "The vehicle clock records Lucien at the estate at 19:18.",
    description: "Darius's retained slip independently confirms the impression beneath the altered guest-book entry.",
    category: "record",
    tags: ["opportunity", "darius", "lucien"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
  {
    id: "corridor-audio-clip",
    title: "Corridor Audio Clip",
    shortDescription: "A hidden recorder captures the study door at 20:21 and 20:26.",
    description: "The two lock sounds frame the murder window, while Lucien's cane tip is faintly audible between them.",
    category: "audio",
    tags: ["opportunity", "iris", "timeline"],
    points: 3,
    isKey: false,
    redHerring: false,
    availabilityRound: 1,
  },
]);

const discovery = (narrative, evidenceIds = [], journalPrompt = "") => ({
  narrative,
  evidenceIds,
  journalPrompt,
});

export const HOTSPOTS = Object.freeze([
  {
    id: "family-portrait",
    roomId: "grand-foyer",
    name: "Family Portrait",
    description: "A monumental portrait in a carved gilt frame. One lower corner sits slightly proud of the wall.",
    interaction: "Lift the loose frame latch and inspect the backing.",
    grantsEvidenceId: "portrait-warning",
    repeatable: false,
    discoveries: {
      default: discovery(
        "Behind the portrait is a folded warning in Vivienne's hand: 'Blood remembers what ink denies. Begin with the ledger, not the will. The sword hides behind the rose.'",
        ["portrait-warning"],
        "What could 'the sword behind the rose' identify?"
      ),
      "amara-vale": discovery("You recognize 'ink denies' as Vivienne's phrase for forged signatures. She used it after studying Lucien's paperwork."),
      "lucien-larose": discovery("You recognize the warning as the message you failed to find earlier. Its reference to your rose-and-sword seal is dangerously precise."),
      "genevieve-larose": discovery("The backing paper is cut from the old family registry—the same version that once listed Marcus's mother."),
      "marcus-reeve": discovery("Architect's pencil marks show a shallow compartment continues behind the frame; the murder note is not the only thing hidden here."),
    },
  },
  {
    id: "guest-book",
    roomId: "grand-foyer",
    name: "Guest Book",
    description: "A leather-bound arrival book lies open beside a silver pen and a discarded clock slip.",
    interaction: "Tilt the page under candlelight and rub the sheet beneath with graphite.",
    grantsEvidenceId: "altered-arrival-record",
    repeatable: false,
    discoveries: {
      default: discovery(
        "Lucien's entry reads 19:48, but the page beneath holds a sharp 19:18 impression. The later figures use ink that had not fully dried.",
        ["altered-arrival-record"],
        "Who can independently place Lucien at the estate at 19:18?"
      ),
      "dominic-larose": discovery("The silver pen is the one Lucien borrowed before dinner. Its nib makes the same split downstroke as the altered 4."),
      "noelle-larose": discovery("Your reporting notes use the same pressure-impression technique. The 19:18 entry is unambiguous and publishable if corroborated."),
      "darius-king": discovery(
        "The shorthand on the discarded slip is yours: 'L. LaRose — east entrance — 19:18.' You kept the matching pressure-clock copy.",
        ["doorman-time-note"]
      ),
      "adrian-cross": discovery("The changed arrival falls exactly inside the east-camera outage documented in your maintenance log."),
    },
  },
  {
    id: "rose-arrangement",
    roomId: "grand-foyer",
    name: "Red Rose Arrangement",
    description: "A towering arrangement of crimson roses surrounds a sealed cream envelope.",
    interaction: "Rotate the brass vase collar and release the false base.",
    grantsEvidenceId: "sealed-audit-letter",
    repeatable: false,
    discoveries: {
      default: discovery(
        "Inside the false base is an attorney's letter confirming an 08:00 audit of account L-7 and Vivienne's order to remove the current executor.",
        ["sealed-audit-letter"],
        "Which current executor stood to lose control before morning?"
      ),
      "simone-baptiste": discovery("Vivienne ordered this exact arrangement moved from her study at 18:50. She was using it as a dead drop, not decoration."),
      "beatrice-laurent": discovery("You typed the instruction quoted in the letter. 'Current executor' can only mean Lucien."),
      "esme-baptiste": discovery(
        "The roses are harmless, but a bitter green smear on the envelope is fresh oleander resin.",
        ["floral-oil-trace"]
      ),
      "valentina-cruz": discovery("The envelope's black wax smells faintly of clove and lampblack—the same custom compound used on Lucien's private correspondence."),
    },
  },
  {
    id: "marble-statue",
    roomId: "grand-foyer",
    name: "Marble Statue",
    description: "The founder's marble likeness stands above an empty velvet jewelry mount.",
    interaction: "Inspect the open clasp, velvet nap, and dust caught beneath the plinth.",
    grantsEvidenceId: "missing-widows-ruby",
    repeatable: false,
    discoveries: {
      default: discovery(
        "The Widow's Ruby is missing. The clasp is clean and undamaged, suggesting authorized tools rather than a hurried theft.",
        ["missing-widows-ruby"],
        "Was the jewel stolen, or was its absence meant to distract you?"
      ),
      "theo-mercer": discovery("The clasp bears your appraisal chalk. You can prove the mount was opened before tonight and with Vivienne's consent."),
      "rafael-saint-clair": discovery("The empty setting held a paste duplicate. The real Widow's Ruby disappeared years ago, making this a family scandal but a poor murder motive."),
      "opal-larose": discovery("You removed the stone with Vivienne's permission. A signed authorization in your possession can resolve this red herring."),
      "malcolm-graves": discovery(
        "Beneath the velvet is curled brass swarf like debris from cutting a key. It resembles waste found in safety-deposit key machines.",
        ["statue-brass-dust"]
      ),
    },
  },
  {
    id: "books",
    roomId: "grand-foyer",
    name: "Foyer Books",
    description: "A low case holds leather-bound classics. The Count of Monte Cristo feels heavier than it should.",
    interaction: "Follow the pressed-rose bookmark and open the hollowed pages.",
    grantsEvidenceId: "brass-study-key",
    repeatable: false,
    discoveries: {
      default: discovery(
        "A hollowed novel contains Vivienne's brass emergency key to the private study.",
        ["brass-study-key"],
        "If this original key was hidden here, how did the killer enter and relock the study?"
      ),
      "celeste-larose": discovery("Vivienne chose this novel whenever she wanted to signal escape, revenge, or hidden identity. The hiding place was intentional."),
      "simone-baptiste": discovery(
        "Your initials and 18:45 notation remain beneath the bookplate, proving you hid the key before the murder and that it has not been used.",
        ["monte-cristo-bookplate"]
      ),
      "camille-dupre": discovery("A faint bitter odor on the shelf comes from the nearby flowers, not the key or book; the key itself is chemically clean."),
      "julian-reed": discovery("The book's borrowing card shows Lucien checked it out three weeks ago—the same week the key-impression kit vanished."),
    },
  },
  {
    id: "study-door",
    roomId: "grand-foyer",
    name: "Locked Study Door",
    description: "A black-lacquered door seals the crime scene. Fresh scratches glint inside its brass lock.",
    interaction: "Use the brass study key, then inspect the lock before opening the door.",
    requiredEvidenceId: "brass-study-key",
    grantsEvidenceId: "duplicate-key-scratches",
    unlocksRoomId: "study",
    repeatable: false,
    discoveries: {
      default: discovery(
        "The original key opens the study. Before the door swings inward, you see a second rough track inside the lock: a duplicate key was used recently.",
        ["duplicate-key-scratches"],
        "Who had time, tools, and knowledge to duplicate a study key?"
      ),
      "lucien-larose": discovery("You recognize the scoring made by your imperfect copy. Black wax from the key's temporary grip is still lodged in the lock."),
      "adrian-cross": discovery("The upper track is less than an hour old and could not have been made by the undamaged emergency key."),
      "valentina-cruz": discovery("The wax smells faintly of clove and lampblack, the same custom compound on Lucien's private letters."),
      "iris-monroe": discovery("The lock's double click matches the sounds at 20:21 and 20:26 on your corridor recording."),
      "darius-king": discovery(
        "A wax flake in the lock preserves the point of a sword beneath a rose. You saw that emblem on Lucien's cane case when he arrived.",
        ["black-seal-wax"]
      ),
    },
  },
]);

const byId = (items, id) => items.find((item) => item.id === id) ?? null;

export function getCharacter(characterId) {
  return byId(CHARACTERS, characterId);
}

export function getRoom(roomId) {
  return byId(ROOMS, roomId);
}

export function getHotspot(hotspotId) {
  return byId(HOTSPOTS, hotspotId);
}

export function getEvidence(evidenceId) {
  return byId(EVIDENCE, evidenceId);
}

/**
 * Return only the discovery that belongs to one assigned character, merged with
 * the common observation. Never send the raw `discoveries` map to players.
 */
export function getDiscoveryForRole(hotspotId, characterId) {
  const hotspot = getHotspot(hotspotId);
  if (!hotspot) return null;

  const common = hotspot.discoveries.default;
  const personal = hotspot.discoveries[characterId];
  const evidenceIds = [...new Set([...(common.evidenceIds ?? []), ...(personal?.evidenceIds ?? [])])];

  return {
    hotspotId,
    characterId,
    title: hotspot.name,
    narrative: personal ? `${common.narrative}\n\n${personal.narrative}` : common.narrative,
    evidenceIds,
    journalPrompt: personal?.journalPrompt || common.journalPrompt || "",
    isRoleSpecific: Boolean(personal),
  };
}

/**
 * Character ordering is deliberate: every legal player count contains the
 * murderer and all five-player games receive the complete core cast.
 */
export function selectRoster(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < GAME.minPlayers || playerCount > GAME.maxPlayers) {
    throw new RangeError(`Player count must be an integer from ${GAME.minPlayers} to ${GAME.maxPlayers}.`);
  }
  return CHARACTERS.slice(0, playerCount);
}

export function getPublicCharacter(character) {
  const { id, name, title, pronouns, tier, publicBio } = character;
  return { id, name, title, pronouns, tier, publicBio };
}

export function getPublicEvidence(evidence) {
  if (!evidence) return null;
  const {
    id,
    title,
    shortDescription,
    description,
    roomId = null,
    category,
    tags,
    points,
    isKey,
    redHerring,
  } = evidence;
  return { id, title, shortDescription, description, roomId, category, tags, points, isKey, redHerring };
}

