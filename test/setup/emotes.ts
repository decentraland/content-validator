import { generateTree } from '@dcl/content-hash-tree'
import { keccak256Hash } from '@dcl/hashing'
import {
  BodyShape,
  EmoteADR74,
  EmoteCategory,
  EmoteRepresentationADR74,
  Locale,
  Rarity,
  StandardProps,
  ThirdPartyProps
} from '@dcl/schemas'

const EMOTE_MERKLE_PROOF_REQUIRED_KEYS = [
  'content',
  'id',
  'name',
  'description',
  'i18n',
  'image',
  'thumbnail',
  'emoteDataADR74'
]

const representation: EmoteRepresentationADR74 = {
  bodyShapes: [BodyShape.FEMALE],
  mainFile: 'file1',
  contents: ['file1', 'file2']
}

export const VALID_STANDARD_EMOTE_METADATA: EmoteADR74 & StandardProps = {
  id: 'some id',
  name: 'name',
  description: 'some description',
  collectionAddress: '0x0000000collection_address',
  rarity: Rarity.LEGENDARY,
  i18n: [
    {
      code: Locale.EN,
      text: 'name'
    }
  ],
  emoteDataADR74: {
    category: EmoteCategory.FUN,
    tags: ['tag1'],
    representations: [representation],
    loop: true
  },
  thumbnail: 'thumbnail.png',
  image: 'image.png'
}

export const VALID_THIRD_PARTY_WEARABLE_BASE_METADATA: Omit<EmoteADR74 & ThirdPartyProps, 'merkleProof'> = {
  id: 'urn:decentraland:amoy:collections-thirdparty:jean-pier:someCollection:someItemId',
  name: 'name',
  description: 'some description',
  i18n: [
    {
      code: Locale.EN,
      text: 'name'
    }
  ],
  emoteDataADR74: {
    tags: ['tag1'],
    representations: [representation],
    category: EmoteCategory.FUN,
    loop: true
  },
  thumbnail: 'thumbnail.png',
  image: 'image.png',
  content: {
    ['image.png']: 'QmPEXLrQNEYVJfe5P2CbNuVpx4UabK37jQ6Hor1n9gw8dY',
    ['female/M_3LAU_Hat_Blue.glb']: 'QmebRdUS12afshxzNtTb2h6UhSXjMrGTGeZWcwwtmhTJng',
    ['male/M_3LAU_Hat_Blue.glb']: 'QmebRdUS12afshxzNtTb2h6UhSXjMrGTGeZWcwwtmhTJng',
    ['thumbnail.png']: 'QmPP232rkN2UDg8yGAyJ6hkHGsDFwXivcv9MXFfnW8r34y'
  }
}

export const VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT = buildEntityMetadataWithMerkleProof(
  VALID_THIRD_PARTY_WEARABLE_BASE_METADATA,
  ['someOtherHash1', 'someOtherHash2']
)

// Using the entity, the keys to be hashed and the other node hashes, build the merkle proof for the entity and return a new proofed entity.
function buildEntityMetadataWithMerkleProof(
  baseEntity: Omit<EmoteADR74 & ThirdPartyProps, 'merkleProof'>,
  otherNodeHashes: string[]
): { root: string; entity: EmoteADR74 & ThirdPartyProps } {
  const entityHash = keccak256Hash(baseEntity, EMOTE_MERKLE_PROOF_REQUIRED_KEYS)
  const sortedHashes = [...otherNodeHashes, entityHash].sort()
  const tree = generateTree(sortedHashes)
  const entityProof = tree.proofs[entityHash]
  const thirdPartyEmote: EmoteADR74 & ThirdPartyProps = {
    ...baseEntity,
    merkleProof: {
      index: entityProof.index,
      proof: entityProof.proof,
      hashingKeys: EMOTE_MERKLE_PROOF_REQUIRED_KEYS,
      entityHash
    }
  }
  return {
    root: tree.merkleRoot,
    entity: thirdPartyEmote
  }
}
