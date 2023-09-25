import { type FilterPattern, type Plugin, createFilter } from 'vite';

import MagicString from 'magic-string';

const MATCH_RE = /globalThis\.__stylxInjectCss\?\.\((['"]).+?\1,\s*(?<quote>['"])(?<source>.+)\2\)/g;
const SUFFIX = '.\0stylx.css';

export interface PluginOptions {
	include?: FilterPattern;
	exclude?: FilterPattern;
}

const stylxVitePlugin = (options: PluginOptions = {}): Plugin => {
	const filter = createFilter(options.include, options.exclude);

	return {
		name: '@intrnl/stylx',

		resolveId(source, _importer, _options) {
			if (source.endsWith(SUFFIX)) {
				return source;
			}
		},
		load(id, _options) {
			if (!id.endsWith(SUFFIX)) {
				return null;
			}

			const modId = id.slice(0, -SUFFIX.length);
			const mod = this.getModuleInfo(modId);

			const css = mod?.meta.css;

			if (css === undefined) {
				return null;
			}

			return {
				code: css,
			};
		},

		transform(code, id, _options) {
			if (!filter(id)) {
				return null;
			}

			let str: MagicString | undefined;
			let match;

			let css = '';

			while ((match = MATCH_RE.exec(code))) {
				if (!str) {
					str = new MagicString(code);
				}

				const index = match.index;
				const groups = match.groups!;

				const quote = groups.quote;
				const raw = groups.source;

				const source = JSON.parse(quote + raw + quote);

				css += source;
				str.overwrite(index, index + match[0].length, 'void 0');
			}

			if (!str) {
				return null;
			}

			str.prepend(`import ${JSON.stringify(id + SUFFIX)};`);

			return {
				code: str.toString(),
				map: str.generateMap({ hires: 'boundary' }),
				meta: {
					css: css,
				},
			};
		},
	};
};

export default stylxVitePlugin;
