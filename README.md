# Facebook Marketplace AI Assistant - Chrome Extension

**Production-grade Chrome Extension + SaaS backend for AI-assisted conversation replies**

## 🎯 Project Overview

AI-powered assistant for Facebook Marketplace sellers with human-in-the-loop safety. The extension suggests intelligent replies to buyer messages while maintaining full user control (no auto-send).

## 🏗️ Architecture

- **Extension**: Manifest V3 + Preact + TypeScript
- **Backend**: Node.js + Fastify + Postgres + Redis (Phase 3+)
- **LLM**: Claude API integration (Phase 4+)
- **Mode**: HUMAN-CLICK by default (AI drafts, user sends)

## 📁 Project Structure

```
extension/
├── src/
│   ├── background/        # Service worker (API client, token management)
│   ├── content/          # Facebook DOM integration
│   ├── ui/               # Preact components (Shadow DOM)
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Logging, helpers
├── public/               # Extension assets
├── manifest.json         # Chrome Extension manifest V3
└── vite.config.ts        # Build configuration
```

## 🚀 Development Phases

### ✅ Phase 1 - Extension Scaffold (COMPLETED)
- Project structure
- TypeScript configuration
- Type definitions
- Entry points (stubs)

### 🔄 Phase 2 - Facebook DOM Integration (NEXT)
- DOM parsing and thread context extraction
- MutationObserver for SPA navigation
- Shadow DOM UI injection
- Draft message insertion (no auto-send)

### 📋 Phase 3 - Backend Foundation
- Fastify API server
- Postgres + Drizzle ORM
- JWT authentication
- Rate limiting (Redis)

### 🤖 Phase 4 - LLM Integration
- Claude API client
- BullMQ async job queue
- Prompt engineering
- Token usage tracking

### 🔗 Phase 5 - End-to-End Flow
- Complete suggestion pipeline
- Polling/SSE for job results
- Booking widget (appointment scheduling)

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 20+ LTS
- npm 10+

### Install Dependencies

```bash
cd extension
npm install
```

### Build Extension

```bash
# Development build (with watch)
npm run dev

# Production build
npm run build
```

### Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

## 🔧 Development

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Project Structure
- All TypeScript files use strict mode (no `any` types)
- Imports use `.ts`/`.tsx` extensions
- ESM modules throughout
- Shadow DOM for CSS isolation

## 📝 Phase 2 Implementation Checklist

### Facebook Adapter (`src/content/facebook-adapter.ts`)
- [ ] Parse thread ID from URL/DOM
- [ ] Extract listing data from listing card
- [ ] Extract message history
- [ ] Get participant name
- [ ] Implement selector fallbacks (XPath, ARIA)

### DOM Watcher (`src/content/dom-watcher.ts`)
- [ ] Set up MutationObserver
- [ ] Detect thread view changes
- [ ] Monitor URL changes (SPA navigation)
- [ ] Emit thread change events

### UI Injector (`src/content/ui-injector.ts`)
- [ ] Create Shadow DOM container
- [ ] Mount Preact component
- [ ] Position panel near message input
- [ ] Handle cleanup on navigation

### Assistant Panel (`src/ui/AssistantPanel.tsx`)
- [ ] Connect to Zustand store
- [ ] Display AI suggestion
- [ ] Show intent score indicator
- [ ] Implement action buttons
- [ ] Loading/error states

## 🔒 Security Principles

- **No auto-send**: User must explicitly click Send button
- **Rate limiting**: Free tier = 10 suggestions/day
- **Multi-tenant**: account_id on every entity
- **Audit logging**: Every action logged
- **Token security**: JWT in chrome.storage.local
- **No hardcoded secrets**: Environment variables only

## 📚 Tech Stack

| Component | Technology |
|-----------|-----------|
| Extension Build | Vite 5+ |
| UI Framework | Preact (not React) |
| State Management | Zustand |
| Type Safety | TypeScript (strict) |
| CSS Isolation | Shadow DOM |
| Background | Service Worker (Manifest V3) |

## ⚠️ Important Notes

- **Manifest V3**: No persistent background page (service worker only)
- **Facebook Selectors**: Stored in backend config (not hardcoded)
- **Rate Limits**: Conservative by default to avoid Meta bans
- **Error Handling**: All promises have `.catch()` or try/catch
- **Logging**: Structured logging with Pino-like format

## 🎯 Next Steps

After completing Phase 1 scaffold, proceed to Phase 2:

1. Implement `FacebookAdapter.extractThreadContext()`
2. Set up `DOMWatcher` with MutationObserver
3. Inject `AssistantPanel` via Shadow DOM
4. Test on Facebook Marketplace inbox

## 📄 License

Proprietary - All rights reserved

---

**Built with production-grade standards from day one.**
