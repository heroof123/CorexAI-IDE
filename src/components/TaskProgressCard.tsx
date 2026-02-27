import { AgentTask, TaskStep } from "../types/agent.ts";

interface TaskProgressCardProps {
    task: AgentTask;
}

export function TaskProgressCard({ task }: TaskProgressCardProps) {
    if (!task) return null;

    const totalSteps = task.steps.length;
    const completedSteps = task.steps.filter((s) => s.status === "completed").length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return (
        <div className="bg-[#1e1e1e] border border-neutral-700 rounded-lg p-2.5 my-2 font-mono text-xs shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 border-b border-neutral-700 pb-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <div>
                        <h3 className="font-bold text-neutral-200">{task.title}</h3>
                        <div className="text-[10px] text-neutral-500">
                            {completedSteps}/{totalSteps} Steps • {Math.round(progress)}%
                        </div>
                    </div>
                </div>
                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${task.status === "completed" ? "bg-green-900/30 text-green-400 border border-green-800" :
                    task.status === "failed" ? "bg-red-900/30 text-red-400 border border-red-800" :
                        "bg-blue-900/30 text-blue-400 border border-blue-800 animate-pulse"
                    }`}>
                    {task.status.toUpperCase()}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-neutral-800 h-1 rounded-full mb-3 overflow-hidden">
                <div
                    className="h-full bg-blue-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {task.steps.map((step, index) => (
                    <StepItem key={step.id} step={step} index={index} />
                ))}
            </div>
        </div>
    );
}

function StepItem({ step, index }: { step: TaskStep; index: number }) {
    const isCompleted = step.status === "completed";
    const isFailed = step.status === "failed";
    const isInProgress = step.status === "in-progress";
    const isPending = step.status === "pending";

    return (
        <div className={`flex gap-2 p-1.5 rounded transition-colors ${isCompleted ? "opacity-60 hover:opacity-80" :
            isInProgress ? "bg-neutral-800 border-l border-blue-500" :
                "opacity-40"
            }`}>
            {/* Icon */}
            <div className="mt-0.5 min-w-[16px] text-center text-[10px]">
                {isCompleted && "✅"}
                {isFailed && "❌"}
                {isInProgress && <span className="animate-spin inline-block">⏳</span>}
                {isPending && <span className="text-neutral-600 font-bold">{index + 1}.</span>}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className={`font-semibold text-[11px] ${isCompleted ? "line-through text-neutral-500" : "text-neutral-300"}`}>
                    {step.description}
                </div>

                {step.toolCall && (
                    <div className="text-[9px] text-blue-400 mt-0.5 font-mono truncate opacity-80">
                        🔧 {step.toolCall.name}(...)
                    </div>
                )}
            </div>
        </div>
    );
}
