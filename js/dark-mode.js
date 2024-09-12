const darkMode = globalThis.matchMedia('(prefers-color-scheme: dark)')

const lsKey = 'dark-mode'

/** @type {boolean | null} */
let dark = JSON.parse(localStorage.getItem(lsKey) ?? 'null')

/** @param {boolean | null} newDark  */
function toggleDarkMode(newDark) {
	if (newDark == null) localStorage.removeItem(lsKey)
	else localStorage.setItem(lsKey, String(newDark))

	newDark ??= darkMode.matches

	dark = newDark

	const iconFileName = newDark ? 'favicon-dark.svg' : 'favicon.svg'

	document.documentElement.classList.toggle('dark-mode', newDark)
	document.documentElement.classList.toggle('light-mode', !newDark)
	document.querySelector('link[rel=icon]').href = `https://github.githubassets.com/favicons/${iconFileName}`
	document.querySelector('#dark-mode-toggle').innerHTML = newDark ? '🌞' : '🌛'
}

toggleDarkMode(dark)
darkMode.addEventListener('change', (e) => toggleDarkMode(e.matches))
document.querySelector('#dark-mode-toggle').addEventListener('click', () => toggleDarkMode(!dark))
