const SearchConfig = {
    score: {
        title: 100,
        tags: 30,
        body: 5
    },

    priorities: {
        "Lowest": 0.5,
        "Low": 0.75,
        "Normal": 1.0,
        "High": 2.0,
        "Highest": 4.0
    },

    defaultPriority: "Normal",

    minTokenLength: 2,

    caseSensitive: false,

    splitUnderscore: true,

    debounceMs: 180,

    maxResults: 20,

    previewLines: 6
};