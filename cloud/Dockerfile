FROM mcr.microsoft.com/playwright:v1.51.1-noble
WORKDIR /app
COPY cloud/package.json ./
RUN npm install --omit=dev
COPY cloud/ ./
ENV PORT=8080
USER pwuser
EXPOSE 8080
CMD ["node","app.mjs"]
