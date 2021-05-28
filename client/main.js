// @ts-check
import { html, render } from "./node_modules/lit-html/lit-html.js";

const apiBase = "https://heslig.kellertreff.com";

function searchComments(term, signal = undefined, offset = 0) {
	const u = new URL(apiBase + "/search/comments");
	u.searchParams.set("term", term);
	u.searchParams.set("offset", offset.toString());
	return fetch(u.toString(), { signal }).then(r => r.json());
}
function searchImagePosts(term, signal = undefined, offset = 0) {
	const u = new URL(apiBase + "/search/image-posts");
	u.searchParams.set("term", term);
	u.searchParams.set("offset", offset.toString());
	return fetch(u.toString(), { signal }).then(r => r.json());
}

function search(term, signal) {
	return Promise.all([
		searchImagePosts(term, signal),
		searchComments(term, signal),
	]).then(results => ({
		imagePosts: results[0],
		comments: results[1],
	}));
}

const fetchStats = () => fetch(apiBase + "/stats").then(r => r.json());

const form = document.getElementById("search");

let searchAbortController = undefined;
form.addEventListener("submit", e => {
	e.preventDefault();

	if (searchAbortController !== undefined)
		searchAbortController.abort();
	searchAbortController = new AbortController()

	throttledSearch(form.query.value, searchAbortController.signal); // Keeping return pressed would trigger A LOT of requests
});

function submitSearch(value, abortSignal) {
	const resultsDiv = document.getElementById("results");
	const loader = document.getElementById("loader");
	resultsDiv.style.display = "none";

	const loadingBarTimeout = setTimeout(() => loader.style.display = "block", 100);
	return search(value, abortSignal)
		.then(result => {
			clearTimeout(loadingBarTimeout);

			if (result === undefined || !result.comments.success || !result.imagePosts.success) {
				alert("IRGENDWAS DOOFES IST PASSIERT :/");
				return;
			}

			render(resultView(result), resultsDiv);
			document.location.hash = value;
			loader.style.display = "none";
			resultsDiv.style.removeProperty("display");
		}); // Intentionally not catching errors
}
const throttledSearch = throttle(submitSearch, 2000);

//#region Components

// TODO: Consider adding target="_blank" depending on user's requests
// TODO: Do this properly with react (we did not intend to have much interaction when this project was started)

const resultView = result => {
	const { imagePosts, comments } = result;

	// TODO: Re-Write this whole mess (probably just the entire FE)

	const loadMorePosts = (event, currentPosts) => {

		const b = document.getElementById("more-posts");
		if (b) b.disabled = false;

		searchImagePosts(imagePosts.term, undefined, currentPosts.offset + currentPosts.limit)
			.then(nextResults => {
				const resultsDiv = document.getElementById("results");
				render(resultView({
					...result,
					imagePosts: {
						...nextResults,
						hits: [...currentPosts.hits, ...nextResults.hits],
					},
				}), resultsDiv);

				const b = document.getElementById("more-posts");
				if (b) b.disabled = false;
			});
	};

	const loadMoreComments = (event, currentComments) => {

		const b = document.getElementById("more-comments");
		if (b) b.disabled = false;

		searchComments(comments.term, undefined, currentComments.offset + currentComments.limit)
			.then(nextResults => {
				const resultsDiv = document.getElementById("results");
				render(resultView({
					...result,
					comments: {
						...nextResults,
						hits: [...currentComments.hits, ...nextResults.hits],
					},
				}), resultsDiv);

				const b = document.getElementById("more-comments");
				if (b) b.disabled = false;
			});
	}

	// TODO: Make the results look prettier, have better UX
	return html`
	<div class="result-panel posts-panel">
		<h3>
			<img class=icon src="img/image.svg">
			${imagePosts.hits.length} Posts von ${imagePosts.total}
		</h3>
		<div class="post-list">
			${imagePosts.hits.map(postResult)}
		</div>
		${imagePosts.hits.length < imagePosts.total ? html`
			<div class=result-list-footer>
				<button class=secondary id=more-posts @click=${e => loadMorePosts(e, imagePosts)}>Mehr Posts zeigen</button>
			</div>
		` : undefined}
	</div>
	<div class="result-panel">
		<h3>
			<img class=icon src="img/message.svg">
			${comments.hits.length} Kommentare von ${comments.total}
		</h3>
		<div class="comment-list">
			${comments.hits.map(commentResult)}
		</div>
		${comments.hits.length < comments.total ? html`
			<div class=result-list-footer>
				<button class=secondary id=more-comments @click=${e => loadMoreComments(e, comments)}>Mehr Kommentare zeigen</button>
			</div>
		` : undefined}
	</div>
`;
}

