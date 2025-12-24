# 🚀 Phase 1 Complete - Setup Guide

## ✅ What Was Created

Phase 1 scaffold is complete with the following structure:

```
Marketplace AI Assistant/
├── extension/
│   ├── src/
│   │   ├── background/
│   │   │   ├── background.ts          ✅ Service worker entry point
│   │   │   ├── api-client.ts          ✅ API client stub (Phase 3)
│   │   │   └── token-manager.ts       ✅ JWT token manager stub (Phase 3)
│   │   ├── content/
│   │   │   ├── content.ts             ✅ Content script entry point
│   │   │   ├── facebook-adapter.ts    ✅ DOM parser stub (Phase 2)
│   │   │   ├── dom-watcher.ts         ✅ MutationObserver stub (Phase 2)
│   │   │   └── ui-injector.ts         ✅ Shadow DOM injector stub (Phase 2)
│   │   ├── ui/
│   │   │   └── AssistantPanel.tsx     ✅ Main UI component stub (Phase 2)
│   │   ├── store/
│   │   │   └── use-store.ts           ✅ Zustand store (Phase 2)
│   │   ├── types/
│   │   │   └── index.ts               ✅ Complete type definitions
│   │   └── utils/
│   │       └── logger.ts              ✅ Structured logging utility
│   ├── public/
│   │   └── icons/                     ⚠️ Placeholder icons (add real ones)
│   ├── manifest.json                  ✅ Manifest V3 configuration
│   ├── vite.config.ts                 ✅ Build configuration
│   ├── tsconfig.json                  ✅ TypeScript strict mode
│   ├── package.json                   ✅ Dependencies defined
│   ├── .eslintrc.cjs                  ✅ ESLint configuration
│   ├── .env.example                   ✅ Environment variables template
│   └── popup.html                     ✅ Extension popup UI
├── README.md                          ✅ Project documentation
└── .gitignore                         ✅ Git ignore rules
```

## 📦 Installation & Setup

### Step 1: Install Dependencies

```bash
cd extension
npm install
```

This will install:
- ✅ preact@^10.19.3
- ✅ zustand@^4.4.7
- ✅ vite@^5.0.10
- ✅ typescript@^5.3.3
- ✅ @preact/preset-vite@^2.8.1
- ✅ @types/chrome@^0.0.256
- ✅ And all other dev dependencies

### Step 2: Generate Icon Files

The extension needs actual PNG icon files. For now, create simple placeholders:

```bash
cd extension/public/icons

# Option 1: Use ImageMagick (if installed)
convert -size 16x16 xc:#1877f2 icon16.png
convert -size 32x32 xc:#1877f2 icon32.png
convert -size 48x48 xc:#1877f2 icon48.png
convert -size 128x128 xc:#1877f2 icon128.png

# Option 2: Manually create using any image editor
# Create 16x16, 32x32, 48x48, 128x128 PNG files with your logo
```

### Step 3: Build Extension

```bash
# Development build with watch mode
npm run dev

# Or production build
npm run build
```

Build output will be in `extension/dist/`

### Step 4: Load in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `extension/dist` folder
5. Extension should now appear in your extensions list

### Step 5: Test Basic Functionality

1. Navigate to: `https://www.facebook.com/marketplace/`
2. Open browser console (F12) → Check for initialization messages
3. Click extension icon → Should see popup with "Phase 1: Extension scaffold complete"

Expected console output:
```
[2024-12-24T...] [INFO] Background service worker loaded
[2024-12-24T...] [INFO] Extension installed/updated
```

## 🔍 Validation Checklist

Run these commands to validate the setup:

```bash
cd extension

# Type checking
npm run type-check
# Expected: Type errors in stubs (normal for Phase 1)

# ESLint
npm run lint
# Expected: Some warnings for unimplemented stubs

# Build
npm run build
# Expected: Successful build in dist/
```

## ⚠️ Expected Type Errors (Phase 1)

The following type errors are **expected** and will be resolved in Phase 2:

