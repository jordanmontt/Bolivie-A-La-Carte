// The small YAML reader used for content/ (tools/yaml.mjs).
import {test} from "node:test";
import assert from "node:assert/strict";
import {parse, dump} from "../tools/yaml.mjs";

test("reads maps, lists, numbers, short lists and comments", () => {
  const v = parse(`
# a comment
name: Sorata      # after a value
altitude: 2700
major: true
days: [1, 2]
dishes: [trucha, sopa_quinua]
photos:
  - file: a.jpg
    author: Someone
  - file: b.jpg
`);
  assert.deepEqual(v, {name:"Sorata", altitude:2700, major:true, days:[1, 2], dishes:["trucha", "sopa_quinua"],
    photos:[{file:"a.jpg", author:"Someone"}, {file:"b.jpg"}]});
});

test("joins >- text, keeps |- line breaks, reads quoted text", () => {
  const v = parse(`story: >-\n  one\n  two\npoem: |-\n  a\n  b\nshort: "Le lieu : «super»"\nplain: Le lieu : super\n`);
  assert.equal(v.story, "one two");
  assert.equal(v.poem, "a\nb");
  assert.equal(v.short, "Le lieu : «super»");
  assert.equal(v.plain, "Le lieu : super");
});

test("says where a mistake is", () => {
  assert.throws(() => parse("a:\n\tb: 1\n", "x.yml"), /x\.yml, line 2: use spaces/);
  assert.throws(() => parse("a: {b: 1}\n", "x.yml"), /x\.yml/);
});

test("what dump writes, parse reads back the same", () => {
  const v = {id:"x", days:[1, 2], fr:{name:"Île : test", todo:["un", "deux, trois"]}, n:3.5};
  assert.deepEqual(parse(dump(v)), v);
});
