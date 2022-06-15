import {
  ContentValidatorComponents,
  OK,
  Validation,
  validationFailed
} from '../types'
import { entityParameters } from './ADR51'
import { validationAfterADR45 } from './validations'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */
export const metadata: Validation = validationAfterADR45({
  async validate(components: ContentValidatorComponents, deployment) {
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