- `Cannot find module 'preact'` - Will resolve after `npm install`
- `Cannot find module 'zustand'` - Will resolve after `npm install`
- `'handleXYZ' is declared but its value is never read` - Stub functions for Phase 2
- Import path `.ts` extension warnings - Will resolve in Phase 2 implementation

These are intentional stubs marked with `// TODO Phase 2` comments.

## 📝 Phase 2 Implementation Checklist

Once Phase 1 is validated, proceed to Phase 2:

### Facebook Adapter (`src/content/facebook-adapter.ts`)
- [ ] Implement `extractThreadContext()` - Parse thread from DOM
- [ ] Implement `findMessageInput()` - Locate message input element
- [ ] Implement `insertDraftMessage()` - Populate draft (no auto-send)
- [ ] Add selector fallback logic (XPath, ARIA)
- [ ] Test on live Facebook Marketplace inbox

### DOM Watcher (`src/content/dom-watcher.ts`)
- [ ] Set up MutationObserver for DOM changes
- [ ] Detect thread view changes in Facebook's SPA
- [ ] Monitor URL changes (pushState/replaceState)
- [ ] Emit events on thread navigation
- [ ] Wait for DOM stability before parsing

### UI Injector (`src/content/ui-injector.ts`)
- [ ] Create Shadow DOM container for CSS isolation
- [ ] Mount Preact component inside Shadow DOM
- [ ] Position panel near Facebook message input
- [ ] Handle re-injection on SPA navigation
- [ ] Add cleanup logic

### Assistant Panel (`src/ui/AssistantPanel.tsx`)
- [ ] Connect to Zustand store for state
- [ ] Display AI suggestion text
- [ ] Show intent score indicator
- [ ] Implement "Use Reply" button
- [ ] Implement "Edit Draft" button
- [ ] Implement "Dismiss" button
- [ ] Add loading spinner state
- [ ] Add error message display

### Content Script (`src/content/content.ts`)
- [ ] Initialize DOMWatcher on page load
- [ ] Initialize FacebookAdapter
- [ ] Initialize UIInjector
- [ ] Set up message listener from background
- [ ] Handle thread context extraction requests

## 🐛 Troubleshooting

### Extension Not Loading
- Check `chrome://extensions/` for error messages
- Verify `dist/manifest.json` exists and is valid
- Check Console for service worker errors

### Type Errors After npm install
- Run `npm run type-check` to see remaining errors
- Stub functions with "not implemented" are expected
- Unused variables prefixed with `_` are intentional

### Build Fails
- Ensure Node.js 20+ is installed: `node --version`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for syntax errors: `npm run lint`

### Icons Not Showing
- Verify icon PNG files exist in `public/icons/`
- Check manifest.json paths are correct
- Reload extension after adding icons

## 🎯 Next Steps

1. ✅ Validate Phase 1 setup with checklist above
2. 🔄 Generate actual icon files (replace placeholders)
3. 🔄 Begin Phase 2: Implement `FacebookAdapter.extractThreadContext()`
4. 🔄 Test on live Facebook Marketplace inbox page
5. ⏳ Phase 3: Backend foundation (Fastify + Postgres + Redis)

## 📚 Key Files to Review Before Phase 2

| File | Purpose | Review This |
|------|---------|-------------|
| `src/types/index.ts` | Type definitions | All interfaces, especially `ThreadContext`, `Message`, `Suggestion` |
| `src/content/facebook-adapter.ts` | DOM parsing logic | Selector strategy, fallback handling |
| `src/content/dom-watcher.ts` | Navigation detection | MutationObserver setup, event emission |
| `src/ui/AssistantPanel.tsx` | UI component | Component structure, state management |
| `manifest.json` | Extension config | Permissions, content script matching |

## 🔒 Security Reminders

Before proceeding to Phase 2:
- ✅ Never commit `.env` file (use `.env.example` template)
- ✅ No hardcoded secrets in code
- ✅ All API calls go through background script
- ✅ User must explicitly click Send button (no auto-send)
- ✅ Rate limiting will be enforced in Phase 3

---

**Phase 1 Status: ✅ COMPLETE**

Ready to proceed to Phase 2 - Facebook DOM Integration
