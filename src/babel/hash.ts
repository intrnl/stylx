const imul = Math.imul;

// 'm' and 'r' are mixing constants generated offline.
// They're not really 'magic', they just happen to work well.
const m = 0x5bd1e995;
const r = 24;

export const murmur2 = (str: string) => {
	// Initialize the hash
	let h = 0; // Mix 4 bytes at a time into the hash

	let k;
	let i = 0;
	let len = str.length;

	for (; len >= 4; ++i, len -= 4) {
		k =
			(str.charCodeAt(i) & 0xff) |
			((str.charCodeAt(++i) & 0xff) << 8) |
			((str.charCodeAt(++i) & 0xff) << 16) |
			((str.charCodeAt(++i) & 0xff) << 24);

		k = imul(k, m);
		k ^= k >>> r;
		h = imul(k, m) ^ imul(h, m);
	} // Handle the last few bytes of the input array

	switch (len) {
		case 3:
			h ^= (str.charCodeAt(i + 2) & 0xff) << 16;

		case 2:
			h ^= (str.charCodeAt(i + 1) & 0xff) << 8;

		case 1:
			h ^= str.charCodeAt(i) & 0xff;
			h = imul(h, m);
	} // Do a few final mixes of the hash to ensure the last few bytes are well-incorporated.

	h ^= h >>> 13;
	h = imul(h, m);

	return ((h ^ (h >>> 15)) >>> 0).toString(36);
};
