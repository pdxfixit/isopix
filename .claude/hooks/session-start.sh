#!/bin/bash
# Cloud sessions only: tools/cloud_setup.sh (just, wrangler, git settings,
# flarepress). On the owner's Mac this does nothing.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
exec "$CLAUDE_PROJECT_DIR/tools/cloud_setup.sh"
