import { generateTree } from '@dcl/content-hash-tree'
import { keccak256Hash } from '@dcl/hashing'
import {
  BodyShape,
  Locale,
  Rarity,
  ThirdPartyProps,
  Wearable,
  WearableCategory,
  WearableRepresentation
} from '@dcl/schemas'

const WEARABLE_MERKLE_PROOF_REQUIRED_KEYS = [
  'content',
  'id',
  'name',
  'description',
  'i18n',
  'image',
  'thumbnail',
  'data'
]

const representation: WearableRepresentation = {
  bodyShapes: [BodyShape.FEMALE],
  mainFile: 'file1',
  contents: ['file1', 'file2'],
  overrideHides: [],
  overrideReplaces: []
}

export const BASE_WEARABLE_METADATA: Pick<Wearable, 'id' | 'i18n' | 'data' | 'thumbnail'> = {
  id: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  i18n: [
    {
      code: Locale.EN,
      text: 'name'
    }
  ],
  data: {
    replaces: [],
    hides: [],
    tags: ['tag1'],
    representations: [
      {
        bodyShapes: [BodyShape.FEMALE],
        mainFile: 'file1',
        contents: ['file1', 'file2'],
        overrideHides: [],
        overrideReplaces: []
      }
    ],
    category: WearableCategory.UPPER_BODY
  },
  thumbnail: 'thumbnail.png'
}

export const VALID_WEARABLE_METADATA: Wearable = {
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
  data: {
    replaces: [],
    hides: [],
    tags: ['tag1'],
    representations: [representation],
    category: WearableCategory.UPPER_BODY
  },
  thumbnail: 'thumbnail.png',
  image: 'image.png'
}

export const VALID_THIRD_PARTY_WEARABLE_BASE_METADATA: Omit<Wearable & ThirdPartyProps, 'merkleProof'> = {
  id: 'urn:decentraland:mumbai:collections-thirdparty:jean-pier:someCollection:someItemId',
  name: 'name',
  description: 'some description',
  i18n: [
    {
      code: Locale.EN,
      text: 'name'
    }
  ],
  data: {
    replaces: [],
    hides: [],
    tags: ['tag1'],
    representations: [representation],
    category: WearableCategory.UPPER_BODY
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

export const VALID_THIRD_PARTY_WEARABLE = buildEntityMetadataWithMerkleProof(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA, [
  'someOtherHash1',
  'someOtherHash2'
])

// Using the entity, the keys to be hashed and the other node hashes, build the merkle proof for the entity and return a new proofed entity.
function buildEntityMetadataWithMerkleProof(
  baseEntity: Omit<Wearable & ThirdPartyProps, 'merkleProof'>,
  otherNodeHashes: string[]
): { root: string; entity: Wearable & ThirdPartyProps } {
  const entityHash = keccak256Hash(baseEntity, [
    'content',
    'id',
    'name',
    'description',
    'i18n',
    'image',
    'thumbnail',
    'data'
  ])
  const sortedHashes = [...otherNodeHashes, entityHash].sort()
  const tree = generateTree(sortedHashes)
  const entityProof = tree.proofs[entityHash]
  const thirdPartyWearable: Wearable & ThirdPartyProps = {
    ...baseEntity,
    merkleProof: {
      index: entityProof.index,
      proof: entityProof.proof,
      hashingKeys: WEARABLE_MERKLE_PROOF_REQUIRED_KEYS,
      entityHash
    }
  }
  return {
    root: tree.merkleRoot,
    entity: thirdPartyWearable
  }
}
