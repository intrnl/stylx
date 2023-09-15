# stylx

CSS-in-JS library with near-zero runtime.

## Usage

```jsx
import { create } from '@intrnl/stylx';

const styles = create({
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
const _red = '_1eyt9b0 ';
const _redEmboldened = '_1eyt9b1 _1eyt9b0 ';
const _underlinedOnHover = '_1eyt9b2 ';

import * as _stylx from '@intrnl/stylx/runtime';

_stylx.inject(
	'_1eyt9b',
	'._1eyt9b0{color:red;}._1eyt9b1{font-weight:700;}._1eyt9b2{&:hover{text-decoration:underline;}}',
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

Locally-scoped keyframes and variables can be done via the following:

```jsx
const styles = create({
	'@property background': {},
	'@keyframes spin': {
		to: {
			transform: 'rotate(360deg)',
		},
	},

	root: {
		background: 'var($background)',
		animation: '$spin 1s linear infinite',
	},
	isHighlighted: {
		$background: 'yellow',
	},
});
```

### Class name concatenation

stylx provides an optimized utility function for concatenation. Note that you can only reference variables that can be easily analyzed, as is the case with stylx' own styles.

```jsx
const styles = create({
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
