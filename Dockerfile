FROM node:24-alpine

WORKDIR /app/server
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js data.json .env.example ./
RUN mkdir -p uploads
COPY 1e1bb9cfb049db1f554fc41966022f33 2b7d9249bcc418311467dbca141d5b3f 30ecbee3371aee77328c00854309b4ed 39bb30f48b177193c0d13f64948c91f9 5c6149a9029ce56be3255d05c17f0140 8fd10e694c9d8e0e6658b3508ef1f9ac 912f87206c1fbd673775f43f84b32f3a 982248ad626f6a2c0b6e0e423ebbfea2 c09cabd20aae06e3c76b26b1911cdb45 c5c08cdeb44c61fd9ab38c83823d19d8 dae3ef42eb37865dcc938d6c07e8dcb7 f1e8bb4ebcd0a5971baa0363af4f9be0 uploads/
COPY index.html script.js styles.css logo.svg manifest.webmanifest sw.js /app/

ENV NODE_ENV=production
ENV PORT=3000
ENV IBRA_DATA_DIR=/var/data
ENV IBRA_UPLOAD_DIR=/var/data/uploads
EXPOSE 3000

CMD ["node", "server.js"]
