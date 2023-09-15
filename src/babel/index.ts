import type { NodePath } from '@babel/core';
import * as t from '@babel/types';

import { declare } from '@babel/helper-plugin-utils';

import type { KeyframeRule, StyleDefinitions, StyleRule } from '../index.js';
import { NONDIMENSIONAL_PROPERTIES } from './constants.js';

export interface PluginOptions {
	moduleName?: string;
	runtimeModuleName?: string;
	/** Enable development mode transformation, disabled by default */
	development?: boolean;
	/** Enable batch transformation for chunk optimization, disabled by default */
	batch?: boolean;
	/** Loose transformation, fills the styles object, disabled by default */
	loose?: boolean;
	/** Transform the resulting CSS string */
	transform?: (css: string) => string;
}

export default declare<PluginOptions>((_api, options) => {
	const {
		moduleName = '@intrnl/stylx',
		runtimeModuleName = '@intrnl/stylx/runtime',
		development: isDevelopment = false,
		batch: isBatched = false,
		loose: isLoose = false,
		transform: transformCss,
	} = options;

	let hasStylxRuntime = false;
	let importsNS: t.Identifier;

	return {
		name: 'stylx',
		visitor: {
			Program: {
				enter(path) {
					hasStylxRuntime = false;
					importsNS = path.scope.generateUidIdentifier('_stylx');
				},
				exit(path) {
					if (hasStylxRuntime) {
						path.unshiftContainer(
							'body',
							t.importDeclaration(
								[t.importNamespaceSpecifier(importsNS)],
								t.stringLiteral(runtimeModuleName),
							),
						);
					}
				},
			},
			CallExpression(path) {
				const callee = path.get('callee');

				if (callee.referencesImport(moduleName, 'create')) {
					const parentPath = path.parentPath;

					if (!parentPath.isVariableDeclarator()) {
						throw path.buildCodeFrameError(`stylx.create can only be used within a variable declaration`);
					}

					const varIdent = parentPath.get('id');
					if (!varIdent.isIdentifier()) {
						throw varIdent.buildCodeFrameError(`cannot destructure from a stylx.create`);
					}

					const args = path.get('arguments');

					if (args.length !== 1) {
						throw path.buildCodeFrameError(`stylx.create only accepts 1 argument.`);
					}

					const objPath = args[0];

					if (!objPath.isObjectExpression()) {
						throw objPath.buildCodeFrameError(`unexpected type passed to stylx.create`);
					}

					const evaluation = objPath.evaluate();
					if (!evaluation.confident) {
						throw evaluation.deopt!.buildCodeFrameError(`dynamic values not supported`);
					}

					const obj = evaluation.value;
					let result: ReturnType<typeof buildStyles>;

					try {
						result = buildStyles(obj, this.file.opts.filename || undefined, isDevelopment);
					} catch (err) {
						const msg = err instanceof Error ? err.message : '' + err;
						throw objPath.buildCodeFrameError(msg);
					}

					const { hash, css, map } = result;

					const binding = path.scope.bindings[varIdent.node.name];
					const referencePaths = binding.referencePaths;

					const idents = new Map<string, t.Identifier>();
					const properties: t.ObjectProperty[] = [];

					for (const [key, def] of map) {
						const ident = path.scope.generateUidIdentifier(key);

						let composed = def.name;
						if (def.type & DefType.STYLE) {
							const composes = def.composes;
							composed += (composes ? ' ' + composes.join(' ') : '') + ' ';
						} else if (def.type & DefType.PROPERTY) {
							composed = '--' + composed;
						}

						idents.set(key, ident);

						path.scope.push({ kind: 'const', id: ident, init: t.stringLiteral(composed) });

						if (isLoose) {
							properties.push(t.objectProperty(t.identifier(key), ident));
						}
					}

					for (let i = 0, ilen = referencePaths.length; i < ilen; i++) {
						const refPath = referencePaths[i];
						const parentRefPath = refPath.parentPath;

						if (!parentRefPath || !parentRefPath.isMemberExpression()) {
							continue;
						}

						const parentRefNode = parentRefPath.node;
						const propertyPath = parentRefPath.get('property');

						let ident: t.Identifier | undefined;

						if (parentRefNode.computed) {
							const evaluation = propertyPath.evaluate();

							if (evaluation.confident) {
								const key = '' + evaluation.value;
								ident = idents.get(key);
							}
						} else if (propertyPath.isIdentifier()) {
							const key = propertyPath.node.name;
							ident = idents.get(key);
						}

						if (ident) {
							parentRefPath.replaceWith(ident);
						}
					}

					let transformedCss = css;

					if (transformCss) {
						transformedCss = transformCss(css);
					}

					path.replaceWith(t.objectExpression(properties));

					if (css.length > 0) {
						if (isDevelopment) {
							path.insertBefore(
								t.callExpression(t.memberExpression(importsNS, t.identifier('injectDEV')), [
									t.stringLiteral(hash),
									t.stringLiteral(transformedCss),
								]),
							);
						} else if (isBatched) {
							path.insertBefore(
								t.callExpression(t.memberExpression(importsNS, t.identifier('injectBatch')), [
									t.objectExpression([t.objectProperty(t.identifier(hash), t.stringLiteral(transformedCss))]),
									t.stringLiteral('__STYLX_BATCH_INJECT__'),
								]),
							);
						} else {
							path.insertBefore(
								t.callExpression(t.memberExpression(importsNS, t.identifier('inject')), [
									t.stringLiteral(hash),
									t.stringLiteral(transformedCss),
								]),
							);
						}

						hasStylxRuntime = true;
					}

					return;
				}

				if (callee.referencesImport(moduleName, 'join')) {
					const args = path.get('arguments');
					let joinExpr: t.Expression | undefined;

					for (let i = 0, ilen = args.length; i < ilen; i++) {
						const arg = args[i];
						const expr = createJoin(arg);

						if (joinExpr) {
							joinExpr = t.binaryExpression('+', joinExpr, expr);
						} else {
							joinExpr = expr;
						}
					}

					path.replaceWith(joinExpr ?? t.stringLiteral(''));
				}
			},
		},
	};
});

