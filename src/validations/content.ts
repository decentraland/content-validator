import { Avatar, EntityType, Profile } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, fromErrors, ValidateFn, ValidationResponse } from '../types'
import { validateAfterADR158, validateAfterADR45, validateAll } from './validations'

function correspondsToASnapshot(fileName: string, hash: string, metadata: Profile) {
  const fileNameWithoutExtension = fileName.replace(/.[^/.]+$/, '')

  if (!metadata || !metadata.avatars) return false
  return metadata.avatars.some((avatar: Avatar) =>
    Object.entries(avatar.avatar.snapshots).some((key) => key[0] === fileNameWithoutExtension && key[1] === hash)
  )
}

export function createAllHashesWereUploadedOrStoredValidateFn({
  externalCalls,
}: Pick<ContentValidatorComponents, 'externalCalls'>): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity, files } = deployment
    const errors: string[] = []
    if (entity.content) {
      const alreadyStoredHashes = await externalCalls.isContentStoredAlready(
        entity.content?.map((file) => file.hash) ?? []
      )

      for (const { hash } of entity.content) {
        // Validate that all hashes in entity were uploaded, or were already stored on the service
        if (!(files.has(hash) || alreadyStoredHashes.get(hash))) {
          errors.push(`This hash is referenced in the entity but was not uploaded or previously available: ${hash}`)
        }
      }
    }
    return fromErrors(...errors)
  }
}

export async function allHashesInUploadedFilesAreReportedInTheEntityValidateFn(deployment: DeploymentToValidate) {
  const { entity, files } = deployment
  const errors: string[] = []
  // Validate that all hashes that belong to uploaded files are actually reported on the entity
  const entityHashes = new Set(entity.content?.map(({ hash }) => hash) ?? [])
  for (const [hash] of files) {
    if (!entityHashes.has(hash) && hash !== entity.id) {
      errors.push(`This hash was uploaded but is not referenced in the entity: ${hash}`)
    }
  }
  return fromErrors(...errors)
}

export const allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn = validateAfterADR45(
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    const errors: string[] = []
    for (const { file, hash } of entity.content ?? []) {
      // Validate all content files correspond to at least one avatar snapshot
      if (entity.type === EntityType.PROFILE) {
        if (!correspondsToASnapshot(file, hash, entity.metadata)) {
          errors.push(
            `This file is not expected: '${file}' or its hash is invalid: '${hash}'. Please, include only valid snapshot files.`
          )
        }
      }
    }
    return fromErrors(...errors)
  }
)

export const allMandatoryContentFilesArePresentValidateFn = validateAfterADR158(async function validateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const { entity } = deployment
  const errors: string[] = []
  if (entity.type === EntityType.PROFILE) {
    const fileNames = entity.content.map((a) => a.file.toLowerCase())
    if (!fileNames.includes('body.png')) {
      errors.push(`Profile entity is missing file 'body.png'`)
    }
    if (!fileNames.includes('face256.png')) {
      errors.push(`Profile entity is missing file 'face256.png'`)
    }
  }
  return fromErrors(...errors)
})

export function createContentValidateFn(components: ContentValidatorComponents): ValidateFn {
  /**
   * Validate that uploaded and reported hashes are corrects and files corresponds to snapshots
   * @public
   */
  return validateAll(
    createAllHashesWereUploadedOrStoredValidateFn(components),
    allHashesInUploadedFilesAreReportedInTheEntityValidateFn,
    allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn,
    allMandatoryContentFilesArePresentValidateFn
  )
}
