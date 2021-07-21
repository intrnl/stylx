import { getSheet } from './document.js';
import { merge, toKebabCase, isNumber, isString, isObject } from './utils.js';


let DEFINITION_CACHE = new WeakMap();
let STYLE_CACHE = globalThis.STYLX_CACHE ||= { idx: 0, def: new Map() };


function createMap (def, select = '&', place = '&&') {
	let sheet = getSheet();
	let map = {};

	for (let k in def) {
		let v = def[k];

		if (v == null) {
			map[k] = v;
			continue;
		}

		if (k === 'selectors') {
			map[k] = {};

			for (let selector in def[k]) {
				let d = def[k][selector];

				let nextSelect = select.replaceAll('&', selector);
				map[k][selector] = createMap(d, nextSelect, place);
			}

			continue;
		}

		if (k === 'queries') {
			map[k] = {};

			for (let query in def[k]) {
				let d = def[k][query];

				let nextPlace = place.replaceAll('&&', `${query} { && }`);
				map[k][query] = createMap(d, select, nextPlace);
			}

			continue;
		}

		let cacheKey = `${place}||${select}||${k}||${v}`;

		if (STYLE_CACHE.def.has(cacheKey)) {
			let cn = STYLE_CACHE.def.get(cacheKey);
			map[k] = cn;
			continue;
		}

		let cn = 'x' + (STYLE_CACHE.idx++).toString(36);
		let selector = select.replaceAll('&', '.' + cn);

		let prop = toKebabCase(k);
		let value = isNumber(v) ? `${v}px` : v;
		let decl = place.replaceAll('&&', `${selector} { ${prop}: ${value} }`);

		sheet.insertRule(decl, sheet.cssRules.length);
		STYLE_CACHE.def.set(cacheKey, cn);
		map[k] = cn;
	}

	return map;
}

function mergeClassNames (map) {
	let cn = '';
	let lead = true;

	for (let key in map) {
		let value = map[key];

		if (lead) {
			lead = false;
		} else {
			cn += ' ';
		}

		if (isString(value)) {
			cn += value;
		} else if (isObject(value)) {
			cn += mergeClassNames(value);
		}
	}

	return cn;
}

export function apply (...defs) {
	let final = {};

	for (let def of defs.flat(Infinity)) {
		if (!def) continue;

		let map = DEFINITION_CACHE.get(def);
		if (!map) DEFINITION_CACHE.set(def, map = createMap(def));

		merge(final, map);
	}

	return mergeClassNames(final);
}
