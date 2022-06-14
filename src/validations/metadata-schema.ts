import { EntityType } from '@dcl/schemas'
import { ADR_74_TIMESTAMP } from '.'
import { DeploymentToValidate } from '..'
import {
  ContentValidatorComponents,
  OK,
  Validation,
  validationFailed
} from '../types'
import { entityParameters } from './ADR51'
import { conditionalValidation, validationAfterADR45, validationGroup } from './validations'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */
const validateMetadata: Validation = {
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
}

const emoteTimestampIsAfterADR74: Validation = {
  validate(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
    return deployment.entity.timestamp < ADR_74_TIMESTAMP
      ? validationFailed(`The emote timestamp ${deployment.entity.timestamp} is before ADR 74. Emotes did not exist before ADR 74.`)
      : OK
  }
}

export const metadata: Validation = validationGroup(
  conditionalValidation((components, deployment) => deployment.entity.type === EntityType.EMOTE, emoteTimestampIsAfterADR74),
  validationAfterADR45(validateMetadata)
)
