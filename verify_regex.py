import re

# The problematic markdown case provided by the user (reconstructed)
# List item with indented definition
markdown_input = """
- Item 1
- Item 2

[^unc-w73td6]: <!-- druide:decision:id=w73td6 druide:decision:description="hello" druide:decision:anchor="Item 1
- Item 2" -->
"""

# The regexes we are using in script.js (translated to Python regex)
# Javascript: /\s*\[\^unc-[a-zA-Z0-9-]+\]:\s*<!--[\s\S]*?-->\s*/gm
# Python needs re.DOTALL (s) flag for [\s\S] equivalent or just use . with DOTALL
# We will use the exact logic: remove definition, then remove marker.

# 1. Remove Definition
# JS Regex: /\s*\[\^unc-[a-zA-Z0-9-]+\]:\s*<!--[\s\S]*?-->\s*/
# We use re.sub with multiline
# \s* at start matches newlines or indentation
regex_def = r'\s*\[\^unc-[a-zA-Z0-9-]+\]:\s*<!--.*?-->\s*'

# Python's dot doesn't match newline by default, so we use re.DOTALL
clean_md = re.sub(regex_def, '', markdown_input, flags=re.DOTALL)

# 2. Remove Markers (none in this snippet, but for completeness)
regex_marker = r'\[\^unc-[a-zA-Z0-9-]+\]'
clean_md = re.sub(regex_marker, '', clean_md)

print("--- ORIGINAL ---")
print(markdown_input)
print("--- CLEANED ---")
print(f"'{clean_md}'")

if "-->" in clean_md:
    print("\nFAIL: Artifact '-->' found.")
else:
    print("\nSUCCESS: No artifacts found.")
