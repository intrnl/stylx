let STYLE_ID = '__stylx';

export function getSheet () {
	/** @type {?HTMLStyleElement} */
	let elem = document.querySelector(`style[id='${STYLE_ID}']`);

	if (!elem) {
		elem = document.createElement('style');
		elem.id = STYLE_ID;
		document.head.append(elem);
	}

	return elem.sheet;
}
