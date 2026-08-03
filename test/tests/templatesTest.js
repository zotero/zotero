var {
	generateHTMLFromTemplate,
	parseTemplateBrackets,
	isTemplateValid,
} = ChromeUtils.importESModule("chrome://zotero/content/modules/templates.mjs");

describe("Templates", function () {
	describe("#generateHTMLFromTemplate()", function () {
		it("should support variables with attributes", function () {
			var vars = {
				v1: '1',
				v2: pars => `${pars.a1 ?? ''}${pars.a2 ?? ''}${pars.a3 ?? ''}`,
				v3: () => '',
				v5: () => 'something',
				ar1: [],
				ar2: [1, 2]
			};
			var template = `{{ v1}}{{v2 a1= "1"  a2 =' 2' a3 = "3 "}}{{v3}}{{v4}}{{if ar1}}ar1{{endif}}{{if ar2}}{{ar2}}{{endif}}{{if v5}}yes{{endif}}{{if v3}}no1{{endif}}{{if v2}}{{v2}}{{endif}}`;
			var html = generateHTMLFromTemplate(template, vars);
			assert.equal(html, '11 23 1,2yes');
		});

		it("should support empty string as attribute value and correctly render returned false-ish values", function () {
			const vars = {
				length: ({ string }) => string.length.toString(),
			};
			const template = `"" has a length of {{ length string="" }} and "hello" has a length of {{ length string="hello" }}`;
			const out = generateHTMLFromTemplate(template, vars);
			assert.equal(out, '"" has a length of 0 and "hello" has a length of 5');
		});

		it("should parse attributes using the shared string-literal semantics", function () {
			const vars = { echo: attrs => JSON.stringify(attrs) };
			// Both quote styles, an empty value, and a hyphenated (camelCased) name
			assert.equal(
				generateHTMLFromTemplate('{{ echo a="x" b=\'y\' c="" my-attr="z" }}', vars),
				JSON.stringify({ a: 'x', b: 'y', c: '', myAttr: 'z' })
			);
			// A backslash is an ordinary character; a `"` always closes the value
			assert.equal(
				generateHTMLFromTemplate('{{ echo a="p\\q" }}', vars),
				JSON.stringify({ a: 'p\\q' })
			);
			// A value may contain the opposite quote by delimiting with the other one
			assert.equal(
				generateHTMLFromTemplate(`{{ echo a='"' b="it's" }}`, vars),
				JSON.stringify({ a: '"', b: "it's" })
			);
			// A newline inside a value is allowed
			assert.equal(
				generateHTMLFromTemplate('{{ echo a="p\nq" }}', vars),
				JSON.stringify({ a: 'p\nq' })
			);
		});

		it("should support functions in comparison statements", function () {
			const vars = {
				sum: ({ a, b }) => (parseInt(a) + parseInt(b)).toString(),
				fooBar: ({ isFoo }) => (isFoo === 'true' ? 'foo' : 'bar'),
				false: 'false',
				twoWords: 'two words',
				onlyOne: 'actually == 1'
			};
			const template = `{{if {{ sum a="1" b="2" }} == "3"}}1 + 2 = {{sum a="1" b="2"}}{{else}}no speak math{{endif}}`;
			const out = generateHTMLFromTemplate(template, vars);
			assert.equal(out, '1 + 2 = 3');

			const template2 = '{{if false != "false"}}no{{elseif false == "false"}}yes{{else}}no{{endif}}';
			const out2 = generateHTMLFromTemplate(template2, vars);
			assert.equal(out2, 'yes');

			const template3 = '{{ if twoWords == "two words" }}yes{{else}}no{{endif}}';
			const out3 = generateHTMLFromTemplate(template3, vars);
			assert.equal(out3, 'yes');

			const template4 = '{{ if onlyOne == \'actually == 1\' }}yes{{else}}no{{endif}}';
			const out4 = generateHTMLFromTemplate(template4, vars);
			assert.equal(out4, 'yes');

			const template5 = '{{ if "3" == {{ sum a="1" b="2" }} }}yes{{else}}no{{endif}}';
			const out5 = generateHTMLFromTemplate(template5, vars);
			assert.equal(out5, 'yes');

			const template6 = '{{ if {{ sum a="1" b="2" }} }}yes{{else}}no{{endif}}';
			const out6 = generateHTMLFromTemplate(template6, vars);
			assert.equal(out6, 'yes');

			const template7 = '{{ if {{ twoWords }} }}yes{{else}}no{{endif}}';
			const out7 = generateHTMLFromTemplate(template7, vars);
			assert.equal(out7, 'yes');

			const template8 = '{{ if twoWords }}yes{{else}}no{{endif}}';
			const out8 = generateHTMLFromTemplate(template8, vars);
			assert.equal(out8, 'yes');

			const template9 = '{{ if missing }}no{{else}}yes{{endif}}';
			const out9 = generateHTMLFromTemplate(template9, vars);
			assert.equal(out9, 'yes');

			const template10 = '{{ if {{ missing foo="bar" }} }}no{{else}}yes{{endif}}';
			const out10 = generateHTMLFromTemplate(template10, vars);
			assert.equal(out10, 'yes');

			const template11 = '{{ if {{ missing foo="bar" }} == "" }}yes{{else}}no{{endif}}';
			const out11 = generateHTMLFromTemplate(template11, vars);
			assert.equal(out11, 'yes');

			const template12 = '{{ if fooBar == "bar" }}yes{{else}}no{{endif}}';
			const out12 = generateHTMLFromTemplate(template12, vars);
			assert.equal(out12, 'yes');

			const template13 = '{{ if {{ fooBar }} == "bar" }}yes{{else}}no{{endif}}';
			const out13 = generateHTMLFromTemplate(template13, vars);
			assert.equal(out13, 'yes');

			const template14 = `{{if {{ sum a="1" b="2" }}=="3"}}1 + 2 = {{sum a="1" b="2"}}{{else}}no{{endif}}`;
			const out14 = generateHTMLFromTemplate(template14, vars);
			assert.equal(out14, '1 + 2 = 3');
			
			const template15 = `{{if "two words"==twoWords}}yes{{else}}no{{endif}}`;
			const out15 = generateHTMLFromTemplate(template15, vars);
			assert.equal(out15, 'yes');
		});

		it("should support relational operators", function () {
			const vars = {
				sum: ({ a, b }) => (parseInt(a) + parseInt(b)).toString(),
				v1: '1',
				v2: 'foo',
				v3: '100',
				v4: '99',
				π: '3.14',
			};

			const template1 = `{{if v1 > π}}more than π{{elseif v1 <= π}}less or equal to π{{endif}}`;
			const out1 = generateHTMLFromTemplate(template1, vars);
			assert.equal(out1, 'less or equal to π');

			const template2 = `{{if {{ sum a="2" b="3" }} > π}}more than π{{else}}less or equal to π{{endif}}`;
			const out2 = generateHTMLFromTemplate(template2, vars);
			assert.equal(out2, 'more than π');

			const template3 = `{{if 3.14 >= π}}more than or equal to π{{else}}less than π{{endif}}`;
			const out3 = generateHTMLFromTemplate(template3, vars);
			assert.equal(out3, 'more than or equal to π');

			const template4 = `{{if v3 > v4}}100 is more than 99{{else}}string "100" would be sorted before "99"{{endif}}`;
			const out4 = generateHTMLFromTemplate(template4, vars);
			assert.equal(out4, '100 is more than 99');

			// This is undocumented and unsupported behavior, but comparing strings should work
			const template5 = `{{if "test" > v2}}"test" > "foo"{{else}}no{{endif}}`;
			const out5 = generateHTMLFromTemplate(template5, vars);
			assert.equal(out5, '"test" > "foo"');

			const template6 = `{{if "bar" < v2 }}"bar" < "foo"{{else}}no{{endif}}`;
			const out6 = generateHTMLFromTemplate(template6, vars);
			assert.equal(out6, '"bar" < "foo"');
		});

		it("should compare as strings when a bare number is compared with a non-numeric value", function () {
			const vars = {
				edition: '2nd ed.',
				year: '2020',
			};

			const template1 = '{{if edition == 2}}second{{else}}other{{endif}}';
			const out1 = generateHTMLFromTemplate(template1, vars);
			assert.equal(out1, 'other');

			const template2 = '{{if edition != 2}}other{{else}}second{{endif}}';
			const out2 = generateHTMLFromTemplate(template2, vars);
			assert.equal(out2, 'other');

			const template3 = '{{if 2 == edition}}second{{else}}other{{endif}}';
			const out3 = generateHTMLFromTemplate(template3, vars);
			assert.equal(out3, 'other');

			const template4 = '{{if edition < 5}}less{{else}}more{{endif}}';
			const out4 = generateHTMLFromTemplate(template4, vars);
			assert.equal(out4, 'less');

			// The same comparison still evaluates numerically when the value is numeric
			const template5 = '{{if year == 2020}}yes{{else}}no{{endif}}';
			const out5 = generateHTMLFromTemplate(template5, vars);
			assert.equal(out5, 'yes');
		});

		it("should accept hyphen-case variables and attributes", function () {
			const vars = {
				fooBar: ({ isFoo }) => (isFoo === 'true' ? 'foo' : 'bar'),
			};
			const template = '{{ foo-bar is-foo="true" }}{{ if {{ foo-bar is-foo="false" }} == "bar" }}{{ foo-bar is-foo="false" }}{{ endif }}';
			const out = generateHTMLFromTemplate(template, vars);
			assert.equal(out, 'foobar');
		});

		it("should not throw on an unbalanced {{endif}}", function () {
			const vars = {
				v1: '1',
			};
			// An {{endif}} without a matching {{if}} shouldn't pop the base level and crash
			const template = 'foo{{endif}}bar{{if v1 == "1"}}baz{{endif}}';
			const out = generateHTMLFromTemplate(template, vars);
			assert.equal(out, 'foobarbaz');
		});

		it("should work with a condition in the middle", function () {
			const vars = {
				v1: '1',
			};
			const template = 'test {{ if v1 == "1" }}yes{{ else }}no{{ endif }} foobar';
			const out = generateHTMLFromTemplate(template, vars);
			assert.equal(out, 'test yes foobar');
		});

		it("missing identifiers are evaluted as empty string", function () {
			const vars = {
				foo: 'foo',
			};
			const template = '{{bar}}{{ if foo == "" }}no{{elseif foo}}{{foo}}{{else}}no{{endif}}';
			const out = generateHTMLFromTemplate(template, vars);
			assert.equal(out, 'foo');

			const template2 = 'test: {{ if bar == "" }}yes{{else}}no{{endif}}';
			const out2 = generateHTMLFromTemplate(template2, vars);
			assert.equal(out2, 'test: yes');
		});

		it("should preserve whitespace outside of brackets", function () {
			const template = ' starts }} with {{ whitespace  	{"test"}  ==  \'foobar\'   ';
			const out = generateHTMLFromTemplate(template, {});
			assert.equal(out, template);
			const vars = {
				space: ' ',
				spaceFn: () => ' ',
			};

			const whitespace = ' {{if spaceFn}}{{else}}  {{endif}}{{space}} {{space-fn}}';
			const out2 = generateHTMLFromTemplate(whitespace, vars);
			assert.equal(out2, '    ');
		});

		it("should accept array values in logic statements", function () {
			let someTags = ['foo', 'bar'];
			const vars = {
				tags: ({ join }) => (join ? someTags.join(join) : someTags),
			};
			const template = '{{ if tags }}#{{ tags join=" #" }}{{else}}no tags{{endif}}';
			const out = generateHTMLFromTemplate(template, vars);
			assert.equal(out, '#foo #bar');

			someTags = [];
			const out2 = generateHTMLFromTemplate(template, vars);
			assert.equal(out2, 'no tags');
		});


		it("should throw if function returns anything else than a string (or an array which is always joined into string)", function () {
			const vars = {
				number: () => 1,
				logic: () => true,
				array: () => [],
				fn: () => 1,
			};
			assert.throws(() => generateHTMLFromTemplate('{{ number }}', vars), /Identifier "number" does not evaluate to a string/);
			assert.throws(() => generateHTMLFromTemplate('{{ logic }}', vars), /Identifier "logic" does not evaluate to a string/);
			assert.throws(() => generateHTMLFromTemplate('{{ if fn }}no{{endif}}', vars), /Identifier "fn" does not evaluate to a string/);
			assert.throws(() => generateHTMLFromTemplate('{{ if {{ fn foo="bar" }} }}no{{endif}}', vars), /Identifier "fn" does not evaluate to a string/);
		});

		it("should support nested 'if' statements", function () {
			var vars = {
				v1: '1',
				v2: 'H',
			};
			var template = `{{if v1 == '1'}}yes1{{if x}}no{{elseif v2  == "h" }}yes2{{endif}}{{elseif v2 == "2"}}no{{else}}no{{endif}} {{if v2 == "1"}}not{{elseif x}}not{{else}}yes3{{ endif}}`;
			var html = generateHTMLFromTemplate(template, vars);
			assert.equal(html, 'yes1yes2 yes3');
		});

		it("should render a string literal", function () {
			assert.equal(generateHTMLFromTemplate('{{ "literal" }}', {}), 'literal');
			assert.equal(generateHTMLFromTemplate("{{ 'literal' }}", {}), 'literal');
		});

		it("should render brace characters via string literals", function () {
			assert.equal(generateHTMLFromTemplate('{{ "{" }}', {}), '{');
			assert.equal(generateHTMLFromTemplate('{{ "{{" }}', {}), '{{');
			assert.equal(generateHTMLFromTemplate('{{ "}}" }}', {}), '}}');
			assert.equal(generateHTMLFromTemplate('{{ "}" }}', {}), '}');
		});

		it("should render string literals alongside text and variables", function () {
			const vars = { v1: 'X' };
			assert.equal(generateHTMLFromTemplate('a{{ "{{" }}{{v1}}{{ "}}" }}c', vars), 'a{{X}}c');
		});

		it("should render a string literal that spans multiple lines", function () {
			assert.equal(generateHTMLFromTemplate('{{ "a\nb" }}', {}), 'a\nb');
			assert.equal(generateHTMLFromTemplate("{{ 'a\nb' }}", {}), 'a\nb');
		});

		it("should not treat a quoted keyword as a control statement", function () {
			assert.equal(generateHTMLFromTemplate('{{ "if" }}', {}), 'if');
			assert.equal(generateHTMLFromTemplate('{{ "endif" }}', {}), 'endif');
		});

		it("should not treat a malformed quoted statement as a string literal", function () {
			assert.equal(generateHTMLFromTemplate('{{ "x" y="z" }}', {}), '');
			assert.equal(generateHTMLFromTemplate('{{ "a" "b" }}', {}), '');
			// A `"` inside a value closes the string, so an embedded quote makes the statement malformed
			assert.equal(generateHTMLFromTemplate('{{ "a\\"b" }}', {}), '');
		});

		it("should treat an empty or bare string-literal condition as false, forcing {{else}}", function () {
			assert.equal(generateHTMLFromTemplate('{{if}}Y{{else}}N{{endif}}', {}), 'N');
			assert.equal(generateHTMLFromTemplate('{{if "foo"}}Y{{else}}N{{endif}}', {}), 'N');
		});

		it("should treat any whitespace after a control keyword as a separator", function () {
			// split(' ') only splits on an ASCII space; a tab/NBSP/newline after `if` must still
			// parse as the `if` keyword rather than a mangled `if\ttitle` identifier
			for (let ws of ['\t', ' ', '\n']) {
				let tmpl = `{{if${ws}v}}KEEP{{endif}}`;
				assert.equal(generateHTMLFromTemplate(tmpl, { v: '1' }), 'KEEP', JSON.stringify(ws));
				assert.equal(generateHTMLFromTemplate(tmpl, {}), '', JSON.stringify(ws));
			}
		});

		it("should treat an empty {{}} comparison operand as an empty value instead of throwing", function () {
			const vars = { color: 'red', empty: '' };
			// Empty operand on either side of any comparator must not crash the engine
			assert.equal(generateHTMLFromTemplate('{{if {{}} == color}}Y{{else}}N{{endif}}', vars), 'N');
			assert.equal(generateHTMLFromTemplate('{{if color == {{}}}}Y{{else}}N{{endif}}', vars), 'N');
			assert.equal(generateHTMLFromTemplate('{{if {{}} != color}}Y{{else}}N{{endif}}', vars), 'Y');
			// An empty operand compares equal to an empty variable
			assert.equal(generateHTMLFromTemplate('{{if {{}} == empty}}Y{{else}}N{{endif}}', vars), 'Y');
		});

		it("should not treat a }} or comparator inside a nested operand's quoted argument as structure", function () {
			const vars = { echo: attrs => attrs.x ?? '' };
			// The `}}` and `==` inside x="…" must not be read as the operand end or the comparator
			assert.equal(
				generateHTMLFromTemplate('{{if {{ echo x="}} ==" }} == "}} =="}}Y{{else}}N{{endif}}', vars),
				'Y'
			);
			// The same nested call compared with a non-matching literal takes the else branch
			assert.equal(
				generateHTMLFromTemplate('{{if {{ echo x="}} ==" }} == "other"}}Y{{else}}N{{endif}}', vars),
				'N'
			);
		});

		it("should evaluate a nested {{ }} string literal to its contents, like at the top level", function () {
			// `{{ "x" }}` renders `x` at the top level, so as a nested operand it must evaluate to `x`
			// (not be treated as a missing identifier), so the comparison behaves consistently
			assert.equal(generateHTMLFromTemplate('{{if {{ "x" }} == "x"}}Y{{else}}N{{endif}}', {}), 'Y');
			assert.equal(generateHTMLFromTemplate("{{if {{ 'x' }} == 'x'}}Y{{else}}N{{endif}}", {}), 'Y');
			// ...on either side of the comparator
			assert.equal(generateHTMLFromTemplate('{{if "x" == {{ "x" }}}}Y{{else}}N{{endif}}', {}), 'Y');
			// A nested literal used directly as a condition is evaluated too: non-empty is truthy,
			// empty is falsy (a bare, unbracketed literal remains an identifier ref -- see the
			// "bare string-literal condition as false" test above)
			assert.equal(generateHTMLFromTemplate('{{if {{ "foo" }}}}Y{{else}}N{{endif}}', {}), 'Y');
			assert.equal(generateHTMLFromTemplate('{{if {{ "" }}}}Y{{else}}N{{endif}}', {}), 'N');
		});
	});

	describe("#parseTemplateBrackets()", function () {
		it("should split text and bracketed statements", function () {
			assert.deepEqual(parseTemplateBrackets('a{{b}}c'), ['a', '{{b}}', 'c']);
		});

		it("should return a single part for text without brackets", function () {
			assert.deepEqual(parseTemplateBrackets('abc'), ['abc']);
		});

		it("should keep nested brackets within a single outer part", function () {
			assert.deepEqual(
				parseTemplateBrackets('{{ if {{ x }} }}'),
				['', '{{ if {{ x }} }}']
			);
		});

		it("should treat braces inside string literals as literal characters", function () {
			assert.deepEqual(parseTemplateBrackets('{{ "{{" }}'), ['', '{{ "{{" }}']);
			assert.deepEqual(parseTemplateBrackets('{{ "}}" }}'), ['', '{{ "}}" }}']);
		});

		it("should not close a statement early when a nested {{}} is adjacent to the outer }}", function () {
			// The trailing `}}}}` must be read as the inner `}}` then the outer `}}`, not overlapping
			assert.deepEqual(
				parseTemplateBrackets('{{if color == {{}}}}'),
				['', '{{if color == {{}}}}']
			);
			assert.deepEqual(
				parseTemplateBrackets('{{if {{}}}}X{{endif}}'),
				['', '{{if {{}}}}', 'X', '{{endif}}']
			);
		});

		it("should treat `}}` inside a string literal as an ordinary character, not a delimiter", function () {
			assert.deepEqual(
				parseTemplateBrackets('{{ "a}}b" }}X'),
				['', '{{ "a}}b" }}', 'X']
			);
			assert.deepEqual(
				parseTemplateBrackets('{{ title x="}}" }}TAIL'),
				['', '{{ title x="}}" }}', 'TAIL']
			);
		});

		it("should not let a trailing backslash before a closing quote swallow a later statement", function () {
			// A literal-backslash suffix followed by another quoted statement must stay two
			// statements; the `\` before the closing quote must not pair with the later quote
			assert.deepEqual(
				parseTemplateBrackets('{{ title suffix="\\" }}{{ title prefix="x" }}'),
				['', '{{ title suffix="\\" }}', '', '{{ title prefix="x" }}']
			);
			assert.isTrue(isTemplateValid('{{ title suffix="\\" }}{{ title prefix="x" }}'));
		});
	});

	describe("#isTemplateValid()", function () {
		it("should return false for a template with mismatched if/endif", function () {
			// The stray {{endif}} that used to crash the engine (see #generateHTMLFromTemplate() tests)
			const template = 'foo{{endif}}bar{{if v1 == "1"}}baz{{endif}}';
			assert.isFalse(isTemplateValid(template));
		});

		it("should return false for an {{if}} without a matching {{endif}}", function () {
			assert.isFalse(isTemplateValid('{{if v1 == "1"}}baz'));
		});

		it("should return true for balanced if/endif", function () {
			assert.isTrue(isTemplateValid('foo{{if v1 == "1"}}baz{{endif}}'));
		});

		it("should treat any whitespace after a control keyword as a separator", function () {
			// Must agree with the engine: a tab/newline after `if` still parses as the `if` keyword,
			// so the block is balanced rather than being read as a mangled `if\ttitle` identifier
			for (let ws of ['\t', ' ', '\n']) {
				assert.isTrue(isTemplateValid(`{{if${ws}v}}KEEP{{endif}}`), JSON.stringify(ws));
			}
		});

		it("should return false for a non-string template", function () {
			assert.isFalse(isTemplateValid(null));
			assert.isFalse(isTemplateValid(undefined));
			assert.isFalse(isTemplateValid(42));
		});

		it("should return false for an unmatched opening {{", function () {
			assert.isFalse(isTemplateValid('{{ title'));
			assert.isFalse(isTemplateValid('foo {{ title }} bar {{ baz'));
		});

		it("should return false for a stray, non-literal }}", function () {
			assert.isFalse(isTemplateValid('title }}'));
			assert.isFalse(isTemplateValid('foo }} bar'));
		});

		it("should treat braces inside string literals as valid", function () {
			assert.isTrue(isTemplateValid('{{ "{{" }}'));
			assert.isTrue(isTemplateValid('{{ "}}" }}'));
			assert.isTrue(isTemplateValid('a{{ "{{" }}b{{ "}}" }}c'));
		});

		it("should return false for a malformed quoted statement", function () {
			assert.isFalse(isTemplateValid('{{ "x" y="z" }}'));
			assert.isFalse(isTemplateValid('{{ "a" "b" }}'));
		});

		it("should return false for a statement with an unterminated quote", function () {
			assert.isFalse(isTemplateValid('{{ title truncate="50 }}'));
			assert.isFalse(isTemplateValid("{{ title truncate='50 }}"));
			assert.isFalse(isTemplateValid('{{if title == "x }}a{{endif}}'));
		});

		it("should reject an unclosed {{ that a nested }} makes look closed", function () {
			// parseTemplateBrackets folds an unclosed outer `{{` and its nested `}}` into one part
			// that ends in `}}`; without a balance check the engine would keep it and silently
			// drop `year` at render time
			assert.isFalse(isTemplateValid('{{ firstCreator {{ year }}'));
			assert.isFalse(isTemplateValid('foo {{ bar {{ baz }}'));
		});

		it("should accept a balanced nested {{ }} operand", function () {
			assert.isTrue(isTemplateValid('{{if {{ authorsCount }} == "2"}}a{{endif}}'));
		});

		it("should return false when an unterminated quote swallows a following statement", function () {
			// The unterminated quote makes the tokenizer fold `{{ year }}` into one part, which
			// would otherwise validate as a lone statement and silently drop `year` at render time
			assert.isFalse(isTemplateValid('{{ title x="a }}{{ year }}'));
		});

		it("should return true for a well-formed string literal statement", function () {
			assert.isTrue(isTemplateValid('{{ "literal" }}'));
			assert.isTrue(isTemplateValid('{{ "a}}b" }}'));
		});

		it("should accept a string literal that spans multiple lines", function () {
			assert.isTrue(isTemplateValid('{{ "a\nb" }}'));
			assert.isTrue(isTemplateValid("{{ 'a\nb' }}"));
		});

		it("should reject an attribute value with an unescaped closing quote", function () {
			// Backslashes are literal, so a `"` always closes the value; `x="a\""` leaves a stray
			// quote that never closes the statement
			assert.isFalse(isTemplateValid('{{ title x="a\\"" }}TAIL'));
		});

		it("should allow single brace characters in text", function () {
			assert.isTrue(isTemplateValid('a { b } c'));
		});

		it("should return false for an {{elseif}} after an {{else}}", function () {
			// Renders two branches in the engine (e.g. "ac"), so reject it
			assert.isFalse(isTemplateValid('{{if title}}a{{else}}b{{elseif year}}c{{endif}}'));
		});

		it("should return false for a second {{else}} in the same block", function () {
			assert.isFalse(isTemplateValid('{{if title}}a{{else}}b{{else}}c{{endif}}'));
		});

		it("should accept an {{if}} with an empty condition", function () {
			// An empty condition renders as false (forcing the {{else}} branch), which the engine
			// has always handled; keep it valid so existing templates don't fall back to the default
			assert.isTrue(isTemplateValid('{{if}}a{{endif}}'));
			assert.isTrue(isTemplateValid('{{if }}a{{endif}}'));
			assert.isTrue(isTemplateValid('{{if}}a{{else}}b{{endif}}'));
		});

		it("should accept an {{elseif}} with an empty condition", function () {
			assert.isTrue(isTemplateValid('{{if title}}a{{elseif}}b{{endif}}'));
		});

		it("should return true for a valid if/elseif/else chain", function () {
			assert.isTrue(isTemplateValid('{{if a}}1{{elseif b}}2{{else}}3{{endif}}'));
			assert.isTrue(isTemplateValid('{{if a}}1{{if b}}2{{else}}3{{endif}}{{else}}4{{endif}}'));
		});
	});
});
