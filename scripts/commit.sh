#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting automated git commit process...${NC}"

# Check if there are any changes
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${RED}No changes to commit.${NC}"
    exit 0
fi

# Get the list of changed files
changed_files=$(git status --porcelain | awk '{print $2}')

# Initialize commit message
commit_message="Update: "

# Check for specific file changes and add to commit message
if echo "$changed_files" | grep -q "src/util/etl-"; then
    etl_files=$(echo "$changed_files" | grep "src/util/etl-")
    for file in $etl_files; do
        org=$(echo $file | sed 's/src\/util\/etl-\(.*\)\.js/\1/' | tr '[:lower:]' '[:upper:]')
        commit_message+="$org ETL, "
    done
fi

if echo "$changed_files" | grep -q "src/routes/status.js"; then
    commit_message+="Status page, "
fi

if echo "$changed_files" | grep -q "src/views/status.ejs"; then
    commit_message+="Status page template, "
fi

if echo "$changed_files" | grep -q "migrations/"; then
    commit_message+="Database migrations, "
fi

# Remove trailing comma and space
commit_message=${commit_message%, }

# Add timestamp
commit_message+=" - $(date '+%Y-%m-%d %H:%M:%S')"

# Add all changes
echo -e "${YELLOW}Adding all changes...${NC}"
git add .

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "$commit_message"

# Push changes
echo -e "${YELLOW}Pushing changes to remote...${NC}"
git push

# Check if push was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully committed and pushed changes with message:${NC}"
    echo -e "${GREEN}$commit_message${NC}"
else
    echo -e "${RED}Failed to push changes. Please check your git configuration.${NC}"
    exit 1
fi 