import { EntityType, isThirdParty, ThirdPartyProps, Wearable } from '@dcl/schemas'
import { DeploymentToValidate } from '../..'
import { OK, validationFailed, ValidationResponse } from '../../types'
import { validateAll, validateIfTypeMatches } from '../validations'
import { keccak256Hash } from '@dcl/hashing'

/** Validate wearable representations are referencing valid content */
export async function wearableRepresentationContentValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
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

export async function thirdPartyWearableMerkleProofContentValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const { entity } = deployment
  if (!isThirdParty(entity.metadata)) {
    return OK
  }

  const wearableMetadata = entity.metadata as Wearable & ThirdPartyProps

  // Check the id in the metadata matches the pointer being deployed
  if (wearableMetadata.id !== entity.pointers[0]) {
    return validationFailed(`The id '${wearableMetadata.id}' does not match the pointer '${entity.pointers[0]}'`)
  }

  // Check the content files declared inside the metadata is exactly the same as the files uploaded with the entity
  const allContentInFiles = Object.keys(wearableMetadata.content).every((content) => {
    const contentFile = entity.content.find((file) => file.file === content)
    if (!contentFile) {
      return false
    }
    return contentFile.hash === wearableMetadata.content[content]
  })

  const allFilesInContent = entity.content.every((content) => {
    return wearableMetadata.content[content.file] === content.hash
  })
  if (!allContentInFiles || !allFilesInContent) {
    return validationFailed('The content declared in the metadata does not match the files uploaded with the entity')
  }

  // Re-create the entity hash and check it matches the one provided in the metadata
  const merkleProof = wearableMetadata.merkleProof

  const entityHash = keccak256Hash(wearableMetadata, merkleProof.hashingKeys)
  if (entityHash !== merkleProof.entityHash) {
    return validationFailed(
      `The entity hash provided '${merkleProof.entityHash}' is different to the one calculated from the metadata '${entityHash}'`
    )
  }

  return OK
}

/**
 * Validate that given wearable deployment includes the thumbnail and doesn't exceed file sizes
 * @public
 */
export const wearableValidateFn = validateIfTypeMatches(
  EntityType.WEARABLE,
  validateAll(wearableRepresentationContentValidateFn, thirdPartyWearableMerkleProofContentValidateFn)
)
