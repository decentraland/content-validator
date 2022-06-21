import { EntityType } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, OK, Validation, validationFailed } from '../types'
import { entityParameters } from './ADR51'
import { ADR_74_TIMESTAMP } from './timestamps'
import { validationAfterADR45, validationAfterADR74, validationForType, validationGroup } from './validations'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */
const metadataSchemaIsValid: Validation = {
  async validate(components: ContentValidatorComponents, deployment) {
    const { type, metadata } = deployment.entity
    const validator = entityParameters[type].validate
    if (validator(metadata)) {
      return OK
    }
    const errors = validator.errors?.map(($) => '' + $.message) || []
    return validationFailed(`The metadata for this entity type (${deployment.entity.type}) is not valid.`, ...errors)
  }
}

type ADR = {
  number: number
  timestamp: number
}

const ADRMetadataVersionTimelines: Record<EntityType, ADR[]> = {
  emote: [{ number: 74, timestamp: ADR_74_TIMESTAMP }].sort((v1, v2) => v1.timestamp - v2.timestamp),
  scene: [],
  profile: [],
  wearable: [],
  store: []
}

const metadataVersionIsCorrectForTimestamp: Validation = {
  validate(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
    const entity = deployment.entity
    const adrNumber = ADRMetadataVersionTimelines[entity.type].find((v) => v.timestamp < entity.timestamp)?.number
    const expectedDataField = `${entity.type}DataADR${adrNumber}`
    return `${expectedDataField}` in deployment.entity.metadata
      ? OK
      : validationFailed(
          `'emoteData' field version is incorrect. It must be: '${expectedDataField} but it is: ${deployment.entity.metadata} `
        )
  }
}

export const metadata: Validation = validationGroup(
  validationAfterADR45(metadataSchemaIsValid),
  validationAfterADR74(validationForType(EntityType.EMOTE, metadataVersionIsCorrectForTimestamp))
)
