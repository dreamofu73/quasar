import { readAstJson, getImportStatement } from '../astParser.js'

const identifiers = {
  variables: {
    categoryId: '[Variables]',
    getTestId: name => `[(variable)${ name }]`,
    createTestFn: createVariableTest
  },

  classes: {
    categoryId: '[Classes]',
    getTestId: name => `[(class)${ name }]`,
    createTestFn: createClassTest
  },

  functions: {
    categoryId: '[Functions]',
    getTestId: name => `[(function)${ name }]`,
    createTestFn: createFunctionTest
  }
}

const varFilterRE = /(Props|Emits)$/
const useRE = /use[A-Z]/
const withComponentHostRE = /import \{.+(on[A-Za-z]+|getCurrentInstance).+\} from 'vue'/

function createVariableTest ({ testId, jsonEntry }) {
  return `
    describe('${ testId }', () => {
      test.todo('is defined correctly', () => {
        // TODO: do something with ${ jsonEntry.accessor }
      })
    })\n`
}

function createClassTest ({ testId, jsonEntry }) {
  return `
    describe('${ testId }', () => {
      test.todo('can be instantiated', () => {
        const instance = new ${ jsonEntry.accessor }(${ jsonEntry.constructorParams })
        // TODO: do something with "instance"
      })
    })\n`
}

function getFnTests (jsonEntry, json) {
  if (
    // we need a host component for the composables
    json.componentHost === true
    // and this is a composable function
    && useRE.test(jsonEntry.accessor)
  ) {
    return `test.todo('does not error out', () => {
        const TestComponent = defineComponent({
          template: '<div></div>',
          setup () {
            const result = ${ jsonEntry.accessor }(${ jsonEntry.params })
            return { result }
          }
        })

        const wrapper = mount(TestComponent, {})

        // TODO: test the outcome
      })`
  }

  return `test.todo('does not error out', () => {
        expect(() => ${ jsonEntry.accessor }(${ jsonEntry.params })).not.toThrow()
      })

      test.todo('has correct return value', () => {
        const result = ${ jsonEntry.accessor }(${ jsonEntry.params })
        expect(result).toBeDefined()
      })`
}

function createFunctionTest ({ testId, jsonEntry, json }) {
  return `
    describe('${ testId }', () => {
      ${ getFnTests(jsonEntry, json) }
    })\n`
}

export default {
  identifiers,
  getJson: ctx => {
    const json = readAstJson(ctx)

    json.variables = json.variables || {}

    // filter out component props and emits
    json.namedExports.forEach(name => {
      if (varFilterRE.test(name) === true) {
        json.namedExports.delete(name)
        delete json.variables[ name ]
      }
    })

    if (Object.keys(json.variables).length === 0) {
      delete json.variables
    }

    json.componentHost = withComponentHostRE.test(ctx.targetContent)

    return json
  },
  getFileHeader: ({ ctx, json }) => {
    return [
      'import { describe, test, expect } from \'vitest\'',
      '',
      getImportStatement({ ctx, json })
    ].join('\n')
  }
}
