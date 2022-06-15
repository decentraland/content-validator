import { EntityType, Wearable } from '@dcl/schemas'
import {
  ContentValidatorComponents,
  OK,
  Validation,
  validationFailed
} from '../../types'
import { validationForType } from '../validations'

/** Validate wearable representations are referencing valid content */
export const wearableRepresentationContent: Validation = {
  validate: async (components: ContentValidatorComponents, deployment) => {
    const { entity } = deployment
    const wearableMetadata = entity.metadata as Wearable
    const representations = wearableMetadata?.data?.representations
    if (!representations)
      return validationFailed('No wearable representations found')
    if (!entity.content) return validationFailed('No content found')

    for (const representation of representations) {
      for (const representationContent of representation.contents) {
        if (
          !entity.content.find(
            (content) => content.file === representationContent
          )
        ) {
          return validationFailed(
            `Representation content: '${representationContent}' is not one of the content files`
          )
        }
      }
    }
    return OK
  }
}

/**
 * Validate that given wearable deployment includes the thumbnail and doesn't exceed file sizes
 * * @public
 */
export const wearable: Validation = validationForType(EntityType.WEARABLE, wearableRepresentationContent)
