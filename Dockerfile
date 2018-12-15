FROM mhart/alpine-node:10 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
#Staging build from this base image
FROM alpine:3.7
COPY --from=builder /usr/bin/node /usr/bin/
COPY --from=builder /usr/lib/libgcc* /usr/lib/libstdc* /usr/lib/
WORKDIR /app
COPY --from=builder /app/ .

COPY app.js .
EXPOSE 8888/tcp 
ENV MONGO_SERVICE_HOST=mongo
ENV MONGO_SERVICE_PORT=27017
ENV MYSQL_SERVICE_HOST=mysql
ENV MYSQL_SERVICE_PORT=3306
CMD ["node", "app.js"]