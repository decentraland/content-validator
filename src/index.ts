import {
  ContentValidatorComponents,
  ExternalCalls,
  OK,
  Validator
} from './types'
import { validations } from './validations'

export * from './types'
export * from './validations'

/**
 * Creates a validator instance with given external calls.
 * @public
 */
export const createValidator = (
  externalCalls: ExternalCalls,
  components: Pick<
    ContentValidatorComponents,
    'externalCalls' | 'logs' | 'theGraphClient'
  >
): Validator => {
  const logs = components.logs.getLogger('ContentValidator')

  return {
    validate: async (deployment) => {
      for (const validation of validations) {
        const result = await validation.validate(deployment, components)
        if (!result.ok) {
          logs.debug(`Validation failed:\n${result.errors?.join('\n')}`)
          return result
        }
      }
      return OK
    }
  }
}

export { createTheGraphClient } from './the-graph-client/the-graph-client'
