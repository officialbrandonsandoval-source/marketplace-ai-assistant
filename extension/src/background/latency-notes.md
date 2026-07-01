# Latency Wiring Notes

`src/background/suggestion-cache.ts` is the first production latency module.

Wire it into `background.ts` like this once existing-file updates are available:

```ts
import { SuggestionCache, stableSuggestionCacheKey } from './suggestion-cache.ts';

const suggestionCache = new SuggestionCache<SuggestionResponse>({
  ttlMs: 5 * 60 * 1000,
  maxEntries: 100,
});
```

Then wrap the network path in `handleSuggestionRequest`:

```ts
const cacheKey = stableSuggestionCacheKey(requestPayload);
return suggestionCache.getOrCreate(cacheKey, () => fetchSuggestionFromApi(requestPayload));
```

`fetchSuggestionFromApi` should contain the current `getAccessTokenOrLogin`, `createSuggestionJob`, and polling flow.

Also shorten the first poll delay:

- 150 ms
- 300 ms
- 600 ms
- 1000 ms repeating after that

This makes fast backend completions visible almost immediately and prevents duplicate backend jobs when users click Generate more than once.
