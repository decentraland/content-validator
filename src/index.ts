import { ExternalCalls, OK, Validator } from './types'
import { statefulValidations, statelessValidations } from './validations'

export * from './types'
export * from './validations'

export const validator = (externalCalls: ExternalCalls): Validator => ({
  validate: async (deployment) => {
    for (const validation of [...statelessValidations, ...statefulValidations]) {
      const result = await validation.validate({ deployment, externalCalls })
      if (!result.ok) return result
    }
    return OK
  },
})
