// core/planning/executor.ts
// Task execution engine with rollback support

import { writeTextFile, exists, remove as removeFile, readTextFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import type {
  AnyTask,
  TaskResult,
  FileCreateTask,
  FileModifyTask,
  FileDeleteTask,
  CommandRunTask,
  AIQueryTask,
  ValidationTask,
} from './tasks';

export interface ExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  dryRun?: boolean;
}

export interface RollbackAction {
  taskId: string;
  action: () => Promise<void>;
  description: string;
}

const EXECUTOR_ALLOWED = ['npm', 'npx', 'cargo', 'python', 'python3', 'node',
  'tsc', 'git', 'eslint', 'prettier', 'jest', 'vitest', 'mkdir', 'cp', 'mv', 'rm'];

export class TaskExecutor {
  private rollbackStack: RollbackAction[] = [];
  private executionHistory: Map<string, TaskResult> = new Map();

  /**
   * Execute a single task
   */
  async executeTask(
    task: AnyTask,
    context: ExecutionContext
  ): Promise<TaskResult> {
    const startTime = Date.now();
    task.status = 'in-progress';
    task.startedAt = startTime;

    console.log(`🚀 Executing task: ${task.description}`);

    try {
      let output: any;

      // Execute based on task type
      switch (task.type) {
        case 'file-create':
          output = await this.executeFileCreate(task as FileCreateTask, context);
          break;
        case 'file-modify':
          output = await this.executeFileModify(task as FileModifyTask, context);
          break;
        case 'file-delete':
          output = await this.executeFileDelete(task as FileDeleteTask, context);
          break;
        case 'command-run':
          output = await this.executeCommand(task as CommandRunTask, context);
          break;
        case 'ai-query':
          output = await this.executeAIQuery(task as AIQueryTask, context);
          break;
        case 'validation':
          output = await this.executeValidation(task as ValidationTask, context);
          break;
        default:
          throw new Error(`Unknown task type: ${(task as any).type}`);
      }

      const result: TaskResult = {
        success: true,
        output,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };

      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = result;

      this.executionHistory.set(task.id, result);
      console.log(`✅ Task completed: ${task.description} (${result.duration}ms)`);

      return result;
    } catch (error) {
      const result: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };

      task.status = 'failed';
      task.completedAt = Date.now();
      task.result = result;

      this.executionHistory.set(task.id, result);
      console.error(`❌ Task failed: ${task.description}`, error);

      return result;
    }
  }

  /**
   * Execute multiple tasks in sequence
   */
  async executeTasks(
    tasks: AnyTask[],
    context: ExecutionContext
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      // Check dependencies
      if (task.metadata.dependencies) {
        const dependenciesMet = task.metadata.dependencies.every(depId => {
          const depResult = this.executionHistory.get(depId);
          return depResult?.success;
        });

        if (!dependenciesMet) {
          console.warn(`⏭️ Skipping task due to unmet dependencies: ${task.description}`);
          results.push({
            success: false,
            error: 'Dependencies not met',
            duration: 0,
            timestamp: Date.now(),
          });
          continue;
        }
      }

      const result = await this.executeTask(task, context);
      results.push(result);

      // Stop on failure if not retryable
      if (!result.success && !task.metadata.retryable) {
        console.error('🛑 Stopping execution due to non-retryable failure');
        break;
      }

      // Retry if failed and retryable
      if (!result.success && task.metadata.retryable) {
        const maxRetries = task.metadata.maxRetries || 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Retrying task (${retryCount}/${maxRetries}): ${task.description}`);

          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));

          const retryResult = await this.executeTask(task, context);
          results[results.length - 1] = retryResult;

          if (retryResult.success) {
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute file create task
   */
  private async executeFileCreate(
    task: FileCreateTask,
    context: ExecutionContext
  ): Promise<string> {
    if (context.dryRun) {
      return `[DRY RUN] Would create file: ${task.filePath}`;
    }

    // Check if file already exists
    if (await exists(task.filePath)) {
      throw new Error(`File already exists: ${task.filePath}`);
    }

    // Write file
    await writeTextFile(task.filePath, task.content);

    // Add rollback action
    this.addRollback(task.id, async () => {
      await removeFile(task.filePath);
    }, `Delete file: ${task.filePath}`);

    return `Created file: ${task.filePath}`;
  }

  /**
   * Execute file modify task
   */
  private async executeFileModify(
    task: FileModifyTask,
    context: ExecutionContext
  ): Promise<string> {
    if (context.dryRun) {
      return `[DRY RUN] Would modify file: ${task.filePath}`;
    }

    // Read current content
    const originalContent = await readTextFile(task.filePath);
    let lines = originalContent.split('\n');

    // Apply changes
    for (const change of task.changes) {
      switch (change.type) {
        case 'insert':
          if (change.line !== undefined) {
            lines.splice(change.line, 0, change.content);
          } else {
            lines.push(change.content);
          }
          break;
        case 'delete':
          if (change.line !== undefined) {
            lines.splice(change.line, 1);
          }
          break;
        case 'replace':
          if (change.line !== undefined) {
            lines[change.line] = change.content;
          }
          break;
      }
    }

    // Write modified content
    await writeTextFile(task.filePath, lines.join('\n'));

    // Add rollback action
    this.addRollback(task.id, async () => {
      await writeTextFile(task.filePath, originalContent);
    }, `Restore file: ${task.filePath}`);

    return `Modified file: ${task.filePath}`;
  }

  /**
   * Execute file delete task
   */
  private async executeFileDelete(
    task: FileDeleteTask,
    context: ExecutionContext
  ): Promise<string> {
    if (context.dryRun) {
      return `[DRY RUN] Would delete file: ${task.filePath}`;
    }

    // Backup content for rollback
    const content = await readTextFile(task.filePath);

    // Delete file
    await removeFile(task.filePath);

    // Add rollback action
    this.addRollback(task.id, async () => {
      await writeTextFile(task.filePath, content);
    }, `Restore file: ${task.filePath}`);

    return `Deleted file: ${task.filePath}`;
  }

  /**
   * Execute command task
   */
  private async executeCommand(
    task: CommandRunTask,
    context: ExecutionContext
  ): Promise<string> {
    if (context.dryRun) {
      return `[DRY RUN] Would run command: ${task.command}`;
    }

    // Security validation
    const baseCmd = task.command.split(/[/\\]/).pop() || task.command;
    if (!EXECUTOR_ALLOWED.includes(baseCmd)) {
      throw new Error(`Executor: '${baseCmd}' komutu izin listesinde değil. İzinli komutlar: ${EXECUTOR_ALLOWED.join(', ')}`);
    }

    // Sanitize arguments
    const dangerous = [';', '&&', '||', '|', '`', '$('];
    const allArgs = (task.args || []).join(' ');
    for (const d of dangerous) {
      if (allArgs.includes(d)) {
        throw new Error(`Executor: Argümanlarda yasaklı karakter bulundu: ${d}`);
      }
    }

    const output = await Command.create(task.command, task.args || []).execute();

    if (output.code !== 0) {
      throw new Error(`Command failed with code ${output.code}: ${output.stderr}`);
    }

    return output.stdout;
  }

  /**
   * Execute AI query task
   */
  private async executeAIQuery(
    task: AIQueryTask,
    context: ExecutionContext
  ): Promise<string> {
    if (context.dryRun) {
      return `[DRY RUN] Would query AI: ${task.query}`;
    }

    const { callAI } = await import('../../services/aiProvider');

    const response = await callAI(task.query, '', [
      { role: 'user', content: task.query }
    ]);

    return response;
  }

  /**
   * Execute validation task
   */
  private async executeValidation(
    task: ValidationTask,
    context: ExecutionContext
  ): Promise<string> {
    if (context.dryRun) {
      return `[DRY RUN] Would validate: ${task.target}`;
    }

    // Implement validation based on type
    const workDir = context.workingDirectory;

    switch (task.validationType) {
      case 'syntax': {
        const out = await Command.create('tsc', ['--noEmit', '--skipLibCheck'], { cwd: workDir }).execute();
        if (out.code !== 0) throw new Error(`TypeScript hataları:\n${out.stderr}`);
        return 'TypeScript syntax doğrulaması başarılı';
      }
      case 'lint': {
        const out = await Command.create('npx', ['eslint', task.target || '.', '--max-warnings=0'], { cwd: workDir }).execute();
        if (out.code !== 0) throw new Error(`ESLint hataları:\n${out.stdout}`);
        return 'Lint kontrolü başarılı';
      }
      case 'test': {
        const out = await Command.create('npm', ['test', '--', '--passWithNoTests'], { cwd: workDir }).execute();
        if (out.code !== 0) throw new Error(`Testler başarısız:\n${out.stdout}`);
        return `Testler başarıyla tamamlandı:\n${out.stdout.slice(0, 500)}`;
      }
      case 'build': {
        const out = await Command.create('npm', ['run', 'build'], { cwd: workDir }).execute();
        if (out.code !== 0) throw new Error(`Build hatası:\n${out.stderr}`);
        return 'Proje başarıyla build edildi';
      }
      default:
        throw new Error(`Unknown validation type: ${task.validationType}`);
    }
  }

  /**
   * Add rollback action
   */
  private addRollback(
    taskId: string,
    action: () => Promise<void>,
    description: string
  ): void {
    this.rollbackStack.push({ taskId, action, description });
  }

  /**
   * Rollback all executed tasks
   */
  async rollback(): Promise<void> {
    console.log(`🔄 Rolling back ${this.rollbackStack.length} actions...`);

    // Execute rollback actions in reverse order
    while (this.rollbackStack.length > 0) {
      const rollbackAction = this.rollbackStack.pop();
      if (rollbackAction) {
        try {
          console.log(`↩️ ${rollbackAction.description}`);
          await rollbackAction.action();
        } catch (error) {
          console.error(`❌ Rollback failed: ${rollbackAction.description}`, error);
        }
      }
    }

    console.log('✅ Rollback complete');
  }

  /**
   * Clear rollback stack
   */
  clearRollback(): void {
    this.rollbackStack = [];
  }

  /**
   * Get execution history
   */
  getHistory(): Map<string, TaskResult> {
    return new Map(this.executionHistory);
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory.clear();
  }
}
