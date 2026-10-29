/**
 * SyntaxHighlight — tag-to-language config and lookup helper.
 *
 * Tag keys are lowercase. Each entry maps one or more tag aliases to a single
 * hljs language name.  Add or override entries freely; the lookup is O(1).
 *
 * IMPORTANT: Only list hljs language names that are actually registered in
 * the highlight.min.js bundle loaded by index.html. Unregistered names will
 * silently fall back to plain text via the safety check in ui.js.
 */
const SyntaxHighlight = (() => {

    // Map: normalised-tag -> hljs language id
    // One entry per tag alias; multiple aliases can share the same hljs id.
    const TAG_LANG_MAP = {

        // --- Web / scripting ---
        "javascript": "javascript", "js": "javascript",
        "typescript": "typescript", "ts": "typescript",
        "php": "php", "php8": "php", "php8.4": "php", "php7": "php",
        "python": "python", "python3": "python", "py": "python",
        "ruby": "ruby", "rb": "ruby",
        "lua": "lua",
        "perl": "perl",
        "r": "r",

        // --- Compiled / systems ---
        "c": "c",
        "cpp": "cpp", "c++": "cpp",
        "csharp": "csharp", "c#": "csharp", "dotnet": "csharp", ".net": "csharp",
        "java": "java",
        "kotlin": "kotlin", "kt": "kotlin",
        "swift": "swift",
        "go": "go", "golang": "go",
        "rust": "rust", "rs": "rust",
        "scala": "scala",

        // --- Shell / ops ---
        "bash": "bash", "sh": "bash", "shell": "shell",
        "powershell": "powershell", "pwsh": "powershell",
        "dockerfile": "dockerfile", "docker": "dockerfile",
        "nginx": "nginx",
        "vim": "vim",

        // --- Data / config ---
        "sql": "sql", "mysql": "sql", "postgresql": "sql",
            "pgsql": "sql", "sqlite": "sql",
        "json": "json",
        "yaml": "yaml", "yml": "yaml",
        "xml": "xml", "html": "xml", "svg": "xml",
        "css": "css", "scss": "css", "less": "css",
        "ini": "ini", "toml": "ini", "conf": "ini",
        "markdown": "markdown", "md": "markdown",
    };

    /**
     * Return the hljs language identifier for the first recognised tag,
     * or null if none of the note's tags match a known language.
     * @param {string[]} tags
     * @returns {string|null}
     */
    function getLangFromTags(tags) {
        if (!Array.isArray(tags)) return null;
        for (const tag of tags) {
            const lang = TAG_LANG_MAP[(tag || "").toLowerCase().trim()];
            if (lang) return lang;
        }
        return null;
    }

    return { getLangFromTags, TAG_LANG_MAP };

})();
