import { Emote, EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, validationFailed, ValidationResponse } from '../../types'
import { ADR_74_TIMESTAMP } from '../timestamps'
import { validateAll, validateIfTypeMatches } from '../validations'

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

export const emoteValidateFn = validateIfTypeMatches(
  EntityType.EMOTE,
  validateAll(wasCreatedAfterADR74ValidateFn, emoteRepresentationContentValidateFn)
)
