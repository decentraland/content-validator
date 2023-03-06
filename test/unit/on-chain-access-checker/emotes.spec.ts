import { buildEmoteDeployment, buildThirdPartyEmoteDeployment } from '../../setup/deployments'
import { VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT } from '../../setup/emotes'
import { buildExternalCalls } from '../../setup/mock'
import { buildEmoteValidateFn, buildOnChainAccessCheckerComponents } from './mock'

describe('Access: emotes', () => {
  it('When non-urns are used as pointers, then validation fails', async () => {
    const pointers = ['invalid-pointer']
    const deployment = buildEmoteDeployment(pointers)
    const externalCalls = buildExternalCalls()

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildEmoteValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Item pointers should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{id}). Invalid pointer: (invalid-pointer)'
    )
  })

  it('When there is more than one pointer set, then validation fails', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v1:atari_launch:a',
      'urn:decentraland:ethereum:collections-v1:atari_launch:b'
    ]
    const deployment = buildEmoteDeployment(pointers)
    const externalCalls = buildExternalCalls()

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildEmoteValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(`Only one pointer is allowed when you create an item. Received: ${pointers}`)
  })

  it('When several pointers resolve to the same URN then accept both but fail with the access', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v2:0x4c290f486bae507719c562b6b524bdb71a2570c9:1',
      'urn:decentraland:ethereum:collections-v2:0x4c290f486bae507719c562b6b524bdb71a2570c9:1'
    ]
    const deployment = buildEmoteDeployment(pointers)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some address'
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildEmoteValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following item: 'urn:decentraland:ethereum:collections-v2:0x4c290f486bae507719c562b6b524bdb71a2570c9:1'`
    )
  })

  it('When several pointers resolve to the same URN then accept both 2', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v2:0x4c290f486bae507719c562b6b524bdb71a2570c9:1',
      'urn:decentraland:ethereum:collections-v2:0x4c290f486bae507719c562b6b524bdb71a2570c9:1'
    ]
    const deployment = buildEmoteDeployment(pointers)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some address'
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildEmoteValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following item: 'urn:decentraland:ethereum:collections-v2:0x4c290f486bae507719c562b6b524bdb71a2570c9:1'`
    )
  })

  it('When urn network belongs to L2, then L2Checker is used', async () => {
    const ethAddress = 'address'
    const externalCalls = buildExternalCalls({
      ownerAddress: () => ethAddress
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const l2BlockSearchSpy = jest.spyOn(components.L2.blockSearch, 'findBlockForTimestamp')

    const deployment = buildEmoteDeployment([
      'urn:decentraland:mumbai:collections-v2:0x8dec2b9bd86108430a0c288ea1b76c749823d104:1'
    ])

    const validateFn = buildEmoteValidateFn(components)
    await validateFn(deployment)

    expect(l2BlockSearchSpy).toHaveBeenNthCalledWith(1, expect.anything())
    expect(components.L2.checker.validateWearables).toHaveBeenNthCalledWith(
      1,
      ethAddress,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
    expect(components.L2.checker.validateWearables).toHaveBeenNthCalledWith(
      2,
      ethAddress,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  })

  it('When pointer resolves to L1 fails because collection v1 is not allowed', async () => {
    const pointers = ['urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body']
    const deployment = buildEmoteDeployment(pointers)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some address'
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildEmoteValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `For the entity type: emote, the asset with urn type: blockchain-collection-v1-asset is invalid. Valid urn types for this entity: blockchain-collection-v2-asset,blockchain-collection-third-party`
    )
  })

  it('When pointer resolves to base asset then it fails because it is not allowed', async () => {
    const pointers = ['urn:decentraland:off-chain:base-avatars:BaseFemale']
    const deployment = buildEmoteDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildEmoteValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `For the entity type: emote, the asset with urn type: off-chain is invalid. Valid urn types for this entity: blockchain-collection-v2-asset,blockchain-collection-third-party`
    )
  })

  describe(`Merkle Proofed (Third Party) Emote`, () => {
    const { entity: metadata } = VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT

    it(`When urn corresponds to a Third Party emotes and can verify merkle root with the proofs, validation pass`, async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L2.checker.validateThirdParty = jest.fn(() => Promise.resolve(true))

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, metadata)
      const validateFn = buildEmoteValidateFn(components)
      const response = await validateFn(deployment)
      expect(response.ok).toBeTruthy()
    })
  })
})
