# Homies — Join the Crew 🏠✨

> Official website and Whitelist Quest System for **Homies** ([@HomiesART](https://x.com/HomiesART)).

A cyber-pixel NFT showcase website inspired by WeZards.xyz, featuring dynamic quest-based whitelist registration, proof collection, and a full-featured Mission Control Admin Panel.

---

## 🚀 Features

### 🌟 Public Showcase & Initiation (`index.html`)
- **Retro-Cyber Pixel Aesthetic**: Custom animations, ambient glow orbs, and pixel art styling using Google Fonts (`Press Start 2P`, `Inter`).
- **Interactive Character Marquee**: Showcases the Homies pixel character collection seamlessly.
- **Story & World Section**: Collection statistics, traits, and background lore.
- **The Crew Gallery**: Character preview gallery featuring high-resolution pixel art.
- **Initiation Roadmap**: Phase 1 (Assembly), Phase 2 (Art Drop), Phase 3 (Mint Day), Phase 4 (Beyond).

### 📋 Whitelist Quests Modal
- **Dynamic Task Engine**: Loaded in real-time from the database.
- **Verification System**:
  - Follow [@HomiesART](https://x.com/HomiesART) on X
  - Like, Repost & Comment on Pinned Post
  - EVM Wallet Address submission
- **Status Sync**: Automatically pauses when set in Admin Panel.
- **Instant Feedback**: Real-time error highlight and submission confirmation.

### ⚡ Mission Control Admin Panel (`admin.html`)
- **PIN Protected Access**: Security PIN authentication (Default: `homies2026`).
- **Live Metrics Dashboard**: Real-time counters for Total Applications, Approved, Pending, Rejected, and Active Quests.
- **Status Switch**: Instant toggle between Open and Paused for whitelist applications.
- **Applications & Proofs Management**:
  - Filter by status (`All`, `Pending`, `Approved`, `Rejected`)
  - Real-time search across wallet addresses, handles, and IDs
  - Inline and bulk status updates (`Approve`, `Reject`, `Delete`)
  - Applicant Proof Details modal
- **Quests & Tasks Manager**:
  - Create new tasks (Twitter Follow, Engagement, Wallet, Discord, or Custom)
  - Edit and reorder tasks (move up / move down)
  - Toggle required vs optional tasks
- **Export & Import Hub**:
  - Download all applications and proofs as `.csv`
  - 1-Click copy approved EVM wallet addresses (Newline, Comma, or JSON Array format)
  - Full database JSON backup and restore
  - Drag-and-drop CSV importer

---

## 🛠️ Tech Stack
- **HTML5 & Vanilla CSS3**: Highly optimized, responsive, and framework-free.
- **JavaScript (ES6+)**: Modular client-side storage architecture (`HomiesDB`).
- **No external heavy dependencies**: Fast load times with zero build step required.

---

## 💻 Running Locally

You can serve the files with any static HTTP server. For example, using Python:

```bash
# Python 3
python3 -m http.server 3000
```

Then visit:
- **Public Site**: [http://localhost:3000](http://localhost:3000)
- **Admin Panel**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html) *(Default PIN: `homies2026`)*

---

## 📜 License
© 2026 Homies Crew. All rights reserved.
