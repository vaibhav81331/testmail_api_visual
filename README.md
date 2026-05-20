# 📥 InboxFlow - Testmail.app Web Client Dashboard

InboxFlow is a premium, modern, and highly interactive Single Page Application (SPA) dashboard acting as a custom web client for the **Testmail.app** API. It provides a visual interface for developers to retrieve, inspect, copy, and manage test emails in real-time.

---

## ✨ Features

- **⚡ Instant Copy Widget**: The entire header test email widget is clickable. Click anywhere to copy the generated address layout with instant particle confetti and green success feedback.
- **🔄 Real-time Live Synchronization**: Securely syncs with your `testmail.app` inbox using a fully configurable automatic background polling loop.
- **💾 Offline-First Local Persistence**: Testmail deletes emails after 24 hours on standard plans. InboxFlow automatically merges newly fetched emails into a browser-based local cache (`localStorage`), preserving your history forever!
- **💼 Workspace Namespace Isolation**: History cache is automatically partitioned by your active Namespace (e.g. `tm_saved_emails_[namespace]`). Swapping namespaces swaps inbox caches instantly so different client/project workspaces stay clean.
- **🔍 Smart Verification Code (OTP) Extractor**: Automatically scans the subject and body for 4-to-8 digit OTP verification codes and highlights them in a quick-copy developer badge with a celebration animation.
- **🎧 Web Audio Synthesizer Notifier**: Plays a custom, high-fidelity double-chime chime sound built directly with the browser's Web Audio API (no heavy audio files to load) when new emails arrive.
- **🎨 Glassmorphism Theme Engine**: Beautiful, high-contrast Dark Mode (default) and Light Mode. Fully responsive layout adapting from widescreen desktop monitors to mobile phone viewports.
- **📂 Developer Exporter & Backups**: Back up and export your entire inbox or selected views to clean JSON or CSV logs.
- **🛡️ Secure Sandboxed Previews**: Renders rich HTML email bodies within a strictly sandboxed `<iframe>` wrapper. All links are automatically forced to open safely in a new tab (`target="_blank"`).

---

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) & [Vite](https://vite.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations & Effects**: [Canvas Confetti](https://github.com/catdad/canvas-confetti)
- **Styling**: Vanilla CSS variables, responsive grid, flexbox layouts, and custom scrollbars.
- **Notification Engine**: Web Audio API (real-time sinusoidal oscillator waves).

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd intelligent-pythagoras
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```

### Local Development

To start the local Vite development server:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Building for Production

To compile and bundle the static client files:
```bash
npm run build
```
The output assets will be built inside the `dist/` directory.

### Code Quality (Linting)

To run ESLint checking:
```bash
npm run lint
```

---

## ⚙️ Configuration & API Integration

1. Click the **Settings Gear** icon in the top right corner.
2. Enter your **Testmail Namespace** and your **API Key** (retrieved from your Testmail.app dashboard).
3. Click the **Test API Connection** button to verify. Success will show a green indicator.
4. Click **Save Settings**. Your credentials will be saved securely to your browser's local storage and the dashboard will fetch your live emails.
