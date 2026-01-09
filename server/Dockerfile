FROM node:18-alpine

WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装生产依赖
RUN npm install --production

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 13141

# 启动命令
CMD ["node", "server.js"]
