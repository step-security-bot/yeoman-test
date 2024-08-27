import assert from 'node:assert';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mock } from 'node:test';
import Generator from 'yeoman-generator';
import { afterEach, beforeEach, describe, expect, it } from 'esmocha';
import type Environment from 'yeoman-environment';
import { createEnv as createEnvironment } from '../src/default-environment.js';
import helpers from '../src/helpers.js';
import { TestAdapter } from '../src/adapter.js';
import RunContext from '../src/run-context.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const { resolve, join } = path;
const environment = await createEnvironment({ adapter: new TestAdapter() });

describe('yeoman-test', () => {
  beforeEach(function () {
    process.chdir(join(__dirname, './fixtures'));

    this.StubGenerator = class extends Generator {};
  });

  describe('.createGenerator()', () => {
    it('create a new generator', async function () {
      const generator = await helpers.createGenerator('unicorn:app', {
        dependencies: [[this.StubGenerator, { namespace: 'unicorn:app' }]],
      });

      assert.ok(generator instanceof this.StubGenerator);
    });

    it('pass args params to the generator', async function () {
      const generator = await helpers.createGenerator('unicorn:app', {
        dependencies: [[this.StubGenerator, { namespace: 'unicorn:app' }]],
        generatorArgs: ['temp'],
      });

      assert.deepEqual(generator.args, ['temp']);
    });

    it('pass options param to the generator', async function () {
      const generator = await helpers.createGenerator('unicorn:app', {
        dependencies: [[this.StubGenerator, { namespace: 'unicorn:app' }]],
        generatorArgs: ['temp'],
        generatorOptions: {
          ui: 'tdd',
        },
      });

      assert.equal(generator.options.ui, 'tdd');
    });
  });

  describe('.mockPrompt()', () => {
    beforeEach(async function () {
      this.generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });
      helpers.mockPrompt(this.generator, { answer: 'foo' });
    });

    it('uses default values', function () {
      return this.generator.prompt([{ name: 'respuesta', type: 'input', default: 'bar' }]).then(answers => {
        assert.equal(answers.respuesta, 'bar');
      });
    });

    it('uses default values when no answer is passed', async () => {
      const generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });
      helpers.mockPrompt(generator);
      return generator.prompt([{ name: 'respuesta', message: 'foo', type: 'input', default: 'bar' }]).then(answers => {
        assert.equal(answers.respuesta, 'bar');
      });
    });

    it('supports `null` answer for `list` type', async () => {
      const generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });

      helpers.mockPrompt(generator, {
        respuesta: null,
      });

      return generator.prompt([{ name: 'respuesta', message: 'foo', type: 'list', default: 'bar' }]).then(answers => {
        assert.equal(answers.respuesta, null);
      });
    });

    it('treats `null` as no answer for `input` type', async () => {
      const generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });

      helpers.mockPrompt(generator, {
        respuesta: null,
      });

      return generator.prompt([{ name: 'respuesta', message: 'foo', type: 'input', default: 'bar' }]).then(answers => {
        assert.equal(answers.respuesta, 'bar');
      });
    });

    it('uses `true` as the default value for `confirm` type', async () => {
      const generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });
      helpers.mockPrompt(generator, {});

      return generator.prompt([{ name: 'respuesta', message: 'foo', type: 'confirm' }]).then(answers => {
        assert.equal(answers.respuesta, true);
      });
    });

    it('supports `false` answer for `confirm` type', async () => {
      const generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });
      helpers.mockPrompt(generator, { respuesta: false });

      return generator.prompt([{ name: 'respuesta', message: 'foo', type: 'confirm' }]).then(answers => {
        assert.equal(answers.respuesta, false);
      });
    });

    it('prefers mocked values over defaults', function () {
      return this.generator.prompt([{ name: 'answer', type: 'input', default: 'bar' }]).then(answers => {
        assert.equal(answers.answer, 'foo');
      });
    });

    it('can be call multiple time on the same generator', async () => {
      const generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });
      helpers.mockPrompt(generator, { foo: 1 });
      helpers.mockPrompt(generator, { foo: 2 });
      return generator.prompt({ message: 'bar', name: 'foo' }).then(answers => {
        assert.equal(answers.foo, 2);
      });
    });

    it('throws if answer is not provided', async function () {
      const generator = await environment.instantiate(helpers.createDummyGenerator(), { generatorArgs: [], generatorOptions: {} });
      helpers.mockPrompt(generator, { foo: 1 }, { throwOnMissingAnswer: true });
      return this.generator.prompt([{ message: 'bar', name: 'notFound' }]).then(
        () => assert.fail(),
        error => {
          assert.equal(error.message, 'yeoman-test: question notFound was asked but answer was not provided');
        },
      );
    });

    it('keep prompt method asynchronous', function () {
      const spy = mock.fn();

      const promise = this.generator.prompt({ name: 'answer', type: 'input' }).then(() => {
        assert.strictEqual(spy.mock.callCount(), 1);
      });

      spy();
      return promise;
    });
  });

  describe('.run()', () => {
    describe('with a generator', () => {
      it('return a RunContext object', done => {
        const context = helpers.run(helpers.createDummyGenerator());
        assert(context instanceof RunContext);
        context.on('end', done);
      });
    });

    describe('with a namespace', () => {
      it('return a RunContext object', done => {
        const context = helpers.run('simple:app').withEnvironment(environment => {
          environment.register(require.resolve('./fixtures/generator-simple/app'));
        });
        assert(context instanceof RunContext);
        context.on('end', done);
      });
    });

    it('pass settings to RunContext', () => {
      const runContext = helpers.run(helpers.createDummyGenerator(), {
        namespace: 'foo',
      });
      assert.equal(runContext.settings.namespace, 'foo');
    });

    it('pass envOptions to RunContext', () => {
      const environmentOptions = { foo: 2 };
      const runContext = helpers.run(helpers.createDummyGenerator(), undefined, environmentOptions);
      assert.equal(runContext.envOptions, environmentOptions);
    });

    it('catch env errors', done => {
      helpers
        .run(
          class extends helpers.createDummyGenerator() {
            throws() {
              this.env.emit('error', new Error('an error'));
            }
          },
        )
        .on('error', _ => {
          done();
        });
    });

    it('catch generator emitted errors', done => {
      helpers
        .run(
          class extends helpers.createDummyGenerator() {
            throws() {
              this.emit('error', new Error('an error'));
            }
          },
        )
        .on('error', _ => {
          done();
        });
    });

    it('catch generator thrown errors', done => {
      helpers
        .run(
          class extends helpers.createDummyGenerator() {
            throws() {
              throw new Error('Some error.');
            }
          },
        )
        .on('error', _ => {
          done();
        });
    });

    // This is a workaround for corner case were an error is not correctly emitted
    // See https://github.com/yeoman/generator/pull/1155
    it('catch run errors', done => {
      helpers.run(class extends Generator {}, {}, { catchGeneratorError: true }).on('error', _ => {
        done();
      });
    });

    describe('with files', () => {
      it('write files to mem-fs', async () => {
        const runResult = await helpers.run(helpers.createDummyGenerator()).withFiles({ 'foo.txt': 'foo', 'foo.json': { foo: 'bar' } });
        expect(runResult.getSnapshot()).toMatchInlineSnapshot(`
          {
            "foo.json": {
              "contents": "{
            "foo": "bar"
          }
          ",
              "stateCleared": "modified",
            },
            "foo.txt": {
              "contents": "foo",
              "stateCleared": "modified",
            },
          }
        `);
      });

      it('write files with relative path to mem-fs', async () => {
        const runResult = await helpers
          .run(helpers.createDummyGenerator())
          .withFiles('sub', { 'foo.txt': 'foo', 'foo.json': { foo: 'bar' } });
        expect(runResult.getSnapshot()).toMatchInlineSnapshot(`
          {
            "sub/foo.json": {
              "contents": "{
            "foo": "bar"
          }
          ",
              "stateCleared": "modified",
            },
            "sub/foo.txt": {
              "contents": "foo",
              "stateCleared": "modified",
            },
          }
        `);
      });

      it('write string .yo-rc.json to mem-fs', async () => {
        const runResult = await helpers.run(helpers.createDummyGenerator()).withYoRc('{"foo": "bar"}');
        expect(runResult.getSnapshot()).toMatchInlineSnapshot(`
          {
            ".yo-rc.json": {
              "contents": "{"foo": "bar"}",
              "stateCleared": "modified",
            },
          }
        `);
      });

      it('write object .yo-rc.json to mem-fs', async () => {
        const runResult = await helpers.run(helpers.createDummyGenerator()).withYoRc({ foo: 'bar' });
        expect(runResult.getSnapshot()).toMatchInlineSnapshot(`
          {
            ".yo-rc.json": {
              "contents": "{
            "foo": "bar"
          }
          ",
              "stateCleared": "modified",
            },
          }
        `);
      });

      it('merges object .yo-rc.json to mem-fs', async () => {
        const runResult = await helpers.run(helpers.createDummyGenerator()).withYoRc({ foo: 'bar' }).withYoRc({ bar: 'foo' });
        expect(runResult.getSnapshot()).toMatchInlineSnapshot(`
          {
            ".yo-rc.json": {
              "contents": "{
            "foo": "bar",
            "bar": "foo"
          }
          ",
              "stateCleared": "modified",
            },
          }
        `);
      });

      it('writes object GeneratorConfig to mem-fs', async () => {
        const runResult = await helpers
          .run(helpers.createDummyGenerator())
          .withYoRcConfig('ns', { foo: 'bar' })
          .withYoRcConfig('ns.child', { bar: 'foo' });
        expect(runResult.getSnapshot()).toMatchInlineSnapshot(`
          {
            ".yo-rc.json": {
              "contents": "{
            "ns": {
              "foo": "bar",
              "child": {
                "bar": "foo"
              }
            }
          }
          ",
              "stateCleared": "modified",
            },
          }
        `);
      });

      it('write files to mem-fs', async () => {
        const runResult = await helpers
          .run(helpers.createDummyGenerator())
          .withFiles({ 'foo.txt': 'foo', 'foo.json': { foo: 'bar' } })
          .commitFiles();
        assert(existsSync(resolve(runResult.cwd, 'foo.txt')));
        assert(existsSync(resolve(runResult.cwd, 'foo.json')));
      });
    });

    describe('callbacks', () => {
      it('calls in order', async () => {
        const order: string[] = [];

        const runContext = helpers.run(helpers.createDummyGenerator());
        await runContext
          .onGenerator(function (generator) {
            assert.strictEqual(this, runContext);
            assert.strictEqual(this.generator, generator);
            order.push('onGenerator 0');
          })
          .onGenerator(function (generator) {
            assert.strictEqual(this, runContext);
            assert.strictEqual(this.generator, generator);
            order.push('onGenerator 1');
          })
          .onEnvironment(function (environment) {
            assert.strictEqual(this, runContext);
            assert.strictEqual(this.env, environment);
            order.push('onEnvironment 0');
          })
          .onEnvironment(function (environment) {
            assert.strictEqual(this, runContext);
            assert.strictEqual(this.env, environment);
            order.push('onEnvironment 1');
          })
          .onTargetDirectory(function (targetDirectory) {
            assert.strictEqual(this, runContext);
            assert.strictEqual(this.targetDirectory!, targetDirectory);
            order.push('onTargetDir 0');
          })
          .onTargetDirectory(function (targetDirectory) {
            assert.strictEqual(this, runContext);
            assert.strictEqual(this.targetDirectory!, targetDirectory);
            order.push('onTargetDir 1');
          });

        assert.deepStrictEqual(order, [
          'onTargetDir 0',
          'onTargetDir 1',
          'onEnvironment 0',
          'onEnvironment 1',
          'onGenerator 0',
          'onGenerator 1',
        ]);
      });
    });
  });

  describe('.createTestEnv', () => {
    let mockedCreateEnvironment: ReturnType<typeof mock.method>;
    const createEnvironmentReturn = {};
    beforeEach(() => {
      mockedCreateEnvironment = mock.method(helpers, 'createEnv', () => Promise.resolve(createEnvironmentReturn) as Promise<Environment>);
    });
    afterEach(() => {
      mockedCreateEnvironment.mock.restore();
    });
    it('calls mocked createEnv', async () => {
      assert.equal(await helpers.createTestEnv(), createEnvironmentReturn);
      assert.strictEqual(mockedCreateEnvironment.mock.callCount(), 1);
    });
    it('calls mocked createEnv with newErrorHandler option', async () => {
      assert.equal(await helpers.createTestEnv(), createEnvironmentReturn);
      assert.equal((mockedCreateEnvironment.mock.calls[0].arguments[0] as any).newErrorHandler, true);
    });
    it('calls mocked createEnv with sharedOptions.localConfigOnly option', async () => {
      assert.equal(await helpers.createTestEnv(), createEnvironmentReturn);
      assert.equal((mockedCreateEnvironment.mock.calls[0].arguments[0] as any).sharedOptions.localConfigOnly, true);
    });
  });
  describe('.prepareTemporaryFolder', () => {
    it('should create a temporaryFolder', async () => {
      const oldCwd = process.cwd();
      const context = await helpers.prepareTemporaryDir();
      assert.notEqual(process.cwd(), oldCwd);
      assert.equal(context.oldCwd, oldCwd);
      context.cleanup();
      assert.equal(process.cwd(), oldCwd);
    });
  });
});
