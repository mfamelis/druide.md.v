/**
 * DRUIDE Uncertainty Notebook - Footnote Architecture
 */

// --- State ---
let knowledgeBase = {};
let currentMode = 'edit'; // 'edit' | 'author' | 'reader'
let lastMarkdown = "";

// --- DOM Elements ---
const editorEdit = document.getElementById('editor-edit'); // Textarea
const editorPreview = document.getElementById('editor-preview'); // Div
const sidebar = document.getElementById('sidebar');
const sidebarList = document.getElementById('items-list');
const itemCountSpan = document.getElementById('item-count');

const btnModeEdit = document.getElementById('btn-mode-edit');
const btnModeAuthor = document.getElementById('btn-mode-author');
const btnModeReader = document.getElementById('btn-mode-reader');
const btnViewKb = document.getElementById('btn-view-kb');

const toolbar = document.getElementById('selection-toolbar');

// Modal Elements: Creation
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input-text');
const modalSnippet = document.getElementById('modal-snippet');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');
const btnCloseModal = document.getElementById('btn-close-modal');

// Toolbar Buttons
const btnUncertainty = document.getElementById('btn-create-uncertainty');
const btnDecision = document.getElementById('btn-create-decision');

// Modal Elements: KB
const modalKbOverlay = document.getElementById('modal-kb-overlay');
const kbJsonContent = document.getElementById('kb-json-content');
const btnCloseKbModal = document.getElementById('btn-close-kb-modal');
const btnCopyKb = document.getElementById('btn-copy-kb');

// --- Initialization ---

function init() {
    setupModeSwitcher();
    setupSelectionListener();
    setupToolbarActions();
    setupModalActions();
    setupKbActions();

    // Initial content
    editorEdit.value = `This project has huge potential.
I wonder if we should prioritize performance[^unc-demo1] or features.

- Item 1
- Item 2

[^unc-demo1]: <!-- druide:uncertainty:id=demo1 -->`;

    // Initial Sync
    syncKnowledgeBase();
    renderSidebar();
}

// --- Mode Switching ---

function setupModeSwitcher() {
    btnModeEdit.addEventListener('click', () => setMode('edit'));
    btnModeAuthor.addEventListener('click', () => setMode('author'));
    btnModeReader.addEventListener('click', () => setMode('reader'));
}

function setMode(mode) {
    // Sync before leaving edit mode
    if (currentMode === 'edit' && mode !== 'edit') {
        syncKnowledgeBase();
    }

    currentMode = mode;
    updateUIForMode();
}

