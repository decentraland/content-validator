import { EntityType, Wearable } from '@dcl/schemas'
import { DeploymentToValidate } from '../..'
import { ContentValidatorComponents, OK, ValidateFn, validationFailed } from '../../types'
import { validateIfTypeMatches } from '../validations'

/** Validate wearable representations are referencing valid content */
export async function wearableRepresentationContent(
  components: ContentValidatorComponents,
  deployment: DeploymentToValidate
) {
  const { entity } = deployment
  const wearableMetadata = entity.metadata as Wearable
  const representations = wearableMetadata?.data?.representations
  if (!representations || representations.length === 0) return validationFailed('No wearable representations found')
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

/**
 * Validate that given wearable deployment includes the thumbnail and doesn't exceed file sizes
 * * @public
 */
export const wearable: ValidateFn = validateIfTypeMatches(EntityType.WEARABLE, wearableRepresentationContent)
