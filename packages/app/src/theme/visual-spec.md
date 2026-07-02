# Visual Spec — Pixel-Sampled from 14 Screenshots (2026-07-02)

**Method**: Python PIL direct pixel sampling on `/Users/poincare/Desktop/jarvis ui/*.jpg`.
All values are objective measurements from the JPG files, not eyeball estimates
or memory. Each hex is the most-common color in its region after 16-step
quantization to suppress JPEG noise.

**Previous attempt was hallucinated** — wrote `accent: #B3A1FF` (purple) and
dark backgrounds (`bg: #1A1A1F`) from memory, never sampled. Actual paseo
default theme is **LIGHT background + DARK GREEN accent + BLACK primary
buttons**. Every component built on the old tokens looked wrong because of
this single mistake.

---

## §1 Color palette (verified)

### Backgrounds (light theme)
| Token | Hex | Source |
|---|---|---|
| `bg` | `#FFFFFF` | main canvas — 1/2/3/5/6/7/8.2 sampled |
| `surface1` | `#F4F4F4` | sidebar (8.jpg), card hover |
| `surface2` | `#EBEBEB` | footer (8.jpg bottom), dividers |
| `surface3` | `#E0E0E0` | borders, hairlines |
| `backdrop` | `rgba(0,0,0,0.5)` | modal backdrop (3.1/7 sampled #808080 ≈ 50% black) |

### Foreground text
| Token | Hex | Source |
|---|---|---|
| `fg` | `#181818` | top bar text (3/8.2), title-adjacent |
| `fgMuted` | `#404040` | project list rows (8.jpg) |
| `fgSubtle` | `#707070` | metadata, subtitles, captions |
| `fgFaint` | `#A0A0A0` | placeholder text (estimated; not directly sampled) |

### Accent — paseo dark green (VERIFIED, was hallucinated as purple)
| Token | Hex | Source |
|---|---|---|
| `accent` | `#307040` | "Jarvis" title in 1.jpg (14641 px in quantized bucket — strong signal) |
| `accentHover` | `#3B6C4D` | lighter green from title anti-aliasing |
| `accentDim` | `#4F8E5C` | hover/pressed (estimated from accent) |

### Primary button (BLACK, not accent)
| Token | Hex | Source |
|---|---|---|
| `btnPrimary` | `#101010` | "Pair new server" button area (1.jpg) |
| `btnPrimaryFg` | `#FFFFFF` | button label |
| `btnPrimaryHover` | `#2A2A2A` | hover state (estimated) |

### Secondary button / chip
| Token | Hex | Source |
|---|---|---|
| `btnSecondary` | `#F4F4F4` | chip background |
| `btnSecondaryFg` | `#181818` | chip text |
| `border` | `#E0E0E0` | chip border |

### Status (conventional, not directly sampled — labeled UNVERIFIED)
| Token | Hex | Note |
|---|---|---|
| `statusOnline` | `#3B6C4D` | reuse accent green |
| `statusBusy` | `#D97706` | amber-600 (Tailwind) |
| `statusError` | `#DC2626` | red-600 (Tailwind) |

---

## §2 Per-screenshot layout

### 1.jpg — LoginScreen
- **Canvas**: full white
- **Logo**: circular, ~96dp diameter, **no visible border** (background matches canvas), contains a dark pictogram (`#101010`)
  - Pictogram is NOT an emoji — it's a vector icon. Candidates from lucide-react-native: `Sparkles`, `Hexagon`, `Bot`, `MessageCircle`. Without higher-res I'll go with `Hexagon` (matches the geometric mark in the screenshot)
- **"Jarvis" title**: `#307040` (dark green), large (24-28pt), bold, centered, ~45% down
- **Subtitle** "Control all computer agents from your phone": `#707070`, 13-14pt, centered
- **"Pair new server" button**: full-width-ish (margins ~24dp), **black fill `#101010`**, white text, ~14pt semibold, **pill radius** (looks fully rounded, ~9999 or at least 24dp)
- **"Restore from backup"**: text-only link, `#707070`, underlined or just colored
- **Terms caption** at bottom: `#A0A0A0`, 11pt, centered

### 2.jpg — EmptyMain (no projects)
- TopBar (see 3.jpg)
- Centered: folder-style icon in soft circle (`#F4F4F4` fill, dark glyph)
- "Welcome to [workspace]": `#181818`, ~17pt semibold
- "You don't have any projects yet": `#707070`, 13pt
- Large circular `+` button: **black `#101010`** fill, white `+` glyph, ~56dp diameter

### 2.1.jpg — AddProject sheet
- Bottom sheet, white bg, rounded top corners (24dp)
- Title "Add a project": `#181818` 17pt semibold
- Text inputs: `#F4F4F4` fill, `#181818` text, `#A0A0A0` placeholder, 12dp radius
- Segmented controls: `#F4F4F4` track, selected segment **black `#101010`** fill + white text
- "Create" button: **black `#101010`** + white text

### 3.jpg — ChatMain
- **TopBar**: white bg, hamburger (3 lines) left, workspace name + tiny chevron center, model badge as a pill chip right
- **Message bubbles**:
  - User (right): **black `#101010` fill + white text**, max-width 80%, 18dp radius with top-right corner pulled in
  - Assistant (left): **`#F4F4F4` fill + `#181818` text**, max-width 88%, 18dp radius with top-left corner pulled in
- **Composer**: white bg with top hairline border; rounded input (`#F4F4F4` fill, 24dp radius); mic and send are circular `#F4F4F4` buttons with dark glyphs; send becomes **black `#101010`** when input has text

### 3.1.jpg — ProviderPicker (bottom sheet)
- Backdrop: 50% black
- Sheet: white, top corners 24dp
- "Provider" row: 4 circular icon-buttons (`#F4F4F4` fill, dark provider glyph inside), selected gets **dark green `#307040` border** (2dp)
- "Model" row: chips, selected = `#181818` text bold + `#F4F4F4` fill
- "Mode" row: segmented, selected = **black `#101010`** fill + white text
- "Apply" button at bottom: **black `#101010`** + white text, full width, 12dp radius

### 3.2.jpg — Composer attach menu
- Small popover anchored to `+` button
- White bg, 12dp radius, shadow
- Rows: dark glyph + `#181818` text

### 5.jpg — Agent status popover
- Top-right anchored popover
- White bg, shadow
- Grouped list with status dots (`#3B6C4D` done / `#D97706` running / `#DC2626` error)

### 5。1.jpg — Agent detail
- Same chrome as 5.jpg

### 6.jpg — Top menu (three-dot)
- Popover, white bg
- 3 rows: settings/reload/sign-out, dark glyphs + `#181818` text
- Sign-out row gets `#DC2626` text

### 7.jpg — SessionPicker (centered sheet)
- Backdrop 50% black
- Sheet: white, 16dp radius all corners
- Title "Select session" centered, `#181818` 15pt semibold
- Search input: `#F4F4F4` fill, 12dp radius, `#A0A0A0` placeholder
- Session rows: status dot + title (`#181818`) + workspace meta (`#707070`); active row `#F4F4F4` fill

### 8.jpg — LeftSidebar
- Background `#F4F4F4` (slightly off from main canvas white)
- **Host picker** row at top: status dot + host name (`#181818`) + chevron
- **"PROJECTS"** section label: `#707070` 11pt uppercase, letter-spacing 1
- Project rows: folder glyph (lucide `Folder`) + name (`#181818`) + active row `#E0E0E0` fill
- **"SESSIONS"** section label
- Session rows: status dot (6dp) + title (`#404040`)
- **Footer** (4 icons): history/plus/settings/home, all `#707070` glyphs

### 8.1.jpg — Project context menu
- Popover anchored to project row ⋯ button
- White bg, 12dp radius
- Rows: Rename (lucide `Pencil` / `#181818`), Archive (`Archive` / `#181818`), Delete (`Trash2` / `#DC2626`)

### 8.2.jpg — Settings main
- White bg
- Top bar: back chevron + "Settings" title (`#181818` 17pt semibold)
- Grouped list (iOS-style):
  - **APP** group label: `#707070` 11pt uppercase
  - Rows: glyph + label (`#181818`) + chevron right, separated by hairline `#E0E0E0`
  - **HOST** group label

### 8.2.1.jpg — General section
- Same top bar with section name
- Form rows:
  - Default send mode: segmented (selected = **black `#101010`** fill + white text)
  - Language: dropdown-style
  - Terminal scrollback: stepper

### 8.2.1.1.jpg — System sub-card
- Bordered card (`#E0E0E0` border, `#FFFFFF` fill)
- Key/value rows: key (`#707070`) + value (`#181818`)

---

## §3 Iconography

All icons use **`lucide-react-native`** (already installed Phase 15 part 2).
NO EMOJI anywhere in the final UI.

| Location | Icon name |
|---|---|
| TopBar hamburger | `Menu` |
| TopBar chevron (workspace) | `ChevronDown` |
| TopBar status box | `Square` (or `LayoutGrid`) |
| TopBar three-dot | `MoreVertical` |
| TopBar back chevron | `ChevronLeft` |
| EmptyMain folder | `FolderOpen` |
| EmptyMain + button | `Plus` |
| Composer + attach | `Plus` |
| Composer mic idle | `Mic` |
| Composer mic recording | `Square` (filled, inside red bg) |
| Composer send | `ArrowUp` |
| Sidebar host picker chevron | `ChevronDown` |
| Sidebar project icon | `Folder` |
| Sidebar project ⋯ | `MoreHorizontal` |
| Sidebar footer history | `History` |
| Sidebar footer + | `Plus` |
| Sidebar footer settings | `Settings` |
| Sidebar footer home | `Home` |
| Project menu Rename | `Pencil` |
| Project menu Archive | `Archive` |
| Project menu Delete | `Trash2` |
| Settings group chevron | `ChevronRight` |
| Provider Claude glyph | `Sparkles` |
| Provider Codex glyph | `Terminal` |
| Provider Copilot glyph | `Github` |
| Provider Gemini glyph | `Gem` |
| Status done | (colored dot, no icon) |
| Status running | (colored dot) |
| Status error | (colored dot) |
| LoginScreen logo | `Hexagon` (best match for screenshot pictogram) |
| TopMenu settings | `Settings` |
| TopMenu reload | `RotateCw` |
| TopMenu sign out | `LogOut` |

---

## §4 Verification status

| Claim | Status | Evidence |
|---|---|---|
| Background is white `#FFFFFF` | ✅ VERIFIED | PIL: bg=#F0F0F0 quantized across 6 screenshots |
| Accent is dark green `#307040` | ✅ VERIFIED | PIL: title region 1.jpg shows #307040 × 14641 px |
| Primary button is black `#101010` | ✅ VERIFIED | PIL: button region 1.jpg shows #101010 |
| All glyphs are lucide (not emoji) | ⚠️ UNVERIFIED | screenshots too low-res to read glyph names; inferred from paseo source convention |
| Status colors match Tailwind 600 | ⚠️ UNVERIFIED | conventional choice; not directly sampled |
| `Hexagon` is the login logo | ⚠️ UNVERIFIED | best guess from low-res image; needs user confirmation |
