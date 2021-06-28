import * as CSS from 'csstype';


export interface CSSDefinition extends CSS.Properties {
	selectors?: { [selector: string]: CSSDefinition };
	queries?: { [query: string]: CSSDefinition };
}

export interface CSSClassNames extends Record<keyof CSS.Properties, string> {
	selectors?: { [selector: string]: CSSClassNames };
	queries?: { [query: string]: CSSClassNames };
}

export function create (definition: CSSDefinition): CSSClassNames;

export function apply (...definitions: CSSClassNames[]): string;
