
import {tool, generateText, type ModelMessage, type UserModelMessage, ToolCallPart, ToolResultPart} from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;
type ResponseMessage = GenerateTextResult["response"]["messages"][number];


const provider = createOpenAICompatible({
    name: "openai-compatible",
    baseURL: process.env.OPENAI_BASE_URL as string,
    apiKey: process.env.OPENAI_API_KEY as string,
});

const model = provider(process.env.OPENAI_MODEL as string);

// 定义工具
const toolDefs = {
    getTime: tool({
        description: "Get the current local time",
        inputSchema: z.object({}),
    }),
};

class SimpleAgentLoop {
    private messages: ModelMessage[] = [];

    // 用户输入
    public userInput(text: string) {
        this.messages.push({
            role: "user",
            content: text,
        } as UserModelMessage);
    }

    public async next() {
        const unprocessedToolCalls = this.getUnprocessedToolCalls();

        if (unprocessedToolCalls.length > 0) {
            const toolResults = unprocessedToolCalls.map((toolCall) => {
                return this.executeToolCall(toolCall);
            });

            const toolMessage: ModelMessage = {
                role: "tool",
                content: toolResults,
            };

            this.messages.push(toolMessage);

            // 当 agent 产生结果之后，需要 LLM 对于结果做一个输出
            return {
                actor: "agent" as const,
                messages: [toolMessage],
                finishReason: undefined,
                unprocessedToolCalls: this.getUnprocessedToolCalls(),
                copilotRequests: [],
            }
        }

        const result = await generateText({
            model,
            system: "You are a helpful assistant. Answer clearly and simply.",
            messages: this.messages,
            // 让模型知道有这么一个工具
            tools: toolDefs,
        });


        const hiddenMessages = this.hiddenMessages(result.response.messages)
        this.messages.push(...hiddenMessages);

        const toolCalls = this.getToolCallsFromMessages(result.response.messages);

        return {
            actor: toolCalls.length > 0 ? "agent" as const : "user" as const,
            messages: hiddenMessages,
            finishReason: result.finishReason,
            // 如果 assistant 发起了 tool-call，但还没有对应 tool-result，这里就会有东西
            unprocessedToolCalls: toolCalls,
            // Agent 暂停等待人类反馈
            copilotRequests: [],
        };
    }

    public getMessages() {
        return this.messages;
    }

    private hiddenMessages(messages: ResponseMessage[]): ResponseMessage[] {
        return messages.map((message) => {
            if (message.role !== "assistant") {
                return message;
            }

            if (!Array.isArray(message.content)) {
                return message;
            }

            return {
                ...message,
                content: message.content.map((part) => {
                    if (part.type === "reasoning") {
                        return {
                            ...part,
                            text: "[reasoning hidden]",
                        };
                    }
                    return part;
                }),
            };
        });
    }

    // 将大模型输出的信息中包含 tool-call的提取出来，封装到toolCalls数组中
    private getToolCallsFromMessages(messages: ResponseMessage[]) {
        const toolCalls = [];

        for (const message of messages) {
            if (message.role !== "assistant") {
                continue;
            }

            if (!Array.isArray(message.content)) {
                continue;
            }

            for (const part of message.content) {
                if (part.type === "tool-call") {
                    toolCalls.push(part);
                }
            }
        }

        return toolCalls;
    }

    // 执行工具的函数
    public executeToolCall(toolCall: ToolCallPart): ToolResultPart {
        if (toolCall.toolName === "getTime") {
            return {
                type: "tool-result",
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                output: {
                    type: "json",
                    value: {
                        now: new Date().toLocaleString(),
                    }
                },
            };
        }

        // 其他未知工具 （模型调用错误）
        return {
            type: "tool-result",
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            output: {
                type: "error-text",
                value: `Unknown tool: ${toolCall.toolName}`,
            },
        };
    }

    // 添加工具调用结果信息到 messages
    public addToolResuts(toolResults: ToolResultPart[]) {
        this.messages.push({
            role: "tool",
            content: toolResults,
        })
    }

    private getUnprocessedToolCalls(): ToolCallPart[] {
        const parts: Record<string, ToolCallPart> = {};

        for (const message of this.messages) {
            if (message.role === "assistant" && Array.isArray(message.content)) {
                for (const part of message.content) {
                    if (part.type === "tool-call") {
                        parts[part.toolCallId] = part;
                    }
                }
            }

            if (message.role === "tool") {
                for (const part of message.content) {
                    if (part.type === "tool-result") {
                        delete parts[part.toolCallId];
                    }
                }
            }
        }
        return Object.values(parts);
    }

}




function getAssistantText(message: ModelMessage): string {
    if (message.role !== "assistant") {
        return "";
    }

    if (typeof message.content === "string") {
        return message.content;
    }

    if (Array.isArray(message.content)) {
        return message.content
            // 这里的 map 是创建一个新的数组然后进行返回
            .map((part) => {
                // 如果 part 类型是文本，直接返回
                if (part.type === "text") {
                    return part.text;
                }
                // 如果 part 是其他类型，直接返回空字符串
                return "";
            })
            // join函数是指将数组中所有的元素用""进行连接，并返回一个字符串类型
            .join("");
    }

    return "";
}

function printDebugState(result:{
    actor: "user" | "agent";
    messages: ModelMessage[];
    finishReason: string | undefined;
    unprocessedToolCalls: unknown[];
    copilotRequests: unknown[];
}, allMessages: ModelMessage[]) {
    console.log("--- Debug State ---");
    console.log("actor", result.actor);
    console.log("finishReason:", result.finishReason);
    console.log("new messages:");
    console.dir(result.messages, {depth: null});
    console.log("-------------------");
    console.log("all messages count:", allMessages.length);
    console.log("all messages:");
    console.dir(allMessages, { depth: null });
    console.log("unprocessedToolCalls:", result.unprocessedToolCalls);
    console.log("copilotRequests:", result.copilotRequests);
    console.log("-------------------");
}


async function main() {
    let actor : "user" | "agent" = "user";

    const agent = new SimpleAgentLoop();

    const rl = createInterface({
        input,
        output,
    });

    while (true) {
        if (actor === "user") {
            const userText = await rl.question("You: ");
            if (userText.trim().toLowerCase() === "exit") {
                break;
            }
            agent.userInput(userText);

        }

        const result = await agent.next();

        for (const message of result.messages) {
            // 遍历result.messages消息数组
            const text = getAssistantText(message);

            if (text) {
                console.log(`Assistant: ${text}`);
            }
        }

        //  result -> 大模型回复的 result，agent.getMessages() -> 所有的消息
        //printDebugState(result, agent.getMessages());

        actor = result.actor;
    }

    rl.close();
}

main().catch((error) => {
    console.error(error);
});
