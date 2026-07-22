var {
	generateHTMLFromTemplate,
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
	});
});
