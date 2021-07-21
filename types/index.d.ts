import * as CSS from 'csstype';


export interface CSSDefinition extends CSS.Properties<string | number | false> {
	selectors?: { [selector: string]: CSSDefinition };
	queries?: { [query: string]: CSSDefinition };
}

type Values = CSSDefinition | null | undefined | false | Values[];

export function create (definition: CSSDefinition): CSSDefinition;
export function apply (...definitions: Values[]): string;
