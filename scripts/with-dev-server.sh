#!/bin/sh
# Starts the app's dev server, runs the given command once it answers, and keeps the server running.
URL=http://localhost:8081

# anything already answering would pass the wait below, and we'd open the wrong app
if curl -s -o /dev/null "$URL"; then
  echo "Something is already running on $URL. Stop it first." >&2
  exit 1
fi

pnpm dev:mobile &
DEV=$!
trap 'kill $DEV' EXIT INT TERM

until curl -s -o /dev/null "$URL"; do sleep 1; done
"$@"
wait $DEV
