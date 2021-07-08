export let RE_UPPERCASE = /[A-Z]/g;

export let isNumber = (v) => typeof v === 'number';
export let isString = (v) => typeof v === 'string';
export let isObject = (v) => v && typeof v === 'object';

export function toKebabCase (str) {
	return (str.startsWith('ms') ? '-' : '') +
		str.replace(RE_UPPERCASE, '-$&').toLowerCase();
}

export function merge (target, source) {
	for (let key in source) {
		let prev = target[key];
		let next = source[key];

		if (isObject(prev) && isObject(next)) {
			target[key] = merge(prev, next);
		} else {
			target[key] = next;
		}
	}

	return target;
}
