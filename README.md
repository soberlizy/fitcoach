# FitCoach - 智能健身助手

基于 AI Agent 的智能健身助手，具有自主决策能力，可以根据用户的身体情况、训练计划和饮食记录提供个性化的健身建议。

## 功能特性

- **AI Agent 对话**：通过自然语言与 AI 健身助手交流
- **训练计划管理**：生成、查看、调整个人训练计划
- **饮食分析**：拍照识别食物并估算热量
- **体脂分析**：上传照片估算体脂率
- **进度评估**：根据训练记录评估健身进度
- **主动关怀**：AI 会主动关注用户状态变化并提供建议

## 技术架构

- **框架**：Next.js 16 + React 19
- **AI SDK**：@anthropic-ai/sdk
- **样式**：Tailwind CSS
- **存储**：IndexedDB (本地持久化)
- **Agent**：基于 ReAct 模式的自主决策引擎

## 环境要求

- Node.js 18+
- npm / yarn / pnpm

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_BASE_URL=your_anthropic_base_url

# 或者使用其他支持 Anthropic 协议的服务商
# ANTHROPIC_BASE_URL=https://your-api-endpoint/v1

# 模型配置（根据你的服务商选择）
AI_TEST_AGENT_MODEL=your-model-name
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
fitcoach/
├── agents/                    # AI Agent 核心
│   ├── core/
│   │   ├── agent.ts          # Agent 主入口
│   │   ├── reasoning.ts      # 推理引擎
│   │   ├── memory.ts         # 记忆系统
│   │   ├── context-holder.ts # 上下文管理
│   │   └── types.ts          # 类型定义
│   ├── tools/                # 工具注册
│   │   ├── base.ts           # 工具基类
│   │   ├── fitness-tools.ts  # 健身相关工具
│   │   ├── knowledge-tools.ts# 知识类工具
│   │   └── query-tools.ts    # 查询类工具
│   └── prompts/              # 提示词
│       ├── system-prompt.ts  # 系统提示词
│       └── react-prompt.ts   # ReAct 提示词
├── lib/
│   ├── anthropic.ts          # Anthropic SDK 封装
│   └── storage.ts            # IndexedDB 存储
├── pages/
│   ├── index.tsx             # 首页
│   └── chat.tsx              # AI 对话页面
└── styles/
    └── globals.css           # 全局样式
```

## 工具系统

AI Agent 通过工具与外界交互，支持以下工具：

| 工具名称 | 功能描述 |
|---------|---------|
| query_user_profile | 查询用户档案信息 |
| query_training_plan | 查询当前训练计划 |
| query_workout_logs | 查询训练记录 |
| query_diet_logs | 查询饮食记录 |
| analyze_body_fat | 分析体脂率（需照片） |
| generate_plan | 生成训练计划 |
| analyze_food | 分析食物热量（需照片） |
| assess_progress | 评估健身进度 |
| generate_motivation | 生成激励消息 |

## Agent 工作流程

```
用户消息 → 推理引擎 → [需要工具?] 
                           ↓
                    执行工具 → 返回结果
                           ↓
                     继续推理 → 最终回答
```

推理引擎使用 SDK 的 function calling 能力，自动解析和执行工具调用。

## 数据存储

所有数据存储在浏览器 IndexedDB 中：

- 用户档案
- 训练计划
- 训练/饮食记录
- 对话历史（支持多会话）

## 常见问题

### Q: 聊天时 AI 没有调用工具直接回复
A: 检查 `ANTHROPIC_BASE_URL` 是否配置正确，确保服务商支持 function calling。

### Q: 聊天记录没有保存
A: 确认浏览器允许 IndexedDB，尝试强制刷新或清除浏览器数据后重试。

### Q: 工具调用报错
A: 查看浏览器控制台日志，常见问题包括环境变量未配置或 API Key 无效。

## 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 运行 ESLint
```

## 许可证

MIT
