# AI 知识库与 RAG 学习系统 (Knowledge Hub)

基于 **NestJS + PostgreSQL (TypeORM/pgvector) + MongoDB (Mongoose) + Cloudflare R2 + RabbitMQ + Elasticsearch (IK分词) + Kibana** 搭建的双库联动、多格式解析与 RAG 异步处理后端。

---

## 🛠️ 快速启动指南

### 1. 启动基础设施服务 (Docker Compose)

在根目录下执行以下命令，即可一键拉起 PostgreSQL (pgvector)、pgAdmin、MongoDB、Mongo Express、RabbitMQ、Elasticsearch (含 IK 中文分词)、Kibana 及 Cloudflare Tunnel 穿透服务：

```bash
docker compose up -d
```

### 2. 启动 NestJS 后端服务

```bash
# 安装依赖
pnpm install

# 启动开发热重载模式
pnpm run start:dev
```

后端服务将在 **http://localhost:8521** 启动。

---

## 🌐 本地控制面板访问指南

| 服务名称 | 访问地址 | 登录凭据 / 说明 |
| :--- | :--- | :--- |
| **NestJS 后端 API** | [http://localhost:8521](http://localhost:8521) | 应用服务主入口（Port: `8521`） |
| **pgAdmin (PostgreSQL)** | [http://localhost:8088](http://localhost:8088) | 账号：`admin@admin.com` / 密码：`admin` |
| **Mongo Express (MongoDB)** | [http://localhost:8081](http://localhost:8081) | 账号：`me_admin` / 密码：`me_123456` |
| **RabbitMQ 控制台** | [http://localhost:15672](http://localhost:15672) | 账号：`guest` / 密码：`guest` |
| **Elasticsearch (包含 IK 分词)** | [http://localhost:9200](http://localhost:9200) | 免密访问（端口：`9200`） |
| **Kibana 控制面板** | [http://localhost:5601](http://localhost:5601) | ES 可视化调试面板（端口：`5601`） |
| **Neo4j 知识图谱控制台** | [http://localhost:7474](http://localhost:7474) | 账号：`neo4j` / 密码：`12345678` (Bolt: `7687`) |

---

## 📄 支持的文件解析格式

系统内置强大的多格式解析引擎（位于 `src/document/parsers/`），上传文件后自动转换为干净的标准 Markdown：
- **`.docx`**（支持多语言标题映射 + 自动上传图片至 Cloudflare R2）
- **`.pdf`**（支持并发上传图片至 R2 + 表格抽取 + WASM 内存销毁保护）
- **`.xlsx`**（支持多 Sheet 格式化 + 公式/富文本解析 + 列齐整）
- **`.pptx`**（自研 ZIP/OOXML 幻灯片解析 + officeparser 降级保护）
- **`.txt` / `.md`**（纯文本解码与格式清洗）
