#!/usr/bin/env node

// One-Time setup of the database

const { setTimeout } = require("timers/promises");
const stopWords = require("stopwords-iso");
const { MeiliSearch } = require("meilisearch");

const search = new MeiliSearch({
	host: process.env.MEILI_ENDPOINT ?? "http://localhost:7700",
	apiKey: process.env.MEILI_API_KEY ?? undefined,
});

async function main() {
	await search.createIndex("image_posts", { primaryKey: "id" });
	await search.createIndex("comments", { primaryKey: "id" });

	await setTimeout(10 * 1000);

	const imagePosts = await search.getIndex("image_posts");
	const comments = await search.getIndex("comments");

	const synonyms = {
		// Docs: https://docs.meilisearch.com/reference/features/synonyms.html#mutual-association

		// TODO: Add highly correlated tags, mined from tag dumps
		"pr0": ["pr0gramm"],
		"pr0gramm": ["pr0"],

		// TODO: Moar pr0gramm-Tiernamen
		"kadse": ["katze", "schmuser"],
		"katze": ["kadse", "schmuser"],
		"schmuser": ["kadse", "katze"],
		"mieserkadser": ["miesekadser"],
		"miesekadser": ["mieserkadser"],

		"gott": ["cha0s"],
		"marina": ["hure"],
	};

	await imagePosts.updateSettings({
		displayedAttributes: [
			"id",
			"author",
			"thumb_url",
			"sfw_flag",
			"promoted",
			"created_at",
			"up",
			"down",
		],
		searchableAttributes: [
			"ocr_content", // Keep in mind that only the first 1000 words are indexed: https://docs.meilisearch.com/reference/features/known_limitations.html#maximum-words-per-attribute
			// "author", // We exclusively use faceting for search based on user content
			"source",
		],
		attributesForFaceting: [
			// Reduced number of facets for posts due to disk size limitations (can be added later)
			"author",
			// "audio",
			"sfw_flag",
			"promoted",
			"extension",
		],
		stopWords: [...stopWords.de, ...stopWords.en],
		distinctAttribute: "thumb_url",
		synonyms,
		// rankingRules: [],
	});

	await comments.updateSettings({
		displayedAttributes: [
			"id",
			"post_id",
			"author",
			// "sfw_flag",
			"created_at",
			"up",
			"down",
		],
		searchableAttributes: [
			// "author", // We exclusively use faceting for search based on user content
			"content", // Keep in mind that only the first 1000 words are indexed: https://docs.meilisearch.com/reference/features/known_limitations.html#maximum-words-per-attribute
		],
		attributesForFaceting: [
			// No facets for comments due to disk size limitations (can be added later)
			"author",
			// "post_id", // meili doesn't support numbers in facets yet
			// "parent_id", // meili doesn't support numbers in facets yet
			// "sfw_flag", // unavailable atm
		],
		stopWords: [...stopWords.de],
		distinctAttribute: undefined,
		synonyms,
		// rankingRules: [],
	});
}

main();
