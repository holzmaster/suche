#!/usr/bin/env node

const fs = require("fs");
const log = require("npmlog");
const NodeCache = require("node-cache");
const litdate = require("lit-date");
const restify = require("restify");
const errors = require("restify-errors");
const { MeiliSearch } = require("meilisearch");

const timeStampFormatter = litdate`${'YYYY'}-${'MM'}-${'DD'} ${'HH'}:${'mm'}:${'ss'}.${'SSS'}`;

// See: https://github.com/npm/npmlog/issues/33#issuecomment-342785666
Object.defineProperty(log, "heading", { get: () => timeStampFormatter(new Date()) });
log.headingStyle = { bg: "", fg: "white" };

const server = restify.createServer({
	name: "haessliche-suche",
});
server.use(restify.plugins.queryParser());
server.use(restify.plugins.authorizationParser());
server.use(restify.plugins.throttle({
	// Ref: http://restify.com/docs/plugins-api/#throttle
	rate: 30 / 1, // 30 requests per second
	burst: 30,
	ip: true,
}));

if (process.env.NODE_ENV !== "production") {
	server.use(
		function crossOrigin(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");
			return next();
		}
	);
}

const queryStatsFile = process.env.STATS_FILE ?? "stats.json";

const meili = new MeiliSearch({
	host: process.env.MEILI_ENDPOINT ?? "http://localhost:7700",
	apiKey: process.env.MEILI_API_KEY ?? undefined,
});

const index = {
	imagePosts: meili.index("image_posts"),
	comments: meili.index("comments"),
};

const searchCache = new NodeCache({
	stdTTL: 5 * 60 * 1000,
	maxKeys: 50000,
});

const queryCount = loadQueryStats();

server.get("/stats", (req, res, next) => {
	const cachedResult = searchCache.get("stats");
	if (cachedResult !== undefined) {
		res.send(cachedResult);
		return next();
	}

	Promise.allSettled([
		index.imagePosts.getStats().then(v => v.numberOfDocuments),
		index.comments.getStats().then(v => v.numberOfDocuments),
		meili.stats(),
	]).then(stats => {
		const r = {
			entries: {
				imagePosts: stats[0].value ?? 0,
				comments: stats[1].value ?? 0,
			},
			databaseSize: stats[2].value?.databaseSize ?? 0,
			lastUpdate: stats[2].value?.lastUpdate ?? 0,
			queryCount,
		};

		searchCache.set("stats", r, 1000 * 60);
		res.send(r);
		return next();
	}).catch(_ => next(new errors.InternalServerError()));
});

function getTermAndOffset(req, res, next) {
	const params = req.query;
	if (!params)
		return undefined;

	const term = params.term?.trim()?.toLowerCase();
	if (!term)
		return undefined;

	const offset = Number(params.offset) || 0;
	return [term, offset];
}

server.get("/search/comments", (req, res, next) => {
	const queryData = getTermAndOffset(req, res, next);
	if (queryData === undefined)
		return next(new errors.BadRequestError());

	const [term, offset] = queryData;

	++queryCount.comments;

	const cachedResult = searchCache.get(`comments:${term}:${offset}`);
	if (cachedResult !== undefined) {
		res.send(cachedResult);
		return next();
	}

	log.info("search", `comments:${term}:${offset}`);

	index.comments.search(term, {
		offset,
	}).then(queryResult => {
		const termResults = {
			success: true,
			term,
			hits: queryResult.hits.map(h => ({...h, author: "Ein Nutzer"})), // https://pr0gramm.com/new/4586153:comment48636732
			limit: queryResult.limit,
			total: queryResult.nbHits,
			offset: queryResult.offset,
			qt: queryResult.processingTimeMs,
		};
		searchCache.set(`comments:${term}:${offset}`, termResults);
		res.send(termResults);
		return next();
	}).catch(_ => next(new errors.InternalServerError()));
});

server.get("/search/image-posts", (req, res, next) => {
	const queryData = getTermAndOffset(req, res, next);
	if (queryData === undefined)
		return next(new errors.BadRequestError());

	const [term, offset] = queryData;

	++queryCount.imagePosts;

	const cachedResult = searchCache.get(`image-posts:${term}:${offset}`);
	if (cachedResult !== undefined) {
		res.send(cachedResult);
		return next();
	}

	log.info("search", `image-posts:${term}:${offset}`);

	index.imagePosts.search(term, {
		limit: 10 * 4,
		offset,
	}).then(queryResult => {
		const termResults = {
			success: true,
			term,
			hits: queryResult.hits,
			limit: queryResult.limit,
			total: queryResult.nbHits,
			offset: queryResult.offset,
			qt: queryResult.processingTimeMs,
		};
		searchCache.set(`image-posts:${term}:${offset}`, termResults);
		res.send(termResults);
		return next();
	}).catch(_ => next(new errors.InternalServerError()));
});

server.get("/monitor", (req, res, next) => {
	res.send({ ok: true });
	return next();
});

server.on("restifyError", (req, res, err, cb) => {
	log.error(err);
	return cb();
});


function saveQueryStats() {
	fs.writeFileSync(queryStatsFile, JSON.stringify(queryCount));
	log.info("stats", "query stats saved");
}
function loadQueryStats() {
	if (!fs.existsSync(queryStatsFile)) {
		return {
			imagePosts: 0,
			comments: 0,
		};
	}

	const s = fs.readFileSync(queryStatsFile, { encoding: "utf-8" });
	return JSON.parse(s);
}
setInterval(saveQueryStats, 1000 * 60 * 10); // Using a plain JSON file is dirty, but gets the job done.

const port = Number(process.env.SERVER_PORT ?? "8080");
server.listen(port, () => log.info("server", `${server.name} listening on ${server.url}`));
