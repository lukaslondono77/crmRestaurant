#!/bin/bash
# Run this script in your own Terminal (not Cursor) to remove Cursor as co-author
# and update GitHub so only you show as contributor.
set -e
cd "$(dirname "$0")"
git commit --amend -m "Initial commit: Cloudignite restaurant cost control (CRM Restaurant)"
git push --force origin main
echo "Done. GitHub should now show only you as contributor."
