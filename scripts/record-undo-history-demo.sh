#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-/opt/cursor/artifacts/undo-history-panel-demo.mp4}"
PORT=8765
DUR=35

HTTP_PID=""
CHROME_PID=""
FF_PID=""

cd /workspace/excalidraw-app/build
python3 -m http.server "${PORT}" >/tmp/http-undo-demo.log 2>&1 &
HTTP_PID=$!

cleanup() {
  kill "${HTTP_PID}" 2>/dev/null || true
  kill "${CHROME_PID}" 2>/dev/null || true
  kill "${FF_PID}" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$(dirname "${OUT}")"

sleep 0.8

google-chrome --no-sandbox --disable-gpu \
  --window-size=1280,800 --window-position=0,0 \
  "http://127.0.0.1:${PORT}/" &
CHROME_PID=$!

sleep 10

WID=$(xdotool search --onlyvisible --class "Google-chrome" 2>/dev/null | head -1 || true)
if [[ -z "${WID}" ]]; then
  WID=$(xdotool search --onlyvisible --class "google-chrome" 2>/dev/null | head -1 || true)
fi
if [[ -n "${WID}" ]]; then
  xdotool windowactivate --sync "${WID}" 2>/dev/null || true
  xdotool windowfocus --sync "${WID}" 2>/dev/null || true
fi

ffmpeg -y -f x11grab -video_size 1280x800 -framerate 12 \
  -i "${DISPLAY}+0,0" -t "${DUR}" \
  -codec:v libx264 -pix_fmt yuv420p -preset veryfast \
  "${OUT}" &
FF_PID=$!

sleep 1.5

# Focus editor (tab targets excalidraw container when page has focus)
xdotool key Tab
sleep 0.2

# Focus canvas / editor
xdotool mousemove --sync 640 420 click 1
sleep 0.4

# Rectangle tool (R), then draw two rectangles
xdotool key r
sleep 0.25
xdotool mousemove --sync 380 340
sleep 0.1
xdotool mousedown 1
xdotool mousemove --sync 560 460
xdotool mouseup 1
sleep 0.5

xdotool key r
sleep 0.25
xdotool mousemove --sync 620 300
sleep 0.1
xdotool mousedown 1
xdotool mousemove --sync 820 440
xdotool mouseup 1
sleep 0.6

# Main menu (hamburger)
xdotool mousemove --sync 28 34 click 1
sleep 0.9

# Undo history item (below Search in default app menu)
xdotool mousemove --sync 132 268 click 1
sleep 2.5

# Hover earlier step in list (left column of dialog) to show preview
xdotool mousemove --sync 1180 300
sleep 1.2
xdotool mousemove --sync 1180 380
sleep 1.2
xdotool mousemove --sync 1180 460
sleep 1.0

# Back to canvas area then close
xdotool mousemove --sync 200 200
sleep 0.4
xdotool key Escape
sleep 1.2

wait "${FF_PID}" || true
