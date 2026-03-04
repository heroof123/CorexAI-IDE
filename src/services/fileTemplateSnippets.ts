export interface FileTemplate {
    name: string;
    extension: string;
    language: string;
    content: string;
}

export const fileTemplates: Record<string, FileTemplate> = {
    'tsx': {
        name: 'React Component (TS)',
        extension: '.tsx',
        language: 'typescript',
        content: `import React from 'react';

/**
 * $1 Component
 */
export interface $1Props {
    // Defines props here
}

export default function $1({ }: $1Props) {
    return (
        <div className="$1-container">
            {/* Component content goes here */}
        </div>
    );
}
`
    },
    'ts': {
        name: 'TypeScript Module',
        extension: '.ts',
        language: 'typescript',
        content: `/**
 * $1 Module
 * Description: 
 */

export class $1 {
    constructor() {
        
    }
}
`
    },
    'rs': {
        name: 'Rust Module',
        extension: '.rs',
        language: 'rust',
        content: `// $1 Module

pub fn initialize_$1() -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initialize_$1() {
        assert_eq!(initialize_$1(), Ok(()));
    }
}
`
    },
    'py': {
        name: 'Python Script',
        extension: '.py',
        language: 'python',
        content: `"""
$1 Module
"""

def main():
    print("Running $1")

if __name__ == "__main__":
    main()
`
    }
};

/**
 * Utility to generate template by file name
 */
export function generateTemplate(filename: string): string | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    const basename = filename.split('.').slice(0, -1).join('.') || 'Component';

    // Capitalize for class/component names
    const Name = basename.charAt(0).toUpperCase() + basename.slice(1);

    if (ext && fileTemplates[ext]) {
        return fileTemplates[ext].content.replace(/\\$1/g, Name);
    }

    return null;
}