/// stylx.join
const createJoin = (
	arg: NodePath<t.ArgumentPlaceholder | t.JSXNamespacedName | t.SpreadElement | t.Expression>,
): t.Expression => {
	if (arg.isLogicalExpression()) {
		const left = arg.get('left');
		const right = arg.get('right');

		const operator = arg.node.operator;

		if (operator !== '&&') {
			throw arg.buildCodeFrameError(`cannot statically analyze`);
		}

		return t.conditionalExpression(left.node, createJoin(right), t.stringLiteral(''));
	} else if (arg.isConditionalExpression()) {
		const consequent = arg.get('consequent');
		const alternate = arg.get('alternate');

		return t.conditionalExpression(arg.get('test').node, createJoin(consequent), createJoin(alternate));
	}

	const evaluation = arg.evaluate();

	if (!evaluation.confident) {
		throw arg.buildCodeFrameError(`cannot statically analyze`);
	}

	const value = evaluation.value;

	if (!evaluation.value) {
		return t.stringLiteral('');
	}

	const str = '' + value;

	if (!str.endsWith(' ')) {
		return t.binaryExpression('+', arg.node as t.Expression, t.stringLiteral(' '));
	}

	return arg.node as t.Expression;
};

/// stylx.create
const enum DefType {
	STYLE = 1 << 0,
	PROPERTY = 1 << 1,
	KEYFRAME = 1 << 2,
}

interface DefSpec {
	type: DefType;
	name: string;
	composes?: string[];
}

const INVALID_DEBUG_NAME_RE = /\W/g;
const buildStyles = (definitions: StyleDefinitions, filename?: string, debug?: boolean) => {
	const hash = hashContent(filename || definitions);
	const map = new Map<string, DefSpec>();

	let counter = 0;
	let css = '';

	for (const key in definitions) {
		const body = definitions[key] as any;
		let aliasedName = hash + (counter++).toString(36);

		if (debug) {
			aliasedName += '_' + key.replace(INVALID_DEBUG_NAME_RE, '_');
		}

		if (key.startsWith('@keyframes ')) {
			const name = key.slice(11).trim();

			if (map.has(name)) {
				throw new Error(`duplicate keyframe rule: ${name}`);
			}

			css += compileKeyframe(map, aliasedName, body);
			map.set(name, { type: DefType.KEYFRAME, name: aliasedName });
		} else if (key.startsWith('@property ')) {
			const name = key.slice(10).trim();

			if (map.has(name)) {
				throw new Error(`duplicate property rule: ${name}`);
			}

			map.set(name, { type: DefType.PROPERTY, name: aliasedName });
		} else {
			const name = key.trim();

			if (map.has(name)) {
				throw new Error(`duplicate style rule: ${name}`);
			}

			const spec: DefSpec = { type: DefType.STYLE, name: aliasedName };

			css += compileStyle(map, spec, aliasedName, body);
			map.set(name, spec);
		}
	}

	return { hash, css, map };
};

/// Compilers
const ATRULE_RE = /^@([a-z]+)\s+(.+)\s*/;

