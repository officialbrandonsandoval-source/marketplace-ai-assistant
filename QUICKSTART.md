# 🚀 Quick Start - Chrome Extension Development

## Load Extension in Chrome

```bash
# 1. Open Chrome
chrome://extensions/

# 2. Enable "Developer mode" (top-right toggle)

# 3. Click "Load unpacked"

# 4. Select this folder:
/Users/brandonsandoval/Marketplace AI Assistant/extension/dist
```

## Development Workflow

```bash
cd extension

# Watch mode (rebuilds on file changes)
npm run dev

# Then in Chrome:
# - Go to chrome://extensions/
# - Click reload icon on your extension
# - Test changes on facebook.com/marketplace
```

## Test on Facebook

```
1. Open: https://www.facebook.com/marketplace/you/selling
2. Open DevTools (F12) → Console tab
3. Look for: [INFO] Content script initialized
4. Click on any conversation thread
```

## Project Structure Quick Reference

```
src/
├── background/     → Service worker (API calls, tokens)
├── content/        → Facebook page integration
├── ui/             → Preact components (Shadow DOM)
├── store/          → Zustand state management
├── types/          → TypeScript definitions
└── utils/          → Helpers (logger, etc.)
```

## Common Commands

```bash
npm run build          # Production build
npm run dev            # Development build (watch mode)
npm run type-check     # Check TypeScript errors
npm run lint           # Run ESLint
```

## Phase 2 Implementation Order

1. ✅ **Scaffold** (Phase 1 - DONE)
2. 🔄 **Facebook DOM Integration** (Phase 2 - NEXT)
   - `facebook-adapter.ts` → Extract thread context
   - `dom-watcher.ts` → Monitor page changes
   - `ui-injector.ts` → Inject UI panel
   - `AssistantPanel.tsx` → Build UI
3. ⏳ **Backend API** (Phase 3)
4. ⏳ **LLM Integration** (Phase 4)
5. ⏳ **End-to-End** (Phase 5)

## Debug Tips

**Extension not loading?**
```bash
# Rebuild and check for errors
npm run build

# Check manifest is valid
cat dist/manifest.json
```

**Console shows errors?**
```bash
# Check Chrome extension console
chrome://extensions/ → Click "Errors" button on your extension
```

**Changes not appearing?**
```bash
# Reload extension
chrome://extensions/ → Click reload icon

# Or press Cmd+R on chrome://extensions/ page
```

## Important Files

| File | Edit to... |
|------|-----------|
| `src/content/content.ts` | Add page detection logic |
| `src/content/facebook-adapter.ts` | Parse Facebook DOM |
| `src/ui/AssistantPanel.tsx` | Build UI components |
| `src/types/index.ts` | Add new types |
| `manifest.json` | Change permissions |

## Security Reminders

- ❌ Never auto-click Send button
- ✅ User must explicitly send messages
- ✅ All API calls through background script
- ✅ Tokens in chrome.storage.local
- ✅ Rate limiting enforced

---

**Current Status:** Phase 1 ✅ Complete  
**Next:** Implement `FacebookAdapter.extractThreadContext()`
