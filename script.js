const url = new URL(location.href)
const qps = url.searchParams

const username = qps.has('user')
	? qps.get('user')
	: new URL(location.href).hostname.split('.')[0]

const activities = await (
	await fetch(
		`https://api.github.com/users/${encodeURIComponent(
			username,
		)}/events?per_page=100`,
	)
).json()

function escape(str) {
	str = typeof str === 'string' ? str : JSON.stringify(str ?? null)

	return str.replaceAll(/[&<>"']/g, (x) => `&#${x.codePointAt(0)};`)
}

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

function link({ url, text, class: className }) {
	return `<a target="_blank" href="${escape(url)}"${
		className ? `class="${className}"` : ''
	}>${escape(text)}</a>`
}

function repoLink(x, { mainLink } = {}) {
	return `${link({
		url: x.repo.url.replace(
			'https://api.github.com/repos/',
			'https://github.com/',
		),
		text: x.repo.name,
		class: mainLink ? '' : 'deemphasized',
	})}`
}

function ts(x) {
	let d = new Date(x.created_at)
	d = new Date(d.valueOf() - d.getTimezoneOffset() * 60 * 1000)

	return `<span class="ts">${d
		.toISOString()
		.replaceAll(/[a-z]+/gi, ' ')
		.trim()
		.slice(0, -4)}</span>`
}

function getLiHeading(x) {
	switch (x.type) {
		case 'IssuesEvent': {
			return `
				👾
				${escape(capitalize(x.payload.action))}
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
			return `
				👀
				${escape(capitalize(x.payload.action))}
				watching
				${repoLink(x, { mainLink: true })}
			`
		}
		case 'PullRequestEvent': {
			return `
				⤴️
				${escape(capitalize(x.payload.action))}
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
			return `
				💬
				${escape(capitalize(x.payload.action))}
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
			return `
				➡️
				Pushed commits
				to
				${repoLink(x, { mainLink: true })}
			`
		}
		case 'CreateEvent': {
			switch (x.payload.ref_type) {
				case 'repository': {
					return `
						🆕
						Created repository
						${repoLink(x, { mainLink: true })}
					`
				}
				default: {
					return `
						🆕
						Created
						${escape(x.payload.ref_type)}
						<code>${escape(x.payload.ref)}</code>
						on
						${repoLink(x, { mainLink: true })}
					`
				}
			}
		}
		case 'ForkEvent': {
			return `
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
			return `
				⛔
				Deleted
				${escape(x.payload.ref_type)}
				<code>${escape(x.payload.ref)}</code>
				on
				${repoLink(x, { mainLink: true })}
			`
		}
		case 'PullRequestReviewCommentEvent': {
			return `
				💬
				${escape(capitalize(x.payload.action))}
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
			return `
				💬
				${escape(capitalize(x.payload.action))}
				a
				${link({
					url: x.payload.review.html_url,
					text: 'pull request review',
				})}
				on
				${repoLink(x)}
			`
		}
		default: {
			return `${x.type}`
		}
	}
}

function render({ username, activities }) {
	const html = `<div class="activities">
		<h1>${username}’s GitHub Activity Log</h1>
		<ul>
		${activities
			.map((x) => {
				let liHeading

				try {
					liHeading = getLiHeading(x)
				} catch (e) {
					liHeading = `${x.type} ${e.name}: ${e.message}`
				}

				return `<li class="activity">
					<details>
						<summary>
							${liHeading} ${ts(x)}
						</summary>
						<pre>${escape(JSON.stringify(x, null, '\t'))}</pre>
					</details>
				</li>`
			})
			.join('\n')}
		</ul>
	</div>`

	return html
}

document.querySelector('#target').innerHTML = render({ username, activities })
