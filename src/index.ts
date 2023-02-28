import { ContentValidatorComponents, OK, Validator } from './types'
import { createValidateFns } from './validations'

export * from './types'
export * from './validations'

/**
 * Creates a validator instance with given external calls.
 * @public
 */
export const createValidator = (
  components: Pick<ContentValidatorComponents, 'config' | 'externalCalls' | 'logs' | 'accessChecker'>
): Validator => {
  const logs = components.logs.getLogger('ContentValidator')
  const validateFns = createValidateFns(components)
  return {
    validate: async (deployment) => {
      for (const validate of validateFns) {
        const result = await validate(deployment)
        if (!result.ok) {
          logs.debug(`Validation failed:\n${result.errors?.join('\n')}`)
          return result
        }
      }
      const accessCheckerResult = await components.accessChecker.checkAccess(deployment)
      if (!accessCheckerResult.ok) {
        logs.debug(`Validation failed:\n${accessCheckerResult.errors?.join('\n')}`)
        return accessCheckerResult
      }
      return OK
    },
  }
}
