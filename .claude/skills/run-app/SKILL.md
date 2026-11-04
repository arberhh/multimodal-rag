---
name: run-app
description: Launch and drive this app (the Postgres database, the Fastify server and the One app on web, iOS and Android) for local development, and check a change works end to end. Use when asked to run, start, test or screenshot the app, or to confirm a change works in the real app and not just in tests.
---

# Running this app

Three parts, started in this order:

1. **Postgres with pgvector**, in Docker (`ragchat-db`). pgweb on `127.0.0.1:8082` browses it, read only.
2. **The server**, `apps/server`: Fastify on port 3000. It calls Voyage to embed and Claude to read pages and answer.
3. **The app**, `apps/mobile`: One's dev server on port 8081. It serves both the web app and the native bundle.

## Setup

- **`.env` at the repo root** holds `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY`. Never print the values. To check what is set, show only the names: `grep -oE "^[A-Z_]+" .env`.
- **LibreOffice** turns Word files into PDFs (`brew install --cask libreoffice`). Without it, PDFs and Google Docs still work.
- **`apps/mobile/.env`** has `VITE_SERVER_URL`, the Mac's LAN address, so a phone can reach the server. Without it the app uses `localhost:3000`, or `10.0.2.2:3000` on the Android emulator.

## Launch

```bash
open -a Docker                      # if `docker info` fails: Docker Desktop isn't running
docker compose up -d                # from the repo root
pnpm --filter @multimodal-rag/server migrate
```

Then start each server in its own background tool call (`run_in_background: true` on the bare command). Don't wrap them in `nohup … &`: a job started inside a script dies when the script's call ends.

```bash
cd apps/server && pnpm dev          # tsx watch: restarts on every save
cd apps/mobile && pnpm dev          # One dev server on 8081
```

Wait until both answer, instead of sleeping for a fixed time:

```bash
until [ "$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/health)" = 200 ] &&
      [ "$(curl -s -o /dev/null -w '%{http_code}' localhost:8081)" = 200 ]; do sleep 1; done
```

If a port is already in use, it's usually an earlier run of the same server that's still going. Check it with `lsof -nP -iTCP:3000,8081 -sTCP:LISTEN` before you start another. To stop one: `lsof -ti:<port> -sTCP:LISTEN | xargs -r kill`.

## Check it works

A screen that looks right proves little. The home screen renders even when its data never loads, and the bug this skill was written alongside only showed as a missing Recent chats section. Check each layer.

### 1. The server, with curl

`/health` answers 503 when the database is down. It is the only route that works without a user: every other route needs an `X-Device-Id` header holding a UUID, and answers 401 without one. Make a throwaway user and take it through the whole flow:

```bash
ID=$(uuidgen | tr A-Z a-z); H="X-Device-Id: $ID"
curl -s -F "file=@samples/quarterly-report.pdf;type=application/pdf" localhost:3000/uploads -H "$H"
curl -s localhost:3000/uploads -H "$H"            # repeat until status is "ready" (about 15 s for the sample)
curl -s -G localhost:3000/search --data-urlencode "q=revenue by region" -H "$H"
C=$(curl -s -X POST localhost:3000/conversations -H "$H" | python3 -c "import json,sys; print(json.load(sys.stdin)['conversation']['id'])")
curl -sN -X POST localhost:3000/conversations/$C/messages -H "$H" \
  -H 'content-type: application/json' -d '{"question":"Which region grew fastest?"}'
```

- `samples/` has three PDFs: `quarterly-report.pdf` (a revenue table by region), `travel-policy.pdf` (rules and a limits table) and `product-launch.pdf` (a specs table and a bar chart of pre-orders). A question like "How many pre-orders came in during week 5?" checks that charts are read.
- The answer streams as `text` events, then a `done` event with the sources.
- Voyage's free tier allows 3 requests a minute. Uploading three PDFs uses them up, and the next question fails with a 500 (the log says `Voyage embeddings failed: 429`). Wait a minute before asking.
- Also check that a second device id sees none of it: an empty list, and a 404 for the first user's document and chat.
- Each question and each upload costs a little Claude and Voyage usage, so keep it to a few.

### 2. Web, with Playwright

`web-walkthrough.cjs`, next to this file, goes through home, documents, the chat list, reopening a chat, a follow-up question and New chat. It saves a screenshot of each step and fails on any console error or failed API call. Give it the device id from step 1, so the user has a document and a chat:

```bash
NODE_PATH=$(dirname "$(find ~/.npm/_npx -maxdepth 3 -iname playwright -type d | head -1)") \
  node .claude/skills/run-app/web-walkthrough.cjs "$ID" <screenshot dir>
```

