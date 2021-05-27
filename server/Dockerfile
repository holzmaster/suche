FROM node:alpine
	RUN mkdir /app
	WORKDIR /app
	ENV NODE_ENV=production

	COPY package.json package-lock.json ./
	RUN npm ci --only=production

	COPY . .

	CMD ["node", "server.js"]
