# Speed Reader

A one-word-at-a-time speed reader (RSVP — Rapid Serial Visual Presentation), like Spritz.

Each word is shown in a fixed spot with one letter highlighted in red — the **optimal recognition point**, where the eye naturally lands. Because your eyes don't have to move along a line, you can read faster.

## Usage

Open `index.html` in a browser. No build step or dependencies.

Paste text into the box, set the speed, and press **Play**.

| Key | Action |
| --- | --- |
| Space | Play / pause |
| ← / → | Step back / forward one word |
| Shift + ← / → | Step back / forward one sentence |
| ↑ / ↓ | Speed ±25 WPM |

## Behaviour

- Speed: 100–1000 WPM (remembered between visits)
- Longer pauses at sentence ends (~2.2×), commas/semicolons (~1.5×), long words, and paragraph breaks
- Progress bar and time remaining
- **Stop at sentence end** (Settings, via the cog icon; on by default): pausing lets the current sentence finish first, then resumes from the next sentence. Press pause again to stop immediately.
- **⏮ Sentence** jumps to the start of the current sentence, or the previous sentence if already at the start of one
- **Paste** / **Clear** buttons for the text box
- When stopped, the current word is highlighted in the text box, which scrolls to it
- Text and reading position are saved across refreshes
- Follows system light/dark mode

## Limitations

Words are split on whitespace, so languages without spaces (e.g. Japanese) display as one long "word". `Intl.Segmenter` could fix this.