const postResult = post => html`
	<a .href=${`https://pr0gramm.com/new/${post.id}`}>${post.sfw_flag !== "1" && post.sfw_flag !== "8"
		? html`<span class=sfw-flag-placeholder>${getHumanReadableSfwFlag(post.sfw_flag)}</span>`
		: html`<img .src=${`https://thumb.pr0gramm.com/${post.thumb_url}`}>`
	}</a>
`;
function getHumanReadableSfwFlag(f) {
	switch (f) {
		case "1": return "sfw";
		case "2": return "nsfw";
		case "4": return "nsfl";
		case "8": return "nsfp";
		default: return "???";
	}
}
const commentResult = comment => html`
	<li>
		<a .href=${`https://pr0gramm.com/new/${comment.post_id}:comment${comment.id}`}>
			${comment.author}
		</a> beim Post <a .href=${`https://pr0gramm.com/new/${comment.post_id}`}>${comment.post_id}</a>
		<span class="muted" .title=${`${comment.up} up, ${comment.down} down`}>mit ca. ${comment.up - comment.down} Benis</span>
	</li>
`; // <span class="muted">vor X Tagen</span>

//#endregion

window.addEventListener("load", () => {
	fetchStats().then(stats => {
		const f = new Intl.NumberFormat();

		// totalQueries isn't fair here, since every submission will trigger three queries (this may change in the future)
		const totalQueries = stats.queryCount.imagePosts + stats.queryCount.comments;
		const actualTotalQueries = totalQueries / 2;

		document.getElementById("stats-queries").textContent = f.format(actualTotalQueries | 0);
		document.getElementById("stats-posts").textContent = f.format(stats.entries.imagePosts);
		document.getElementById("stats-comments").textContent = f.format(stats.entries.comments);
		document.getElementById("stats-size").textContent = f.format(((stats.databaseSize / (1024 * 1024 * 1024) * 10) | 0) / 10);

	}); // Not catching errors (not needed for working site)

	let hash = document.location.hash;
	if (hash) {
		form.query.value = hash.substr(1);
		submitSearch(form.query.value);
	}
	setTimeout(placeholderAnimationStep, 5000);
	setUpHinting();
}, {
	once: true,
	passive: true,
});

function throttle(fn, delayMs) {
	let timeoutHandler = undefined;
	return (...args) => {
		if (timeoutHandler !== undefined)
			return;
		fn(...args);
		timeoutHandler = setTimeout(() => timeoutHandler = undefined, delayMs);
	}
}

//#region Hints

let currentHintIndex = 0;
const hints = [
	html`Tags werden nicht durchsucht – verwende dafür die <a href=//pr0gramm.com/search target=_blank>Suche auf pr0gramm</a>.`,
	"Inhalte von Kommentaren werden nicht angezeigt, weil wir hier keine Inhalte hosten (wollen/dürfen).",
	"Das pr0gramm mag dich <3",
	"Pizza mit Ananas ist essbar",
	html`Hab ich schon gesagt, dass Du für Tags die <a href=//pr0gramm.com/search target=_blank>Suche auf pr0gramm</a> verwenden sollst?`,
	html`Wenn Du ein hässlicher Entwickler bist, <a href="#">kannst du diese Seite verbessern</a>.`,
	"Der Suchindex ist nicht vollständig, wird aber laufend aktualisiert.",
];
function nextHint() {
	render(
		hints[currentHintIndex++ % hints.length],
		document.getElementById("hint"),
	);
}
function setUpHinting() {
	const hintDuration = 10 * 1000;
	document.getElementById("hint").style.setProperty("--hint-duration", hintDuration + "ms");
	nextHint();
	setInterval(nextHint, hintDuration);
}

let querySuggestionIndex = 0;
let querySuggestionWordLength = 0;
let direction = 1;
const suggestions = [
	"das pr0 vergisst nie",
	"gedämpfte Huscheln",
	"Schopenhauer",
	"Time Spent in Shower",
	"alt+f4 fighter",
	"ich hab nicht gefragt, wie du aussiehst",
	"Bombardement von Algier",
];

function placeholderAnimationStep() {
	const currentWord = suggestions[querySuggestionIndex];
	querySuggestionWordLength += direction;
	form.query.placeholder = currentWord.substr(0, querySuggestionWordLength);

	if (direction > 0) {
		if (querySuggestionWordLength >= currentWord.length) {
			direction = -1;
			setTimeout(placeholderAnimationStep, 5000);
		} else {
			setTimeout(placeholderAnimationStep, Math.random() * 100 + 50);
		}
	} else {
		if (querySuggestionWordLength <= 0) {
			let newIndex;
			do {
				newIndex = (Math.random() * suggestions.length) | 0;
			} while (newIndex === querySuggestionIndex)
			querySuggestionIndex = newIndex;
			direction = 1;
			setTimeout(placeholderAnimationStep, 1000);
		} else {
			setTimeout(placeholderAnimationStep, 50);
		}
	}
}
//#endregion
