import { EntityType } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, OK, ValidateFn, validationFailed } from '../types'
import { entityParameters } from './ADR51'
import { ADR_74_TIMESTAMP } from './timestamps'
import { validateAfterADR45, validateAfterADR74, validateAll, validateIfTypeMatches } from './validations'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */
function metadataSchemaIsValid(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
  const { type, metadata } = deployment.entity
  const validator = entityParameters[type].validate
  if (validator(metadata)) {
    return OK
  }
  const errors = validator.errors?.map(($) => '' + $.message) || []
  return validationFailed(`The metadata for this entity type (${deployment.entity.type}) is not valid.`, ...errors)
}

type ADR = {
  number: number
  timestamp: number
}

/**
 * This map contains one ADR timeline per entity type. In a timeline, each element has
 * a number and a timestamp. The number corresponds to the number of an ADR and the timestamp
 * to the creation of that ADR. Each timeline is sorted by timestamp.
 * The idea behind this is the ability to version schemas over the time, but run validations
 * according with the deployment original time. (Imagining starting a Content Server from scratch,
 * it will have to sync deployments since the launcha date).
 * See ADR 74 for more details of schema versioning.
 */
const ADRMetadataVersionTimelines: Record<EntityType, ADR[]> = {
  emote: [{ number: 74, timestamp: ADR_74_TIMESTAMP }].sort((v1, v2) => v1.timestamp - v2.timestamp),
  scene: [],
  profile: [],
  wearable: [],
  store: []
}

/**
 * This validation is being ran only for emotes  currently
 */
function metadataVersionIsCorrectForTimestamp(
  components: ContentValidatorComponents,
  deployment: DeploymentToValidate
) {
  const entity = deployment.entity
  const adrNumber = ADRMetadataVersionTimelines[entity.type].find((v) => v.timestamp < entity.timestamp)?.number
  const expectedDataField = `${entity.type}DataADR${adrNumber}`
  return `${expectedDataField}` in deployment.entity.metadata
    ? OK
    : validationFailed(
        `'emoteData' field version is incorrect. It must be: '${expectedDataField} but it is: ${deployment.entity.metadata} `
      )
}

export const metadata: ValidateFn = validateAll(
  validateAfterADR45(metadataSchemaIsValid),
  validateAfterADR74(validateIfTypeMatches(EntityType.EMOTE, metadataVersionIsCorrectForTimestamp))
)
