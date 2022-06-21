import { Emote, EntityType } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, OK, Validation, validationFailed } from '../../types'
import { ADR_74_TIMESTAMP } from '../timestamps'
import { validationForType, validationGroup } from '../validations'

export const wasCreatedAfterADR74: Validation = {
  validate(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
    return deployment.entity.timestamp < ADR_74_TIMESTAMP
      ? validationFailed(
          `The emote timestamp ${deployment.entity.timestamp} is before ADR 74. Emotes did not exist before ADR 74.`
        )
      : OK
  }
}

export const emoteRepresentationContent: Validation = {
  validate: async (components: ContentValidatorComponents, deployment) => {
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
}

export const emote: Validation = validationForType(
  EntityType.EMOTE,
  validationGroup(wasCreatedAfterADR74, emoteRepresentationContent)
)
