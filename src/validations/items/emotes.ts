import { Emote, EntityType, OutcomeGroup, StartAnimation } from '@dcl/schemas'
import { DeploymentToValidate, OK, validationFailed, ValidationResponse } from '../../types'
import { ADR_74_TIMESTAMP } from '../timestamps'
import { validateAll, validateIfTypeMatches } from '../validations'

const MAX_SOCIAL_EMOTE_OUTCOMES = 3

export async function wasCreatedAfterADR74ValidateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
  return deployment.entity.timestamp < ADR_74_TIMESTAMP
    ? validationFailed(
        `The emote timestamp ${deployment.entity.timestamp} is before ADR 74. Emotes did not exist before ADR 74.`
      )
    : OK
}

export async function emoteRepresentationContentValidateFn(deployment: DeploymentToValidate) {
  const { entity } = deployment
  const metadata = entity.metadata as Emote
  const representations = metadata?.emoteDataADR74?.representations
  if (!representations || representations.length === 0) return validationFailed('No emote representations found')
  if (!entity.content || entity.content.length === 0) return validationFailed('No content found')

  for (const representation of representations) {
    for (const representationContent of representation.contents) {
      if (!entity.content.find((content) => content.file === representationContent)) {
        return validationFailed(`Representation content: '${representationContent}' is not one of the content files`)
      }
    }
  }
  return OK
}

export async function emoteADR287ValidateFn(deployment: DeploymentToValidate) {
  const { entity } = deployment
  const metadata = entity.metadata as Emote
  const data = metadata?.emoteDataADR74

  if (!data) {
    return validationFailed('No emote data found')
  }

  // Check for social emote properties
  const requiredProperties = ['startAnimation', 'randomizeOutcomes', 'outcomes'] as const
  const presentProperties = requiredProperties.filter((prop) => data[prop] !== undefined)

  // Not a social emote if no properties are present
  if (presentProperties.length === 0) {
    return OK
  }

  if (presentProperties.length < requiredProperties.length) {
    const missingProperties = requiredProperties.filter((prop) => data[prop] === undefined)
    return validationFailed(
      `For social emote definition, all properties must be present. Missing: ${missingProperties.join(', ')}`
    )
  }

  const { startAnimation, outcomes } = data

  // Validate startAnimation
  if (!StartAnimation.validate(startAnimation)) {
    return validationFailed('Some properties of StartAnimation are not valid')
  }

  // Validate outcomes length
  if (!outcomes || outcomes.length === 0) {
    return validationFailed('Outcomes array cannot be empty')
  }

  if (outcomes.length > MAX_SOCIAL_EMOTE_OUTCOMES) {
    return validationFailed(`Outcomes array can contain up to ${MAX_SOCIAL_EMOTE_OUTCOMES} items`)
  }

  // Validate each outcome
  for (const outcome of outcomes) {
    if (!OutcomeGroup.validate(outcome)) {
      return validationFailed('Some properties of Outcome are not valid')
    }
  }

  return OK
}

export const emoteValidateFn = validateIfTypeMatches(
  EntityType.EMOTE,
  validateAll(wasCreatedAfterADR74ValidateFn, emoteRepresentationContentValidateFn, emoteADR287ValidateFn)
)
