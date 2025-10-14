import { Entity, EntityType, Outfit, Outfits } from '@dcl/schemas'
import {
  createOutfitsPointerValidateFn,
  outfitSlotsAreBetween0and9inclusiveValidateFn,
  outfitSlotsAreNotRepeatedValidateFn,
  outfitsNumberOfNamesForExtraSlotsIsCorrectValidateFn
} from '../../../src/validations/outfits'
import { buildDeployment } from '../../setup/deployments'
import { buildExternalCalls } from '../../setup/mock'
import { VALID_OUTFITS_METADATA } from '../../setup/outfits'

type TypedEntity<T> = Entity & {
  metadata: T
}

const ownerAddress = '0x12e7f74e73e951c61edd80910e46c3fece512345'
const baseOutfit: Outfit = {
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  eyes: { color: { r: 0.23046875, g: 0.625, b: 0.3125 } },
  hair: { color: { r: 0.35546875, g: 0.19140625, b: 0.05859375 } },
  skin: { color: { r: 0.94921875, g: 0.76171875, b: 0.6484375 } },
  wearables: ['urn:decentraland:off-chain:base-avatars:tall_front_01']
}

function outfitWithSlot(slot: number): Outfits['outfits'][0] {
  return {
    slot,
    outfit: baseOutfit
  }
}

describe('outfitsPointerValidateFn', () => {
  it('pointer is valid', async () => {
    const result = await validateOutfitsDeployment(`${ownerAddress}:outfits`, ownerAddress)
    expect(result.ok).toBeTruthy()
  })

  it('fails if pointer has more than 2 parts', async () => {
    await expectInvalidPointer(
      `${ownerAddress}:outfits:more`,
      ownerAddress,
      'The pointer is not valid. It should be in the format: <address>:outfits'
    )
  })

  it('fails if pointer has less than 2 parts', async () => {
    await expectInvalidPointer(
      ownerAddress,
      ownerAddress,
      'The pointer is not valid. It should be in the format: <address>:outfits'
    )
  })

  it('fails if pointer outfits part does not say "outfits"', async () => {
    await expectInvalidPointer(
      `${ownerAddress}:NO-outfit`,
      ownerAddress,
      'The pointer is not valid. It should be in the format: <address>:outfits'
    )
  })

  it('fails if pointer address part is not a valid eth address', async () => {
    const ownerAddress = 'not-valid-ethAddress'
    await expectInvalidPointer(
      `${ownerAddress}:outfits`,
      ownerAddress,
      'The address of the given pointer is not a valid ethereum address.'
    )
  })

  it('fails if pointer address part and owner address are different', async () => {
    await expectInvalidPointer(
      `${ownerAddress}:outfits`,
      'anotherAddress',
      'You can only alter your own outfits. The address of the pointer and the signer address are different (pointer:0x12e7f74e73e951c61edd80910e46c3fece512345:outfits signer: anotheraddress).'
    )
  })

  async function expectInvalidPointer(pointer: string, ownerAddress: string, expectedError: string) {
    const result = await validateOutfitsDeployment(pointer, ownerAddress)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toBeDefined()
    if (result.errors) {
      expect(result.errors[0]).toEqual(expectedError)
    }
  }

  async function validateOutfitsDeployment(pointer: string, ownerAddress: string) {
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: VALID_OUTFITS_METADATA
    }
    const deployment = buildDeployment({ entity })
    const externalCalls = buildExternalCalls({
      ownerAddress: () => ownerAddress
    })
    const pointerValidationFn = createOutfitsPointerValidateFn({ externalCalls })
    return pointerValidationFn(deployment)
  }
})

describe('outfitSlotsAreNotRepeatedValidateFn', () => {
  it('does not fail when slots are unique', async () => {
    const pointer = `${ownerAddress}:outfits`
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithSlot(1), outfitWithSlot(2)],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })

    const result = await outfitSlotsAreNotRepeatedValidateFn(deployment)
    expect(result.ok).toBeTruthy()
  })

  it('fails when slots are repeated', async () => {
    const pointer = `${ownerAddress}:outfits`
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithSlot(1), outfitWithSlot(2), outfitWithSlot(1)],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })

    const result = await outfitSlotsAreNotRepeatedValidateFn(deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toBeDefined()
    if (result.errors) {
      expect(result.errors[0]).toEqual('Outfits slots are repeated')
    }
  })
})

describe('outfitSlotsAreBetween0and9inclusiveValidateFn', () => {
  it('does not fail when slots are between 0 and 9 inclusive', async () => {
    const pointer = `${ownerAddress}:outfits`
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithSlot(1), outfitWithSlot(2)],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })

    const result = await outfitSlotsAreBetween0and9inclusiveValidateFn(deployment)
    expect(result.ok).toBeTruthy()
  })

  it('fails when slots are not between 0 and 9 inclusive', async () => {
    const pointer = `${ownerAddress}:outfits`
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithSlot(1), outfitWithSlot(-1), outfitWithSlot(10)],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })

    const result = await outfitSlotsAreBetween0and9inclusiveValidateFn(deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toBeDefined()
    if (result.errors) {
      expect(result.errors[0]).toEqual('Outfits slots are invalid, they must be between 0 and 9 inclusive')
    }
  })
})

describe('outfitsNumberOfNamesForExtraSlotsIsCorrectValidateFn', () => {
  it('does not fail when no names and no extra slots (slots 0-4)', async () => {
    const pointer = `${ownerAddress}:outfits`
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithSlot(1), outfitWithSlot(4)],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })

    const result = await outfitsNumberOfNamesForExtraSlotsIsCorrectValidateFn(deployment)
    expect(result.ok).toBeTruthy()
  })

  it('does not fail when names are provided and extra slots are used (slots 5-9)', async () => {
    const pointer = `${ownerAddress}:outfits`
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithSlot(1), outfitWithSlot(4), outfitWithSlot(5), outfitWithSlot(6), outfitWithSlot(7)],
        namesForExtraSlots: ['name1', 'name2', 'name3']
      }
    }
    const deployment = buildDeployment({ entity })

    const result = await outfitsNumberOfNamesForExtraSlotsIsCorrectValidateFn(deployment)
    expect(result.ok).toBeTruthy()
  })

  it('fails when extra slots are used but no names are provided', async () => {
    const pointer = `${ownerAddress}:outfits`
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [pointer],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithSlot(1), outfitWithSlot(4), outfitWithSlot(5), outfitWithSlot(6)],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })

    const result = await outfitsNumberOfNamesForExtraSlotsIsCorrectValidateFn(deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toBeDefined()
    if (result.errors) {
      expect(result.errors[0]).toEqual('A name must be provided if extra slots are used, but none were provided.')
    }
  })
})
