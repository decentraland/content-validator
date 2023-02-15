import { emotes } from '../../../src/validations/access-checker/emotes'
import { buildEmoteDeployment, buildThirdPartyEmoteDeployment } from '../../setup/deployments'
import { VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT } from '../../setup/emotes'
import {
  buildComponents,
  buildExternalCalls,
  buildSubGraphs,
  fetcherWithValidCollectionAndCreator
} from '../../setup/mock'

describe('Access: emotes', () => {
  it('When non-urns are used as pointers, then validation fails', async () => {
    const pointers = ['invalid-pointer']
    const deployment = buildEmoteDeployment(pointers)
    const externalCalls = buildExternalCalls()

    const response = await emotes(buildComponents({ externalCalls }), deployment)
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

    const response = await emotes(buildComponents({ externalCalls }), deployment)
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

    const response = await emotes(buildComponents({ externalCalls }), deployment)
    console.log(response.errors)
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

    const response = await emotes(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following item: 'urn:decentraland:ethereum:collections-v2:0x4c290f486bae507719c562b6b524bdb71a2570c9:1'`
    )
  })

  it('When urn network belongs to L2, then L2Checker is used', async () => {
    const ethAddress = 'address'
    const subGraphs = fetcherWithValidCollectionAndCreator(ethAddress)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => ethAddress
    })

    const l2BlockSearchSpy = jest.spyOn(subGraphs.l2BlockSearch, 'findBlockForTimestamp')

    const deployment = buildEmoteDeployment([
      'urn:decentraland:mumbai:collections-v2:0x8dec2b9bd86108430a0c288ea1b76c749823d104:1'
    ])

    await emotes(buildComponents({ externalCalls, subGraphs }), deployment)

    expect(l2BlockSearchSpy).toHaveBeenNthCalledWith(1, expect.anything())
    expect(subGraphs.L2.checker.validateWearables).toHaveBeenNthCalledWith(
      1,
      ethAddress,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
    expect(subGraphs.L2.checker.validateWearables).toHaveBeenNthCalledWith(
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

    const response = await emotes(buildComponents({ externalCalls }), deployment)
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

    const response = await emotes(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `For the entity type: emote, the asset with urn type: off-chain is invalid. Valid urn types for this entity: blockchain-collection-v2-asset,blockchain-collection-third-party`
    )
  })

  describe(`Merkle Proofed (Third Party) Emote`, () => {
    const { entity: metadata } = VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT

    it(`When urn corresponds to a Third Party emotes and can verify merkle root with the proofs, validation pass`, async () => {
      const subGraphs = buildSubGraphs()
      subGraphs.L2.checker.validateThirdParty = jest.fn(() => Promise.resolve(true))

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, metadata)

      const response = await emotes(buildComponents({ subGraphs }), deployment)
      expect(response.ok).toBeTruthy()
    })

    it(`When urn corresponds to a Third Party emotes and metadata is modified, validation fails`, async () => {
      const subGraphs = buildSubGraphs()

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, {
        ...metadata,
        content: {}
      })

      const response = await emotes(buildComponents({ subGraphs }), deployment)
      expect(response.ok).toBeFalsy()
    })

    it(`When urn corresponds to a Third Party emotes, then L2 subgraph is used`, async () => {
      const subGraphs = buildSubGraphs()

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, metadata)

      const l2BlockSearchSpy = jest.spyOn(subGraphs.l2BlockSearch, 'findBlockForTimestamp')
      await emotes.validate(buildComponents({ subGraphs }), deployment)

      expect(l2BlockSearchSpy).toHaveBeenNthCalledWith(1, expect.anything())
      expect(subGraphs.L2.checker.validateThirdParty).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      )
    })

    it(`When can't find any merkle proof, it should fail`, async () => {
      // When The Graph respond with no merkle proof
      const subGraphs = buildSubGraphs()

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, metadata)

      const response = await emotes(buildComponents({ subGraphs }), deployment)
      expect(response.ok).toBeFalsy()
    })

    it(`When merkle proof is not well formed, it should fail`, async () => {
      const subGraphs = buildSubGraphs()

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, {
        ...metadata,
        merkleProof: { proof: [], index: 0, hashingKeys: [], entityHash: '' }
      })

      const response = await emotes(buildComponents({ subGraphs }), deployment)
      expect(response.ok).toBeFalsy()
    })

    it(`When requiredKeys are not a subset of the hashingKeys, it should fail`, async () => {
      const subGraphs = buildSubGraphs()

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, {
        ...metadata,
        merkleProof: {
          ...metadata.merkleProof,
          hashingKeys: ['id', 'description']
        }
      })

      const response = await emotes(buildComponents({ subGraphs }), deployment)
      expect(response.ok).toBeFalsy()
    })

    it(`When entityHash doesn’t match the calculated hash, it should fail`, async () => {
      const subGraphs = buildSubGraphs()

      const deployment = buildThirdPartyEmoteDeployment(metadata.id, {
        ...metadata,
        merkleProof: { ...metadata.merkleProof, entityHash: 'someInvalidHash' }
      })

      const response = await emotes(buildComponents({ subGraphs }), deployment)
      expect(response.ok).toBeFalsy()
    })
  })
})
