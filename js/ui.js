const UI = (() => {

    let tagsList = [];
    let activeSuggestionIndex = -1;
    let currentDrawerNote = null;
    let editingNoteId = null;
    let stickyCurrentPage = 0;

    // Generate consistent readable HSL color scheme based on tag string hash
    function getTagColor(tag) {
        let hash = 0;
        const str = (tag || "").toLowerCase().trim();
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        // Dark background, bright light text, subtle border for dark mode
        const bg = `hsl(${hue}, 45%, 22%)`;
        const text = `hsl(${hue}, 85%, 88%)`;
        const border = `hsl(${hue}, 45%, 38%)`;
        return { bg, text, border };
    }

    // Render HTML string for a tag pill badge with optional keyword highlighting
    function renderTagPillHTML(tag, queryKeywords = []) {
        const colors = getTagColor(tag);
        const contentHTML = highlightText(tag, queryKeywords);
        return `<span class="tag-pill" style="background-color: ${colors.bg}; color: ${colors.text}; border-color: ${colors.border};">${contentHTML}</span>`;
    }

    function highlightText(text, keywords = []) {
        if (!text) return "";
        if (!Array.isArray(keywords) || keywords.length === 0) {
            return escapeHTML(text);
        }

        const validKeywords = keywords.filter(k => k && k.trim());
        if (validKeywords.length === 0) {
            return escapeHTML(text);
        }

        const regexPattern = validKeywords
            .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .sort((a, b) => b.length - a.length)
            .join("|");

        if (!regexPattern) {
            return escapeHTML(text);
        }

        const flags = SearchConfig.caseSensitive ? "g" : "gi";
        const regex = new RegExp(regexPattern, flags);

        let result = "";
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;

            if (matchStart > lastIndex) {
                result += escapeHTML(text.substring(lastIndex, matchStart));
            }

            result += `<mark class="search-highlight">${escapeHTML(match[0])}</mark>`;
            lastIndex = matchEnd;
        }

        if (lastIndex < text.length) {
            result += escapeHTML(text.substring(lastIndex));
        }

        return result;
    }

    function getNoteBodyPreview(body, queryKeywords = [], maxLines = SearchConfig.previewLines || 6) {
        if (!body) return "";

        const lines = body.split(/\r?\n/);
        if (lines.length <= maxLines) {
            return body;
        }

        let startLine = 0;

        if (Array.isArray(queryKeywords) && queryKeywords.length > 0) {
            const validKeywords = queryKeywords.filter(k => k && k.trim());
            if (validKeywords.length > 0) {
                const regexPattern = validKeywords
                    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join("|");
                if (regexPattern) {
                    const regex = new RegExp(regexPattern, SearchConfig.caseSensitive ? "" : "i");
                    const matchedIndex = lines.findIndex(line => regex.test(line));
                    if (matchedIndex !== -1) {
                        startLine = Math.max(0, matchedIndex - 1);
                    }
                }
            }
        }

        let endLine = Math.min(lines.length, startLine + maxLines);
        if (endLine - startLine < maxLines) {
            startLine = Math.max(0, endLine - maxLines);
        }

        let resultText = lines.slice(startLine, endLine).join("\n");
        if (startLine > 0) {
            resultText = "...\n" + resultText;
        }
        if (endLine < lines.length) {
            resultText = resultText + "\n...";
        }

        return resultText;
    }

    function renderPlainTextWithComments(text, keywords = []) {
        if (!text) return "";
        const lines = text.split(/\r?\n/);
        const processedLines = lines.map(line => {
            const trimmed = line.trimStart();
            if (trimmed.startsWith("//")) {
                return `<span class="comment-line">${highlightText(line, keywords)}</span>`;
            }
            return highlightText(line, keywords);
        });
        return processedLines.join("\n");
    }

    function renderNoteBodyHTML(body, queryKeywords = [], isPreview = false, noteTags = []) {
        const textToRender = isPreview ? getNoteBodyPreview(body, queryKeywords) : body;
        const extraClass = isPreview ? "" : "drawer-body";

        // Attempt syntax highlighting only when a language can be resolved from tags.
        const lang = (typeof SyntaxHighlight !== "undefined")
            ? SyntaxHighlight.getLangFromTags(noteTags)
            : null;

        let bodyHTML;

        if (lang && typeof hljs !== "undefined" && hljs.getLanguage(lang)) {
            try {
                // hljs returns already-escaped HTML with syntax spans
                const hljsResult = hljs.highlight(textToRender, { language: lang, ignoreIllegals: true });
                // Inject search-keyword marks on top of the syntax-coloured HTML
                bodyHTML = highlightSearchTermsInHTML(hljsResult.value, queryKeywords);
            } catch (_) {
                // Safety: if hljs fails for any reason, fall back to plain text with comment formatting
                bodyHTML = renderPlainTextWithComments(textToRender, queryKeywords);
            }
        } else {
            // No language match — render as plain text with search highlighting and comment formatting
            bodyHTML = renderPlainTextWithComments(textToRender, queryKeywords);
        }

        return `<pre class="note-code-block ${extraClass}"><code>${bodyHTML}</code></pre>`;
    }

    /**
     * Inject <mark> tags for search keywords into an already-HTML-escaped string
     * (e.g. the output of hljs.highlight).  Matches are only inserted into text
     * nodes — characters that are NOT inside an HTML tag — so that syntax spans
     * are never partially wrapped or corrupted.
     *
     * Strategy: split the HTML string by tag tokens (<...>), then run the keyword
     * regex only against the text segments between tags.
     */
    function highlightSearchTermsInHTML(html, keywords = []) {
        if (!html || !Array.isArray(keywords) || keywords.length === 0) return html;

        const validKeywords = keywords.filter(k => k && k.trim());
        if (validKeywords.length === 0) return html;

        // Build keyword regex that matches the *escaped* form of the keyword
        // (since hljs output is already HTML-escaped, e.g. & -> &amp;)
        const regexPattern = validKeywords
            .map(k => escapeHTML(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .sort((a, b) => b.length - a.length)
            .join("|");

        if (!regexPattern) return html;

        const kwRegex = new RegExp(regexPattern, SearchConfig.caseSensitive ? "g" : "gi");

        // Split into alternating [text, tag, text, tag, …] segments
        // The regex captures full HTML tags so we can reassemble faithfully
        const parts = html.split(/(<[^>]*>)/);

        return parts.map((part, i) => {
            // Odd indices are HTML tags — leave untouched
            if (i % 2 === 1) return part;
            // Even indices are text nodes — apply keyword marking
            return part.replace(kwRegex, m => `<mark class="search-highlight">${m}</mark>`);
        }).join("");
    }

    function formatLastUpdated(isoString) {
        if (!isoString) return "";
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `Last updated: ${yyyy}/${mm}/${dd} ${hh}:${min}`;
    }

    function renderNoteTagsHTML(tags, queryKeywords = []) {
        if (!Array.isArray(tags) || tags.length === 0) {
            return '<span class="no-tags">No tags</span>';
        }
        return tags.map(tag => renderTagPillHTML(tag, queryKeywords)).join("");
    }

    function showResults(results, queryKeywords = []) {

        const container = document.getElementById("results");

        container.innerHTML = "";

        const limit = SearchConfig.maxResults || 20;
        const displayed = results.slice(0, limit);

        for (let index = 0; index < displayed.length; index++) {
            const item = displayed[index];
            const note = item.note;

            const card = document.createElement("div");
            card.className = "card";
            card.style.animationDelay = `${Math.min(index * 0.03, 0.3)}s`;

            const tagsHTML = renderNoteTagsHTML(note.tags, queryKeywords);
            const titleHTML = highlightText(note.title, queryKeywords);
            const bodyHTML = renderNoteBodyHTML(note.body, queryKeywords, true, note.tags);
            const lastUpdatedText = formatLastUpdated(note.updated || note.created);
            const metaHTML = lastUpdatedText ? `<div class="note-last-updated">${lastUpdatedText}</div>` : "";

            const stickyBadge = note.sticky ? `<span class="card-sticky-pin" title="Sticky Note">📌</span> ` : "";

            card.innerHTML = `
                <div class="card-title">${stickyBadge}${titleHTML}</div>
                <div class="card-tags">${tagsHTML}</div>
                ${bodyHTML}
                ${metaHTML}
            `;

            card.onclick = () => {
                openDrawer(note, queryKeywords);
            };

            container.appendChild(card);
        }

        if (results.length > limit) {
            const moreCount = results.length - limit;
            const notice = document.createElement("div");
            notice.className = "more-results-notice";
            notice.textContent = `...and ${moreCount} more result${moreCount > 1 ? "s" : ""}`;
            container.appendChild(notice);
        }
    }


    function openDrawer(note, queryKeywords = []) {
        currentDrawerNote = note;

        const drawer = document.getElementById("drawer");
        const content = document.getElementById("drawer-content");

        const tagsHTML = renderNoteTagsHTML(note.tags, queryKeywords);
        const titleHTML = highlightText(note.title, queryKeywords);
        const bodyHTML = renderNoteBodyHTML(note.body, queryKeywords, false, note.tags);
        const lastUpdatedText = formatLastUpdated(note.updated || note.created);
        const metaHTML = lastUpdatedText ? `<div class="note-last-updated">${lastUpdatedText}</div>` : "";

        content.innerHTML = `
            <h2>${titleHTML}</h2>

            <div class="drawer-tags">${tagsHTML}</div>

            ${bodyHTML}
            ${metaHTML}
        `;

        updateDrawerStickyBtn(Boolean(note.sticky));

        drawer.classList.add("open");
    }


    function closeDrawer() {
        currentDrawerNote = null;
        const drawer = document.getElementById("drawer");
        drawer.classList.remove("open");
    }


    function getCurrentDrawerNote() {
        return currentDrawerNote;
    }


    function populatePriorityDropdown() {
        const select = document.getElementById("note-priority");
        if (!select) return;

        const priorities = (typeof SearchConfig !== "undefined" && SearchConfig.priorities)
            ? SearchConfig.priorities
            : { "Lowest": 0.5, "Low": 0.75, "Normal": 1.0, "High": 2.0, "Highest": 4.0 };
        const defaultPriority = (typeof SearchConfig !== "undefined" && SearchConfig.defaultPriority) || "Normal";

        select.innerHTML = "";
        Object.keys(priorities).forEach(tier => {
            const option = document.createElement("option");
            option.value = tier;
            option.textContent = tier;
            if (tier === defaultPriority) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    function openModal(noteToEdit) {
        populatePriorityDropdown();
        clearForm();
        const titleEl = document.getElementById("modal-title");
        const priorityEl = document.getElementById("note-priority");
        const defaultPriority = (typeof SearchConfig !== "undefined" && SearchConfig.defaultPriority) || "Normal";

        if (noteToEdit) {
            editingNoteId = noteToEdit.id;
            document.getElementById("note-title").value = noteToEdit.title || "";
            document.getElementById("note-body").value = noteToEdit.body || "";
            if (priorityEl) {
                priorityEl.value = noteToEdit.priority || defaultPriority;
            }
            if (Array.isArray(noteToEdit.tags)) {
                setTags(noteToEdit.tags);
            }
            if (titleEl) titleEl.textContent = "Edit Note";
        } else {
            editingNoteId = null;
            if (priorityEl) {
                priorityEl.value = defaultPriority;
            }
            if (titleEl) titleEl.textContent = "New Note";
        }

        const modal = document.getElementById("modal");
        modal.classList.remove("hidden");
        requestAnimationFrame(() => {
            modal.classList.add("show");
        });
    }


    function closeModal() {
        hideTagSuggestions();
        const modal = document.getElementById("modal");
        modal.classList.remove("show");
        setTimeout(() => {
            if (!modal.classList.contains("show")) {
                modal.classList.add("hidden");
            }
        }, 200);
    }


    function getEditingNoteId() {
        return editingNoteId;
    }


    function getNoteForm() {
        const input = document.getElementById("note-tags-input");
        const remaining = input ? input.value.trim().replace(/^[,;]+|[,;]+$/g, "") : "";
        let tags = [...tagsList];

        if (remaining && !tags.includes(remaining)) {
            tags.push(remaining);
        }

        const priorityEl = document.getElementById("note-priority");
        const defaultPriority = (typeof SearchConfig !== "undefined" && SearchConfig.defaultPriority) || "Normal";
        const priority = (priorityEl && priorityEl.value) ? priorityEl.value : defaultPriority;

        return {
            title: document.getElementById("note-title").value.trim(),
            tags: tags,
            priority: priority,
            body: document.getElementById("note-body").value
        };
    }


    function clearForm() {
        editingNoteId = null;
        const titleEl = document.getElementById("modal-title");
        if (titleEl) titleEl.textContent = "New Note";

        document.getElementById("note-title").value = "";
        const input = document.getElementById("note-tags-input");
        if (input) input.value = "";
        const priorityEl = document.getElementById("note-priority");
        const defaultPriority = (typeof SearchConfig !== "undefined" && SearchConfig.defaultPriority) || "Normal";
        if (priorityEl) {
            priorityEl.value = defaultPriority;
        }
        document.getElementById("note-body").value = "";
        tagsList = [];
        renderTagChips();
        hideTagSuggestions();
    }

    // Collect all unique tags from existing notes in local storage
    function getAllExistingTags() {
        const notes = Storage.getNotes();
        const tagSet = new Set();
        for (const note of notes) {
            if (Array.isArray(note.tags)) {
                for (const tag of note.tags) {
                    if (tag && tag.trim()) {
                        tagSet.add(tag.trim());
                    }
                }
            }
        }
        return Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }

    // Render tag chips with delete buttons
    function renderTagChips() {
        const container = document.getElementById("tag-chips");
        if (!container) return;

        container.innerHTML = "";

        tagsList.forEach((tag, index) => {
            const chip = document.createElement("span");
            chip.className = "tag-chip";
            chip.textContent = tag + " ";

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "tag-chip-remove";
            removeBtn.innerHTML = "&times;";
            removeBtn.title = "Remove tag";
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeTag(index);
            };

            chip.appendChild(removeBtn);
            container.appendChild(chip);
        });
    }

    // Add tag to current list and reset input
    function addTag(tag) {
        const trimmed = tag.trim().replace(/^[,;]+|[,;]+$/g, "");
        if (trimmed && !tagsList.includes(trimmed)) {
            tagsList.push(trimmed);
            renderTagChips();
        }
        const input = document.getElementById("note-tags-input");
        if (input) input.value = "";
        hideTagSuggestions();
    }

    // Remove tag chip by index
    function removeTag(index) {
        if (index >= 0 && index < tagsList.length) {
            tagsList.splice(index, 1);
            renderTagChips();
        }
    }

    // Populate initial tags for editing
    function setTags(tagsArray) {
        tagsList = Array.isArray(tagsArray) ? [...tagsArray] : [];
        renderTagChips();
    }

    // Initialize event listeners for tag input and suggestions dropdown
    function initTagSuggestions() {
        const container = document.getElementById("tags-container");
        const input = document.getElementById("note-tags-input");
        const box = document.getElementById("tag-suggestions");
        const bodyInput = document.getElementById("note-body");

        // Enable Tab key indentation for code body editor
        if (bodyInput) {
            bodyInput.addEventListener("keydown", (e) => {
                if (e.key === "Tab") {
                    e.preventDefault();
                    const start = bodyInput.selectionStart;
                    const end = bodyInput.selectionEnd;
                    bodyInput.value = bodyInput.value.substring(0, start) + "    " + bodyInput.value.substring(end);
                    bodyInput.selectionStart = bodyInput.selectionEnd = start + 4;
                }
            });
        }

        if (!input || !box || !container) return;

        container.addEventListener("click", (e) => {
            if (e.target !== box && !box.contains(e.target)) {
                input.focus();
            }
        });

        // Convert comma/semicolon typed text immediately into chips
        input.addEventListener("input", (e) => {
            const val = e.target.value;
            if (val.includes(",") || val.includes(";")) {
                const parts = val.split(/[,;]+/);
                for (let i = 0; i < parts.length - 1; i++) {
                    if (parts[i].trim()) {
                        addTag(parts[i]);
                    }
                }
                e.target.value = parts[parts.length - 1];
            }
            renderSuggestions();
        });

        input.addEventListener("focus", () => {
            renderSuggestions();
        });

        input.addEventListener("blur", () => {
            setTimeout(() => {
                if (input.value.trim()) {
                    addTag(input.value);
                }
            }, 150);
        });

        // Keyboard navigation for suggestions dropdown and tag chip creation
        input.addEventListener("keydown", (e) => {
            const isBoxOpen = !box.classList.contains("hidden");
            const items = box.querySelectorAll(".suggestion-item");

            if (e.key === "ArrowDown" && isBoxOpen && items.length > 0) {
                e.preventDefault();
                activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                updateActiveSuggestion(items);
            } else if (e.key === "ArrowUp" && isBoxOpen && items.length > 0) {
                e.preventDefault();
                activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                updateActiveSuggestion(items);
            } else if (e.key === "Tab" && isBoxOpen && activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
                e.preventDefault();
                items[activeSuggestionIndex].click();
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (isBoxOpen && activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
                    items[activeSuggestionIndex].click();
                } else if (input.value.trim()) {
                    addTag(input.value);
                }
            } else if (e.key === "," || e.key === ";") {
                e.preventDefault();
                if (input.value.trim()) {
                    addTag(input.value);
                }
            } else if (e.key === "Backspace" && !input.value && tagsList.length > 0) {
                removeTag(tagsList.length - 1);
                renderSuggestions();
            } else if (e.key === "Escape") {
                hideTagSuggestions();
            }
        });

        document.addEventListener("click", (e) => {
            if (!container.contains(e.target)) {
                hideTagSuggestions();
            }
        });
    }

    function hideTagSuggestions() {
        const box = document.getElementById("tag-suggestions");
        if (box) {
            box.classList.add("hidden");
            box.innerHTML = "";
        }
        activeSuggestionIndex = -1;
    }

    function updateActiveSuggestion(items) {
        items.forEach((item, index) => {
            if (index === activeSuggestionIndex) {
                item.classList.add("active");
                item.scrollIntoView({ block: "nearest" });
            } else {
                item.classList.remove("active");
            }
        });
    }

    // Render suggestion items based on matching existing tags
    function renderSuggestions() {
        const input = document.getElementById("note-tags-input");
        const box = document.getElementById("tag-suggestions");

        if (!input || !box) return;

        const val = input.value.trim().toLowerCase();
        const allTags = getAllExistingTags();

        const matches = allTags.filter(tag => {
            const tagLower = tag.toLowerCase();
            if (tagsList.map(t => t.toLowerCase()).includes(tagLower)) {
                return false;
            }
            if (!val) return true;
            return tagLower.includes(val);
        }).sort((a, b) => {
            if (!val) return 0;
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            const aStarts = aLower.startsWith(val);
            const bStarts = bLower.startsWith(val);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
        }).slice(0, 10);

        if (matches.length === 0) {
            hideTagSuggestions();
            return;
        }

        box.innerHTML = "";
        activeSuggestionIndex = -1;

        matches.forEach(tag => {
            const div = document.createElement("div");
            div.className = "suggestion-item";
            div.textContent = tag;

            // Prevent input blur on mousedown
            div.addEventListener("mousedown", (e) => {
                e.preventDefault();
            });

            // Handle selection on click (triggered by mouse click or element.click())
            div.addEventListener("click", () => {
                addTag(tag);
            });

            box.appendChild(div);
        });

        box.classList.remove("hidden");
    }

    function escapeHTML(text) {

        return text
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function updateDrawerStickyBtn(isSticky) {
        const btn = document.getElementById("btn-sticky-note");
        if (!btn) return;

        if (isSticky) {
            btn.classList.add("active");
            btn.title = "Unpin note from Sticky Notes";
            btn.innerHTML = "📌 Sticky";
        } else {
            btn.classList.remove("active");
            btn.title = "Pin note to Sticky Notes";
            btn.innerHTML = "📌 Sticky";
        }
    }

    function getStickyCardsPerPage() {
        const width = window.innerWidth;
        if (width >= 1500) return 4;
        if (width >= 1100) return 3;
        if (width >= 700) return 2;
        return 1;
    }

    function sortStickyNotes(notes) {
        const priorityWeights = {
            "Highest": 5,
            "High": 4,
            "Normal": 3,
            "Low": 2,
            "Lowest": 1
        };

        return notes.slice().sort((a, b) => {
            const pA = priorityWeights[a.priority] || 3;
            const pB = priorityWeights[b.priority] || 3;
            if (pB !== pA) {
                return pB - pA; // Priority DESC
            }
            const timeA = a.updated || a.created || "";
            const timeB = b.updated || b.created || "";
            return timeB.localeCompare(timeA); // Last edited DESC
        });
    }

    function createStickyCardElement(note) {
        const card = document.createElement("div");
        card.className = "sticky-card";
        card.dataset.noteId = note.id;

        const titleText = note.title || "Untitled";
        const priorityText = note.priority || "Normal";
        const priorityClass = `priority-${priorityText.toLowerCase()}`;
        const tagsHTML = renderNoteTagsHTML(note.tags);
        const bodyHTML = renderNoteBodyHTML(note.body, [], true, note.tags);
        const lastUpdatedText = formatLastUpdated(note.updated || note.created);
        const metaHTML = lastUpdatedText ? `<div class="note-last-updated">${lastUpdatedText}</div>` : "";

        card.innerHTML = `
            <div class="sticky-card-header">
                <div class="sticky-card-title-row">
                    <span class="sticky-card-pin" title="Sticky Note">📌</span>
                    <div class="sticky-card-title" title="${escapeHTML(titleText)}">${escapeHTML(titleText)}</div>
                </div>
                <div class="sticky-card-actions">
                    <span class="priority-badge ${priorityClass}">${escapeHTML(priorityText)}</span>
                    <button type="button" class="sticky-card-unpin" title="Unpin note">&times;</button>
                </div>
            </div>
            <div class="sticky-card-tags">${tagsHTML}</div>
            <div class="sticky-card-body">${bodyHTML}</div>
            <div class="sticky-card-footer">${metaHTML}</div>
        `;

        card.onclick = () => {
            openDrawer(note);
        };

        const unpinBtn = card.querySelector(".sticky-card-unpin");
        if (unpinBtn) {
            unpinBtn.onclick = (e) => {
                e.stopPropagation();
                Storage.toggleSticky(note.id);
                const currentNotes = Storage.getNotes();
                if (typeof App !== "undefined") {
                    App.notes = currentNotes;
                }
                renderStickySection(currentNotes);
                if (currentDrawerNote && currentDrawerNote.id === note.id) {
                    currentDrawerNote.sticky = false;
                    updateDrawerStickyBtn(false);
                }
                if (typeof refreshSearch === "function") {
                    refreshSearch();
                }
            };
        }

        return card;
    }

    function renderStickySection(allNotes) {
        const section = document.getElementById("sticky-section");
        const track = document.getElementById("sticky-track");
        const countBadge = document.getElementById("sticky-count-badge");
        const pageInfo = document.getElementById("sticky-pagination-info");
        const prevBtn = document.getElementById("sticky-prev-btn");
        const nextBtn = document.getElementById("sticky-next-btn");

        if (!section || !track) return;

        const notesList = Array.isArray(allNotes) ? allNotes : (typeof Storage !== "undefined" ? Storage.getNotes() : []);
        const stickyNotes = notesList.filter(n => Boolean(n.sticky));

        if (stickyNotes.length === 0) {
            section.classList.add("hidden");
            track.innerHTML = "";
            if (countBadge) countBadge.textContent = "0";
            if (pageInfo) pageInfo.textContent = "";
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return;
        }

        section.classList.remove("hidden");
        if (countBadge) countBadge.textContent = stickyNotes.length;

        const sorted = sortStickyNotes(stickyNotes);
        const cardsPerPage = getStickyCardsPerPage();
        const totalPages = Math.ceil(sorted.length / cardsPerPage);

        if (stickyCurrentPage >= totalPages) {
            stickyCurrentPage = Math.max(0, totalPages - 1);
        }

        track.innerHTML = "";
        for (let p = 0; p < totalPages; p++) {
            const pageDiv = document.createElement("div");
            pageDiv.className = "sticky-page";
            const pageNotes = sorted.slice(p * cardsPerPage, (p + 1) * cardsPerPage);
            pageNotes.forEach(note => {
                const card = createStickyCardElement(note);
                pageDiv.appendChild(card);
            });
            track.appendChild(pageDiv);
        }

        track.style.transform = `translateX(-${stickyCurrentPage * 100}%)`;

        if (prevBtn) prevBtn.disabled = stickyCurrentPage === 0;
        if (nextBtn) nextBtn.disabled = stickyCurrentPage >= totalPages - 1;
        if (pageInfo) {
            pageInfo.textContent = totalPages > 1 ? `${stickyCurrentPage + 1} / ${totalPages}` : "";
        }
    }

    function changeStickyPage(delta) {
        const notesList = typeof Storage !== "undefined" ? Storage.getNotes() : [];
        const stickyNotes = notesList.filter(n => Boolean(n.sticky));
        const cardsPerPage = getStickyCardsPerPage();
        const totalPages = Math.ceil(stickyNotes.length / cardsPerPage);
        if (totalPages <= 1) return;

        stickyCurrentPage = Math.max(0, Math.min(totalPages - 1, stickyCurrentPage + delta));
        const track = document.getElementById("sticky-track");
        if (track) {
            track.style.transform = `translateX(-${stickyCurrentPage * 100}%)`;
        }

        const prevBtn = document.getElementById("sticky-prev-btn");
        const nextBtn = document.getElementById("sticky-next-btn");
        const pageInfo = document.getElementById("sticky-pagination-info");

        if (prevBtn) prevBtn.disabled = stickyCurrentPage === 0;
        if (nextBtn) nextBtn.disabled = stickyCurrentPage >= totalPages - 1;
        if (pageInfo) {
            pageInfo.textContent = `${stickyCurrentPage + 1} / ${totalPages}`;
        }
    }


    return {
        showResults,
        openDrawer,
        closeDrawer,
        getCurrentDrawerNote,
        openModal,
        closeModal,
        getEditingNoteId,
        getNoteForm,
        clearForm,
        setTags,
        initTagSuggestions,
        hideTagSuggestions,
        escapeHTML,
        highlightText,
        renderNoteBodyHTML,
        renderNoteTagsHTML,
        updateDrawerStickyBtn,
        renderStickySection,
        changeStickyPage,
        sortStickyNotes
    };

})();