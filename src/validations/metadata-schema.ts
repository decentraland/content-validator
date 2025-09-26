import { EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, ValidateFn, validationFailed, ValidationResponse } from '../types'
import { entityParameters } from './ADR51'
import { ADR_287_TIMESTAMP, ADR_74_TIMESTAMP } from './timestamps'
import { validateAfterADR45, validateAfterADR74, validateAll, validateIfTypeMatches } from './validations'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */

export const metadataSchemaValidateFn = validateAfterADR45(async function validateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const { type, metadata } = deployment.entity
  const validator = entityParameters[type].validate
  if (validator(metadata)) {
    return OK
  }
  const errors = validator.errors?.map(($) => '' + $.message) || []
  return validationFailed(`The metadata for this entity type (${deployment.entity.type}) is not valid.`, ...errors)
})

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
 * it will have to sync deployments since the launch date).
 * See ADR 74 for more details of schema versioning.
 */
const ADRMetadataVersionTimelines: Record<EntityType, ADR[]> = {
  emote: [
    { number: 74, timestamp: ADR_74_TIMESTAMP },
    { number: 287, timestamp: ADR_287_TIMESTAMP }
  ].sort((v1, v2) => v1.timestamp - v2.timestamp),
  scene: [],
  profile: [],
  wearable: [],
  store: [],
  outfits: []
}

function validateIfEmote(validateFn: ValidateFn): ValidateFn {
  return validateIfTypeMatches(EntityType.EMOTE, validateFn)
}
/**
 * This validation is currently being run for emotes only
 */
export const metadataVersionIsCorrectForTimestampValidateFn = validateIfEmote(
  validateAfterADR74(async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const entity = deployment.entity
    const availableAdrs = ADRMetadataVersionTimelines[entity.type].filter((v) => v.timestamp <= entity.timestamp)

    if (availableAdrs.length === 0) {
      return validationFailed(
        `No valid ADR version found for entity type '${entity.type}' at timestamp ${entity.timestamp}`
      )
    }

    // Generate expected field names once
    const expectedFieldNames = availableAdrs.map((adr) => `${entity.type}DataADR${adr.number}`)
    const isValid = expectedFieldNames.some((fieldName) => fieldName in deployment.entity.metadata)

    if (isValid) {
      return OK
    }

    const actualFields = Object.keys(deployment.entity.metadata)
    return validationFailed(
      `'${entity.type}Data' field version is incorrect. Expected one of: [${expectedFieldNames.join(', ')}] but found: [${actualFields.join(', ')}]`
    )
  })
)

export const metadataValidateFn = validateAll(metadataSchemaValidateFn, metadataVersionIsCorrectForTimestampValidateFn)
