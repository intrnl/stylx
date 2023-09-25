/// Development
const devMap: Record<string, HTMLStyleElement> = {};

export const injectDEV = (key: string, source: string) => {
	let node = devMap[key];

	if (!node) {
		devMap[key] = node = document.head.appendChild(document.createElement('style'));
		node.id = `stylx-dev-${key}`;
	}

	node.textContent = source;
};

/// Production
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
