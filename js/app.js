const App = {
    notes: []
};

document.addEventListener("DOMContentLoaded", () => {

    Storage.init();

    App.notes = Storage.getNotes();

    SearchIndex.build(App.notes);

    UI.initTagSuggestions();

    setupEvents();

    refreshSearch();

    focusSearchBox();

});

function focusSearchBox() {
    const searchBox = document.getElementById("search-box");
    if (searchBox) {
        searchBox.focus();
    }
}

function setupEvents() {

    const menuBtn = document.getElementById("btn-menu");
    const dropdownMenu = document.getElementById("dropdown-menu");

    if (menuBtn && dropdownMenu) {
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle("hidden");
        };

        document.addEventListener("click", (e) => {
            if (!dropdownMenu.contains(e.target) && e.target !== menuBtn) {
                dropdownMenu.classList.add("hidden");
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
            e.preventDefault();
            const searchBox = document.getElementById("search-box");
            if (searchBox) {
                searchBox.focus();
                searchBox.select();
            }
        } else if (e.key === "Escape") {
            const modal = document.getElementById("modal");
            const drawer = document.getElementById("drawer");
            if (modal && !modal.classList.contains("hidden")) {
                UI.closeModal();
                focusSearchBox();
            } else if (drawer && drawer.classList.contains("open")) {
                UI.closeDrawer();
                focusSearchBox();
            }
        }
    });

    document.getElementById("btn-export").onclick = () => {
        if (dropdownMenu) dropdownMenu.classList.add("hidden");
        Storage.exportJSON();
    };

    document.getElementById("btn-import").onclick = () => {
        if (dropdownMenu) dropdownMenu.classList.add("hidden");
        document.getElementById("file-import").click();
    };

    document.getElementById("file-import").onchange = async e => {

        const file = e.target.files[0];

        if (!file)
            return;

        await Storage.importJSON(file);

        App.notes = Storage.getNotes();

        SearchIndex.build(App.notes);

        refreshSearch();

        e.target.value = "";

    };

    let searchDebounceTimer = null;

    document.getElementById("search-box").oninput = () => {
        clearTimeout(searchDebounceTimer);
        const delay = SearchConfig.debounceMs || 180;
        searchDebounceTimer = setTimeout(() => {
            refreshSearch();
        }, delay);
    };

    document.getElementById("btn-new").onclick = () => {
        UI.openModal();
    };

    const modalCloseX = document.getElementById("modal-close-x");
    if (modalCloseX) {
        modalCloseX.onclick = () => {
            UI.closeModal();
            focusSearchBox();
        };
    }

    document.getElementById("btn-edit-note").onclick = () => {
        const note = UI.getCurrentDrawerNote();
        if (note) {
            UI.openModal(note);
        }
    };

    document.getElementById("btn-delete-note").onclick = () => {
        const note = UI.getCurrentDrawerNote();
        if (note && confirm(`Are you sure you want to delete "${note.title}"?`)) {
            Storage.deleteNote(note.id);

            App.notes = Storage.getNotes();

            SearchIndex.build(App.notes);

            UI.closeDrawer();

            refreshSearch();

            focusSearchBox();
        }
    };

    document.getElementById("note-cancel").onclick = () => {
        UI.closeModal();
        focusSearchBox();
    };

    document.getElementById("note-save").onclick = () => {

        const data = UI.getNoteForm();
        const editingId = UI.getEditingNoteId();

        if (editingId) {
            Storage.updateNote(editingId, {
                title: data.title,
                tags: data.tags,
                priority: data.priority,
                body: data.body
            });
        } else {
            const note = Storage.createNote(data);

            Storage.addNote(note);
        }

        App.notes = Storage.getNotes();

        SearchIndex.build(App.notes);

        UI.clearForm();
        UI.closeModal();
        UI.closeDrawer();

        refreshSearch();

        focusSearchBox();

    };

    const btnSticky = document.getElementById("btn-sticky-note");
    if (btnSticky) {
        btnSticky.onclick = () => {
            const note = UI.getCurrentDrawerNote();
            if (note) {
                const isSticky = Storage.toggleSticky(note.id);
                note.sticky = isSticky;
                App.notes = Storage.getNotes();
                UI.updateDrawerStickyBtn(isSticky);
                UI.renderStickySection(App.notes);
                refreshSearch();
            }
        };
    }

    const stickyPrevBtn = document.getElementById("sticky-prev-btn");
    const stickyNextBtn = document.getElementById("sticky-next-btn");
    if (stickyPrevBtn) {
        stickyPrevBtn.onclick = () => {
            UI.changeStickyPage(-1);
        };
    }
    if (stickyNextBtn) {
        stickyNextBtn.onclick = () => {
            UI.changeStickyPage(1);
        };
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            UI.renderStickySection(App.notes);
        }, 120);
    });

    document.getElementById("drawer-close").onclick = () => {
        UI.closeDrawer();
        focusSearchBox();
    };

}

function refreshSearch() {

    const keyword =
        document.getElementById("search-box").value.trim();

    let searchOutput;

    if (keyword) {

        searchOutput = Search.search(keyword);

    } else {

        const defaultResults = App.notes
            .slice()
            .sort((a, b) =>
                b.updated.localeCompare(a.updated)
            )
            .map(note => ({
                note: note,
                score: 0,
                matchedWords: [],
                matchedKeywordsCount: 0
            }));

        searchOutput = {
            results: defaultResults,
            queryKeywords: []
        };
    }

    UI.showResults(searchOutput.results, searchOutput.queryKeywords);
    UI.renderStickySection(App.notes);

    const stats = SearchIndex.stats();
    const totalMatches = searchOutput.results.length;
    const limit = SearchConfig.maxResults || 20;

    let statusText = "";
    if (keyword) {
        const showingCount = Math.min(totalMatches, limit);
        statusText = `Found ${totalMatches} matched result${totalMatches !== 1 ? "s" : ""}${totalMatches > limit ? ` (showing top ${showingCount})` : ""} | Notes: ${stats.notes} | Indexed Words: ${stats.words}`;
    } else {
        const showingCount = Math.min(totalMatches, limit);
        statusText = `Recent Notes (${showingCount} of ${totalMatches}) | Notes: ${stats.notes} | Indexed Words: ${stats.words}`;
    }

    document.getElementById("status").textContent = statusText;

}