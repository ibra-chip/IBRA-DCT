FROM node:24-alpine

# Ghostscript shrinks uploaded PDFs (downsamples embedded images) before they go to storage.
RUN apk add --no-cache ghostscript

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev --workspaces=false

COPY server.js data.json .env.example ./
COPY lib ./lib
COPY knowledge-base ./knowledge-base
COPY index.html script.js styles.css logo.svg manifest.webmanifest sw.js ./

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
