import * as dotenv from "dotenv";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

// 1. 加载环境变量
dotenv.config({ path: "../.env" });

// 2. 配置提供商
const provider = createOpenAICompatible({
    name: "openai-compatible",
    baseURL: process.env.OPENAI_BASE_URL as string,
    apiKey: process.env.OPENAI_API_KEY as string,
});

// 3. 指定模型
const model = provider(process.env.OPENAI_MODEL as string);

async function main() {
    const result = await generateText({
        model: model,
        prompt: "In a few words to explain what the meaning of the life?",
    });
    console.log(result.text);
}

main()
