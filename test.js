import { transformAsync } from '@babel/core';
import stylxPlugin from './dist/babel/index.js';

const source = `
import * as stylx from '@intrnl/stylx';

const styles = stylx.create({
	isBordered: {},

	isInteractive: {},
	isBlurred: {},

	isStandalone: {},
	isMultiple: {},

	root: {
		selectors: {
			'&$isBordered': {
				overflow: 'hidden',
				border: '1px solid rgb(var(--divider))',
				borderRadius: 6,
			},
		},
	},
	grid: {
		display: 'flex',
		aspectRatio: '16 / 9',
		gap: 2,
	},
	subgrid: {
		display: 'flex',
		flex: '1 auto 0px',
		flexDirection: 'column',
		gap: 2,
	},

	item: {
		position: 'relative',
		overflow: 'hidden',

		selectors: {
			'&$isStandalone': {
				aspectRatio: '16 / 9',
			},
			'&$isMultiple': {
				minHeight: 0,
				flex: '1 auto 0px',
			},
		},
	},
	image: {
		height: '100%',
		width: '100%',
		objectFit: 'cover',

		selectors: {
			'$isInteractive &': {
				cursor: 'pointer',
			},

			'$isBlurred &': {
				scale: 1.1,
				filter: 'blur(16px)',
			},
			'$isBordered$isBlurred &': {
				filter: 'blur(8px)',
			},
		}
	},

	altButton: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		margin: 8,
		height: 20,
		borderRadius: 4,
		background: 'rgb(0 0 0 / 0.7)',
		padding: '0 4px',
		fontSize: '0.75rem',
		lineHeight: '1rem',
		fontWeight: 500,
	},
});

const lol = 'lol';

stylx.join(styles.root, !borderless && styles.isBordered, interactive() && styles.isInteractive);
stylx.join(styles.item, standalone ? styles.isStandalone : styles.isMultiple);
`;

const result = await transformAsync(source, {
	plugins: [[stylxPlugin, { batch: false }]],
});

const code = result.code;
console.log(code);

// const re = /[a-zA-Z_$.]+\(\s*{(.+)}\s*,\s*['"]__STYLX_BATCH_INJECT__"\)/gs;
// console.log(JSON.stringify(re.exec(code)[1].trim()));
