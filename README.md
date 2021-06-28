# stylx

An atomic CSS-in-JS library.

## Usage

```jsx
import * as stylx from '@intrnl/stylx';

let red = stylx.create({ color: 'red' });
let blue = stylx.create({ color: 'blue' });

function App () {
  return (
    <div>
      <div className={stylx.apply(red, blue)}>
        It's blue!
      </div>
      <div className={stylx.apply(blue, red)}>
        It's red!
      </div>
    </div>
  );
}
```

## Inspiration

- [Building the New Facebook with React and Relay][building-facebook]  
  Starting at 2:45, Frank Yan specifically talks about the new CSS-in-JS
  solution that they are using to build Facebook.

[building-facebook]: https://www.youtube.com/watch?v=9JZHodNR184
