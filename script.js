async function initDateFormats() {
	try {
		const { default: dayjs } = await import(
			'https://cdn.jsdelivr.net/npm/dayjs@1.11.9/+esm'
		)
		const { default: relativeTime } = await import(
			'https://cdn.jsdelivr.net/npm/dayjs@1.11.9/plugin/relativeTime/+esm'
		)

		dayjs.extend(relativeTime)

		globalThis.dayjs = dayjs

		return (ts) => {
			const d = dayjs(ts)

			const diff = Math.abs(d.diff(dayjs(), 'days'))
			const rel = d.fromNow()

			const full = d.format('YYYY-MM-DD [at] hh:mm:ss (Z)')

			const pretty = diff < 25 ? rel : d.format('MMM DD, YYYY')

			return { full, pretty }
		}
	} catch {
		return (ts) => {
			const d = new Date(ts)

			return {
				full: d.toISOString(),
				pretty: d.toLocaleString(),
			}
		}
	}
}

const url = new URL(location.href)
const qps = url.searchParams

const username = qps.has('user')
	? qps.get('user')
	: new URL(location.href).hostname.split('.')[0]

const [dateFormats, activities] = await Promise.all([
	initDateFormats(),
	(
		await fetch(
			`https://api.github.com/users/${encodeURIComponent(
				username,
			)}/events?per_page=100`,
		)
	).json(),
])

class Html {
	constructor(input, { trusted } = { trusted: false }) {
		if (input instanceof this.constructor) {
			return input
		}

		const str = String(input)
		const escaped = trusted
			? str
			: str.replaceAll(/[&<>"']/g, (x) => `&#${x.codePointAt(0)};`)

		this.html = escaped
	}

	toString() {
		return this.html
	}
}

function escapeHtml(input) {
	return Array.isArray(input)
		? new Html(input.map(escapeHtml).join(''), { trusted: true })
		: new Html(input)
}

function h({ raw }, ...args) {
	return new Html(String.raw({ raw }, ...args.map(escapeHtml)), {
		trusted: true,
	})
}

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function sentenceCase(str) {
	return capitalize(str.replaceAll(/(?<=\p{Ll})(?=\p{Lu})/gu, ' '))
}

function link({ url, text, class: className }) {
	return h`<a href="${url}"${
		className ? h`class="${className}"` : ''
	}>${text}</a>`
}

function repoLink(x, { mainLink } = {}) {
	if (!x.repo) return 'unknown repo'

	return link({
		url: x.repo.url.replace(
			'https://api.github.com/repos/',
			'https://github.com/',
		),
		text: x.repo.name,
		class: mainLink ? '' : 'deemphasized',
	})
}

function ts(x) {
	const { full, pretty } = dateFormats(x.created_at)

	return h`<span title="${full}" class="ts">${pretty}</span>`
}

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

function render({ username, activities }) {
	const html = h`<div class="activities">
		<h1>${username}’s GitHub Activity Log</h1>
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
	</div>`

	return html
}

document.querySelector('#target').innerHTML = render({ username, activities })
