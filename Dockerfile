# Builder stage: compiles LibreDWG's dwg2dxf converter from source.
# Alpine has no libredwg package, so it is built here with --disable-shared;
# the resulting binary only needs musl's libc.so, already present in the
# runtime image, so just the binary is copied in below.
FROM node:24-alpine AS libredwg-builder
RUN apk add --no-cache build-base automake autoconf libtool pkgconfig git texinfo python3
WORKDIR /build
RUN git clone https://github.com/LibreDWG/libredwg.git
WORKDIR /build/libredwg
# Pinned to the exact commit this was tested against (see commit message),
# not the branch tip, so the build is reproducible regardless of upstream's
# current HEAD.
RUN git checkout f860b0fb76d5f8effb5a70769a3389cb1e0308c8
RUN ./autogen.sh
RUN ./configure --disable-shared --disable-bindings
RUN make -j"$(nproc)"
RUN ./programs/dwg2dxf --version

FROM node:24-alpine

# Ghostscript shrinks uploaded PDFs (downsamples embedded images) before they go to storage.
RUN apk add --no-cache ghostscript

WORKDIR /app

COPY --from=libredwg-builder /build/libredwg/programs/dwg2dxf /usr/local/bin/dwg2dxf

COPY package.json package-lock.json ./
RUN npm install --omit=dev --workspaces=false

COPY server.js data.json .env.example ./
COPY lib ./lib
COPY knowledge-base ./knowledge-base
COPY index.html script.js styles.css logo.svg manifest.webmanifest sw.js ./

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
