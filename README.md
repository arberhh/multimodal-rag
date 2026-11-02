# Multimodal RAG — Chat with PDFs

pnpm monorepo: `apps/mobile` ([One](https://onestack.dev) / React Native) and `apps/server` (Fastify).

```sh
pnpm install
pnpm dev:server          # http://localhost:3000/health
pnpm dev:mobile          # web + dev server
pnpm run:web             # same, and opens http://localhost:8081
pnpm --filter @multimodal-rag/mobile prebuild:native
pnpm ios                 # or: pnpm android
```

The app calls `GET /health` and shows Connected / Not connected. Android emulator uses `10.0.2.2` automatically;
on a physical phone set `VITE_SERVER_URL=http://<your-LAN-ip>:3000` in `apps/mobile/.env`.
