/**
 * Chat Todo List Part
 * AI'ın veya sistemin görev listesini göstermek için
 */


export interface TodoItem {
    id: string;
    label: string;
    done: boolean;
}

export interface TodoListPartData {
    title?: string;
    tasks: TodoItem[];
}

export function ChatTodoListPart({ data, onToggle }: { data: TodoListPartData, onToggle?: (taskId: string, current: boolean) => void }) {
    if (!data?.tasks?.length) return null;

    const total = data.tasks.length;
    const completed = data.tasks.filter(t => t.done).length;
    const progress = Math.round((completed / total) * 100);

    return (
        <div className="bg-[#181818] border border-neutral-700/50 rounded-lg p-3 my-2 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            {data.title && (
                <div className="text-xs font-semibold text-neutral-300 mb-2 flex items-center justify-between">
                    <span>{data.title}</span>
                    <span className="text-[10px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">
                        {completed}/{total}
                    </span>
                </div>
            )}

            {/* Progress bar */}
            <div className="w-full bg-neutral-800 rounded-full h-1.5 mb-3 overflow-hidden">
                <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-neutral-400">
                {data.tasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2 group">
                        <button
                            onClick={() => onToggle?.(task.id, task.done)}
                            className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer ${task.done
                                ? 'bg-blue-500 border-blue-500 text-[#181818]'
                                : 'bg-neutral-800 border-neutral-600 group-hover:border-blue-500/50'
                                }`}
                        >
                            {task.done && (
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </button>
                        <span className={`flex-1 transition-all ${task.done ? 'line-through text-neutral-600' : 'text-neutral-300'}`}>
                            {task.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
