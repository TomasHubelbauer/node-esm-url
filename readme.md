# Node ESM HTTP

I'd like to hack up a solution to supporting HTTP ESM imports in Node. This is
going to be a hack which will enable using ESM libraries in Node which have HTTP
imports in them, something that is supported in the browser with no issues. This
will make libraries which are currently not portable, portable.

An example of an ESM library supported by the browser but not Node today:

```js
import thing from 'https://example.com/thing.js';

export default function act() {
  return thing.act();
}
```

This library can be used as-is in the browser and not at all in Node. It could
be reworked to support Node, but we do not negotitate with terrorists. Instead
of dirtying the library because Node is lame, let's push the work-arounds and
compromises onto the source of the issue: Node.

## The Plan

To make this work, I am thinking of combining a few already hacky ideas into one
super-hacky idea which is so crazy it might actually work.

### URL hash and search parts supported in file imports in Node

While Node doesn't support full URL imports unlikely the browser, it's file
import resolution algorithm does treat the file import paths are URLs. Example:

```js
import './thing.js?search#hash';
```

This code is perfectly valid Node ESM import code and it will pull `thing.js` in
without fail. The URL search and hash parts will be ignored, but their values
can be accessed in the module being imported through `import.meta.url`.

We could create an entry point, something like `esm.js` which would accept the
URL of the HTTP ESM import through the URL parts of its file name, e.g.:

```js
import thing from 'esm.js?https://example.com/thing.js';
```

Of course this is not a true HTTP ESM import, but it should be a good first step
when prototyping this.

### Synchronous network in Node

With the knowledge of the URL we want to import, what could `esm.js` do to make
it happen? We will need to fetch the source code of the module from the URL and
then re-export it from self once available.

We should not run into caching issues, as Node will distinguish the `esm.js`
imports based on the URL search part, too, so multiple imports of `esm.js` all
with different URL search part should result in multiple variations of uncached
`esm.js` module load.

To fetch the module, we need to make a synchronous network request for the code.
Of course, synchronous network requests are not a good idea, but I have found an
answer on Stack Overflow showing that someone has figured this out anyway:
https://stackoverflow.com/a/37802984/2715716

The implementation is in https://github.com/ForbesLindesay/sync-request.

Of course, Stack Overflow being the dumpster fire it is, the accepted answer is
a tired XY problem non-answer, but thankfully someone who can actually read text
has answered and the correct answer is more upvoted than the non-answer.

I don't think I will use this library exactly, but I will make use of the hack
it supposedly uses: to make a synchronous process call. I'm thinking of calling
something like `child_process.execSync('curl ' + url)` and being done with it.

### "Re-exporting" the module as fetched from the network

With the above two tricks, I'll be able to see what module to import and to get
its source code. The next step is to parse the module into an actual module and
export it as the `esm.js` helper module default export. To do this, good old
`eval` should do the trick hopefully. If not, I'm sure there's some other magic
like `Module.parse` or something. I'll need to look into this more closely.

### Truly enabling HTTP ESM imports

The last bit of the puzzle that needs to be solved to unblock it all is to make
actual HTTP ESM imports work, without the helper module and any import part
trickery. This should be doable by patching the function Node uses to import a
module:

https://tech.wayfair.com/2018/06/custom-module-loading-in-a-node-js-environment/
