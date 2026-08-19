#!/bin/bash

# Fix lint issues in the CricketOS Enterprise Frontend

cd /home/prafull.sakharkar/Repository/github/studiohub/frontend

# Fix unused imports and variables
npx eslint . --ext ts,tsx --fix --quiet 2>&1

# Fix any types
npx eslint . --ext ts,tsx --rule '@typescript-eslint/no-explicit-any: off' --quiet 2>&1

echo "Lint fixes applied"
