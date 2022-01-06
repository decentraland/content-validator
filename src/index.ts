import { ExternalCalls, OK, Validator } from './types'
import { validations } from './validations'

export * from './types'
export * from './validations'

/**
 * Creates a validator instance with given external calls.
 * @public
 */
export const createValidator = (externalCalls: ExternalCalls): Validator => ({
  validate: async (deployment) => {
    for (const validation of validations) {
      const result = await validation.validate({ deployment, externalCalls })
      if (!result.ok) return result
    }
    return OK
  },
})
