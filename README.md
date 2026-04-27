# Agent Loop Learning Plan

This folder is for learning and rebuilding a minimal agent loop step by step.
The goal is not to build a translation agent first. The goal is to understand
the full flow of creating, driving, extending, and observing an agent.

## Goal

Build a small general-purpose Agent first, then add tools, then add review and
approval flow, and finally compare the result with the existing `packages/core`
implementation.

The learning approach is:

1. Read the existing `packages/core` implementation.
2. Build a minimal version together.
3. Run it and observe the message flow.
4. Rebuild it independently to make the process familiar.
5. Compare the independent version with the project implementation.

## Stage 1: Pure Chat Agent

Create the simplest runnable agent loop.

Scope:

- Create an `AgentLoop` instance.
- Send user input with `userInput()`.
- Call `next()`.
- Print assistant text messages.
- Ignore tools, memory, translation, and UI.

Learning targets:

- Understand `ModelMessage`.
- Understand how user messages enter `Context`.
- Understand when `actor` becomes `user` or `agent`.
- Understand what `next()` returns.

Done when:

- A terminal user can type a message.
- The agent can reply.
- The loop returns to waiting for the next user input.

## Stage 2: Observe Internal State

Add debugging output so the loop is visible.

Scope:

- Print `actor`.
- Print `finishReason`.
- Print `messages`.
- Print `unprocessedToolCalls`.
- Print `copilotRequests`.

Learning targets:

- Understand the message history shape.
- Understand assistant messages versus tool messages.
- Understand why an agent loop is a state machine, not a single request.

Done when:

- Each loop iteration shows what changed.
- The message array can be read and explained manually.

## Stage 3: Add A Simple Tool

Add one small tool that is unrelated to translation.

Good first tools:

- `getTime`
- `echo`
- `randomNumber`
- `calculator`

Scope:

- Define the tool schema.
- Add the tool to `toolDefs`.
- Add the executor to `toolExecutors`.
- Let the model call the tool.
- Feed the tool result back into the loop.

Learning targets:

- Understand the difference between `toolDefs` and `toolExecutors`.
- Understand `ToolExecutor`.
- Understand how tool calls become tool results.

Done when:

- The user can ask for something that requires a tool.
- The model calls the tool.
- The tool result appears in message history.
- The model can respond using the tool result.

## Stage 4: Add Manual Approval

Add a tool that requires human approval before completing.

Scope:

- Create a tool executor that can return `copilot-request`.
- Display the request in the terminal.
- Let the user choose `approve`, `reject`, or `refined`.
- Pass the response back with `addCopilotResponses()`.
- Continue the agent loop.

Learning targets:

- Understand `CopilotRequest`.
- Understand `CopilotResponse`.
- Understand why translation uses human review.
- Understand how an agent can pause and resume.

Done when:

- A tool call can pause the loop.
- The user can approve or modify the result.
- The loop continues after approval.

## Stage 5: Add Memory

Add memory only after the basic loop and approval flow are clear.

Scope:

- Initialize `Memory`.
- Provide memory to `AgentLoop`.
- Trigger memory extraction from a rejected or refined response.
- Inspect `memory.json`.

Learning targets:

- Understand short-term context versus persistent memory.
- Understand when memory should be updated.
- Understand why memory is separate from message history.

Done when:

- A refined or rejected response can generate a memory update.
- Future agent calls can receive the memory content.

## Stage 6: Compare With Existing Core

Compare the learning implementation with the project implementation.

Files to compare:

- `packages/core/src/types.ts`
- `packages/core/src/context.ts`
- `packages/core/src/agent.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/llm.ts`
- `packages/tools-shared/src/translate-tool.ts`

Questions to answer:

- What does `AgentLoop` own?
- What does `Context` own?
- What is business logic, and what is framework logic?
- Which parts are generic agent infrastructure?
- Which parts are translation-specific?

Done when:

- The full `AgentLoop.next()` flow can be explained without reading line by line.
- A new tool can be added without guessing.
- The translation tool looks like a normal specialized tool.

## Java To TypeScript Notes

Useful mental mappings:

- `class AgentLoop` is similar to a Java service class plus state machine.
- `Context` is similar to a conversation/session context object.
- `type` declarations are similar to DTOs or interfaces.
- Union types like `"user" | "agent"` are similar to small string enums.
- `ToolExecutor` is similar to a strategy/callback interface.
- `Promise<T>` is the async return type, similar in purpose to `CompletableFuture<T>`.
- `async/await` is the normal way this code waits for asynchronous work.

Important TypeScript details in this project:

- `import type` imports only type information.
- Source files are `.ts`, but local imports use `.js` because the package uses
  Node ESM with `module: "NodeNext"`.
- `strict: true` means TypeScript will be less forgiving, which is good for
  learning the real data shape.

## Working Rule

Keep the learning implementation small.

Do not add React, Next.js, database storage, translation workflow, or UI until
the terminal-based agent loop is clear.
