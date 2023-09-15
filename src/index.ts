import type { Properties } from 'csstype';

export type CSSTypeProperties = Properties<number | (string & {})>;

export type CSSProperties = {
	[Property in keyof CSSTypeProperties]: CSSTypeProperties[Property] | Array<CSSTypeProperties[Property]>;
};

export interface ChildStyleRule extends CSSProperties {
	variables?: {
		[key: string]: string;
	};
	selectors?: {
		[key: string]: ChildStyleRule;
	};
}

export interface StyleRule extends ChildStyleRule {
	composes?: string[];
}

export interface ChildKeyframeRule extends CSSProperties {
	variables?: {
		[key: string]: string;
	};
}

export interface KeyframeRule {
	[time: string]: ChildKeyframeRule;
}

export interface VariableRule {
	inherits?: boolean;
	initialValue?: string;
	syntax?: string;
}

export type StyleDefinitions = {
	[key: string]: StyleRule;
};

export type KeyframeDefinitions = {
	[key: string]: KeyframeRule;
};

export type VariableDefinitions = {
	[key: string]: VariableRule;
};

const die = () => {
	return new Error(`stylx is not configured properly!`);
};

export const createStyles = <T extends string>(defs: Record<T, StyleRule>): Readonly<Record<T, string>> => {
	throw die();
};

export const createKeyframes = <T extends string>(
	defs: Record<T, KeyframeRule>,
): Readonly<Record<T, string>> => {
	throw die();
};

export const createVariables = <T extends string>(
	defs: Record<T, VariableRule>,
): Readonly<Record<T, string>> => {
	throw die();
};

export const join = (...classes: Array<string | 0 | false | undefined | null>): string => {
	throw die();
};