- If `find` turns up nothing, run `npx playwright install chromium` once.
- The script signs in as the user by setting `One.Storage.device-id` in localStorage. One.Storage prefixes its keys with `One.Storage.`.
- Look at the screenshots, don't just count the `ok` lines.

### 3. iOS, on the simulator

The app is already installed on the booted simulator (`dev.arberihh.ragchat`). A dev build loads its bundle from the dev server.

```bash
xcrun simctl terminate booted dev.arberihh.ragchat; xcrun simctl launch booted dev.arberihh.ragchat
# wait for "[hmr] native client connected platform=ios" in the dev server's log
xcrun simctl io booted screenshot <file>.png
```

- The simulator is its own user. To find it, take the newest row in `users` after launching, then give it data through the API with that device id:

  ```bash
  docker exec ragchat-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT device_id, name, created_at FROM users ORDER BY created_at"'
  ```

- **Go to a screen with a link.** The router matches `ragchat://` links like Expo Router does (`native.app.scheme` and `router.linking.scheme` in `apps/mobile/vite.config.ts`):

  ```bash
  xcrun simctl openurl booted "ragchat:///documents"
  xcrun simctl openurl booted "ragchat:///conversations"
  xcrun simctl openurl booted "ragchat:///chat?id=<conversation id>"
  ```

- **The first link shows an "Open in RagChat?" dialog, and nothing can tap it.** Approve the scheme once per simulator, then reboot the simulator. A SpringBoard restart isn't enough, and dialogs from earlier links stay queued until the reboot.

  ```bash
  P=~/Library/Developer/CoreSimulator/Devices/<udid>/data/Library/Preferences/com.apple.launchservices.schemeapproval.plist
  plutil -replace "com\.apple\.CoreSimulator\.CoreSimulatorBridge-->ragchat" -string dev.arberihh.ragchat "$P"
  xcrun simctl shutdown <udid> && xcrun simctl boot <udid>
  ```

- **A change to the scheme or other native settings needs a new build.** Run `pnpm --filter @multimodal-rag/mobile prebuild:native`, then `npx one run:ios --udid <udid>` from `apps/mobile`. Changes to JavaScript only need the dev server.
- There's still no tap tool for the simulator, so on iOS typing and pressing buttons are only checked by hand. Android can be tapped (below).
- **The phone:** `xcrun devicectl device process launch --device <udid> --terminate-existing dev.arberihh.ragchat`. Get the udid from `xcrun devicectl list devices`. There's no screenshot tool for it, so ask the user for one.

### 4. Android, on the emulator

Unlike the simulator, the emulator can be tapped and typed into, with `adb` (in `~/Library/Android/sdk/platform-tools`).

```bash
ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a pnpm android   # builds and installs; the dev server must be running
adb shell am start -a android.intent.action.VIEW -d "ragchat:///documents" dev.arberihh.ragchat
adb exec-out screencap -p > <file>.png
adb shell input tap <x> <y>          # in the screen's pixels: the screenshot's size, not its displayed size
adb shell input text "Hello"
```

- **Build for `arm64-v8a` only.** The full debug APK is 455 MB, and the install fails with "not enough space" on a nearly full emulator.
- **A 16 KB page-size dialog** shows on the first launch on a 16 KB emulator image and covers the app. Tap OK on it before checking the screen.
- **After a JavaScript change**, restart the app (`adb shell am force-stop dev.arberihh.ragchat`, then start it again) if the screen didn't update.
- `adb` can't set the emulator's clipboard, so Paste buttons can't be checked this way.

### 5. Clean up

Remove what the run made: delete the documents through the API first, which also removes their PDFs from `apps/server/uploads/`. Then delete the throwaway users (`DELETE FROM users WHERE device_id = '…'`), which takes their chats with them.

## Gotchas

- **500s on everything, while the app still says Connected:** the database container has stopped. `docker compose up -d` brings it back. `/health` checks the database, so the badge catches up within 30 seconds.
- **One's `useFocusEffect(effect, deps)` takes its deps as the second argument**, unlike React Navigation's, which re-runs when the callback changes. Without the deps it never re-runs when they change. Wrapping the callback in `useCallback` changes nothing. Test mocks must match One's signature, or they hide the bug.
- **`PlatformColor` doesn't exist in react-native-web**, and the page goes blank. Native-only code goes in `*.native.ts` files.
- **SwiftUI and Compose views throw on the wrong platform**, so each screen picks its view by `One.platform`.
- **Before calling a change done**, run the repo checks without `-s`, which hides failures: `pnpm typecheck && pnpm lint && pnpm deadcode && pnpm format:check`, plus both test suites.
