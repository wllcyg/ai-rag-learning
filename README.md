# AI RAG Learning (Knowledge Hub Backend)

基于 **NestJS** + **PostgreSQL (pgvector)** + **MongoDB** + **Cloudflare Tunnel** 的 AI 检索增强生成 (RAG) 知识库后端实践项目。

---

## 🌐 基础设施服务与外网访问映射

本项目支持通过 **Cloudflare Tunnel** 进行公网安全的免端口映射访问：

| 服务组件 | 本地服务端口 | 外网 HTTPS / TCP 访问域名 (`yourdomain.com`) | 认证密码 / 凭据 |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 数据库** | `localhost:5432` | `pgdb.yourdomain.com` (TCP) | **用户**: `user`<br>**密码**: `123456`<br>**库名**: `knowledge_hub` |
| **pgAdmin Web UI** | `localhost:8088` | `https://pgadmin.yourdomain.com` | **邮箱**: `admin@admin.com`<br>**密码**: `admin` |
| **MongoDB 数据库** | `localhost:27017` | `mongodb.yourdomain.com` (TCP) | **用户**: `mongo_user`<br>**密码**: `mongo_pass123`<br>**库名**: `knowledge_hub` |
| **Mongo Express Web UI** | `localhost:8081` | `https://mongo.yourdomain.com` | **账号**: `me_admin`<br>**密码**: `me_123456` |
| **NestJS 后端 API** | `localhost:8521` | `https://api.yourdomain.com` | 开放 REST API 接口 |

---

## 💻 异地 / 公司电脑远程开发连接指南

在公司电脑开发本项目时，连接家里电脑运行的 Docker 数据库有以下几种常用姿势：

### 姿势一：通过 Cloudflare TCP 隧道桥接（推荐，项目原生支持）
在公司电脑上运行简易 `cloudflared` 命令建立本地端口监听：

```bash
# 1. 将家里的 PostgreSQL 映射到公司电脑本地 5432 端口
cloudflared access tcp --hostname pgdb.yourdomain.com --url 127.0.0.1:5432 &

# 2. 将家里的 MongoDB 映射到公司电脑本地 27017 端口
cloudflared access tcp --hostname mongodb.yourdomain.com --url 127.0.0.1:27017 &
```

在公司电脑运行 `pnpm run start:dev`，项目的 `.env` 配置无需更改（继续连接 `127.0.0.1:5432` / `27017`），流量会自动加密穿透连接家里数据库。

### 姿势二：免安装纯网页界面管理
在公司电脑免安装任何软件，直接打开浏览器访问：
- **pgAdmin**: `https://pgadmin.yourdomain.com`
- **Mongo Express**: `https://mongo.yourdomain.com`

---

## 🚀 本地开发快速开始

### 1. 启动基础设施与内网穿透 (Docker)

```bash
# 启动 PostgreSQL (pgvector)、MongoDB、Web UI 以及 Cloudflare Tunnel
docker compose up -d

# 查看容器运行与健康状态
docker compose ps
```

### 2. 安装项目依赖

```bash
pnpm install
```

### 3. 运行 NestJS 开发服务器

```bash
# 开发模式（监听热重载）
pnpm run start:dev

# 构建生产包
pnpm run build
pnpm run start:prod
```

### 4. 本地控制面板访问指南

#### 🍃 MongoDB 控制面板 (Mongo Express)
- **访问地址**：[http://localhost:8081](http://localhost:8081)
- **网页登录凭据**（Basic Auth 弹窗）：账号 `me_admin` / 密码 `me_123456`
- **说明**：登录后已自动连接 MongoDB，可直观查看/管理 `knowledge_hub` 数据库及 `document_content` 集合。

#### 🐘 PostgreSQL 控制面板 (pgAdmin)
- **访问地址**：[http://localhost:8088](http://localhost:8088)
- **网页登录凭据**：邮箱 `admin@admin.com` / 密码 `admin`
- **首次连接配置**：
  1. 点击 **Add New Server**。
  2. 在 **General** 中填写名称（如 `knowledge_hub`）。
  3. 在 **Connection** 中填写：
     - **Host**：`postgres`（Docker 内部域名）或 `host.docker.internal`
     - **Port**：`5432`
     - **Maintenance database**：`knowledge_hub`
     - **Username**：`user` / **Password**：`123456`

#### 🚀 NestJS 后端服务
- **访问地址**：[http://localhost:8521](http://localhost:8521)

### 5. 运行单元与端到端测试

```bash
pnpm run test
pnpm run test:e2e
```
