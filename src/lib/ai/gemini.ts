
/**
 * @file Gemini APIとの連携ロジック
 *
 * WBSの自動生成、計画の自動リコメンド、一日のふりかえり分析など、
 * 本アプリケーションのコアとなるAI機能のすべてをこのファイルで管理します。
 */

import { GoogleGenerativeAI, GenerationConfig, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 安全性設定を低く設定
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// JSONモードを有効にするための生成設定
const generationConfig: GenerationConfig = {
  response_mime_type: "application/json",
};


/**
 * KGI（最終目的）に基づき、WBSを自動生成する
 * @param kgi - ユーザーが入力した最終目的
 * @returns 生成されたWBSオブジェクト
 */
export async function generateWbsFromKgi(kgi: string) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
    safetySettings,
    generationConfig
  });

  const prompt = `
# 命令書

あなたは優秀なプロジェクトマネージャーです。
ユーザーのKGI（Key Goal Indicator）を達成するためのWBS（Work Breakdown Structure）を生成してください。

## KGI
${kgi}

## 生成ルール
- WBSは最大5階層で構成してください。
- 各項目は具体的かつ簡潔な名称にしてください。
- 出力は必ず指定されたJSON形式に従ってください。他のテキストは一切含めないでください。

## 出力JSON形式
```json
{
  "id": "wbs-root",
  "name": "KGIの名称",
  "children": [
    {
      "id": "kpi-1",
      "name": "KPI（中間目標）1",
      "children": [
        {
          "id": "task-1-1",
          "name": "マイルストーンやタスク",
          "children": [
            {
              "id": "todo-1-1-1",
              "name": "具体的なToDo"
            }
          ]
        }
      ]
    }
  ]
}
```
`;
  
  console.log("Generating WBS for KGI:", kgi);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  console.log("Gemini Response Text:", text);

  try {
    // Geminiからの応答テキストをJSONとしてパースする
    const wbsData = JSON.parse(text);
    return wbsData;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("AIからの応答を解析できませんでした。");
  }
}
