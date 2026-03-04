export interface SearchMatch {
    file: string;
    line: number;
    column: number;
    text: string;
    matchStart: number;
    matchEnd: number;
}

export interface SearchOptions {
    query: string;
    isRegex?: boolean;
    matchCase?: boolean;
    matchWholeWord?: boolean;
    includes?: string; // "*.ts, *.tsx"
    excludes?: string; // "node_modules, dist"
}

export interface FileIndexItem {
    path: string;
    content: string;
}

class SearchService {
    private static instance: SearchService;

    private constructor() { }

    public static getInstance(): SearchService {
        if (!SearchService.instance) {
            SearchService.instance = new SearchService();
        }
        return SearchService.instance;
    }

    /**
     * Düz metin veya Regex araması
     */
    public async searchFiles(options: SearchOptions, fileIndex: FileIndexItem[]): Promise<SearchMatch[]> {
        const results: SearchMatch[] = [];

        try {
            let searchPattern: RegExp;

            if (options.isRegex) {
                // Güvenli regex pattern'ı oluşturmaya çalış
                try {
                    searchPattern = new RegExp(options.query, options.matchCase ? 'g' : 'gi');
                } catch {
                    // Hatalı regex verilirse bulamayacak dönmek mantıklı
                    return [];
                }
            } else {
                const escapedQuery = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = options.matchWholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
                searchPattern = new RegExp(pattern, options.matchCase ? 'g' : 'gi');
            }

            // Dosya filtreleme (Glob vs)
            const includeRegex = options.includes ? this.globToRegex(options.includes) : null;
            const excludeRegex = options.excludes ? this.globToRegex(options.excludes) : null;

            for (const file of fileIndex) {
                const fileName = file.path.split(/[/\\]/).pop() || '';

                if (includeRegex && !includeRegex.test(fileName) && !includeRegex.test(file.path)) continue;
                if (excludeRegex && (excludeRegex.test(fileName) || excludeRegex.test(file.path))) continue;

                const lines = file.content.split('\n');

                lines.forEach((line, lineIndex) => {
                    let match;
                    searchPattern.lastIndex = 0; // Regex arama indisini her satırda sıfırla

                    while ((match = searchPattern.exec(line)) !== null) {
                        results.push({
                            file: file.path,
                            line: lineIndex + 1,
                            column: match.index + 1,
                            text: line,
                            matchStart: match.index,
                            matchEnd: match.index + match[0].length,
                        });

                        // Regex sıfır uzunluklu eşletirse sonsuz döngü engelle
                        if (match.index === searchPattern.lastIndex) {
                            searchPattern.lastIndex++;
                        }
                    }
                });
            }
        } catch (error) {
            console.error("Arama servisinde hata:", error);
        }

        return results;
    }

    private globToRegex(glob: string): RegExp {
        const parts = glob.split(',').map(s => s.trim()).filter(Boolean);
        const mapped = parts.map(p => {
            let regexStr = p.replace(/\./g, '\\.');
            regexStr = regexStr.replace(/\*/g, '.*');
            return `^.*${regexStr}$`;
        });
        return new RegExp(`(${mapped.join('|')})`, 'i');
    }
}

export const searchService = SearchService.getInstance();
