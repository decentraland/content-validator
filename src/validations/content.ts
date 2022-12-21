import { Avatar, EntityType, Profile } from '@dcl/schemas'
import { fromErrors, Validation } from '../types'
import { validationAfterADR100, validationAfterADR45, validationGroup } from './validations'

const correspondsToASnapshot = (fileName: string, hash: string, metadata: Profile) => {
  const fileNameWithoutExtension = fileName.replace(/.[^/.]+$/, '')

  if (!metadata || !metadata.avatars) return false
  return metadata.avatars.some((avatar: Avatar) =>
    Object.entries(avatar.avatar.snapshots).some((key) => key[0] === fileNameWithoutExtension && key[1] === hash)
  )
}

export const allHashesWereUploadedOrStored: Validation = {
  async validate(components, deployment) {
    const { entity, files } = deployment
    const errors: string[] = []
    if (entity.content) {
      const alreadyStoredHashes = await components.externalCalls.isContentStoredAlready(
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

export const allHashesInUploadedFilesAreReportedInTheEntity: Validation = {
  async validate(_components, deployment) {
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
}

export const allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45: Validation = validationAfterADR45({
  async validate(_components, deployment) {
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
})

export const allMandatoryContentFilesArePresent: Validation = validationAfterADR100({
  async validate(_components, deployment) {
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
  }
})

/**
 * Validate that uploaded and reported hashes are corrects and files corresponds to snapshots
 * @public
 */
export const content: Validation = validationGroup(
  allHashesWereUploadedOrStored,
  allHashesInUploadedFilesAreReportedInTheEntity,
  allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45
)
