const Search = (() => {

    function getPriorityMultiplier(note) {
        const defaultPriority = (typeof SearchConfig !== "undefined" && SearchConfig.defaultPriority) || "Normal";
        const priorityName = (note && note.priority) ? note.priority : defaultPriority;
        const prioritiesMap = (typeof SearchConfig !== "undefined" && SearchConfig.priorities) ? SearchConfig.priorities : {};
        const multiplier = prioritiesMap[priorityName];
        return (typeof multiplier === "number") ? multiplier : 1.0;
    }

    function search(query) {

        const words = [...new Set(SearchIndex.tokenize(query))];

        if (words.length === 0)
            return { results: [], queryKeywords: [] };

        const results = new Map();

        for (const word of words) {

            const matches = SearchIndex.lookupPrefix(word);

            for (const [noteId, hit] of matches) {

                if (!results.has(noteId)) {
                    results.set(noteId, {
                        noteId: noteId,
                        score: 0,
                        matchedKeywords: new Set()
                    });
                }

                const result = results.get(noteId);

                result.score +=
                    hit.title * SearchConfig.score.title +
                    hit.tags * SearchConfig.score.tags +
                    hit.body * SearchConfig.score.body;

                result.matchedKeywords.add(word);
            }
        }

        const finalResults = [];

        for (const result of results.values()) {
            const note = SearchIndex.getNote(result.noteId);
            const multiplier = getPriorityMultiplier(note);
            const finalScore = result.score * multiplier;

            finalResults.push({
                note: note,
                score: finalScore,
                matchedWords: [...result.matchedKeywords],
                matchedKeywordsCount: result.matchedKeywords.size
            });
        }

        finalResults.sort((a, b) => {
            if (a.matchedKeywordsCount !== b.matchedKeywordsCount) {
                return b.matchedKeywordsCount - a.matchedKeywordsCount;
            }

            if (a.score !== b.score) {
                return b.score - a.score;
            }

            return a.note.title.localeCompare(b.note.title);
        });

        return {
            results: finalResults,
            queryKeywords: words
        };
    }

    return {
        search
    };

})();