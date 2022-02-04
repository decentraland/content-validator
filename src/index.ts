import { ContentValidatorComponents, ExternalCalls, OK, Validator } from './types'
import { validations } from './validations'

export * from './types'
export * from './validations'

/**
 * Creates a validator instance with given external calls.
 * @public
 */
export const createValidator = (
  externalCalls: ExternalCalls,
  components?: Pick<ContentValidatorComponents, 'logs'>
): Validator => ({
  validate: async (deployment) => {
    const logs = components?.logs.getLogger('ContentValidator')
    for (const validation of validations) {
      const result = await validation.validate({ deployment, externalCalls }, logs)
      if (!result.ok) {
        logs?.debug(`Validation failed:\n${result.errors?.join('\n')}`)
        return result
      }
    }
    return OK
  },
})
