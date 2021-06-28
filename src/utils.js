let RE_UPPERCASE = /[A-Z]/g;

export let isString = (x) => typeof x === 'string';
export let isNumber = (x) => typeof x === 'number';
export let isObject = (x, t = typeof x) => x && (t === 'object' || t === 'function');


export function merge (target, ...sources) {
	for (let source of sources) {
		if (!isObject(source)) continue;

		mergeObject(target, source);
	}

	return target;
}

export function mergeObject (target, source) {
	for (let key in source) {
		let prev = target[key];
		let next = source[key];

		if (isObject(prev) && isObject(next)) {
			target[key] = mergeObject(prev, next);
		} else {
			target[key] = next;
		}
	}

	return target;
}

export function toKebabCase (str) {
	return (str.startsWith('ms') ? '-' : '') +
		str.replace(RE_UPPERCASE, '-$&').toLowerCase();
}
