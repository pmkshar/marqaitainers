#!/usr/bin/env bash
# =============================================================================
# push-to-github.sh — Push code + wiki to https://github.com/pmkshar/marqaitainers
#
# Prerequisites:
#   1. Git configured with your name + email
#   2. GitHub authentication set up (HTTPS PAT or SSH key)
#      - HTTPS: git config --global credential.helper store
#               then `git push` once and enter PAT as password
#      - SSH:   git remote set-url origin git@github.com:pmkshar/marqaitainers.git
#
# Usage:
#   ./scripts/push-to-github.sh           # commit + push code + push wiki
#   ./scripts/push-to-github.sh --code    # commit + push code only
#   ./scripts/push-to-github.sh --wiki    # push wiki only
# =============================================================================

set -e

REPO_URL="https://github.com/pmkshar/marqaitainers.git"
WIKI_REPO_URL="https://github.com/pmkshar/marqaitainers.wiki.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

# -----------------------------------------------------------------------------
# Step 1: Commit and push the main code repository
# -----------------------------------------------------------------------------
if [[ "$1" == "" || "$1" == "--code" ]]; then
  echo "==> [Code] Staging changes..."
  git add -A
  git status --short

  if git diff --cached --quiet; then
    echo "==> [Code] No changes to commit."
  else
    echo "==> [Code] Committing..."
    git commit -m "$(cat <<'EOF'
feat: Marq AI Software Tutor — full WPLMS-parity platform

- Rebranded to "Marq AI Software Tutor" across navbar, footer, hero, metadata, manifest
- 5 on-demand courses with modules, lessons, step-wise training, quizzes
- AI tutor (24/7 LLM chat, course-aware context, streaming via z-ai-web-dev-sdk)
- Human tutor marketplace (apply → admin approve → book → live session)
- 3 pricing tiers (monthly, annual, per-course) + mock checkout
- Role-aware dashboards (candidate, tutor, admin) shown after login
- 13-tab super admin portal (users, courses, pricing, tutors, integrations, roles,
  audit, certificate builder, registration forms, email scheduling, analytics, GDPR)
- PWA support (manifest, service worker, offline app-shell, installable)
- Real-time notifications (in-app + browser push, deep-link navigation)
- Activity tracking (15 kinds), certificates with validation codes, badges (11 types, 4 tiers)
- Discussions, notes, announcements, assignments with grading
- Members directory, friends, groups, direct messages, calendar
- Course categories, bundles, subscriptions, expiration
- 14 third-party integrations (Zoom, BBB, Jitsi, Moodle, Stripe, SendGrid, GA4, etc.)
- GDPR export bundles + right-to-erasure + consent log
- Deep analytics (KPIs, 8-week series, conversion funnel, top courses)
- Custom registration forms per role (10 field kinds)
- Email scheduling (8 automated drip types with {{vars}} templates)
- Drag-drop certificate builder (10 element types)
- 4-role RBAC with editable permission matrix (20 permissions)
- Full documentation: docs/ + wiki/ (technical, role-wise SOPs, module-wise SOPs,
  requirements spec, feature inventory, API reference, DB schema, testing checklist)

Tech: Next.js 16 + TypeScript 5 + Tailwind 4 + shadcn/ui + Zustand 5 +
      z-ai-web-dev-sdk + react-syntax-highlighter
EOF
)"

    echo "==> [Code] Pushing to $REPO_URL ..."
    git push -u origin main
  fi
fi

# -----------------------------------------------------------------------------
# Step 2: Push the wiki content as a separate git repo
# -----------------------------------------------------------------------------
if [[ "$1" == "" || "$1" == "--wiki" ]]; then
  echo "==> [Wiki] Preparing wiki/ directory..."
  WIKI_TMP="$(mktemp -d)"
  cp "$ROOT"/wiki/*.md "$WIKI_TMP/"

  cd "$WIKI_TMP"
  git init -b main
  git add -A
  git commit -m "wiki: Marq AI Software Tutor — full documentation set

- Home — overview + TOC
- Technical-Architecture — stack, file tree, state, routing, PWA, AI tutor, RBAC
- Requirements-Specification — complete PRD with 100+ functional requirements
- Role-wise-SOPs — Candidate, Human Tutor, AI Tutor, Super Admin, Guest
- Module-wise-SOPs — 18 modules documented
- API-Reference — /api/tutor endpoint contract + future endpoints
- Database-Schema — all 27 entities + relationships
- Setup-and-Deployment — local, prod, Vercel, Docker, Caddy
- Feature-Inventory — 48 WPLMS-parity features audit (41 live, 7 roadmap)
- Testing-Checklist — 18-section manual test scenarios"

  # Try to push; if the wiki repo doesn't exist yet, this will fail with a helpful message
  git remote add origin "$WIKI_REPO_URL"
  echo "==> [Wiki] Pushing to $WIKI_REPO_URL ..."
  if git push -u origin main; then
    echo "==> [Wiki] Push succeeded."
  else
    echo "==> [Wiki] Push FAILED. The wiki repo may not exist yet."
    echo "    Create it by visiting https://github.com/pmkshar/marqaitainers/wiki"
    echo "    (click 'Create the first page' — even an empty page initializes the wiki repo)."
    echo "    Then re-run: ./scripts/push-to-github.sh --wiki"
  fi

  rm -rf "$WIKI_TMP"
fi

echo "==> Done."
