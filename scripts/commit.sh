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

# Process each changed file
for file in $changed_files; do
    # Get file type and changes
    file_type=$(echo $file | awk -F. '{print $NF}')
    changes=$(git diff --staged $file 2>/dev/null || git diff $file)
    
    # Generate message based on file type and content
    case $file in
        src/util/etl-*.js)
            org=$(echo $file | sed 's/src\/util\/etl-\(.*\)\.js/\1/' | tr '[:lower:]' '[:upper:]')
            if echo "$changes" | grep -q "async function"; then
                commit_message+="$org ETL function updates, "
            elif echo "$changes" | grep -q "console.log"; then
                commit_message+="$org ETL logging updates, "
            elif echo "$changes" | grep -q "try.*catch"; then
                commit_message+="$org ETL error handling, "
            else
                commit_message+="$org ETL updates, "
            fi
            ;;
        src/routes/*.js)
            route=$(echo $file | sed 's/src\/routes\/\(.*\)\.js/\1/')
            if echo "$changes" | grep -q "router.get\|router.post"; then
                commit_message+="$route API endpoint updates, "
            else
                commit_message+="$route route updates, "
            fi
            ;;
        src/views/*.ejs)
            view=$(echo $file | sed 's/src\/views\/\(.*\)\.ejs/\1/')
            if echo "$changes" | grep -q "style"; then
                commit_message+="$view template styling updates, "
            elif echo "$changes" | grep -q "script"; then
                commit_message+="$view template script updates, "
            else
                commit_message+="$view template updates, "
            fi
            ;;
        migrations/*.sql)
            if echo "$changes" | grep -q "CREATE TABLE"; then
                commit_message+="New table creation, "
            elif echo "$changes" | grep -q "ALTER TABLE"; then
                commit_message+="Table schema updates, "
            else
                commit_message+="Database schema updates, "
            fi
            ;;
        scripts/*.sh)
            commit_message+="Script updates, "
            ;;
        *)
            commit_message+="Other updates, "
            ;;
    esac
done

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