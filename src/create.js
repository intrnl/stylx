import { getSheet } from './document.js';
import { toKebabCase, isNumber } from './utils.js';


let CACHE = globalThis.STYLX_CACHE ||= { idx: 0, def: new Map() };


function createDefinition (def, decls = [], wrap = '&', place = '&&') {
	let nextDef = {};

	for (let k in def) {
		let v = def[k];

		if (v == undefined) {
			nextDef[k] = v;
			continue;
		}

		if (k === 'selectors') {
			nextDef[k] = {};

			for (let s in def[k]) {
				let d = def[k][s];

				let nextWrapper = wrap.replaceAll('&', s);
				nextDef[k][s] = createDefinition(d, decls, nextWrapper, place);
			}

			continue;
		}

		if (k === 'queries') {
			nextDef[k] = {};

			for (let q in def[k]) {
				let d = def[k][q];

				let nextPlace = place.replaceAll('&&', `${q} { && }`);
				nextDef[k][q] = createDefinition(d, decls, wrap, nextPlace);
			}

			continue;
		}

		let cacheKey = `${place}||${wrap}||${k}||${v}`;

		if (CACHE.def.has(cacheKey)) {
			let cn = CACHE.def.get(cacheKey);
			nextDef[k] = cn;
			continue;
		}

		let cn = 'x' + (CACHE.idx++).toString(36);
		let selector = wrap.replaceAll('&', '.' + cn);

		let prop = toKebabCase(k);
		let value = isNumber(v) ? `${v}px` : v;
		let decl = place.replaceAll('&&', `${selector} { ${prop}: ${value} }`);

		decls.push(decl);

		CACHE.def.set(cacheKey, cn);
		nextDef[k] = cn;
	}

	return nextDef;
}

export function create (def) {
	let sheet = getSheet();

	let nextDecls = [];
	let nextDef = createDefinition(def, nextDecls);

	for (let decl of nextDecls) {
		sheet.insertRule(decl);
	}

	return nextDef;
}
