import { entityParameters } from './ADR51'
import { ADR_45_TIMESTAMP } from '.'
import { conditionalValidation, OK, validationFailed } from '../types'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */
export const metadata = conditionalValidation({
  async predicate({ deployment }) {
    if (deployment.entity.timestamp <= ADR_45_TIMESTAMP) return OK

    const { type, metadata } = deployment.entity
    const validator = entityParameters[type].validate
    if (validator(metadata)) {
      return OK
    }
    const errors = validator.errors?.map(($) => '' + $.message) || []
    return validationFailed(
      `The metadata for this entity type (${deployment.entity.type}) is not valid.`,
      ...errors
    )
  }
})
