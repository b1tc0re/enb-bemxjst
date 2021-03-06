var fs = require('fs'),
    path = require('path'),
    mock = require('mock-fs'),
    assert = require('assert'),
    MockNode = require('mock-enb/lib/mock-node'),
    Tech = require('../../techs/bemhtml'),
    loadDirSync = require('mock-enb/utils/dir-utils').loadDirSync,
    FileList = require('enb/lib/file-list'),
    bundlePath = path.resolve('lib/bundle.js'),
    sinon = require('sinon'),
    utils = require('../utils'),
    run = function (code) {
        return utils.run(code, { runtime: 'node' });
    };

describe('bemhtml', function () {
    before(function () {
        var JobQueueStub = require('mock-enb/lib/job-queue-stub');

        // Использование mock-fs не позволяет подключить bemxjst-processor в рантайме
        // https://github.com/tschaub/mock-fs/issues/12
        // поэтому подключаем его перед инициализацией mock-fs
        JobQueueStub.prototype.processor = require('../../lib/bemhtml-processor');
    });

    afterEach(function () {
        mock.restore();
    });

    describe('option: forceBaseTemplates', function () {
        it('must generate mock if there is no templates', function () {
            var templates = [];

            return build(templates)
                .spread(function (res) {
                    var bemjson = { block: 'block' };

                    res.BEMHTML.apply(bemjson).must.be('');
                });
        });

        it('must keep base templates if there is no templates and forceBaseTemplates option is true', function () {
            var templates = [];

            return build(templates, { forceBaseTemplates: true })
                .spread(function (res) {
                    var bemjson = { block: 'block' },
                        html = '<div class="block"></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });
    });

    it('must use `bemhtml.js` suffix', function () {
        var blocks = {
            'block.bemhtml.js': 'block("block").tag()("a")',
            'block.bemhtml': 'block("block").tag()("span")'
        };

        return build(blocks)
            .spread(function (res) {
                var bemjson = { block: 'block' },
                    html = '<a class="block"></a>';

                res.BEMHTML.apply(bemjson).must.be(html);
            });
    });

    describe('option: sourceSuffixes and base templates', function () {
        it('must ignore templates in `i-bem`', function () {
            var blocks = {
                'i-bem.bemhtml.js': 'block("block").tag()("a")'
            };

            return build(blocks)
                .spread(function (res) {
                    var bemjson = { block: 'block' },
                        html = '<div class="block"></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('must ignore templates in `i-bem__html`', function () {
            var blocks = {
                'i-bem__html.bemhtml': 'block("block").tag()("a")'
            };

            return build(blocks, { sourceSuffixes: ['bemhtml.js', 'bemhtml'] })
                .spread(function (res) {
                    var bemjson = { block: 'block' },
                        html = '<div class="block"></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });
    });

    describe('option: naming', function () {
        it('must use origin naming', function () {
            var blocks = {
                'block.bemhtml.js': 'block("block").tag()("div")'
            };

            return build(blocks)
                .spread(function (res) {
                    var bemjson = { block: 'block', elem: 'elem', elemMods: { mod: true } },
                        html = '<div class="block__elem block__elem_mod"></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('must support custom naming', function () {
            var blocks = {
                'block.bemhtml.js': 'block("block").tag()("div")'
            };

            return build(blocks, { naming: { elem: '__', mod: '--' } })
                .spread(function (res) {
                    var bemjson = { block: 'block', elem: 'elem', elemMods: { mod: true } },
                        html = '<div class="block__elem block__elem--mod"></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });
    });

    describe('option: engineOptions', function () {
        beforeEach(function () {
            sinon.stub(console, 'error');
        });

        afterEach(function () {
            console.error.restore();
        });

        it('must not add i-bem class by default', function () {
            var blocks = {
                'block.bemhtml.js': 'block("block").tag()("div")'
            };

            return build(blocks)
                .spread(function (res) {
                    var bemjson = { block: 'block', elem: 'elem', js: true },
                        html = '<div class="block__elem" data-bem=\'{"block__elem":{}}\'></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('should support engineOptions.elemJsInstances', function () {
            var blocks = {
                'block.bemhtml.js': 'block("block").tag()("div")'
            };

            return build(blocks, { engineOptions: { elemJsInstances: true } })
                .spread(function (res) {
                    var bemjson = { block: 'block', elem: 'elem', js: true },
                        html = '<div class="block__elem i-bem" data-bem=\'{"block__elem":{}}\'></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('should support engineOptions.naming', function () {
            var blocks = {
                'block.bemhtml.js': 'block("block").tag()("div")'
            };

            return build(blocks, { engineOptions: { naming: { elem: '__', mod: '--' } } })
                .spread(function (res) {
                    var bemjson = { block: 'block', elem: 'elem', elemMods: { mod: true } },
                        html = '<div class="block__elem block__elem--mod"></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('should support engineOptions.production', function () {
            var blocks = {
                'block.bemhtml.js': [
                    'block("block").attrs()(function() {',
                    '    var attrs = applyNext();',
                    '    attrs.undef.foo = "bar";',
                    '    return attrs;',
                    '});'
                ].join('\n')
            };

            return build(blocks, { engineOptions: { production: true } })
                .spread(function (res) {
                    var bemjson = { block: 'page', content: { block: 'block' } },
                        html = '<div class="page"></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('must escape html tags by default', function () {
            var blocks = {
                'block.bemhtml.js': 'block("block").tag()("div")'
            };

            return build(blocks)
                .spread(function (res) {
                    var bemjson = { block: 'block', content: '<script>alert(1)</scritpt>' },
                        html = '<div class="block">&lt;script&gt;alert(1)&lt;/scritpt&gt;</div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('should support engineOptions.escapeContent', function () {
            var blocks = {
                'block.bemhtml.js': 'block("block").tag()("div")'
            };

            return build(blocks, { engineOptions: { escapeContent: false } })
                .spread(function (res) {
                    var bemjson = { block: 'block', content: '<script>alert(1)</scritpt>' },
                        html = '<div class="block"><script>alert(1)</scritpt></div>';

                    res.BEMHTML.apply(bemjson).must.be(html);
                });
        });

        it('should support engineOptions.exportName fallback for backward compatibility', function () {
            var blocks = { 'b.bemhtml.js': 'block("b").tag()("span")' };

            return build(blocks, { engineOptions: { exportName: 'htmlMaker' } })
                .spread(function (res) {
                    assert(res.htmlMaker, 'No BEMHTML exported as htmlMaker');

                    res
                        .htmlMaker
                        .apply({ block: 'b' })
                        .must.be('<span class="b"></span>');
                });
        });

        it('should support engineOptions.requires', function () {
            var code = 'global.text = "Hello world!"',
                options = {
                    engineOptions: { requires: { text: { globals: 'text' } } }
                };

            return utils.compileBundle(code, options)
                .then(run)
                .then(utils.getLibs)
                .should.become({ text: 'Hello world!' });
        });
    });

    describe('option: compat', function () {
        it('must throw error if old syntax', function () {
            var templates = ['block bla, tag: "a"'];

            return build(templates)
                .fail(function (err) {
                    err.must.a(Error);
                });
        });

        it('must not support old syntax for files with `.js` extension', function () {
            var blocks = {
                    'block.bemhtml.js': 'block bla, tag: "a"'
                },
                options = { compat: true };

            return build(blocks, options)
                .fail(function (err) {
                    err.must.a(Error);
                });
        });
    });

    describe('option: iife', function () {
        it('should wrap templates into Immediately-Invoked Function Expression', function () {
            var blocks = {
                'one.bemhtml.js': 'var private = 42;',
                'two.bemhtml.js': 'block("b").content()(function() { return private; });'
            };

            return build(blocks, { iife: true })
                .spread(function (res) { res.BEMHTML.apply({ block: 'b' }); })
                .fail(function (error) {
                    error.message.must.be.include('Template error in mode content in block b\n' +
                        '    private is not defined\n');
                });
        });
    });

    describe('option: sourcemap', function () {
        // TODO
    });

    describe('handle template errors', function () {
        it('must throw syntax error', function () {
            var templates = ['block("bla")tag()("a")'];

            return build(templates)
                .fail(function (error) {
                    error.message.must.be.include('Unexpected identifier');
                });
        });

        it('must throw predicate error', function () {
            var templates = ['block("bla").tag("a")'];

            return build(templates)
                .fail(function (error) {
                    error.message.must.be.include('Predicate should not have arguments');
                });
        });

        it('must throw if template error in dev mode', function () {
            var blocks = {
                'block.bemhtml.js': [
                    'block("block").attrs()(function() {',
                    '    var attrs = applyNext();',
                    '    attrs.undef.foo = "bar";',
                    '    return attrs;',
                    '});'
                ].join('\n')
            };

            return build(blocks)
                .fail(function (error) {
                    error.message.must.be.include('Cannot read property');
                });
        });
    });
});

function build(templates, options) {
    templates || (templates = []);
    options || (options = {});

    var scheme = {
            blocks: {},
            bundle: {}
        },
        bundle, fileList;

    // hack for mock-fs
    scheme[bundlePath] = '';

    if (Array.isArray(templates)) {
        if (templates.length) {
            templates.forEach(function (item, i) {
                scheme.blocks['block-' + i + '.bemhtml.js'] = item;
            });
        }
    } else {
        scheme.blocks = templates;
    }

    if (templates.length) {
        templates.forEach(function (item, i) {
            scheme.blocks['block-' + i + '.bemhtml.js'] = item;
        });
    }

    mock(scheme);

    bundle = new MockNode('bundle');
    fileList = new FileList();
    fileList.addFiles(loadDirSync('blocks'));
    bundle.provideTechData('?.files', fileList);

    return bundle.runTechAndRequire(Tech, options)
        .spread(function (res) {
            var filename = bundle.resolvePath(bundle.unmaskTargetName(options.target || '?.bemhtml.js')),
                str = fs.readFileSync(filename, 'utf-8');

            return [res, str];
        });
}
