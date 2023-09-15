import type { Properties } from 'csstype';

export type CSSTypeProperties = Properties<number | (string & {})>;

export type CSSProperties = {
	[Property in keyof CSSTypeProperties]: CSSTypeProperties[Property] | Array<CSSTypeProperties[Property]>;
};

export type ChildStyleRule = CSSProperties & {
	[key: `${string}&${string}`]: StyleRule;
	[key: `@media ${string}`]: StyleRule;
	[key: `@supports ${string}`]: StyleRule;
	[key: `@container ${string}`]: StyleRule;
	[key: `@layer ${string}`]: StyleRule;
};

export type StyleRule = ChildStyleRule & { composes?: string[] };

export type KeyframeRule = {
	[time: string]: CSSProperties;
};

export type PropertyRule = {
	inherits?: boolean;
	initialValue?: string;
	syntax?: string;
};

export type StyleDefinitions = {
	[key: string]: StyleRule;
	[key: `@property ${string}`]: PropertyRule;
	[key: `@keyframes ${string}`]: KeyframeRule;
};

export type ExtractStyleKey<T extends string | number | symbol> = T extends `@keyframes ${infer V}` ? V : T;

const die = () => {
	return new Error(`stylx is not configured properly!`);
};

export const create = <T extends StyleDefinitions>(
	// @ts-expect-error
	definitions: T,
): Readonly<Record<ExtractStyleKey<keyof T>, string>> => {
	throw die();
};

export const join = (
	// @ts-expect-error
	...classes: Array<string | 0 | false | undefined | null>,
): string => {
	throw die();
};
