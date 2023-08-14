import { h } from './html.js'

/** @param {string} ts */
let dateFormats = (ts) => {
	const d = new Date(ts)

	return {
		full: d.toISOString(),
		pretty: d.toLocaleString(),
	}
}

async function initDateFormats() {
	try {
		const { default: dayjs } = await import('https://cdn.jsdelivr.net/npm/dayjs@1.11.9/+esm')
		const { default: relativeTime } = await import(
			'https://cdn.jsdelivr.net/npm/dayjs@1.11.9/plugin/relativeTime/+esm'
		)

		dayjs.extend(relativeTime)

		globalThis.dayjs = dayjs

		/** @param {string} ts */
		dateFormats = (ts) => {
			const d = dayjs(ts)

			const diff = Math.abs(d.diff(dayjs(), 'days'))
			const rel = d.fromNow()

			/** @type {string} */
			const full = d.format('YYYY-MM-DD [at] hh:mm:ss (Z)')
			/** @type {string} */
			const pretty = diff < 25 ? rel : d.format('MMM DD, YYYY')

			return { full, pretty }
		}
	} catch {
		// fall back to naive version
	}
}

const url = new URL(location.href)
const qps = url.searchParams

const username = qps.get('user') ?? (url.hostname.endsWith('.github.io') ? url.hostname.split('.')[0] : null)

/**
 * @typedef {(
 * 	| 'IssuesEvent'
 * 	| 'WatchEvent'
 * 	| 'PullRequestEvent'
 * 	| 'IssueCommentEvent'
 * 	| 'PushEvent'
 * 	| 'CreateEvent'
 * 	| 'repository'
 * 	| 'ForkEvent'
 * 	| 'DeleteEvent'
 * 	| 'PullRequestReviewCommentEvent'
 * 	| 'PullRequestReviewEvent'
 * 	| 'ReleaseEvent'
 * )} ActivityType
 */

/**
 * @typedef {{
 * 	type: ActivityType
 *  payload: unknown
 *  repo: { url: string, name: string }
 * }} Activity
 */

/**
 * @param {string} username
 * @param {string | number | null} page
 */
