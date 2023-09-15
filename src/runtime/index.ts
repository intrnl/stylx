export const injectDEV = (key: string, source: string) => {
	const id = `stylx-dev-${key}`;

	let node = document.getElementById(key) as HTMLStyleElement | null;

	if (!node) {
		node = document.head.appendChild(document.createElement('style'));
		node.id = id;
	}

	node.textContent = source;
};

const map: Record<string, boolean> = {};
const stylesheet = new CSSStyleSheet();

let injected = false;

export const inject = (key: string, source: string) => {
	if (key in map) {
		return;
	}

	if (!injected) {
		document.adoptedStyleSheets.push(stylesheet);
		injected = true;
	}

	map[key] = true;
	stylesheet.insertRule(source);
};

export const injectBatch = (sources: Record<string, string>) => {
	let result = '';

	for (const key in sources) {
		const source = sources[key];

		if (key in map) {
			continue;
		}

		map[key] = true;
		result += source;
	}

	if (result) {
		if (!injected) {
			document.adoptedStyleSheets.push(stylesheet);
			injected = true;
		}

		stylesheet.insertRule(result);
	}
};
