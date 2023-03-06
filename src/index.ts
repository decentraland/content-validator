import { ContentValidatorComponents, OK, ValidateFn } from './types'
import { createValidateFns } from './validations'

export * from './types'
export * from './validations'

/**
 * Creates a validator instance with given external calls.
 * @public
 */
export const createValidator = (components: ContentValidatorComponents): ValidateFn => {
  const logs = components.logs.getLogger('ContentValidator')
  const validateFns = [...createValidateFns(components), components.accessValidateFn]
  return async function validateFn(deployment) {
    for (const validate of validateFns) {
      const result = await validate(deployment)
      if (!result.ok) {
        logs.debug(`Validation failed:\n${result.errors?.join('\n')}`)
        return result
      }
    }
    return OK
  }
}
