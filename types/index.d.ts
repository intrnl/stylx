import * as CSS from 'csstype';


export interface CSSDefinition extends CSS.Properties<string | number> {
	selectors?: { [selector: string]: CSSDefinition };
	queries?: { [query: string]: CSSDefinition };
}

export function create (definition: CSSDefinition): CSSDefinition;
export function apply (...definitions: CSSDefinition[]): string;
