import { Avatar, Profile } from '@dcl/schemas'
import { EntityType } from 'dcl-catalyst-commons'
import { ADR_45_TIMESTAMP } from '.'
import { fromErrors, Validation } from '../types'

const correspondsToASnapshot = (fileName: string, hash: string, metadata: Profile) => {
  const fileNameWithoutExtension = fileName.replace(/.[^/.]+$/, '')

  if (!metadata || !metadata.avatars) return false
  return metadata.avatars.some((avatar: Avatar) =>
    Object.entries(avatar.avatar.snapshots).some((key) => key[0] === fileNameWithoutExtension && key[1] === hash)
  )
}

/**
 * Validate that uploaded and reported hashes are corrects and files corresponds to snapshots
 * @public
 */
export const content: Validation = {
  validate: async ({ deployment, externalCalls }) => {
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

    // Validate that all hashes that belong to uploaded files are actually reported on the entity
    const entityHashes = new Set(entity.content?.map(({ hash }) => hash) ?? [])
    for (const [hash] of files) {
      if (!entityHashes.has(hash) && hash !== entity.id) {
        errors.push(`This hash was uploaded but is not referenced in the entity: ${hash}`)
      }
    }

    if (entity.timestamp > ADR_45_TIMESTAMP) {
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
    }
    return fromErrors(...errors)
  }
}
