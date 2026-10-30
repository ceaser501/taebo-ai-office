# Hugging Face Spaces(Docker, 무료 CPU)용. 이 파일과 README.md 두 개만 Space 에 올리면 된다.
# 빌드할 때마다 GitHub main 브랜치의 최신 코드를 받아 온다(파일 이름이 같아도 내용이 바뀌면 다시 받는다).
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git curl ca-certificates python3 python3-pip \
 && pip3 install --no-cache-dir --break-system-packages python-pptx \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force

# Hugging Face 는 uid 1000 사용자로 돌린다 — node 이미지의 node 사용자가 1000
USER node
ENV HOME=/home/node PORT=7860 MODE=claude WORKSPACE=/tmp/office-workspace
WORKDIR /home/node/app
ADD --chown=node:node https://github.com/ceaser501/taebo-ai-office/archive/refs/heads/main.tar.gz /tmp/app.tar.gz
RUN tar -xzf /tmp/app.tar.gz --strip-components=1 -C /home/node/app && rm /tmp/app.tar.gz

EXPOSE 7860
CMD ["node", "server.mjs"]
