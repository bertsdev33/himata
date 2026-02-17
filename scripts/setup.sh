#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOKS_DIR="${REPO_ROOT}/.githooks"

log() {
  printf '[setup] %s\n' "$1"
}

warn() {
  printf '[setup] WARNING: %s\n' "$1" >&2
}

fail() {
  printf '[setup] ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || fail "Missing required command: ${cmd}"
}

assert_repo_root() {
  git -C "${REPO_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Run this inside a git repository."
}

require_hook_templates() {
  local pre_commit_hook="${HOOKS_DIR}/pre-commit"

  [ -d "${HOOKS_DIR}" ] || fail "Missing hooks directory: ${HOOKS_DIR}"
  [ -f "${pre_commit_hook}" ] || fail "Missing pre-commit hook template: ${pre_commit_hook}"
}

make_hooks_executable() {
  chmod +x "${HOOKS_DIR}"/* 2>/dev/null || true
}

configure_hooks_path() {
  git -C "${REPO_ROOT}" config core.hooksPath .githooks
  log "Configured git hooks path to .githooks"
}

verify_hooks_path() {
  local configured_path
  configured_path="$(git -C "${REPO_ROOT}" config --get core.hooksPath || true)"
  [ "${configured_path}" = ".githooks" ] || fail "Expected core.hooksPath=.githooks, got '${configured_path}'"
}

print_optional_tools_notice() {
  if ! command -v codex >/dev/null 2>&1; then
    warn "Codex CLI not found. Pre-commit review will fail until Codex CLI is installed."
  else
    log "Codex CLI detected."
  fi
}

run_step() {
  local name="$1"
  shift
  log "${name}"
  "$@"
}

print_summary() {
  cat <<'EOF'
[setup] Done.
[setup] Local git hooks are configured for this repository.
[setup] Pre-commit now runs Codex review against staged changes.
EOF
}

main() {
  run_step "Checking required commands" require_command git
  run_step "Verifying repository root" assert_repo_root
  run_step "Validating hook templates" require_hook_templates
  run_step "Making hook files executable" make_hooks_executable
  run_step "Configuring git hooks path" configure_hooks_path
  run_step "Verifying git hooks path" verify_hooks_path
  run_step "Checking optional tools" print_optional_tools_notice
  print_summary
}

main "$@"
