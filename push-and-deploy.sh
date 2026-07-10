#!/bin/bash
set -e
cd ~/Documents/showup

# Initialize git if needed
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

# Set remote (safe to run again if already set)
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/geovanna-glitch/showup.git

# Stage and commit everything
git add -A
git commit -m "Initial commit: ShowUp MVP" 2>/dev/null || echo "Nothing new to commit"

# Push
git push -u origin main --force

echo ""
echo "Done! Code is on GitHub."
echo "Now go to vercel.com, click Add New Project, and import geovanna-glitch/showup"
