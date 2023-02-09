import { ContentValidatorComponents, OK, Validator } from './types'
import { validateFns } from './validations'

export { createTheGraphClient } from './the-graph-client/the-graph-client'
export * from './types'
export * from './validations'

/**
 * Creates a validator instance with given external calls.
 * @public
 */
export const createValidator = (
  components: Pick<ContentValidatorComponents, 'config' | 'externalCalls' | 'logs' | 'theGraphClient' | 'subGraphs'>
): Validator => {
  const logs = components.logs.getLogger('ContentValidator')

  return {
    validate: async (deployment) => {
      for (const validate of validateFns) {
        const result = await validate(components, deployment)
        if (!result.ok) {
          logs.debug(`Validation failed:\n${result.errors?.join('\n')}`)
          return result
        }
      }
      return OK
    }
  }
}
