import { generateTree } from '@dcl/content-hash-tree'
import { keccak256Hash } from '@dcl/hashing'
import {
  Locale,
  Rarity,
  ThirdPartyWearable,
  Wearable,
  WearableBodyShape,
  WearableCategory,
  WearableRepresentation,
} from '@dcl/schemas'
import { MERKLE_PROOF_REQUIRED_KEYS } from '../../src/validations/access-checker/wearables'

const representation: WearableRepresentation = {
  bodyShapes: [WearableBodyShape.FEMALE],
  mainFile: 'file1',
  contents: ['file1', 'file2'],
  overrideHides: [],
  overrideReplaces: [],
}

export const VALID_WEARABLE_METADATA: Wearable = {
  id: 'some id',
  descriptions: [
    {
      code: Locale.EN,
      text: 'some description',
    },
    {
      code: Locale.ES,
      text: 'una descripcion',
    },
  ],
  collectionAddress: '0x0000000collection_address',
  rarity: Rarity.LEGENDARY,
  names: [
    {
      code: Locale.EN,
      text: 'name',
    },
  ],
  data: {
    replaces: [],
    hides: [],
    tags: ['tag1'],
    representations: [representation],
    category: WearableCategory.UPPER_BODY,
  },
  thumbnail: 'thumbnail.png',
  image: 'image.png',
}

export const VALID_THIRD_PARTY_WEARABLE_BASE_METADATA: Pick<ThirdPartyWearable, BaseKeys> = {
  id: 'urn:decentraland:mumbai:collections-thirdparty:jean-pier:someCollection:someItemId',
  descriptions: [
    {
      code: Locale.EN,
      text: 'some description',
    },
    {
      code: Locale.ES,
      text: 'una descripcion',
    },
  ],
  names: [
    {
      code: Locale.EN,
      text: 'name',
    },
  ],
  data: {
    replaces: [],
    hides: [],
    tags: ['tag1'],
    representations: [representation],
    category: WearableCategory.UPPER_BODY,
  },
  thumbnail: 'thumbnail.png',
  image: 'image.png',
  content: {
    ['image.png']: 'QmPEXLrQNEYVJfe5P2CbNuVpx4UabK37jQ6Hor1n9gw8dY',
    ['female/M_3LAU_Hat_Blue.glb']: 'QmebRdUS12afshxzNtTb2h6UhSXjMrGTGeZWcwwtmhTJng',
    ['male/M_3LAU_Hat_Blue.glb']: 'QmebRdUS12afshxzNtTb2h6UhSXjMrGTGeZWcwwtmhTJng',
    ['thumbnail.png']: 'QmPP232rkN2UDg8yGAyJ6hkHGsDFwXivcv9MXFfnW8r34y',
  },
}

type BaseKeys = typeof MERKLE_PROOF_REQUIRED_KEYS[number]

export const entityAndMerkleRoot = buildEntityMetadataWithMerkleProof(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA, [
  'someOtherHash1',
  'someOtherHash2',
])

// Using the entity, the keys to be hashed and the other node hashes, build the merkle proof for the entity and return a new proofed entity.
function buildEntityMetadataWithMerkleProof(
  baseEntity: Pick<ThirdPartyWearable, BaseKeys>,
  otherNodeHashes: string[]
): { root: string; entity: ThirdPartyWearable } {
  const entityHash = keccak256Hash(baseEntity, [...MERKLE_PROOF_REQUIRED_KEYS])
  const sortedHashes = [...otherNodeHashes, entityHash].sort()
  const tree = generateTree(sortedHashes)
  const entityProof = tree.proofs[entityHash]
  const thirdPartyWearable: ThirdPartyWearable = {
    ...baseEntity,
    merkleProof: {
      index: entityProof.index,
      proof: entityProof.proof,
      hashingKeys: [...MERKLE_PROOF_REQUIRED_KEYS],
      entityHash,
    },
  }
  return {
    root: tree.merkleRoot,
    entity: thirdPartyWearable,
  }
}
