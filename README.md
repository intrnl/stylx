# stylx

CSS-in-JS library with near-zero runtime.

## Usage

```jsx
import { createStyles } from '@intrnl/stylx';

const styles = createStyles({
	red: {
		color: 'red',
	},
	redEmboldened: {
		composes: ['$red'],
		fontWeight: 700,
	},
	underlinedOnHover: {
		'&:hover': {
			textDecoration: 'underline',
		},
	},
});

const App = () => {
	return (
		<div>
			<p className={styles.red}>This is red</p>
			<p className={styles.redEmboldened}>This is emboldened red</p>
		</div>
	);
};
```

Using the Babel plugin, this will generate...

```jsx
const _red = 'm84tdn0 ',
	_redEmboldened = 'm84tdn1 m84tdn0 ',
	_underlinedOnHover = 'm84tdn2 ';

import * as _stylx from '@intrnl/stylx/runtime';

_stylx.inject(
	'm84tdn',
	'.m84tdn0{color:red;}.m84tdn1{font-weight:700;}.m84tdn2{&:hover{text-decoration:underline;}}',
);

const styles = {};

const App = () => {
	return (
		<div>
			<p className={_red}>This is red</p>
			<p className={_redEmboldened}>This is emboldened red</p>
		</div>
	);
};
```

By default, the `styles` object becomes empty to encourage writing code in a
way that can be easily analyzed by the plugin. This can be disabled by setting `loose: true` in the plugin options.

### Keyframes and CSS variables

Scoped keyframes and variables can be defined via `createKeyframes` and `createVariables` respectively.

```jsx
const variables = createVariables({
	background: {},
});

const keyframes = createKeyframes({
	spin: {
		to: {
			transform: 'rotate(360deg)',
		},
	},
});

const styles = create({
	root: {
		background: `var(${variables.background})`,
		animation: `${keyframes.spin} 1s linear infinite`,
	},
	isHighlighted: {
		[variables.background]: 'yellow',
	},
});
```

### Class name concatenation

stylx provides an optimized utility function for concatenation. Note that you can only reference variables that can be easily analyzed, as is the case with stylx' own styles.

```jsx
const styles = createStyles({
	isBordered: {},
	root: {},

	isStandalone: {},
	isMultiple: {},
	item: {},
});

log(join(styles.root, !borderless && styles.isBordered));
log(join(styles.item, standalone ? styles.isStandalone : styles.isMultiple));

log(join('foo', 'bar'));
```

... where it would be generate...

```js
log(_root + (!borderless ? _isBordered : ''));
log(_item + (standalone ? _isStandalone : _isMultiple));

log('foo' + ' ' + ('bar' + ' '));
```

### Vite plugin

An optional Vite plugin can be used to emit the styles as actual CSS files, this
removes the runtime aspect entirely, it's recommended that it's used during
production builds only.

```jsx
import { defineConfig } from 'vite';

import stylxVitePlugin from '@intrnl/stylx/vite';

export default defineConfig((ctx) => {
	const isProduction = ctx.mode === 'production';

	return {
		plugins: [
			// insert all other plugins...
			isProduction && stylxVitePlugin({ include: /\.tsx?$/ }),
		],
	};
});
```

You'd have to configure the plugin's `mode` to `placeholder` for this to work.