function updateUIForMode() {
    // Button States
    [btnModeEdit, btnModeAuthor, btnModeReader].forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-mode-${currentMode}`).classList.add('active');

    // View States
    if (currentMode === 'edit') {
        editorEdit.classList.remove('hidden');
        editorPreview.classList.add('hidden');
        sidebar.classList.remove('hidden');
    } else {
        editorEdit.classList.add('hidden');
        editorPreview.classList.remove('hidden');
        renderPreview(currentMode);

        if (currentMode === 'reader') {
            sidebar.classList.add('hidden'); // Uses visibility: hidden from CSS
        } else {
            sidebar.classList.remove('hidden');
        }
    }
}

// --- Knowledge Base & Syncing ---

function syncKnowledgeBase() {
    const markdown = editorEdit.value;
    lastMarkdown = markdown;

    // 1. Parse Definitions
    // Pattern: [^unc-ID]: <!-- druide:TYPE:id=ID druide:TYPE:description="DESC" druide:TYPE:anchor="ANCHOR" -->
    const defMap = {};
    const defRegex = /\[\^unc-([a-zA-Z0-9-]+)\]:\s*<!--\s*druide:([a-z]+):id=\1(?:\s+druide:\2:description="([^"]*)")?(?:\s+druide:\2:anchor="([^"]*)")?\s*-->/g;

    let defMatch;
    while ((defMatch = defRegex.exec(markdown)) !== null) {
        const id = defMatch[1];
        const type = defMatch[2];
        const description = defMatch[3] || "Unknown";
        const anchor = defMatch[4] || null; // Capture anchor if present
        defMap[id] = { type, description, anchor };
    }

    // 2. Scan markers
    const markerRegex = /\[\^unc-([a-zA-Z0-9-]+)\](?!\:)/g;

    let activeIds = new Set();
    let match;

    while ((match = markerRegex.exec(markdown)) !== null) {
        const id = match[1];
        activeIds.add(id);

        let text = "anchor"; // Default
        let start = match.index;
        let end = match.index;

        // Determine Text/Anchor
        if (defMap[id] && defMap[id].anchor) {
            // Precise Anchor from Metadata
            text = defMap[id].anchor;
            // Find this anchor PRECEDING the marker
            // We search backwards from match.index
            const lookback = markdown.substring(0, match.index);
            const anchorIndex = lookback.lastIndexOf(text);

            if (anchorIndex !== -1) {
                start = anchorIndex;
                end = anchorIndex + text.length;
            } else {
                // Anchor text not found (maybe text edited?)
                // Fallback to heuristic or keep "anchor"
                console.warn(`Anchor text "${text}" for ID ${id} not found preceding marker.`);
            }
        } else {
            // Heuristic (fallback for old items)
            const lookback = markdown.substring(Math.max(0, match.index - 50), match.index);
            const cleanLookback = lookback.replace(/<!--[\s\S]*?-->/g, '');
            const trimmedLookback = cleanLookback.trimEnd();
            const words = trimmedLookback.split(/\s+/);
            const validWords = words.filter(w => w.length > 0);
            text = validWords.length > 0 ? validWords[validWords.length - 1] : "anchor";

            start = markdown.lastIndexOf(text, match.index);
            end = start + text.length;
        }

        if (!knowledgeBase[id]) {
            knowledgeBase[id] = {
                id,
                resolved: false,
                question: ''
            };
        }

        knowledgeBase[id].text = text;
        knowledgeBase[id].range = { start, end };

        if (defMap[id]) {
            knowledgeBase[id].type = defMap[id].type;
            knowledgeBase[id].description = defMap[id].description;
            if (defMap[id].type === 'decision') {
                knowledgeBase[id].question = defMap[id].description;
            }
        } else if (!knowledgeBase[id].type) {
            knowledgeBase[id].type = 'uncertainty';
            knowledgeBase[id].description = 'Unknown';
        }
    }

    Object.keys(knowledgeBase).forEach(id => {
        if (!activeIds.has(id)) {
            delete knowledgeBase[id];
        }
    });

    renderSidebar();
}

// --- Rendering Logic ---

function renderPreview(mode) {
    let markdown = editorEdit.value;

    if (mode === 'reader') {
        // Use [\s\S]*? to match across newlines for multiline anchors (Same as Author mode)
        // MUST remove definitions BEFORE markers, otherwise marker delete breaks definition syntax
        // Removed ^ anchor and use \s* to handle indentation in lists
        markdown = markdown.replace(/\s*\[\^unc-[a-zA-Z0-9-]+\]:\s*<!--[\s\S]*?-->\s*/gm, '');
        markdown = markdown.replace(/\[\^unc-[a-zA-Z0-9-]+\]/g, '');
    } else if (mode === 'author') {
        // Inject Highlights using KB text
        // ... (Highlighting Logic) ...

        markdown = markdown.replace(/(\[\^unc-([a-zA-Z0-9-]+)\])/g, (fullMarker, markerGroup, id) => {
            // ... (no change to this block, just omitted for brevity in tool call if possible, but replace_file_content needs contiguous lines)
            // Wait, I can't skip lines in replacement. I have to reproduce the block or target specific lines.
            // The target lines are the READER block (208-212) and the AUTHOR block cleanup (300).
            // They are far apart. I should use MULTI_REPLACE.
            return fullMarker;
        });
        // ...
        // Inject Highlights using KB text
        // We know the exact text we expect to highlight for each ID.
        // We need to match (AnchorText)(Marker)

        // This is tricky with multiple replacements. 
        // Safer to iterate markers and replace based on ID lookup?
        // Or regex replace all markers and check KB?

        markdown = markdown.replace(/(\[\^unc-([a-zA-Z0-9-]+)\])/g, (fullMarker, markerGroup, id) => {
            const item = knowledgeBase[id];
            if (!item) return fullMarker;

            // We need to wrap the text PRECEDING this marker.
            // But we are in a replace loop. We can't see the text before easily in JS regex replace (no lookbehind in all browsers/contexts reliable?)
            // Actually, we can use a broader regex matching (Text)(Marker) if we construct it dynamically?
            // No, generic regex was `(\S+)`.

            // Strategy: We can't easily do this with a single regex because the anchor text varies.
            // BUT, we can do a multi-pass or a specific approach.
            // Since we are just rendering for View, we can do:
            // Match `(.*?)(marker)` ? Too greedy.

            // Let's use the Heuristic Replace for simple words OR a targeted replace.
            // For "full phrase anchoring", we must ensure we wrap the whole phrase.

            // NOTE: Changing strategy. We will loop through the known items and perform replacements specific to their anchor text.
            // Issue: Overlap? "foo bar[^1]" vs "bar[^2]"?
            // Assuming no nested anchors for now.

            return fullMarker; // Placeholder, standard replace won't work here.
        });

        // Better Strategy Author Mode:
        // We have the KB with ranges! But ranges are indices in the RAW markdown. 
        // Inserting HTML spans invalidates subsequent indices.
        // Valid strategy: Sort items by range (end, descending) and insert spans.

        const sortedIds = Object.keys(knowledgeBase).sort((a, b) => knowledgeBase[b].range.end - knowledgeBase[a].range.end);

        sortedIds.forEach(id => {
            const item = knowledgeBase[id];
            // Validate range (simple check)
            if (item.range.start < 0 || item.range.end > markdown.length) return;

            // Double check text matches (safety)
            const targetText = markdown.substring(item.range.start, item.range.end);
            if (targetText !== item.text) {
                // Drift detected, skip or fallback
                return;
            }

            const type = item.type;
            const cls = type === 'uncertainty' ? 'highlight-uncertainty' : 'highlight-decision';
            const spanOpen = `<span class="${cls}" data-id="${id}">`;
            const spanClose = `</span>`;

            // Splice
            const before = markdown.substring(0, item.range.start);
            let content = markdown.substring(item.range.start, item.range.end);
            const after = markdown.substring(item.range.end);

            // Smart Highlight for Lists/Multiline
            if (content.includes('\n') || /^\s*[-*+]|\d+\.\s/.test(content)) {
                const lines = content.split('\n');
                const processedLines = lines.map(line => {
                    // Check for list marker (e.g. "  - ", "1. ")
                    const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.))\s+(.*)$/);
                    if (listMatch) {
                        // Preserve marker (group 1), wrap content (group 2)
                        return `${listMatch[1]} ${spanOpen}${listMatch[2]}${spanClose}`;
                    }
                    // If empty line, leave as is
                    if (line.trim() === '') return line;

                    // If just text, wrap it (unless it's a header? assuming simple text for now)
                    return `${spanOpen}${line}${spanClose}`;
                });
                content = processedLines.join('\n');
            } else {
                // Single line / simple text
                content = spanOpen + content + spanClose;
            }

            markdown = before + content + after;
        });

        // Finally remove definitions AND markers
        // Use [\s\S]*? to match across newlines for multiline anchors
        // Relaxed anchor to \s* to handle indentation inside lists
        markdown = markdown.replace(/\s*\[\^unc-[a-zA-Z0-9-]+\]:\s*<!--[\s\S]*?-->\s*/gm, '');
        markdown = markdown.replace(/\[\^unc-[a-zA-Z0-9-]+\]/g, '');
    }

    let html = marked.parse(markdown);
    editorPreview.innerHTML = html;

    if (mode === 'author') {
        setupPreviewDelegation();
    }
}

function setupPreviewDelegation() {
    editorPreview.querySelectorAll('span[data-id]').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const id = el.dataset.id;
            highlightSidebarItem(id);
        }
    });
}

// --- Item Creation & Editing ---

let editingId = null; // If set, we are editing existing item
let tempSelection = null; // For new creation

function setupSelectionListener() {
    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('mousedown', (e) => {
        if (!toolbar.contains(e.target) && e.target !== editorEdit && !editorPreview.contains(e.target) && !modalOverlay.contains(e.target)) {
            hideToolbar();
        }
    });
}

function handleSelection() {
    if (editingId) return; // Don't show toolbar if editing
    const selection = window.getSelection();

    if (currentMode === 'edit') {
        if (document.activeElement === editorEdit) {
            const start = editorEdit.selectionStart;
            const end = editorEdit.selectionEnd;
            if (end > start) showToolbarAtRect(getTextareaCursorRect());
            else hideToolbar();
        }
    } else {
        if (selection.rangeCount > 0 && !selection.isCollapsed && editorPreview.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            showToolbarAtRect(rect);
        } else {
            hideToolbar();
        }
    }
}

function getTextareaCursorRect() {
    const rect = editorEdit.getBoundingClientRect();
    return { top: rect.top + 20, left: rect.right - 120, width: 0 };
}

function showToolbarAtRect(rect) {
    const top = rect.top - 50 + window.scrollY;
    const left = rect.left + (rect.width / 2) - (toolbar.offsetWidth / 2) + window.scrollX;

    if (currentMode === 'edit') {
        toolbar.style.top = `${rect.top}px`;
        toolbar.style.left = `${rect.left}px`;
    } else {
        toolbar.style.top = `${Math.max(10, top)}px`;
        toolbar.style.left = `${Math.max(10, left)}px`;
    }
    toolbar.classList.remove('hidden');
}

function hideToolbar() {
    toolbar.classList.add('hidden');
}

function setupToolbarActions() {
    btnUncertainty.addEventListener('mousedown', (e) => { e.preventDefault(); openModal('uncertainty'); });
    btnDecision.addEventListener('mousedown', (e) => { e.preventDefault(); openModal('decision'); });
}

function openModal(type, id = null) {
    editingId = id;

    if (id) {
        // Edit Mode
        const item = knowledgeBase[id];
        modalTitle.textContent = `Edit ${item.type === 'uncertainty' ? 'Uncertainty' : 'Decision'}`;
        modalSnippet.textContent = `"${item.text}"`;
        modalInput.value = item.description;
        tempSelection = null;
    } else {
        // Create Mode
        let start, end, text, isMarkdownIndex = false;

        if (currentMode === 'edit') {
            start = editorEdit.selectionStart;
            end = editorEdit.selectionEnd;
            text = editorEdit.value.substring(start, end);
            isMarkdownIndex = true;
        } else {
            const selection = window.getSelection();
            text = selection.toString();
            const md = editorEdit.value;
            let index = md.indexOf(text);

            // If not found, try trimmed
            if (index === -1) {
                const trimmed = text.trim();
                index = md.indexOf(trimmed);
                if (index !== -1) {
                    text = trimmed;
                } else {
                    // LIST/MULTILINE FUZZY MATCH
                    // Browser selection often strips markdown markers (bullets).
                    // We attempt to construct a regex that matches the parts of the selection
                    // separated by potential markdown list syntax.

                    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    if (lines.length > 1) {
                        // Pattern: line + (whitespace/newline/marker) + nextLine
                        const separator = '\\s*(?:\\r?\\n\\s*(?:[-*+]|\\d+\\.)?\\s*)?';
                        // We map lines to escaped regex and join with the flexible separator
                        // capture the whole thing to get the exact source text
                        const patternStr = lines.map(escapeRegExp).join(separator);

                        // We assume the lines appear in order.
                        const regex = new RegExp(patternStr);
                        const match = md.match(regex);

                        if (match) {
                            index = match.index;
                            text = match[0]; // Use the actual source text (including bullets)
                        }
                    }
                }
            }

            if (index !== -1) {
                start = index;
                end = index + text.length;
                isMarkdownIndex = true;
            } else {
                alert("Could not find text.");
                return;
            }
        }

        modalTitle.textContent = `Identify ${type === 'uncertainty' ? 'Uncertainty' : 'Decision'}`;
        modalSnippet.textContent = text ? `"${text}"` : '"..."';
        modalInput.value = "";
        tempSelection = { start, end, type, text, isMarkdownIndex };
    }

    modalOverlay.classList.remove('hidden');
    modalInput.focus();
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    editingId = null;
    tempSelection = null;
}

function setupModalActions() {
    btnCancel.addEventListener('click', closeModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnSave.addEventListener('click', saveAnnotation);
}

function saveAnnotation() {
    const description = modalInput.value.trim();
    if (!description) return;

    if (editingId) {
        // Edit Existing Item
        // We only update the Description in the Definition line.
        // We assume ID and Type are constant.
        const id = editingId;
        const item = knowledgeBase[id];

        let md = editorEdit.value;
        const safeDesc = description.replace(/"/g, '&quot;');

        // Regex to find definition: [^unc-id]: ...
        // We need to match across newlines now as well used for anchor
        const defRegex = new RegExp(`(\\[\\^unc-${id}\\]:\\s*<!--\\s*druide:${item.type}:id=${id}[\\s\\S]*?)-->`);

        // We want to replace the description attribute, or append it if missing.
        // Simpler: Reconstruct the whole definition.
        // We need to preserve 'anchor' if it exists.

        // Check if anchor exists in current KB item (it should from sync) Or re-parse?
        // Let's rely on KB item.text as anchor if we want to ensure it sticks, 
        // OR better, re-parse the existing line to extract anchor.

        const match = md.match(defRegex);
        if (match) {
            let anchorVal = "";
            const anchorMatch = match[0].match(/druide:\w+:anchor="([^"]*)"/);
            if (anchorMatch) anchorVal = anchorMatch[1];

            // Rebuild
            const newDef = `[^unc-${id}]: <!-- druide:${item.type}:id=${id} druide:${item.type}:description="${safeDesc}" druide:${item.type}:anchor="${anchorVal}" -->`;

            md = md.replace(defRegex, newDef);
            editorEdit.value = md;

            // Update KB immediately for UI responsiveness
            item.description = description;
            item.question = item.type === 'decision' ? description : '';
        }

    } else {
        // Create New
        if (!tempSelection || !tempSelection.isMarkdownIndex) return;

        const { start, end, type, text } = tempSelection;
        const id = generateId();

        const marker = `[^unc-${id}]`;
        const safeDesc = description.replace(/"/g, '&quot;');
        const safeAnchor = text.replace(/"/g, '&quot;');

        const definition = `\n[^unc-${id}]: <!-- druide:${type}:id=${id} druide:${type}:description="${safeDesc}" druide:${type}:anchor="${safeAnchor}" -->`;

        const val = editorEdit.value;
        const before = val.substring(0, end);
        const after = val.substring(end);

        editorEdit.value = before + marker + after + definition;
    }

    closeModal();
    hideToolbar();
    window.getSelection().removeAllRanges();

    syncKnowledgeBase();

    if (currentMode !== 'edit') {
        renderPreview(currentMode);
    }
}

// --- Sidebar & Deletion ---

function renderSidebar() {
    sidebarList.innerHTML = '';
    const ids = Object.keys(knowledgeBase);
    itemCountSpan.textContent = ids.length;

    if (ids.length === 0) {
        sidebarList.innerHTML = '<div class="empty-state"><p>No items extracted yet.</p></div>';
        return;
    }

    ids.forEach(id => {
        const item = knowledgeBase[id];
        const card = document.createElement('div');
        card.className = 'item-card';
        card.id = `item-${id}`;

        const typeClass = item.type === 'uncertainty' ? 'type-uncertainty' : 'type-decision';
        const icon = item.type === 'uncertainty' ? 'help' : 'gavel';

        card.innerHTML = `
            <div class="card-header ${typeClass}">
                <span class="material-symbols-rounded" style="font-size: 1.1em;">${icon}</span>
                ${item.type}
                <div class="card-actions">
                    <button class="btn-icon-sm" title="Edit" onclick="editItem('${id}', event)">
                         <span class="material-symbols-rounded" style="font-size: 1.1em;">edit</span>
                    </button>
                    <button class="btn-delete" title="Delete" onclick="deleteItem('${id}', event)">
                        <span class="material-symbols-rounded" style="font-size: 1.1em;">delete</span>
                    </button>
                </div>
            </div>
            <div class="card-body">${item.description}</div>
            <div class="card-snippet">"${item.text}"</div>
        `;

        card.onclick = () => highlightSidebarItem(id);
        sidebarList.appendChild(card);
    });
}

window.editItem = function (id, e) {
    if (e) e.stopPropagation();
    openModal(null, id); // Trigger Edit
}

window.deleteItem = function (id, e) {
    if (e) e.stopPropagation();

    let val = editorEdit.value;

    const markerRegex = new RegExp(`\\[\\^unc-${id}\\]`, 'g');
    val = val.replace(markerRegex, '');

    const defRegex = new RegExp(`^\\[\\^unc-${id}\\]:\\s*<!--[\\s\\S]*?-->\\s*`, 'gm');
    val = val.replace(defRegex, '');

    editorEdit.value = val;
    delete knowledgeBase[id];

    syncKnowledgeBase();

    if (currentMode !== 'edit') {
        renderPreview(currentMode);
    }
    renderSidebar();
}

// --- KB View Actions ---

function setupKbActions() {
    btnViewKb.addEventListener('click', showKnowledgeBase);
    btnCloseKbModal.addEventListener('click', closeKbModal);
    btnCopyKb.addEventListener('click', copyKbToClipboard);
}

function showKnowledgeBase() {
    const json = JSON.stringify(knowledgeBase, null, 2);
    kbJsonContent.textContent = json;
    modalKbOverlay.classList.remove('hidden');
}

function closeKbModal() {
    modalKbOverlay.classList.add('hidden');
}

function copyKbToClipboard() {
    const json = JSON.stringify(knowledgeBase, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        const originalText = btnCopyKb.textContent;
        btnCopyKb.textContent = "Copied!";
        setTimeout(() => btnCopyKb.textContent = originalText, 2000);
    });
}

// --- Utils ---

function generateId() {
    return Math.random().toString(36).substr(2, 6);
}

function highlightSidebarItem(id) {
    const card = document.getElementById(`item-${id}`);
    if (card) {
        document.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (currentMode === 'author') {
        const span = editorPreview.querySelector(`span[data-id="${id}"]`);
        if (span) {
            document.querySelectorAll('.highlight-uncertainty, .highlight-decision').forEach(h => h.classList.remove('active'));
            span.classList.add('active');
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Start
init();