const compileStyle = (map: Map<string, DefSpec>, def: DefSpec, alias: string, rule: StyleRule) => {
	if (rule.composes) {
		def.composes = rule.composes.flatMap((name: string) => {
			const match = REFERENCE_FULL_RE.exec(name);

			if (match) {
				const ref = match[1];
				const dep = map.get(ref);

				if (!dep) {
					throw new Error(`unknown compose value: ${ref}`);
				}
				if (!(def.type & DefType.STYLE)) {
					throw new Error(`cannot compose from ${ref}`);
				}

				const aliased = dep.name;
				const subdep = dep.composes;

				return subdep ? [aliased, ...subdep] : aliased;
			} else {
				return name;
			}
		});
	}

	return compileStyleBody(map, `.${alias}`, rule);
};
const compileStyleBody = (map: Map<string, DefSpec>, selector: string, rule: StyleRule) => {
	let res = '';
	res += `${selector}{`;

	for (const name in rule) {
		// @ts-expect-error
		const body = rule[name];

		if (name.includes('&')) {
			res += compileStyleBody(map, replaceReferences(map, name, DefType.STYLE), body);
		} else if (name.startsWith('@')) {
			const match = ATRULE_RE.exec(name);

			if (!match) {
				throw new Error(`invalid atrule: ${name}`);
			}

			const [, atrule, args] = match;
			res += compileStyleBody(map, `@${atrule} ${args}`, body);
		} else if (name === 'composes') {
			// ignore
		} else {
			const animation = name.startsWith('animation');
			const dimensional = !(name in NONDIMENSIONAL_PROPERTIES);

			const hyphenated = getStyleName(map, name);

			if (Array.isArray(body)) {
				for (let i = 0, ilen = body.length; i < ilen; i++) {
					const val = compileStyleValue(map, body[i], dimensional, animation);
					res += `${hyphenated}:${val};`;
				}
			} else {
				const val = compileStyleValue(map, body, dimensional, animation);
				res += `${hyphenated}:${val};`;
			}
		}
	}

	res += `}`;

	return res;
};
const compileStyleValue = (
	map: Map<string, DefSpec>,
	raw: string | number,
	dimensional: boolean,
	animation: boolean,
) => {
	return dimensional && typeof raw === 'number'
		? raw + 'px'
		: replaceReferences(map, '' + raw, DefType.PROPERTY | (animation ? DefType.KEYFRAME : 0));
};

const compileKeyframe = (map: Map<string, DefSpec>, alias: string, rule: KeyframeRule) => {
	let res = '';
	res += `@keyframes ${alias}{`;

	for (const time in rule) {
		const body = rule[time];

		res += `${time}{`;

		for (const name in body) {
			// @ts-expect-error
			const content = body[name];

			const hyphenated = getStyleName(map, name);
			const dimensional = !(name in NONDIMENSIONAL_PROPERTIES);

			const value = compileStyleValue(map, content, dimensional, false);

			res += `${hyphenated}:${value};`;
		}

		res += `}`;
	}

	res += `}`;
	return res;
};

/// References
const REFERENCE_FULL_RE = /^\$([\w-]+)$/;
const REFERENCE_RE = /\$([\w-]+)/g;
const replaceReferences = (map: Map<string, DefSpec>, content: string, type: number) => {
	return content.replace(REFERENCE_RE, (_match, name) => {
		return getReference(map, name, type);
	});
};

const getReference = (map: Map<string, DefSpec>, name: string, type: number) => {
	const def = map.get(name);

	if (!def) {
		throw new Error(`undefined reference: ${name}`);
	}
	if (!(def.type & type)) {
		throw new Error(`unexpected reference usage: ${name}`);
	}

	const alias = def.name;

	if (type === DefType.STYLE) {
		return '.' + alias;
	} else if (type === DefType.PROPERTY) {
		return '--' + alias;
	}

	return alias;
};

/// Style property name
const UPPERCASE_RE = /[A-Z]/g;
const toHyphenLower = (match: string) => '-' + match.toLowerCase();

const getStyleName = (map: Map<string, DefSpec>, name: string) => {
	if (name[0] === '$') {
		return getReference(map, name.slice(1), DefType.PROPERTY);
	}
	if (name[0] === '-' && name[1] === '-') {
		return name;
	}

	const res = name.replace(UPPERCASE_RE, toHyphenLower);
	return res[0] === 'm' && res[1] === 's' && res[2] === '-' ? '-' + res : res;
};

/// Hash
const hashContent = (content: string | StyleDefinitions) => {
	const stringified = typeof content !== 'string' ? JSON.stringify(content) : content;
	const hash = cyrb53a(stringified).toString(36).slice(0, 6);
	const first = hash.charCodeAt(0);

	return first >= 48 && first <= 57 ? '_' + hash : hash;
};

/**
 * https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 */
const cyrb53a = (str: string, seed = 0) => {
	let h1 = 0xdeadbeef ^ seed;
	let h2 = 0x41c6ce57 ^ seed;

	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 0x85ebca77);
		h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d);
	}

	h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
	h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
	h1 ^= h2 >>> 16;
	h2 ^= h1 >>> 16;

	return 2097152 * (h2 >>> 0) + (h1 >>> 11);
};
