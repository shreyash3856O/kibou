# Hyperframes Composition Brief: Kibou

## Objective
Create a short launch-style brag video for Kibou.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1280x720
- Duration: 20 seconds

## Source Material
- Project root: `C:\Users\shrey\OneDrive\Desktop\New folder\kibou-main`
- Primary files read: client/index.html, client/src/index.css, README.md, client/src/views (SeekerDashboard, ChatRoom), server/src/sukhi.js
- Product name: Kibou
- Tagline / strongest claim: "No name. No waiting. Just someone there." / "100% Anonymous. No account or email needed."
- Key UI or visual moment to recreate: seeker topic pills + "Find Peer Helper" tap; dark chat bubbles; Sukhi thinking-orb shimmer with "Sukhi is reflecting…"; helper toast "Someone needs support"
- Copy that must appear verbatim:
  - "It's 2am. Your brain won't shut up."
  - "Find Peer Helper"
  - "Sukhi is reflecting…"
  - "100% Anonymous. No account."
  - "Tele-MANAS 14416 on every crisis."
  - "No name. No waiting. Just someone there."

## Creative Direction
- Tone preset: default
- Creative direction: warm good-vibes launch for a campus kindness app
- Interpretation: playful and clean but never jokey about the subject — high motion energy, sincere copy, restraint on SFX. Comfortable pacing with full reading holds.
- Angle: The 2am test — one stressed student goes from alone to heard in 20 seconds.
- Hook: "It's 2am. Your brain won't shut up." then "Kibou" resolves in safe-green.
- Outro / punchline: Kibou wordmark + "No name. No waiting. Just someone there."
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #121212
- Text: #ffffff
- Accent: #16a34a (safe green)
- Display font: system sans stack (no webfonts — deterministic render)
- Body font: system sans stack
- Visual references from the project: flat dark cards (#1c1c1c, 1px #333 borders, 10-12px radius), white primary buttons, green accent buttons, chat bubbles, green notification dot

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3s — "It's 2am. / Your brain won't shut up." then green "Kibou" resolves ~2.2s
2. Front door — 4s (3–7) — 3 topic pills arrive one by one, cursor taps "Find Peer Helper"
3. The conversation — 5.65s (7–12.65) — seeker bubble, orb shimmer "Sukhi is reflecting…", Sukhi reply lands ~10.54s, helper toast slides in
4. Trust stack — 4.35s (12.65–17) — 3 claim lines arrive and hold as a set
5. Outro — 3s (17–20) — wordmark + tagline, music fades, soft bell

## Audio
- Audio role: warm bed
- Audio arc: bed in low at 0s, gentle lift into the chat scene, 2s fade under the outro
- Music: happy-beats-business-moves-vol-9-by-ende-dot-app.mp3 (copy to composition/assets/music/)
- Music treatment: volume 0.35, fade out 18–20s
- Music cue guidance: bundled preset `.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json` (~115 BPM). Lock Sukhi reply landing near the 10.54s strong cue (±0.15s). Scene transitions sit near 3.70s and 12.65s strong cues. Sequential text snaps to every other beat (~1.05s spacing) or holds as a set.
- Audio-reactive treatment: subtle; RMS breathes the green glow behind the orb and the outro wordmark only
- Audio-coupled moments:
  - Scene 1 hook — key ticks under typed lines
  - Scene 2 tap — click on the Find Peer Helper tap
  - Scene 3 bubbles — soft drops on first and last arrival only; shimmer bed under orb
  - Scene 3 toast — light plate ping on slide-in
  - Scene 5 logo — soft bell as wordmark lands
- SFX selection guidance: interface clicks/drops for UI motion, plate ping for the toast, bell for the logo; copy these files into composition/assets/sfx/: interface/click_001.ogg, interface/drop_001.ogg, interface/drop_002.ogg, impact/impactPlate_light_002.ogg, impact/impactBell_heavy_000.ogg, keyboard/keypress-003.wav, keyboard/keypress-011.wav, keyboard/keypress-019.wav, keyboard/keypress-027.wav
- SFX analysis guidance: `.agents/skills/brag/assets/sfx/sfx-analysis.md` — prefer low high-frequency-risk files for repeated/polished moments
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not `none`, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.
