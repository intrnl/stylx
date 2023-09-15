import type { NodePath } from '@babel/core';
import * as t from '@babel/types';

import { declare } from '@babel/helper-plugin-utils';

import type {
	KeyframeDefinitions,
	KeyframeRule,
	StyleDefinitions,
	StyleRule,
	VariableDefinitions,
} from '../index.js';

import { NONDIMENSIONAL_PROPERTIES } from './constants.js';
import { murmur2 } from './hash.js';

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

interface FileContext {
	cssSource: string;
	hash: string;
	counter: number;
	transformCss?: (css: string) => string;
	isDevelopment: boolean;
	isLoose: boolean;
}

const createValidHash = (str: string) => {
	const hash = murmur2(str).slice(0, 6);
	const first = hash.charCodeAt(0);

	return first >= 48 && first <= 57 ? '_' + hash : hash;
};

export default declare<PluginOptions>((_api, options) => {
	const {
		moduleName = '@intrnl/stylx',
		runtimeModuleName = '@intrnl/stylx/runtime',
		development: isDevelopment = false,
		batch: isBatched = false,
		loose: isLoose = false,
		transform: transformCss,
	} = options;

	let ctx: FileContext;
	let injectReference: NodePath | undefined;

	return {
		name: '@intrnl/stylx',
		visitor: {
			Program: {
				enter() {
					ctx = {
						cssSource: '',
						hash: createValidHash(this.file.opts.filename!),
						counter: 0,
						isDevelopment: isDevelopment,
						isLoose: isLoose,
					};

					injectReference = undefined;
				},
				exit(path) {
					if (ctx && ctx.cssSource.length > 0) {
						const importsNS = path.scope.generateUidIdentifier('_stylx');

						let css = ctx.cssSource;
						let expr: t.CallExpression;

						if (transformCss) {
							css = transformCss(css);
						}

						if (isDevelopment) {
							expr = t.callExpression(t.memberExpression(importsNS, t.identifier('injectDEV')), [
								t.stringLiteral(ctx.hash),
								t.stringLiteral(css),
							]);
						} else if (isBatched) {
							expr = t.callExpression(t.memberExpression(importsNS, t.identifier('injectBatch')), [
								t.objectExpression([t.objectProperty(t.identifier(ctx.hash), t.stringLiteral(css))]),
								t.stringLiteral('__STYLX_BATCH_INJECT__'),
							]);
						} else {
							expr = t.callExpression(t.memberExpression(importsNS, t.identifier('inject')), [
								t.stringLiteral(ctx.hash),
								t.stringLiteral(css),
							]);
						}

						if (injectReference) {
							injectReference.insertBefore(expr);
						} else {
							path.unshiftContainer('body', t.expressionStatement(expr));
						}

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

				if (callee.referencesImport(moduleName, 'createStyles')) {
					injectReference ||= path;
					handleCreateX(ctx, DefType.STYLES, path);
					return;
				}
				if (callee.referencesImport(moduleName, 'createVariables')) {
					injectReference ||= path;
					handleCreateX(ctx, DefType.VARIABLES, path);
					return;
				}
				if (callee.referencesImport(moduleName, 'createKeyframes')) {
					injectReference ||= path;
					handleCreateX(ctx, DefType.KEYFRAMES, path);
					return;
				}

				if (callee.referencesImport(moduleName, 'join')) {
					handleJoin(path);
					return;
				}
			},
		},
	};
});

/// join
const handleJoin = (path: NodePath<t.CallExpression>) => {
	const args = path.get('arguments');
	let joinExpr: t.Expression | undefined;

	for (let i = 0, ilen = args.length; i < ilen; i++) {
		const arg = args[i];
		const expr = createJoinExpr(arg);

		if (joinExpr) {
			joinExpr = t.binaryExpression('+', joinExpr, expr);
		} else {
			joinExpr = expr;
		}
	}

	path.replaceWith(joinExpr ?? t.stringLiteral(''));
};

const createJoinExpr = (
	arg: NodePath<t.ArgumentPlaceholder | t.JSXNamespacedName | t.SpreadElement | t.Expression>,
): t.Expression => {
	if (arg.isLogicalExpression()) {
		const left = arg.get('left');
		const right = arg.get('right');

		const operator = arg.node.operator;

		if (operator !== '&&') {
			throw arg.buildCodeFrameError(`cannot statically analyze`);
		}

		return t.conditionalExpression(left.node, createJoinExpr(right), t.stringLiteral(''));
	} else if (arg.isConditionalExpression()) {
		const consequent = arg.get('consequent');
		const alternate = arg.get('alternate');

		return t.conditionalExpression(
			arg.get('test').node,
			createJoinExpr(consequent),
			createJoinExpr(alternate),
		);
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

/// createX
const enum DefType {
	STYLES = 'createStyles',
	VARIABLES = 'createVariables',
	KEYFRAMES = 'createKeyframes',
}

const handleCreateX = (ctx: FileContext, type: DefType, path: NodePath<t.CallExpression>) => {
	const parentPath = path.parentPath;
	if (!parentPath.isVariableDeclarator()) {
		throw path.buildCodeFrameError(`${type} can only be used within a variable declaration`);
	}

	const varIdent = parentPath.get('id');
	if (!varIdent.isIdentifier()) {
		throw varIdent.buildCodeFrameError(`cannot destructure from a ${type}`);
	}

	const args = path.get('arguments');
	if (args.length !== 1) {
		throw path.buildCodeFrameError(`${type} only accepts 1 argument`);
	}

	const objPath = args[0];
	if (!objPath.isObjectExpression()) {
		throw objPath.buildCodeFrameError(`unexpected type passed to ${type}`);
	}

	const evaluation = objPath.evaluate();
	if (!evaluation.confident) {
		const ref = evaluation.deopt || objPath;

		throw ref.buildCodeFrameError(`cannot statically analyze ${type}`);
	}

	// Run the compile step
	let result: ReturnType<typeof buildX>;
	try {
		result = buildX(ctx, type, evaluation.value);
	} catch (err) {
		const msg = err instanceof Error ? err.message : '' + err;
		throw objPath.buildCodeFrameError(msg);
	}

	const { css, map } = result;

	const binding = path.scope.bindings[varIdent.node.name];
	const referencePaths = binding.referencePaths;

	const idents = new Map<string, t.Identifier>();
	const properties: t.ObjectProperty[] = [];

	// Create variables
	for (const [key, def] of map) {
		const ident = path.scope.generateUidIdentifier(key);

		let composed = def.alias;
		if (type === DefType.STYLES) {
			const composes = def.composes;
			composed += (composes ? ' ' + composes.join(' ') : '') + ' ';
		} else if (type === DefType.VARIABLES) {
			composed = '--' + composed;
		}

		idents.set(key, ident);

		path.scope.push({ kind: 'const', id: ident, init: t.stringLiteral(composed) });

		if (ctx.isLoose) {
			properties.push(t.objectProperty(t.identifier(key), ident));
		}
	}

	// Replace references
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

	// Replace the call, add the resulting styling
	path.replaceWith(t.objectExpression(properties));
	ctx.cssSource += css;
};

interface DefSpec {
	alias: string;
	composes?: string[];
}

interface DefTypeMaps {
	[DefType.STYLES]: StyleDefinitions;
	[DefType.VARIABLES]: VariableDefinitions;
	[DefType.KEYFRAMES]: KeyframeDefinitions;
}

type DefMap = Map<string, DefSpec>;

const INVALID_DEBUG_NAME_RE = /\W/g;
const REFERENCE_RE = /\$([\w-]+)/g;
const REFERENCE_FULL_RE = /^\$([\w-]+)$/;

const buildX = <T extends DefType>(ctx: FileContext, type: T, definitions: DefTypeMaps[T]) => {
	const map: DefMap = new Map<string, DefSpec>();

	let css = '';

	for (const key in definitions) {
		const body = definitions[key] as any;
		let alias = ctx.hash + (ctx.counter++).toString(36);

		if (ctx.isDevelopment) {
			alias += '_' + key.replace(INVALID_DEBUG_NAME_RE, '_');
		}

		const def: DefSpec = { alias: alias };

		if (type === DefType.STYLES) {
			css += compileStyle(map, def, alias, body);
		} else if (type === DefType.KEYFRAMES) {
			css += compileKeyframe(alias, body);
		} else if (type === DefType.VARIABLES) {
			css += compileVariable();
		} else {
			throw die(`unexpected type: ${type}`);
		}

		map.set(key, def);
	}

	return { map, css };
};

/// createStyles
const compileStyle = (map: DefMap, def: DefSpec, alias: string, rule: StyleRule) => {
	if (rule.composes) {
		def.composes = rule.composes.flatMap((name: string) => {
			const match = REFERENCE_FULL_RE.exec(name);

			if (match) {
				const ref = match[1];
				const dep = map.get(ref);

				if (!dep) {
					throw new Error(`unknown compose value: ${ref}`);
				}

				const aliased = dep.alias;
				const subdep = dep.composes;

				return subdep ? [aliased, ...subdep] : aliased;
			} else {
				return name;
			}
		});
	}

	return compileStyleBody(map, '.' + alias, rule);
};
const compileStyleBody = (map: Map<string, DefSpec>, selector: string, rule: StyleRule) => {
	let res = '';
	res += `${selector}{`;

	for (const name in rule) {
		// @ts-expect-error
		const body = rule[name];

		if (name === 'composes') {
			// ignore
		} else if (name === 'variables' && body) {
			for (const key in body) {
				const val = body[key];
				res += compileStyleKeyval(key, val);
			}
		} else if (name === 'selectors' && body) {
			for (const rawSelector in body) {
				const content = body[rawSelector];

				const selector =
					rawSelector[0] !== '@' ? rawSelector.replace(REFERENCE_RE, getKeyReference(map)) : rawSelector;

				res += compileStyleBody(map, selector, content);
			}
		} else {
			res += compileStyleKeyval(name, body);
		}
	}

	res += `}`;

	return res;
};
const getKeyReference = (map: DefMap) => {
	return (_match: string, name: string) => {
		const def = map.get(name);

		if (!def) {
			throw new Error(`undefined reference: ${name}`);
		}

		return def.alias;
	};
};

/// createKeyframes
const compileKeyframe = (alias: string, rule: KeyframeRule) => {
	let res = '';
	res += `@keyframes ${alias}{`;

	for (const time in rule) {
		const body = rule[time];

		res += `${time}{`;

		for (const name in body) {
			// @ts-expect-error
			const content = body[name];
			res += compileStyleKeyval(name, content);
		}

		res += `}`;
	}

	res += `}`;
	return res;
};

/// createVariables
const compileVariable = () => {
	return '';
};

// Style values
const UPPERCASE_RE = /[A-Z]/g;
const toHyphenLower = (match: string) => '-' + match.toLowerCase();

const getStyleName = (name: string) => {
	if (name[0] === '-' && name[1] === '-') {
		return name;
	}

	const res = name.replace(UPPERCASE_RE, toHyphenLower);
	return res[0] === 'm' && res[1] === 's' && res[2] === '-' ? '-' + res : res;
};

const compileStyleKeyval = (key: string, value: string | number | (string | number)[]) => {
	if (Array.isArray(value)) {
		let res = '';

		for (let i = 0, ilen = value.length; i < ilen; i++) {
			const v = value[i];
			res += compileStyleKeyval(key, v);
		}

		return res;
	}

	const dimensional = !(key in NONDIMENSIONAL_PROPERTIES);

	const name = getStyleName(key);
	const val = compileStyleValue(value, dimensional);

	return `${name}:${val};`;
};

const compileStyleValue = (raw: string | number, dimensional: boolean) => {
	return dimensional && typeof raw === 'number' ? raw + 'px' : raw;
};

/// Miscellaneous
const die = (msg: string) => {
	return new Error(msg);
};
