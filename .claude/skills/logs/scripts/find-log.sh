#!/bin/bash
# Locates the file (if any) currently receiving stdout/stderr from a running
# `mastra dev` or `.mastra/output/index.mjs` process. Child processes spawned
# by `mastra dev` pipe their output back to the parent over a unix socket, so
# this walks up the parent chain until it finds an fd pointing at a REG file.
set -uo pipefail

MAX_HOPS=6

resolve_log_for_pid() {
  local pid="$1"
  local hops=0
  while [ "$hops" -lt "$MAX_HOPS" ] && [ -n "$pid" ] && [ "$pid" != "1" ]; do
    local line
    line=$(lsof -p "$pid" -a -d 1 2>/dev/null | awk 'NR==2')
    local type target
    type=$(echo "$line" | awk '{print $5}')
    target=$(echo "$line" | awk '{print $NF}')
    if [ "$type" = "REG" ] && [ -n "$target" ]; then
      echo "$target"
      return 0
    fi
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    hops=$((hops + 1))
  done
  return 1
}

pids=$(ps aux | grep -E "mastra dev|\.mastra/output/index" | grep -v grep | awk '{print $2}')

if [ -z "$pids" ]; then
  echo "Nenhum processo mastra (dev ou build) rodando no momento."
  echo "Rode 'mastra dev' (ou o build em .mastra/output/index.mjs) antes de analisar logs."
  exit 1
fi

found_any=0
for pid in $pids; do
  cmd=$(ps -p "$pid" -o command= 2>/dev/null | cut -c1-90)
  log=$(resolve_log_for_pid "$pid")
  if [ -n "$log" ]; then
    echo "PID $pid ($cmd)"
    echo "  log: $log"
    found_any=1
  else
    echo "PID $pid ($cmd)"
    echo "  stdout não está redirecionado para um arquivo (rodando num terminal interativo)."
  fi
done

exit 0
