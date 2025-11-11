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
  if (!data) return validationFailed('No emote data found')

  // Check for social emote flow properties
  const hasStartAnimation = 'startAnimation' in data && data.startAnimation !== undefined
  const hasRandomizeOutcomes = 'randomizeOutcomes' in data && data.randomizeOutcomes !== undefined
  const hasOutcomes = 'outcomes' in data && data.outcomes !== undefined

  const socialEmoteProps = [hasStartAnimation, hasRandomizeOutcomes, hasOutcomes]
  const anyPresent = socialEmoteProps.some((prop) => prop)
  const allPresent = socialEmoteProps.every((prop) => prop)

  if (!anyPresent) {
    // ADR 287 only validates social emotes, so if no social emote properties are present, return OK
    return OK
  }

  if (anyPresent && !allPresent) {
    const missing = []
    if (!hasStartAnimation) missing.push('startAnimation')
    if (!hasRandomizeOutcomes) missing.push('randomizeOutcomes')
    if (!hasOutcomes) missing.push('outcomes')
    return validationFailed(
      `For social emote definition, all properties must be present. Missing: ${missing.join(', ')}`
    )
  }

  // Validate startAnimation
  if (hasStartAnimation && data.startAnimation) {
    const result = StartAnimation.validate(data.startAnimation)
    if (!result) {
      return validationFailed('Some properties of StartAnimation are not valid')
    }
  }

  // Validate outcomes length
  if (hasOutcomes && data.outcomes) {
    if (data.outcomes.length === 0) {
      return validationFailed('Outcomes array cannot be empty')
    }
    if (data.outcomes.length > MAX_SOCIAL_EMOTE_OUTCOMES) {
      return validationFailed(`Outcomes array can contain up to ${MAX_SOCIAL_EMOTE_OUTCOMES} items`)
    }
    for (const outcome of data.outcomes) {
      const result = OutcomeGroup.validate(outcome)
      if (!result) {
        return validationFailed('Some properties of Outcome are not valid')
      }
    }
  }

  return OK
}

export const emoteValidateFn = validateIfTypeMatches(
  EntityType.EMOTE,
  validateAll(wasCreatedAfterADR74ValidateFn, emoteRepresentationContentValidateFn, emoteADR287ValidateFn)
)
