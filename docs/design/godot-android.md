# Design: Godot rewrite and Google Play (Android)

Status: **research and plan, nothing decided yet**. Owner goal (2026-11-10): rewrite the game in the
Godot engine, publish it on Google Play, and let players sign in with their Google account (a player
id) for saves and later a leaderboard.

All facts were checked on **2026-11-10 and 2026-11-11** on the linked pages. Links look like
`[S3]`. The full list with dates is in [Sources](#sources). Anything I could not confirm is in
[Not verified](#not-verified). Fees, policies, target API levels and versions change, so check the
linked page again before acting on a number.

---

## 0. Summary

1. **Engine:** Godot **4.7.2** is the newest stable release (18 Aug 2026). 4.8 is in beta [S1].
   Use **GDScript**, not C#. C# on Android is still marked experimental, and C# can't export to the
   web [S6].
2. **Port:** rewrite the pure logic (`src/game/`, the save code) in GDScript by hand. Generate
   **golden numbers** from the TypeScript game and test the Godot code against them. Art, palette,
   font and the music track carry over as files.
3. **Order:** build the **simulator and do the balance work in TypeScript first**, then port. The
   TS game is the reference, and balance numbers shouldn't have to be ported twice.
4. **Play Console:** $25 one-time fee and an ID check [P1]. A new **personal** account must run a
   **closed test with at least 12 testers opted in for 14 days in a row** before it can publish
   [P3].
5. **Target API:** new apps and updates must target **Android 16 (API 36)** since 31 Aug 2026
   [P4]. Godot 4.7.2's default target is already 36 [S8].
6. **Sign-in:** use **Play Games Services v2 (PGS)**. Sign-in is automatic at launch, with no
   password and no button needed [G2]. It gives a per-game player id, **Saved Games** (cloud save,
   up to 3 MB) and **leaderboards** for free, with no own server [G4] [G7] [G8].
7. **Plugin:** `godot-sdk-integrations/godot-play-game-services` is the maintained one (v3.4.0,
   20 Jul 2026). A project collaborator couldn't reproduce a reported 4.6 problem on Godot 4.6.3. **Godot 4.7 is not confirmed**, so
   the first PGS task is a small test on a phone [S15] [S16].
8. **Firebase:** only needed if one leaderboard must cover web **and** Android players, or if we
   want our own server checks. Start with PGS.
9. **Anti-cheat:** the game runs on the player's phone, so any score can be faked. PGS tamper
   protection and Firebase rules only catch obvious nonsense [G8] [F5].
10. **Time:** about **12–16 small PRs** of work, plus at least **3 weeks of calendar time** for
    the closed test and the production review.

---

## 1. How Android games on Google Play work (plain words)

- You pay Google once ($25) for a **developer account** in **Play Console** (Google's website for
  publishing apps) and prove who you are [P1].
- Your game is an **app**. It has a permanent id, the **package name** (for example
  `io.github.ohwelleu.afkgame`). If you change it after publishing, Google Play treats it as a new
  app [P22].
- You upload an **Android App Bundle (`.aab`)**, a file Godot builds for you. Google turns it into
  the install files for each phone [P6].
- Each upload has a **`versionCode`**, a whole number that must be higher than every number used
  before [P9].
- Uploads go to a **track**: internal test → closed test → open test → production (everyone)
  [P8]. Testers join with their Google account.
- Before the first release you fill in some forms: the **store listing** (text and images),
  **content rating**, **Data safety**, a **privacy policy** link, **ads yes/no** and **target age**
  [P17].
- Google **reviews** each release. It is usually a few days, and up to 7 days or longer in
  exceptional cases [P10].
- **Play Games Services** is Google's free game layer. When the game starts, the player is signed
  in with their Play Games profile, and the game gets a player id, cloud saves, leaderboards and
  achievements.

---

## 2. Godot basics for this project

### Version

| What                | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| Newest stable       | **4.7.2**, 18 Aug 2026 [S1] [S2]                                  |
| Next                | 4.8 beta3, 9 Nov 2026 (not stable) [S1]                          |
| Docs on `/stable/`  | 4.7 [S3]                                                          |
| Android min / target SDK in 4.7.2 | min **24**, target **36**, compile 36 [S8]            |
| Licence             | MIT, free, no royalties [S24]                                    |

Start on 4.7.x and stay on one minor version until launch. Move to 4.8 only after it is stable
**and** the PGS plugin works with it.

### GDScript or C#

- **GDScript (recommended).** It is Godot's own language and works on every export target. It has
  optional types (`var hp: int`), so typed TS code ports almost line by line.
- **C#:** Android export works, but the docs call it **experimental**. Android export needs
  **.NET 9 or later**. A C# project **can't be exported to the web** [S6]. C# would give us nothing
  we need and adds a .NET toolchain.

### Numbers: TS vs GDScript

- GDScript `int` is a **signed 64-bit** integer. It **wraps around** on overflow [S11]. `float` is
  a 64-bit double, the same as a JS `number` [S11].
- Our `safeInt` (`src/game/balance.ts`) clamps at `Number.MAX_SAFE_INTEGER` (2^53 − 1). The port
  must keep that **same clamp**, or huge late-game numbers will differ (or wrap around to negative).
- The RNG (`src/game/rng.ts`, mulberry32) relies on 32-bit math (`Math.imul`, `>>> 0`). In GDScript
  every step must be masked with `& 0xFFFFFFFF`. Golden tests on the first 1,000 numbers of a few
  seeds prove it matches.
- `base * growth ** (L - 1)` followed by `ceil` can differ in the last bit between JS and C++
  `pow`. That would make a mob HP off by 1. The golden tests catch it. If it happens, round the
  same way on both sides (for example `ceil(v - 1e-9)`) and fix it in TS too.

### Pixel-art settings

From the multiple-resolutions page [S9] and the class reference [S11]:

| Setting                                                    | Value                         |
| ---------------------------------------------------------- | ----------------------------- |
| Rendering method                                           | **Compatibility** [S10]       |
| `rendering/textures/canvas_textures/default_texture_filter` | **Nearest** (no smoothing)   |
| `display/window/stretch/mode`                              | **viewport**                  |
| `display/window/stretch/aspect`                            | **expand** (or keep)          |
| `display/window/stretch/scale_mode`                        | **integer** (since 4.2) [S9]  |
| `rendering/2d/snap/snap_2d_transforms_to_pixel`            | on (off by default) [S11]     |

- Compatibility is the renderer Godot recommends for 2D. It is also the only one for web export, so
  one renderer covers both [S10] [S12].
- `integer` scale mode rounds the scale down to a whole number. The docs call it "useful to prevent
  distortion when displaying pixel art" [S9]. This is the same rule as today: whole-number scale,
  never fractions.
- **Proposal:** draw the duel scene in a small pixel viewport (for example 180×320 art pixels in
  portrait, scaled ×4 to ×6 on phones). Draw the menus with normal `Control` nodes at screen
  resolution with the pixel font at whole-number sizes. That way the text stays readable and
  doesn't get huge pixels.
- Phones have notches and rounded corners. `DisplayServer.get_display_safe_area()` gives the free
  area, so the HUD stays inside it [S23].

### Android export: what you need

From the Android export page [S3], the Gradle build page [S4] and the Godot 4.7.2 source [S8]:

1. **OpenJDK 17** (the docs recommend 17; newer versions are supported).
2. **Android SDK** from Google's command-line tools. On Linux, don't use the SDK from the
   distribution's package manager [S3]. The docs list: `platform-tools`, `build-tools;35.0.1`,
   `platforms;android-35`, `cmdline-tools;latest`, `cmake;3.10.2.4988404`, `ndk;28.1.13356709`
   [S3]. The 4.7.2 template compiles against **36** with build-tools 36.1.0 [S8], so install
   `platforms;android-36` and `build-tools;36.1.0` too (see [Not verified](#not-verified)).
3. In Godot: **Editor Settings → Export → Android**: Java SDK path and Android SDK path [S3].
4. **Export templates** for the exact Godot version (Editor → Manage Export Templates).
5. **Gradle build**: Project → Install Android Build Template, then enable **Use Gradle Build** in
   the Android preset. This is required to export an **AAB** for Google Play and to use any
   Android plugin [S4] [S5].
6. **Keystores:**
   - a **debug** keystore for test installs (Godot can use the one Android tools create);
   - an **upload key** for Play:
     `keytool -v -genkey -keystore afk-upload.keystore -alias afk -keyalg RSA -validity 10000`
     [S3]. Keep it **out of git** (in a password manager plus a backup). If it is lost, Google can
     reset the upload key, but that takes a request [P7].
7. Export options to set: `gradle_build/export_format` = AAB, `version/code`, `version/name`,
   `gradle_build/min_sdk`, `gradle_build/target_sdk` [S7]. Leave the target empty to use the
   default (36).

### Plugins (Google Play services)

- Godot 4.2+ uses **Android plugin v2**: an Android library (AAR) wrapped in a Godot
  `EditorExportPlugin`. v1 plugins are deprecated. Plugins require the Gradle build [S5].

| Plugin                                                                     | Status (checked 2026-11-11)                                                                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **godot-sdk-integrations/godot-play-game-services** (recommended)          | Hosted by the Godot Foundation's org. Latest **v3.4.0** (20 Jul 2026). Built against Godot **4.5.1**, uses `play-services-games-v2:21.0.0`, README says "Godot 4.3+". Has sign-in, leaderboards, achievements, snapshots (Saved Games), events, players [S15]. A project collaborator couldn't reproduce a reported 4.6 problem on **4.6.3** (May 2026) [S16]. One open issue says snapshot calls hang in one project but work in a fresh one [S16]. |
| StudioAdriatic/PGSGP                                                       | Alternative, v3.2.1 (3 Jun 2026), smaller [S18].                                                                                                                                       |
| **godot-sdk-integrations/godot-google-play-billing** (only for in-app purchases) | First-party plugin in the docs, "compatible with Godot 4.2+" [S14]. v3.3.0 (27 Jul 2026) moved to Play Billing Library 9.1.0 [S17].                                               |

The PGS plugin no longer signs in by itself: the game calls `initialize()` and then checks
`is_authenticated` [S15]. Users report that the plugin's nodes must sit in the scene tree, or the
signals never fire [S16].

---

## 3. What we can reuse from the TypeScript game

### What is valuable

| Part                                                     | Size today       | Carries over as                                     |
| -------------------------------------------------------- | ---------------- | --------------------------------------------------- |
| `src/game/` (balance, state machine, items, ascend, quest, rng, format) | ~1,900 lines | **Port to GDScript**, line by line             |
| `src/game/*.test.ts`                                      | ~2,300 lines     | The **test cases** port; golden numbers come from TS |
| `src/save*.ts` (format `AFK1.<base64url(JSON)>.<checksum>`, migrations 1→9) | ~750 lines | **Same format** in GDScript, so web saves load on Android |
| Docs (`PLAN.md`, design docs, `COLORS.md`)               | –                | Unchanged, they describe the game, not the code     |
| `src/render/`, `src/ui/`, DOM, Shadow DOM, CSS            | –                | **Rewrite** as Godot scenes and `Control` nodes      |

### Options

| Option                                                         | What it means                                                                                                                                                            | Good                                                                 | Bad                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **(a) Godot rewrite, logic ported by hand, golden tests** (recommended) | A Node script in this repo runs the TS logic and writes JSON fixtures (mob HP per stage, costs, a 10-minute seeded sim run, save strings). Godot tests (GUT or gdUnit4) must match them exactly. | A real native game, which is the owner's goal. Plugins for PGS work. The TS game guards against drift. | Every balance change is made twice (TS then GDScript) until the web version is retired or frozen. |
| (b) Keep TS, wrap the web game (Capacitor or a Trusted Web Activity) | Not Godot. The current web build runs in an Android WebView or a Chrome tab.                                                                                     | Fastest way to the store, one codebase.                              | Not the goal. PGS is an Android SDK [G2], so it needs native glue code anyway. WebView audio and performance quirks. |
| (c) Godot web export                                           | Build the Godot game for the browser as well                                                                                                                             | One codebase later, if the web version moves to Godot too.           | Not a drop-in for `<afk-game>`: it is a canvas page or iframe, not a small custom element. WebGL 2 only, Compatibility renderer [S12]. |

**Recommendation: (a).** The owner wants Godot, and the logic is small, pure and well tested, so
a careful port with golden tests is safe. (b) is listed only for comparison. (c) is a later
option for the web version (see [§6](#6-keep-the-web-game-and-the-godot-game-in-sync)). A
single-threaded web export doesn't need special server headers, so it would work on GitHub Pages
[S12].

**Tests:** Godot has no built-in GDScript test runner. The two common add-ons are **GUT** (v9.7.1,
Jul 2026) and **gdUnit4** (v6.2.3, 1 Nov 2026), both maintained [S20] [S21]. Pick one in the
skeleton PR and run it headless in CI.

### Sprites, palette, font, audio

- **Sprites** are character grids in `src/sprites/*.ts` (slots `#`, `o`, `O Y R P G B K`).
  - Write a small script that renders each sprite and frame to a **PNG sheet + JSON** with the
    slot colours from `art/afk-palette.gpl`. "Sprite → PNG export" is already a backlog item.
  - In Godot, load them as `SpriteFrames` for `AnimatedSprite2D`.
  - **Theme swap (dark/light)**: today the slot colours change with the theme. In Godot this is a
    small **palette-swap shader** (look up slot colour → theme colour), or simply two baked
    sheets. The shader is about 20 lines and keeps one sheet.
- **Aseprite files**: the owner draws in Aseprite. Godot has no built-in Aseprite import. Two
  options:
  - keep our own converter and add a Godot output (PNG sheet + JSON → `SpriteFrames`);
  - or use the **Aseprite Wizard** add-on (v9.8.0 for Godot 4, Mar 2026) [S19].
  - Recommendation: our own converter, because it already checks the palette slots.
- **Palette:** `art/afk-palette.gpl` stays the single source. The colour hex values from
  `PLAN.md` and `COLORS.md` become a GDScript constants file (or a `Theme` resource).
- **Font:** Press Start 2P is SIL OFL. The same `.ttf`/`.woff2` file loads in Godot as a
  `FontFile`.
- **Music:** `gaming-time.ogg` plays as-is (Godot imports OGG Vorbis). The two synth tracks
  (medieval, synthwave) are generated live with Web Audio today. **Render them once to OGG loops**
  with an offline script, which is simpler than porting a synth.
- **SFX:** ZzFX sounds are lists of numbers. Render each to a **WAV** once (ZzFX can build a
  sample buffer), then play them with `AudioStreamPlayer`. Port the priority rules (max ~6 voices,
  50 ms cooldown per sound, coin drops first) as a small GDScript mixer.
- **Credits** (Otrebil track permission, ZzFX MIT, font OFL) go into the Godot credits screen too.

---

## 4. Publishing on Google Play

### Account

| What                                    | Fact                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fee                                     | **US$25, one time** [P1]                                                                                                                                                    |
| Age                                     | at least **18** [P1]                                                                                                                                                        |
| Types                                   | **personal** or **organisation**. An organisation needs a **D-U-N-S number**, which "can take up to 30 days" [P2]                                                            |
| Identity                                | may ask for a government ID and a credit card in your legal name. If the information is invalid, the fee is **not refunded** [P1]                                        |
| Verified                                | contact email, contact phone and developer email by one-time code. Legal name and address come from the Google payments profile and must be verified [P2]               |
| Shown publicly (personal)               | **legal name, country and developer email**. If you monetise, also your **full address** [P2]                                                                             |
| Android developer verification (2026)   | Google is registering developers and package names for all Android apps, starting with installs from outside Play in Brazil, Indonesia, Singapore and Thailand on 30 Sep 2026. For Play apps it is automatic: "Google Play automatically registers the package name" of new apps [P19] |

### The closed-test rule for new personal accounts

From the official page [P3], and many third-party guides say the same [P21]:

- It applies to **personal accounts created after 13 Nov 2023**. A new account today is one.
- You need a **closed test** with **at least 12 testers** who stayed **opted in continuously for at
  least 14 days**. A tester who leaves early doesn't count. If someone opts out and back in, the
  14 days must still be in a row.
- Production (and pre-registration) stays locked until then.
- Then, on the Dashboard, click **Apply for production** and answer questions about the test, the
  game and production readiness.
- The review "usually takes seven days or less". Google may ask you to test longer if there were
  too few testers or too little engagement [P3].
- Older guides say 20 testers. That was the old rule; 12 is the current one [P3] [P21].

**What this means for us:** find **12+ people with Android phones** (friends, family, blog
readers). Each one joins with their Google account and keeps the game installed **for the whole 14
days**. Ask 15–20 people so a few drop-outs don't reset anything.

### Technical requirements

- **Target API:** from **31 Aug 2026**, new apps and app updates must target **Android 16 (API
  36)** or higher. There was an extension to 1 Nov 2026, and that date has passed. Existing apps
  must target **API 35+** to stay visible to new users on newer Android versions [P4] [P5]. Godot
  4.7.2 defaults to 36 [S8]. **Every year Google raises this**, so plan one Godot update a year.
- **AAB:** new apps must be published as an **Android App Bundle** (since Aug 2021). The install
  download can be at most **4 GB**, and apps over 200 MB need Play Asset or Feature Delivery
  [P6]. Ours will be far below.
- **Play App Signing:** you sign the AAB with your **upload key**. Google holds the **app signing
  key** and signs what players install [P7].
  - New apps are now enrolled by default in **"quantum-ready, hybrid signing" with Google-generated
    keys**, which means **three** key fingerprints [P7].
  - The SHA-1 fingerprints are on **Protected with Play → Play Store protection → Manage Play app
    signing** [P7]. PGS needs them (see [§5](#5-sign-in-cloud-save-and-ranking)).
- **versionCode:** a positive integer, higher on every upload, at most **2,100,000,000** [P9].
  - Proposal: `major × 10000 + minor × 100 + patch` from the semver version (`1.2.3` → `10203`).
  - An extra upload of the same version (for example a fix during the closed test) bumps the patch.

### Tracks

| Track      | Who                                                                    | Notes                                                                                                                           |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Internal   | up to **100** testers by email list                                     | builds arrive "within minutes", may skip the standard review [P8]. Use this for our own phones.                              |
| Closed     | email lists (up to 2,000 per list) or a **Google Group** (no size limit) | the **12 × 14 days** test happens here [P3] [P8]. A Google Group is easiest: testers join the group, then use the opt-in link. |
| Open       | anyone can join from the store page                                   | not needed for us [P8]                                                                                                          |
| Production | everyone                                                               | unlocked after the closed test and review [P3]                                                                                  |

### Store listing

From the graphic assets page [P11], the metadata policy [P12] and best practices [P13]:

| Asset             | Rule                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App name          | max **30** characters [P12]                                                                                                                                                     |
| Short description | max **80** characters [P11]                                                                                                                                                     |
| Full description  | max **4,000** characters [P13]                                                                                                                                                  |
| Icon              | **512 × 512** 32-bit PNG with alpha, max **1024 KB** [P11]                                                                                                                      |
| Feature graphic   | **1024 × 500**, JPEG or 24-bit PNG, no alpha, required [P11]                                                                                                                    |
| Screenshots       | at least **2** (up to 8 per device type), JPEG or 24-bit PNG, no alpha, each side **320–3840 px**, long side at most 2× the short side [P11]                                  |
| Game extras       | "highly recommended": at least 3 screenshots of real gameplay, 16:9 landscape (1920×1080+) or 9:16 portrait (1080×1920+). A **YouTube preview video** is needed to be shown in some places on Google Play [P11] |

Pixel art upscales cleanly, so screenshots are just the game captured at ×N.

### App content forms (Policy → App content)

Required for every app [P17]:

- **Privacy policy URL**: required even if the app collects nothing. It must be a public, active
  web page (https, not a PDF, no login, no geo-blocking). It must name the app or developer and say
  what data is collected, how it is shared, kept and deleted [P16] [P17]. We can host it on the
  blog (`ohwelleu.github.io`).
- **Ads**: declare yes or no. Our answer is **No** [P17].
- **Target audience**: pick age groups. If children under 13 are included, the **Families policy**
  applies: only approved SDKs, stricter rules on data, ads and identifiers [P18]. Recommendation:
  **13+** (or 16+), because the game isn't made for children and PGS isn't confirmed for
  child-directed apps.
- **Content rating**: the IARC questionnaire. Apps without a rating "will be removed" [P14]. A
  fantasy duel with slashes, no blood and no chat will likely get a low age rating, but the
  questionnaire decides.
- **Data safety form**: required for apps on closed, open or production tracks, even if they
  collect nothing [P15].
  - **SDKs count**: we must declare what PGS collects [P15] [G12].
  - Google's PGS page lists what it collects: gamer profile, analytics and diagnostics, and
    depending on use achievements, scores and saved game progress. It says the developer "is
    responsible for the SDK's data collection behavior" [G12].
  - With Firebase we would also declare user IDs and app activity [P15].
- **Sign-in details** only if parts of the app need a login [P17]. Our game works without
  sign-in, so not needed.

### Order of steps in Play Console

1. Create the developer account (personal), pay, verify identity, email and phone [P1] [P2].
2. **Create app**: name, default language, "Game", free, accept the declarations.
3. Generate the upload key and build a signed **AAB** in Godot.
4. **Internal testing**: create a release, upload the AAB (this sets up Play App Signing), add
   our own testers, install from the opt-in link [P8].
5. **Play Games Services**: create the PGS project for the game, add the credentials (SHA-1 of the
   upload key **and** the app signing keys), add testers, enable Saved Games, create leaderboards
   ([§5](#5-sign-in-cloud-save-and-ranking)).
6. Fill in **App content**: privacy policy, ads, target audience, content rating, Data safety
   [P17].
7. Fill in the **Store listing**: texts, icon, feature graphic, screenshots [P11].
8. **Closed testing**: create a track, add a Google Group, upload a build, share the opt-in link,
   keep **12+ testers for 14+ days** [P3].
9. **Apply for production** and wait for the review (usually ≤ 7 days) [P3].
10. **Production release**: upload (or promote) the build. Each later update repeats: new
    `versionCode` → internal → (closed) → production. Updates are reviewed too [P10].
    "Managed publishing" lets us decide the exact time an approved update goes live [P10].

---

## 5. Sign-in, cloud save and ranking

### Play Games Services v2 (recommended)

- **Sign-in is automatic.** The SDK signs the player in when the game starts, using the Play Games
  profile on the phone. The game checks `isAuthenticated()`. A sign-in button is only a fallback
  for players who weren't signed in automatically, and PGS doesn't require one [G1] [G2] [G3].
- **This is not "Sign in with Google".** PGS doesn't ask for an email or a password, and v2
  doesn't support the old `GoogleSignIn` API [G3]. The PGS v1 API "has been removed" [G3].
- **Player id:**
  - stays the **same for one game on all the player's devices**, and **differs between games**
    (new players get a different id per game). Existing players keep their old id [G1] [G4].
  - Google warns: **don't trust the player id the phone sends to a server**, because a modified
    device can fake it. A server must check identity with a **server auth code**
    (`requestServerSideAccess`) [G2] [G5].
- **Recall API:** optional. It links a PGS player to an account in your own backend, so progress
  restores by itself on a new device. It is only needed if we build our own accounts [G6].
- **Saved Games (cloud save):**
  - must be **enabled** in the PGS configuration (it can take up to 24 hours) [G7] [G10];
  - limits: **3 MB** of data and an **800 KB** cover image per save. Our save string is a few KB
    [G7];
  - "You are not charged for saved game data" [G7];
  - the game must handle conflicts (two phones played offline). Google's advice: load the latest
    data on start and resume, and keep the player's data [G7].
  - **Our conflict rule (proposal):** keep the save with more progress (higher `ascends`, then
    `bestStage`, then play time). If both sides moved on, ask the player with two previews
    ("Stage 5.3, 2 ascends" vs "Stage 4.1, 3 ascends").
- **Leaderboards:**
  - up to **70** per game;
  - score types numeric, time or currency, stored as long integers;
  - daily, weekly and all-time boards are made automatically;
  - **tamper protection** is on by default for new leaderboards;
  - min and max score limits are optional [G8].
  - The sort order can't change after publishing [G8].
  - Ideas: highest stage reached (as stage level `L`), total ascends.
- **Achievements:** available too (the plugin supports them [S15]). Nice later, not needed.
- **Cost:** no PGS fee is mentioned anywhere I read. Saved games storage is explicitly free [G7].
  See [Not verified](#not-verified).

**Play Console setup for PGS** [G9] [G10]:

1. Play Console → **Grow users → Play Games Services → Setup and management → Configuration**,
   create a new PGS project for the game. This also creates a Google Cloud project.
2. In Google Cloud: enable the Games API (`games.googleapis.com`). Set up the **OAuth consent
   screen** with the scopes `games`, `games_lite` and `drive.appdata`, then publish it [G9].
3. Add an **Android credential**: package name plus a **SHA-1 fingerprint**. Make one credential
   for the **debug/upload** key and one for the **release** key (the app signing key from Play App
   Signing) [G9] [P7]. Wrong or missing SHA-1s are the usual cause of "sign-in fails" errors.
4. Put the **project id** (from the Configuration page) into the app. The plugin has an export
   setting for it [S15]. Plain Android puts it in the manifest as
   `com.google.android.gms.games.APP_ID` [G9].
5. Enable **Saved Games** and create the **leaderboards** [G10].
6. **Testers**: while PGS is unpublished, only listed tester accounts work, and others get OAuth or
   404 errors. Add yourself too [G10].
7. **Publish** the PGS configuration before the production release. Changes take up to 2 hours to
   reach players [G10].

**Testing:** install from the internal track with a tester account, so the app is signed by Play
and the release SHA-1 matches. For local debug builds, the debug-key credential has to be there.

### Firebase (comparison)

The backlog idea (`docs/BACKLOG.md` → Online) is Firebase Anonymous Auth + Firestore.

| What                    | Firebase                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Free plan (Spark)       | Firestore: 1 GiB stored, **50K reads, 20K writes, 20K deletes per day**. Auth: 50K monthly active users [F1]                                                                                      |
| Anonymous auth          | a stable id with no login; can later be linked to a real sign-in with `linkWithCredential` [F3]                                                                                                 |
| Sign in with Play Games | yes: PGS server auth code → `PlayGamesAuthProvider` → Firebase user. Needs a "Game server" (web) OAuth client and the SHA-1 [F2]                                                               |
| Godot support           | **no official Firebase SDK for Godot** [F6]. Use the REST APIs for Auth and Firestore [F7] [F8], or the community add-on GodotFirebase (v6.0.6, May 2026) [S22]                              |
| Cheat checks            | Security Rules can check new values against the old ones (`request.resource.data` vs `resource.data`) [F5]. **App Check** with Play Integrity blocks some non-genuine clients, free with quotas (10,000 Play Integrity calls/day on the standard tier). Google says it "prevents some, but not all" abuse [F4] |
| Works on web too        | yes, which is its main advantage over PGS                                                                                                                                                       |

### Recommendation

- **Android:** use **PGS v2** for identity, **Saved Games** for cloud save and **PGS leaderboards**
  with tamper protection. There is no server to run and no extra data to declare beyond PGS, and
  it is what Android players expect.
- **Local save stays the main save.** It lives in `user://`, which is private to the app [S13],
  using the same `AFK1` string format. The cloud copy is a backup and moves the save between
  phones. Keep the "copy save string" export too, so players can move a web save to Android.
- **Firebase only if needed later:** for one ranking across web and Android, or for server checks.
  Then sign in with PGS → Firebase (no anonymous step on Android) and keep anonymous auth for the
  web.
- **Anti-cheat, honestly:** the whole game runs on the phone, so a determined player can send any
  score or edit any save. PGS tamper protection, score min/max limits and Firebase rules only stop
  impossible jumps. Real protection means the server replays the run, which we don't plan. Set
  realistic min/max limits on each leaderboard and accept the rest.

---

## 6. Plan of work

### Decide first (owner)

See [§8 Open questions](#8-open-questions-for-the-owner). The most urgent: the account type
(personal), the package name (permanent), portrait or landscape, and what happens to the web
version.

### Before or after the simulator and balance?

**After.** The backlog puts the simulator first and then "slow progress down".

- The simulator is also the tool that **generates the golden numbers** for the port.
- If balance is tuned first, the numbers are ported once instead of twice.

Content work (character select, stage picks, new weapons) should **wait** or happen in Godot only,
or every feature is built twice.

### Steps (one thread and one PR each, in order)

| #   | Step                                                                                                                                                                       | Size   | Notes / risks                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| 0   | (existing backlog) **Simulator** + **pacing** in TS                                                                                                                         | M + M  | Already planned. Do these first.                                                                   |
| 1   | **Golden fixtures**: `npm run golden` writes JSON (mob HP, damage and coins per stage 1–300, upgrade costs, bulk buy, RNG sequences, a seeded 30-minute sim log, sample save strings v1–v9) | S      | Lives in this repo. CI fails if the fixtures are stale.                                            |
| 2   | **Godot skeleton** in `godot/`: project, pixel settings, empty duel scene, GUT/gdUnit4, headless test run in CI                                                            | S      | Pin the Godot version in CI.                                                                       |
| 3   | **Port balance + rng + format**, golden tests                                                                                                                              | M      | `pow` last-bit differences, the 2^53 clamp, 32-bit RNG masking.                                    |
| 4   | **Port the duel state machine** (`state.ts`: timers, phases, combat, coins, rollback)                                                                                       | L      | Split into 2 PRs if over ~400 lines. Fixed 60 tick/s timestep as today.                            |
| 5   | **Port items, ascend, quest, companions**                                                                                                                                  | M      | Seeded drops must match TS exactly.                                                                |
| 6   | **Save/load**: same `AFK1` string, checksum, migrations, backup slot, `user://` files                                                                                       | M      | Test: every TS fixture save loads in Godot, and the round trip gives the same string.              |
| 7   | **Sprites to PNG sheets** + palette-swap shader + `SpriteFrames`                                                                                                           | M      | A script in this repo outputs into `godot/assets/`.                                                |
| 8   | **Scene and HUD**: hero, mob, HP bars, damage numbers, coin fly, stage label, hit flash, rain                                                                              | L      | Use the safe area.                                                                                 |
| 9   | **Menus**: shop, inventory, stats, settings, quest, credits                                                                                                                | L      | 2–3 PRs. Touch-sized buttons.                                                                      |
| 10  | **Audio**: OGG track, synth tracks and ZzFX rendered to files, small mixer                                                                                                 | M      | Rendering scripts live in this repo.                                                               |
| 11  | **Android export on a real phone**: Gradle build, debug key, AAB, target 36, pause in the background, back button                                                         | M      | First real-device test, needs an Android phone.                                                    |
| 12  | **Play Console**: account, app, internal track, Play App Signing (owner, with a checklist)                                                                                  | S      | Waiting time for the ID check.                                                                     |
| 13  | **PGS spike**: plugin on Godot 4.7, sign-in on a phone                                                                                                                      | S      | **Biggest technical risk.** If it fails: stay on 4.6.x, or patch the plugin and rebuild it.        |
| 14  | **Cloud save** via Saved Games + conflict screen                                                                                                                           | M      | Known plugin issue with snapshots in some projects [S16].                                          |
| 15  | **Leaderboards** (+ optional achievements)                                                                                                                                 | S      | Set the min/max limits.                                                                            |
| 16  | **Store listing + privacy policy page + forms** (Data safety, rating, audience, ads)                                                                                        | S      | The privacy page goes in the blog repo.                                                            |
| 17  | **Closed test**: 12+ testers × 14 days, fix bugs, apply for production                                                                                                     | S work | **≥ 3 weeks of calendar time** (14 days + review of up to ~7 days).                                |
| 18  | **Production release** + update checklist (versionCode, changelog, yearly target API bump)                                                                                 | S      |                                                                                                   |

Rough total: about 4 large, 8 medium and 7 small PRs. Steps 12 (account) and 16 (privacy page) can
start early, in parallel with the porting.

### Main risks

1. **PGS plugin vs Godot 4.7** is not confirmed. Mitigation: step 13 comes before any PGS-dependent
   work. Fall back to Godot 4.6.x if needed.
2. **Finding 12 testers who stay 14 days.** Mitigation: invite 15–20, use a Google Group, remind
   them.
3. **Logic drift** between TS and GDScript. Mitigation: golden fixtures in CI, and the TS
   simulator as the one source of balance until the switch.
4. **Yearly target API bumps** force updates. Mitigation: keep Godot current; each new minor version
   usually raises the default target.
5. **Losing the upload key** or the passwords. Mitigation: password manager plus an offline backup.
   Google can reset an upload key [P7].
6. **Double work** while two versions live. Mitigation: freeze web features during the port.

### Keep the web game and the Godot game in sync

- **During the port:** the TS game is the reference. Balance changes go to TS first, the fixtures
  update, and the Godot tests fail until the GDScript side matches. No new features on the web
  side.
- **After the Android launch**, three choices:
  - **A. Freeze the web game** (bug fixes only, stays on the blog). Cheapest. *Recommended for the
    first months.*
  - **B. Replace the web game with a Godot web export.** One codebase. A single-threaded export
    works on GitHub Pages without special headers [S12], but it is a bigger download and an iframe
    instead of `<afk-game>`.
  - **C. Keep both alive.** Every feature twice. Not recommended.
- Saves stay compatible across platforms because both use the `AFK1` string. Copy on the web, paste
  on the phone.

---

## 7. Costs and legal basics

| Item                         | Cost / duty                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Godot                        | free, MIT [S24]                                                                                                                                                                 |
| Play Console                 | **$25 once** [P1]                                                                                                                                                               |
| Play Games Services          | no fee found. Saved games storage is free [G7]                                                                                                                                  |
| Firebase (if used)           | free Spark plan within the limits above [F1]                                                                                                                                    |
| Android phone for testing    | needed (any phone with Android 7 / API 24 or newer runs Godot 4.7 [S8])                                                                                                        |
| Privacy policy page          | free on the blog. **Required** [P16]                                                                                                                                            |
| Monetisation (only if ever)  | needs a payments profile and merchant/tax setup. Google then shows the **full address** [P2]. Play takes a **service fee**, and Google's fee table is changing in 2026, so check the current page [P20] |

**Privacy and data duties when storing a player id:**

- A PGS player id plus saved progress is data "collected" by the app (it leaves the phone). It must
  be in the **Data safety** form and in the **privacy policy** [P15] [G12].
- The policy says what we store (player id, game progress and scores via Google), why (saves,
  leaderboards), how long, and how to delete it. Players can delete their Play Games data in their
  Play Games profile or Google account [G12].
- If we add our own backend (Firebase), add those data types too, plus a way to ask for deletion.
- **Age rating:** the IARC questionnaire is required [P14]. Choosing a 13+ target audience avoids the
  Families policy [P18].

---

## 8. Open questions for the owner

1. **Personal or organisation account?** *Recommendation: personal.* No company is needed. It shows
   your **legal name, country and developer email** on Google Play, and it needs the 12 × 14 closed
   test [P2] [P3].
2. **Package name** (permanent)? *Recommendation:* `io.github.ohwelleu.afkgame`, or a domain you
   own.
3. **Game name** for the store (max 30 characters)?
4. **Portrait or landscape?** *Recommendation: portrait.* It works one-handed and suits an idle game
   left running. The duel goes in the top half, the menus below. Today's layout is wide, so this is
   a real layout change.
5. **What happens to the web game?** *Recommendation: freeze it during and after the port (option
   A), and decide on a Godot web export after launch.*
6. **Same repo or a new one?** *Recommendation: same repo, a `godot/` folder.* Golden fixtures, art
   and docs stay shared, and CI can check both.
7. **Ads or in-app purchases ever?** *Recommendation: none at launch.* It keeps the forms short, no
   public address, and no billing plugin.
8. **Cross-platform leaderboard (web + Android)?** *Recommendation: no, PGS leaderboards on Android
   only.* Firebase later only if wanted.
9. **Who are the 12+ testers?** Start the list now. It decides the earliest launch date.
10. **Start before or after the simulator?** *Recommendation: after the simulator and pacing work
    (backlog), and pause other web features.*

---

## Not verified

- **Godot SDK packages:** the 4.7 docs list `platforms;android-35`, `build-tools;35.0.1` and NDK
  r28b [S3]. The 4.7.2 source uses compile/target SDK 36, build-tools 36.1.0 and NDK 29 [S8]. I
  didn't test which ones the Gradle build really needs. Install both to be safe.
- **PGS plugin on Godot 4.7:** no release note or issue confirms it. 4.6.3 only via a
  collaborator's comment on an issue [S16].
- **The current `play-services-games-v2` version:** the plugin uses 21.0.0 [S15]. The Google docs
  only say "latest" [G2].
- **PGS price and quotas:** no page says "free" except for Saved Games storage [G7], and no quota
  is published on the pages I read.
- **Number of PGS tester accounts allowed:** not stated [G10].
- **`gamePlayerId` / `teamPlayerId` field names:** I didn't find them on the pages I read. The docs
  describe the player id and "next-gen player IDs" (one id per game) [G4].
- **Firebase Play Games sign-in sample** still uses the old `GoogleSignIn` API [F2], which PGS v2
  doesn't support [G3]. The exact v2 → Firebase flow wasn't checked.
- **Whether anonymous Firebase users count towards the 50K MAU** free limit [F1] [F3].
- **Whether PGS is allowed in apps aimed at children** under the Families policy: not found [P18].
- **Content rating questionnaire is free:** no fee was mentioned, but no page says "free" [P14].
- **Play service fee rates in 2026:** the long-standing 15% tier for the first $1M a year is on
  the help page, but newer pages hint at a new 2026 fee structure [P20]. It only matters if we
  monetise.
- **EU "trader status" (Digital Services Act) declaration in Play Console:** third-party guides
  say every developer must declare it. I didn't find the official Google page.
- **Credential Manager:** Google's general "Sign in with Google" on Android goes through Credential
  Manager. I didn't check that page; PGS doesn't need it.
- **Android Auto Backup of `user://` saves:** not covered by the Godot pages I read [S13].
- **Whether the target-API extension forms** (to 1 Nov 2026) were ever used. It no longer matters
  for a new app.

---

## Sources

Checked 2026-11-10 (Godot release, Play account and testing pages) and 2026-11-11 (the rest).

**Godot**

- S1: https://godotengine.org/download/archive/ (2026-11-10)
- S2: https://godotengine.org/article/maintenance-release-godot-4-7-2/ (2026-11-10)
- S3: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html (2026-11-10)
- S4: https://docs.godotengine.org/en/stable/tutorials/export/android_gradle_build.html (2026-11-10)
- S5: https://docs.godotengine.org/en/stable/tutorials/platform/android/android_plugin.html (2026-11-10)
- S6: https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html (2026-11-10)
- S7: https://docs.godotengine.org/en/stable/classes/class_editorexportplatformandroid.html (2026-11-10)
- S8: https://github.com/godotengine/godot/blob/4.7.2-stable/platform/android/java/app/config.gradle
  and `platform/android/export/export_plugin.cpp` (2026-11-11)
- S9: https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html (2026-11-11)
- S10: https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html (2026-11-11)
- S11: https://docs.godotengine.org/en/stable/classes/class_projectsettings.html,
  https://docs.godotengine.org/en/stable/classes/class_int.html,
  https://docs.godotengine.org/en/stable/classes/class_float.html (2026-11-11)
- S12: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html (2026-11-11)
- S13: https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html (2026-11-11)
- S14: https://docs.godotengine.org/en/stable/tutorials/platform/android/android_in_app_purchases.html (2026-11-11)
- S15: https://github.com/godot-sdk-integrations/godot-play-game-services (README, releases,
  `CHANGELOG.md`, `plugin/build.gradle.kts` at v3.4.0) (2026-11-11)
- S16: https://github.com/godot-sdk-integrations/godot-play-game-services/issues/108 and
  [/issues/105](https://github.com/godot-sdk-integrations/godot-play-game-services/issues/105) (2026-11-11)
- S17: https://github.com/godot-sdk-integrations/godot-google-play-billing/releases (2026-11-11)
- S18: https://github.com/StudioAdriatic/PGSGP/releases (2026-11-11)
- S19: https://github.com/viniciusgerevini/godot-aseprite-wizard/releases (2026-11-11)
- S20: https://github.com/bitwes/Gut/releases (2026-11-11)
- S21: https://github.com/godot-gdunit-labs/gdUnit4/releases (2026-11-11)
- S22: https://github.com/GodotNuts/GodotFirebase/releases (2026-11-11)
- S23: https://docs.godotengine.org/en/stable/classes/class_displayserver.html (2026-11-11)
- S24: https://godotengine.org/license/ (2026-11-11)

**Google Play**

- P1: https://support.google.com/googleplay/android-developer/answer/6112435 (2026-11-10)
- P2: https://support.google.com/googleplay/android-developer/answer/13628312 (2026-11-10)
- P3: https://support.google.com/googleplay/android-developer/answer/14151465 (2026-11-10)
- P4: https://support.google.com/googleplay/android-developer/answer/11926878 (2026-11-10)
- P5: https://developer.android.com/google/play/requirements/target-sdk (2026-11-10)
- P6: https://developer.android.com/guide/app-bundle (2026-11-10)
- P7: https://support.google.com/googleplay/android-developer/answer/9842756 (2026-11-10)
- P8: https://support.google.com/googleplay/android-developer/answer/9845334 (2026-11-10)
- P9: https://developer.android.com/studio/publish/versioning (2026-11-10)
- P10: https://support.google.com/googleplay/android-developer/answer/9859751 (2026-11-10)
- P11: https://support.google.com/googleplay/android-developer/answer/9866151 (2026-11-10)
- P12: https://support.google.com/googleplay/android-developer/answer/9898842 (2026-11-10)
- P13: https://support.google.com/googleplay/android-developer/answer/13393723 (2026-11-11)
- P14: https://support.google.com/googleplay/android-developer/answer/9898843 (2026-11-10)
- P15: https://support.google.com/googleplay/android-developer/answer/10787469 (2026-11-10)
- P16: https://support.google.com/googleplay/android-developer/answer/10144311 (2026-11-10)
- P17: https://support.google.com/googleplay/android-developer/answer/9859455 (2026-11-10)
- P18: https://support.google.com/googleplay/android-developer/answer/9867159 and
  [/answer/9893335](https://support.google.com/googleplay/android-developer/answer/9893335) (2026-11-10)
- P19: https://developer.android.com/developer-verification and
  https://developer.android.com/developer-verification/guides/google-play-console (2026-11-10)
- P20: https://support.google.com/googleplay/android-developer/answer/10632485 (2026-11-11, not
  read in full)
- P21: second sources for 12 testers × 14 days:
  https://dev.to/stacklyn_labs/google-plays-closed-test-rule-12-testers-14-days-no-gaps-335d,
  https://www.testerscommunity.com/google-play-production-access-12-testers (2026-11-10)
- P22: https://developer.android.com/build/configure-app-module (2026-11-11)

**Play Games Services**

- G1: https://developer.android.com/games/pgs/signin (2026-11-11)
- G2: https://developer.android.com/games/pgs/android/android-signin (2026-11-11)
- G3: https://developer.android.com/games/pgs/android/migrate-to-v2 (2026-11-11)
- G4: https://developer.android.com/games/pgs/next-gen-player-ids (2026-11-11)
- G5: https://developer.android.com/games/pgs/android/server-access (2026-11-11)
- G6: https://developer.android.com/games/pgs/recall (2026-11-11)
- G7: https://developer.android.com/games/pgs/savedgames (2026-11-11)
- G8: https://developer.android.com/games/pgs/leaderboards (2026-11-11)
- G9: https://developer.android.com/games/pgs/console/setup (2026-11-11)
- G10: https://developer.android.com/games/pgs/console/enable-features (2026-11-11)
- G11: https://developer.android.com/games/guidelines (Level Up program, voluntary; asks for PGS
  sign-in, cloud save with a conflict policy, 10+ achievements) (2026-11-11)
- G12: https://developer.android.com/games/pgs/data-collection (2026-11-11)

**Firebase**

- F1: https://firebase.google.com/pricing (2026-11-11)
- F2: https://firebase.google.com/docs/auth/android/play-games (2026-11-11)
- F3: https://firebase.google.com/docs/auth/android/anonymous-auth (2026-11-11)
- F4: https://firebase.google.com/docs/app-check (2026-11-11)
- F5: https://firebase.google.com/docs/firestore/security/rules-conditions (2026-11-11)
- F6: https://firebase.google.com/docs/libraries (2026-11-11)
- F7: https://firebase.google.com/docs/reference/rest/auth (2026-11-11)
- F8: https://firebase.google.com/docs/firestore/use-rest-api (2026-11-11)

[S1]: https://godotengine.org/download/archive/
[S2]: https://godotengine.org/article/maintenance-release-godot-4-7-2/
[S3]: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html
[S4]: https://docs.godotengine.org/en/stable/tutorials/export/android_gradle_build.html
[S5]: https://docs.godotengine.org/en/stable/tutorials/platform/android/android_plugin.html
[S6]: https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html
[S7]: https://docs.godotengine.org/en/stable/classes/class_editorexportplatformandroid.html
[S8]: https://github.com/godotengine/godot/blob/4.7.2-stable/platform/android/java/app/config.gradle
[S9]: https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html
[S10]: https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html
[S11]: https://docs.godotengine.org/en/stable/classes/class_int.html
[S12]: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
[S13]: https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html
[S14]: https://docs.godotengine.org/en/stable/tutorials/platform/android/android_in_app_purchases.html
[S15]: https://github.com/godot-sdk-integrations/godot-play-game-services
[S16]: https://github.com/godot-sdk-integrations/godot-play-game-services/issues/108
[S17]: https://github.com/godot-sdk-integrations/godot-google-play-billing/releases
[S18]: https://github.com/StudioAdriatic/PGSGP/releases
[S19]: https://github.com/viniciusgerevini/godot-aseprite-wizard/releases
[S20]: https://github.com/bitwes/Gut/releases
[S21]: https://github.com/godot-gdunit-labs/gdUnit4/releases
[S22]: https://github.com/GodotNuts/GodotFirebase/releases
[S23]: https://docs.godotengine.org/en/stable/classes/class_displayserver.html
[S24]: https://godotengine.org/license/
[P1]: https://support.google.com/googleplay/android-developer/answer/6112435
[P2]: https://support.google.com/googleplay/android-developer/answer/13628312
[P3]: https://support.google.com/googleplay/android-developer/answer/14151465
[P4]: https://support.google.com/googleplay/android-developer/answer/11926878
[P5]: https://developer.android.com/google/play/requirements/target-sdk
[P6]: https://developer.android.com/guide/app-bundle
[P7]: https://support.google.com/googleplay/android-developer/answer/9842756
[P8]: https://support.google.com/googleplay/android-developer/answer/9845334
[P9]: https://developer.android.com/studio/publish/versioning
[P10]: https://support.google.com/googleplay/android-developer/answer/9859751
[P11]: https://support.google.com/googleplay/android-developer/answer/9866151
[P12]: https://support.google.com/googleplay/android-developer/answer/9898842
[P13]: https://support.google.com/googleplay/android-developer/answer/13393723
[P14]: https://support.google.com/googleplay/android-developer/answer/9898843
[P15]: https://support.google.com/googleplay/android-developer/answer/10787469
[P16]: https://support.google.com/googleplay/android-developer/answer/10144311
[P17]: https://support.google.com/googleplay/android-developer/answer/9859455
[P18]: https://support.google.com/googleplay/android-developer/answer/9867159
[P19]: https://developer.android.com/developer-verification
[P20]: https://support.google.com/googleplay/android-developer/answer/10632485
[P21]: https://dev.to/stacklyn_labs/google-plays-closed-test-rule-12-testers-14-days-no-gaps-335d
[P22]: https://developer.android.com/build/configure-app-module
[G1]: https://developer.android.com/games/pgs/signin
[G2]: https://developer.android.com/games/pgs/android/android-signin
[G3]: https://developer.android.com/games/pgs/android/migrate-to-v2
[G4]: https://developer.android.com/games/pgs/next-gen-player-ids
[G5]: https://developer.android.com/games/pgs/android/server-access
[G6]: https://developer.android.com/games/pgs/recall
[G7]: https://developer.android.com/games/pgs/savedgames
[G8]: https://developer.android.com/games/pgs/leaderboards
[G9]: https://developer.android.com/games/pgs/console/setup
[G10]: https://developer.android.com/games/pgs/console/enable-features
[G11]: https://developer.android.com/games/guidelines
[G12]: https://developer.android.com/games/pgs/data-collection
[F1]: https://firebase.google.com/pricing
[F2]: https://firebase.google.com/docs/auth/android/play-games
[F3]: https://firebase.google.com/docs/auth/android/anonymous-auth
[F4]: https://firebase.google.com/docs/app-check
[F5]: https://firebase.google.com/docs/firestore/security/rules-conditions
[F6]: https://firebase.google.com/docs/libraries
[F7]: https://firebase.google.com/docs/reference/rest/auth
[F8]: https://firebase.google.com/docs/firestore/use-rest-api
