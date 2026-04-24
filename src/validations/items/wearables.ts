import { keccak256Hash } from '@dcl/hashing'
import { EntityType, isThirdParty, ThirdPartyProps, Wearable } from '@dcl/schemas'
import { DeploymentToValidate } from '../..'
import { OK, validationFailed, ValidationResponse } from '../../types'
import { validateAll, validateIfTypeMatches } from '../validations'

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
  if (wearableMetadata.id.toLowerCase() !== entity.pointers[0].toLowerCase()) {
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
 * Spring bone parameter definition used for inline validation.
 * Each bone has physics-like properties controlling spring simulation.
 */
type SpringBoneParams = {
  stiffness: number
  gravityPower: number
  gravityDir: number[]
  drag: number
  isRoot: boolean
}

/**
 * Spring bones metadata structure attached to wearable metadata.
 * Maps model filenames to their bone configurations.
 */
type SpringBonesData = {
  version: number
  models: Record<string, Record<string, SpringBoneParams>>
}

/** Validate spring bones metadata when present on a wearable */
export async function springBonesMetadataValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const { entity } = deployment
  const wearableMetadata = entity.metadata as Wearable & { springBones?: SpringBonesData }

  // Spring bones are optional — skip validation if not present
  if (!wearableMetadata?.springBones) {
    return OK
  }

  const springBones = wearableMetadata.springBones
  const errors: string[] = []

  // (d) Version must be 1
  if (springBones.version !== 1) {
    errors.push(`springBones.version must be 1, got ${springBones.version}`)
  }

  if (!springBones.models || typeof springBones.models !== 'object') {
    errors.push('springBones.models must be an object')
    return validationFailed(...errors)
  }

  // Collect all content filenames across all representations
  const representations = wearableMetadata?.data?.representations ?? []
  const allContentFiles = new Set<string>()
  for (const representation of representations) {
    for (const contentFile of representation.contents) {
      allContentFiles.add(contentFile)
    }
  }

  for (const [modelFilename, bones] of Object.entries(springBones.models)) {
    // (a) Model filenames must exist in representation contents
    if (!allContentFiles.has(modelFilename)) {
      errors.push(
        `springBones model filename '${modelFilename}' does not match any file in representation contents`
      )
    }

    if (!bones || typeof bones !== 'object') {
      errors.push(`springBones.models['${modelFilename}'] must be an object mapping bone names to parameters`)
      continue
    }

    for (const [boneName, params] of Object.entries(bones)) {
      // (b) Bone names must follow SpringBone_ naming convention (case-insensitive)
      if (!boneName.toLowerCase().includes('springbone')) {
        errors.push(
          `Bone name '${boneName}' in model '${modelFilename}' does not follow the SpringBone naming convention`
        )
      }

      // (c) Parameter ranges validation
      if (typeof params.stiffness !== 'number' || params.stiffness < 0) {
        errors.push(
          `springBones.models['${modelFilename}']['${boneName}'].stiffness must be a number >= 0, got ${params.stiffness}`
        )
      }

      if (typeof params.gravityPower !== 'number' || params.gravityPower < 0) {
        errors.push(
          `springBones.models['${modelFilename}']['${boneName}'].gravityPower must be a number >= 0, got ${params.gravityPower}`
        )
      }

      if (typeof params.drag !== 'number' || params.drag < 0) {
        errors.push(
          `springBones.models['${modelFilename}']['${boneName}'].drag must be a number >= 0, got ${params.drag}`
        )
      }

      if (
        !Array.isArray(params.gravityDir) ||
        params.gravityDir.length !== 3 ||
        !params.gravityDir.every((v: unknown) => typeof v === 'number')
      ) {
        errors.push(
          `springBones.models['${modelFilename}']['${boneName}'].gravityDir must be an array of exactly 3 numbers, got ${JSON.stringify(params.gravityDir)}`
        )
      }

      if (typeof params.isRoot !== 'boolean') {
        errors.push(
          `springBones.models['${modelFilename}']['${boneName}'].isRoot must be a boolean, got ${params.isRoot}`
        )
      }
    }
  }

  return errors.length > 0 ? validationFailed(...errors) : OK
}

/**
 * Validate that given wearable deployment includes the thumbnail and doesn't exceed file sizes
 * @public
 */
export const wearableValidateFn = validateIfTypeMatches(
  EntityType.WEARABLE,
  validateAll(
    wearableRepresentationContentValidateFn,
    thirdPartyWearableMerkleProofContentValidateFn,
    springBonesMetadataValidateFn
  )
)
