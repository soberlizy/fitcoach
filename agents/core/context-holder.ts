import type { MemoryContext } from '../memory';

let currentContext: MemoryContext | null = null;

export function setAgentContext(context: MemoryContext): void {
  currentContext = context;
}

export function getAgentContext(): MemoryContext | null {
  return currentContext;
}

export function clearAgentContext(): void {
  currentContext = null;
}
