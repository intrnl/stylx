import { merge, isObject, isString } from './utils.js';


export function apply (...defs) {
	let def = merge({}, ...defs);
	return mergeClassNames(def);
}

function mergeClassNames (def) {
	let className = '';
	let leading = true;

	for (let key in def) {
		let value = def[key];

		if (leading) {
			leading = false;
		} else {
			className += ' ';
		}

		if (isString(value)) {
			className += value;
		} else if (isObject(value)) {
			className += mergeClassNames(value);
		}
	}

	return className;
}
