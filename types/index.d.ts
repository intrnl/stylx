import * as CSS from 'csstype';


export type CSSProperties =
	& CSS.Properties
	& { [selector: string]: CSSProperties };

export type CSSClassNames =
	& { [P in keyof CSS.Properties]: string }
	& { [selector: string]: CSSClassNames };

export function create (definition: CSSProperties): CSSClassNames;

export function apply (...definitions: CSSClassNames[]): string;
