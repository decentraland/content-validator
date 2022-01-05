import { IPFSv2 } from '@dcl/schemas'
import { ADR_45_TIMESTAMP } from '.'
import { OK } from '..'
import { fromErrors, Validation } from '../types'

/**
 * Validate that all hashes used by the entity were actually IPFS hashes
 * @public
 */
export const ipfsHashing: Validation = {
  validate: ({ deployment }) => {
    const { entity } = deployment

    if (entity.timestamp < ADR_45_TIMESTAMP) return OK

    const hashesInContent = entity.content?.map(({ hash }) => hash) ?? []
    const allHashes = [entity.id, ...hashesInContent]

    const errors = allHashes
      .filter((hash) => !IPFSv2.validate(hash))
      .map((hash) => `This hash '${hash}' is not valid. It should be IPFS v2 format.`)

    return fromErrors(...errors)
  },
}
