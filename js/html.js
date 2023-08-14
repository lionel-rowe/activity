class Html {
	/** @type {string} */
	#html

	/**
	 * @param {unknown} input
	 * @param {{ trusted: boolean }?} options
	 */
	constructor(input, { trusted } = { trusted: false }) {
		if (input instanceof Html) {
			return new Html(input.#html, { trusted: true })
		}

		const str = String(input)
		const escaped = trusted ? str : str.replaceAll(/[&<>"']/g, (x) => `&#${x.codePointAt(0)};`)

		this.#html = escaped
	}

	toString() {
		return this.#html
	}

	toElements() {
		const span = document.createElement('span')
		span.innerHTML = this.#html

		return [...span.childNodes]
	}
}

/**
 * @param {unknown} input
 * @returns {Html}
 */
function escapeHtml(input) {
	return Array.isArray(input) ? new Html(input.map(escapeHtml).join(''), { trusted: true }) : new Html(input)
}

/**
 * @param {{ raw: string[] }}
 * @param {unknown[]} args
 */
export function h({ raw }, ...args) {
	return new Html(String.raw({ raw }, ...args.map(escapeHtml)), {
		trusted: true,
	})
}
