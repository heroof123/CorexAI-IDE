export interface SurroundSnippet {
    id: string;
    label: string;
    description: string;
    language: string[];
    // Use $1 as the placeholder for the selected text
    template: string;
}

export const surroundSnippets: SurroundSnippet[] = [
    {
        id: 'try_catch',
        label: 'Try..Catch Block',
        description: 'Wrap selection in try..catch',
        language: ['typescript', 'javascript'],
        template: `try {
    $1
} catch (error) {
    console.error(error);
}`
    },
    {
        id: 'if_condition',
        label: 'If Condition',
        description: 'Wrap selection in if condition',
        language: ['typescript', 'javascript', 'python', 'rust'],
        template: `if (condition) {
    $1
}`
    },
    {
        id: 'async_iff',
        label: 'Async IIFE',
        description: 'Wrap in immediately invoked async function expression',
        language: ['typescript', 'javascript'],
        template: `(async () => {
    $1
})();`
    },
    {
        id: 'console_log',
        label: 'Console.Log',
        description: 'Wrap inside console.log()',
        language: ['typescript', 'javascript'],
        template: `console.log($1);`
    }
];

class SurroundWithSnippetService {
    public getApplicableSnippets(language: string): SurroundSnippet[] {
        return surroundSnippets.filter(s => s.language.includes(language.toLowerCase()));
    }

    public surround(actionId: string, selection: string): string | null {
        const snippet = surroundSnippets.find(s => s.id === actionId);
        if (!snippet) return null;

        // Indent selection correctly if snippet spans multiple lines
        const lines = selection.split('\\n');

        let formattedSelection: string;
        if (lines.length > 1) {
            formattedSelection = lines.join('\\n    ');
        } else {
            formattedSelection = selection;
        }

        return snippet.template.replace(/\\$1/g, formattedSelection);
    }
}

export const surroundWithSnippetService = new SurroundWithSnippetService();
