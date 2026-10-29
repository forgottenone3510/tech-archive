const SearchIndex = (() => {

    let index = new Map();
    let noteMap = new Map();

    function normalize(text) {
        if (!text)
            return "";

        return SearchConfig.caseSensitive
            ? text
            : text.toLowerCase();
    }

    function tokenize(text) {

        text = normalize(text);

        const tokens = new Set();

        text.split(/\s+/).forEach(token => {

            token = token.trim();

            if (!token)
                return;

            tokens.add(token);

            token.split(/[^a-z0-9_]+/).forEach(part => {

                if (!part)
                    return;

                tokens.add(part);

                if (SearchConfig.splitUnderscore) {
                    part.split("_").forEach(sub => {
                        if (sub.length >= SearchConfig.minTokenLength)
                            tokens.add(sub);
                    });
                }

            });

        });

        return [...tokens].filter(t => t.length >= SearchConfig.minTokenLength);
    }

    function addWord(word, noteId, field) {

        if (!index.has(word))
            index.set(word, new Map());

        const noteHits = index.get(word);

        if (!noteHits.has(noteId)) {
            noteHits.set(noteId, {
                title: 0,
                tags: 0,
                body: 0
            });
        }

        noteHits.get(noteId)[field]++;
    }

    function build(notes) {

        index.clear();
        noteMap.clear();

        for (const note of notes) {

            noteMap.set(note.id, note);

            tokenize(note.title).forEach(word =>
                addWord(word, note.id, "title")
            );

            note.tags.forEach(tag =>
                tokenize(tag).forEach(word =>
                    addWord(word, note.id, "tags")
                )
            );

            tokenize(note.body).forEach(word =>
                addWord(word, note.id, "body")
            );
        }
    }

    function lookup(word) {
        return index.get(normalize(word)) || new Map();
    }

    function lookupPrefix(prefix) {
        const normPrefix = normalize(prefix);
        const aggregatedHits = new Map();

        if (!normPrefix)
            return aggregatedHits;

        for (const [word, postingMap] of index.entries()) {
            if (word.startsWith(normPrefix)) {
                for (const [noteId, fieldHits] of postingMap.entries()) {
                    if (!aggregatedHits.has(noteId)) {
                        aggregatedHits.set(noteId, {
                            title: 0,
                            tags: 0,
                            body: 0
                        });
                    }
                    const hit = aggregatedHits.get(noteId);
                    hit.title += fieldHits.title;
                    hit.tags += fieldHits.tags;
                    hit.body += fieldHits.body;
                }
            }
        }

        return aggregatedHits;
    }

    function getNote(id) {
        return noteMap.get(id);
    }

    function getIndex() {
        return index;
    }

    function stats() {

        let entries = 0;

        for (const map of index.values())
            entries += map.size;

        return {
            notes: noteMap.size,
            words: index.size,
            entries: entries
        };
    }

    return {
        build,
        lookup,
        lookupPrefix,
        tokenize,
        getNote,
        getIndex,
        stats
    };

})();