async function getActivityInfo(username, page) {
	page ??= 1

	const res = await fetch(
		`https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=50&page=${page}`,
	)

	/** @type {Activity[]} */
	const activities = await res.json()

	const link = res.headers.get('Link')

	/** @type {Partial<Record<'first' | 'prev' | 'next' | 'last', number>>} */
	const _pages = Object.fromEntries(
		[...link.matchAll(/<(?<href>[^>]+)>[^,]*\brel=["']?(?<rel>\w+)[^,]*/g)].map(({ groups: { href, rel } }) => [
			rel,
			Number(new URL(href).searchParams.get('page')),
		]),
	)

	const pages = {
		..._pages,
		current: Number(page),
	}

	return { username, activities, pages }
}

/** @param {string} str */
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/** @param {string} str */
function sentenceCase(str) {
	return capitalize(str.replaceAll(/(?<=\p{Ll})(?=\p{Lu})/gu, ' '))
}

/**
 * @param {{
 * 	url: string
 * 	text: string
 * 	class?: string
 * }}
 */
function link({ url, text, class: className }) {
	return h`<a href="${url}"${className ? h`class="${className}"` : ''}>${text}</a>`
}

/**
 * @param {Activity} x
 * @param {{ mainLink?: boolean }}
 */
function repoLink(x, { mainLink } = {}) {
	if (!x.repo) return 'unknown repo'

	return link({
		url: x.repo.url.replace('https://api.github.com/repos/', 'https://github.com/'),
		text: x.repo.name,
		class: mainLink ? '' : 'deemphasized',
	})
}

/** @param {Activity} x */
function ts(x) {
	const { full, pretty } = dateFormats(x.created_at)

	return h`<span title="${full}" class="ts">${pretty}</span>`
}

/** @param {Activity} x */
function getLiHeading(x) {
	switch (x.type) {
		case 'IssuesEvent': {
			return h`
				👾
				${capitalize(x.payload.action)}
				issue
				${link({
					url: x.payload.issue.html_url,
					text: x.payload.issue.title,
				})}
				on
				${repoLink(x)}
			`
		}
		case 'WatchEvent': {
			return h`
				👀
				${capitalize(x.payload.action)}
				watching
				${repoLink(x, { mainLink: true })}
			`
		}
		case 'PullRequestEvent': {
			return h`
				⤴️
				${capitalize(x.payload.action)}
				pull request
				${link({
					url: x.payload.pull_request.html_url,
					text: x.payload.pull_request.title,
				})}
				on
				${repoLink(x)}
			`
		}
		case 'IssueCommentEvent': {
			return h`
				💬
				${capitalize(x.payload.action)}
				an
				${link({
					url: x.payload.comment.html_url,
					text: 'issue comment',
				})}
				on
				${repoLink(x)}
			`
		}
		case 'PushEvent': {
			return h`
				➡️
				Pushed commits
				to
				${repoLink(x, { mainLink: true })}
			`
		}
		case 'CreateEvent': {
			switch (x.payload.ref_type) {
				case 'repository': {
					return h`
						🆕
						Created repository
						${repoLink(x, { mainLink: true })}
					`
				}
				default: {
					return h`
						🆕
						Created
						${x.payload.ref_type}
						<code>${x.payload.ref}</code>
						on
						${repoLink(x, { mainLink: true })}
					`
				}
			}
		}
		case 'ForkEvent': {
			return h`
				🍴
				Forked
				${repoLink(x)}
				into
				${link({
					url: x.payload.forkee.html_url,
					text: x.payload.forkee.full_name,
				})}
			`
		}
		case 'DeleteEvent': {
			return h`
				⛔
				Deleted
				${x.payload.ref_type}
				<code>${x.payload.ref}</code>
				on
				${repoLink(x, { mainLink: true })}
			`
		}
		case 'PullRequestReviewCommentEvent': {
			return h`
				💬
				${capitalize(x.payload.action)}
				a
				${link({
					url: x.payload.comment.html_url,
					text: 'pull request review comment',
				})}
				on
				${repoLink(x)}
			`
		}
		case 'PullRequestReviewEvent': {
			return h`
				💬
				${capitalize(x.payload.action)}
				a
				${link({
					url: x.payload.review.html_url,
					text: 'pull request review',
				})}
				on
				${repoLink(x)}
			`
		}
		case 'ReleaseEvent': {
			return h`
				🎉
				${capitalize(x.payload.action)}
				a
				${link({
					url: x.payload.release.html_url,
					text: 'release',
				})}
				for tag
				<code>${x.payload.release.tag_name}</code>
				on
				${repoLink(x)}
			`
		}
		default: {
			return h`
				❓
				${sentenceCase(x.type)}
				on
				${repoLink(x, { mainLink: true })}
			`
		}
	}
}

/** @param {number} page */
function pageHref(page) {
	const url = new URL(location.href)
	url.searchParams.set('page', String(page))

	return url.href
}

/**
 * @param {number | undefined} page
 * @param {string} text
 */
function pageLink(page, text) {
	return page
		? h`<a href="${pageHref(page)}" class="blip" title="Page ${page}">${text}</a>`
		: h`<span class="blip">${text}</span>`
}

/** @typedef {Exclude<Awaited<ReturnType<typeof getActivityInfo>>, null>} ActivityInfo */

/** @param {ActivityInfo} */
function renderActivities({ username, activities, pages }) {
	const pagination = h`<div class="pagination">
		${[
			pageLink(pages.first, '«'),
			pageLink(pages.prev, '‹'),
			h`<span>Page ${pages.current} of ${pages.last ?? pages.current}</span>`,
			pageLink(pages.next, '›'),
			pageLink(pages.last, '»'),
		].filter(Boolean)}
	</div>`

	return h`<section class="section">
		${pagination}
		<ul>
		${activities.map((x) => {
			let liHeading

			try {
				liHeading = getLiHeading(x)
			} catch (e) {
				liHeading = `${x.type} ${e.name}: ${e.message}`
			}

			return h`<li class="activity">
					<details>
						<summary>
							${liHeading} ${ts(x)}
						</summary>
						<pre>${JSON.stringify(x, null, '\t')}</pre>
					</details>
				</li>`
		})}
		</ul>
		${pagination}
	</section>`
}

function renderForm() {
	return h`<h1>No user selected</h1>

	<form class="form" method="get">
		<div>
			<label>
				<div>
					Show activities for user
				</div>
				<div>
					<input name="user" placeholder="GitHub username">
				</div>
			</label>
		</div>

		<div>
			<button type="submit">Go</button>
		</div>
	</form>`
}

async function load() {
	const target = document.querySelector('#target')

	if (username) {
		const userUrl = new URL(username, 'https://github.com').href

		target.innerHTML = h`<div class="activities">
			<h1>${link({ url: userUrl, text: username })}’s GitHub Activity Log</h1>
			<div class="loading-indicator">Loading...</div>
		</div>`

		const [_, activityInfo] = await Promise.all([
			initDateFormats(),
			getActivityInfo(username, url.searchParams.get('page')),
		])

		target.querySelector('.loading-indicator').replaceWith(...renderActivities(activityInfo).toElements())
	} else {
		target.innerHTML = renderForm()
	}
}

await load()
