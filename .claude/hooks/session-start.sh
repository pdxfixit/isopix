#!/bin/bash
# Cloud sessions only: tools/cloud_setup.sh (just and git settings;
# no deploy tools). On the owner's Mac this does nothing.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
exec "$CLAUDE_PROJECT_DIR/tools/cloud_setup.sh"
